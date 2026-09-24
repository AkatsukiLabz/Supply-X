import { database, seed } from "./db.js";
import { createApp } from "./app.js";
import express from "express";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
const mode = process.env.AUTH_MODE || "demo";
if (mode === "demo" && process.env.NODE_ENV === "production")
  throw Error("Demo mode cannot run in production");
if (mode === "supabase" && !process.env.DATABASE_URL)
  throw Error("Supabase mode requires DATABASE_URL");
if (mode === "demo" && process.env.DATABASE_URL)
  throw Error("Demo mode must use the local database; no remote demo seeding");
await mkdir(new URL("../.data", import.meta.url), { recursive: true });
const db = await database({
  url: process.env.DATABASE_URL,
  path: fileURLToPath(new URL("../.data/postgres", import.meta.url)),
});
if (mode === "demo") await seed(db);
const app = createApp(db, {
  mode,
  supabaseUrl: process.env.SUPABASE_URL,
  supabasePublishableKey:
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY,
});
app.use(express.static(fileURLToPath(new URL("../dist", import.meta.url))));
const port = Number(process.env.PORT || 3001),
  host = mode === "demo" ? "127.0.0.1" : "0.0.0.0";
const server = app.listen(port, host, () =>
  console.log(`SupplyX: http://${host}:${port} (${mode})`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await db.close();
      process.exit(0);
    }),
  );
