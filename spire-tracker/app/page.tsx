"use client";
import { useEffect, useState, useCallback } from "react";
import { TrackerDB, Role } from "@/lib/types";
import { KV_KEYS } from "@/lib/constants";
import { loadArr, saveArr, logout } from "@/lib/api";
import RoleScreen from "@/components/RoleScreen";
import BrokerView from "@/components/BrokerView";
import OpsView from "@/components/OpsView";
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
      const [brokers, clients, logs, deals, capacity, brokerContacts, opsRecipients] = await Promise.all([
        loadArr<string>(KV_KEYS.brokers),
        loadArr(KV_KEYS.clients),
        loadArr(KV_KEYS.logs),
        loadArr(KV_KEYS.deals),
        loadArr(KV_KEYS.capacity),
        loadArr(KV_KEYS.brokerContacts),
        loadArr<string>(KV_KEYS.opsRecipients),
      ]);
      setDb({ brokers, clients, logs, deals, capacity, brokerContacts, opsRecipients } as TrackerDB);
      setLoading(false);
    })();
  }, []);

  const mutate: Mutate = useCallback(async (key, updater) => {
    setDb((prev) => {
      const next = { ...prev, [key]: updater(prev[key]) };
      const kvKey = KV_KEYS[key as keyof typeof KV_KEYS];
      saveArr(kvKey, next[key] as any); // fire and forget; UI already reflects the update optimistically
      return next;
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
              ) : (
                <>Ops Manager view · <b>all brokers</b></>
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
        />
      )}
      {role === "broker" && broker && <BrokerView db={db} mutate={mutate} broker={broker} />}
      {role === "ops" && <OpsView db={db} mutate={mutate} />}

      <Toast />
    </div>
  );
}
