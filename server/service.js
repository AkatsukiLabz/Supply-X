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
  const area = shop.location || u.area || "SupplyX";
  const groupName = `${area} collective`;

  // Reuse this shop's existing membership in an open group for its area, if any.
  const existingMember = (
    await tx.query(
      `SELECT gm.*
       FROM public.group_members gm
       JOIN public.purchasing_groups g ON g.id = gm.group_id
       WHERE gm.shop_id=$1 AND gm.status='active' AND g.status='open' AND g.group_name=$2
       LIMIT 1`,
      [shop.id, groupName],
    )
  ).rows[0];
  if (existingMember) return existingMember;

  // Reuse an open group other shops in the same area already joined, so demand pools together.
  let group = (
    await tx.query(
      `SELECT * FROM public.purchasing_groups
       WHERE status='open' AND group_name=$1
       LIMIT 1
       FOR UPDATE`,
      [groupName],
    )
  ).rows[0];

  if (!group) {
    group = (
      await tx.query(
        `INSERT INTO public.purchasing_groups(group_name, created_by, target_amount, status)
         VALUES($1, $2, 1, 'open')
         RETURNING *`,
        [groupName, u.id],
      )
    ).rows[0];
  }

  return (
    await tx.query(
      `INSERT INTO public.group_members(group_id, shop_id, status)
       VALUES($1, $2, 'active')
       ON CONFLICT (group_id, shop_id) DO UPDATE SET status='active'
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
 
const VERIFY_FIELDS = {
  contact: "contact_verified",
  area: "area_verified",
  bank: "bank_confirmation_verified",
  trading: "trading_proof_verified",
};

export function service(
  db,
  clock = () => new Date(),
  supabaseConfig = {},
) {
  const { supabaseUrl, supabaseServiceRoleKey } = supabaseConfig;
  return {
    async requests(u) {
      const rows = await db.query(
        `SELECT
          r.id,
          r.product_id,
          r.quantity,
          r.market_unit_price,
          ROUND(r.committed_amount * 100)::integer AS committed_cents,
          COALESCE(s.location, '') AS area,
          r.status,
          r.created_at,
          p.product_name AS name,
          p.unit AS pack,
          s.id AS shop_id,
          s.shop_name,
          gm.group_id
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
      requireRole(u, "spaza_owner");
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
          COALESCE(MAX(s.location), MAX(su.location), '') AS area,
          COUNT(DISTINCT s.id)::integer AS shop_count,
          ROUND(COALESCE(SUM(DISTINCT r.committed_amount), 0) * 100)::integer AS retail_benchmark_cents
         FROM public.auctions a
         JOIN public.products p ON p.id = a.product_id
         LEFT JOIN public.purchasing_groups g ON g.id = a.group_id
         LEFT JOIN public.group_members gm ON gm.group_id = g.id
         LEFT JOIN public.spaza_shops s ON s.id = gm.shop_id
         LEFT JOIN public.suppliers su ON su.owner_id = $2
         LEFT JOIN public.auction_requests ar ON ar.auction_id = a.id
         LEFT JOIN public.requests r ON r.id = ar.request_id
         WHERE ($1='admin' OR ($1='supplier' AND COALESCE(s.location, su.location, '')=$3) OR s.owner_id=$2)
         GROUP BY a.id, p.product_name, p.unit
         ORDER BY a.created_at DESC`,
        [u.role, u.id, u.area],
      );
      const rows = result.rows;
      // One query for every auction's bids together, instead of one extra
      // trip to the database per auction. With many auctions on screen this
      // is what made the page after sign in feel slow to load.
      if (rows.length) {
        const bidRows = (
          await db.query(
            `SELECT b.id, b.auction_id, b.unit_price, b.created_at, s.owner_id
             FROM public.bids b
             JOIN public.suppliers s ON s.id = b.supplier_id
             WHERE b.auction_id = ANY($1)
             ORDER BY b.unit_price, b.created_at, b.id`,
            [rows.map((a) => a.id)],
          )
        ).rows;
        const now = clock();
        for (const a of rows) {
          const closed = now >= new Date(a.closes_at);
          a.bids = bidRows
            .filter(
              (b) =>
                b.auction_id === a.id &&
                (b.owner_id === u.id || (u.role === "admin" && closed)),
            )
            .map((b) => ({
              id: b.id,
              total_cents: Math.round(Number(b.unit_price) * Number(a.quantity) * 100),
              created_at: b.created_at,
            }));
        }
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
        if (requests.some((r) => r.group_id !== first.group_id))
          throw new Fault(400, "Choose requests from the same buying group");
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
        const benchmark = (
          await tx.query(
            `SELECT ROUND(SUM(r.committed_amount) * 100)::integer AS total_cents
             FROM public.auction_requests ar
             JOIN public.requests r ON r.id = ar.request_id
             WHERE ar.auction_id=$1`,
            [id],
          )
        ).rows[0];
        const benchmarkCents = Number(benchmark?.total_cents || 0);
        if (benchmarkCents > 0 && totalCents >= benchmarkCents)
          throw new Fault(
            400,
            `Bid must be below the retail benchmark total of R ${(benchmarkCents / 100).toFixed(2)}`,
          );
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
 
    async award(u, id) {
      requireRole(u, "admin");
      return db.transaction(async (tx) => {
        const auction = await one(
          tx,
          `SELECT * FROM public.auctions WHERE id=$1 FOR UPDATE`,
          [id],
        );
        if (auction.status !== "open")
          throw new Fault(409, "This auction has already been awarded");
        if (clock() < new Date(auction.closes_at))
          throw new Fault(409, "Wait for bidding to close before awarding");
 
        const winningBid = (
          await tx.query(
            `SELECT *
             FROM public.bids
             WHERE auction_id=$1
             ORDER BY unit_price ASC, created_at ASC, id ASC
             LIMIT 1
             FOR UPDATE`,
            [id],
          )
        ).rows[0];
        if (!winningBid) throw new Fault(409, "No supplier bids to award");
 
        const subtotal = Number(winningBid.unit_price) * Number(auction.quantity);
        const supplierFeeRate = 10;
        const supplierFeeAmount = subtotal * (supplierFeeRate / 100);
        const supplierPayout = subtotal - supplierFeeAmount;
 
        const order = (
          await tx.query(
            `INSERT INTO public.bulk_orders(
              group_id,
              supplier_id,
              auction_id,
              winning_bid_id,
              subtotal,
              supplier_fee_rate,
              supplier_fee_amount,
              supplier_payout,
              status
            )
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, 'submitted')
            RETURNING *`,
            [
              auction.group_id,
              winningBid.supplier_id,
              auction.id,
              winningBid.id,
              subtotal,
              supplierFeeRate,
              supplierFeeAmount,
              supplierPayout,
            ],
          )
        ).rows[0];
 
        await tx.query(
          `INSERT INTO public.bulk_order_items(
            bulk_order_id, product_id, quantity, unit_price, line_total
          )
          VALUES($1, $2, $3, $4, $5)`,
          [
            order.id,
            auction.product_id,
            auction.quantity,
            winningBid.unit_price,
            subtotal,
          ],
        );
 
        const requests = (
          await tx.query(
            `SELECT r.*
             FROM public.auction_requests ar
             JOIN public.requests r ON r.id = ar.request_id
             WHERE ar.auction_id=$1
             FOR UPDATE OF r`,
            [id],
          )
        ).rows;
 
        for (const request of requests) {
          const actualCost = Number(winningBid.unit_price) * Number(request.quantity);
          const savingsAmount = Math.max(
            Number(request.committed_amount) - actualCost,
            0,
          );
          await tx.query(
            `INSERT INTO public.allocations(
              bulk_order_id, request_id, quantity, actual_cost, savings_amount
            )
            VALUES($1, $2, $3, $4, $5)`,
            [
              order.id,
              request.id,
              request.quantity,
              actualCost,
              savingsAmount,
            ],
          );
          await tx.query(
            `UPDATE public.requests SET status='ordered' WHERE id=$1`,
            [request.id],
          );
        }
 
        await tx.query(
          `UPDATE public.auctions SET status='awarded' WHERE id=$1`,
          [id],
        );
        await tx.query(
          `UPDATE public.purchasing_groups SET status='ordered' WHERE id=$1`,
          [auction.group_id],
        );
 
        return {
          ...order,
          total_cents: Math.round(subtotal * 100),
          supplier_fee_cents: Math.round(supplierFeeAmount * 100),
          supplier_payout_cents: Math.round(supplierPayout * 100),
        };
      });
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
          ROUND(MAX(bo.subtotal) * 100)::integer AS total_cents,
          ROUND(MAX(bo.supplier_fee_amount) * 100)::integer AS supplier_fee_cents,
          ROUND(MAX(bo.supplier_payout) * 100)::integer AS supplier_payout_cents
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
      const orders = result.rows;
      // One query for every order's allocations together, instead of one
      // extra trip to the database per order. With many orders on screen
      // this is what made the page after sign in feel slow to load.
      if (orders.length) {
        const allocRows = (
          await db.query(
            `SELECT
              a.bulk_order_id,
              a.request_id,
              a.quantity,
              ss.shop_name,
              ROUND(a.actual_cost * 100)::integer AS charge_cents,
              ROUND(a.savings_amount * 100)::integer AS savings_cents,
              CASE WHEN r.status='fulfilled' THEN a.created_at ELSE NULL END AS received_at
             FROM public.allocations a
             JOIN public.requests r ON r.id = a.request_id
             JOIN public.group_members gm ON gm.id = r.group_member_id
             JOIN public.spaza_shops ss ON ss.id = gm.shop_id
             JOIN public.bulk_orders bo ON bo.id = a.bulk_order_id
             LEFT JOIN public.suppliers su ON su.id = bo.supplier_id
             WHERE a.bulk_order_id = ANY($1)
               AND ($2='admin' OR ss.owner_id=$3 OR su.owner_id=$3)
             ORDER BY ss.shop_name`,
            [orders.map((o) => o.id), u.role, u.id],
          )
        ).rows;
        for (const order of orders) {
          order.allocations = allocRows
            .filter((a) => a.bulk_order_id === order.id)
            .map(({ bulk_order_id, ...rest }) => rest);
        }
      }
      return orders;
    },
 
    async dispatch(u, id) {
      requireRole(u, "supplier");
      return db.transaction(async (tx) => {
        const supplier = await currentSupplier(tx, u.id);
        const order = await one(
          tx,
          `SELECT * FROM public.bulk_orders WHERE id=$1 FOR UPDATE`,
          [id],
        );
        if (order.supplier_id !== supplier.id)
          throw new Fault(403, "Only the winning supplier can dispatch this order");
        if (!['submitted', 'accepted'].includes(order.status))
          throw new Fault(409, "This order cannot be dispatched now");
        return (
          await tx.query(
            `UPDATE public.bulk_orders
             SET status='accepted'
             WHERE id=$1
             RETURNING *`,
            [id],
          )
        ).rows[0];
      });
    },
 
    async receive(u, requestId) {
      requireRole(u, "spaza_owner");
      return db.transaction(async (tx) => {
        const allocation = await one(
          tx,
          `SELECT a.*, bo.id AS order_id, bo.status AS order_status
           FROM public.allocations a
           JOIN public.bulk_orders bo ON bo.id = a.bulk_order_id
           JOIN public.requests r ON r.id = a.request_id
           JOIN public.group_members gm ON gm.id = r.group_member_id
           JOIN public.spaza_shops ss ON ss.id = gm.shop_id
           WHERE a.request_id=$1 AND ss.owner_id=$2
           FOR UPDATE OF r, bo`,
          [requestId, u.id],
        );
        if (!['accepted', 'completed'].includes(allocation.order_status))
          throw new Fault(409, "This order has not been dispatched yet");
 
        await tx.query(
          `UPDATE public.requests SET status='fulfilled' WHERE id=$1`,
          [requestId],
        );
 
        const remaining = (
          await tx.query(
            `SELECT COUNT(*)::integer AS count
             FROM public.allocations a
             JOIN public.requests r ON r.id = a.request_id
             WHERE a.bulk_order_id=$1 AND r.status <> 'fulfilled'`,
            [allocation.order_id],
          )
        ).rows[0].count;
 
        if (remaining === 0) {
          await tx.query(
            `UPDATE public.bulk_orders SET status='completed' WHERE id=$1`,
            [allocation.order_id],
          );
          await tx.query(
            `UPDATE public.purchasing_groups g
             SET status='completed'
             FROM public.bulk_orders bo
             WHERE bo.id=$1 AND g.id=bo.group_id`,
            [allocation.order_id],
          );
        }
 
        return { request_id: requestId, received_at: clock().toISOString() };
      });
    },

    async adminSuppliers(u) {
      requireRole(u, "admin");
      const rows = (
        await db.query(
          `SELECT
            id,
            business_name,
            contact_phone,
            location,
            bank_confirmation_path,
            trading_proof_path,
            contact_verified,
            area_verified,
            bank_confirmation_verified,
            trading_proof_verified,
            verified_at
           FROM public.suppliers
           ORDER BY business_name`,
        )
      ).rows;
      for (const supplier of rows) {
        // A path on file means the supplier really did upload a document.
        // Admin opens it through /admin/suppliers/:id/documents/:field
        // rather than a link here, so this list only needs to say whether
        // one exists.
        supplier.bank_confirmation_uploaded = Boolean(
          supplier.bank_confirmation_path,
        );
        supplier.trading_proof_uploaded = Boolean(supplier.trading_proof_path);
      }
      return rows;
    },

    // Streams a supplier's verification document straight from storage using
    // the service role key, so admin can open it without any client-side
    // Supabase credentials and without a separate signed-URL step that can
    // fail on its own. Any storage error is reported back with its real
    // reason instead of a generic "not available".
    async supplierDocument(u, supplierId, field) {
      requireRole(u, "admin");
      const column =
        field === "bank"
          ? "bank_confirmation_path"
          : field === "trading"
            ? "trading_proof_path"
            : null;
      if (!column) throw new Fault(400, "Unknown document");
      const supplier = await one(
        db,
        `SELECT ${column} AS path FROM public.suppliers WHERE id=$1`,
        [supplierId],
      );
      if (!supplier.path) throw new Fault(404, "No document has been uploaded");
      if (!supabaseUrl || !supabaseServiceRoleKey)
        throw new Fault(
          500,
          "The server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY, so it cannot fetch documents from storage",
        );
      const response = await fetch(
        `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/supplier-documents/${supplier.path}`,
        {
          headers: {
            apikey: supabaseServiceRoleKey,
            Authorization: `Bearer ${supabaseServiceRoleKey}`,
          },
        },
      );
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Fault(
          502,
          `Supabase Storage returned ${response.status} for this document. ${text}`.trim(),
        );
      }
      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") || "application/octet-stream",
      };
    },

    async ownDocumentsStatus(u) {
      requireRole(u, "supplier");
      const supplier = await currentSupplier(db, u.id);
      return {
        bankConfirmationUploaded: Boolean(supplier.bank_confirmation_path),
        tradingProofUploaded: Boolean(supplier.trading_proof_path),
      };
    },

    // Lets a signed-in supplier attach or replace their own verification
    // documents at any time, not only during signup. This is what makes an
    // existing account (created before this feature existed, or one whose
    // signup upload did not finish) able to catch up.
    async updateOwnDocuments(u, { bankConfirmationPath, tradingProofPath }) {
      requireRole(u, "supplier");
      const supplier = await currentSupplier(db, u.id);
      const next = {
        bankConfirmationPath: bankConfirmationPath || supplier.bank_confirmation_path,
        tradingProofPath: tradingProofPath || supplier.trading_proof_path,
      };
      const row = await one(
        db,
        `UPDATE public.suppliers
         SET bank_confirmation_path=$1,
             trading_proof_path=$2,
             bank_confirmation_verified = CASE WHEN $1 IS DISTINCT FROM bank_confirmation_path THEN false ELSE bank_confirmation_verified END,
             trading_proof_verified = CASE WHEN $2 IS DISTINCT FROM trading_proof_path THEN false ELSE trading_proof_verified END,
             verified_at = NULL
         WHERE owner_id=$3
         RETURNING id, bank_confirmation_path, trading_proof_path`,
        [next.bankConfirmationPath || null, next.tradingProofPath || null, u.id],
      );
      return {
        bankConfirmationUploaded: Boolean(row.bank_confirmation_path),
        tradingProofUploaded: Boolean(row.trading_proof_path),
      };
    },

    async verifySupplier(u, supplierId, field, verified) {
      requireRole(u, "admin");
      const column = VERIFY_FIELDS[field];
      if (!column) throw new Fault(400, "Unknown verification field");
      return db.transaction(async (tx) => {
        await one(
          tx,
          `UPDATE public.suppliers SET ${column}=$1 WHERE id=$2 RETURNING *`,
          [verified, supplierId],
        );
        const supplier = await one(
          tx,
          `SELECT * FROM public.suppliers WHERE id=$1`,
          [supplierId],
        );
        const allVerified =
          supplier.contact_verified &&
          supplier.area_verified &&
          supplier.bank_confirmation_verified &&
          supplier.trading_proof_verified;
        await tx.query(
          `UPDATE public.suppliers SET verified_at=$1 WHERE id=$2`,
          [allVerified ? clock().toISOString() : null, supplierId],
        );
        return { id: supplierId, field, verified, allVerified };
      });
    },
  };
}