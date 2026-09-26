import React from "react";
import OrderCards from "../components/OrderCards.jsx";

export default function OrdersPage({ user, orders, busy, act, api }) {
  return (
    <>
      <h2>Orders</h2>
      <OrderCards orders={orders} user={user} busy={busy} act={act} api={api} />
      {!orders.length && (
        <p className="empty">Awarded auctions will appear here as orders.</p>
      )}
    </>
  );
}
