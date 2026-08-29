"use client";
import { useState } from "react";
import { showToast } from "./Toast";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Parsed =
  | { kind: "split"; clientEmail: string; underwritingNotes: string }
  | { kind: "questions"; text: string }
  | { kind: "raw"; text: string };

// Splits an assistant reply on the "# Client-Facing Email" / "# Internal
// Underwriting Notes" headers the prompt asks for. If the model instead came
// back with clarifying questions (per the prompt's "never guess" core rule),
// that's shown as its own block — reply in the box below to answer them and
// the conversation continues from there, same as a real back-and-forth.
function parseAssistant(text: string): Parsed {
  if (/^##\s*Clarifying Questions/im.test(text.trim())) {
    return { kind: "questions", text: text.trim() };
  }
  const emailMatch = text.match(/#\s*Client-Facing Email\s*([\s\S]*?)(?=#\s*Internal Underwriting Notes|$)/i);
  const notesMatch = text.match(/#\s*Internal Underwriting Notes\s*([\s\S]*)/i);
  if (emailMatch && notesMatch) {
    return {
      kind: "split",
      clientEmail: emailMatch[1].trim(),
      underwritingNotes: notesMatch[1].trim(),
    };
  }
  return { kind: "raw", text: text.trim() };
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied`);
  } catch {
    showToast("Couldn't copy — select and copy manually");
  }
}

function AssistantBubble({ text }: { text: string }) {
  const parsed = parseAssistant(text);
  if (parsed.kind === "split") {
    return (
      <>
        <div className="card">
          <div className="section-title">
            <h3>Client-facing email</h3>
            <button className="btn small secondary" onClick={() => copy(parsed.clientEmail, "Email")}>Copy</button>
          </div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{parsed.clientEmail}</div>
        </div>
        <div className="card">
          <div className="section-title">
            <h3>Internal underwriting notes</h3>
            <button className="btn small secondary" onClick={() => copy(parsed.underwritingNotes, "Notes")}>Copy</button>
          </div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{parsed.underwritingNotes}</div>
        </div>
      </>
    );
  }
  if (parsed.kind === "questions") {
    return (
      <div className="card">
        <p className="muted" style={{ marginTop: 0, marginBottom: 8 }}>
          Needs a bit more info — reply in the box below and it'll pick up from here.
        </p>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{parsed.text}</div>
      </div>
    );
  }
  return (
    <div className="card">
      <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{parsed.text}</div>
    </div>
  );
}

export default function EmailAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const started = messages.length > 0;

  // Only commits the new turn to state once a reply comes back successfully —
  // that keeps the message history strictly alternating user/assistant, which
  // the Claude API requires. On failure, nothing is added and the typed text
  // stays in the box so it isn't lost.
  async function send() {
    const text = input.trim();
    if (!text) {
      showToast(started ? "Type a reply first" : "Paste in your call notes first");
      return;
    }
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/email-assistant/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: "deal-note-organizer", messages: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong generating this — try again.");
      } else {
        setMessages([...next, { role: "assistant", content: data.text }]);
        setInput("");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
