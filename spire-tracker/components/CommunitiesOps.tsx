"use client";
import { useEffect, useState } from "react";
import { Community, CommunityStatus, TrackerDB } from "@/lib/types";
import { uid, fmtDateTime } from "@/lib/utils";
import { showToast } from "./Toast";
import CommunityDetailModal from "./CommunityDetailModal";
import SortableTh, { sortRows, makeSortHandler, SortDir } from "./SortableTh";
import type { Mutate } from "@/app/page";

const STATUSES: CommunityStatus[] = ["Open", "Coming Soon", "Closed"];

export default function CommunitiesOps({ db, mutate }: { db: TrackerDB; mutate: Mutate }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const handleSort = makeSortHandler(sortKey, setSortKey, sortDir, setSortDir);

  const sorted = sortRows(db.communities, sortKey, sortDir, (c, key) => {
    if (key === "name") return c.name;
    if (key === "status") return c.status;
    if (key === "city") return c.city;
    if (key === "broker") return c.assignedBroker || "";
    return "";
  });

  const openCommunity = openId ? db.communities.find((c) => c.id === openId) : null;

  async function reassign(id: string, broker: string) {
    await mutate("communities", (arr: TrackerDB["communities"]) =>
      arr.map((c) => (c.id === id ? { ...c, assignedBroker: broker || null } : c))
    );
  }

  return (
    <>
      <ImportPanel />

      <div className="card">
        <div className="section-title">
          <h3>All communities ({db.communities.length})</h3>
          <button className="btn small" onClick={() => setShowAdd(true)}>+ Add community</button>
        </div>
        {sorted.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <SortableTh label="Name" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableTh label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableTh label="City" sortKey="city" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableTh label="Broker" sortKey="broker" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th></th>
              </tr></thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.id}>
                    <td onClick={() => setOpenId(c.id)} style={{ cursor: "pointer" }}><b>{c.name}</b></td>
                    <td><span className={`pill ${c.status === "Open" ? "ok" : c.status === "Closed" ? "bad" : "warn"}`}>{c.status}</span></td>
                    <td className="muted">{c.city}</td>
                    <td>
                      <select className="inline-select" value={c.assignedBroker || ""} onChange={(e) => reassign(c.id, e.target.value)}>
                        <option value="">Unassigned</option>
                        {db.brokers.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </td>
                    <td><button className="x-link" onClick={() => setOpenId(c.id)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">No communities yet — import from the old tracker above, or add one manually.</div>
        )}
      </div>

      {openCommunity && (
        <CommunityDetailModal
          community={openCommunity}
          intel={db.communityIntel.find((i) => i.communityId === openCommunity.id)}
          callLogs={db.callLogs.filter((l) => l.communityId === openCommunity.id)}
          brokers={db.brokers}
          currentBroker="Ops"
          allowReassign
          mutate={mutate}
          onClose={() => setOpenId(null)}
        />
      )}

      {showAdd && <AddCommunityModal mutate={mutate} onClose={() => setShowAdd(false)} />}
    </>
  );
}

function ImportPanel() {
  const [status, setStatus] = useState<{ imported: boolean; importedAt?: string; counts?: Record<string, number> } | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/import-community-tracker")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ imported: false }));
  }, []);

  async function runImport(force: boolean) {
    if (force && !confirm("This replaces ALL community, intel, and call-log data with a fresh copy from the old tracker — any edits made here since the last import will be lost. Continue?")) {
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/admin/import-community-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Imported ${data.counts.communities} communities`);
        setStatus({ imported: true, importedAt: new Date().toISOString(), counts: data.counts });
        // Reload so the freshly-imported records show up in db without
        // requiring a manual per-record mutate() for a bulk server-side write.
        window.location.reload();
      } else {
        showToast(data.error || "Import failed");
      }
    } catch {
      showToast("Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="card">
      <div className="section-title">
        <h3>Community Tracker import</h3>
      </div>
      {status?.imported ? (
        <>
          <p className="muted">
            Imported {status.importedAt ? fmtDateTime(status.importedAt) : ""}
            {status.counts ? ` — ${status.counts.communities} communities, ${status.counts.communityIntel} intel records, ${status.counts.callLogs} call logs.` : ""}
          </p>
          <button className="btn secondary small" disabled={importing} onClick={() => runImport(true)}>
            {importing ? "Re-importing…" : "Re-import (replaces everything)"}
          </button>
        </>
      ) : (
        <>
          <p className="muted">Pull communities, intel, and call logs from the old spire-community-tracker app one time.</p>
          <button className="btn small" disabled={importing} onClick={() => runImport(false)}>
            {importing ? "Importing…" : "Import now"}
          </button>
        </>
      )}
    </div>
  );
}

function AddCommunityModal({ mutate, onClose }: { mutate: Mutate; onClose: () => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<CommunityStatus>("Open");
  const [showhomeAddress, setShowhomeAddress] = useState("");
  const [showhomeModel, setShowhomeModel] = useState("");
  const [showhomePhone, setShowhomePhone] = useState("");
  const [areaManagerName, setAreaManagerName] = useState("");
  const [areaManagerPhone, setAreaManagerPhone] = useState("");
  const [areaManagerEmail, setAreaManagerEmail] = useState("");

  async function save() {
    if (!name.trim()) {
      showToast("Community name is required");
      return;
    }
    const newCommunity: Community = {
      id: uid(),
      name: name.trim(),
      status,
      city: city.trim(),
      showhomeAddress: showhomeAddress.trim(),
      showhomeModel: showhomeModel.trim(),
      showhomePhone: showhomePhone.trim(),
      areaManagerName: areaManagerName.trim(),
      areaManagerPhone: areaManagerPhone.trim(),
      areaManagerEmail: areaManagerEmail.trim(),
      associates: [],
      newSAStartDate: null,
      probationEndDate: null,
      assignedBroker: null,
      spreadsheetNotes: "",
      createdAt: new Date().toISOString(),
    };
    await mutate("communities", (arr: TrackerDB["communities"]) => [...arr, newCommunity]);
    showToast("Community added");
    onClose();
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <h3>Add community</h3>
        <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        <div className="grid grid-2">
          <div className="field"><label>City</label><input value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as CommunityStatus)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>Showhome address</label><input value={showhomeAddress} onChange={(e) => setShowhomeAddress(e.target.value)} /></div>
        <div className="grid grid-2">
          <div className="field"><label>Showhome model</label><input value={showhomeModel} onChange={(e) => setShowhomeModel(e.target.value)} /></div>
          <div className="field"><label>Showhome phone</label><input value={showhomePhone} onChange={(e) => setShowhomePhone(e.target.value)} /></div>
        </div>
        <div className="field"><label>Area manager name</label><input value={areaManagerName} onChange={(e) => setAreaManagerName(e.target.value)} /></div>
        <div className="grid grid-2">
          <div className="field"><label>Area manager phone</label><input value={areaManagerPhone} onChange={(e) => setAreaManagerPhone(e.target.value)} /></div>
          <div className="field"><label>Area manager email</label><input value={areaManagerEmail} onChange={(e) => setAreaManagerEmail(e.target.value)} /></div>
        </div>
        <div className="flexend">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Add community</button>
        </div>
      </div>
    </div>
  );
}
