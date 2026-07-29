"use client";
import { useState } from "react";
import { TrackerDB } from "@/lib/types";
import { ACTIVE_STAGES, BOTTLENECK_DAYS, CONTACT_TYPES } from "@/lib/constants";
import { todayISO, daysBetween, weekRange, inRange, uid, nowISO, businessMinutesBetween, formatBusinessDuration, fmtDateTime } from "@/lib/utils";
import { notifyResponse } from "@/lib/api";
import { showToast } from "./Toast";
import FunnelBar from "./FunnelBar";
import type { Mutate } from "@/app/page";

type Tab = "overview" | "deals" | "escalations" | "report" | "brokers";

export default function OpsView({ db, mutate }: { db: TrackerDB; mutate: Mutate }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [weekOffset, setWeekOffset] = useState(0);

  const tabs: [Tab, string][] = [
    ["overview", "Team Overview"],
    ["deals", "All Deals"],
    ["escalations", "Escalations"],
    ["report", "Weekly Report"],
    ["brokers", "Manage Brokers"],
  ];

  function clientName(id: string) {
    return db.clients.find((c) => c.id === id)?.name ?? "(unknown client)";
  }

  return (
    <>
      <div className="tabs">
        {tabs.map(([k, l]) => (
          <div key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</div>
        ))}
      </div>
      {tab === "overview" && <Overview db={db} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />}
      {tab === "deals" && <AllDeals db={db} clientName={clientName} />}
      {tab === "escalations" && <Escalations db={db} mutate={mutate} clientName={clientName} />}
      {tab === "report" && <Report db={db} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />}
      {tab === "brokers" && <ManageBrokers db={db} mutate={mutate} />}
    </>
  );
}

function WeekNav({ weekOffset, setWeekOffset, label }: { weekOffset: number; setWeekOffset: (n: number) => void; label: string }) {
  return (
    <div className="weekpick">
      <button className="btn secondary small" onClick={() => setWeekOffset(weekOffset - 1)}>← Prev week</button>
      <b>{label}</b>
      <button className="btn secondary small" disabled={weekOffset >= 0} onClick={() => setWeekOffset(Math.min(0, weekOffset + 1))}>Next week →</button>
      {weekOffset !== 0 && <button className="btn secondary small" onClick={() => setWeekOffset(0)}>Jump to this week</button>}
    </div>
  );
}

