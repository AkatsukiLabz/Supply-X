import React, { useEffect, useState } from "react";
import {
  ROLES,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  getMode,
  signIn,
  saveSession,
  requestPasswordReset,
  roleLabel,
} from "./auth.js";
import "./login.css";

export default function Login({ onSignIn, onShowSignup }) {
  const [mode, setMode] = useState("");
  const [role, setRole] = useState("shop");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getMode()
      .then(setMode)
      .catch((e) => setError(e.message));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const session = await signIn({ email, password, role, mode });
      saveSession(session, remember);
      onSignIn(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    setError("");
    setNotice("");
    try {
      setNotice(await requestPasswordReset(email, mode));
    } catch (err) {
      setError(err.message);
    }
  }

  function fillDemo(account) {
    setRole(account.role);
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setError("");
    setNotice("");
  }

  const current = ROLES.find((r) => r.value === role);

  return (
    <div className="login">
      <section className="login-brand">
        <a className="brand login-logo" href="/">
          Supply<span>X</span>
          <i>COLLECTIVE COMMERCE</i>
        </a>
        <div className="login-pitch">
          <span className="login-tag">BUY TOGETHER, GROW TOGETHER</span>
          <h2>
            Small shops.
            <br />
            Collective power.
          </h2>
          <p>
            Pool demand with nearby shops, let suppliers compete, and keep your
            business independent.
          </p>
          <ul>
            <li>
              <b>01</b> Shops request stock
            </li>
            <li>
              <b>02</b> Requests become one auction
            </li>
            <li>
              <b>03</b> Suppliers bid, everyone saves
            </li>
          </ul>
        </div>
        <small className="login-foot">Akatsuki Labs · SupplyX · 2026</small>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <div className="eyebrow">WELCOME BACK</div>
          <h1>Sign in to SupplyX</h1>
          <p className="login-sub">Choose your account type to continue.</p>

          <div
            className="role-picker"
            role="radiogroup"
            aria-label="Account type"
          >
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.value}
                role="radio"
                aria-checked={role === r.value}
                className={role === r.value ? "selected" : ""}
                onClick={() => {
                  setRole(r.value);
                  setError("");
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="role-hint">{current.hint}</p>

          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              placeholder="you@business.co.za"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            <span className="label-row">
              Password
              <button type="button" className="link" onClick={handleForgot}>
                Forgot password?
              </button>
            </span>
            <span className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>

          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Keep me signed in on this device
          </label>

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

          <button className="login-submit" disabled={busy || !mode}>
            {busy ? "Signing in…" : `Sign in as ${current.label}`}
          </button>

        <p className="login-help">
            New to SupplyX?{" "}
            <button type="button" className="link" onClick={onShowSignup}>
              Create an account
            </button>
          </p>

          {mode === "demo" && (
            <div className="demo-box">
              <strong>Local demo accounts</strong>
              <small>
                Click one to fill the form. Password for all:{" "}
                <code>{DEMO_PASSWORD}</code>
              </small>
              <ul>
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.email}>
                    <button type="button" onClick={() => fillDemo(a)}>
                      <span>{a.name}</span>
                      <em>{roleLabel(a.role)}</em>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}