import { DEMO_ACCOUNTS } from "../auth.js";

const products = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    name: "Maize meal",
    pack: "10 kg bag",
    reference_cents: 12500,
    reference_source: "Illustrative demo price",
    reference_date: "2026-09-18",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    name: "Cooking oil",
    pack: "6 x 750 ml case",
    reference_cents: 18000,
    reference_source: "Illustrative demo price",
    reference_date: "2026-09-18",
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    name: "Sugar",
    pack: "10 x 1 kg case",
    reference_cents: 21000,
    reference_source: "Illustrative demo price",
    reference_date: "2026-09-18",
  },
];

const initialRequests = [
  {
    id: "static-request-1",
    shop_id: DEMO_ACCOUNTS[0].id,
    shop_name: DEMO_ACCOUNTS[0].name,
    product_id: products[0].id,
    name: products[0].name,
    pack: products[0].pack,
    quantity: 18,
    area: "Centurion",
    status: "submitted",
  },
  {
    id: "static-request-2",
    shop_id: DEMO_ACCOUNTS[1].id,
    shop_name: DEMO_ACCOUNTS[1].name,
    product_id: products[0].id,
    name: products[0].name,
    pack: products[0].pack,
    quantity: 12,
    area: "Centurion",
    status: "submitted",
  },
];

const initialAuctions = [
  {
    id: "static-auction-1",
    name: "Maize meal",
    pack: "10 kg bag",
    product_id: products[0].id,
    quantity: 30,
    area: "Centurion",
    status: "open",
    closes_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    retail_benchmark_cents: 375000,
    bids: [],
  },
];

const state = {
  requests: [...initialRequests],
  auctions: [...initialAuctions],
  orders: [],
};

const userFromSession = (session) => ({
  ...session.user,
  role: session.user.role === "shop" ? "spaza_owner" : session.user.role,
});

const visibleRequests = (user) => {
  if (user.role === "admin") return state.requests;
  if (user.role === "spaza_owner")
    return state.requests.filter((request) => request.shop_id === user.id);
  return [];
};

const visibleAuctions = (user) => {
  if (user.role === "supplier")
    return state.auctions.map((auction) => ({
      ...auction,
      bids: auction.bids.filter((bid) => bid.supplier_id === user.id),
    }));
  if (user.role === "admin")
    return state.auctions.map((auction) => ({
      ...auction,
      bids:
        auction.status === "open"
          ? []
          : auction.bids.map(({ total_cents }) => ({ total_cents })),
    }));
  return state.auctions.map((auction) => ({ ...auction, bids: [] }));
};

const visibleOrders = (user) => {
  if (user.role === "admin") return state.orders;
  if (user.role === "supplier")
    return state.orders.filter((order) => order.supplier_id === user.id);
  if (user.role === "spaza_owner")
    return state.orders
      .filter((order) =>
        order.allocations.some((allocation) => allocation.shop_id === user.id),
      )
      .map((order) => ({
        ...order,
        total_cents: undefined,
        supplier_fee_cents: undefined,
        supplier_payout_cents: undefined,
        allocations: order.allocations.filter(
          (allocation) => allocation.shop_id === user.id,
        ),
      }));
  return [];
};

const groups = () => [
  {
    key: "static-group-maize-centurion",
    code: "BG-DEMO01",
    name: "Maize meal - Centurion",
    product: "Maize meal",
    pack: "10 kg bag",
    shopCount: 2,
    totalQuantity: 30,
    contributionCents: 375000,
    status: "Ready for Bidding",
    shops: initialRequests.map((request) => ({
      shopId: request.shop_id,
      shopName: request.shop_name,
      quantity: request.quantity,
      contributionCents: request.quantity * 12500,
    })),
  },
];

const makeOrder = (auction, winningBid) => ({
  id: `static-order-${auction.id}`,
  auction_id: auction.id,
  supplier_id: winningBid.supplier_id,
  name: auction.name,
  pack: auction.pack,
  area: auction.area,
  status: "submitted",
  total_cents: winningBid.total_cents,
  supplier_fee_cents: Math.round(winningBid.total_cents * 0.1),
  supplier_payout_cents:
    winningBid.total_cents - Math.round(winningBid.total_cents * 0.1),
  allocations: initialRequests.map((request, index) => {
    const previous = initialRequests.slice(0, index).reduce((sum, item) => {
      return sum + Math.floor((item.quantity / auction.quantity) * winningBid.total_cents);
    }, 0);
    const charge =
      index === initialRequests.length - 1
        ? winningBid.total_cents - previous
        : Math.floor((request.quantity / auction.quantity) * winningBid.total_cents);
    return {
      request_id: request.id,
      shop_id: request.shop_id,
      shop_name: request.shop_name,
      quantity: request.quantity,
      charge_cents: charge,
      savings_cents: request.quantity * 12500 - charge,
      received_at: null,
    };
  }),
});

export async function staticDemoApi(path, body, session) {
  const user = userFromSession(session);

  if (path === "/me") return user;
  if (path === "/products") return products;
  if (path === "/requests" && body) {
    const product = products.find((item) => item.id === body.productId);
    const request = {
      id: `static-request-${Date.now()}`,
      shop_id: user.id,
      shop_name: user.name,
      product_id: product.id,
      name: product.name,
      pack: product.pack,
      quantity: body.quantity,
      area: user.area || "Centurion",
      status: "submitted",
    };
    state.requests.unshift(request);
    return request;
  }
  if (path === "/requests") return visibleRequests(user);
  if (path === "/auctions") return visibleAuctions(user);
  if (path === "/orders") return visibleOrders(user);
  if (path === "/groups") return groups();

  const bidMatch = path.match(/^\/auctions\/(.+)\/bids$/);
  if (bidMatch && body) {
    const auction = state.auctions.find((item) => item.id === bidMatch[1]);
    if (!auction) throw Error("Auction not found.");
    if (auction.bids.some((bid) => bid.supplier_id === user.id))
      throw Error("You already submitted a bid for this auction.");
    const bid = { supplier_id: user.id, total_cents: body.totalCents };
    auction.bids.push(bid);
    return bid;
  }

  const awardMatch = path.match(/^\/auctions\/(.+)\/award$/);
  if (awardMatch) {
    const auction = state.auctions.find((item) => item.id === awardMatch[1]);
    if (!auction) throw Error("Auction not found.");
    if (!auction.bids.length) throw Error("No supplier bids have been submitted.");
    auction.status = "awarded";
    const winningBid = [...auction.bids].sort(
      (a, b) => a.total_cents - b.total_cents,
    )[0];
    const existing = state.orders.find((order) => order.auction_id === auction.id);
    if (existing) return existing;
    const order = makeOrder(auction, winningBid);
    state.orders.unshift(order);
    return order;
  }

  const dispatchMatch = path.match(/^\/orders\/(.+)\/dispatch$/);
  if (dispatchMatch) {
    const order = state.orders.find((item) => item.id === dispatchMatch[1]);
    if (!order) throw Error("Order not found.");
    order.status = "dispatched";
    return order;
  }

  const receiveMatch = path.match(/^\/allocations\/(.+)\/receive$/);
  if (receiveMatch) {
    const order = state.orders.find((item) =>
      item.allocations.some((allocation) => allocation.request_id === receiveMatch[1]),
    );
    if (!order) throw Error("Allocation not found.");
    const allocation = order.allocations.find(
      (item) => item.request_id === receiveMatch[1],
    );
    allocation.received_at = new Date().toISOString();
    if (order.allocations.every((item) => item.received_at))
      order.status = "completed";
    return order;
  }

  throw Error("This static demo action is not available.");
}