function Overview({ db, weekOffset, setWeekOffset }: { db: TrackerDB; weekOffset: number; setWeekOffset: (n: number) => void }) {
  const wr = weekRange(weekOffset);
  const allOpen = db.deals.filter((d) => ACTIVE_STAGES.includes(d.stage));
  const totalEsc = allOpen.filter((d) => d.escalation).length;
  const totalTouches = db.logs.filter((l) => inRange(l.date, wr.start, wr.end)).length;
  const bottlenecks = allOpen.filter((d) => daysBetween(d.stageEnteredDate, todayISO()) > BOTTLENECK_DAYS).length;

  const touchCounts = db.brokers.map((b) => db.logs.filter((l) => l.broker === b && inRange(l.date, wr.start, wr.end)).length);
  const dealCounts = db.brokers.map((b) => db.deals.filter((d) => d.broker === b && ACTIVE_STAGES.includes(d.stage)).length);
  const maxTouches = Math.max(1, ...touchCounts);
  const maxDeals = Math.max(1, ...dealCounts);

  const weekLogs = db.logs.filter((l) => inRange(l.date, wr.start, wr.end));
  const totalMinutes = weekLogs.reduce((sum, l) => sum + (l.timeSpentMinutes || 0), 0);
  const minutesByBroker = db.brokers.map((b) => weekLogs.filter((l) => l.broker === b).reduce((sum, l) => sum + (l.timeSpentMinutes || 0), 0));
  const maxMinutesByBroker = Math.max(1, ...minutesByBroker);
  const minutesByType = CONTACT_TYPES.map((t) => ({
    type: t,
    minutes: weekLogs.filter((l) => l.type === t).reduce((sum, l) => sum + (l.timeSpentMinutes || 0), 0),
  }));
  const maxMinutesByType = Math.max(1, ...minutesByType.map((t) => t.minutes));
  const fmtHrs = (mins: number) => (mins / 60).toFixed(1);

  return (
    <>
      <WeekNav weekOffset={weekOffset} setWeekOffset={setWeekOffset} label={wr.label} />
      <div className="statgrid">
        <div className="stat"><div className="n">{allOpen.length}</div><div className="l">Total open deals</div></div>
        <div className="stat alt2"><div className="n">{totalTouches}</div><div className="l">Team touches this week</div></div>
        <div className="stat" style={{ background: bottlenecks ? "var(--danger)" : "var(--charcoal)" }}><div className="n">{bottlenecks}</div><div className="l">Stuck &gt;{BOTTLENECK_DAYS}d</div></div>
        <div className="stat alt"><div className="n">{totalEsc}</div><div className="l">Active escalations</div></div>
      </div>
      <div className="statgrid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="stat alt2"><div className="n">{fmtHrs(totalMinutes)} hrs</div><div className="l">Total time logged this week, team-wide</div></div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Contact volume by broker</h3>
        {db.brokers.length ? db.brokers.map((b) => {
          const n = db.logs.filter((l) => l.broker === b && inRange(l.date, wr.start, wr.end)).length;
          return (
            <div className="barrow" key={b}>
              <div className="label">{b}</div>
              <div className="track"><div className="fill" style={{ width: `${(n / maxTouches) * 100}%` }} /></div>
              <div className="val">{n} touches</div>
            </div>
          );
        }) : <div className="empty">No brokers yet.</div>}
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Open deal load by broker</h3>
        {db.brokers.length ? db.brokers.map((b) => {
          const n = db.deals.filter((d) => d.broker === b && ACTIVE_STAGES.includes(d.stage)).length;
          const escN = db.deals.filter((d) => d.broker === b && ACTIVE_STAGES.includes(d.stage) && d.escalation).length;
          return (
            <div className="barrow" key={b}>
              <div className="label">{b}</div>
              <div className="track"><div className="fill" style={{ width: `${(n / maxDeals) * 100}%`, background: escN ? "var(--danger)" : "var(--greyblue)" }} /></div>
              <div className="val">{n} deals{escN ? ` (${escN} flag)` : ""}</div>
            </div>
          );
        }) : <div className="empty">No brokers yet.</div>}
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Time logged by broker</h3>
        {db.brokers.length ? db.brokers.map((b, i) => (
          <div className="barrow" key={b}>
            <div className="label">{b}</div>
            <div className="track"><div className="fill" style={{ width: `${(minutesByBroker[i] / maxMinutesByBroker) * 100}%` }} /></div>
            <div className="val">{fmtHrs(minutesByBroker[i])} hrs</div>
          </div>
        )) : <div className="empty">No brokers yet.</div>}
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Time by activity type, team-wide</h3>
        {minutesByType.filter((t) => t.minutes > 0).length ? minutesByType.map((t) => (
          <div className="barrow" key={t.type}>
            <div className="label">{t.type}</div>
            <div className="track"><div className="fill" style={{ width: `${(t.minutes / maxMinutesByType) * 100}%`, background: "var(--greyblue)" }} /></div>
            <div className="val">{fmtHrs(t.minutes)} hrs</div>
          </div>
        )) : <div className="empty">No time logged yet this week.</div>}
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Team pipeline funnel</h3>
        <FunnelBar deals={db.deals} />
      </div>
    </>
  );
}

