import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import { loadSession, clearSession, authHeaders, roleLabel } from "./auth.js";
const money = (c) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    c / 100,
  );

const parseRandCents = (value) => {
  const normalized = String(value).replace(/[^0-9,.]/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

const dateTimeNoSeconds = (value) =>
  new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));

const tabsForRole = (role) =>
  role === "supplier"
    ? ["Overview", "Available auctions", "My bids"]
    : ["Overview", "Stock requests", "Auctions", "Orders"];

const tabIcon = {
  Overview: "◫",
  "Stock requests": "▤",
  Auctions: "⇄",
  Orders: "▣",
  "Available auctions": "⇄",
  "My bids": "◧",
};

const pageCopy = (role, tab) => {
  if (role === "supplier") {
    const title =
      tab === "Overview"
        ? "Supplier workspace"
        : tab === "Available auctions"
          ? "Available auctions"
          : "My bids";
    return { eyebrow: "SUPPLIER PORTAL", title };
  }
  return {
    eyebrow: "INDEPENDENT SHOPS. SHARED OPPORTUNITY.",
    title: tab === "Overview" ? "Let’s grow together." : tab,
  };
};

const auctionState = (auction) =>
  auction.status === "awarded"
    ? "awarded"
    : Date.now() >= new Date(auction.closes_at).getTime()
      ? "closed"
      : auction.status;
