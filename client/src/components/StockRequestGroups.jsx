import React, { useState } from "react";

// Admin "Stock requests" section.
// Shows ONLY groups that can be put on auction right now.
// A group = open requests for the same product in the same area.
// Once the admin ticks a group and opens the auction, its requests move to
// the Auctions tab and the group disappears from this list.

const groupCode = (key) => {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return "BG-" + hash.toString(16).toUpperCase().padStart(8, "0").slice(-6);
};

export function groupRequests(requests = []) {
  const groups = new Map();
  for (const r of requests) {
    // Only requests that are ready and not yet on an auction.
    if (r.status !== "submitted") continue;
    const area = r.area || "";
    // Two requests only belong on the same auction when they share the
    // same real buying group behind the scenes, not just the same product
    // and area name. An area's buying group closes once it completes an
    // order and a fresh one opens for anything requested after that, so
    // two requests that look alike here can still be in different groups.
    // Grouping by r.group_id, the same field the server checks before
    // opening an auction, keeps what you see here always auctionable.
    const key = r.group_id
      ? `group:${r.group_id}:${r.product_id}`
      : `open:${r.product_id}:${area.toLowerCase()}`;
    if (!groups.has(key))
      groups.set(key, {
        key,
        code: groupCode(key),
        product: r.name,
        pack: r.pack,
        area,
        totalQuantity: 0,
        shops: new Map(),
        ids: [],
      });
    const g = groups.get(key);
    g.totalQuantity += Number(r.quantity) || 0;
    // Each shop in the group, with its name and how much it asked for.
    const shopKey = r.shop_id || r.id;
    if (!g.shops.has(shopKey))
      g.shops.set(shopKey, { name: r.shop_name || "Shop", quantity: 0 });
    g.shops.get(shopKey).quantity += Number(r.quantity) || 0;
    g.ids.push(r.id);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    shopCount: g.shops.size,
    shopList: [...g.shops.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }));
}

export default function StockRequestGroups({
  requests,
  selected,
  setSelected,
  busy,
}) {
  const [openKey, setOpenKey] = useState(null);
  const groups = groupRequests(requests);

  const isChecked = (g) => g.ids.every((id) => selected.includes(id));

  const toggle = (g, checked) => {
    setSelected(
      checked
        ? [...new Set([...selected, ...g.ids])]
        : selected.filter((id) => !g.ids.includes(id)),
    );
    // Take the admin straight down to the bidding time form.
    if (checked)
      setTimeout(
        () =>
          document
            .querySelector(".auction-form")
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        50,
      );
  };

  return (
    <>
      <h2>Groups ready for auction</h2>
      <p>
        Click a group to see its details. Tick a group, then set the bidding
        time below to put it on auction.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Group</th>
              <th>Product</th>
              <th>Total quantity</th>
              <th>Shops</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const open = openKey === g.key;
              return (
                <React.Fragment key={g.key}>
                  <tr
                    style={{ cursor: "pointer" }}
                    onClick={() => setOpenKey(open ? null : g.key)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select group ${g.code}`}
                        disabled={busy}
                        checked={isChecked(g)}
                        onChange={(e) => toggle(g, e.target.checked)}
                      />
                    </td>
                    <td>
                      <strong>{g.code}</strong>
                      <small>{g.area || "No area"}</small>
                    </td>
                    <td>
                      {g.product}
                      <small>{g.pack}</small>
                    </td>
                    <td>{g.totalQuantity}</td>
                    <td>{g.shopCount}</td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={5} style={{ background: "#f7faf3" }}>
                        <strong>Group {g.code}</strong>
                        <small>
                          {g.product} ({g.pack}) in {g.area || "No area"}
                        </small>
                        <small>
                          {g.totalQuantity} packs from {g.shopCount}{" "}
                          {g.shopCount === 1 ? "shop" : "shops"} (
                          {g.ids.length}{" "}
                          {g.ids.length === 1 ? "request" : "requests"})
                        </small>
                        <table style={{ marginTop: 10 }}>
                          <thead>
                            <tr>
                              <th>Shop</th>
                              <th>Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.shopList.map((shop, i) => (
                              <tr key={i}>
                                <td>{shop.name}</td>
                                <td>
                                  {shop.quantity}
                                  <small>{g.pack}</small>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {!groups.length && (
          <p className="empty">
            No groups are ready for auction right now. Groups on auction are
            under the Auctions tab.
          </p>
        )}
      </div>
    </>
  );
}
