import React, { useState } from "react";
import App from "./App.jsx";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import { clearSession, loadSession } from "./auth.js";

export default function Root() {
  const [session, setSession] = useState(() => loadSession());
  const [page, setPage] = useState("login");

  const signOut = () => {
    clearSession();
    setSession(null);
  };

  if (!session) {
    return page === "signup" ? (
      <Signup onShowLogin={() => setPage("login")} />
    ) : (
      <Login onSignIn={setSession} onShowSignup={() => setPage("signup")} />
    );
  }

  return <App session={session} onSignOut={signOut} />;
}
