"use client";
import { useState } from "react";
import { TrackerDB, Deal, DocStatus, WorkloadStatus, ClientSource, DealType, ContactLog } from "@/lib/types";
import { ACTIVE_STAGES, STAGES, CONTACT_TYPES, OUTCOMES, DOC_STATUSES, TIME_SPENT_OPTIONS, BOTTLENECK_DAYS, CLIENT_SOURCES, DEAL_TYPES } from "@/lib/constants";
import { uid, todayISO, daysBetween, weekRange, nowISO, daysAgo, totalMinutesForDeal } from "@/lib/utils";
import { notifyEscalation } from "@/lib/api";
import { showToast } from "./Toast";
import FunnelBar from "./FunnelBar";
import TimeEntriesModal from "./TimeEntriesModal";
import SortableTh, { sortRows, makeSortHandler, SortDir } from "./SortableTh";
import type { Mutate } from "@/app/page";

type Tab = "log" | "deals" | "completed" | "capacity";

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
  const [dealsSortKey, setDealsSortKey] = useState<string | null>(null);
  const [dealsSortDir, setDealsSortDir] = useState<SortDir>("asc");
  const handleDealsSort = makeSortHandler(dealsSortKey, setDealsSortKey, dealsSortDir, setDealsSortDir);

  const myClients = db.clients.filter((c) => c.broker === broker);
  const myDeals = db.deals.filter((d) => d.broker === broker);
  const myOpenDeals = myDeals.filter((d) => ACTIVE_STAGES.includes(d.stage));
  const myCompletedDeals = myDeals.filter((d) => d.stage === "Broker Complete");
  const wr = weekRange(0);
  const myLogsThisWeek = db.logs.filter((l) => l.broker === broker && l.date >= wr.start && l.date <= wr.end);
  const escCount = myOpenDeals.filter((d) => d.escalation).length;
  const bottleneckCount = myOpenDeals.filter((d) => daysBetween(d.stageEnteredDate, todayISO()) > BOTTLENECK_DAYS).length;

  function clientName(id: string) {
    return db.clients.find((c) => c.id === id)?.name ?? "(unknown client)";
  }

  const myOpenDealsSorted = sortRows(myOpenDeals, dealsSortKey, dealsSortDir, (d, key) => {
    if (key === "client") return clientName(d.clientId);
    if (key === "stage") return d.stage;
    if (key === "aging") return daysBetween(d.stageEnteredDate, todayISO());
    if (key === "docs") return d.docStatus;
    if (key === "value") return d.value || 0;
    if (key === "time") return totalMinutesForDeal(db.logs, d.id);
    if (key === "escalate") return d.escalation ? 1 : 0;
    return "";
  });

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
        <div className={`tab ${tab === "completed" ? "active" : ""}`} onClick={() => setTab("completed")}>Completed{myCompletedDeals.length ? ` (${myCompletedDeals.length})` : ""}</div>
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
              <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <SortableTh label="Client" sortKey="client" currentKey={dealsSortKey} currentDir={dealsSortDir} onSort={handleDealsSort} />
                    <SortableTh label="Stage" sortKey="stage" currentKey={dealsSortKey} currentDir={dealsSortDir} onSort={handleDealsSort} />
                    <SortableTh label="Aging" sortKey="aging" currentKey={dealsSortKey} currentDir={dealsSortDir} onSort={handleDealsSort} />
                    <SortableTh label="Docs" sortKey="docs" currentKey={dealsSortKey} currentDir={dealsSortDir} onSort={handleDealsSort} />
                    <SortableTh label="Value" sortKey="value" currentKey={dealsSortKey} currentDir={dealsSortDir} onSort={handleDealsSort} />
                    <SortableTh label="Time Logged" sortKey="time" currentKey={dealsSortKey} currentDir={dealsSortDir} onSort={handleDealsSort} />
                    <SortableTh label="Escalate" sortKey="escalate" currentKey={dealsSortKey} currentDir={dealsSortDir} onSort={handleDealsSort} />
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {myOpenDealsSorted.map((d) => (
                    <DealRow key={d.id} deal={d} db={db} mutate={mutate} clientName={clientName} broker={broker} />
                  ))}
                </tbody>
              </table>
              </div>
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
      {tab === "completed" && (
        <CompletedDeals deals={myCompletedDeals} db={db} mutate={mutate} clientName={clientName} />
      )}
      {tab === "capacity" && <CapacityTab db={db} mutate={mutate} broker={broker} />}
    </>
  );
}

