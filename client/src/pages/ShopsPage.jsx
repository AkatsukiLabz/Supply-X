import React, { useEffect, useMemo, useState } from "react";
import { AREAS } from "../auth.js";
import {
  DELIVERY_FEE_CENTS,
  loadShop,
  saveShop,
  seedProducts,
  uid,
} from "../shopStore.js";
import { money } from "../utils/formatters.js";

const fallbackProducts = seedProducts(AREAS);

const lineTotal = (line) => line.unitPriceCents * line.qty;

const normalizeApiProduct = (product, index) => ({
  id: product.id,
  name: product.name,
  category: product.category || "Spaza stock",
  pack: product.pack,
  referenceCents: product.reference_cents || product.referenceCents || 0,
  shipsFrom: product.area || AREAS[index % AREAS.length],
  variants: product.variants || [],
});

export default function ShopsPage({ user, products: apiProducts = [] }) {
  const [shop, setShop] = useState(() => loadShop(user.id));
  const [area, setArea] = useState(user.area || AREAS[0]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => saveShop(user.id, shop), [user.id, shop]);

  const catalogue = useMemo(
    () =>
      apiProducts.length
        ? apiProducts.map(normalizeApiProduct)
        : fallbackProducts,
    [apiProducts],
  );

  const products = catalogue.filter((product) => product.shipsFrom === area);
  const visibleProducts = products.length ? products : catalogue;
  const subtotal = shop.cart.reduce((sum, line) => sum + lineTotal(line), 0);
  const finalPrice = shop.cart.length > 0 ? subtotal + DELIVERY_FEE_CENTS : 0;
  const shortfall = finalPrice - shop.balanceCents;

  const addToCart = (product, variantId) => {
    const variant = product.variants.find((v) => v.id === variantId);
    const unitPriceCents = product.referenceCents + (variant?.deltaCents ?? 0);
    setShop((current) => {
      const existing = current.cart.find(
        (line) => line.productId === product.id && line.variantId === variantId,
      );
      const cart = existing
        ? current.cart.map((line) =>
            line === existing ? { ...line, qty: line.qty + 1 } : line,
          )
        : [
            ...current.cart,
            {
              id: uid(),
              productId: product.id,
              name: product.name,
              pack: product.pack,
              variantId,
              variantLabel: variant?.label,
              unitPriceCents,
              qty: 1,
              shipsFrom: product.shipsFrom,
            },
          ];
      return { ...current, cart };
    });
    setError("");
    setNotice(`${product.name} added to your order.`);
  };

  const updateQty = (lineId, qty) =>
    setShop((current) => ({
      ...current,
      cart:
        qty <= 0
          ? current.cart.filter((line) => line.id !== lineId)
          : current.cart.map((line) =>
              line.id === lineId ? { ...line, qty } : line,
            ),
    }));

  const placeOrder = () => {
    setError("");
    setNotice("");
    if (!shop.cart.length) return setError("Your order is empty.");
    if (shortfall > 0)
      return setError(
        `Insufficient wallet balance. Top up ${money(shortfall)} more.`,
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
    setShop((current) => ({
      ...current,
      cart: [],
      orders: [order, ...current.orders],
      balanceCents: current.balanceCents - order.totalCents,
      txns: [
        {
          id: uid(),
          type: "debit",
          amountCents: order.totalCents,
          note: `Order ${order.id} - ships from ${order.area}`,
          createdAt: Date.now(),
        },
        ...current.txns,
      ],
    }));
    setNotice("Order placed. Wallet debited and order is pending fulfilment.");
  };

  const cancelOrder = (orderId) =>
    setShop((current) => {
      const order = current.orders.find((item) => item.id === orderId);
      if (!order || order.status !== "pending") return current;
      return {
        ...current,
        orders: current.orders.map((item) =>
          item.id === orderId ? { ...item, status: "cancelled" } : item,
        ),
        balanceCents: current.balanceCents + order.totalCents,
        txns: [
          {
            id: uid(),
            type: "refund",
            amountCents: order.totalCents,
            note: `Refund - cancelled order ${orderId}`,
            createdAt: Date.now(),
          },
          ...current.txns,
        ],
      };
    });

  const confirmReceipt = (orderId) =>
    setShop((current) => ({
      ...current,
      orders: current.orders.map((order) =>
        order.id === orderId ? { ...order, status: "fulfilled" } : order,
      ),
    }));

  const pending = shop.orders.filter((order) => order.status === "pending");

  return (
    <>
      <div className="section-title">
        <h2>Shop by area</h2>
        <span>
          {visibleProducts.length} products {products.length ? `in ${area}` : "available"}
        </span>
      </div>
      <div className="area-tabs">
        {AREAS.map((option) => (
          <button
            key={option}
            className={option === area ? "active" : ""}
            onClick={() => setArea(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="products">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} onAdd={addToCart} />
        ))}
        {!visibleProducts.length && (
          <p className="empty">No products are available yet.</p>
        )}
      </div>

      <div className="order-panel">
        <div className="section-title">
          <h2>Your order</h2>
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
        {shop.cart.map((line) => (
          <div className="allocation" key={line.id}>
            <strong>{line.name}</strong>
            <p>
              {line.variantLabel ? `${line.variantLabel} · ` : ""}
              {money(line.unitPriceCents)} × {line.qty} ={" "}
              <strong>{money(lineTotal(line))}</strong>
            </p>
            <span className="qty-controls">
              <button
                className="secondary"
                onClick={() => updateQty(line.id, line.qty - 1)}
              >
                −
              </button>
              <button
                className="secondary"
                onClick={() => updateQty(line.id, line.qty + 1)}
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
            <button onClick={placeOrder}>Place order · {money(finalPrice)}</button>
          </>
        )}
      </div>

      <div className="section-title split-heading">
        <h2>Pending orders</h2>
        <span>{pending.length} awaiting fulfilment</span>
      </div>
      <div className="cards">
        {pending.map((order) => (
          <article key={order.id}>
            <div className="card-top">
              <span className="pill">{order.status}</span>
              <span>{order.area}</span>
            </div>
            <h2>Order {order.id}</h2>
            {order.lines.map((line) => (
              <p className="muted" key={line.id}>
                {line.qty} × {line.name}
                {line.variantLabel ? ` · ${line.variantLabel}` : ""} ·{" "}
                {money(lineTotal(line))}
              </p>
            ))}
            <p>
              Total delivered price <strong>{money(order.totalCents)}</strong>
            </p>
            <div className="bid-actions">
              <button onClick={() => confirmReceipt(order.id)}>
                Confirm receipt
              </button>
              <button className="secondary" onClick={() => cancelOrder(order.id)}>
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
  const variant = product.variants.find((item) => item.id === variantId);
  const retail = product.referenceCents + (variant?.deltaCents ?? 0);

  return (
    <article>
      <div className="product-icon">▧</div>
      <h3>{product.name}</h3>
      <p>{product.pack}</p>
      <p className="muted">Ships from {product.shipsFrom}</p>
      {product.variants.length > 0 && (
        <select
          aria-label={`Spec for ${product.name}`}
          value={variantId}
          onChange={(event) => setVariantId(event.target.value)}
        >
          {product.variants.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
              {item.deltaCents !== 0
                ? ` (${item.deltaCents > 0 ? "+" : ""}${money(item.deltaCents)})`
                : ""}
            </option>
          ))}
        </select>
      )}
      <small>Retail: {money(retail)}</small>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onAdd(product, variantId);
        }}
      >
        <button>Add to order</button>
      </form>
    </article>
  );
}
