import React, { useState } from "react";
import StockRequestGroups from "../components/StockRequestGroups.jsx";
import { isShop } from "../utils/navigation.js";

const money = (c) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    c / 100,
  );

const statusLabel = (status) => {
  if (status === "submitted") return "Awaiting auction";
  if (status === "pending_commitment") return "Pending";
  if (status === "funded") return "Submitted";
  if (status === "batched") return "Grouped";
  if (status === "ordered") return "Ordered";
  if (status === "fulfilled") return "Received";
  return status;
};

export default function StockRequestsPage({
  user,
  data,
  selected,
  setSelected,
  busy,
  act,
  api,
}) {
  if (isShop(user.role)) {
    return <ShopRequestForm user={user} data={data} busy={busy} api={api} act={act} />;
  }
  if (user.role === "admin") {
    return (
      <AdminRequestGrouping
        data={data}
        selected={selected}
        setSelected={setSelected}
        busy={busy}
        act={act}
        api={api}
      />
    );
  }
  return null;
}

function ShopRequestForm({ user, data, busy, api, act }) {
  const [search, setSearch] = useState("");
  const products = data.products || [];
  const myRequests = data.requests || [];

  const trimmed = search.trim().toLowerCase();
  const visibleProducts = trimmed
    ? products.filter((p) => p.name.toLowerCase().includes(trimmed))
    : products;

  const submitRequest = (product, quantity) => {
    const qty = Number(quantity);
    if (!qty || qty < 1 || qty > 10000) return;
    act(
      () => api("/requests", { productId: product.id, quantity: qty }),
      `${product.name} request submitted. Awaiting the coordinator to group it.`,
    );
  };

  return (
    <>
      <div className="section-title">
        <h2>Request stock</h2>
        <span>
          {trimmed
            ? `${visibleProducts.length} match${visibleProducts.length === 1 ? "" : "es"}`
            : `${products.length} products available`}
        </span>
      </div>

      <input
        type="search"
        className="search-box"
        placeholder="Search products… e.g. maize, oil, soap"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search products"
      />

      <div className="products">
        {visibleProducts.map((p) => (
          <RequestProductCard
            key={p.id}
            product={p}
            busy={busy}
            onSubmit={(qty) => submitRequest(p, qty)}
          />
        ))}
        {visibleProducts.length === 0 && (
          <p className="empty">No products match "{search}".</p>
        )}
      </div>

      <div className="section-title split-heading">
        <h2>Your requests</h2>
        <span>{myRequests.length} request{myRequests.length !== 1 ? "s" : ""}</span>
      </div>

      {myRequests.length === 0 ? (
        <p className="empty">No requests yet. Choose a product above to get started.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Committed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((req) => (
                <tr key={req.id}>
                  <td>
                    <strong>{req.name}</strong>
                    <small>{req.pack}</small>
                  </td>
                  <td>{req.quantity}</td>
                  <td>{money(req.committed_cents)}</td>
                  <td>
                    <span className="pill">{statusLabel(req.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RequestProductCard({ product, busy, onSubmit }) {
  const [quantity, setQuantity] = useState("");

  return (
    <article>
      <div className="product-icon">▧</div>
      <h3>{product.name}</h3>
      <p>{product.pack}</p>
      <small>Reference: {money(product.reference_cents)}</small>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(quantity);
          setQuantity("");
        }}
      >
        <label>
          Quantity
          <input
            type="number"
            min="1"
            max="10000"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 5"
            disabled={busy}
          />
        </label>
        <button type="submit" disabled={busy || !quantity}>
          Request
        </button>
      </form>
    </article>
  );
}

function AdminRequestGrouping({ data, selected, setSelected, busy, act, api }) {
  const [closesAt, setClosesAt] = useState("");
  const requests = data.requests || [];

  const openAuction = (e) => {
    e.preventDefault();
    if (!selected.length || !closesAt) return;
    const iso = new Date(closesAt).toISOString();
    act(
      () => api("/auctions", { requestIds: selected, closesAt: iso }),
      "Auction opened. Suppliers can now bid.",
    );
    setClosesAt("");
  };

  return (
    <>
      <StockRequestGroups
        requests={requests}
        selected={selected}
        setSelected={setSelected}
        busy={busy}
      />

      <form className="auction-form" onSubmit={openAuction}>
        <p>
          {selected.length
            ? `${selected.length} request${selected.length === 1 ? "" : "s"} selected. Set the bidding deadline and open the auction.`
            : "Tick a group above to select its requests, then set the bidding deadline."}
        </p>
        <label>
          Bidding closes at
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            disabled={busy || !selected.length}
          />
        </label>
        <button type="submit" disabled={busy || !selected.length || !closesAt}>
          Open auction
        </button>
      </form>
    </>
  );
}
