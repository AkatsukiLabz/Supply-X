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
    [selected, setSelected] = useState([]);
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
  const open = data.auctions.filter((a) => a.status === "open").length;
  return (
    <div className="layout">
      <aside>
        <a className="brand" href="/">
          Supply<span>X</span>
          <i>COLLECTIVE COMMERCE</i>
        </a>
        <div className="workspace">YOUR WORKSPACE</div>
        <nav>
          {["Overview", "Stock requests", "Auctions", "Orders"].map((x, i) => (
            <button
              className={tab === x ? "active" : ""}
              key={x}
              onClick={() => setTab(x)}
            >
              <span>{["◫", "▤", "⇄", "▣"][i]}</span>
              {x}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="leaf">↗</div>
          <strong>
            Small shops.
            <br />
            Collective power.
          </strong>
          <p>Better buying starts with your community.</p>
        </div>
        <footer>
          Akatsuki Labs · SupplyX
          <br />
          Geekulcha 2026
        </footer>
      </aside>
      <main>
        <header>
          <span>
            WORKSPACE <b>/ {tab}</b>
          </span>
          <span className="local">
            ● {mode === "demo" ? "LOCAL DEMO" : "CONNECTED API"}
          </span>
        </header>
        <div className="content">
          <div className="heading">
            <div>
              <div className="eyebrow">
                INDEPENDENT SHOPS. SHARED OPPORTUNITY.
              </div>
              <h1>{tab === "Overview" ? "Let’s grow together." : tab}</h1>
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
          {tab === "Overview" && (
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
                    {" "}
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
                        Nearby requests become one auction. Supplier bids stay
                        private.
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
          {tab === "Stock requests" && (
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
          {tab === "Auctions" && (
            <>
              <div className="section-title">
                <h2>Shared demand, better possibilities</h2>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => act(async () => {}, "Updated auction status.")}
                >
                  Refresh
                </button>
              </div>
              <p>
                Each bid is the full delivered total in rand, including all
                charges. No payments are collected in this demo.
              </p>
              <div className="cards">
                {data.auctions.map((a) => {
                  const closed = Date.now() >= new Date(a.closes_at).getTime();
                  return (
                    <article key={a.id}>
                      <div className="card-top">
                        <span className="pill">
                          {a.status === "awarded"
                            ? "awarded"
                            : closed
                              ? "closed"
                              : a.status}
                        </span>
                        <span>{a.area}</span>
                      </div>
                      <h2>{a.name}</h2>
                      <p>
                        {a.quantity} × {a.pack}
                      </p>
                      <p className="muted">
                        Closes {new Date(a.closes_at).toLocaleString()}
                      </p>
                      {a.bids.length > 0 && (
                        <p>
                          {user?.role === "supplier"
                            ? "Your bid"
                            : "Bids after close"}
                          :{" "}
                          {a.bids.map((b) => money(b.total_cents)).join(" · ")}
                        </p>
                      )}
                      {user?.role === "supplier" &&
                        a.status === "open" &&
                        !closed && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const totalCents = Math.round(
                                Number(
                                  new FormData(e.currentTarget).get("total"),
                                ) * 100,
                              );
                              act(
                                () =>
                                  api(`/auctions/${a.id}/bids`, { totalCents }),
                                "Your private bid is saved. You can revise it before closing.",
                              );
                            }}
                          >
                            <label>
                              Total delivered price (R)
                              <input
                                name="total"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="1000000"
                                required
                              />
                            </label>
                            <button disabled={busy}>Submit private bid</button>
                          </form>
                        )}
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
                          {closed
                            ? "Award lowest bid"
                            : "Waiting for bids to close"}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              {!data.auctions.length && (
                <p className="empty">
                  No auctions yet. The coordinator groups shop requests to open
                  one.
                </p>
              )}
            </>
          )}
          {tab === "Orders" && (
            <>
              <h2>From collective order to your doorstep</h2>
              <div className="cards">
                {data.orders.map((o) => (
                  <article key={o.id}>
                    <div className="card-top">
                      <span className="pill">{o.status}</span>
                      <span>{o.area}</span>
                    </div>
                    <h2>{o.name}</h2>
                    {o.total_cents !== undefined && (
                      <p>
                        Total delivered price{" "}
                        <strong>{money(o.total_cents)}</strong>
                      </p>
                    )}
                    {o.allocations.map((x) => (
                      <div className="allocation" key={x.request_id}>
                        <strong>{x.shop_name}</strong>
                        <p>
                          {x.quantity} × {o.pack} · {money(x.charge_cents)}
                        </p>
                        {x.received_at ? (
                          <span className="pill">Received</span>
                        ) : user?.role === "shop" &&
                          o.status === "dispatched" ? (
                          <button
                            disabled={busy}
                            onClick={() =>
                              act(
                                () =>
                                  api(
                                    `/allocations/${x.request_id}/receive`,
                                    {},
                                  ),
                                "Receipt confirmed for your shop.",
                              )
                            }
                          >
                            Confirm receipt
                          </button>
                        ) : (
                          <small>
                            Awaiting{" "}
                            {o.status === "confirmed" ? "dispatch" : "receipt"}
                          </small>
                        )}
                      </div>
                    ))}
                    {user?.role === "supplier" && o.status === "confirmed" && (
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
              {!data.orders.length && (
                <p className="empty">
                  Awarded auctions will appear here as orders.
                </p>
              )}
            </>
          )}
          <div className="bottom-note">
            LOCAL PROTOTYPE · Sample prices · No real payments · Area matching
            uses an exact service-area name
          </div>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Root />);