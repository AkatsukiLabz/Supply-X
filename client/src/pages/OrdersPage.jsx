import React, { useEffect, useState } from "react";
import { loadShop, saveShop, uid } from "../shopStore.js";
import PayModal from "./PayModal.jsx";

const money = (c) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    c / 100,
  );

const lineTotal = (l) => l.unitPriceCents * l.qty;

export default function OrdersPage({ user }) {
  const [shop, setShop] = useState(() => loadShop(user.id));
  const [payOrder, setPayOrder] = useState(null);

  useEffect(() => saveShop(user.id, shop), [user.id, shop]);

  const markPaid = (orderId) => {
    setShop((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, status: "paid", paidAt: Date.now() } : o,
      ),
      txns: [
        {
          id: uid(),
          orderId,
          amountCents: s.orders.find((o) => o.id === orderId)?.totalCents ?? 0,
          note: `Payment for order ${orderId}`,
          createdAt: Date.now(),
        },
        ...s.txns,
      ],
    }));
    setPayOrder(null);
    setTimeout(() => {
      setShop((s) => ({
        ...s,
        orders: s.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: "approved", approvedAt: Date.now() }
            : o,
        ),
      }));
    }, 1200);
  };

  const cancelOrder = (orderId) =>
    setShop((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, status: "cancelled" } : o,
      ),
    }));

  const confirmReceipt = (orderId) =>
    setShop((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, status: "fulfilled" } : o,
      ),
    }));

  return (
    <>
      <h2>Orders</h2>
      <div className="cards">
        {shop.orders.map((o) => (
          <article key={o.id}>
            <div className="card-top">
              <span className="pill">{o.status.replace("_", " ")}</span>
              <span>{o.area}</span>
            </div>
            <h2>Order {o.id}</h2>
            {o.lines.map((l) => (
              <p className="muted" key={l.id}>
                {l.qty} × {l.name}
                {l.variantLabel ? ` · ${l.variantLabel}` : ""} ·{" "}
                {money(lineTotal(l))}
              </p>
            ))}
            <p>
              Total delivered price <strong>{money(o.totalCents)}</strong>
            </p>
            <div className="bid-actions">
              {o.status === "pending_payment" && (
                <button onClick={() => setPayOrder(o)}>Confirm payment</button>
              )}
              {o.status === "approved" && (
                <button onClick={() => confirmReceipt(o.id)}>
                  Confirm receipt
                </button>
              )}
              {(o.status === "pending_payment" || o.status === "paid") && (
                <button className="secondary" onClick={() => cancelOrder(o.id)}>
                  Cancel order
                </button>
              )}
            </div>
          </article>
        ))}
        {!shop.orders.length && <p className="empty">No orders yet.</p>}
      </div>

      {payOrder && (
        <PayModal
          order={payOrder}
          onCancel={() => setPayOrder(null)}
          onPaid={markPaid}
        />
      )}
    </>
  );
}