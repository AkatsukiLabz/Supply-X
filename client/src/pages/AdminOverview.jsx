import React from "react";
import { auctionState } from "../utils/navigation.js";

export default function AdminOverview({ data, setTab }) {
  const open = data.auctions.filter(
    (auction) => auctionState(auction) === "open",
  ).length;
  const readyGroups = data.groups.filter(
    (group) =>
      group.status === "Ready for Bidding" ||
      group.status === "Awaiting Contributions",
  ).length;

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
    </>
  );
}
