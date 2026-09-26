import React, { useEffect, useState } from "react";
import { loadShop, saveShop, uid } from "./shopStore.js";

const money = (c) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    c / 100,
  );

const parseRandCents = (value) => {
  const normalized = String(value).replace(/[^0-9,.]/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

export default function Wallet({ user }) {
  const [shop, setShop] = useState(() => loadShop(user.id));
  const [error, setError] = useState("");

  useEffect(() => saveShop(user.id, shop), [user.id, shop]);

  const topUp = (e) => {
    e.preventDefault();
    const cents = parseRandCents(
      new FormData(e.currentTarget).get("amount"),
    );
    if (cents <= 0) return setError("Enter an amount above R0.");
    setError("");
    setShop((s) => ({
      ...s,
      balanceCents: s.balanceCents + cents,
      txns: [
        {
          id: uid(),
          type: "topup",
          amountCents: cents,
          note: "Wallet top-up",
          createdAt: Date.now(),
        },
        ...s.txns,
      ],
    }));
    e.currentTarget.reset();
  };

  return (
    <>
      <section className="stats">
        <article>
          <span>Wallet balance</span>
          <strong>{money(shop.balanceCents)}</strong>
        </article>
        <article>
          <span>Pending orders</span>
          <strong>
            {String(
              shop.orders.filter((o) => o.status === "pending").length,
            ).padStart(2, "0")}
          </strong>
        </article>
        <article>
          <span>Transactions</span>
          <strong>{String(shop.txns.length).padStart(2, "0")}</strong>
        </article>
      </section>

      <form className="auction-form" onSubmit={topUp}>
        <p>Top up your prepaid balance. Orders are paid instantly from the wallet.</p>
        <label>
          Amount
          <span className="money-input">
            <span>R</span>
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              pattern="[0-9]+([,.][0-9]{1,2})?"
              placeholder="0.00"
              required
            />
          </span>
        </label>
        <button>Add funds</button>
      </form>
      {error && (
        <div role="alert" className="message error">
          {error}
        </div>
      )}

      <h2>Transactions</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Note</th>
              <th>Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {shop.txns.map((t) => (
              <tr key={t.id}>
                <td>{t.note}</td>
                <td>
                  <span className="pill">{t.type}</span>
                </td>
                <td>
                  <strong>
                    {t.type === "debit" ? "−" : "+"}
                    {money(t.amountCents)}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shop.txns.length && (
          <p className="empty">No transactions yet. Top up to get started.</p>
        )}
      </div>
    </>
  );
}