import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { authentication } from "./auth.js";
import { service } from "./service.js";
import { buyingGroups } from "./groups.js";
const uuid = z.string().uuid();
export function createApp(db, config = {}) {
  const app = express(),
    s = service(db, config.clock, {
      supabaseUrl: config.supabaseUrl,
      supabaseServiceRoleKey: config.supabaseServiceRoleKey,
    });
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          connectSrc: ["'self'", config.supabaseUrl].filter(Boolean),
        },
      },
    }),
  );
  app.use(express.json({ limit: "16kb" }));

  // The frontend and this API do not have to share an origin (for example,
  // the frontend deployed to GitHub Pages and this server deployed
  // separately). config.corsOrigins is a comma-separated allowlist of exact
  // origins ("https://username.github.io") that may call this API from a
  // browser; anything else is refused. When it is empty, only same-origin
  // requests work, which is fine for a combined local/single-host setup.
  const allowedOrigins = (config.corsOrigins || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use("/api", (req, res, next) => {
    const origin = req.get("origin");
    if (origin && allowedOrigins.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });
  app.get("/api/health", async (req, res) => {
    await db.query("SELECT 1");
    res.json({
      status: "ok",
      supabaseUrl: config.supabaseUrl || null,
      supabasePublishableKey: config.supabasePublishableKey || null,
    });
  });
  app.use("/api", authentication(db, config));
  app.get("/api/me", (req, res) => res.json(req.user));
  app.get("/api/me/documents/status", async (req, res) =>
    res.json(await s.ownDocumentsStatus(req.user)),
  );
  app.post("/api/me/documents", async (req, res) => {
    const input = z
      .object({
        bankConfirmationPath: z.string().min(1).max(500).optional(),
        tradingProofPath: z.string().min(1).max(500).optional(),
      })
      .strict()
      .parse(req.body);
    res.json(await s.updateOwnDocuments(req.user, input));
  });
  app.get("/api/products", async (req, res) =>
    res.json(
      (
        await db.query(
          `SELECT
            id,
            product_name AS name,
            unit AS pack,
            ROUND(market_unit_price * 100)::integer AS reference_cents,
            COALESCE(market_price_source, 'Market reference') AS reference_source,
            market_price_date AS reference_date
           FROM public.products
           ORDER BY product_name`,
        )
      ).rows,
    ),
  );
  app.get("/api/requests", async (req, res) =>
    res.json(await s.requests(req.user)),
  );
  app.post("/api/requests", async (req, res) =>
    res.status(201).json(
      await s.createRequest(
        req.user,
        z
          .object({
            productId: uuid,
            quantity: z.number().int().min(1).max(10000),
          })
          .strict()
          .parse(req.body),
      ),
    ),
  );
  app.get("/api/auctions", async (req, res) =>
    res.json(await s.auctions(req.user)),
  );
  app.post("/api/auctions", async (req, res) => {
    const input = z
      .object({
        requestIds: z
          .array(uuid)
          .min(1)
          .max(100)
          .refine((x) => new Set(x).size === x.length, "Duplicate request IDs"),
        closesAt: z.iso.datetime(),
      })
      .strict()
      .parse(req.body);
    res.status(201).json(await s.createAuction(req.user, input));
  });
  app.post("/api/auctions/:id/bids", async (req, res) =>
    res.status(201).json(
      await s.bid(
        req.user,
        uuid.parse(req.params.id),
        z
          .object({ totalCents: z.number().int().min(1).max(100000000) })
          .strict()
          .parse(req.body),
      ),
    ),
  );
  app.post("/api/auctions/:id/award", async (req, res) =>
    res.json(await s.award(req.user, uuid.parse(req.params.id))),
  );
    app.get("/api/groups", async (req, res) =>
    res.json(await buyingGroups(db, req.user)),
  );
  app.get("/api/orders", async (req, res) =>
    res.json(await s.orders(req.user)),
  );
  app.post("/api/orders/:id/dispatch", async (req, res) =>
    res.json(await s.dispatch(req.user, uuid.parse(req.params.id))),
  );
  app.post("/api/allocations/:id/receive", async (req, res) =>
    res.json(await s.receive(req.user, uuid.parse(req.params.id))),
  );
  app.get("/api/admin/suppliers", async (req, res) =>
    res.json(await s.adminSuppliers(req.user)),
  );
  app.get("/api/admin/suppliers/:id/documents/:field", async (req, res) => {
    const { buffer, contentType } = await s.supplierDocument(
      req.user,
      uuid.parse(req.params.id),
      req.params.field,
    );
    res.set("Content-Type", contentType);
    res.set("Content-Disposition", "inline");
    res.send(buffer);
  });
  app.post("/api/admin/suppliers/:id/verify", async (req, res) => {
    const input = z
      .object({
        field: z.enum(["contact", "area", "bank", "trading"]),
        verified: z.boolean(),
      })
      .strict()
      .parse(req.body);
    res.json(
      await s.verifySupplier(
        req.user,
        uuid.parse(req.params.id),
        input.field,
        input.verified,
      ),
    );
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Endpoint not found" }),
  );
  app.use((err, req, res, next) => {
    if (err instanceof z.ZodError)
      return res
        .status(400)
        .json({
          error: "Check your input",
          details: err.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        });
    if (err.code === "23505")
      return res.status(409).json({ error: "This record already exists" });
    if (err.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON" });
    if (err.type === "entity.too.large")
      return res.status(413).json({ error: "Request is too large" });
    if (!err.status) console.error(err);
    res
      .status(err.status || 500)
      .json({ error: err.status ? err.message : "Unexpected server error" });
  });
  return app;
}