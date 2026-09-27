import React from "react";
import { isShop } from "../utils/navigation.js";

const money = (c) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    c / 100,
  );

// Same wording as the Stock requests page and the Overview page, so a
// request is never labelled one thing there and something else here.
const statusLabel = (status) => {
  if (status === "submitted") return "Awaiting auction";
  if (status === "batched") return "Grouped";
  if (status === "ordered") return "Ordered";
  if (status === "received") return "Received";
  return status;
};

// Once a request has been grouped and a supplier has won it, SupplyX opens
// a real order for it. This is the delivery stage of that real order.
const deliveryLabel = {
  submitted: "Awaiting dispatch",
  accepted: "On the way",
  completed: "Delivered",
};

export default function OrdersPage({ user, data, busy, act, api }) {
  const requests = data.requests || [];
  const orders = data.orders || [];

  const confirmReceipt = (requestId) =>
    act(
      () => api(`/allocations/${requestId}/receive`, {}),
      "Delivery confirmed. Thank you.",
    );

  if (isShop(user.role)) {
    // Match each of this shop's requests to the real order it landed in,
    // once one exists, so we can show the actual price and delivery stage.
    const orderByRequest = {};
    for (const order of orders) {
      for (const a of order.allocations || []) {
        orderByRequest[a.request_id] = { order, allocation: a };
      }
    }

    return (
      <>
        <h2>Orders</h2>
        <div className="cards">
          {requests.map((r) => {
            const match = orderByRequest[r.id];
            return (
              <article key={r.id}>
                <div className="card-top">
                  <span className="pill">{statusLabel(r.status)}</span>
                  <span>{r.area}</span>
                </div>
                <h2>{r.name}</h2>
                <p className="muted">
                  {r.quantity} {r.pack}
                </p>

                {match ? (
                  <>
                    <p>
                      Total{" "}
                      <strong>{money(match.allocation.charge_cents)}</strong>
                      {match.allocation.savings_cents > 0
                        ? ` · Saved ${money(match.allocation.savings_cents)}`
                        : ""}
                    </p>
                    <p className="muted">
                      {deliveryLabel[match.order.status] || match.order.status}
                    </p>
                    {match.order.status !== "submitted" &&
                      !match.allocation.received_at && (
                        <div className="bid-actions">
                          <button
                            disabled={busy}
                            onClick={() => confirmReceipt(r.id)}
                          >
                            Confirm receipt
                          </button>
                        </div>
                      )}
                  </>
                ) : (
                  <p>
                    Estimated <strong>{money(r.committed_cents)}</strong>
                  </p>
                )}
              </article>
            );
          })}
          {!requests.length && <p className="empty">No orders yet.</p>}
        </div>
      </>
    );
  }

  // Admin sees the real orders across every shop, the way SupplyX ships them.
  const rows = orders.map((order) => ({ order, lines: order.allocations || [] }));

  return (
    <>
      <h2>Orders</h2>
      <div className="cards">
        {rows.map(({ order, lines }) => {
          const chargeCents = lines.reduce((s, a) => s + (a.charge_cents || 0), 0);
          const savingsCents = lines.reduce((s, a) => s + (a.savings_cents || 0), 0);
          return (
            <article key={order.id}>
              <div className="card-top">
                <span className="pill">
                  {deliveryLabel[order.status] || order.status}
                </span>
                <span>{order.area}</span>
              </div>
              <h2>{order.name}</h2>
              {lines.map((a) => (
                <p className="muted" key={a.request_id}>
                  {a.quantity} {order.pack} · {a.shop_name}
                  {a.received_at ? " · received" : ""}
                </p>
              ))}
              <p>
                Total <strong>{money(chargeCents)}</strong>
                {savingsCents > 0 ? ` · Saved ${money(savingsCents)}` : ""}
              </p>
            </article>
          );
        })}
        {!rows.length && <p className="empty">No orders yet.</p>}
      </div>
    </>
  );
}
