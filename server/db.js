import pg from "pg";

// Connects to the real Postgres database (Supabase). SupplyX always runs
// against a real database now; there is no local or embedded fallback.
export async function database({ url } = {}) {
  if (!url) throw Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return {
    query: (sql, p = []) => pool.query(sql, p),
    close: () => pool.end(),
    transaction: async (fn) => {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const r = await fn(c);
        await c.query("COMMIT");
        return r;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    },
  };
}