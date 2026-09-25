import React, { useEffect, useState } from "react";
import {
  AREAS,
  SIGNUP_ROLES,
  getMode,
  signUp,
  validateSignup,
} from "./auth.js";
import "./login.css";

const EMPTY = {
  role: "spaza_owner",
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  area: "",
  password: "",
  confirm: "",
  agree: false,
};

export default function Signup({ onShowLogin }) {
  const [mode, setMode] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    getMode()
      .then(setMode)
      .catch((e) => setError(e.message));
  }, []);

  const set = (name) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((x) => ({ ...x, [name]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const found = validateSignup(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      setDone(await signUp(form, mode));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isShop = form.role === "spaza_owner";
  const field = (name) => (errors[name] ? "invalid" : "");
  const hint = (name) =>
    errors[name] && <span className="field-error">{errors[name]}</span>;

  return (
    <div className="login">
      <section className="login-brand">
        <a className="brand login-logo" href="/">
          Supply<span>X</span>
          <i>COLLECTIVE COMMERCE</i>
        </a>
        <div className="login-pitch">
          <span className="login-tag">JOIN THE COLLECTIVE</span>
          <h2>
            Stronger together.
            <br />
            Starting today.
          </h2>
          <p>
            Shops get better prices by buying together. Suppliers get bigger,
            simpler orders from one place.
          </p>
          <ul>
            <li>
              <b>01</b> Tell us about your business
            </li>
            <li>
              <b>02</b> Confirm your email address
            </li>
            <li>
              <b>03</b> The SupplyX team approves your account
            </li>
          </ul>
        </div>
        <small className="login-foot">Akatsuki Labs · SupplyX · 2026</small>
      </section>

      <section className="login-panel">
        {done ? (
          <div className="login-card signup-done">
            <div className="done-icon">✓</div>
            <div className="eyebrow">APPLICATION RECEIVED</div>
            <h1>Thanks, {form.contactName.trim().split(" ")[0]}!</h1>
            {done.demo ? (
              <div className="message">
                This is the local demo, so no account was saved. Real sign up
                works once the team connects Supabase. For now, sign in with a
                demo account.
              </div>
            ) : (
              <p>
                We sent a confirmation link to <strong>{done.email}</strong>.
                Click it to confirm your email. The SupplyX team will then check
                your details and activate your {isShop ? "shop" : "supplier"}{" "}
                account.
              </p>
            )}
            <button className="login-submit" onClick={onShowLogin}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form className="login-card" onSubmit={handleSubmit} noValidate>
            <div className="eyebrow">CREATE YOUR ACCOUNT</div>
            <h1>Join SupplyX</h1>
            <p className="login-sub">What kind of business are you?</p>

            <div
              className="role-picker two"
              role="radiogroup"
              aria-label="Account type"
            >
              {SIGNUP_ROLES.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  role="radio"
                  aria-checked={form.role === r.value}
                  className={form.role === r.value ? "selected" : ""}
                  onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="role-hint">
              {isShop
                ? "Request stock and buy together with nearby shops."
                : "Bid on combined orders from shops in your area."}
            </p>

            <label>
              {isShop ? "Shop name" : "Company name"}
              <input
                className={field("businessName")}
                autoComplete="organization"
                placeholder={
                  isShop ? "e.g. Mosh’s Mini Market" : "e.g. Ubuntu Wholesale"
                }
                value={form.businessName}
                onChange={set("businessName")}
              />
              {hint("businessName")}
            </label>

            <label>
              Your full name
              <input
                className={field("contactName")}
                autoComplete="name"
                placeholder="First and last name"
                value={form.contactName}
                onChange={set("contactName")}
              />
              {hint("contactName")}
            </label>

            <div className="field-row">
              <label>
                Email address
                <input
                  className={field("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="you@business.co.za"
                  value={form.email}
                  onChange={set("email")}
                />
                {hint("email")}
              </label>
              <label>
                Mobile number
                <input
                  className={field("phone")}
                  type="tel"
                  autoComplete="tel"
                  placeholder="082 123 4567"
                  value={form.phone}
                  onChange={set("phone")}
                />
                {hint("phone")}
              </label>
            </div>

            <label>
              {isShop ? "Where is your shop?" : "Area you deliver to"}
              <select
                className={field("area")}
                value={form.area}
                onChange={set("area")}
              >
                <option value="">Choose an area</option>
                {AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
              {hint("area")}
            </label>

            <div className="field-row">
              <label>
                Password
                <span className="password-field">
                  <input
                    className={field("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={form.password}
                    onChange={set("password")}
                  />
                  <button
                    type="button"
                    className="toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
                {hint("password")}
              </label>
              <label>
                Confirm password
                <input
                  className={field("confirm")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Type it again"
                  value={form.confirm}
                  onChange={set("confirm")}
                />
                {hint("confirm")}
              </label>
            </div>

            <label className="remember">
              <input
                type="checkbox"
                checked={form.agree}
                onChange={set("agree")}
              />
              I agree to the SupplyX terms and privacy policy
            </label>
            {hint("agree")}

            {error && (
              <div role="alert" className="message error">
                {error}
              </div>
            )}

            <button className="login-submit" disabled={busy || !mode}>
              {busy ? "Creating account…" : "Create account"}
            </button>

            <p className="login-help">
              Already have an account?{" "}
              <button type="button" className="link" onClick={onShowLogin}>
                Sign in
              </button>
            </p>
          </form>
        )}
      </section>
    </div>
  );
}