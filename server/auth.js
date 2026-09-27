import { createRemoteJWKSet, jwtVerify } from "jose";

const signupRole = (role) => {
  if (role === "spaza_owner" || role === "supplier") return role;
  return null;
};

const dbRole = (role) => role;
const appRole = (role) => role;

const signupProfile = (payload) => {
  const meta = payload.user_metadata || {};
  const role = signupRole(meta.requested_role);
  const businessName = String(meta.business_name || "").trim();
  const contactName = String(meta.contact_name || businessName).trim();
  const phone = String(meta.phone || "").trim();
  const area = String(meta.area || "").trim();
  const bankConfirmationPath = String(meta.bank_confirmation_path || "").trim();
  const tradingProofPath = String(meta.trading_proof_path || "").trim();
  if (!role || !businessName || !contactName || !area) return null;
  return {
    id: payload.sub,
    businessName,
    contactName,
    phone,
    role,
    area,
    bankConfirmationPath,
    tradingProofPath,
  };
};

const publicProfile = async (db, id) =>
  (
    await db.query(
      `SELECT
        p.id,
        COALESCE(s.shop_name, u.business_name, p.full_name) AS name,
        p.role,
        COALESCE(s.location, u.location, '') AS area
       FROM public.profiles p
       LEFT JOIN public.spaza_shops s ON s.owner_id = p.id
       LEFT JOIN public.suppliers u ON u.owner_id = p.id
       WHERE p.id = $1`,
      [id],
    )
  ).rows[0];

const createPublicProfile = async (db, profile) =>
  db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO public.profiles(id, full_name, phone, role)
       VALUES($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role`,
      [profile.id, profile.contactName, profile.phone || null, dbRole(profile.role)],
    );
    if (profile.role === "spaza_owner") {
      await tx.query(
        `INSERT INTO public.spaza_shops(owner_id, shop_name, location)
         VALUES($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [profile.id, profile.businessName, profile.area],
      );
    } else {
      await tx.query(
        `INSERT INTO public.suppliers(
           owner_id, business_name, contact_phone, location,
           bank_confirmation_path, trading_proof_path
         )
         VALUES($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [
          profile.id,
          profile.businessName,
          profile.phone || null,
          profile.area,
          profile.bankConfirmationPath || null,
          profile.tradingProofPath || null,
        ],
      );
    }
    return publicProfile(tx, profile.id);
  });

// A page load normally fires several API calls at once (products, requests,
// auctions, orders...), and every one of them was separately asking the
// database "who is this person" before doing its own real work. That is a
// full extra round trip to the database, repeated needlessly for the same
// person within the same few seconds. This cache remembers the answer for a
// short time so only the first of those calls actually has to ask.
const PROFILE_CACHE_MS = 30_000;
const profileCache = new Map();

async function cachedProfile(db, id) {
  const hit = profileCache.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.user;
  const user = await publicProfile(db, id);
  if (user) profileCache.set(id, { user, expiresAt: Date.now() + PROFILE_CACHE_MS });
  return user;
}

export function authentication(db, { supabaseUrl } = {}) {
  if (!supabaseUrl?.startsWith("https://"))
    throw Error("SUPABASE_URL is required");
  const issuer = supabaseUrl.replace(/\/$/, "") + "/auth/v1";
  const keys = createRemoteJWKSet(new URL(issuer + "/.well-known/jwks.json"));
  return async (req, res, next) => {
    let id, payload;
    try {
      const token = req.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) throw Error();
      payload = (
        await jwtVerify(token, keys, { issuer, audience: "authenticated" })
      ).payload;
      id = payload.sub;
    } catch {
      return res
        .status(401)
        .json({ error: "A valid sign-in session is required" });
    }
    if (!id || !/^[0-9a-f-]{36}$/i.test(id))
      return res.status(401).json({ error: "Sign in to continue" });
    let user = await cachedProfile(db, id);
    if (!user) {
      const profile = signupProfile(payload);
      if (profile) {
        user = await createPublicProfile(db, profile);
        if (user)
          profileCache.set(id, { user, expiresAt: Date.now() + PROFILE_CACHE_MS });
      }
    }
    if (!user)
      return res
        .status(403)
        .json({
          error:
            "Your account needs a SupplyX business profile. Please sign up first.",
        });
    req.user = { ...user, role: appRole(user.role) };
    next();
  };
}