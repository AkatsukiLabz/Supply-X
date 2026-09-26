import React, { useEffect, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import { createApiClient } from "./services/api.js";
import { auctionState, isShop, tabsForRole } from "./utils/navigation.js";
import AdminOverview from "./pages/AdminOverview.jsx";
import AuctionsPage from "./pages/AuctionsPage.jsx";
import BuyingGroupsPage from "./pages/BuyingGroupsPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import ShopOverview from "./pages/ShopOverview.jsx";
import StockRequestsPage from "./pages/StockRequestsPage.jsx";
import SupplierOverview from "./pages/SupplierOverview.jsx";

const emptyData = {
  products: [],
  requests: [],
  auctions: [],
  orders: [],
  groups: [],
};

export default function App({ session, onSignOut }) {
  const user = session.user;
  const userId = user.id;
  const mode = session.mode;
  const api = createApiClient(session, onSignOut);

  const [data, setData] = useState(emptyData);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Overview");
  const [selected, setSelected] = useState([]);
  const [selectedAuctionId, setSelectedAuctionId] = useState(null);
  const [, setClockTick] = useState(() => Date.now());

  async function load() {
    if (user?.role === "supplier") {
      const [auctions, orders] = await Promise.all(
        ["/auctions", "/orders"].map((path) => api(path)),
      );
      return { ...emptyData, auctions, orders };
    }

    const failed = [];
    const safe = (path) =>
      api(path).catch((loadError) => {
        failed.push(`${path.slice(1)}: ${loadError.message}`);
        return [];
      });

    const [products, requests, auctions, orders] = await Promise.all(
      ["/products", "/requests", "/auctions", "/orders"].map(safe),
    );
    const groups = user?.role === "admin" ? await safe("/groups") : [];

    if (failed.length) {
      setTimeout(
        () => setError("Some data could not load. " + failed.join(" | ")),
        0,
      );
    }

    return { products, requests, auctions, orders, groups };
  }

  useEffect(() => {
    let active = true;
    setSelected([]);
    setData(emptyData);
    setError("");

    if (userId) {
      setBusy(true);
      load()
        .then((nextData) => {
          if (active) setData(nextData);
        })
        .catch((loadError) => {
          if (active) setError(loadError.message);
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (user?.role !== "supplier") return undefined;
    const id = window.setInterval(() => setClockTick(Date.now()), 10000);
    return () => window.clearInterval(id);
  }, [user?.role]);

  async function act(fn, message) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setData(await load());
      setSelected([]);
      setNotice(message);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitSupplierBid(auctionId, totalCents) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const bid = await api(`/auctions/${auctionId}/bids`, { totalCents });
      setData((current) => ({
        ...current,
        auctions: current.auctions.map((auction) =>
          auction.id === auctionId ? { ...auction, bids: [bid] } : auction,
        ),
      }));
      setSelectedAuctionId(null);
      setNotice("Your private bid is saved. It moved to My bids.");
      setTab("My bids");
    } catch (bidError) {
      setError(bidError.message);
    } finally {
      setBusy(false);
    }
  }

  const tabs = tabsForRole(user?.role);
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const availableSupplierAuctions = data.auctions.filter(
    (auction) => auctionState(auction) === "open" && auction.bids.length === 0,
  );
  const shownAuctions = data.auctions.filter((auction) => {
    if (activeTab === "My bids") return auction.bids.length > 0;
    if (activeTab === "Available auctions")
      return availableSupplierAuctions.some((item) => item.id === auction.id);
    return true;
  });

  const sharedAuctionProps = {
    user,
    busy,
    selectedAuctionId,
    setSelectedAuctionId,
    submitSupplierBid,
    act,
    api,
  };

  let page = null;

  if (activeTab === "Overview" && user?.role === "supplier") {
    page = (
      <SupplierOverview
        data={data}
        activeTab={activeTab}
        {...sharedAuctionProps}
      />
    );
  } else if (activeTab === "Overview" && user?.role === "admin") {
    page = <AdminOverview data={data} setTab={setTab} />;
  } else if (activeTab === "Overview" && isShop(user?.role)) {
    page = <ShopOverview user={user} onGoTo={setTab} />;
  } else if (activeTab === "Buying groups" && user?.role === "admin") {
    page = <BuyingGroupsPage groups={data.groups} busy={busy} act={act} />;
  } else if (activeTab === "Stock requests") {
    page = (
      <StockRequestsPage
        user={user}
        data={data}
        selected={selected}
        setSelected={setSelected}
        busy={busy}
        act={act}
        api={api}
      />
    );
  } else if (
    activeTab === "Auctions" ||
    activeTab === "Available auctions" ||
    activeTab === "My bids"
  ) {
    page = (
      <AuctionsPage
        activeTab={activeTab}
        shownAuctions={shownAuctions}
        orders={data.orders}
        {...sharedAuctionProps}
      />
    );
  } else if (activeTab === "Orders") {
    page = (
      <OrdersPage
        user={user}
        orders={data.orders}
        busy={busy}
        act={act}
        api={api}
      />
    );
  }

  return (
    <AppShell
      user={user}
      mode={mode}
      tabs={tabs}
      activeTab={activeTab}
      setTab={setTab}
      error={error}
      notice={notice}
      onSignOut={onSignOut}
    >
      {page}
    </AppShell>
  );
}