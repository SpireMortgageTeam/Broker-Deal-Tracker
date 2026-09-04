import { NextRequest, NextResponse } from "next/server";
import { generateEmailDraft } from "@/lib/claude";

// Same brand-voice system prompt as the ported Design Component spec.
// Kept in this route (rather than a shared prompts/ file) since — unlike
// the Email Assistant scenarios — this is a single fixed prompt, not one of
// several the client picks between.
const SYSTEM_PROMPT = `You write social copy for Spire Mortgage Team, a boutique Canadian mortgage brokerage. Brand voice: calm, advisory, plain-spoken, quietly confident. Statements, not exclamations. Hard rules: no emoji. No exclamation points. No hype words (amazing, thrilled, unlock, dream). Never say 'apply now' or imply urgency about rates. Specific over vague. Use 'you' for the reader and 'we' for the Spire team. Never first-person singular. Return ONLY a JSON object, no markdown fence.`;

const VALID_TONES = ["Warm", "Direct", "Story"];

function stripQuoteChars(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.trim().replace(/^["“”]+/, "").replace(/["“”]+$/, "");
}

// Already covered by proxy.ts's session-cookie gate (same as every other
// /api/* route in this app) — no separate auth needed here.
export async function POST(request: NextRequest) {
  try {
    const { review, brokerNames, captionTone } = await request.json();

    if (typeof review !== "string" || review.trim().length < 25) {
      return NextResponse.json({ ok: false, error: "Paste the full review first — a sentence or two at minimum." });
    }

    const tone = VALID_TONES.includes(captionTone) ? captionTone : "Warm";
    const brokerLine = Array.isArray(brokerNames) && brokerNames.filter(Boolean).length
      ? `The broker(s) on this deal: ${brokerNames.filter(Boolean).join(" and ")}.\n\n`
      : "";

    const userPrompt = `Here is a client review:\n\n"""${review.trim()}"""\n\n${brokerLine}Return a JSON object with exactly these four keys:
- "quote": the strongest verbatim excerpt from the review, 12-32 words, wording unchanged (trimming the ends or eliding a middle clause is allowed; rewriting is not). No surrounding quotation marks.
- "attribution": the reviewer's name if it appears in the review, else "Spire client".
- "context": a 2-4 word sentence-case situation label (e.g. "First-time buyers", "Refinance", "Second home").
- "caption": an Instagram caption in the Spire voice, ${tone} tone. Two to three short lines, 45 words max. Line one reacts to what the client valued; line two states plainly what Spire does about it; line three is a low-pressure invitation. Separate lines with \\n\\n. Don't repeat the quote verbatim. No hashtags, no legal line.

Return ONLY the JSON object, no markdown fence.`;

    const result = await generateEmailDraft(SYSTEM_PROMPT, [{ role: "user", content: userPrompt }]);
    const fallbackError = "Couldn't draft that one — try again, or write the quote and caption by hand below.";
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

    return NextResponse.json({
      ok: true,
      quote: stripQuoteChars(parsed.quote),
      attribution: typeof parsed.attribution === "string" && parsed.attribution.trim() ? parsed.attribution.trim() : "Spire client",
      context: typeof parsed.context === "string" ? parsed.context.trim() : "",
      caption: typeof parsed.caption === "string" ? parsed.caption.trim() : "",
    });
  } catch (err) {
    console.error("insta-review/generate failed", err);
    return NextResponse.json({ ok: false, error: "generation failed" }, { status: 200 });
  }
}
