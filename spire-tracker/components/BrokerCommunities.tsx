"use client";
import { useState } from "react";
import { TrackerDB } from "@/lib/types";
import CommunityDetailModal from "./CommunityDetailModal";
import type { Mutate } from "@/app/page";

export default function BrokerCommunities({
  db, mutate, broker,
}: {
  db: TrackerDB; mutate: Mutate; broker: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const myCommunities = db.communities.filter((c) => c.assignedBroker === broker);
  const openCommunity = openId ? db.communities.find((c) => c.id === openId) : null;

  return (
    <div className="card">
      <div className="section-title">
        <h3>My communities</h3>
        <span className="muted">{myCommunities.length} assigned</span>
      </div>
      {myCommunities.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {myCommunities.map((c) => (
            <div
              key={c.id}
              className="card"
              style={{ margin: 0, cursor: "pointer" }}
              onClick={() => setOpenId(c.id)}
            >
              <div className="section-title" style={{ marginBottom: 4 }}>
                <b>{c.name}</b>
                <span className={`pill ${c.status === "Open" ? "ok" : c.status === "Closed" ? "bad" : "warn"}`}>{c.status}</span>
              </div>
              <div className="muted">{c.city}</div>
              <div className="muted">{c.showhomeModel}</div>
              {c.associates.length > 0 && (
                <div className="muted" style={{ marginTop: 6 }}>
                  {c.associates.map((a) => a.name).join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">No communities assigned to you yet — ask Ops to assign one.</div>
      )}

      {openCommunity && (
        <CommunityDetailModal
          community={openCommunity}
          intel={db.communityIntel.find((i) => i.communityId === openCommunity.id)}
          callLogs={db.callLogs.filter((l) => l.communityId === openCommunity.id)}
          brokers={db.brokers}
          currentBroker={broker}
          allowReassign={false}
          mutate={mutate}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
