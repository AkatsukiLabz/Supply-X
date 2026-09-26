import React, { useEffect, useState } from "react";
import { AREAS } from "../auth.js";
import {
  DELIVERY_FEE_CENTS,
  POPULAR_IDS,
  loadShop,
  saveShop,
  seedProducts,
  uid,
} from "../shopStore.js";
import PayModal from "./PayModal.jsx";

const money = (c) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    c / 100,
  );

const PRODUCTS = seedProducts(AREAS);
const lineTotal = (l) => l.unitPriceCents * l.qty;

export default function StockRequestsPage({ user }) {
  const [shop, setShop] = useState(() => loadShop(user.id));
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [payOrder, setPayOrder] = useState(null);

  useEffect(() => saveShop(user.id, shop), [user.id, shop]);

  const trimmed = search.trim().toLowerCase();
  const visibleProducts = trimmed
    ? PRODUCTS.filter((p) => p.name.toLowerCase().includes(trimmed))
    : PRODUCTS.filter((p) => POPULAR_IDS.includes(p.id));

  const subtotal = shop.cart.reduce((s, l) => s + lineTotal(l), 0);
  const totalCents = shop.cart.length ? subtotal + DELIVERY_FEE_CENTS : 0;

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
    const order = {
      id: uid(),
      area: user.area || "—",
      lines: shop.cart,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
      totalCents,
      status: "pending_payment",
      createdAt: Date.now(),
    };
    setShop((s) => ({
      ...s,
      cart: [],
      orders: [order, ...s.orders],
    }));
    setPayOrder(order);
  };

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
    setNotice("Payment received. Your order is being approved.");
    setTimeout(() => {
      setShop((s) => ({
        ...s,
        orders: s.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: "approved", approvedAt: Date.now() }
            : o,
        ),
      }));
      setNotice("Order approved. The supplier has been notified.");
    }, 1200);
  };

  return (
    <>
      <div className="section-title">
        <h2>Request stock</h2>
        <span>
          {trimmed
            ? `${visibleProducts.length} match${
                visibleProducts.length === 1 ? "" : "es"
              }`
            : `${PRODUCTS.length} products available`}
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

      {!trimmed && (
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Showing the 4 most commonly bought. Search to find any of the{" "}
          {PRODUCTS.length} products.
        </p>
      )}

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

      <div className="products">
        {visibleProducts.map((p) => (
          <ShopProductCard key={p.id} product={p} onAdd={addToCart} />
        ))}
        {visibleProducts.length === 0 && (
          <p className="empty">No products match "{search}".</p>
        )}
      </div>

      <div className="order-panel">
        <div className="section-title">
          <h2>Your order</h2>
          <span>{shop.cart.length} lines</span>
        </div>
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
              · <strong>Total {money(totalCents)}</strong>
            </p>
            <button onClick={placeOrder}>Place order</button>
          </>
        )}
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

function ShopProductCard({ product, onAdd }) {
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