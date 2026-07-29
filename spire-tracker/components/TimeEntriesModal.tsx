"use client";
import { useState } from "react";
import { ContactLog, TrackerDB } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { showToast } from "./Toast";
import type { Mutate } from "@/app/page";

export default function TimeEntriesModal({
  dealLabel, logs, mutate, allowEdit, onClose,
}: {
  dealLabel: string;
  logs: ContactLog[];
  mutate: Mutate;
  allowEdit: boolean;
  onClose: () => void;
}) {
  const sorted = logs.slice().sort((a, b) => b.date.localeCompare(a.date));

  async function deleteEntry(id: string) {
    await mutate("logs", (arr: TrackerDB["logs"]) => arr.filter((l) => l.id !== id));
    showToast("Entry deleted");
  }

  async function updateMinutes(id: string, minutes: number) {
    await mutate("logs", (arr: TrackerDB["logs"]) => arr.map((l) => l.id === id ? { ...l, timeSpentMinutes: minutes } : l));
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <h3 style={{ marginBottom: 4 }}>Time entries — {dealLabel}</h3>
        <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>
          {allowEdit ? "You can correct a mistaken entry's time or remove it entirely." : "Remove an entry if it was logged by mistake."}
        </p>
        {sorted.length ? (
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Stage</th><th>Time</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {sorted.map((l) => (
                <EntryRow key={l.id} log={l} allowEdit={allowEdit} onUpdateMinutes={updateMinutes} onDelete={deleteEntry} />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">No time entries logged against this deal yet.</div>
        )}
        <div className="flexend">
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function EntryRow({
  log, allowEdit, onUpdateMinutes, onDelete,
}: {
  log: ContactLog; allowEdit: boolean;
  onUpdateMinutes: (id: string, minutes: number) => void;
  onDelete: (id: string) => void;
}) {
  const [minutes, setMinutes] = useState(log.timeSpentMinutes);
  return (
    <tr>
      <td>{fmtDate(log.date)}</td>
      <td><span className="pill">{log.type}</span></td>
      <td className="muted">{log.stageAtLog || "—"}</td>
      <td>
        {allowEdit ? (
          <input
            type="number"
            min="0"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            onBlur={() => { if (minutes !== log.timeSpentMinutes) onUpdateMinutes(log.id, minutes); }}
            style={{ width: 70, display: "inline-block" }}
          />
        ) : (
          <span>{log.timeSpentMinutes} min</span>
        )}
      </td>
      <td className="muted">{log.notes || "—"}</td>
      <td><button className="x-link" onClick={() => onDelete(log.id)}>Delete</button></td>
    </tr>
  );
}
