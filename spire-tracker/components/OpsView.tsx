"use client";
import { useState } from "react";
import { TrackerDB } from "@/lib/types";
import { ACTIVE_STAGES, BOTTLENECK_DAYS, CONTACT_TYPES } from "@/lib/constants";
import { todayISO, daysBetween, weekRange, inRange, uid, nowISO, businessMinutesBetween, formatBusinessDuration, fmtDateTime, totalMinutesForDeal } from "@/lib/utils";
import { showToast } from "./Toast";
import FunnelBar from "./FunnelBar";
import TimeEntriesModal from "./TimeEntriesModal";
import SortableTh, { sortRows, makeSortHandler, SortDir } from "./SortableTh";
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
      {tab === "deals" && <AllDeals db={db} mutate={mutate} clientName={clientName} />}
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

function AllDeals({ db, mutate, clientName }: { db: TrackerDB; mutate: Mutate; clientName: (id: string) => string }) {
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>("aging");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const handleSort = makeSortHandler(sortKey, setSortKey, sortDir, setSortDir);
  const openUnsorted = db.deals.filter((d) => ACTIVE_STAGES.includes(d.stage));
  const open = sortRows(openUnsorted, sortKey, sortDir, (d, key) => {
    if (key === "broker") return d.broker;
    if (key === "client") return clientName(d.clientId);
    if (key === "stage") return d.stage;
    if (key === "aging") return daysBetween(d.stageEnteredDate, todayISO());
    if (key === "docs") return d.docStatus;
    if (key === "value") return d.value || 0;
    if (key === "time") return totalMinutesForDeal(db.logs, d.id);
    if (key === "status") return d.escalation ? 1 : 0;
    return "";
  });
  const editingDeal = editingDealId ? db.deals.find((d) => d.id === editingDealId) : null;

  return (
    <div className="card">
      <div className="section-title">
        <h3>All open deals</h3>
        <span className="muted">{open.length} across {db.brokers.length} brokers · click a column to sort</span>
      </div>
      {open.length ? (
        <div className="table-wrap">
        <table>
          <thead><tr>
            <SortableTh label="Broker" sortKey="broker" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortableTh label="Client" sortKey="client" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortableTh label="Stage" sortKey="stage" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortableTh label="Aging" sortKey="aging" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortableTh label="Docs" sortKey="docs" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortableTh label="Value" sortKey="value" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortableTh label="Time Logged" sortKey="time" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortableTh label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
          </tr></thead>
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
                    <button className="x-link" style={{ color: "var(--charcoal)", paddingLeft: 0 }} onClick={() => setEditingDealId(d.id)}>Edit time</button>
                  </td>
                  <td>{d.escalation ? <span className="pill bad">Flagged</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      ) : <div className="empty">No open deals in the pipeline.</div>}
      {editingDeal && (
        <TimeEntriesModal
          dealLabel={`${clientName(editingDeal.clientId)} — ${editingDeal.stage}`}
          logs={db.logs.filter((l) => l.dealId === editingDeal.id)}
          mutate={mutate}
          allowEdit={true}
          onClose={() => setEditingDealId(null)}
        />
      )}
    </div>
  );
}

function Escalations({ db, mutate, clientName }: { db: TrackerDB; mutate: Mutate; clientName: (id: string) => string }) {
  const [openSortKey, setOpenSortKey] = useState<string | null>("flagged");
  const [openSortDir, setOpenSortDir] = useState<SortDir>("desc");
  const handleOpenSort = makeSortHandler(openSortKey, setOpenSortKey, openSortDir, setOpenSortDir);

  const [resolvedSortKey, setResolvedSortKey] = useState<string | null>("resolvedAt");
  const [resolvedSortDir, setResolvedSortDir] = useState<SortDir>("desc");
  const handleResolvedSort = makeSortHandler(resolvedSortKey, setResolvedSortKey, resolvedSortDir, setResolvedSortDir);

  const escsUnsorted = db.deals.filter((d) => d.escalation);
  const escs = sortRows(escsUnsorted, openSortKey, openSortDir, (d, key) => {
    if (key === "broker") return d.broker;
    if (key === "client") return clientName(d.clientId);
    if (key === "stage") return d.stage;
    if (key === "flagged") return d.escalatedAt ? businessMinutesBetween(d.escalatedAt, nowISO()) : 0;
    return "";
  });

  const resolvedUnsorted = db.deals
    .flatMap((d) => (d.escalationHistory || []).map((r) => ({ ...r, broker: d.broker, clientId: d.clientId })));
  const resolved = sortRows(resolvedUnsorted, resolvedSortKey, resolvedSortDir, (r, key) => {
    if (key === "broker") return r.broker;
    if (key === "client") return clientName(r.clientId);
    if (key === "escalatedAt") return r.escalatedAt;
    if (key === "resolvedAt") return r.resolvedAt;
    if (key === "time") return businessMinutesBetween(r.escalatedAt, r.resolvedAt);
    return "";
  });
  const avgResolutionMinutes = resolved.length
    ? resolved.reduce((sum, r) => sum + businessMinutesBetween(r.escalatedAt, r.resolvedAt), 0) / resolved.length
    : null;

  async function resolve(dealId: string) {
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
        opsResponse: "",
        escalationHistory: [...(d.escalationHistory || []), record],
      };
    }));
    showToast("Escalation marked resolved");
  }

  async function saveResponse(dealId: string, text: string) {
    await mutate("deals", (arr) => arr.map((d) => d.id === dealId ? { ...d, opsResponse: text } : d));
  }

  return (
    <>
      <div className="card">
        <div className="section-title"><h3>Open escalations</h3><span className="muted">{escs.length} flagged · click a column to sort</span></div>
        {escs.length ? (
          <div className="table-wrap">
          <table>
            <thead><tr>
              <SortableTh label="Broker" sortKey="broker" currentKey={openSortKey} currentDir={openSortDir} onSort={handleOpenSort} />
              <SortableTh label="Client" sortKey="client" currentKey={openSortKey} currentDir={openSortDir} onSort={handleOpenSort} />
              <SortableTh label="Stage" sortKey="stage" currentKey={openSortKey} currentDir={openSortDir} onSort={handleOpenSort} />
              <SortableTh label="Time flagged (business hrs)" sortKey="flagged" currentKey={openSortKey} currentDir={openSortDir} onSort={handleOpenSort} />
              <th>Reason / needed</th><th>Your response</th><th></th>
            </tr></thead>
            <tbody>
              {escs.map((d) => {
                const flaggedMinutes = d.escalatedAt ? businessMinutesBetween(d.escalatedAt, nowISO()) : 0;
                return <EscalationRow key={d.id} deal={d} flaggedMinutes={flaggedMinutes} clientName={clientName} onSaveResponse={saveResponse} onResolve={resolve} />;
              })}
            </tbody>
          </table>
          </div>
        ) : <div className="empty">No open escalations. 🎉</div>}
      </div>
      <div className="card">
        <div className="section-title">
          <h3>Recently resolved</h3>
          <span className="muted">{avgResolutionMinutes !== null ? `Avg resolution time: ${formatBusinessDuration(avgResolutionMinutes)}` : "No resolutions yet"}</span>
        </div>
        {resolved.length ? (
          <div className="table-wrap">
          <table>
            <thead><tr>
              <SortableTh label="Broker" sortKey="broker" currentKey={resolvedSortKey} currentDir={resolvedSortDir} onSort={handleResolvedSort} />
              <SortableTh label="Client" sortKey="client" currentKey={resolvedSortKey} currentDir={resolvedSortDir} onSort={handleResolvedSort} />
              <th>Reason</th><th>Response</th>
              <SortableTh label="Escalated" sortKey="escalatedAt" currentKey={resolvedSortKey} currentDir={resolvedSortDir} onSort={handleResolvedSort} />
              <SortableTh label="Resolved" sortKey="resolvedAt" currentKey={resolvedSortKey} currentDir={resolvedSortDir} onSort={handleResolvedSort} />
              <SortableTh label="Time to resolve (business hrs)" sortKey="time" currentKey={resolvedSortKey} currentDir={resolvedSortDir} onSort={handleResolvedSort} />
            </tr></thead>
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
          </div>
        ) : <div className="empty">Resolved escalations will show up here, with how long each one took.</div>}
      </div>
    </>
  );
}

