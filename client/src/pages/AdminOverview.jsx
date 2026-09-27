import React, { useEffect, useState } from "react";
import { auctionState } from "../utils/navigation.js";

const CHECKLIST = [
  { key: "contact", label: "Contact details" },
  { key: "area", label: "Service area" },
  {
    key: "bank",
    label: "Bank confirmation",
    isDoc: true,
    uploadedKey: "bank_confirmation_uploaded",
  },
  {
    key: "trading",
    label: "Trading proof",
    isDoc: true,
    uploadedKey: "trading_proof_uploaded",
  },
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
  const [openingKey, setOpeningKey] = useState("");

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

  async function openDocument(supplier, field) {
    const key = `${supplier.id}-${field}`;
    setOpeningKey(key);
    setLoadError("");
    try {
      const blob = await api.download(
        `/admin/suppliers/${supplier.id}/documents/${field}`,
      );
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setOpeningKey("");
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
              <div className="supplier-card-top">
                <h2>{supplier.business_name}</h2>
                <span className="pill">
                  {complete ? "Verified" : `${verifiedCount}/4 checked`}
                </span>
              </div>

              <div className="checklist-items">
                {CHECKLIST.map((item) => {
                  const columnKey =
                    item.key === "bank"
                      ? "bank_confirmation_verified"
                      : item.key === "trading"
                        ? "trading_proof_verified"
                        : `${item.key}_verified`;
                  const checked = Boolean(supplier[columnKey]);
                  const itemKey = `${supplier.id}-${item.key}`;
                  const saving = savingKey === itemKey;
                  const opening = openingKey === itemKey;
                  const uploaded = item.uploadedKey
                    ? Boolean(supplier[item.uploadedKey])
                    : null;
                  const value =
                    item.key === "contact"
                      ? supplier.contact_phone || "No phone on file"
                      : item.key === "area"
                        ? supplier.location || "No area on file"
                        : null;

                  return (
                    <div key={item.key} className="checklist-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy || saving}
                          onChange={(e) =>
                            toggleVerified(supplier, item.key, e.target.checked)
                          }
                        />
                        <span className="checklist-label">{item.label}</span>
                      </label>
                      <span className="checklist-value">
                        {value}
                        {item.isDoc &&
                          (!uploaded ? (
                            <span className="doc-status doc-missing">
                              Not uploaded
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="doc-status doc-link"
                              disabled={opening}
                              onClick={() => openDocument(supplier, item.key)}
                            >
                              {opening ? "Opening…" : "View document"}
                            </button>
                          ))}
                      </span>
                    </div>
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
