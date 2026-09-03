"use client";
import { useEffect, useState, useCallback } from "react";
import { TrackerDB, Role } from "@/lib/types";
import { CollectionKey } from "@/lib/collections";
import { loadAll, persistDiff, logout } from "@/lib/api";
import RoleScreen from "@/components/RoleScreen";
import BrokerView from "@/components/BrokerView";
import OpsView from "@/components/OpsView";
import ResourcesView from "@/components/ResourcesView";
import Toast from "@/components/Toast";

export type Mutate = <K extends keyof TrackerDB>(
  key: K,
  updater: (current: TrackerDB[K]) => TrackerDB[K]
) => Promise<void>;

const EMPTY_DB: TrackerDB = { brokers: [], clients: [], logs: [], deals: [], capacity: [], brokerContacts: [], opsRecipients: [] };

export default function Page() {
  const [db, setDb] = useState<TrackerDB>(EMPTY_DB);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>(null);
  const [broker, setBroker] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await loadAll();
        setDb({
          brokers: all.brokers || [],
          clients: all.clients || [],
          logs: all.logs || [],
          deals: all.deals || [],
          capacity: all.capacity || [],
          brokerContacts: all.brokerContacts || [],
          opsRecipients: all.opsRecipients || [],
        } as TrackerDB);
      } catch {
        /* leave EMPTY_DB; user sees an empty state rather than a crash */
      }
      setLoading(false);
    })();
  }, []);

  const mutate: Mutate = useCallback(async (key, updater) => {
    setDb((prev) => {
      const before = prev[key] as any[];
      const after = updater(prev[key]) as any[];
      // Persist only the changed record(s), not the whole collection.
      persistDiff(key as CollectionKey, before, after);
      return { ...prev, [key]: after };
    });
  }, []);

  if (loading) {
    return (
      <div className="app-shell">
        <div className="empty">Loading…</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-left">
          <span className="brandmark">Spire</span>
          <h1>Pipeline Tracker</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {role && (
            <span className="who">
              {role === "broker" ? (
                <>Broker view · <b>{broker}</b></>
              ) : role === "ops" ? (
                <>Ops Manager view · <b>all brokers</b></>
              ) : (
                <>Resources</>
              )}
            </span>
          )}
          {role && (
            <button className="btn secondary small" onClick={() => { setRole(null); setBroker(null); }}>
              Switch
            </button>
          )}
          <button className="btn secondary small" onClick={logout}>Log out</button>
        </div>
      </div>

      {!role && (
        <RoleScreen
          brokers={db.brokers}
          onSelectBroker={(name) => { setRole("broker"); setBroker(name); }}
          onSelectOps={() => setRole("ops")}
          onSelectResources={() => setRole("resources")}
        />
      )}
      {role === "broker" && broker && <BrokerView db={db} mutate={mutate} broker={broker} />}
      {role === "ops" && <OpsView db={db} mutate={mutate} />}
      {role === "resources" && <ResourcesView />}

      <Toast />
    </div>
  );
}
