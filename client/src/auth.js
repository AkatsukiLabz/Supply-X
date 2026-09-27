// SupplyX sign in helpers (frontend only).
//
// Works with BOTH backend modes that already exist:
//   demo mode      -> checks the demo email and password below, then sends
//                     the "x-demo-user" header the backend already expects.
//   supabase mode  -> signs in with Supabase email and password, then sends
//                     "Authorization: Bearer <token>" to the backend.
// No backend changes are needed.

export const ROLES = [
  { value: "spaza_owner",
    label: "Shop Owner",
    hint: "Request stock with nearby shops" },
  { value: "supplier", label: "Supplier", hint: "Bid on combined orders" },
  { value: "admin", label: "Admin", hint: "Coordinate requests and auctions" },
];

export const roleLabel = (role) =>
  ROLES.find((r) => r.value === role)?.label || role;

// Demo logins. The IDs match the accounts the backend seeds in server/db.js.
export const DEMO_PASSWORD = "SupplyX2026";
export const DEMO_ACCOUNTS = [
  {
    email: "mosh@supplyx.demo",
    name: "Mosh’s Mini Market",
    role: "spaza_owner",
    id: "10000000-0000-4000-8000-000000000001",
  },
  {
    email: "corner@supplyx.demo",
    name: "Corner Basket",
    role: "spaza_owner",
    id: "10000000-0000-4000-8000-000000000002",
  },
  {
    email: "ubuntu@supplyx.demo",
    name: "Ubuntu Wholesale",
    role: "supplier",
    id: "10000000-0000-4000-8000-000000000003",
  },
  {
    email: "community@supplyx.demo",
    name: "Community Cash & Carry",
    role: "supplier",
    id: "10000000-0000-4000-8000-000000000004",
  },
  {
    email: "admin@supplyx.demo",
    name: "SupplyX coordinator",
    role: "admin",
    id: "10000000-0000-4000-8000-000000000005",
  },
];

const KEY = "supplyx.session";
let runtimeConfig = {};
let backendAvailable = false;
const viteSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(
  /\/$/,
  "",
);
const viteSupabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "";

const supabaseConfig = () => ({
  url: viteSupabaseUrl || runtimeConfig.supabaseUrl || "",
  key: viteSupabaseKey || runtimeConfig.supabasePublishableKey || "",
});

