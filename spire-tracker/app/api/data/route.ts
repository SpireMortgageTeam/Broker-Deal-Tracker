import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { COLLECTIONS, COLLECTION_KEYS, CollectionKey } from "@/lib/collections";

// ---- helpers ---------------------------------------------------------------

export async function loadCollection(key: CollectionKey): Promise<any[]> {
  const cfg = COLLECTIONS[key];
  if (cfg.kind === "hash") {
    const h = (await redis.hgetall(cfg.redisKey)) as Record<string, any> | null;
    if (!h) return [];
    return Object.values(h).map((v) => (typeof v === "string" ? JSON.parse(v) : v));
  }
  const s = (await redis.smembers(cfg.redisKey)) as any[];
  return (s || []).map((x) => (typeof x === "string" ? x : String(x)));
}

async function loadAllCollections(): Promise<Record<string, any[]>> {
  const out: Record<string, any[]> = {};
  for (const key of COLLECTION_KEYS) out[key] = await loadCollection(key);
  return out;
}

// One-time move from the old single-array keys into per-record storage.
// Guarded by a flag so it can never re-run and resurrect stale data after
// real writes have started.
async function migrateIfNeeded() {
  if (await redis.get("meta:migrated_v1")) return;
  for (const key of COLLECTION_KEYS) {
    const cfg = COLLECTIONS[key];
    const legacy = await redis.get(cfg.legacyKey);
    const arr = Array.isArray(legacy) ? legacy : [];
    if (!arr.length) continue;
    if (cfg.kind === "hash") {
      const map: Record<string, any> = {};
      for (const item of arr) map[cfg.identity!(item)] = item;
      if (Object.keys(map).length) await redis.hset(cfg.redisKey, map);
    } else {
      const members = arr as string[];
      await redis.sadd(cfg.redisKey, members[0], ...members.slice(1));
    }
  }
  await redis.set("meta:migrated_v1", "1");
}

// ---- automatic backups -----------------------------------------------------

const SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000; // at most one snapshot per hour
const SNAPSHOTS_TO_KEEP = 72; // ~3 days of hourly snapshots

async function maybeSnapshot() {
  try {
    const last = Number(await redis.get("backups:last_ts")) || 0;
    if (Date.now() - last < SNAPSHOT_INTERVAL_MS) return;
    await redis.set("backups:last_ts", Date.now()); // claim the slot first

    const ts = Date.now();
    const data = await loadAllCollections();
    await redis.set(`backups:data:${ts}`, data);

    const index = ((await redis.get("backups:index")) as number[]) || [];
    index.push(ts);
    const keep = index.slice(-SNAPSHOTS_TO_KEEP);
    const evicted = index.slice(0, Math.max(0, index.length - SNAPSHOTS_TO_KEEP));
    for (const old of evicted) await redis.del(`backups:data:${old}`);
    await redis.set("backups:index", keep);
  } catch (err) {
    console.error("snapshot failed", err);
  }
}

// ---- routes ----------------------------------------------------------------

export async function GET() {
  try {
    await migrateIfNeeded();
    return NextResponse.json(await loadAllCollections());
  } catch (err) {
    console.error("data GET failed", err);
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const collection = body.collection as CollectionKey;
    const cfg = COLLECTIONS[collection];
    if (!cfg) return NextResponse.json({ error: "Unknown collection" }, { status: 400 });

    if (cfg.kind === "hash") {
      if (Array.isArray(body.upserts) && body.upserts.length) {
        const map: Record<string, any> = {};
        for (const item of body.upserts) map[cfg.identity!(item)] = item;
        await redis.hset(cfg.redisKey, map);
      }
      if (Array.isArray(body.deletes) && body.deletes.length) {
        await redis.hdel(cfg.redisKey, ...body.deletes);
      }
    } else {
      if (Array.isArray(body.addMembers) && body.addMembers.length) {
        await redis.sadd(cfg.redisKey, body.addMembers[0], ...body.addMembers.slice(1));
      }
      if (Array.isArray(body.removeMembers) && body.removeMembers.length) {
        await redis.srem(cfg.redisKey, ...body.removeMembers);
      }
    }

    await maybeSnapshot();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("data POST failed", err);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
