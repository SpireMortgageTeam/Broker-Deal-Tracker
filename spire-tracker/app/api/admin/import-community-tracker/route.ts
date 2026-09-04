import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { Community, CommunityIntel, CallLog, IntelFieldKey } from "@/lib/types";

// One-time (or explicitly forced) import of the standalone
// spire-community-tracker app's data into this app's own Redis, as part of
// retiring that app in favor of this one shared-password tracker — see
// /root/.claude/plans/composed-weaving-parrot.md for the full context.
//
// This route intentionally does NOT run automatically (no GET, and it's
// guarded by a flag) — it's triggered by a button in the Ops "Communities"
// tab. Note: the fetch below only succeeds once this route is actually
// deployed to Vercel; a dev sandbox's outbound network is typically locked
// to an allowlist that won't include an arbitrary third-party Vercel app.

const DEFAULT_SOURCE_URL = "https://spire-community-tracker.vercel.app/api/data";
const IMPORT_FLAG_KEY = "meta:community_import_v1";

// The source app's flat shape: CommunityIntel { communityId, [IntelFieldKey]: IntelValue }
// This app stores intel nested under a "fields" map instead (see lib/types.ts
// for why) — reshape on the way in.
const INTEL_FIELD_KEYS: IntelFieldKey[] = [
  "pricePoints", "propertyTypes",
  "preferredContactMethod", "updateFrequency", "followUpExpectations", "sidewaysCommunication",
  "currentBuyerTypes", "sellingWell", "harderToMove", "financingObjections", "whereBuyersStuck",
  "fallClosingsWorried", "financingReviewNeeded", "appraisalValuationIssues", "challengingModelsLotsUpgrades",
  "whatWouldHelp", "toolsGuidesWishlist",
  "whereDroppedBall", "whatCouldBeBetter", "valuableExtensionVision",
];

function reshapeIntel(flat: any): CommunityIntel {
  const fields: CommunityIntel["fields"] = {};
  for (const key of INTEL_FIELD_KEYS) {
    if (flat[key]) fields[key] = flat[key];
  }
  return { communityId: flat.communityId, fields };
}

export async function GET() {
  // Status check for the Ops UI — not the import itself.
  try {
    const flag = (await redis.get(IMPORT_FLAG_KEY)) as { importedAt: string; counts: Record<string, number> } | null;
    return NextResponse.json({ imported: Boolean(flag), ...flag });
  } catch (err) {
    console.error("import status check failed", err);
    return NextResponse.json({ imported: false });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sourceUrl = typeof body.sourceUrl === "string" && body.sourceUrl ? body.sourceUrl : DEFAULT_SOURCE_URL;
    const force = body.force === true;

    const existing = await redis.get(IMPORT_FLAG_KEY);
    if (existing && !force) {
      return NextResponse.json({ ok: false, error: "Already imported. Pass force:true to re-import (this replaces all community data wholesale)." }, { status: 409 });
    }

    const res = await fetch(sourceUrl);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Source app returned ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const communities: Community[] = Array.isArray(data.communities) ? data.communities : [];
    const intel: any[] = Array.isArray(data.intel) ? data.intel : [];
    const callLogs: CallLog[] = Array.isArray(data.callLogs) ? data.callLogs : [];
    // data.brokers is intentionally ignored — this app already has its own
    // broker roster (db.brokers); we don't want a second, divergent list.

    if (communities.length) {
      const map: Record<string, Community> = {};
      for (const c of communities) map[c.id] = c;
      await redis.hset("h:communities", map);
    }
    if (intel.length) {
      const map: Record<string, CommunityIntel> = {};
      for (const i of intel) {
        const reshaped = reshapeIntel(i);
        map[reshaped.communityId] = reshaped;
      }
      await redis.hset("h:communityintel", map);
    }
    if (callLogs.length) {
      const map: Record<string, CallLog> = {};
      for (const l of callLogs) map[l.id] = l;
      await redis.hset("h:calllogs", map);
    }

    const counts = { communities: communities.length, communityIntel: intel.length, callLogs: callLogs.length };
    await redis.set(IMPORT_FLAG_KEY, { importedAt: new Date().toISOString(), counts });

    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    console.error("community tracker import failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "import failed" }, { status: 500 });
  }
}