// ---------- session storage ----------

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.expiresAt && Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session, remember) {
  try {
    clearSession();
    (remember ? localStorage : sessionStorage).setItem(
      KEY,
      JSON.stringify(session),
    );
  } catch {
    // Storage blocked (private window). The session still works until refresh.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Headers every API call needs for the signed in user.
export function authHeaders(session) {
  if (!session) return {};
  return session.mode === "demo"
    ? { "x-demo-user": session.user.id }
    : { Authorization: `Bearer ${session.token}` };
}

// ---------- API helpers ----------

export async function getMode() {
  const builtConfig = supabaseConfig();

  const r = await fetch("/api/health").catch(() => null);
  backendAvailable = Boolean(r?.ok);
  if (!r?.ok) {
    runtimeConfig = {};
    return builtConfig.url && builtConfig.key ? "supabase" : "demo";
  }
  const health = await r.json();
  runtimeConfig = {
    supabaseUrl: (health.supabaseUrl || "").replace(/\/$/, ""),
    supabasePublishableKey: health.supabasePublishableKey || "",
  };
  return health.mode;
}

async function fetchApiProfile(headers) {
  const r = await fetch("/api/me", { headers });
  const body = await r.json().catch(() => ({}));
  if (!r.ok)
    throw Error(body.error || "We could not load your SupplyX profile.");
  return body;
}

async function fetchSupabaseRows(path, token) {
  const { url, key } = supabaseConfig();
  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await r.json().catch(() => []);
  if (!r.ok) throw Error(body.message || "We could not load your SupplyX profile.");
  return Array.isArray(body) ? body : [];
}

async function fetchSupabaseProfile(token, authUserId) {
  const profiles = await fetchSupabaseRows(
    `profiles?id=eq.${authUserId}&select=id,full_name,role`,
    token,
  );
  const profile = profiles[0];
  if (!profile)
    throw Error("Your account needs a SupplyX business profile. Please sign up first.");

  const [shops, suppliers] = await Promise.all([
    fetchSupabaseRows(
      `spaza_shops?owner_id=eq.${authUserId}&select=shop_name,location`,
      token,
    ).catch(() => []),
    fetchSupabaseRows(
      `suppliers?owner_id=eq.${authUserId}&select=business_name,location`,
      token,
    ).catch(() => []),
  ]);

  const shop = shops[0];
  const supplier = suppliers[0];
  return {
    id: profile.id,
    name:
      shop?.shop_name || supplier?.business_name || profile.full_name || "SupplyX user",
    role: profile.role,
    area: shop?.location || supplier?.location || "",
  };
}

async function fetchProfile(headers, token, authUserId) {
  if (backendAvailable) return fetchApiProfile(headers);
  return fetchSupabaseProfile(token, authUserId);
}

// ---------- sign in ----------

export async function signIn({ email, password, mode }) {
  email = email.trim().toLowerCase();
  if (!email || !password) throw Error("Enter your email and password.");

  let session;

  if (mode === "demo") {
    const account = DEMO_ACCOUNTS.find((a) => a.email === email);
    if (!account || password !== DEMO_PASSWORD)
      throw Error("Incorrect email or password.");
    const user = backendAvailable
      ? await fetchApiProfile({ "x-demo-user": account.id })
      : {
          ...account,
          area: "Centurion",
        };
    session = { mode, user, staticDemo: !backendAvailable };
  } else {
    const { url, key } = supabaseConfig();
    if (!url || !key)
      throw Error(
        "Sign in is not set up yet. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to your .env file.",
      );
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const message = body.msg || body.error_description || body.error || "";
      const lower = message.toLowerCase();
      if (lower.includes("email not confirmed"))
        throw Error("Please confirm your email in Supabase before signing in.");
      if (lower.includes("invalid login credentials"))
        throw Error("Incorrect email or password.");
      throw Error(message || "Sign in failed. Try again.");
    }
    const token = body.access_token;
    const authUserId = body.user?.id;
    const user = await fetchProfile(
      { Authorization: `Bearer ${token}` },
      token,
      authUserId,
    );
    session = {
      mode,
      token,
      expiresAt: Date.now() + (body.expires_in || 3600) * 1000,
      user,
      staticDemo: !backendAvailable,
    };
  }

  return session;
}

export async function requestPasswordReset(email, mode) {
  email = email.trim().toLowerCase();
  if (mode === "demo")
    return `Demo accounts all use the password ${DEMO_PASSWORD}.`;
  if (!email)
    throw Error("Type your email above first, then click Forgot password.");
  const { url, key } = supabaseConfig();
  if (!url || !key)
    throw Error("Password reset is not set up yet.");
  const r = await fetch(`${url}/auth/v1/recover`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!r.ok) throw Error("We could not send a reset link. Try again soon.");
  return `If ${email} has a SupplyX account, a reset link is on its way.`;
}

// ---------- sign up ----------

// Service areas. The backend groups shops and suppliers by EXACT area name,
// so everyone must pick from this list (no free typing).
export const AREAS = [
  "Centurion",
  "Pretoria Central",
  "Midrand",
  "Soweto",
  "Johannesburg Central",
  "Tembisa",
  "Mamelodi",
  "Soshanguve",
];

// Only shops and suppliers can sign themselves up.
// Admin accounts are created by the SupplyX team.
export const SIGNUP_ROLES = ROLES.filter((r) => r.value !== "admin");

// Returns an object of { fieldName: "error message" }. Empty means valid.
export function validateSignup(f) {
  const e = {};
  if (f.businessName.trim().length < 2)
    e.businessName = "Enter your business name.";
  if (f.contactName.trim().length < 2) e.contactName = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
    e.email = "Enter a valid email address.";
  if (!/^(\+27|0)[6-8][0-9]{8}$/.test(f.phone.replace(/\s/g, "")))
    e.phone = "Enter a South African mobile number, e.g. 082 123 4567.";
  if (!AREAS.includes(f.area)) e.area = "Choose your service area.";
  if (
    f.password.length < 8 ||
    !/[A-Za-z]/.test(f.password) ||
    !/\d/.test(f.password)
  )
    e.password = "Use at least 8 characters with letters and numbers.";
  if (f.confirm !== f.password) e.confirm = "Passwords do not match.";
  if (!f.agree) e.agree = "You need to accept the terms to continue.";
  if (f.role === "supplier") {
    if (!f.bankConfirmationFile) e.bankConfirmationFile = "Upload your bank confirmation letter.";
    if (!f.tradingProofFile) e.tradingProofFile = "Upload proof of trading.";
  }
  return e;
}

// Uploads one verification document straight to Supabase Storage, before the
// account technically exists. Files land in a "pending/" folder that only
// allows uploads (no reading) from an unauthenticated client -- the backend
// later reads it with the service role key when generating signed URLs for
// admin. Returns the storage object path to save on the Supabase user's
// metadata, or throws with a message safe to show the person.
export async function uploadVerificationDoc(file, kind) {
  const { url, key } = supabaseConfig();
  if (!url || !key)
    throw Error(
      "Document upload is not set up yet. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to your .env file.",
    );
  if (!file) throw Error("Choose a file first.");
  if (file.size > 5 * 1024 * 1024) throw Error("File must be under 5MB.");
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type))
    throw Error("Only PDF, JPG or PNG files are allowed.");

  const ext = file.name.split(".").pop() || "pdf";
  const path = `pending/${crypto.randomUUID()}-${kind}.${ext}`;

  const r = await fetch(
    `${url}/storage/v1/object/supplier-documents/${path}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": file.type,
      },
      body: file,
    },
  );
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw Error(
      body.message || "Could not upload the file. Please try again.",
    );
  }
  return path;
}

export async function signUp(f, mode) {
  const email = f.email.trim().toLowerCase();

  // Demo mode: the local backend has no sign up endpoint, so nothing is saved.
  if (mode === "demo") {
    await new Promise((r) => setTimeout(r, 600));
    return { demo: true, email };
  }

  const { url, key } = supabaseConfig();
  if (!url || !key)
    throw Error(
      "Sign up is not set up yet. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to your .env file.",
    );

  const r = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: f.password,
      // Saved on the Supabase user. The backend team uses this to create the
      // SupplyX business profile after approval. It does NOT grant a role.
      data: {
        business_name: f.businessName.trim(),
        contact_name: f.contactName.trim(),
        phone: f.phone.replace(/\s/g, ""),
        area: f.area,
        requested_role: f.role,
        ...(f.role === "supplier"
          ? {
              bank_confirmation_path: f.bankConfirmationPath || "",
              trading_proof_path: f.tradingProofPath || "",
            }
          : {}),
      },
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (body.msg || body.error_description || "").toLowerCase();
    if (r.status === 422 || msg.includes("already"))
      throw Error("An account with this email already exists. Try signing in.");
    if (r.status === 429)
      throw Error("Too many attempts. Wait a few minutes and try again.");
    throw Error(body.msg || "We could not create your account. Try again.");
  }
  return { demo: false, email };
}
