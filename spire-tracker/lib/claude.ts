// Server-only helper for the Email Assistant feature. Calls Anthropic's
// Messages API directly via fetch (no SDK dependency), the same way
// lib/email.ts calls Resend. Never import this from a client component; it
// reads the ANTHROPIC_API_KEY secret from the server environment.

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Sends one scenario's system prompt plus the full conversation so far to
 * Claude and returns the raw response text. Supports multi-turn exchanges —
 * e.g. the model asking clarifying questions and the staff member answering
 * them in a follow-up message — by passing the growing message history back
 * in each time. Returns a result object rather than throwing, so a bad
 * response can be shown in the UI instead of crashing the request.
 */
export async function generateEmailDraft(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<{ ok: boolean; text?: string; error?: string }> {
  if (!isClaudeConfigured()) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not set" };
  }
  if (!messages.length) {
    return { ok: false, error: "No messages provided" };
  }

  try {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Claude API ${res.status}: ${detail.slice(0, 300)}` };
    }

    const data = await res.json();
    const text = Array.isArray(data.content)
      ? data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
      : "";
    if (!text) {
      return { ok: false, error: "Empty response from Claude" };
    }
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "generation failed" };
  }
}
