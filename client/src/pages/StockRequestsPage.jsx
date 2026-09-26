import React from "react";
import StockRequestGroups from "../components/StockRequestGroups.jsx";
import { money } from "../utils/formatters.js";
import { isShop } from "../utils/navigation.js";

export default function StockRequestsPage({
  user,
  data,
  selected,
  setSelected,
  busy,
  act,
  api,
}) {
  return (
    <>
      <div className="section-title">
        <h2>Stock for your next chapter</h2>
        <span>{data.products.length} products</span>
      </div>

      {isShop(user?.role) && (
        <div className="products">
          {data.products.map((product) => (
            <article key={product.id}>
              <div className="product-icon">▧</div>
              <h3>{product.name}</h3>
              <p>{product.pack}</p>
              <small>
                Sample reference: {money(product.reference_cents)} / pack
              </small>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const quantity = Number(
                    new FormData(event.currentTarget).get("quantity"),
                  );
                  act(
                    () =>
                      api("/requests", {
                        productId: product.id,
                        quantity,
                      }),
                    "Stock request submitted. A coordinator can now group it with nearby demand.",
                  );
                }}
              >
                <label>
                  Packs
                  <input
                    name="quantity"
                    aria-label={`Packs of ${product.name}`}
                    type="number"
                    min="1"
                    max="10000"
                    defaultValue="5"
                    required
                  />
                </label>
                <button disabled={busy}>Request stock</button>
              </form>
            </article>
          ))}
        </div>
      )}

      {user?.role === "admin" ? (
        <StockRequestGroups
          requests={data.requests}
          selected={selected}
          setSelected={setSelected}
          busy={busy}
        />
      ) : (
        <>
          <h2>Submitted requests</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Packs</th>
                  <th>Area</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      {request.name}
                      <small>{request.pack}</small>
                    </td>
                    <td>{request.quantity}</td>
                    <td>{request.area}</td>
                    <td>
                      <span className="pill">{request.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.requests.length && (
              <p className="empty">
                No requests yet. Shop accounts can submit stock above.
              </p>
            )}
          </div>
        </>
      )}

      {user?.role === "admin" && (
        <form
          className="auction-form"
          onSubmit={(event) => {
            event.preventDefault();
            const minutes = Number(
              new FormData(event.currentTarget).get("minutes"),
            );
            act(
              () =>
                api("/auctions", {
                  requestIds: selected,
                  closesAt: new Date(Date.now() + minutes * 60000).toISOString(),
                }),
              "Auction opened. Switch to a supplier account to place a private bid.",
            );
          }}
        >
          <p>Select requests for the same product and area.</p>
          <label>
            Bidding window (minutes)
            <input
              name="minutes"
              type="number"
              min="1"
              max="10080"
              defaultValue="5"
              required
            />
          </label>
          <button disabled={busy || !selected.length}>
            Open auction · {selected.length} selected
          </button>
        </form>
      )}
    </>
  );
}
