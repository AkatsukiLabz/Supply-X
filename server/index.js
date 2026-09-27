import { database } from "./db.js";
import { createApp } from "./app.js";
import express from "express";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required");
if (!process.env.SUPABASE_URL) throw Error("SUPABASE_URL is required");

const db = await database({ url: process.env.DATABASE_URL });
const app = createApp(db, {
  supabaseUrl: process.env.SUPABASE_URL,
  supabasePublishableKey:
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
app.use(express.static(fileURLToPath(new URL("../dist", import.meta.url))));
const port = Number(process.env.PORT || 3001),
  host = "0.0.0.0";
const server = app.listen(port, host, () =>
  console.log(`SupplyX: http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await db.close();
      process.exit(0);
    }),
  );