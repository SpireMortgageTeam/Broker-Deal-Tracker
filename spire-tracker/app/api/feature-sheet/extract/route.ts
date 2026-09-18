import { NextRequest, NextResponse } from "next/server";
import { generateEmailDraft } from "@/lib/claude";
import { FEATURE_SHEET_EXTRACTOR_PROMPT } from "@/lib/prompts/featureSheetExtractor";

interface ExtractedUnit {
  name: string;
  price: number;
  type: string;
  layout: string;
  size: string;
  condoFee: number;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Already covered by proxy.ts's session-cookie gate (same as every other
// /api/* route in this app) — no separate auth needed here.
export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (typeof text !== "string" || text.trim().length < 10) {
      return NextResponse.json({ ok: false, error: "Paste the rep's info first." });
    }

    const result = await generateEmailDraft(FEATURE_SHEET_EXTRACTOR_PROMPT, [{ role: "user", content: text.trim() }]);
    const fallbackError = "Couldn't parse that — fill the fields in by hand below.";
    if (!result.ok || !result.text) {
      return NextResponse.json({ ok: false, error: result.error || fallbackError });
    }

    // The model sometimes wraps the JSON in a markdown fence or adds a
    // sentence before/after it — pull out the first {...} block.
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ ok: false, error: fallbackError });
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ ok: false, error: fallbackError });
    }

    const community = (parsed.community as Record<string, unknown>) || {};
    const rawUnits = Array.isArray(parsed.units) ? parsed.units : [];
    const units: ExtractedUnit[] = rawUnits.map((u) => {
      const unit = (u as Record<string, unknown>) || {};
      return {
        name: asString(unit.name),
        price: asNumber(unit.price),
        type: asString(unit.type),
        layout: asString(unit.layout),
        size: asString(unit.size),
        condoFee: asNumber(unit.condoFee),
      };
    });

    return NextResponse.json({
      ok: true,
      community: {
        name: asString(community.name),
        cityProvince: asString(community.cityProvince),
      },
      units,
    });
  } catch (err) {
    console.error("feature-sheet/extract failed", err);
    return NextResponse.json({ ok: false, error: "extraction failed" }, { status: 200 });
  }
}
