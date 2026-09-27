import React, { useEffect, useState } from "react";
import { auctionState } from "../utils/navigation.js";

const CHECKLIST = [
  { key: "contact", label: "Contact details" },
  { key: "area", label: "Service area" },
  { key: "bank", label: "Bank confirmation", docKey: "bank_confirmation_url" },
  { key: "trading", label: "Trading proof", docKey: "trading_proof_url" },
];

export default function AdminOverview({ data, setTab, busy, api }) {
  const open = data.auctions.filter(
    (auction) => auctionState(auction) === "open",
  ).length;
  const readyGroups = data.groups.filter(
    (group) =>
      group.status === "Ready for Bidding" ||
      group.status === "Awaiting Contributions",
  ).length;

  const [suppliers, setSuppliers] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [savingKey, setSavingKey] = useState("");

  async function loadSuppliers() {
    try {
      setSuppliers(await api("/admin/suppliers"));
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function toggleVerified(supplier, field, verified) {
    const key = `${supplier.id}-${field}`;
    setSavingKey(key);
    try {
      await api(`/admin/suppliers/${supplier.id}/verify`, { field, verified });
      await loadSuppliers();
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setSavingKey("");
    }
  }

  return (
    <>
      <section className="stats">
        {[
          [data.groups.length, "Buying groups"],
          [readyGroups, "Groups to review"],
          [open, "Open auctions"],
          [data.orders.length, "Orders"],
        ].map(([value, label]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{String(value).padStart(2, "0")}</strong>
          </article>
        ))}
      </section>

      <section className="intro admin-next-actions">
        <div>
          <span className="eyebrow">COORDINATOR FLOW</span>
          <h2>
            Group demand.
            <br />
            Open bidding.
          </h2>
        </div>
        <ol>
          <li>
            <b>01</b>
            <div>
              <strong>Review buying groups</strong>
              <p>Check grouped shop demand by product and area.</p>
            </div>
          </li>
          <li>
            <b>02</b>
            <div>
              <strong>Open supplier bidding</strong>
              <p>Move ready groups into timed auctions.</p>
            </div>
          </li>
          <li>
            <b>03</b>
            <div>
              <strong>Award and track fulfilment</strong>
              <p>Select the lowest valid bid and monitor delivery progress.</p>
            </div>
          </li>
        </ol>
      </section>

      <div className="bid-actions">
        <button onClick={() => setTab("Buying groups")}>Review groups</button>
        <button className="secondary" onClick={() => setTab("Auctions")}>
          View auctions
        </button>
      </div>

      <div className="section-title split-heading">
        <h2>Supplier verification</h2>
        <span>{suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}</span>
      </div>
      <p>
        Check each item once you have confirmed it. A supplier is fully
        verified once all four items are ticked.
      </p>

      {loadError && (
        <div role="alert" className="message error">
          {loadError}
        </div>
      )}

      {suppliers.length === 0 && !loadError && (
        <p className="empty">No suppliers have signed up yet.</p>
      )}

      <div className="cards">
        {suppliers.map((supplier) => {
          const verifiedCount = CHECKLIST.filter(
            (item) => supplier[`${item.key === "bank" ? "bank_confirmation" : item.key === "trading" ? "trading_proof" : item.key}_verified`],
          ).length;
          const complete = verifiedCount === CHECKLIST.length;

          return (
            <article key={supplier.id} className={complete ? "supplier-verified" : ""}>
              <div className="card-top">
                <span className="pill">
                  {complete ? "Verified" : `${verifiedCount}/4`}
                </span>
                <span>{supplier.location || "No area"}</span>
              </div>
              <h2>{supplier.business_name}</h2>
              <p className="muted">
                {supplier.contact_phone || "No phone on file"}
              </p>

              <div className="checklist-items">
                {CHECKLIST.map((item) => {
                  const columnKey =
                    item.key === "bank"
                      ? "bank_confirmation_verified"
                      : item.key === "trading"
                        ? "trading_proof_verified"
                        : `${item.key}_verified`;
                  const checked = Boolean(supplier[columnKey]);
                  const saving = savingKey === `${supplier.id}-${item.key}`;
                  const docUrl = item.docKey ? supplier[item.docKey] : null;

                  return (
                    <label key={item.key} className="checklist-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy || saving}
                        onChange={(e) =>
                          toggleVerified(supplier, item.key, e.target.checked)
                        }
                      />
                      <span>
                        {item.label}
                        {item.docKey && (
                          docUrl ? (
                            <>
                              {" "}
                              <a href={docUrl} target="_blank" rel="noreferrer">
                                View document
                              </a>
                            </>
                          ) : (
                            <span className="muted"> — not uploaded</span>
                          )
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
