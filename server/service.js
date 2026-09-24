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

const currentShop = (db, userId) =>
  one(db, "SELECT * FROM public.spaza_shops WHERE owner_id=$1 LIMIT 1", [
    userId,
  ]);

const currentSupplier = (db, userId) =>
  one(db, "SELECT * FROM public.suppliers WHERE owner_id=$1 LIMIT 1", [
    userId,
  ]);

async function ensureGroupMember(tx, u) {
  const shop = await currentShop(tx, u.id);
  const group = (
    await tx.query(
      `INSERT INTO public.purchasing_groups(group_name, created_by, target_amount, status)
       VALUES($1, $2, 1, 'open')
       RETURNING *`,
      [`${shop.location || u.area || "SupplyX"} collective`, u.id],
    )
  ).rows[0];
  return (
    await tx.query(
      `INSERT INTO public.group_members(group_id, shop_id, status)
       VALUES($1, $2, 'active')
       RETURNING *`,
      [group.id, shop.id],
    )
  ).rows[0];
}

const statusForApp = (status) =>
  status === "funded"
    ? "submitted"
    : status === "fulfilled"
      ? "received"
      : status;

export function service(db, clock = () => new Date()) {
  return {
    async requests(u) {
      const rows = await db.query(
        `SELECT
          r.id,
          r.product_id,
          r.quantity,
          COALESCE(s.location, '') AS area,
          r.status,
          r.created_at,
          p.product_name AS name,
          p.unit AS pack
         FROM public.requests r
         JOIN public.products p ON p.id = r.product_id
         JOIN public.group_members gm ON gm.id = r.group_member_id
         JOIN public.spaza_shops s ON s.id = gm.shop_id
         WHERE ($1='admin' OR s.owner_id=$2)
         ORDER BY r.created_at DESC`,
        [u.role, u.id],
      );
      return rows.rows.map((r) => ({ ...r, status: statusForApp(r.status) }));
    },

    async createRequest(u, { productId, quantity }) {
      requireRole(u, "shop");
      return db.transaction(async (tx) => {
        const product = await one(
          tx,
          "SELECT * FROM public.products WHERE id=$1",
          [productId],
        );
        const member = await ensureGroupMember(tx, u);
        const committed = Number(product.market_unit_price) * quantity;
        const row = (
          await tx.query(
            `INSERT INTO public.requests(
              group_member_id,
              product_id,
              quantity,
              market_unit_price,
              committed_amount,
              status
            )
            VALUES($1, $2, $3, $4, $5, 'funded')
            RETURNING *`,
            [
              member.id,
              productId,
              quantity,
              product.market_unit_price,
              committed,
            ],
          )
        ).rows[0];
        return {
          ...row,
          name: product.product_name,
          pack: product.unit,
          area: u.area,
          status: "submitted",
        };
      });
    },

    async auctions(u) {
      const result = await db.query(
        `SELECT
          a.id,
          a.group_id,
          a.product_id,
          a.quantity,
          a.closes_at,
          a.status,
          a.created_at,
          p.product_name AS name,
          p.unit AS pack,
          COALESCE(MAX(s.location), MAX(su.location), '') AS area
         FROM public.auctions a
         JOIN public.products p ON p.id = a.product_id
         LEFT JOIN public.purchasing_groups g ON g.id = a.group_id
         LEFT JOIN public.group_members gm ON gm.group_id = g.id
         LEFT JOIN public.spaza_shops s ON s.id = gm.shop_id
         LEFT JOIN public.suppliers su ON su.owner_id = $2
         WHERE ($1='admin' OR ($1='supplier' AND COALESCE(s.location, su.location, '')=$3) OR s.owner_id=$2)
         GROUP BY a.id, p.product_name, p.unit
         ORDER BY a.created_at DESC`,
        [u.role, u.id, u.area],
      );
      const rows = result.rows;
      for (const a of rows) {
        a.bids = (
          await db.query(
            `SELECT
              b.id,
              ROUND((b.unit_price * $2) * 100)::integer AS total_cents,
              b.created_at
             FROM public.bids b
             JOIN public.suppliers s ON s.id = b.supplier_id
             WHERE b.auction_id=$1 AND (s.owner_id=$3 OR ($4='admin' AND $5::boolean))
             ORDER BY b.unit_price, b.created_at, b.id`,
            [
              a.id,
              Number(a.quantity),
              u.id,
              u.role,
              clock() >= new Date(a.closes_at),
            ],
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
        const requests = (
          await tx.query(
            `SELECT r.*, gm.group_id
             FROM public.requests r
             JOIN public.group_members gm ON gm.id = r.group_member_id
             WHERE r.id = ANY($1)
             FOR UPDATE OF r`,
            [requestIds],
          )
        ).rows;
        if (requests.length !== requestIds.length)
          throw new Fault(404, "A selected request was not found");
        const first = requests[0];
        if (requests.some((r) => r.status !== "funded"))
          throw new Fault(409, "A request has already been batched");
        if (requests.some((r) => r.product_id !== first.product_id))
          throw new Fault(400, "Choose the same product for one auction");
        const quantity = requests.reduce((s, r) => s + Number(r.quantity), 0);
        const auction = (
          await tx.query(
            `INSERT INTO public.auctions(group_id, product_id, quantity, closes_at, status)
             VALUES($1, $2, $3, $4, 'open')
             RETURNING *`,
            [first.group_id, first.product_id, quantity, closesAt],
          )
        ).rows[0];
        for (const r of requests) {
          await tx.query(
            "INSERT INTO public.auction_requests(auction_id, request_id) VALUES($1,$2)",
            [auction.id, r.id],
          );
          await tx.query(
            "UPDATE public.requests SET status='batched' WHERE id=$1",
            [r.id],
          );
        }
        return auction;
      });
    },

    async bid(u, id, { totalCents }) {
      requireRole(u, "supplier");
      return db.transaction(async (tx) => {
        const supplier = await currentSupplier(tx, u.id);
        const auction = await one(
          tx,
          "SELECT * FROM public.auctions WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (auction.status !== "open" || clock() >= new Date(auction.closes_at))
          throw new Fault(409, "Bidding is closed");
        const unitPrice = totalCents / 100 / Number(auction.quantity);
        return (
          await tx.query(
            `INSERT INTO public.bids(auction_id, supplier_id, unit_price)
             VALUES($1, $2, $3)
             RETURNING id, ROUND(($3::numeric * $4::numeric) * 100)::integer AS total_cents, created_at`,
            [id, supplier.id, unitPrice, auction.quantity],
          )
        ).rows[0];
      });
    },

    async award() {
      throw new Fault(501, "Awarding public-schema auctions is not wired yet");
    },

    async orders(u) {
      const result = await db.query(
        `SELECT
          bo.id,
          bo.auction_id,
          bo.status,
          bo.created_at,
          COALESCE(MAX(ss.location), '') AS area,
          COALESCE(MAX(p.product_name), 'Bulk order') AS name,
          COALESCE(MAX(p.unit), 'pack') AS pack,
          ROUND(MAX(bo.subtotal) * 100)::integer AS total_cents
         FROM public.bulk_orders bo
         LEFT JOIN public.bulk_order_items i ON i.bulk_order_id = bo.id
         LEFT JOIN public.products p ON p.id = i.product_id
         LEFT JOIN public.purchasing_groups g ON g.id = bo.group_id
         LEFT JOIN public.group_members gm ON gm.group_id = g.id
         LEFT JOIN public.spaza_shops ss ON ss.id = gm.shop_id
         LEFT JOIN public.suppliers su ON su.id = bo.supplier_id
         WHERE ($1='admin' OR ss.owner_id=$2 OR su.owner_id=$2)
         GROUP BY bo.id
         ORDER BY bo.created_at DESC`,
        [u.role, u.id],
      );
      return result.rows.map((o) => ({ ...o, allocations: [] }));
    },

    async dispatch() {
      throw new Fault(501, "Dispatch is not wired to the public schema yet");
    },

    async receive() {
      throw new Fault(501, "Receipt is not wired to the public schema yet");
    },
  };
}
