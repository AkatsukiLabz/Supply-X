import React from "react";
import { roleLabel } from "../auth.js";
import { pageCopy, tabIcon } from "../utils/navigation.js";

export default function AppShell({
  user,
  mode,
  tabs,
  activeTab,
  setTab,
  error,
  notice,
  onSignOut,
  children,
}) {
  const copy = pageCopy(user?.role, activeTab);

  return (
    <div className="layout">
      <aside>
        <a className="brand" href="/">
          Supply<span>X</span>
          <i>COLLECTIVE COMMERCE</i>
        </a>
        <div className="workspace">YOUR WORKSPACE</div>
        <nav>
          {tabs.map((tab) => (
            <button
              className={activeTab === tab ? "active" : ""}
              key={tab}
              onClick={() => setTab(tab)}
            >
              <span>{tabIcon[tab]}</span>
              {tab}
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
                  ? `${user.name} · ${user.area || ""}`
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

          {children}

          <div className="bottom-note">
            {user?.role === "supplier"
              ? "LOCAL PROTOTYPE · No real payments · Area matching uses exact names"
              : "LOCAL PROTOTYPE · Demo wallet · No real money movement · Area matching uses an exact service-area name"}
          </div>
        </div>
      </main>
    </div>
  );
}
