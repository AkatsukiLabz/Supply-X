import React, { useEffect, useState } from "react";
import { loadShop, saveShop } from "../shopStore.js";

const money = (c) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    c / 100,
  );

const lineTotal = (l) => l.unitPriceCents * l.qty;

export default function ShopOverview({ user, onGoTo }) {
  const [shop, setShop] = useState(() => loadShop(user.id));

  useEffect(() => saveShop(user.id, shop), [user.id, shop]);

  const pending = shop.orders.filter((o) => o.status === "pending_payment");
  const approved = shop.orders.filter(
    (o) => o.status === "approved" || o.status === "paid",
  );
  const all = shop.orders;
  const recent = all.slice(0, 3);

  return (
    <>
      <section className="stats">
        <article>
          <span>Pending payment</span>
          <strong>{String(pending.length).padStart(2, "0")}</strong>
        </article>
        <article>
          <span>Approved orders</span>
          <strong>{String(approved.length).padStart(2, "0")}</strong>
        </article>
        <article>
          <span>All orders</span>
          <strong>{String(all.length).padStart(2, "0")}</strong>
        </article>
      </section>

      {all.length === 0 && (
        <section className="hero">
          <div>
            <span className="tag">BUY TOGETHER, GROW TOGETHER</span>
            <h2>
              Your next stock run.
              <br />A stronger deal.
            </h2>
            <p>
              Request stock from the Stock requests tab to get started.
            </p>
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

      {pending.length > 0 && (
        <>
          <div className="section-title split-heading">
            <h2>Awaiting payment</h2>
            <span>{pending.length} orders</span>
          </div>
          <div className="cards">
            {pending.map((o) => (
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
                  Total <strong>{money(o.totalCents)}</strong>
                </p>
                <button onClick={() => onGoTo && onGoTo("Orders")}>
                  Go to Orders
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <div className="section-title split-heading">
            <h2>Recent orders</h2>
            <span>{recent.length} of {all.length}</span>
          </div>
          <div className="cards">
            {recent.map((o) => (
              <article key={o.id}>
                <div className="card-top">
                  <span className="pill">{o.status.replace("_", " ")}</span>
                  <span>{o.area}</span>
                </div>
                <h2>Order {o.id}</h2>
                <p className="muted">
                  {o.lines.length} line{o.lines.length === 1 ? "" : "s"} ·{" "}
                  {money(o.totalCents)}
                </p>
                <button onClick={() => onGoTo && onGoTo("Orders")}>
                  View order
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {all.length > 0 && pending.length === 0 && (
        <section className="hero">
          <div>
            <span className="tag">ALL CAUGHT UP</span>
            <h2>
              Your orders are
              <br />
              moving along.
            </h2>
            <p>
              Keep an eye on the Orders tab for dispatch and delivery updates.
            </p>
            <button onClick={() => onGoTo && onGoTo("Stock requests")}>
              Request more stock <span>↗</span>
            </button>
          </div>
        </section>
      )}
    </>
  );
}