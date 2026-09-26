import React from "react";
import {
  dateTimeNoSeconds,
  money,
  parseRandCents,
} from "../utils/formatters.js";
import { auctionState } from "../utils/navigation.js";

export default function AuctionCards({
  auctions,
  user,
  activeTab,
  orders,
  busy,
  selectedAuctionId,
  setSelectedAuctionId,
  submitSupplierBid,
  act,
  api,
}) {
  const wonAuctionIds = new Set(orders.map((order) => order.auction_id));

  const bidResult = (auction) => {
    if (!auction.bids.length) return null;
    if (wonAuctionIds.has(auction.id)) return "won";
    if (auctionState(auction) === "awarded") return "lost";
    return null;
  };

  const bidTrackerSteps = (auction) => {
    const order = orders.find((o) => o.auction_id === auction.id);
    const result = bidResult(auction);
    if (result === "won")
      return [
        { label: "Won", done: true, tone: "won" },
        {
          label:
            order?.status === "completed"
              ? "Completed"
              : order?.status === "accepted" || order?.status === "dispatched"
                ? "Waiting for receipt"
                : "Dispatch required",
          done: Boolean(order),
          tone:
            order?.status === "completed"
              ? "won"
              : order?.status === "accepted" || order?.status === "dispatched"
                ? "waiting"
                : "urgent",
        },
      ];
    if (result === "lost") return [{ label: "Lost", done: true, tone: "lost" }];
    return [{ label: "Result pending", done: false }];
  };

  return (
    <div className="cards">
      {auctions.map((auction) => {
        const state = auctionState(auction);
        const closed = state === "closed" || state === "awarded";

        return (
          <article key={auction.id}>
            <div className="card-top">
              <span className="pill">{state}</span>
              <span>{auction.area}</span>
            </div>
            <h2>{auction.name}</h2>

            {user?.role === "supplier" && state === "open" ? (
              <div className="opportunity-summary">
                <div>
                  <span>Total quantity</span>
                  <strong>
                    {auction.quantity} × {auction.pack}
                  </strong>
                </div>
                <div>
                  <span>Area</span>
                  <strong>{auction.area || "Your service area"}</strong>
                </div>
                <div>
                  <span>Closes</span>
                  <strong>{dateTimeNoSeconds(auction.closes_at)}</strong>
                </div>
                {auction.retail_benchmark_cents > 0 && (
                  <div>
                    <span>Retail benchmark</span>
                    <strong>{money(auction.retail_benchmark_cents)}</strong>
                  </div>
                )}
              </div>
            ) : (
              <>
                <p>
                  {auction.quantity} × {auction.pack}
                </p>
                <p className="muted auction-time">
                  {state === "open" ? "Closes" : "Closed"}{" "}
                  {dateTimeNoSeconds(auction.closes_at)}
                </p>
              </>
            )}

            {user?.role === "supplier" && state === "open" && (
              <p className="opportunity-fit">
                Matches your service area. Submit a delivered total below the
                retail benchmark to stay competitive.
              </p>
            )}

            {auction.bids.length > 0 && (
              <>
                <p>
                  {user?.role === "supplier" ? "Your bid" : "Bids after close"}:{" "}
                  {auction.bids.map((b) => money(b.total_cents)).join(" · ")}
                </p>
                {activeTab === "My bids" && (
                  <div className="bid-tracker">
                    {bidTrackerSteps(auction).map((step) => (
                      <span
                        key={step.label}
                        className={[
                          "tracker-step",
                          step.done ? "done" : "",
                          step.tone || "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {step.label}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            {user?.role === "supplier" &&
              auction.status === "open" &&
              !closed &&
              auction.bids.length === 0 &&
              (selectedAuctionId === auction.id ? (
                <form
                  className="bid-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const totalCents = parseRandCents(
                      new FormData(event.currentTarget).get("total"),
                    );
                    submitSupplierBid(auction.id, totalCents);
                  }}
                >
                  <div className="bid-guidance">
                    <strong>Before you bid</strong>
                    <ul>
                      <li>
                        Your price must include delivery and all supplier
                        charges.
                      </li>
                      {auction.retail_benchmark_cents > 0 && (
                        <li>
                          Keep your delivered total below{" "}
                          {money(auction.retail_benchmark_cents)} to qualify.
                        </li>
                      )}
                      <li>
                        Competitors cannot see your bid while bidding is open.
                      </li>
                    </ul>
                  </div>
                  <label>
                    Total delivered price
                    <span className="money-input">
                      <span>R</span>
                      <input
                        name="total"
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]+([,.][0-9]{1,2})?"
                        placeholder="0.00"
                        required
                        autoFocus
                      />
                    </span>
                  </label>
                  <div className="bid-actions">
                    <button disabled={busy}>Submit private bid</button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setSelectedAuctionId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="auction-join"
                  onClick={() => setSelectedAuctionId(auction.id)}
                >
                  Participate in auction
                </button>
              ))}

            {user?.role === "admin" && auction.status === "open" && (
              <button
                disabled={busy || !closed}
                onClick={() =>
                  act(
                    () => api(`/auctions/${auction.id}/award`, {}),
                    "Lowest delivered bid awarded. The order is ready for the supplier.",
                  )
                }
              >
                {closed ? "Award lowest bid" : "Waiting for bids to close"}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
