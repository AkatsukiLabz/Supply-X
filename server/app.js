import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { authentication } from "./auth.js";
import { service } from "./service.js";
import { buyingGroups } from "./groups.js";
const uuid = z.string().uuid();
export function createApp(db, config = {}) {
  const app = express(),
    s = service(db, config.clock),
    mode = config.mode || "demo";
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
  // Block cross-site browser writes; production frontend/API should share an origin.
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("sec-fetch-site") === "cross-site"
    )
      return res
        .status(403)
        .json({ error: "Cross-site writes are not allowed" });
    next();
  });
  app.get("/api/health", async (req, res) => {
    await db.query("SELECT 1");
    res.json({
      status: "ok",
      mode,
      supabaseUrl: config.supabaseUrl || null,
      supabasePublishableKey: config.supabasePublishableKey || null,
    });
  });
  if (mode === "demo")
    app.get("/api/demo-users", async (req, res) =>
      res.json(
        (
          await db.query(
            "SELECT id,name,role,area FROM supplyx.users ORDER BY role,name",
          )
        ).rows,
      ),
    );
  app.use("/api", authentication(db, { ...config, mode }));
  app.get("/api/me", (req, res) => res.json(req.user));
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
