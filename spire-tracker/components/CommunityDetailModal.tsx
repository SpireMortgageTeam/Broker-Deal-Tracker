"use client";
import { Fragment, useState } from "react";
import { Community, CommunityIntel, CallLog, CallSource, IntelFieldKey, IntelValue, TrackerDB } from "@/lib/types";
import { INTEL_CATEGORIES, INTEL_FIELD_LABELS } from "@/lib/intelFields";
import { uid, nowISO, fmtDate, fmtDateTime, todayISO } from "@/lib/utils";
import { showToast } from "./Toast";
import type { Mutate } from "@/app/page";

const CALL_SOURCES: CallSource[] = ["Plaud", "Manual notes", "In-person", "Other"];

function upsertIntelFields(
  arr: CommunityIntel[],
  communityId: string,
  updates: Partial<Record<IntelFieldKey, IntelValue>>
): CommunityIntel[] {
  const existing = arr.find((i) => i.communityId === communityId);
  if (!existing) {
    return [...arr, { communityId, fields: updates }];
  }
  return arr.map((i) =>
    i.communityId === communityId ? { ...i, fields: { ...i.fields, ...updates } } : i
  );
}

export default function CommunityDetailModal({
  community, intel, callLogs, brokers, currentBroker, allowReassign, mutate, onClose,
}: {
  community: Community;
  intel: CommunityIntel | undefined;
  callLogs: CallLog[]; // already filtered to this community
  brokers: string[];
  currentBroker: string; // who's viewing — default "updated by" / call broker
  allowReassign: boolean;
  mutate: Mutate;
  onClose: () => void;
}) {
  const [editingField, setEditingField] = useState<IntelFieldKey | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [showAddCall, setShowAddCall] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const sortedLogs = [...callLogs].sort((a, b) => (a.date < b.date ? 1 : -1));

  async function reassign(broker: string) {
    await mutate("communities", (arr: TrackerDB["communities"]) =>
      arr.map((c) => (c.id === community.id ? { ...c, assignedBroker: broker || null } : c))
    );
  }

  function startEdit(field: IntelFieldKey) {
    setEditingField(field);
    setDraftValue(intel?.fields[field]?.value || "");
  }

  async function saveField(field: IntelFieldKey) {
    const trimmed = draftValue.trim();
    setEditingField(null);
    await mutate("communityIntel", (arr: TrackerDB["communityIntel"]) =>
      upsertIntelFields(arr, community.id, {
        [field]: { value: trimmed, updatedAt: nowISO(), updatedBy: currentBroker, callId: null },
      })
    );
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 720, maxHeight: "86vh", overflowY: "auto" }}>
        <div className="section-title">
          <h3 style={{ marginBottom: 2 }}>{community.name}</h3>
          <span className={`pill ${community.status === "Open" ? "ok" : community.status === "Closed" ? "bad" : "warn"}`}>
            {community.status}
          </span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          {community.city} · {community.showhomeAddress} · {community.showhomeModel}
          {community.showhomePhone ? ` · ${community.showhomePhone}` : ""}
        </p>

        <div className="grid grid-2" style={{ marginBottom: 16 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Area manager</div>
            <div>{community.areaManagerName || "—"}</div>
            <div className="muted">{community.areaManagerPhone}{community.areaManagerPhone && community.areaManagerEmail ? " · " : ""}{community.areaManagerEmail}</div>
            {community.associates.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Associates</div>
                {community.associates.map((a, i) => (
                  <div key={i} className="muted">{a.name} — {a.phone}{a.phone && a.email ? " · " : ""}{a.email}</div>
                ))}
              </div>
            )}
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Assigned broker</div>
            {allowReassign ? (
              <select className="inline-select" value={community.assignedBroker || ""} onChange={(e) => reassign(e.target.value)}>
                <option value="">Unassigned</option>
                {brokers.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            ) : (
              <div>{community.assignedBroker || "—"}</div>
            )}
            {community.spreadsheetNotes && (
              <div className="muted" style={{ marginTop: 8, fontStyle: "italic" }}>&ldquo;{community.spreadsheetNotes}&rdquo;</div>
            )}
          </div>
        </div>

        <h4 style={{ marginBottom: 8 }}>Relationship intel</h4>
        {INTEL_CATEGORIES.map((cat) => (
          <div key={cat.label} className="card" style={{ margin: "0 0 10px" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{cat.label}</div>
            {cat.fields.map((field) => {
              const iv = intel?.fields[field];
              return (
                <div key={field} style={{ marginBottom: 10 }}>
                  <div className="muted" style={{ fontSize: 12 }}>{INTEL_FIELD_LABELS[field]}</div>
                  {editingField === field ? (
                    <div>
                      <textarea
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        style={{ width: "100%", minHeight: 60 }}
                        autoFocus
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button className="btn small" onClick={() => saveField(field)}>Save</button>
                        <button className="btn secondary small" onClick={() => setEditingField(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => startEdit(field)} style={{ cursor: "pointer" }}>
                      {iv?.value ? <span>{iv.value}</span> : <span className="muted">Not yet captured — click to add</span>}
                      {iv?.updatedAt && (
                        <div className="muted" style={{ fontSize: 11 }}>
                          Updated by {iv.updatedBy || "—"} on {fmtDate(iv.updatedAt.slice(0, 10))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="section-title">
          <h4>Call log</h4>
          <button className="btn small" onClick={() => setShowAddCall((v) => !v)}>
            {showAddCall ? "Cancel" : "Log a call"}
          </button>
        </div>

        {showAddCall && (
          <AddCallForm
            community={community}
            brokers={brokers}
            currentBroker={currentBroker}
            mutate={mutate}
            onDone={() => setShowAddCall(false)}
          />
        )}

        {sortedLogs.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Broker</th><th>Source</th><th>Summary</th><th>Fields</th><th></th></tr></thead>
              <tbody>
                {sortedLogs.map((log) => (
                  <Fragment key={log.id}>
                    <tr>
                      <td>{fmtDate(log.date)}</td>
                      <td>{log.broker}</td>
                      <td><span className="pill">{log.source}</span></td>
                      <td>{log.summary}</td>
                      <td><span className="pill">{log.fieldsUpdated.length}</span></td>
                      <td>
                        {log.transcript && (
                          <button className="x-link" onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}>
                            {expandedLogId === log.id ? "Hide" : "Transcript"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedLogId === log.id && log.transcript && (
                      <tr>
                        <td colSpan={6} className="muted" style={{ whiteSpace: "pre-wrap" }}>{log.transcript}</td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">No calls logged yet.</div>
        )}

        <div className="flexend" style={{ marginTop: 16 }}>
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function AddCallForm({
  community, brokers, currentBroker, mutate, onDone,
}: {
  community: Community; brokers: string[]; currentBroker: string; mutate: Mutate; onDone: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [broker, setBroker] = useState(currentBroker);
  const [source, setSource] = useState<CallSource>("Plaud");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [checked, setChecked] = useState<Partial<Record<IntelFieldKey, string>>>({});
  const [saving, setSaving] = useState(false);

  function toggleField(field: IntelFieldKey) {
    setChecked((prev) => {
      const next = { ...prev };
      if (field in next) delete next[field];
      else next[field] = "";
      return next;
    });
  }

  async function submit() {
    if (!summary.trim()) {
      showToast("A short summary is required");
      return;
    }
    setSaving(true);
    try {
      const fieldsUpdated = Object.keys(checked) as IntelFieldKey[];
      const newLog: CallLog = {
        id: uid(),
        communityId: community.id,
        broker,
        date,
        source,
        transcript: transcript.trim(),
        summary: summary.trim(),
        fieldsUpdated,
        createdAt: nowISO(),
      };
      await mutate("callLogs", (arr: TrackerDB["callLogs"]) => [...arr, newLog]);

      const updates: Partial<Record<IntelFieldKey, IntelValue>> = {};
      for (const field of fieldsUpdated) {
        const value = (checked[field] || "").trim();
        if (value) {
          updates[field] = { value, updatedAt: nowISO(), updatedBy: broker, callId: newLog.id };
        }
      }
      if (Object.keys(updates).length) {
        await mutate("communityIntel", (arr: TrackerDB["communityIntel"]) => upsertIntelFields(arr, community.id, updates));
      }
      showToast("Call logged");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="grid grid-2">
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Broker</label>
          <select value={broker} onChange={(e) => setBroker(e.target.value)}>
            {brokers.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value as CallSource)}>
            {CALL_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Summary (required)</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} style={{ minHeight: 50 }} />
      </div>
      <div className="field">
        <label>Transcript / notes (optional)</label>
        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} style={{ minHeight: 70 }} />
      </div>
      <div className="field">
        <label>Which fields did this call update?</label>
        {INTEL_CATEGORIES.map((cat) => (
          <div key={cat.label} style={{ marginBottom: 8 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>{cat.label}</div>
            {cat.fields.map((field) => (
              <div key={field} className="checkrow">
                <input
                  type="checkbox"
                  checked={field in checked}
                  onChange={() => toggleField(field)}
                  id={`chk-${field}`}
                />
                <label htmlFor={`chk-${field}`} style={{ minWidth: 200 }}>{INTEL_FIELD_LABELS[field]}</label>
                {field in checked && (
                  <input
                    type="text"
                    value={checked[field] || ""}
                    onChange={(e) => setChecked((prev) => ({ ...prev, [field]: e.target.value }))}
                    placeholder="new value"
                    style={{ flex: 1 }}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save call"}</button>
        <button className="btn secondary" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}
