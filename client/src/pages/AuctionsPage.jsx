import React from "react";
import AuctionCards from "../components/AuctionCards.jsx";

export default function AuctionsPage({
  user,
  activeTab,
  shownAuctions,
  orders,
  busy,
  selectedAuctionId,
  setSelectedAuctionId,
  submitSupplierBid,
  act,
  api,
}) {
  return (
    <>
      <div className="section-title">
        <h2>{user?.role === "supplier" ? activeTab : "Shared demand"}</h2>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => act(async () => {}, "Updated auction status.")}
        >
          Refresh
        </button>
      </div>

      <p>
        {user?.role === "supplier"
          ? "Submit one private delivered total per open auction. Once you bid, it moves to My bids."
          : "Each supplier bid is the full delivered total in rand. No real payments are collected in this demo."}
      </p>

      <AuctionCards
        auctions={shownAuctions}
        user={user}
        activeTab={activeTab}
        orders={orders}
        busy={busy}
        selectedAuctionId={selectedAuctionId}
        setSelectedAuctionId={setSelectedAuctionId}
        submitSupplierBid={submitSupplierBid}
        act={act}
        api={api}
      />

      {!shownAuctions.length && (
        <p className="empty">
          {user?.role === "supplier"
            ? activeTab === "My bids"
              ? "You have not submitted any bids yet."
              : "No open auction opportunities in your area yet."
            : "No auctions yet. The coordinator groups shop requests to open one."}
        </p>
      )}
    </>
  );
}
