"use client";
import { useState } from "react";
import { TrackerDB, Deal, DocStatus, WorkloadStatus } from "@/lib/types";
import { ACTIVE_STAGES, STAGES, CONTACT_TYPES, OUTCOMES, DOC_STATUSES, BOTTLENECK_DAYS } from "@/lib/constants";
import { uid, todayISO, daysBetween, weekRange } from "@/lib/utils";
import { showToast } from "./Toast";
import FunnelBar from "./FunnelBar";
import type { Mutate } from "@/app/page";

type Tab = "log" | "deals" | "capacity";

export default function BrokerView({
  db,
  mutate,
  broker,
}: {
  db: TrackerDB;
  mutate: Mutate;
  broker: string;
}) {
  const [tab, setTab] = useState<Tab>("log");
  const [showNewDeal, setShowNewDeal] = useState(false);

  const myClients = db.clients.filter((c) => c.broker === broker);
  const myDeals = db.deals.filter((d) => d.broker === broker);
  const myOpenDeals = myDeals.filter((d) => ACTIVE_STAGES.includes(d.stage));
  const wr = weekRange(0);
  const myLogsThisWeek = db.logs.filter((l) => l.broker === broker && l.date >= wr.start && l.date <= wr.end);
  const escCount = myOpenDeals.filter((d) => d.escalation).length;
  const bottleneckCount = myOpenDeals.filter((d) => daysBetween(d.stageEnteredDate, todayISO()) > BOTTLENECK_DAYS).length;

  function clientName(id: string) {
    return db.clients.find((c) => c.id === id)?.name ?? "(unknown client)";
  }

  return (
    <>
      <div className="statgrid">
        <div className="stat">
          <div className="n">{myOpenDeals.length}</div>
          <div className="l">Open deals</div>
        </div>
        <div className="stat alt2">
          <div className="n">{myLogsThisWeek.length}</div>
          <div className="l">Touches this week</div>
        </div>
        <div className="stat" style={{ background: bottleneckCount ? "var(--danger)" : "var(--charcoal)" }}>
          <div className="n">{bottleneckCount}</div>
          <div className="l">Stuck &gt;{BOTTLENECK_DAYS}d</div>
        </div>
        <div className="stat" style={{ background: escCount ? "var(--danger)" : "var(--charcoal)" }}>
          <div className="n">{escCount}</div>
          <div className="l">Escalations</div>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === "log" ? "active" : ""}`} onClick={() => setTab("log")}>Outreach</div>
        <div className={`tab ${tab === "deals" ? "active" : ""}`} onClick={() => setTab("deals")}>Active Deals</div>
        <div className={`tab ${tab === "capacity" ? "active" : ""}`} onClick={() => setTab("capacity")}>Weekly Capacity</div>
      </div>

      {tab === "log" && (
        <LogTab db={db} mutate={mutate} broker={broker} myClients={myClients} clientName={clientName} />
      )}
      {tab === "deals" && (
        <>
          <div className="card">
            <h3 style={{ marginBottom: 6 }}>Pipeline snapshot</h3>
            <FunnelBar deals={myOpenDeals} />
          </div>
          <div className="card">
            <div className="section-title">
              <h3>My open deals</h3>
              <button className="btn small" onClick={() => setShowNewDeal(true)}>+ Add deal</button>
            </div>
            {myOpenDeals.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Client</th><th>Stage</th><th>Aging</th><th>Docs</th><th>Value</th><th>Escalate</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {myOpenDeals.map((d) => (
                    <DealRow key={d.id} deal={d} db={db} mutate={mutate} clientName={clientName} />
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">No open deals yet. Add your first one above.</div>
            )}
          </div>
          {showNewDeal && (
            <NewDealModal
              broker={broker}
              myClients={myClients}
              mutate={mutate}
              onClose={() => setShowNewDeal(false)}
            />
          )}
        </>
      )}
      {tab === "capacity" && <CapacityTab db={db} mutate={mutate} broker={broker} />}
    </>
  );
}

function LogTab({
  db, mutate, broker, myClients, clientName,
}: {
  db: TrackerDB; mutate: Mutate; broker: string;
  myClients: TrackerDB["clients"]; clientName: (id: string) => string;
}) {
  const [clientSel, setClientSel] = useState("__new__");
  const [newClientName, setNewClientName] = useState("");
  const [type, setType] = useState(CONTACT_TYPES[0]);
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [notes, setNotes] = useState("");

  const todays = db.logs
    .filter((l) => l.broker === broker && l.date === todayISO())
    .slice()
    .reverse();

  async function save() {
    let clientId = clientSel;
    if (clientId === "__new__") {
      const name = newClientName.trim();
      if (!name) { showToast("Enter a client name first"); return; }
      const newClient = { id: uid(), name, broker, createdDate: todayISO() };
      await mutate("clients", (arr) => [...arr, newClient]);
      clientId = newClient.id;
    }
    await mutate("logs", (arr) => [...arr, { id: uid(), clientId, broker, date: todayISO(), type, outcome, notes: notes.trim() }]);
    setNewClientName(""); setNotes("");
    showToast("Logged");
  }

  async function del(id: string) {
    await mutate("logs", (arr) => arr.filter((l) => l.id !== id));
  }

  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Log a contact</h3>
        <div className="grid grid-2">
          <div className="field">
            <label>Client</label>
            <select value={clientSel} onChange={(e) => setClientSel(e.target.value)}>
              <option value="__new__">+ New client…</option>
              {myClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {clientSel === "__new__" && (
            <div className="field">
              <label>New client name</label>
              <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Full name" />
            </div>
          )}
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label>Contact type</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)}>
              {CONTACT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Outcome</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as any)}>
              {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. waiting on income docs" />
        </div>
        <button className="btn" onClick={save}>Save entry</button>
      </div>
      <div className="card">
        <div className="section-title"><h3>Today&apos;s activity</h3><span className="muted">{todays.length} logged</span></div>
        {todays.length ? (
          <table>
            <thead><tr><th>Client</th><th>Type</th><th>Outcome</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {todays.map((l) => (
                <tr key={l.id}>
                  <td>{clientName(l.clientId)}</td>
                  <td><span className="pill">{l.type}</span></td>
                  <td>{l.outcome}</td>
                  <td className="muted">{l.notes || "—"}</td>
                  <td><button className="x-link" onClick={() => del(l.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">Nothing logged yet today. First entry above takes 10 seconds.</div>
        )}
      </div>
    </>
  );
}

function DealRow({
  deal, db, mutate, clientName,
}: { deal: Deal; db: TrackerDB; mutate: Mutate; clientName: (id: string) => string }) {
  const days = daysBetween(deal.stageEnteredDate, todayISO());
  const cls = days > BOTTLENECK_DAYS ? "bad" : days >= BOTTLENECK_DAYS - 3 ? "warn" : "ok";
  const [reasonDraft, setReasonDraft] = useState(deal.escalationReason || "");

  async function updateStage(stage: string) {
    if (stage === deal.stage) return;
    await mutate("deals", (arr) => arr.map((d) => d.id === deal.id ? { ...d, stage: stage as any, stageEnteredDate: todayISO() } : d));
    showToast("Stage updated");
  }
  async function updateDoc(docStatus: string) {
    await mutate("deals", (arr) => arr.map((d) => d.id === deal.id ? { ...d, docStatus: docStatus as DocStatus } : d));
  }
  async function toggleEsc(checked: boolean) {
    await mutate("deals", (arr) => arr.map((d) => d.id === deal.id ? { ...d, escalation: checked, escalatedAt: checked ? (d.escalatedAt || todayISO()) : null } : d));
  }
  async function saveReason() {
    await mutate("deals", (arr) => arr.map((d) => d.id === deal.id ? { ...d, escalationReason: reasonDraft } : d));
  }
  async function remove() {
    await mutate("deals", (arr) => arr.filter((d) => d.id !== deal.id));
  }

  return (
    <>
      <tr>
        <td><b>{clientName(deal.clientId)}</b></td>
        <td>
          <select className="inline-select" value={deal.stage} onChange={(e) => updateStage(e.target.value)}>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td><span className={`pill ${cls}`}>{days}d at stage</span></td>
        <td>
          <select className="inline-select" value={deal.docStatus} onChange={(e) => updateDoc(e.target.value)}>
            {DOC_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </td>
        <td>${Number(deal.value || 0).toLocaleString()}</td>
        <td>
          <label className="checkrow">
            <input type="checkbox" checked={deal.escalation} onChange={(e) => toggleEsc(e.target.checked)} />
            Flag
          </label>
        </td>
        <td><button className="x-link" onClick={remove}>Remove</button></td>
      </tr>
      {deal.escalation && (
        <tr>
          <td colSpan={7} style={{ borderBottom: "1px solid var(--warmgrey)", background: "#fbf3ee" }}>
            <input
              type="text"
              placeholder="Escalation reason / what's needed"
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              onBlur={saveReason}
              style={{ border: "1px solid var(--danger)" }}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function NewDealModal({
  broker, myClients, mutate, onClose,
}: { broker: string; myClients: TrackerDB["clients"]; mutate: Mutate; onClose: () => void }) {
  const [clientSel, setClientSel] = useState("__new__");
  const [newClientName, setNewClientName] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState(ACTIVE_STAGES[0]);

  async function save() {
    let clientId = clientSel;
    if (clientId === "__new__") {
      const name = newClientName.trim();
      if (!name) { showToast("Enter a client name"); return; }
      const nc = { id: uid(), name, broker, createdDate: todayISO() };
      await mutate("clients", (arr) => [...arr, nc]);
      clientId = nc.id;
    }
    const deal = {
      id: uid(), clientId, broker, value: Number(value) || 0,
      stage, stageEnteredDate: todayISO(), docStatus: "None" as const,
      escalation: false, escalationReason: "", escalatedAt: null, createdAt: todayISO(),
    };
    await mutate("deals", (arr) => [...arr, deal]);
    showToast("Deal added");
    onClose();
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3 style={{ marginBottom: 16 }}>Add new deal</h3>
        <div className="field">
          <label>Client</label>
          <select value={clientSel} onChange={(e) => setClientSel(e.target.value)}>
            <option value="__new__">+ New client…</option>
            {myClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {clientSel === "__new__" && (
          <div className="field">
            <label>New client name</label>
            <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label>Estimated deal value ($)</label>
          <input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="field">
          <label>Starting stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value as any)}>
            {ACTIVE_STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flexend">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Add deal</button>
        </div>
      </div>
    </div>
  );
}

function CapacityTab({ db, mutate, broker }: { db: TrackerDB; mutate: Mutate; broker: string }) {
  const wr = weekRange(0);
  const existing = db.capacity.find((c) => c.broker === broker && c.weekStart === wr.start);
  const [status, setStatus] = useState<WorkloadStatus>(existing?.status || "Low");
  const [calls, setCalls] = useState(existing?.callsCapacity || "");
  const [deals, setDeals] = useState(existing?.dealsCapacity || "");
  const [comments, setComments] = useState(existing?.comments || "");

  async function save() {
    const record = { broker, weekStart: wr.start, status, callsCapacity: calls, dealsCapacity: deals, comments, savedAt: new Date().toLocaleString() };
    await mutate("capacity", (arr) => {
      const idx = arr.findIndex((c) => c.broker === broker && c.weekStart === wr.start);
      if (idx >= 0) { const copy = [...arr]; copy[idx] = record; return copy; }
      return [...arr, record];
    });
    showToast("Check-in saved");
  }

  return (
    <div className="card">
      <div className="section-title"><h3>Weekly capacity check-in</h3><span className="muted">Week of {wr.label}</span></div>
      <p className="muted" style={{ marginTop: -6 }}>One check-in per week — update anytime before Friday.</p>
      <div className="field">
        <label>Current workload status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as WorkloadStatus)}>
          {(["Low", "Moderate", "At Capacity"] as WorkloadStatus[]).map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid grid-2">
        <div className="field">
          <label>Calls you can take on next week</label>
          <input type="number" min="0" value={calls} onChange={(e) => setCalls(e.target.value)} />
        </div>
        <div className="field">
          <label>New live deals you can take on next week</label>
          <input type="number" min="0" value={deals} onChange={(e) => setDeals(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Comments / roadblocks / support needed</label>
        <textarea value={comments} onChange={(e) => setComments(e.target.value)} />
      </div>
      <button className="btn" onClick={save}>{existing ? "Update check-in" : "Save check-in"}</button>
      {existing && <span className="muted" style={{ marginLeft: 10 }}>Last saved {existing.savedAt}</span>}
    </div>
  );
}
