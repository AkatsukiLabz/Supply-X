// Buying groups for the admin dashboard.
//
// A buying group is a set of shop requests for the SAME product in the SAME
// service area. Example: Shop A wants 20 maize meal, Shop B wants 15 and
// Shop C wants 28, all in Centurion. Together they form one group of 63.
//
// Requests that are not yet in an auction are grouped by product and area.
// Once the admin opens an auction, the requests in that auction form their
// own group, so a later batch of the same product starts a new group.

import { requireRole } from "./service.js";

export const GROUP_STATUSES = [
  "Awaiting Contributions",
  "Ready for Bidding",
  "Bid Selected",
  "Completed",
];

// Short, stable group code such as BG-4F2A91, built from the group key.
const groupCode = (key) => {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return "BG-" + hash.toString(16).toUpperCase().padStart(8, "0").slice(-6);
};

const groupStatus = (group) => {
  if (group.auctionId) {
    if (group.orderStatus === "completed") return "Completed";
    if (group.auctionStatus === "awarded" || group.orderStatus)
      return "Bid Selected";
    return "Ready for Bidding";
  }
  return group.awaiting ? "Awaiting Contributions" : "Ready for Bidding";
};

export async function buyingGroups(db, u) {
  requireRole(u, "admin");
  const { rows } = await db.query(
    `SELECT
      r.id,
      r.product_id,
      r.quantity,
      r.status,
      r.created_at,
      p.product_name,
      p.unit,
      s.id AS shop_id,
      s.shop_name,
      COALESCE(s.location, '') AS area,
      ar.auction_id,
      a.status AS auction_status,
      bo.status AS order_status,
      ROUND(
        COALESCE(
          c.total,
          CASE WHEN r.status = 'pending_commitment' THEN 0 ELSE r.committed_amount END
        ) * 100
      )::integer AS contribution_cents
     FROM public.requests r
     JOIN public.products p ON p.id = r.product_id
     JOIN public.group_members gm ON gm.id = r.group_member_id
     JOIN public.spaza_shops s ON s.id = gm.shop_id
     LEFT JOIN public.auction_requests ar ON ar.request_id = r.id
     LEFT JOIN public.auctions a ON a.id = ar.auction_id
     LEFT JOIN LATERAL (
       SELECT o.status
       FROM public.bulk_orders o
       WHERE o.auction_id = a.id
       ORDER BY o.created_at DESC
       LIMIT 1
     ) bo ON true
     LEFT JOIN (
       SELECT request_id, SUM(amount) AS total
       FROM public.contributions
       GROUP BY request_id
     ) c ON c.request_id = r.id
     WHERE r.status <> 'cancelled'
     ORDER BY r.created_at`,
  );

  const groups = new Map();
  for (const r of rows) {
    const key = r.auction_id
      ? `auction:${r.auction_id}`
      : `open:${r.product_id}:${r.area.toLowerCase()}`;
    if (!groups.has(key))
      groups.set(key, {
        key,
        code: groupCode(key),
        product: r.product_name,
        pack: r.unit,
        area: r.area,
        auctionId: r.auction_id || null,
        auctionStatus: r.auction_status || null,
        orderStatus: r.order_status || null,
        awaiting: false,
        createdAt: r.created_at,
        shops: new Map(),
      });
    const g = groups.get(key);
    if (r.status === "pending_commitment") g.awaiting = true;
    if (!g.shops.has(r.shop_id))
      g.shops.set(r.shop_id, {
        shopId: r.shop_id,
        shopName: r.shop_name,
        quantity: 0,
        contributionCents: 0,
      });
    const shop = g.shops.get(r.shop_id);
    shop.quantity += Number(r.quantity);
    shop.contributionCents += Number(r.contribution_cents);
  }

  return [...groups.values()]
    .map((g) => {
      const shops = [...g.shops.values()].sort((a, b) =>
        a.shopName.localeCompare(b.shopName),
      );
      return {
        key: g.key,
        code: g.code,
        name: `${g.product} · ${g.area || "No area"}`,
        product: g.product,
        pack: g.pack,
        area: g.area,
        status: groupStatus(g),
        shopCount: shops.length,
        totalQuantity: shops.reduce((sum, s) => sum + s.quantity, 0),
        contributionCents: shops.reduce(
          (sum, s) => sum + s.contributionCents,
          0,
        ),
        createdAt: g.createdAt,
        shops,
      };
    })
    .sort(
      (a, b) =>
        GROUP_STATUSES.indexOf(a.status) - GROUP_STATUSES.indexOf(b.status) ||
        new Date(b.createdAt) - new Date(a.createdAt),
    );
}