import React, { useEffect, useState } from "react";
import { AREAS } from "./auth.js";
import {
  DELIVERY_FEE_CENTS,
  loadShop,
  saveShop,
  seedProducts,
  uid,
} from "./shopStore.js";

const money = (c) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    c / 100,
  );

const PRODUCTS = seedProducts(AREAS);

const lineTotal = (l) => l.unitPriceCents * l.qty;

export default function Shops({ user }) {
  const [shop, setShop] = useState(() => loadShop(user.id));
  const [area, setArea] = useState(AREAS[0]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => saveShop(user.id, shop), [user.id, shop]);

  const products = PRODUCTS.filter((p) => p.shipsFrom === area);
  const subtotal = shop.cart.reduce((s, l) => s + lineTotal(l), 0);
  const finalPrice =
    shop.cart.length > 0 ? subtotal + DELIVERY_FEE_CENTS : 0;
  const shortfall = finalPrice - shop.balanceCents;

  const addToCart = (product, variantId) => {
    const variant = product.variants.find((v) => v.id === variantId);
    const unitPriceCents = product.referenceCents + (variant?.deltaCents ?? 0);
    setShop((s) => {
      const existing = s.cart.find(
        (l) => l.productId === product.id && l.variantId === variantId,
      );
      const cart = existing
        ? s.cart.map((l) =>
            l === existing ? { ...l, qty: l.qty + 1 } : l,
          )
        : [
            ...s.cart,
            {
              id: uid(),
              productId: product.id,
              name: product.name,
              pack: product.pack,
              variantLabel: variant?.label,
              unitPriceCents,
              qty: 1,
              shipsFrom: product.shipsFrom,
            },
          ];
      return { ...s, cart };
    });
    setError("");
    setNotice(`${product.name} added to your order.`);
  };

  const updateQty = (lineId, qty) =>
    setShop((s) => ({
      ...s,
      cart:
        qty <= 0
          ? s.cart.filter((l) => l.id !== lineId)
          : s.cart.map((l) => (l.id === lineId ? { ...l, qty } : l)),
    }));

  const placeOrder = () => {
    setError("");
    setNotice("");
    if (!shop.cart.length) return setError("Your order is empty.");
    if (shortfall > 0)
      return setError(
        `Insufficient wallet balance — top up ${money(shortfall)} more.`,
      );
    const order = {
      id: uid(),
      area,
      lines: shop.cart,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
      totalCents: finalPrice,
      status: "pending",
      createdAt: Date.now(),
    };
    setShop((s) => ({
      ...s,
      cart: [],
      orders: [order, ...s.orders],
      balanceCents: s.balanceCents - order.totalCents,
      txns: [
        {
          id: uid(),
          type: "debit",
          amountCents: order.totalCents,
          note: `Order ${order.id} — ships from ${order.area}`,
          createdAt: Date.now(),
        },
        ...s.txns,
      ],
    }));
    setNotice("Order placed — wallet debited. It is now pending fulfilment.");
  };

  const cancelOrder = (orderId) =>
    setShop((s) => {
      const order = s.orders.find((o) => o.id === orderId);
      if (!order || order.status !== "pending") return s;
      return {
        ...s,
        orders: s.orders.map((o) =>
          o.id === orderId ? { ...o, status: "cancelled" } : o,
        ),
        balanceCents: s.balanceCents + order.totalCents,
        txns: [
          {
            id: uid(),
            type: "refund",
            amountCents: order.totalCents,
            note: `Refund — cancelled order ${orderId}`,
            createdAt: Date.now(),
          },
          ...s.txns,
        ],
      };
    });

  const confirmReceipt = (orderId) =>
    setShop((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, status: "fulfilled" } : o,
      ),
    }));

  const pending = shop.orders.filter((o) => o.status === "pending");

  return (
    <>
      <div className="section-title">
        <h2>Shop by area</h2>
        <span>
          {products.length} products shipping from {area}
        </span>
      </div>
      <div className="area-tabs">
        {AREAS.map((a) => (
          <button
            key={a}
            className={a === area ? "active" : ""}
            onClick={() => setArea(a)}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="products">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onAdd={addToCart} />
        ))}
        {!products.length && (
          <p className="empty">Nothing ships from {area} yet.</p>
        )}
      </div>

      <div className="order-panel">
        <div className="section-title">
          <h2>Your order — {area}</h2>
          <span>{shop.cart.length} lines</span>
        </div>
        {error && (
          <div role="alert" className="message error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="message">
            {notice}
          </div>
        )}
        {shop.cart.map((l) => (
          <div className="allocation" key={l.id}>
            <strong>{l.name}</strong>
            <p>
              {l.variantLabel ? `${l.variantLabel} · ` : ""}
              {money(l.unitPriceCents)} × {l.qty} ={" "}
              <strong>{money(lineTotal(l))}</strong>
            </p>
            <span className="qty-controls">
              <button
                className="secondary"
                onClick={() => updateQty(l.id, l.qty - 1)}
              >
                −
              </button>
              <button
                className="secondary"
                onClick={() => updateQty(l.id, l.qty + 1)}
              >
                +
              </button>
            </span>
          </div>
        ))}
        {!shop.cart.length && <p className="empty">Your order is empty.</p>}
        {shop.cart.length > 0 && (
          <>
            <p className="final-price">
              Subtotal {money(subtotal)} · Delivery {money(DELIVERY_FEE_CENTS)}{" "}
              · <strong>Final price {money(finalPrice)}</strong>
            </p>
            <p className="muted">
              Wallet balance {money(shop.balanceCents)}
              {shortfall > 0 && (
                <>
                  {" "}
                  · <strong>short by {money(shortfall)}</strong>
                </>
              )}
            </p>
            <button onClick={placeOrder}>
              Place order · {money(finalPrice)}
            </button>
          </>
        )}
      </div>

      <div className="section-title split-heading">
        <h2>Pending orders</h2>
        <span>{pending.length} awaiting fulfilment</span>
      </div>
      <div className="cards">
        {pending.map((o) => (
          <article key={o.id}>
            <div className="card-top">
              <span className="pill">{o.status}</span>
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
              <button onClick={() => confirmReceipt(o.id)}>
                Confirm receipt
              </button>
              <button className="secondary" onClick={() => cancelOrder(o.id)}>
                Cancel order
              </button>
            </div>
          </article>
        ))}
        {!pending.length && (
          <p className="empty">
            No pending orders. Placed orders appear here while awaiting
            fulfilment.
          </p>
        )}
      </div>
    </>
  );
}

function ProductCard({ product, onAdd }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id);
  const variant = product.variants.find((v) => v.id === variantId);
  const retail = product.referenceCents + (variant?.deltaCents ?? 0);

  return (
    <article>
      <div className="product-icon">▧</div>
      <h3>{product.name}</h3>
      <p>{product.pack}</p>
      <p className="muted">📍 Ships from {product.shipsFrom}</p>
      {product.variants.length > 0 && (
        <select
          aria-label={`Spec for ${product.name}`}
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
        >
          {product.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
              {v.deltaCents !== 0
                ? ` (${v.deltaCents > 0 ? "+" : ""}${money(v.deltaCents)})`
                : ""}
            </option>
          ))}
        </select>
      )}
      <small>Retail: {money(retail)}</small>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(product, variantId);
        }}
      >
        <button>Add to order</button>
      </form>
    </article>
  );
}