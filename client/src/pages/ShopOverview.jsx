import React from "react";

const money = (c) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    c / 100,
  );

// Same wording as the Stock requests page, so a request never shows one
// label there and a different one here.
const statusLabel = (status) => {
  if (status === "submitted") return "Awaiting auction";
  if (status === "batched") return "Grouped";
  if (status === "ordered") return "Ordered";
  if (status === "received") return "Received";
  return status;
};

export default function ShopOverview({ user, data, onGoTo }) {
  // Every stock request this shop has made is its own order, from the
  // moment it is submitted through to delivery. This is the same list
  // shown on the Stock requests page, so the numbers here always match it.
  const requests = data.requests || [];
  const awaitingAuction = requests.filter((r) => r.status === "submitted");
  const grouped = requests.filter((r) => r.status === "batched");
  const recent = requests.slice(0, 3);

  return (
    <>
      <section className="stats">
        <article>
          <span>Awaiting auction</span>
          <strong>{String(awaitingAuction.length).padStart(2, "0")}</strong>
        </article>
        <article>
          <span>Grouped</span>
          <strong>{String(grouped.length).padStart(2, "0")}</strong>
        </article>
        <article>
          <span>All orders</span>
          <strong>{String(requests.length).padStart(2, "0")}</strong>
        </article>
      </section>

      {requests.length === 0 && (
        <section className="hero">
          <div>
            <span className="tag">BUY TOGETHER, GROW TOGETHER</span>
            <h2>
              Your next stock run.
              <br />A stronger deal.
            </h2>
            <p>Request stock from the Stock requests tab to get started.</p>
            <button onClick={() => onGoTo && onGoTo("Stock requests")}>
              Request stock <span>↗</span>
            </button>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="circle c1"></div>
            <div className="circle c2"></div>
            <div className="box">SX</div>
            <small>
              LOCAL BUSINESSES
              <br />
              BIGGER POSSIBILITIES
            </small>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <>
          <div className="section-title split-heading">
            <h2>Recent orders</h2>
            <span>
              {recent.length} of {requests.length}
            </span>
          </div>
          <div className="cards">
            {recent.map((r) => (
              <article key={r.id}>
                <div className="card-top">
                  <span className="pill">{statusLabel(r.status)}</span>
                  <span>{r.area}</span>
                </div>
                <h2>{r.name}</h2>
                <p className="muted">
                  {r.quantity} {r.pack} · {money(r.committed_cents)}
                </p>
                <button onClick={() => onGoTo && onGoTo("Orders")}>
                  View order
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {requests.length > 0 &&
        awaitingAuction.length === 0 &&
        grouped.length === 0 && (
          <section className="hero">
            <div>
              <span className="tag">ALL CAUGHT UP</span>
              <h2>
                Your orders are
                <br />
                moving along.
              </h2>
              <p>Keep an eye on the Orders tab for delivery updates.</p>
              <button onClick={() => onGoTo && onGoTo("Stock requests")}>
                Request more stock <span>↗</span>
              </button>
            </div>
          </section>
        )}
    </>
  );
}
