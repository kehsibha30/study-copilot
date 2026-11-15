"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      const next = new URLSearchParams(window.location.search).get("next");
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That did not work. Try again.");
      window.location.href = data.next ?? "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work. Try again.");
      setBusy(false);
    }
  }

  return (
    <form className="signin stack" onSubmit={signIn}>
      <div className="brand" style={{ marginBottom: 8 }}>
        <span className="mark" aria-hidden="true">S</span>
        Study copilot
      </div>
      <h1>Sign in</h1>
      <p className="lede" style={{ marginTop: 0 }}>Enter the family password. This device will stay signed in for 90 days.</p>
      <input
        type="password"
        autoComplete="current-password"
        autoFocus
        aria-label="Family password"
        placeholder="Family password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn" type="submit" disabled={!password || busy} aria-busy={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
