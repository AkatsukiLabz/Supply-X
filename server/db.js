import pg from "pg";

// Connects to the real Postgres database (Supabase). SupplyX always runs
// against a real database now; there is no local or embedded fallback.
export async function database({ url } = {}) {
  if (!url) throw Error("DATABASE_URL is required");
  // A page load fires several requests at once (products, requests,
  // auctions, orders...), each needing its own database connection at the
  // same moment. Five was tight enough that some of them had to queue and
  // wait their turn, which showed up as the page feeling slow. Ten gives
  // enough headroom for one person's page load without opening more
  // connections than a small Supabase project allows.
  const pool = new pg.Pool({ connectionString: url, max: 10 });
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