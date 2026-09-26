import React from "react";
import { dateTimeNoSeconds } from "../utils/formatters.js";
import { groupCode } from "./StockRequestGroups.jsx";

// Admin: every submitted shop order, one row each.
// Tick orders (same product) and assign them to a group below.
export default function SubmittedOrders({
  requests,
  selected,
  setSelected,
  busy,
}) {
  const orders = requests.filter((request) => request.status === "submitted");
  const chosen = orders.filter((order) => selected.includes(order.id));
  const productId = chosen[0]?.product_id;

  const toggle = (order, checked) =>
    setSelected(
      checked
        ? [...selected, order.id]
        : selected.filter((id) => id !== order.id),
    );

  return (
    <section className="submitted-orders">
      <div className="section-title split-heading">
        <h2>Submitted orders</h2>
        <span>{orders.length} waiting</span>
      </div>
      <p>
        Tick the orders you want to put in one group. Orders in the same group
        must be for the same product.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Shop</th>
              <th>Product</th>
              <th>Packs</th>
              <th>Area</th>
              <th>Suggested group</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const checked = selected.includes(order.id);
              const otherProduct =
                Boolean(productId) && order.product_id !== productId;
              return (
                <tr
                  key={order.id}
                  className={checked ? "order-row chosen" : "order-row"}
                >
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select order from ${order.shop_name || "shop"}`}
                      title={
                        otherProduct
                          ? "Pick orders for the same product"
                          : undefined
                      }
                      disabled={busy || (otherProduct && !checked)}
                      checked={checked}
                      onChange={(event) => toggle(order, event.target.checked)}
                    />
                  </td>
                  <td>
                    {order.shop_name || "Shop"}
                    {order.created_at && (
                      <small>{dateTimeNoSeconds(order.created_at)}</small>
                    )}
                  </td>
                  <td>
                    {order.name}
                    <small>{order.pack}</small>
                  </td>
                  <td>{order.quantity}</td>
                  <td>{order.area || "No area"}</td>
                  <td>
                    <span className="group-chip">
                      {groupCode(
                        `open:${order.product_id}:${(order.area || "").toLowerCase()}`,
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!orders.length && (
          <p className="empty">
            No submitted orders right now. New shop orders will appear here.
          </p>
        )}
      </div>
    </section>
  );
}