function Root() {
  const [session, setSession] = useState(() => loadSession());
  const [page, setPage] = useState("login");
  const signOut = () => {
    clearSession();
    setSession(null);
  };
  if (!session)
    return page === "signup" ? (
      <Signup onShowLogin={() => setPage("login")} />
    ) : (
      <Login onSignIn={setSession} onShowSignup={() => setPage("signup")} />
    );
  return <App session={session} onSignOut={signOut} />;
}
function App({ session, onSignOut }) {
  const user = session.user,
    userId = user.id,
    mode = session.mode;
  const [data, setData] = useState({
      products: [],
      requests: [],
      auctions: [],
      orders: [],
    }),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("Overview"),
    [selected, setSelected] = useState([]),
    [selectedAuctionId, setSelectedAuctionId] = useState(null),
    [, setClockTick] = useState(() => Date.now());
  const api = async (path, body) => {
    const r = await fetch("/api" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(session) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    // Session expired or account removed: go back to the login screen.
    if (r.status === 401) {
      onSignOut();
      throw Error("Your session has ended. Please sign in again.");
    }
    const result = await r.json();
    if (!r.ok)
      throw Error(
        result.error +
          (result.details
            ? " — " + result.details.map((x) => x.message).join(", ")
            : ""),
      );
    return result;
  };
  async function load() {
    if (user?.role === "supplier") {
      const [auctions, orders] = await Promise.all(
        ["/auctions", "/orders"].map((p) => api(p)),
      );
      return { products: [], requests: [], auctions, orders };
    }
    const [products, requests, auctions, orders] = await Promise.all(
      ["/products", "/requests", "/auctions", "/orders"].map((p) => api(p)),
    );
    return { products, requests, auctions, orders };
  }
  useEffect(() => {
    let active = true;
    setSelected([]);
    setData({ products: [], requests: [], auctions: [], orders: [] });
    setError("");
    if (userId) {
      setBusy(true);
      load()
        .then((x) => {
          if (active) setData(x);
        })
        .catch((e) => {
          if (active) setError(e.message);
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
    } catch (e) {
      setError(e.message);
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
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const tabs = tabsForRole(user?.role);
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const copy = pageCopy(user?.role, activeTab);
  const open = data.auctions.filter((a) => auctionState(a) === "open").length;
  const supplierBids = data.auctions.filter((a) => a.bids.length > 0);
  const supplierWonOrders = data.orders;
  const wonAuctionIds = new Set(data.orders.map((order) => order.auction_id));
  const pendingSupplierOrders = data.orders.filter(
    (order) => order.status === "submitted",
  );
  const dispatchedSupplierOrders = data.orders.filter(
    (order) => order.status !== "submitted",
  );
  const availableSupplierAuctions = data.auctions.filter(
    (auction) => auctionState(auction) === "open" && auction.bids.length === 0,
  );
  const shownAuctions = data.auctions.filter((a) => {
    if (activeTab === "My bids") return a.bids.length > 0;
    if (activeTab === "Available auctions")
      return availableSupplierAuctions.some((auction) => auction.id === a.id);
    return true;
  });
  const bidResult = (auction) => {
    if (!auction.bids.length) return null;
    if (wonAuctionIds.has(auction.id)) return "won";
    if (auctionState(auction) === "awarded") return "lost";
    return null;
  };
  const renderAuctionCards = (auctions) => (
    <div className="cards">
      {auctions.map((a) => {
        const state = auctionState(a);
        const closed = state === "closed" || state === "awarded";
        return (
          <article key={a.id}>
            <div className="card-top">
              <span className="pill">{state}</span>
              <span>{a.area}</span>
            </div>
            <h2>{a.name}</h2>
            {user?.role === "supplier" && state === "open" ? (
              <div className="opportunity-summary">
                <div>
                  <span>Total quantity</span>
                  <strong>
                    {a.quantity} × {a.pack}
                  </strong>
                </div>
                <div>
                  <span>Area</span>
                  <strong>{a.area || "Your service area"}</strong>
                </div>
                <div>
                  <span>Closes</span>
                  <strong>{dateTimeNoSeconds(a.closes_at)}</strong>
                </div>
                {a.retail_benchmark_cents > 0 && (
                  <div>
                    <span>Retail benchmark</span>
                    <strong>{money(a.retail_benchmark_cents)}</strong>
                  </div>
                )}
              </div>
            ) : (
              <>
                <p>
                  {a.quantity} × {a.pack}
                </p>
                <p className="muted auction-time">
                  {state === "open" ? "Closes" : "Closed"} {dateTimeNoSeconds(a.closes_at)}
                </p>
              </>
            )}
            {user?.role === "supplier" && state === "open" && (
              <p className="opportunity-fit">
                Matches your service area. Submit a delivered total below the retail benchmark to stay competitive.
              </p>
            )}
            {a.bids.length > 0 && (
              <>
                <p>
                  {user?.role === "supplier" ? "Your bid" : "Bids after close"}: {" "}
                  {a.bids.map((b) => money(b.total_cents)).join(" · ")}
                </p>
                {activeTab === "My bids" && bidResult(a) && (
                  <span className={`result-pill ${bidResult(a)}`}>
                    {bidResult(a) === "won" ? "Won" : "Lost"}
                  </span>
                )}
              </>
            )}
            {user?.role === "supplier" &&
              a.status === "open" &&
              !closed &&
              a.bids.length === 0 &&
              (selectedAuctionId === a.id ? (
                <form
                  className="bid-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const totalCents = parseRandCents(
                      new FormData(e.currentTarget).get("total"),
                    );
                    submitSupplierBid(a.id, totalCents);
                  }}
                >
                  <div className="bid-guidance">
                    <strong>Before you bid</strong>
                    <ul>
                      <li>Your price must include delivery and all supplier charges.</li>
                      {a.retail_benchmark_cents > 0 && (
                        <li>Keep your delivered total below {money(a.retail_benchmark_cents)} to qualify.</li>
                      )}
                      <li>Competitors cannot see your bid while bidding is open.</li>
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
                  onClick={() => setSelectedAuctionId(a.id)}
                >
                  Participate in auction
                </button>
              ))}
            {user?.role === "admin" && a.status === "open" && (
              <button
                disabled={busy || !closed}
                onClick={() =>
                  act(
                    () => api(`/auctions/${a.id}/award`, {}),
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

  const renderOrders = (orders) => (
    <div className="cards">
      {orders.map((o) => (
        <article key={o.id}>
          <div className="card-top">
            <span className="pill">{o.status}</span>
            <span>{o.area}</span>
          </div>
          <h2>{o.name}</h2>
          {o.total_cents !== undefined && (
            <p>
              Total delivered price <strong>{money(o.total_cents)}</strong>
            </p>
          )}
          {user?.role === "supplier" &&
            o.supplier_payout_cents !== undefined && (
              <p className="muted">
                Supplier payout after SupplyX fee: {" "}
                <strong>{money(o.supplier_payout_cents)}</strong>
              </p>
            )}
          {user?.role === "admin" && o.supplier_fee_cents !== undefined && (
            <p className="muted">
              SupplyX supplier fee: <strong>{money(o.supplier_fee_cents)}</strong>
            </p>
          )}
          {o.allocations.map((x) => (
            <div className="allocation" key={x.request_id}>
              <strong>{x.shop_name}</strong>
              <p>
                {x.quantity} × {o.pack} · {money(x.charge_cents)}
              </p>
              {user?.role !== "supplier" && x.savings_cents !== undefined && (
                <small className="allocation-note">
                  Shop saving: {money(x.savings_cents)}
                </small>
              )}
              {x.received_at ? (
                <span className="pill">Received</span>
              ) : user?.role === "shop" &&
                ["dispatched", "accepted"].includes(o.status) ? (
                <button
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => api(`/allocations/${x.request_id}/receive`, {}),
                      "Receipt confirmed for your shop.",
                    )
                  }
                >
                  Confirm receipt
                </button>
              ) : (
                <small className="allocation-note">
                  {o.status === "submitted"
                    ? user?.role === "supplier"
                      ? "You won this order. Prepare it for fulfilment."
                      : "Order awarded. Supplier is preparing fulfilment."
                    : o.status === "accepted"
                      ? user?.role === "supplier"
                        ? "Dispatched. Waiting for shop receipt."
                        : "Supplier dispatched. Awaiting receipt."
                      : o.status === "dispatched"
                        ? "Awaiting shop receipt."
                        : o.status === "completed"
                          ? "Order completed."
                          : "Order in progress."}
                </small>
              )}
            </div>
          ))}
          {user?.role === "supplier" && o.status === "submitted" && (
            <button
              disabled={busy}
              onClick={() =>
                act(
                  () => api(`/orders/${o.id}/dispatch`, {}),
                  "Dispatch recorded. Shops can confirm receipt.",
                )
              }
            >
              Mark dispatched
            </button>
          )}
        </article>
      ))}
    </div>
  );
  const renderSupplierOrderSections = () => (
    <>
      <div className="section-title split-heading">
        <h2>Needs dispatch</h2>
        <span>{pendingSupplierOrders.length} orders</span>
      </div>
      {pendingSupplierOrders.length ? (
        renderOrders(pendingSupplierOrders)
      ) : (
        <p className="empty">No won orders waiting for dispatch.</p>
      )}
      <div className="section-title split-heading">
        <h2>Dispatched / waiting for receipt</h2>
        <span>{dispatchedSupplierOrders.length} orders</span>
      </div>
      {dispatchedSupplierOrders.length ? (
        renderOrders(dispatchedSupplierOrders)
      ) : (
        <p className="empty">No dispatched orders yet.</p>
      )}
    </>
  );
  return (
    <div className="layout">
      <aside>
        <a className="brand" href="/">
          Supply<span>X</span>
          <i>COLLECTIVE COMMERCE</i>
        </a>
        <div className="workspace">YOUR WORKSPACE</div>
        <nav>
          {tabs.map((x) => (
            <button
              className={activeTab === x ? "active" : ""}
              key={x}
              onClick={() => setTab(x)}
            >
              <span>{tabIcon[x]}</span>
              {x}
            </button>
          ))}
        </nav>
        {user?.role !== "supplier" && (
          <div className="sidebar-note">
            <div className="leaf">↗</div>
            <strong>
              Small shops.
              <br />
              Collective power.
            </strong>
            <p>Better buying starts with your community.</p>
          </div>
        )}
        <footer>
          Akatsuki Labs · SupplyX
          <br />
          Geekulcha 2026
        </footer>
      </aside>
      <main>
        <header>
          <span>
            WORKSPACE <b>/ {activeTab}</b>
          </span>
          <span className="local">
            ● {mode === "demo" ? "LOCAL DEMO" : "CONNECTED API"}
          </span>
        </header>
        <div className="content">
          <div className="heading">
            <div>
              <div className="eyebrow">{copy.eyebrow}</div>
              <h1>{copy.title}</h1>
              <p>
                {user
                  ? `${user.name} · ${user.area}`
                  : "Connect to your SupplyX workspace."}
              </p>
            </div>
            <div className="signed-in">
              <div className="who">
                <strong>{user.name}</strong>
                <small>{roleLabel(user.role)} account</small>
              </div>
              <button className="secondary" onClick={onSignOut}>
                Sign out
              </button>
            </div>
          </div>
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
          {activeTab === "Overview" && (
            <>
              {user?.role === "supplier" ? (
                <>
                  {pendingSupplierOrders.length > 0 ? (
                    <section className="supplier-dashboard-grid">
                      <div className="dashboard-main">
                        <div className="section-title split-heading">
                          <h2>Needs dispatch</h2>
                          <span>{pendingSupplierOrders.length} orders</span>
                        </div>
                        {renderOrders(pendingSupplierOrders)}
                      </div>
                      <aside className="dashboard-side">
                        <div className="section-title split-heading">
                          <h2>Open auctions</h2>
                          <span>{availableSupplierAuctions.length} open</span>
                        </div>
                        {availableSupplierAuctions.length ? (
                          renderAuctionCards(availableSupplierAuctions)
                        ) : (
                          <p className="empty dashboard-empty">
                            There are no open auctions right now. Open auctions will show here, check back in a few.
                          </p>
                        )}
                      </aside>
                    </section>
                  ) : availableSupplierAuctions.length > 0 ? (
                    <section className="overview-opportunities">
                      <div className="section-title split-heading">
                        <h2>Open auctions</h2>
                        <span>{availableSupplierAuctions.length} open</span>
                      </div>
                      {renderAuctionCards(availableSupplierAuctions)}
                    </section>
                  ) : (
                    <section className="supplier-empty-state">
                      <div className="empty-icon">SX</div>
                      <div>
                        <p className="empty-kicker">No live opportunities</p>
                        <h2>No open auctions right now.</h2>
                        <p>
                          New supplier opportunities will appear here once nearby
                          shop demand is ready for bidding. Check back shortly.
                        </p>
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <>
                  <section className="hero">
                    <div>
                      <span className="tag">BUY TOGETHER, GROW TOGETHER</span>
                      <h2>
                        Your next stock run.
                        <br />A stronger deal.
                      </h2>
                      <p>
                        Pool demand with nearby shops. Let suppliers compete.
                        <br />
                        Keep your business independent.
                      </p>
                      <button
                        onClick={() =>
                          setTab(
                            user?.role === "shop" ? "Stock requests" : "Auctions",
                          )
                        }
                      >
                        {user?.role === "shop"
                          ? "Request stock"
                          : "Explore auctions"}{" "}
                        <span>↗</span>
                      </button>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="circle c1"></div>
                      <div className="circle c2"></div>
                      <div className="box">SX</div>
                      <small>
                        LOCAL BUSINESSES
                        <br />
                        BIGGER POSSIBILITIES
                      </small>
                    </div>
                  </section>
                  <section className="stats">
                    {[
                      [data.requests.length, "Visible stock requests"],
                      [open, "Open auctions"],
                      [data.orders.length, "Your workspace orders"],
                    ].map(([v, l]) => (
                      <article key={l}>
                        <span>{l}</span>
                        <strong>{String(v).padStart(2, "0")}</strong>
                      </article>
                    ))}
                  </section>
                  <section className="intro">
                    <div>
                      <span className="eyebrow">HOW IT WORKS</span>
                      <h2>
                        One community.
                        <br />
                        More buying power.
                      </h2>
                    </div>
                    <ol>
                      <li>
                        <b>01</b>
                        <div>
                          <strong>Tell us what you need</strong>
                          <p>Choose a product and the number of packs.</p>
                        </div>
                      </li>
                      <li>
                        <b>02</b>
                        <div>
                          <strong>Combine. Compare. Confirm.</strong>
                          <p>
                            Nearby requests become one auction. Supplier bids
                            stay private.
                          </p>
                        </div>
                      </li>
                      <li>
                        <b>03</b>
                        <div>
                          <strong>Track your share</strong>
                          <p>
                            See your allocated cost and confirm when your stock
                            arrives.
                          </p>
                        </div>
                      </li>
                    </ol>
                  </section>
                </>
              )}
            </>
          )}
          {activeTab === "Stock requests" && (
            <>
              <div className="section-title">
                <h2>Stock for your next chapter</h2>
                <span>{data.products.length} products</span>
              </div>
              {user?.role === "shop" && (
                <div className="products">
                  {data.products.map((p) => (
                    <article key={p.id}>
                      <div className="product-icon">▧</div>
                      <h3>{p.name}</h3>
                      <p>{p.pack}</p>
                      <small>
                        Sample reference: {money(p.reference_cents)} / pack
                      </small>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const quantity = Number(
                            new FormData(e.currentTarget).get("quantity"),
                          );
                          act(
                            () =>
                              api("/requests", { productId: p.id, quantity }),
                            "Stock request submitted. A coordinator can now group it with nearby demand.",
                          );
                        }}
                      >
                        <label>
                          Packs
                          <input
                            name="quantity"
                            aria-label={`Packs of ${p.name}`}
                            type="number"
                            min="1"
                            max="10000"
                            defaultValue="5"
                            required
                          />
                        </label>
                        <button disabled={busy}>Request stock</button>
                      </form>
                    </article>
                  ))}
                </div>
              )}
              <h2>Submitted requests</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {user?.role === "admin" && <th>Select</th>}
                      <th>Product</th>
                      <th>Packs</th>
                      <th>Area</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.requests.map((r) => (
                      <tr key={r.id}>
                        {user?.role === "admin" && (
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select request ${r.id}`}
                              disabled={r.status !== "submitted" || busy}
                              checked={selected.includes(r.id)}
                              onChange={(e) =>
                                setSelected(
                                  e.target.checked
                                    ? [...selected, r.id]
                                    : selected.filter((id) => id !== r.id),
                                )
                              }
                            />
                          </td>
                        )}
                        <td>
                          {r.name}
                          <small>{r.pack}</small>
                        </td>
                        <td>{r.quantity}</td>
                        <td>{r.area}</td>
                        <td>
                          <span className="pill">{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.requests.length && (
                  <p className="empty">
                    No requests yet. Shop accounts can submit stock above.
                  </p>
                )}
              </div>
              {user?.role === "admin" && (
                <form
                  className="auction-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const minutes = Number(
                      new FormData(e.currentTarget).get("minutes"),
                    );
                    act(
                      () =>
                        api("/auctions", {
                          requestIds: selected,
                          closesAt: new Date(
                            Date.now() + minutes * 60000,
                          ).toISOString(),
                        }),
                      "Auction opened. Switch to a supplier account to place a private bid.",
                    );
                  }}
                >
                  <p>Select requests for the same product and area.</p>
                  <label>
                    Bidding window (minutes)
                    <input
                      name="minutes"
                      type="number"
                      min="1"
                      max="10080"
                      defaultValue="5"
                      required
                    />
                  </label>
                  <button disabled={busy || !selected.length}>
                    Open auction · {selected.length} selected
                  </button>
                </form>
              )}
            </>
          )}
          {(activeTab === "Auctions" || activeTab === "Available auctions" || activeTab === "My bids") && (
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
              {renderAuctionCards(shownAuctions)}
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
          )}
          {activeTab === "Orders" && (
            <>
              <h2>Orders</h2>
              {renderOrders(data.orders)}
              {!data.orders.length && (
                <p className="empty">
                  Awarded auctions will appear here as orders.
                </p>
              )}
            </>
          )}
          <div className="bottom-note">
            {user?.role === "supplier"
              ? "LOCAL PROTOTYPE · No real payments · Area matching uses exact names"
              : "LOCAL PROTOTYPE · Sample prices · No real payments · Area matching uses an exact service-area name"}
          </div>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Root />);