export const isShop = (role) => role === "spaza_owner";

export const tabsForRole = (role) =>
  role === "supplier"
    ? ["Overview", "Available auctions", "My bids"]
    : isShop(role)
      ? ["Overview", "Stock requests", "Orders"]
      : role === "admin"
        ? ["Overview", "Buying groups", "Stock requests", "Auctions", "Orders"]
        : ["Overview", "Stock requests", "Auctions", "Orders"];

export const tabIcon = {
  Overview: "◫",
  "Buying groups": "◎",
  "Stock requests": "▤",
  Auctions: "⇄",
  Orders: "▣",
  "Available auctions": "⇄",
  "My bids": "◧",
};

export const pageCopy = (role, tab) => {
  if (role === "supplier") {
    const title =
      tab === "Overview"
        ? "Supplier workspace"
        : tab === "Available auctions"
          ? "Available auctions"
          : "My bids";
    return { eyebrow: "SUPPLIER PORTAL", title };
  }

  if (role === "admin")
    return {
      eyebrow: "SUPPLYX COORDINATION",
      title: tab === "Overview" ? "Coordinator workspace" : tab,
    };

  return {
    eyebrow: "INDEPENDENT SHOPS. SHARED OPPORTUNITY.",
    title: tab === "Overview" ? "Shop workspace" : tab,
  };
};

export const auctionState = (auction) =>
  auction.status === "awarded"
    ? "awarded"
    : Date.now() >= new Date(auction.closes_at).getTime()
      ? "closed"
      : auction.status;