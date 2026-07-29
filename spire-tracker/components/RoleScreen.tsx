"use client";

export default function RoleScreen({
  brokers,
  onSelectBroker,
  onSelectOps,
}: {
  brokers: string[];
  onSelectBroker: (name: string) => void;
  onSelectOps: () => void;
}) {
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
        <div
          className="rolecard"
          style={{ display: "inline-block", background: "var(--charcoal)", color: "#fff" }}
          onClick={onSelectOps}
        >
          Ops Manager
        </div>
      </div>
    </div>
  );
}
