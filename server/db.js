import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { readFile } from "node:fs/promises";
export async function database({ url, path } = {}) {
  if (url) {
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
  const db = new PGlite(path);
  await db.exec(
    await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"),
  );
  return {
    query: (sql, p = []) => db.query(sql, p),
    transaction: (fn) => db.transaction(fn),
    close: () => db.close(),
  };
}
export const IDS = {
  shop: "10000000-0000-4000-8000-000000000001",
  shop2: "10000000-0000-4000-8000-000000000002",
  supplier: "10000000-0000-4000-8000-000000000003",
  supplier2: "10000000-0000-4000-8000-000000000004",
  admin: "10000000-0000-4000-8000-000000000005",
  product: "20000000-0000-4000-8000-000000000001",
};
export async function seed(db) {
  for (const [key, name, role] of [
    ["shop", "Mosh’s Mini Market", "shop"],
    ["shop2", "Corner Basket", "shop"],
    ["supplier", "Ubuntu Wholesale", "supplier"],
    ["supplier2", "Community Cash & Carry", "supplier"],
    ["admin", "SupplyX coordinator", "admin"],
  ])
    await db.query(
      "INSERT INTO supplyx.users(id,name,role,area) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [IDS[key], name, role, "Centurion"],
    );
  for (const [id, name, pack, price] of [
    [IDS.product, "Maize meal", "10 kg bag", 12500],
    [
      "20000000-0000-4000-8000-000000000002",
      "Cooking oil",
      "6 × 750 ml case",
      18000,
    ],
    ["20000000-0000-4000-8000-000000000003", "Sugar", "10 × 1 kg case", 21000],
  ])
    await db.query(
      "INSERT INTO supplyx.products VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [
        id,
        name,
        pack,
        price,
        "Illustrative demo price, not live market data",
        "2026-09-18",
      ],
    );
}
