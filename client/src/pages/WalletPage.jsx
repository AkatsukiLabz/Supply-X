import React, { useEffect, useState } from "react";
import { loadShop, saveShop, uid } from "../shopStore.js";
import { money, parseRandCents } from "../utils/formatters.js";

export default function WalletPage({ user }) {
  const [shop, setShop] = useState(() => loadShop(user.id));
  const [error, setError] = useState("");

  useEffect(() => saveShop(user.id, shop), [user.id, shop]);

  const topUp = (event) => {
    event.preventDefault();
    const cents = parseRandCents(
      new FormData(event.currentTarget).get("amount"),
    );
    if (cents <= 0) return setError("Enter an amount above R0.");
    setError("");
    setShop((current) => ({
      ...current,
      balanceCents: current.balanceCents + cents,
      txns: [
        {
          id: uid(),
          type: "topup",
          amountCents: cents,
          note: "Wallet top-up",
          createdAt: Date.now(),
        },
        ...current.txns,
      ],
    }));
    event.currentTarget.reset();
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
              shop.orders.filter((order) => order.status === "pending").length,
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
            {shop.txns.map((txn) => (
              <tr key={txn.id}>
                <td>{txn.note}</td>
                <td>
                  <span className="pill">{txn.type}</span>
                </td>
                <td>
                  <strong>
                    {txn.type === "debit" ? "-" : "+"}
                    {money(txn.amountCents)}
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