function CompletedDeals({
  deals, db, mutate, clientName,
}: { deals: Deal[]; db: TrackerDB; mutate: Mutate; clientName: (id: string) => string }) {
  const sorted = deals.slice().sort((a, b) => (b.stageEnteredDate || "").localeCompare(a.stageEnteredDate || ""));

  async function reopen(dealId: string) {
    await mutate("deals", (arr) => arr.map((d) => d.id === dealId
      ? { ...d, stage: "Conditions", stageEnteredDate: todayISO() }
      : d));
    showToast("Deal reopened into Active Deals (Conditions)");
  }

  return (
    <div className="card">
      <div className="section-title">
        <h3>Completed deals</h3>
        <span className="muted">{sorted.length} marked Broker Complete · removed from Active Deals</span>
      </div>
      {sorted.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Completed</th><th>Value</th><th>Time logged</th><th></th></tr></thead>
            <tbody>
              {sorted.map((d) => {
                const mins = db.logs.filter((l) => l.dealId === d.id).reduce((s, l) => s + (l.timeSpentMinutes || 0), 0);
                return (
                  <tr key={d.id}>
                    <td><b>{clientName(d.clientId)}</b></td>
                    <td className="muted">{d.stageEnteredDate}</td>
                    <td>${Number(d.value || 0).toLocaleString()}</td>
                    <td className="muted">{(mins / 60).toFixed(1)} hrs</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn secondary small" onClick={() => reopen(d.id)}>Reopen</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No completed deals yet. When you set a deal&apos;s stage to &quot;Broker Complete,&quot; it moves here.</div>
      )}
    </div>
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
  const [newClientSource, setNewClientSource] = useState<ClientSource>(CLIENT_SOURCES[0]);
  const [dealSel, setDealSel] = useState("__none__");
  const [type, setType] = useState(CONTACT_TYPES[0]);
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [notes, setNotes] = useState("");
  const [timeSpent, setTimeSpent] = useState(TIME_SPENT_OPTIONS[0].minutes);

  const clientDeals = db.deals.filter((d) => d.clientId === clientSel && d.broker === broker);

  const todays = db.logs
    .filter((l) => l.broker === broker && l.date === todayISO())
    .slice()
    .reverse();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const handleSort = makeSortHandler(sortKey, setSortKey, sortDir, setSortDir);
  const todaysSorted = sortRows(todays, sortKey, sortDir, (l, key) => {
    if (key === "client") return clientName(l.clientId);
    if (key === "type") return l.type;
    if (key === "outcome") return l.outcome;
    if (key === "time") return l.timeSpentMinutes;
    return "";
  });

  async function save() {
    let clientId = clientSel;
    if (clientId === "__new__") {
      const name = newClientName.trim();
      if (!name) { showToast("Enter a client name first"); return; }
      const newClient = { id: uid(), name, broker, createdDate: todayISO(), source: newClientSource };
      await mutate("clients", (arr) => [...arr, newClient]);
      clientId = newClient.id;
    }
    const dealId = dealSel === "__none__" ? null : dealSel;
    const stageAtLog = dealId ? (db.deals.find((d) => d.id === dealId)?.stage ?? null) : null;
    await mutate("logs", (arr) => [...arr, { id: uid(), clientId, broker, date: todayISO(), type, outcome, notes: notes.trim(), timeSpentMinutes: timeSpent, dealId, stageAtLog }]);
    setNewClientName(""); setNotes(""); setDealSel("__none__");
    showToast("Logged");
  }

  async function del(id: string) {
    await mutate("logs", (arr) => arr.filter((l) => l.id !== id));
  }
  const [editLog, setEditLog] = useState<ContactLog | null>(null);

  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Log a contact</h3>
        <div className="grid grid-2">
          <div className="field">
            <label>Client</label>
            <select value={clientSel} onChange={(e) => { setClientSel(e.target.value); setDealSel("__none__"); }}>
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
          {clientSel === "__new__" && (
            <div className="field">
              <label>Client category</label>
              <select value={newClientSource} onChange={(e) => setNewClientSource(e.target.value as ClientSource)}>
                {CLIENT_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}
          {clientSel !== "__new__" && clientDeals.length > 0 && (
            <div className="field">
              <label>Which deal is this time for?</label>
              <select value={dealSel} onChange={(e) => setDealSel(e.target.value)}>
                <option value="__none__">Not deal-specific</option>
                {clientDeals.map((d) => <option key={d.id} value={d.id}>{d.stage}{d.escalation ? " (flagged)" : ""}</option>)}
              </select>
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
          <label>Time spent</label>
          <select value={timeSpent} onChange={(e) => setTimeSpent(Number(e.target.value))}>
            {TIME_SPENT_OPTIONS.map((t) => <option key={t.minutes} value={t.minutes}>{t.label}</option>)}
          </select>
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
          <div className="table-wrap">
          <table>
            <thead><tr>
              <SortableTh label="Client" sortKey="client" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableTh label="Type" sortKey="type" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableTh label="Outcome" sortKey="outcome" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableTh label="Time" sortKey="time" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <th>Notes</th><th></th>
            </tr></thead>
            <tbody>
              {todaysSorted.map((l) => (
                <tr key={l.id}>
                  <td>{clientName(l.clientId)}</td>
                  <td><span className="pill">{l.type}</span></td>
                  <td>{l.outcome}</td>
                  <td className="muted">{l.timeSpentMinutes} min</td>
                  <td className="muted">{l.notes || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="x-link" style={{ color: "var(--charcoal)" }} onClick={() => setEditLog(l)}>Edit</button>
                    <button className="x-link" onClick={() => del(l.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <div className="empty">Nothing logged yet today. First entry above takes 10 seconds.</div>
        )}
      </div>
      {editLog && <EditLogModal log={editLog} mutate={mutate} onClose={() => setEditLog(null)} />}
    </>
  );
}

function EditLogModal({
  log, mutate, onClose,
}: { log: ContactLog; mutate: Mutate; onClose: () => void }) {
  const [type, setType] = useState(log.type);
  const [outcome, setOutcome] = useState(log.outcome);
  const [notes, setNotes] = useState(log.notes || "");
  const [timeSpent, setTimeSpent] = useState(log.timeSpentMinutes || 0);

  async function save() {
    await mutate("logs", (arr) => arr.map((l) => l.id === log.id
      ? { ...l, type, outcome, notes: notes.trim(), timeSpentMinutes: timeSpent }
      : l));
    showToast("Entry updated");
    onClose();
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3 style={{ marginBottom: 16 }}>Edit log entry</h3>
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
          <label>Time spent</label>
          <select value={timeSpent} onChange={(e) => setTimeSpent(Number(e.target.value))}>
            {TIME_SPENT_OPTIONS.map((t) => <option key={t.minutes} value={t.minutes}>{t.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flexend">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

function DealRow({
  deal, db, mutate, clientName, broker,
}: { deal: Deal; db: TrackerDB; mutate: Mutate; clientName: (id: string) => string; broker: string }) {
  const days = daysBetween(deal.stageEnteredDate, todayISO());
  const cls = days > BOTTLENECK_DAYS ? "bad" : days >= BOTTLENECK_DAYS - 3 ? "warn" : "ok";
  const [reasonDraft, setReasonDraft] = useState(deal.escalationReason || "");
  const [showLogTime, setShowLogTime] = useState(false);
  const [showEntries, setShowEntries] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const recentResolution = (deal.escalationHistory || []).slice().sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt))[0] || null;
  const dealLogs = db.logs.filter((l) => l.dealId === deal.id);
  const dealMinutes = dealLogs.reduce((sum, l) => sum + (l.timeSpentMinutes || 0), 0);
  const minutesByStage: Record<string, number> = {};
  dealLogs.forEach((l) => {
    const key = l.stageAtLog || "Unspecified stage";
    minutesByStage[key] = (minutesByStage[key] || 0) + (l.timeSpentMinutes || 0);
  });

  async function updateStage(stage: string) {
    if (stage === deal.stage) return;
    await mutate("deals", (arr) => arr.map((d) => d.id === deal.id ? { ...d, stage: stage as any, stageEnteredDate: todayISO() } : d));
    showToast("Stage updated");
  }
  async function updateDoc(docStatus: string) {
    await mutate("deals", (arr) => arr.map((d) => d.id === deal.id ? { ...d, docStatus: docStatus as DocStatus } : d));
  }
  async function toggleEsc(checked: boolean) {
    await mutate("deals", (arr) => arr.map((d) => d.id === deal.id
      ? {
          ...d,
          escalation: checked,
          escalatedAt: checked ? (d.escalatedAt || nowISO()) : null,
          // Clearing the flag resets the "notified" marker so re-flagging later
          // will alert ops again.
          escalationNotifiedAt: checked ? d.escalationNotifiedAt : null,
          opsResponse: checked && !d.escalatedAt ? "" : d.opsResponse,
        }
      : d));
  }
  // Saving the reason on a flagged deal automatically alerts ops — but only the
  // first time (escalationNotifiedAt guards against re-emailing on later edits).
  async function saveReason() {
    const reason = reasonDraft;
    const shouldNotify = deal.escalation && !deal.escalationNotifiedAt && Boolean(reason.trim());
    await mutate("deals", (arr) => arr.map((d) => d.id === deal.id
      ? { ...d, escalationReason: reason, escalationNotifiedAt: shouldNotify ? nowISO() : d.escalationNotifiedAt }
      : d));
    if (shouldNotify) {
      notifyEscalation({
        broker,
        clientName: clientName(deal.clientId),
        stage: deal.stage,
        value: Number(deal.value || 0),
        reason,
      });
      showToast("Ops notified");
    }
  }
  async function remove() {
    await mutate("deals", (arr) => arr.filter((d) => d.id !== deal.id));
  }

  return (
    <>
      <tr>
        <td><b>{clientName(deal.clientId)}</b><div className="muted" style={{ fontSize: 11 }}>{db.clients.find((c) => c.id === deal.clientId)?.source || ""}</div></td>
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
        <td className="muted">
          <div>{(dealMinutes / 60).toFixed(1)} hrs total</div>
          {Object.entries(minutesByStage).map(([stage, mins]) => (
            <div key={stage} style={{ fontSize: 11 }}>{stage}: {(mins / 60).toFixed(1)}h</div>
          ))}
          <button className="x-link" style={{ color: "var(--charcoal)", paddingLeft: 0 }} onClick={() => setShowLogTime(true)}>+ Log time</button>
          {dealLogs.length > 0 && (
            <button className="x-link" style={{ color: "var(--greyblue)", paddingLeft: 0 }} onClick={() => setShowEntries(true)}>View entries</button>
          )}
        </td>
        <td>
          <label className="checkrow">
            <input type="checkbox" checked={deal.escalation} onChange={(e) => toggleEsc(e.target.checked)} />
            Flag
          </label>
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button className="x-link" style={{ color: "var(--charcoal)" }} onClick={() => setShowEdit(true)}>Edit</button>
          <button className="x-link" onClick={remove}>Remove</button>
        </td>
      </tr>
      {deal.escalation && (
        <tr>
          <td colSpan={8} style={{ borderBottom: "1px solid var(--warmgrey)", background: "#fbf3ee" }}>
            <input
              type="text"
              placeholder="Escalation reason / what's needed"
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              onBlur={saveReason}
              style={{ border: "1px solid var(--danger)" }}
            />
            {deal.opsResponse ? (
              <div className="muted" style={{ marginTop: 6 }}>
                <b style={{ color: "var(--charcoal)" }}>Ops response:</b> {deal.opsResponse}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 6 }}>
                {deal.escalationNotifiedAt ? "Ops has been notified — waiting on a response." : "Add a reason and your ops manager is alerted automatically."}
              </div>
            )}
          </td>
        </tr>
      )}
      {!deal.escalation && recentResolution && (
        <tr>
          <td colSpan={8} style={{ borderBottom: "1px solid var(--warmgrey)", background: "#eef4ef" }}>
            <span className="pill ok">Resolved {daysAgo(recentResolution.resolvedAt)}d ago</span>
            {recentResolution.opsResponse ? <span style={{ marginLeft: 8 }}>{recentResolution.opsResponse}</span> : null}
          </td>
        </tr>
      )}
      {showLogTime && (
        <LogTimeModal deal={deal} broker={broker} mutate={mutate} onClose={() => setShowLogTime(false)} />
      )}
      {showEntries && (
        <TimeEntriesModal dealLabel={`${clientName(deal.clientId)} — ${deal.stage}`} logs={dealLogs} mutate={mutate} allowEdit={true} onClose={() => setShowEntries(false)} />
      )}
      {showEdit && (
        <EditDealModal deal={deal} db={db} mutate={mutate} broker={broker} onClose={() => setShowEdit(false)} />
      )}
    </>
  );
}

function EditDealModal({
  deal, db, mutate, broker, onClose,
}: { deal: Deal; db: TrackerDB; mutate: Mutate; broker: string; onClose: () => void }) {
  const myClients = db.clients.filter((c) => c.broker === broker);
  const currentClient = db.clients.find((c) => c.id === deal.clientId);
  const [value, setValue] = useState(String(deal.value || 0));
  const [clientId, setClientId] = useState(deal.clientId);
  const [clientName, setClientName] = useState(currentClient?.name || "");
  const [dealType, setDealType] = useState<DealType>(deal.dealType || "Existing pipeline");

  async function save() {
    // Rename the client currently attached (if its name was changed)
    const trimmed = clientName.trim();
    if (trimmed && currentClient && trimmed !== currentClient.name && clientId === deal.clientId) {
      await mutate("clients", (arr) => arr.map((c) => c.id === currentClient.id ? { ...c, name: trimmed } : c));
    }
    await mutate("deals", (arr) => arr.map((d) => d.id === deal.id
      ? { ...d, value: Number(value) || 0, clientId, dealType }
      : d));
    showToast("Deal updated");
    onClose();
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3 style={{ marginBottom: 16 }}>Edit deal</h3>
        <div className="field">
          <label>Deal value ($)</label>
          <input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="field">
          <label>Deal type</label>
          <select value={dealType} onChange={(e) => setDealType(e.target.value as DealType)}>
            {DEAL_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Client (reassign this deal)</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {myClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {clientId === deal.clientId && (
          <div className="field">
            <label>Rename this client</label>
            <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client full name" />
            <span className="muted" style={{ fontSize: 11 }}>Updates the client everywhere they appear.</span>
          </div>
        )}
        <div className="flexend">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

function LogTimeModal({
  deal, broker, mutate, onClose,
}: { deal: Deal; broker: string; mutate: Mutate; onClose: () => void }) {
  const [type, setType] = useState(CONTACT_TYPES[0]);
  const [timeSpent, setTimeSpent] = useState(TIME_SPENT_OPTIONS[0].minutes);
  const [notes, setNotes] = useState("");
  const [escalate, setEscalate] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");

  async function save() {
    await mutate("logs", (arr) => [...arr, {
      id: uid(), clientId: deal.clientId, broker, date: todayISO(),
      type, outcome: "Other", notes: notes.trim(), timeSpentMinutes: timeSpent,
      dealId: deal.id, stageAtLog: deal.stage,
    }]);
    if (escalate && !deal.escalation) {
      await mutate("deals", (arr) => arr.map((d) => d.id === deal.id
        ? { ...d, escalation: true, escalatedAt: nowISO(), escalationReason: escalateReason.trim() || notes.trim(), opsResponse: "" }
        : d));
    }
    showToast(escalate ? "Time logged and deal flagged" : "Time logged");
    onClose();
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3 style={{ marginBottom: 16 }}>Log time on this deal — {deal.stage}</h3>
        <div className="field">
          <label>Activity type</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            {CONTACT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Time spent</label>
          <select value={timeSpent} onChange={(e) => setTimeSpent(Number(e.target.value))}>
            {TIME_SPENT_OPTIONS.map((t) => <option key={t.minutes} value={t.minutes}>{t.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did this time cover?" />
        </div>
        {!deal.escalation && (
          <div className="field">
            <label className="checkrow" style={{ textTransform: "none", fontWeight: 600, color: "var(--charcoal)" }}>
              <input type="checkbox" checked={escalate} onChange={(e) => setEscalate(e.target.checked)} />
              This work turned up a problem — flag this deal for ops
            </label>
            {escalate && (
              <input
                type="text"
                placeholder="What does ops need to know? (defaults to your notes above if left blank)"
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                style={{ marginTop: 8, border: "1px solid var(--danger)" }}
              />
            )}
          </div>
        )}
        <div className="flexend">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Log time</button>
        </div>
      </div>
    </div>
  );
}

function NewDealModal({
  broker, myClients, mutate, onClose,
}: { broker: string; myClients: TrackerDB["clients"]; mutate: Mutate; onClose: () => void }) {
  const [clientSel, setClientSel] = useState("__new__");
  const [newClientName, setNewClientName] = useState("");
  const [newClientSource, setNewClientSource] = useState<ClientSource>(CLIENT_SOURCES[0]);
  const [value, setValue] = useState("");
  const [stage, setStage] = useState(ACTIVE_STAGES[0]);
  const [dealType, setDealType] = useState<DealType | "">("");
  const [logTime, setLogTime] = useState<string>("");
  const [logNotes, setLogNotes] = useState("");

  async function save() {
    // Required, no defaults — so no deal gets entered without context.
    if (!dealType) { showToast("Choose New origination or Existing pipeline"); return; }
    if (!logTime) { showToast("Select the time spent"); return; }
    if (!logNotes.trim()) { showToast("Add a note about this deal"); return; }

    let clientId = clientSel;
    if (clientId === "__new__") {
      const name = newClientName.trim();
      if (!name) { showToast("Enter a client name"); return; }
      const nc = { id: uid(), name, broker, createdDate: todayISO(), source: newClientSource };
      await mutate("clients", (arr) => [...arr, nc]);
      clientId = nc.id;
    }
    const dealId = uid();
    const deal = {
      id: dealId, clientId, broker, value: Number(value) || 0, dealType,
      stage, stageEnteredDate: todayISO(), docStatus: "None" as const,
      escalation: false, escalationReason: "", escalatedAt: null,
      opsResponse: "", escalationHistory: [], createdAt: todayISO(),
    };
    await mutate("deals", (arr) => [...arr, deal]);
    await mutate("logs", (arr) => [...arr, {
      id: uid(), clientId, broker, date: todayISO(),
      type: CONTACT_TYPES[0], outcome: "Other", notes: logNotes.trim(),
      timeSpentMinutes: Number(logTime), dealId, stageAtLog: stage,
    }]);
    showToast("Deal added and time logged");
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
        {clientSel === "__new__" && (
          <div className="field">
            <label>Client category</label>
            <select value={newClientSource} onChange={(e) => setNewClientSource(e.target.value as ClientSource)}>
              {CLIENT_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-2">
          <div className="field">
            <label>Estimated deal value ($)</label>
            <input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="field">
            <label>Deal type *</label>
            <select value={dealType} onChange={(e) => setDealType(e.target.value as DealType)}>
              <option value="" disabled>Select…</option>
              {DEAL_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Starting stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value as any)}>
            {ACTIVE_STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label>Time spent *</label>
            <select value={logTime} onChange={(e) => setLogTime(e.target.value)}>
              <option value="" disabled>Select…</option>
              {TIME_SPENT_OPTIONS.map((t) => <option key={t.minutes} value={t.minutes}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Notes *</label>
            <input type="text" value={logNotes} onChange={(e) => setLogNotes(e.target.value)} placeholder="What did this cover?" />
          </div>
        </div>
        <p className="muted" style={{ marginTop: -4, fontSize: 11 }}>* required — every deal is logged with a type, time, and note.</p>
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