function EscalationRow({
  deal, flaggedMinutes, clientName, onSaveResponse, onResolve,
}: {
  deal: TrackerDB["deals"][number]; flaggedMinutes: number; clientName: (id: string) => string;
  onSaveResponse: (dealId: string, text: string) => void; onResolve: (dealId: string) => void;
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
          placeholder="Type your response…"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          onBlur={() => onSaveResponse(deal.id, response)}
        />
      </td>
      <td><button className="btn small" onClick={() => onResolve(deal.id)}>Mark Resolved</button></td>
    </tr>
  );
}

function Report({ db, weekOffset, setWeekOffset }: { db: TrackerDB; weekOffset: number; setWeekOffset: (n: number) => void }) {
  const wr = weekRange(weekOffset);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const handleSort = makeSortHandler(sortKey, setSortKey, sortDir, setSortDir);
  const rowsUnsorted = db.brokers.map((b) => {
    const touches = db.logs.filter((l) => l.broker === b && inRange(l.date, wr.start, wr.end));
    const open = db.deals.filter((d) => d.broker === b && ACTIVE_STAGES.includes(d.stage));
    const cap = db.capacity.find((c) => c.broker === b && c.weekStart === wr.start);
    const minutes = touches.reduce((sum, l) => sum + (l.timeSpentMinutes || 0), 0);
    return {
      broker: b, touches: touches.length, openDeals: open.length,
      bottlenecks: open.filter((d) => daysBetween(d.stageEnteredDate, todayISO()) > BOTTLENECK_DAYS).length,
      escalations: open.filter((d) => d.escalation).length,
      hoursLogged: (minutes / 60).toFixed(1),
      hoursLoggedNum: minutes / 60,
      capStatus: cap?.status ?? "—", capCalls: cap?.callsCapacity ?? "—", capDeals: cap?.dealsCapacity ?? "—",
      comments: cap?.comments ?? "",
    };
  });
  const rows = sortRows(rowsUnsorted, sortKey, sortDir, (r, key) => {
    if (key === "broker") return r.broker;
    if (key === "touches") return r.touches;
    if (key === "hours") return r.hoursLoggedNum;
    if (key === "openDeals") return r.openDeals;
    if (key === "bottlenecks") return r.bottlenecks;
    if (key === "escalations") return r.escalations;
    if (key === "capStatus") return r.capStatus;
    return "";
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
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortableTh label="Broker" sortKey="broker" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableTh label="Touches" sortKey="touches" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableTh label="Hours Logged" sortKey="hours" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableTh label="Open deals" sortKey="openDeals" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableTh label={`Stuck >${BOTTLENECK_DAYS}d`} sortKey="bottlenecks" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableTh label="Escalations" sortKey="escalations" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableTh label="Self-reported load" sortKey="capStatus" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th>Next wk capacity (calls/deals)</th>
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
          </div>
        ) : <div className="empty">No brokers yet.</div>}
      </div>
      <div className="card">
        <div className="section-title"><h3>Capacity comments — {wr.label}</h3><span className="muted">Roadblocks and support needed, from each broker's weekly check-in</span></div>
        {rows.filter((r) => r.comments.trim()).length ? (
          <div className="table-wrap">
          <table>
            <thead><tr>
              <SortableTh label="Broker" sortKey="broker" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableTh label="Self-reported load" sortKey="capStatus" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <th>Comments</th>
            </tr></thead>
            <tbody>
              {rows.filter((r) => r.comments.trim()).map((r) => (
                <tr key={r.broker}>
                  <td><b>{r.broker}</b></td>
                  <td><span className={`pill ${r.capStatus === "At Capacity" ? "bad" : r.capStatus === "Moderate" ? "warn" : "ok"}`}>{r.capStatus}</span></td>
                  <td>{r.comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <div className="empty">No comments left in anyone's check-in this week.</div>
        )}
      </div>
    </>
  );
}

function ManageBrokers({ db, mutate }: { db: TrackerDB; mutate: Mutate }) {
  const [name, setName] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const sortedBrokers = sortRows(db.brokers, "name", sortDir, (b) => b);
  const handleSort = (_key: string) => setSortDir(sortDir === "asc" ? "desc" : "asc");

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) { showToast("Enter a name"); return; }
    if (db.brokers.includes(trimmed)) { showToast("Already on the team"); return; }
    await mutate("brokers", (arr) => [...arr, trimmed]);
    setName("");
    showToast("Broker added");
  }
  async function remove(b: string) {
    await mutate("brokers", (arr) => arr.filter((n) => n !== b));
  }

  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Add a broker</h3>
        <div style={{ display: "flex", gap: 10 }}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Broker full name" style={{ flex: 1 }} />
          <button className="btn" onClick={add}>Add</button>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Current team ({db.brokers.length})</h3>
        {db.brokers.length ? (
          <div className="table-wrap">
          <table>
            <thead><tr><SortableTh label="Name" sortKey="name" currentKey="name" currentDir={sortDir} onSort={handleSort} /><th></th></tr></thead>
            <tbody>
              {sortedBrokers.map((b) => (
                <tr key={b}><td>{b}</td><td><button className="x-link" onClick={() => remove(b)}>Remove</button></td></tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : <div className="empty">No brokers added yet.</div>}
        <p className="muted" style={{ marginTop: 10 }}>Removing a broker only hides them from the check-in screen — their past logs, deals, and history stay in the data.</p>
      </div>
    </>
  );
}
