"use client";
import { useState } from "react";

export default function RoleScreen({
  brokers,
  onSelectBroker,
  onSelectOps,
  onSelectResources,
}: {
  brokers: string[];
  onSelectBroker: (name: string) => void;
  onSelectOps: () => void;
  onSelectResources: () => void;
}) {
  const [showOpsPrompt, setShowOpsPrompt] = useState(false);
  const [opsPassword, setOpsPassword] = useState("");
  const [opsError, setOpsError] = useState("");
  const [checking, setChecking] = useState(false);

  async function submitOpsPassword(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setOpsError("");
    try {
      const res = await fetch("/api/login-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: opsPassword }),
      });
      if (res.ok) {
        onSelectOps();
      } else {
        const data = await res.json().catch(() => ({}));
        setOpsError(data.error || "Incorrect password");
      }
    } catch {
      setOpsError("Something went wrong. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="app-shell" style={{ maxWidth: 640, paddingTop: 80, textAlign: "center" }}>
      <div className="brandmark" style={{ fontSize: 30 }}>
        Spire Pipeline Tracker
      </div>
      <h1 style={{ marginTop: 6 }}>Who&apos;s checking in?</h1>
      <p className="muted" style={{ marginTop: 6 }}>
        Pick your name to log today&apos;s activity, or open the ops manager view.
      </p>
      <div className="rolegrid">
        {brokers.length ? (
          brokers.map((b) => (
            <div key={b} className="rolecard" onClick={() => onSelectBroker(b)}>
              {b}
            </div>
          ))
        ) : (
          <span className="muted">No brokers added yet — open Ops Manager to add the team.</span>
        )}
      </div>
      <div style={{ margin: "26px 0 10px", borderTop: "1px solid var(--lbg)", paddingTop: 20 }}>
        {!showOpsPrompt ? (
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <div
              className="rolecard"
              style={{ background: "var(--charcoal)", color: "#fff" }}
              onClick={() => setShowOpsPrompt(true)}
            >
              Ops Manager
            </div>
            <div className="rolecard" onClick={onSelectResources}>
              Resources
            </div>
          </div>
        ) : (
          <form onSubmit={submitOpsPassword} style={{ maxWidth: 300, margin: "0 auto", textAlign: "left" }}>
            <div className="field">
              <label>Ops manager password</label>
              <input
                type="password"
                value={opsPassword}
                onChange={(e) => setOpsPassword(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn secondary" type="button" onClick={() => { setShowOpsPrompt(false); setOpsPassword(""); setOpsError(""); }}>
                Cancel
              </button>
              <button className="btn" type="submit" disabled={checking} style={{ flex: 1 }}>
                {checking ? "Checking…" : "Enter"}
              </button>
            </div>
            {opsError && <div className="login-error">{opsError}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
