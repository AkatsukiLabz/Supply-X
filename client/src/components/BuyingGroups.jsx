import React, { useState } from "react";
import { money } from "../utils/formatters.js";

// Admin "Buying groups" section.
// Shows every buying group (same product, same area) and lets the admin
// open a group to see each shop's requested quantity and contribution.

const statusClass = {
  "Awaiting Contributions": "group-status awaiting",
  "Ready for Bidding": "group-status ready",
  "On Auction": "group-status auction",
  "Bid Selected": "group-status selected",
  Completed: "group-status completed",
};

const StatusPill = ({ status }) => (
  <span className={statusClass[status] || "group-status"}>{status}</span>
);

export default function BuyingGroups({ groups, busy, onRefresh }) {
  const [openKey, setOpenKey] = useState(null);
  const group = groups.find((g) => g.key === openKey);

  if (group)
    return (
      <>
        <div className="section-title">
          <button className="secondary" onClick={() => setOpenKey(null)}>
            ← All buying groups
          </button>
          <StatusPill status={group.status} />
        </div>
        <div className="group-detail-head">
          <span className="group-code">{group.code}</span>
          <h2>{group.name}</h2>
          <p className="muted">{group.pack}</p>
        </div>
        <div className="group-summary">
          <div>
            <span>Shops</span>
            <strong>{group.shopCount}</strong>
          </div>
          <div>
            <span>Total quantity</span>
            <strong>
              {group.totalQuantity} × {group.pack}
            </strong>
          </div>
          <div>
            <span>Total contributions</span>
            <strong>{money(group.contributionCents)}</strong>
          </div>
        </div>
        {group.savings && (
          <>
            <h3>Savings</h3>
            <div className="group-summary">
              <div>
                <span>Total shop contributions</span>
                <strong>{money(group.savings.contributionCents)}</strong>
              </div>
              <div>
                <span>Winning bid</span>
                <strong>{money(group.savings.winningBidCents)}</strong>
              </div>
              <div>
                <span>Savings</span>
                <strong>{money(group.savings.savingsCents)}</strong>
              </div>
              <div>
                <span>Platform fee (10% of winning bid)</span>
                <strong>{money(group.savings.platformFeeCents)}</strong>
              </div>
              <div>
                <span>Supplier receives</span>
                <strong>{money(group.savings.supplierPayoutCents)}</strong>
              </div>
            </div>
          </>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Shop</th>
                <th>Requested quantity</th>
                <th>Contribution</th>
              </tr>
            </thead>
            <tbody>
              {group.shops.map((s) => (
                <tr key={s.shopId}>
                  <td>{s.shopName}</td>
                  <td>
                    {s.quantity}
                    <small>{group.pack}</small>
                  </td>
                  <td>
                    {s.contributionCents > 0 ? (
                      money(s.contributionCents)
                    ) : (
                      <span className="muted">Not yet contributed</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="group-total">
                <td>Total</td>
                <td>{group.totalQuantity}</td>
                <td>{money(group.contributionCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    );

  return (
    <>
      <div className="section-title">
        <h2>All buying groups</h2>
        <button className="secondary" disabled={busy} onClick={onRefresh}>
          Refresh
        </button>
      </div>
      <p>
        Shops that request the same product in the same area are grouped
        together. Select a group to see each shop.
      </p>
      <div className="table-wrap">
        <table className="groups-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Shops</th>
              <th>Product</th>
              <th>Total quantity</th>
              <th>Contributions</th>
              <th>Savings</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr
                key={g.key}
                className="group-row"
                onClick={() => setOpenKey(g.key)}
              >
                <td>
                  <button
                    type="button"
                    className="group-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenKey(g.key);
                    }}
                  >
                    {g.name}
                  </button>
                  <small>{g.code}</small>
                </td>
                <td>{g.shopCount}</td>
                <td>
                  {g.product}
                  <small>{g.pack}</small>
                </td>
                <td>{g.totalQuantity}</td>
                <td>{money(g.contributionCents)}</td>
                <td>
                  {g.savings ? (
                    <>
                      {money(g.savings.savingsCents)}
                      <small>
                        Fee {money(g.savings.platformFeeCents)}
                      </small>
                    </>
                  ) : null}
                </td>
                <td>
                  <StatusPill status={g.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!groups.length && (
          <p className="empty">
            No buying groups yet. Groups appear once shops request stock.
          </p>
        )}
      </div>
    </>
  );
}
