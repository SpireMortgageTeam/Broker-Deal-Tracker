import { NextRequest, NextResponse } from "next/server";
import { generateEmailDraft, ChatMessage } from "@/lib/claude";
import { DEAL_NOTE_ORGANIZER_PROMPT } from "@/lib/prompts/dealNoteOrganizer";
import { PREAPPROVAL_GENERATOR_PROMPT } from "@/lib/prompts/preapprovalGenerator";
import { DEAL_SAVER_PROMPT } from "@/lib/prompts/dealSaver";

// Scenario key -> system prompt. As more scenarios are migrated from the old
// custom GPTs, add another entry here rather than growing one shared prompt —
// each request only ever sends the ONE scenario's rules to the model. Keep
// this in sync with EMAIL_ASSISTANT_SCENARIOS in lib/constants.ts (the ids
// the dropdown sends).
const SCENARIOS: Record<string, string> = {
  "deal-note-organizer": DEAL_NOTE_ORGANIZER_PROMPT,
  "preapproval-generator": PREAPPROVAL_GENERATOR_PROMPT,
  "deal-saver": DEAL_SAVER_PROMPT,
};

// Already covered by proxy.ts's session-cookie gate (same as every other
// /api/* route in this app) — no separate auth needed here.
export async function POST(request: NextRequest) {
  try {
    const { scenario, messages } = await request.json();

    const systemPrompt = SCENARIOS[scenario];
    if (!systemPrompt) {
      return NextResponse.json({ ok: false, error: "Unknown scenario" }, { status: 400 });
    }
    if (!Array.isArray(messages) || !messages.length) {
      return NextResponse.json({ ok: false, error: "Messages are required" }, { status: 400 });
    }
    const clean: ChatMessage[] = messages
      .filter(
        (m: any) =>
          m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()
      )
      .map((m: any) => ({ role: m.role, content: m.content }));
    if (!clean.length) {
      return NextResponse.json({ ok: false, error: "Messages are required" }, { status: 400 });
    }

    const result = await generateEmailDraft(systemPrompt, clean);
    return NextResponse.json(result);
  } catch (err) {
    console.error("email-assistant/generate failed", err);
    return NextResponse.json({ ok: false, error: "generation failed" }, { status: 200 });
  }
}
