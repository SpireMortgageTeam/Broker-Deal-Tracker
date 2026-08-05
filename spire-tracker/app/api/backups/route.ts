import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { COLLECTIONS, COLLECTION_KEYS } from "@/lib/collections";

// Replaces the entire dataset with the provided snapshot. Used by "restore".
async function restoreAll(data: Record<string, any[]>) {
  for (const key of COLLECTION_KEYS) {
    const cfg = COLLECTIONS[key];
    const arr = Array.isArray(data?.[key]) ? data[key] : [];
    await redis.del(cfg.redisKey);
    if (cfg.kind === "hash") {
      if (arr.length) {
        const map: Record<string, any> = {};
        for (const item of arr) map[cfg.identity!(item)] = item;
        await redis.hset(cfg.redisKey, map);
      }
    } else if (arr.length) {
      const members = arr as string[];
      await redis.sadd(cfg.redisKey, members[0], ...members.slice(1));
    }
  }
}

// GET -> list available automatic snapshot timestamps (newest first)
export async function GET() {
  try {
    const index = ((await redis.get("backups:index")) as number[]) || [];
    return NextResponse.json({ backups: index.slice().sort((a, b) => b - a) });
  } catch (err) {
    console.error("backups GET failed", err);
    return NextResponse.json({ error: "list failed" }, { status: 500 });
  }
}

// POST { ts } -> restore an automatic snapshot
// POST { data } -> restore an uploaded export file
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.ts) {
      const snap = (await redis.get(`backups:data:${body.ts}`)) as Record<string, any[]> | null;
      if (!snap) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
      await restoreAll(snap);
      return NextResponse.json({ ok: true, restored: "snapshot" });
    }
    if (body.data && typeof body.data === "object") {
      await restoreAll(body.data);
      return NextResponse.json({ ok: true, restored: "upload" });
    }
    return NextResponse.json({ error: "Provide ts or data" }, { status: 400 });
  } catch (err) {
    console.error("backups POST failed", err);
    return NextResponse.json({ error: "restore failed" }, { status: 500 });
  }
}
