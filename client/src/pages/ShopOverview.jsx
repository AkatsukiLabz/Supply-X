import React from "react";

export default function ShopOverview({ data, setTab }) {
  const open = data.auctions.filter((auction) => auction.status === "open").length;

  return (
    <>
      <section className="hero">
        <div>
          <span className="tag">BUY TOGETHER, GROW TOGETHER</span>
          <h2>
            Your next stock run.
            <br />A stronger deal.
          </h2>
          <p>
            Pool demand with nearby shops. Let suppliers compete.
            <br />
            Keep your business independent.
          </p>
          <button onClick={() => setTab("Stock requests")}>
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

      <section className="stats">
        {[
          [data.requests.length, "Your stock requests"],
          [open, "Open auctions"],
          [data.orders.length, "Your orders"],
        ].map(([value, label]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{String(value).padStart(2, "0")}</strong>
          </article>
        ))}
      </section>
    </>
  );
}
