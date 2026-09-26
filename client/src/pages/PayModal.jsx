import React, { useState } from "react";

const money = (c) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    c / 100,
  );

export default function PayModal({ order, onCancel, onPaid }) {
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const digits = (v) => v.replace(/\D/g, "");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (digits(card).length < 13) return setError("Enter a valid card number.");
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return setError("Expiry must be MM/YY.");
    if (digits(cvv).length < 3) return setError("Enter a valid CVV.");
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    setBusy(false);
    onPaid(order.id);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="section-title split-heading">
          <h2>Confirm payment</h2>
          <span>{money(order.totalCents)}</span>
        </div>
        <p className="muted">
          You will be charged <strong>{money(order.totalCents)}</strong> for
          order <strong>{order.id}</strong>.
        </p>

        {error && (
          <div role="alert" className="message error">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="pay-form">
          <label>
            Card number
            <input
              inputMode="numeric"
              placeholder="1234 5678 9012 3456"
              value={card}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "").slice(0, 16);
                setCard(d.replace(/(\d{4})(?=\d)/g, "$1 "));
              }}
              required
            />
          </label>

          <div className="field-row">
            <label>
              Expiry (MM/YY)
              <input
                inputMode="numeric"
                placeholder="12/28"
                maxLength={5}
                value={expiry}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                }}
                required
              />
            </label>
            <label>
              CVV
              <input
                inputMode="numeric"
                placeholder="123"
                maxLength={4}
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
                required
              />
            </label>
          </div>

          <div className="bid-actions">
            <button disabled={busy}>
              {busy ? "Charging…" : `Pay ${money(order.totalCents)}`}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}