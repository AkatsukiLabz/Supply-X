import { createRemoteJWKSet, jwtVerify } from "jose";
export function authentication(db, { mode = "demo", supabaseUrl } = {}) {
  if (!["demo", "supabase"].includes(mode))
    throw Error("AUTH_MODE must be demo or supabase");
  if (mode === "demo" && process.env.NODE_ENV === "production")
    throw Error("Demo authentication is forbidden in production");
  if (mode === "supabase" && !supabaseUrl?.startsWith("https://"))
    throw Error("SUPABASE_URL is required");
  const issuer = supabaseUrl?.replace(/\/$/, "") + "/auth/v1";
  const keys =
    mode === "supabase"
      ? createRemoteJWKSet(new URL(issuer + "/.well-known/jwks.json"))
      : null;
  return async (req, res, next) => {
    let id;
    if (mode === "demo") id = req.get("x-demo-user");
    else {
      try {
        const token = req.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
        if (!token) throw Error();
        id = (
          await jwtVerify(token, keys, { issuer, audience: "authenticated" })
        ).payload.sub;
      } catch {
        return res
          .status(401)
          .json({ error: "A valid sign-in session is required" });
      }
    }
    if (!id || !/^[0-9a-f-]{36}$/i.test(id))
      return res.status(401).json({ error: "Sign in to continue" });
    const result = await db.query(
      "SELECT id,name,role,area FROM supplyx.users WHERE id=$1",
      [id],
    );
    if (!result.rows[0])
      return res
        .status(403)
        .json({ error: "Your account needs a SupplyX business profile" });
    req.user = result.rows[0];
    next();
  };
}
