import React from "react";
import AuctionCards from "../components/AuctionCards.jsx";
import OrderCards from "../components/OrderCards.jsx";
import SupplierDocuments from "../components/SupplierDocuments.jsx";
import { auctionState } from "../utils/navigation.js";

export default function SupplierOverview({
  user,
  data,
  busy,
  activeTab,
  selectedAuctionId,
  setSelectedAuctionId,
  submitSupplierBid,
  act,
  api,
}) {
  const pendingSupplierOrders = data.orders.filter(
    (order) => order.status === "submitted",
  );
  const availableSupplierAuctions = data.auctions.filter(
    (auction) => auctionState(auction) === "open" && auction.bids.length === 0,
  );

  if (pendingSupplierOrders.length > 0) {
    return (
      <>
        <section className="supplier-dashboard-grid">
          <div className="dashboard-main">
            <div className="section-title split-heading">
              <h2>Needs dispatch</h2>
              <span>{pendingSupplierOrders.length} orders</span>
            </div>
            <OrderCards
              orders={pendingSupplierOrders}
              user={user}
              busy={busy}
              act={act}
              api={api}
            />
          </div>

          <aside className="dashboard-side">
            <div className="section-title split-heading">
              <h2>Open auctions</h2>
              <span>{availableSupplierAuctions.length} open</span>
            </div>
            {availableSupplierAuctions.length ? (
              <AuctionCards
                auctions={availableSupplierAuctions}
                user={user}
                activeTab={activeTab}
                orders={data.orders}
                busy={busy}
                selectedAuctionId={selectedAuctionId}
                setSelectedAuctionId={setSelectedAuctionId}
                submitSupplierBid={submitSupplierBid}
                act={act}
                api={api}
              />
            ) : (
              <p className="empty dashboard-empty">
                There are no open auctions right now. Open auctions will show
                here, check back in a few.
              </p>
            )}
          </aside>
        </section>
        <SupplierDocuments api={api} />
      </>
    );
  }

  if (availableSupplierAuctions.length > 0) {
    return (
      <>
        <section className="overview-opportunities">
          <div className="section-title split-heading">
            <h2>Open auctions</h2>
            <span>{availableSupplierAuctions.length} open</span>
          </div>
          <AuctionCards
            auctions={availableSupplierAuctions}
            user={user}
            activeTab={activeTab}
            orders={data.orders}
            busy={busy}
            selectedAuctionId={selectedAuctionId}
            setSelectedAuctionId={setSelectedAuctionId}
            submitSupplierBid={submitSupplierBid}
            act={act}
            api={api}
          />
        </section>
        <SupplierDocuments api={api} />
      </>
    );
  }

  return (
    <>
      <section className="supplier-empty-state">
        <div className="empty-icon">SX</div>
        <div>
          <p className="empty-kicker">No live opportunities</p>
          <h2>No open auctions right now.</h2>
          <p>
            New supplier opportunities will appear here once nearby shop demand is
            ready for bidding. Check back shortly.
          </p>
        </div>
      </section>
      <SupplierDocuments api={api} />
    </>
  );
}
