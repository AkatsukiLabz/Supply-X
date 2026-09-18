import { randomUUID as uuid } from "node:crypto";
export class Fault extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requireRole(user, role) {
  if (user.role !== role) throw new Fault(403, `${role} access required`);
}
const one = async (db, sql, p = []) => {
  const r = (await db.query(sql, p)).rows[0];
  if (!r) throw new Fault(404, "Record not found");
  return r;
};
const event = (db, u, id, action) =>
  db.query(
    "INSERT INTO supplyx.events(id,actor_id,entity_id,action) VALUES($1,$2,$3,$4)",
    [uuid(), u.id, id, action],
  );
export function service(db, clock = () => new Date()) {
  return {
    async requests(u) {
      return (
        await db.query(
          `SELECT r.*,p.name,p.pack FROM supplyx.requests r JOIN supplyx.products p ON p.id=r.product_id WHERE ($1='admin' OR r.shop_id=$2) ORDER BY r.created_at DESC`,
          [u.role, u.id],
        )
      ).rows;
    },
    async createRequest(u, { productId, quantity }) {
      requireRole(u, "shop");
      return db.transaction(async (tx) => {
        await one(tx, "SELECT id FROM supplyx.products WHERE id=$1", [
          productId,
        ]);
        const id = uuid();
        const r = await one(
          tx,
          "INSERT INTO supplyx.requests(id,shop_id,product_id,quantity,area) VALUES($1,$2,$3,$4,$5) RETURNING *",
          [id, u.id, productId, quantity, u.area],
        );
        await event(tx, u, id, "request.submitted");
        return r;
      });
    },
    async auctions(u) {
      const rows = (
        await db.query(
          `SELECT a.*,p.name,p.pack FROM supplyx.auctions a JOIN supplyx.products p ON p.id=a.product_id WHERE ($1='admin' OR ($1='supplier' AND a.area=$2) OR EXISTS(SELECT 1 FROM supplyx.allocations x JOIN supplyx.requests r ON r.id=x.request_id WHERE x.auction_id=a.id AND r.shop_id=$3)) ORDER BY a.created_at DESC`,
          [u.role, u.area, u.id],
        )
      ).rows;
      // Blind bidding: even the admin sees no bid prices before the closing time.
      for (const a of rows) {
        a.bids = (
          await db.query(
            `SELECT id,total_cents,created_at FROM supplyx.bids WHERE auction_id=$1 AND (supplier_id=$2 OR ($3='admin' AND $4::boolean)) ORDER BY total_cents,created_at,id`,
            [a.id, u.id, u.role, clock() >= new Date(a.closes_at)],
          )
        ).rows;
      }
      return rows;
    },
    async createAuction(u, { requestIds, closesAt }) {
      requireRole(u, "admin");
      if (new Date(closesAt) <= clock())
        throw new Fault(400, "Closing time must be in the future");
      return db.transaction(async (tx) => {
        const requests = [];
        // Sort row locks consistently to avoid deadlocks between overlapping batches.
        for (const id of [...requestIds].sort())
          requests.push(
            await one(
              tx,
              "SELECT * FROM supplyx.requests WHERE id=$1 FOR UPDATE",
              [id],
            ),
          );
        const first = requests[0];
        if (requests.some((r) => r.status !== "submitted"))
          throw new Fault(409, "A request has already been batched");
        if (
          requests.some(
            (r) => r.area !== first.area || r.product_id !== first.product_id,
          )
        )
          throw new Fault(
            400,
            "Choose the same product and area for one auction",
          );
        const id = uuid(),
          quantity = requests.reduce((s, r) => s + r.quantity, 0);
        const a = await one(
          tx,
          "INSERT INTO supplyx.auctions(id,product_id,area,quantity,closes_at) VALUES($1,$2,$3,$4,$5) RETURNING *",
          [id, first.product_id, first.area, quantity, closesAt],
        );
        for (const r of requests) {
          await tx.query(
            "INSERT INTO supplyx.allocations(request_id,auction_id,quantity) VALUES($1,$2,$3)",
            [r.id, id, r.quantity],
          );
          await tx.query(
            "UPDATE supplyx.requests SET status='batched' WHERE id=$1",
            [r.id],
          );
        }
        await event(tx, u, id, "auction.opened");
        return a;
      });
    },
    async bid(u, id, { totalCents }) {
      requireRole(u, "supplier");
      return db.transaction(async (tx) => {
        const a = await one(
          tx,
          "SELECT * FROM supplyx.auctions WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (a.area !== u.area)
          throw new Fault(403, "Auction is outside your service area");
        if (a.status !== "open" || clock() >= new Date(a.closes_at))
          throw new Fault(409, "Bidding is closed");
        const b = await one(
          tx,
          "INSERT INTO supplyx.bids(id,auction_id,supplier_id,total_cents) VALUES($1,$2,$3,$4) ON CONFLICT(auction_id,supplier_id) DO UPDATE SET total_cents=EXCLUDED.total_cents,created_at=now() RETURNING id,total_cents,created_at",
          [uuid(), id, u.id, totalCents],
        );
        await event(tx, u, id, "bid.submitted");
        return b;
      });
    },
    async award(u, id) {
      requireRole(u, "admin");
      return db.transaction(async (tx) => {
        const a = await one(
          tx,
          "SELECT * FROM supplyx.auctions WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (a.status === "awarded")
          return one(tx, "SELECT * FROM supplyx.orders WHERE auction_id=$1", [
            id,
          ]);
        if (clock() < new Date(a.closes_at))
          throw new Fault(409, "Wait until the auction closes");
        const bids = (
          await tx.query(
            "SELECT * FROM supplyx.bids WHERE auction_id=$1 ORDER BY total_cents,created_at,id",
            [id],
          )
        ).rows;
        if (!bids.length)
          throw new Fault(409, "No supplier bids. No order has been created.");
        const winner = bids[0],
          orderId = uuid();
        const allocations = (
          await tx.query(
            "SELECT * FROM supplyx.allocations WHERE auction_id=$1 ORDER BY request_id",
            [id],
          )
        ).rows;
        // Allocate in integer cents. Largest remainders get spare cents, ties by request ID.
        const shares = allocations.map((x) => ({
          ...x,
          cents: Math.floor((winner.total_cents * x.quantity) / a.quantity),
          remainder: (winner.total_cents * x.quantity) % a.quantity,
        }));
        let left = winner.total_cents - shares.reduce((s, x) => s + x.cents, 0);
        const ranked = [...shares].sort(
          (x, y) =>
            y.remainder - x.remainder ||
            x.request_id.localeCompare(y.request_id),
        );
        for (let i = 0; i < left; i++) ranked[i].cents++;
        for (const x of shares) {
          await tx.query(
            "UPDATE supplyx.allocations SET charge_cents=$1 WHERE request_id=$2",
            [x.cents, x.request_id],
          );
          await tx.query(
            "UPDATE supplyx.requests SET status='ordered' WHERE id=$1",
            [x.request_id],
          );
        }
        const order = await one(
          tx,
          "INSERT INTO supplyx.orders(id,auction_id,bid_id) VALUES($1,$2,$3) RETURNING *",
          [orderId, id, winner.id],
        );
        await tx.query(
          "UPDATE supplyx.auctions SET status='awarded' WHERE id=$1",
          [id],
        );
        await event(tx, u, orderId, "order.awarded");
        return order;
      });
    },
    async orders(u) {
      const rows = (
        await db.query(
          `SELECT o.*,a.quantity,a.area,p.name,p.pack,b.total_cents,b.supplier_id FROM supplyx.orders o JOIN supplyx.auctions a ON a.id=o.auction_id JOIN supplyx.products p ON p.id=a.product_id JOIN supplyx.bids b ON b.id=o.bid_id WHERE ($1='admin' OR b.supplier_id=$2 OR EXISTS(SELECT 1 FROM supplyx.allocations x JOIN supplyx.requests r ON r.id=x.request_id WHERE x.auction_id=a.id AND r.shop_id=$2)) ORDER BY o.created_at DESC`,
          [u.role, u.id],
        )
      ).rows;
      for (const o of rows) {
        o.allocations = (
          await db.query(
            `SELECT x.*,r.shop_id,u.name AS shop_name FROM supplyx.allocations x JOIN supplyx.requests r ON r.id=x.request_id JOIN supplyx.users u ON u.id=r.shop_id WHERE x.auction_id=$1 AND ($2!='shop' OR r.shop_id=$3) ORDER BY x.request_id`,
            [o.auction_id, u.role, u.id],
          )
        ).rows;
        if (u.role === "shop") delete o.total_cents;
      }
      return rows;
    },
    async dispatch(u, id) {
      requireRole(u, "supplier");
      return db.transaction(async (tx) => {
        const o = await one(
          tx,
          "SELECT o.*,b.supplier_id FROM supplyx.orders o JOIN supplyx.bids b ON b.id=o.bid_id WHERE o.id=$1 FOR UPDATE OF o",
          [id],
        );
        if (o.supplier_id !== u.id)
          throw new Fault(403, "This order belongs to another supplier");
        if (o.status !== "confirmed")
          throw new Fault(409, "Only confirmed orders can be dispatched");
        await tx.query(
          "UPDATE supplyx.orders SET status='dispatched' WHERE id=$1",
          [id],
        );
        await event(tx, u, id, "order.dispatched");
        return { id, status: "dispatched" };
      });
    },
    async receive(u, requestId) {
      requireRole(u, "shop");
      return db.transaction(async (tx) => {
        const x = await one(
          tx,
          "SELECT x.*,r.shop_id FROM supplyx.allocations x JOIN supplyx.requests r ON r.id=x.request_id WHERE x.request_id=$1",
          [requestId],
        );
        if (x.shop_id !== u.id)
          throw new Fault(403, "This allocation belongs to another shop");
        const o = await one(
          tx,
          "SELECT * FROM supplyx.orders WHERE auction_id=$1 FOR UPDATE",
          [x.auction_id],
        );
        if (x.received_at) return { requestId, status: "received" };
        if (o.status !== "dispatched")
          throw new Fault(409, "The supplier must dispatch first");
        await tx.query(
          "UPDATE supplyx.allocations SET received_at=now() WHERE request_id=$1",
          [requestId],
        );
        await tx.query(
          "UPDATE supplyx.requests SET status='received' WHERE id=$1",
          [requestId],
        );
        const pending = await tx.query(
          "SELECT request_id FROM supplyx.allocations WHERE auction_id=$1 AND received_at IS NULL",
          [x.auction_id],
        );
        if (!pending.rows.length)
          await tx.query(
            "UPDATE supplyx.orders SET status='completed' WHERE id=$1",
            [o.id],
          );
        await event(tx, u, requestId, "allocation.received");
        return { requestId, status: "received" };
      });
    },
  };
}
