import React, { useEffect, useState } from "react";
import { uploadVerificationDoc } from "../auth.js";

// Lets a supplier attach or replace their bank confirmation and trading
// proof at any time, not only during signup. This covers an account that
// was created before this feature existed, or a signup where the upload
// step did not finish.
export default function SupplierDocuments({ api }) {
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyField, setBusyField] = useState("");
  const [fileNames, setFileNames] = useState({});

  async function load() {
    try {
      setMe(await api("/me/documents/status"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleFile(kind, field, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileNames((n) => ({ ...n, [field]: file.name }));
    setBusyField(field);
    setError("");
    setNotice("");
    try {
      const path = await uploadVerificationDoc(file, kind);
      await api("/me/documents", { [field]: path });
      setNotice("Document uploaded.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyField("");
    }
  }

  if (!me) return null;

  const rows = [
    {
      field: "bankConfirmationPath",
      kind: "bank-confirmation",
      label: "Bank confirmation letter",
      uploaded: me.bankConfirmationUploaded,
    },
    {
      field: "tradingProofPath",
      kind: "trading-proof",
      label: "Proof of trading",
      uploaded: me.tradingProofUploaded,
    },
  ];

  return (
    <section className="supplier-documents">
      <div className="section-title split-heading">
        <h2>Verification documents</h2>
      </div>
      <p>
        The SupplyX team checks these before your account is fully verified.
        You can replace a document at any time.
      </p>

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

      <div className="document-rows">
        {rows.map((row) => (
          <div className="document-row" key={row.field}>
            <div className="document-row-status">
              <span className={row.uploaded ? "pill pill-ok" : "pill pill-warn"}>
                {row.uploaded ? "Uploaded" : "Not uploaded"}
              </span>
              <span>{row.label}</span>
            </div>
            <label className="file-input-wrapper">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={busyField === row.field}
                onChange={(e) => handleFile(row.kind, row.field, e)}
              />
              <span className="file-name">
                {busyField === row.field
                  ? "Uploading…"
                  : fileNames[row.field] ||
                    (row.uploaded ? "Replace file" : "Choose file (PDF, JPG or PNG, max 5MB)")}
              </span>
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