function AllDeals({ db, clientName }: { db: TrackerDB; clientName: (id: string) => string }) {
  const open = db.deals
    .filter((d) => ACTIVE_STAGES.includes(d.stage))
    .slice()
    .sort((a, b) => daysBetween(b.stageEnteredDate, todayISO()) - daysBetween(a.stageEnteredDate, todayISO()));

  return (
    <div className="card">
      <div className="section-title">
        <h3>All open deals</h3>
        <span className="muted">{open.length} across {db.brokers.length} brokers · sorted by longest at current stage</span>
      </div>
      {open.length ? (
        <table>
          <thead><tr><th>Broker</th><th>Client</th><th>Stage</th><th>Aging</th><th>Docs</th><th>Value</th><th>Time Logged</th><th>Status</th></tr></thead>
          <tbody>
            {open.map((d) => {
              const days = daysBetween(d.stageEnteredDate, todayISO());
              const cls = days > BOTTLENECK_DAYS ? "bad" : days >= BOTTLENECK_DAYS - 3 ? "warn" : "ok";
              const dealLogs = db.logs.filter((l) => l.dealId === d.id);
              const dealMinutes = dealLogs.reduce((sum, l) => sum + (l.timeSpentMinutes || 0), 0);
              const minutesByStage: Record<string, number> = {};
              dealLogs.forEach((l) => {
                const key = l.stageAtLog || "Unspecified stage";
                minutesByStage[key] = (minutesByStage[key] || 0) + (l.timeSpentMinutes || 0);
              });
              return (
                <tr key={d.id}>
                  <td>{d.broker}</td>
                  <td><b>{clientName(d.clientId)}</b><div className="muted" style={{ fontSize: 11 }}>{db.clients.find((c) => c.id === d.clientId)?.source || ""}</div></td>
                  <td><span className="pill">{d.stage}</span></td>
                  <td><span className={`pill ${cls}`}>{days}d</span></td>
                  <td>{d.docStatus}</td>
                  <td>${Number(d.value || 0).toLocaleString()}</td>
                  <td className="muted">
                    <div>{(dealMinutes / 60).toFixed(1)} hrs total</div>
                    {Object.entries(minutesByStage).map(([stage, mins]) => (
                      <div key={stage} style={{ fontSize: 11 }}>{stage}: {(mins / 60).toFixed(1)}h</div>
                    ))}
                  </td>
                  <td>{d.escalation ? <span className="pill bad">Flagged</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <div className="empty">No open deals in the pipeline.</div>}
    </div>
  );
}

function Escalations({ db, mutate, clientName }: { db: TrackerDB; mutate: Mutate; clientName: (id: string) => string }) {
  const escs = db.deals.filter((d) => d.escalation).slice().sort((a, b) => (a.escalatedAt || "").localeCompare(b.escalatedAt || ""));

  const resolved = db.deals
    .flatMap((d) => (d.escalationHistory || []).map((r) => ({ ...r, broker: d.broker, clientId: d.clientId })))
    .sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt));
  const avgResolutionMinutes = resolved.length
    ? resolved.reduce((sum, r) => sum + businessMinutesBetween(r.escalatedAt, r.resolvedAt), 0) / resolved.length
    : null;

  async function resolve(dealId: string) {
    const d = db.deals.find((x) => x.id === dealId);
    await mutate("deals", (arr) => arr.map((d) => {
      if (d.id !== dealId) return d;
      const record = {
        id: uid(),
        reason: d.escalationReason,
        opsResponse: d.opsResponse,
        escalatedAt: d.escalatedAt || nowISO(),
        resolvedAt: nowISO(),
      };
      return {
        ...d,
        escalation: false,
        escalationReason: "",
        escalatedAt: null,
        escalationNotifiedAt: null,
        opsResponse: "",
        escalationHistory: [...(d.escalationHistory || []), record],
      };
    }));
    if (d) {
      notifyResponse({
        broker: d.broker,
        clientName: clientName(d.clientId),
        stage: d.stage,
        reason: d.escalationReason,
        opsResponse: d.opsResponse,
        kind: "resolved",
      });
    }
    showToast("Resolved — broker notified by email");
  }

  // Saving a response on blur automatically emails the broker — but only when
  // the text is new (differs from what was last saved), so tabbing out without
  // changing anything won't fire a duplicate email.
  async function saveResponse(dealId: string, text: string) {
    const d = db.deals.find((x) => x.id === dealId);
    const isNew = Boolean(d && text.trim() && text !== (d.opsResponse || ""));
    await mutate("deals", (arr) => arr.map((x) => x.id === dealId ? { ...x, opsResponse: text } : x));
    if (d && isNew) {
      notifyResponse({
        broker: d.broker,
        clientName: clientName(d.clientId),
        stage: d.stage,
        reason: d.escalationReason,
        opsResponse: text,
        kind: "response",
      });
      showToast("Broker notified of your response");
    }
  }

  return (
    <>
      <div className="card">
        <div className="section-title"><h3>Open escalations</h3><span className="muted">{escs.length} flagged, oldest first</span></div>
        {escs.length ? (
          <table>
            <thead><tr><th>Broker</th><th>Client</th><th>Stage</th><th>Time flagged (business hrs)</th><th>Reason / needed</th><th>Your response</th><th></th></tr></thead>
            <tbody>
              {escs.map((d) => {
                const flaggedMinutes = d.escalatedAt ? businessMinutesBetween(d.escalatedAt, nowISO()) : 0;
                return <EscalationRow key={d.id} deal={d} flaggedMinutes={flaggedMinutes} clientName={clientName} onSaveResponse={saveResponse} onResolve={resolve} />;
              })}
            </tbody>
          </table>
        ) : <div className="empty">No open escalations. 🎉</div>}
      </div>
      <div className="card">
        <div className="section-title">
          <h3>Recently resolved</h3>
          <span className="muted">{avgResolutionMinutes !== null ? `Avg resolution time: ${formatBusinessDuration(avgResolutionMinutes)}` : "No resolutions yet"}</span>
        </div>
        {resolved.length ? (
          <table>
            <thead><tr><th>Broker</th><th>Client</th><th>Reason</th><th>Response</th><th>Escalated</th><th>Resolved</th><th>Time to resolve (business hrs)</th></tr></thead>
            <tbody>
              {resolved.slice(0, 25).map((r) => (
                <tr key={r.id}>
                  <td>{r.broker}</td>
                  <td>{clientName(r.clientId)}</td>
                  <td className="muted">{r.reason || "—"}</td>
                  <td className="muted">{r.opsResponse || "—"}</td>
                  <td>{fmtDateTime(r.escalatedAt)}</td>
                  <td>{fmtDateTime(r.resolvedAt)}</td>
                  <td><span className="pill ok">{formatBusinessDuration(businessMinutesBetween(r.escalatedAt, r.resolvedAt))}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">Resolved escalations will show up here, with how long each one took.</div>}
      </div>
    </>
  );
}

function EscalationRow({
  deal, flaggedMinutes, clientName, onSaveResponse, onResolve,
}: {
  deal: TrackerDB["deals"][number]; flaggedMinutes: number; clientName: (id: string) => string;
  onSaveResponse: (dealId: string, text: string) => void;
  onResolve: (dealId: string) => void;
}) {
  const [response, setResponse] = useState(deal.opsResponse || "");
  return (
    <tr>
      <td>{deal.broker}</td>
      <td><b>{clientName(deal.clientId)}</b></td>
      <td><span className="pill">{deal.stage}</span></td>
      <td><span className={`pill ${flaggedMinutes > 3 * 9 * 60 ? "bad" : "warn"}`}>{formatBusinessDuration(flaggedMinutes)}</span></td>
      <td className="muted">{deal.escalationReason || "No reason given"}</td>
      <td>
        <input
          type="text"
          placeholder="Type your response — broker is emailed automatically…"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          onBlur={() => onSaveResponse(deal.id, response)}
        />
      </td>
      <td style={{ textAlign: "right" }}><button className="btn small" onClick={() => onResolve(deal.id)}>Mark Resolved</button></td>
    </tr>
  );
}

function Report({ db, weekOffset, setWeekOffset }: { db: TrackerDB; weekOffset: number; setWeekOffset: (n: number) => void }) {
  const wr = weekRange(weekOffset);
  const rows = db.brokers.map((b) => {
    const touches = db.logs.filter((l) => l.broker === b && inRange(l.date, wr.start, wr.end));
    const open = db.deals.filter((d) => d.broker === b && ACTIVE_STAGES.includes(d.stage));
    const cap = db.capacity.find((c) => c.broker === b && c.weekStart === wr.start);
    const minutes = touches.reduce((sum, l) => sum + (l.timeSpentMinutes || 0), 0);
    return {
      broker: b, touches: touches.length, openDeals: open.length,
      bottlenecks: open.filter((d) => daysBetween(d.stageEnteredDate, todayISO()) > BOTTLENECK_DAYS).length,
      escalations: open.filter((d) => d.escalation).length,
      hoursLogged: (minutes / 60).toFixed(1),
      capStatus: cap?.status ?? "—", capCalls: cap?.callsCapacity ?? "—", capDeals: cap?.dealsCapacity ?? "—",
    };
  });

  function exportCsv() {
    let csv = `Broker,Touches,Hours Logged,Open Deals,Stuck>${BOTTLENECK_DAYS}d,Escalations,Self-Reported Load,Next Wk Calls Capacity,Next Wk Deals Capacity\n`;
    rows.forEach((r) => {
      csv += [r.broker, r.touches, r.hoursLogged, r.openDeals, r.bottlenecks, r.escalations, r.capStatus, r.capCalls, r.capDeals].join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spire-pipeline-report-${wr.start}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("CSV downloaded");
  }

  return (
    <>
      <WeekNav weekOffset={weekOffset} setWeekOffset={setWeekOffset} label={`Week of ${wr.label}`} />
      <div className="card">
        <div className="section-title"><h3>Weekly summary — {wr.label}</h3><button className="btn small" onClick={exportCsv}>Export CSV</button></div>
        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Broker</th><th>Touches</th><th>Hours Logged</th><th>Open deals</th><th>Stuck &gt;{BOTTLENECK_DAYS}d</th><th>Escalations</th><th>Self-reported load</th><th>Next wk capacity (calls/deals)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.broker}>
                  <td><b>{r.broker}</b></td>
                  <td>{r.touches}</td>
                  <td>{r.hoursLogged}</td>
                  <td>{r.openDeals}</td>
                  <td>{r.bottlenecks}</td>
                  <td>{r.escalations}</td>
                  <td>{r.capStatus}</td>
                  <td>{r.capCalls} / {r.capDeals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">No brokers yet.</div>}
      </div>
    </>
  );
}

function ManageBrokers({ db, mutate }: { db: TrackerDB; mutate: Mutate }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [opsEmail, setOpsEmail] = useState("");

  const emailFor = (b: string) => db.brokerContacts.find((c) => c.name === b)?.email ?? "";

  async function add() {
    const trimmed = name.trim();
    const mail = email.trim();
    if (!trimmed) { showToast("Enter a name"); return; }
    if (db.brokers.includes(trimmed)) { showToast("Already on the team"); return; }
    if (mail && !isEmail(mail)) { showToast("That email doesn't look right"); return; }
    await mutate("brokers", (arr) => [...arr, trimmed]);
    if (mail) {
      await mutate("brokerContacts", (arr) => [...arr.filter((c) => c.name !== trimmed), { name: trimmed, email: mail }]);
    }
    setName(""); setEmail("");
    showToast("Broker added");
  }
  async function remove(b: string) {
    await mutate("brokers", (arr) => arr.filter((n) => n !== b));
    await mutate("brokerContacts", (arr) => arr.filter((c) => c.name !== b));
  }
  async function saveEmail(b: string, value: string) {
    const mail = value.trim();
    if (mail && !isEmail(mail)) { showToast("That email doesn't look right"); return; }
    await mutate("brokerContacts", (arr) => {
      const rest = arr.filter((c) => c.name !== b);
      return mail ? [...rest, { name: b, email: mail }] : rest;
    });
  }

  async function addOpsEmail() {
    const mail = opsEmail.trim();
    if (!mail) { showToast("Enter an email"); return; }
    if (!isEmail(mail)) { showToast("That email doesn't look right"); return; }
    if (db.opsRecipients.some((e) => e.toLowerCase() === mail.toLowerCase())) { showToast("Already on the list"); return; }
    await mutate("opsRecipients", (arr) => [...arr, mail]);
    setOpsEmail("");
    showToast("Ops recipient added");
  }
  async function removeOpsEmail(mail: string) {
    await mutate("opsRecipients", (arr) => arr.filter((e) => e !== mail));
  }

  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Escalation alert recipients</h3>
        <p className="muted" style={{ marginTop: 0 }}>These addresses get an email the moment any broker flags a deal for escalation.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <input type="email" value={opsEmail} onChange={(e) => setOpsEmail(e.target.value)} placeholder="ops@spiremortgage.ca" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") addOpsEmail(); }} />
          <button className="btn" onClick={addOpsEmail}>Add</button>
        </div>
        {db.opsRecipients.length ? (
          <table style={{ marginTop: 14 }}>
            <tbody>
              {db.opsRecipients.map((e) => (
                <tr key={e}><td>{e}</td><td style={{ textAlign: "right" }}><button className="x-link" onClick={() => removeOpsEmail(e)}>Remove</button></td></tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty" style={{ padding: "18px 0" }}>No recipients yet — add at least one so escalations get noticed.</div>}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Add a broker</h3>
        <p className="muted" style={{ marginTop: 0 }}>The email is where this broker gets notified when ops responds to their escalations.</p>
        <div className="grid grid-2">
          <div className="field">
            <label>Full name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Broker full name" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="broker@spiremortgage.ca" />
          </div>
        </div>
        <button className="btn" onClick={add}>Add broker</button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Current team ({db.brokers.length})</h3>
        {db.brokers.length ? (
          <table>
            <thead><tr><th>Name</th><th>Email (for notifications)</th><th></th></tr></thead>
            <tbody>
              {db.brokers.map((b) => (
                <BrokerRow key={b} name={b} email={emailFor(b)} onSaveEmail={saveEmail} onRemove={remove} />
              ))}
            </tbody>
          </table>
        ) : <div className="empty">No brokers added yet.</div>}
        <p className="muted" style={{ marginTop: 10 }}>A broker with no email simply won&apos;t receive notifications. Removing a broker only hides them from the check-in screen — their past logs, deals, and history stay in the data.</p>
      </div>
    </>
  );
}

function BrokerRow({
  name, email, onSaveEmail, onRemove,
}: { name: string; email: string; onSaveEmail: (b: string, v: string) => void; onRemove: (b: string) => void }) {
  const [draft, setDraft] = useState(email);
  return (
    <tr>
      <td><b>{name}</b></td>
      <td>
        <input
          type="email"
          value={draft}
          placeholder="add email…"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (draft.trim() !== email) onSaveEmail(name, draft); }}
        />
      </td>
      <td style={{ textAlign: "right" }}><button className="x-link" onClick={() => onRemove(name)}>Remove</button></td>
    </tr>
  );
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
