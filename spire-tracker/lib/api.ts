import { COLLECTIONS, CollectionKey } from "./collections";
import { showToast } from "@/components/Toast";

// Loads every collection in one request.
export async function loadAll(): Promise<Record<string, any[]>> {
  const res = await fetch("/api/data", { cache: "no-store" });
  if (!res.ok) throw new Error("load failed");
  return res.json();
}

// True once we've already redirected to /login for an expired session, so a
// burst of failed saves around the same moment doesn't fire the redirect twice.
let sessionExpiredHandled = false;

function handleSaveFailure(status: number | null) {
  if (status === 401) {
    if (sessionExpiredHandled) return;
    sessionExpiredHandled = true;
    showToast("Session expired — logging you in again. That last change wasn't saved.");
    window.setTimeout(() => {
      window.location.href = "/login?expired=1";
    }, 1500);
    return;
  }
  showToast("Couldn't save your last change — check your connection and try again.");
}

// Persists only what actually changed between the previous and next array —
// a per-record upsert/delete — instead of overwriting the whole collection.
// This is what makes simultaneous editing safe: a save touches one record, so
// a stale browser can no longer wipe everyone else's data. Fire-and-forget from
// the caller's perspective, but a failed save is never silent: it surfaces a
// toast and, for an expired session, sends the user back to /login instead of
// letting them keep typing into a session that can no longer save anything.
export function persistDiff(collection: CollectionKey, before: any[], after: any[]): void {
  const cfg = COLLECTIONS[collection];
  const body: Record<string, unknown> = { collection };

  if (cfg.kind === "set") {
    const b = new Set(before);
    const a = new Set(after);
    const addMembers = after.filter((x) => !b.has(x));
    const removeMembers = before.filter((x) => !a.has(x));
    if (!addMembers.length && !removeMembers.length) return;
    body.addMembers = addMembers;
    body.removeMembers = removeMembers;
  } else {
    const id = cfg.identity!;
    const beforeJson = new Map(before.map((x) => [id(x), JSON.stringify(x)]));
    const afterIds = new Set(after.map(id));
    const upserts = after.filter((x) => beforeJson.get(id(x)) !== JSON.stringify(x));
    const deletes = before.map(id).filter((k) => !afterIds.has(k));
    if (!upserts.length && !deletes.length) return;
    body.upserts = upserts;
    body.deletes = deletes;
  }

  fetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((res) => {
      if (!res.ok) handleSaveFailure(res.status);
    })
    .catch(() => handleSaveFailure(null));
}

// ---- backups ----
export async function listBackups(): Promise<number[]> {
  try {
    const res = await fetch("/api/backups", { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()).backups || [];
  } catch {
    return [];
  }
}

export async function restoreBackup(payload: { ts?: number; data?: unknown }): Promise<boolean> {
  try {
    const res = await fetch("/api/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
}

// Fire-and-forget email triggers. These never throw — a notification problem
// must never block the underlying action (flagging, responding, resolving).
export async function notifyEscalation(payload: {
  broker: string;
  clientName: string;
  stage: string;
  value: number;
  reason: string;
}): Promise<void> {
  try {
    await fetch("/api/notify/escalation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore — notification is best-effort */
  }
}

export async function notifyResponse(payload: {
  broker: string;
  clientName: string;
  stage: string;
  reason: string;
  opsResponse: string;
  kind: "response" | "resolved";
}): Promise<void> {
  try {
    await fetch("/api/notify/response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore — notification is best-effort */
  }
}
