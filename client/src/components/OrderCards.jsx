import React from "react";
import { money } from "../utils/formatters.js";
import { isShop } from "../utils/navigation.js";

export default function OrderCards({ orders, user, busy, act, api }) {
  return (
    <div className="cards">
      {orders.map((order) => (
        <article key={order.id}>
          <div className="card-top">
            <span className="pill">{order.status}</span>
            <span>{order.area}</span>
          </div>
          <h2>{order.name}</h2>

          {order.total_cents !== undefined && (
            <p>
              Total delivered price <strong>{money(order.total_cents)}</strong>
            </p>
          )}

          {user?.role === "supplier" &&
            order.supplier_payout_cents !== undefined && (
              <p className="muted">
                Supplier payout after SupplyX fee:{" "}
                <strong>{money(order.supplier_payout_cents)}</strong>
              </p>
            )}

          {user?.role === "admin" && order.supplier_fee_cents !== undefined && (
            <p className="muted">
              SupplyX supplier fee:{" "}
              <strong>{money(order.supplier_fee_cents)}</strong>
            </p>
          )}

          {order.allocations.map((allocation) => (
            <div className="allocation" key={allocation.request_id}>
              <strong>{allocation.shop_name}</strong>
              <p>
                {allocation.quantity} × {order.pack} ·{" "}
                {money(allocation.charge_cents)}
              </p>
              {user?.role !== "supplier" &&
                allocation.savings_cents !== undefined && (
                  <small className="allocation-note">
                    Shop saving: {money(allocation.savings_cents)}
                  </small>
                )}

              {allocation.received_at ? (
                <span className="pill">Received</span>
              ) : isShop(user?.role) &&
                ["dispatched", "accepted"].includes(order.status) ? (
                <button
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => api(`/allocations/${allocation.request_id}/receive`, {}),
                      "Receipt confirmed for your shop.",
                    )
                  }
                >
                  Confirm receipt
                </button>
              ) : (
                <small className="allocation-note">
                  {order.status === "submitted"
                    ? user?.role === "supplier"
                      ? "You won this order. Prepare it for fulfilment."
                      : "Order awarded. Supplier is preparing fulfilment."
                    : order.status === "accepted"
                      ? user?.role === "supplier"
                        ? "Dispatched. Waiting for shop receipt."
                        : "Supplier dispatched. Awaiting receipt."
                      : order.status === "dispatched"
                        ? "Awaiting shop receipt."
                        : order.status === "completed"
                          ? "Order completed."
                          : "Order in progress."}
                </small>
              )}
            </div>
          ))}

          {user?.role === "supplier" && order.status === "submitted" && (
            <button
              disabled={busy}
              onClick={() =>
                act(
                  () => api(`/orders/${order.id}/dispatch`, {}),
                  "Dispatch recorded. Shops can confirm receipt.",
                )
              }
            >
              Mark dispatched
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
