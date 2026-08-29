"use client";
import { useState } from "react";
import { showToast } from "./Toast";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Parsed =
  | { kind: "split"; clientEmail: string; underwritingNotes: string }
  | { kind: "questions"; text: string }
  | { kind: "raw"; text: string };

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

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

// Renders "[label](https://...)" markdown links as real clickable <a> tags —
// the prompt's own rules say to use markdown links, but plain text can't
// render them, so without this staff would see literal bracket syntax.
function renderWithLinks(text: string) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  const re = new RegExp(LINK_RE);
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(
      <a
        key={key++}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--charcoal)", fontWeight: 600 }}
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// Converts the same markdown links (and line breaks) into real HTML, so the
// copy button can hand the email client an actual hyperlink instead of
// "[Apply Now](https://...)" as literal text.
function toEmailHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = escaped.replace(LINK_RE, '<a href="$2">$1</a>');
  return linked.replace(/\n/g, "<br>");
}

async function copy(text: string, label: string) {
  try {
    const ClipboardItemCtor = (window as any).ClipboardItem;
    if (navigator.clipboard?.write && ClipboardItemCtor) {
      const item = new ClipboardItemCtor({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([toEmailHtml(text)], { type: "text/html" }),
      });
      await navigator.clipboard.write([item]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    showToast(`${label} copied`);
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch {
      showToast("Couldn't copy — select and copy manually");
    }
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
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>
            {renderWithLinks(parsed.clientEmail)}
          </div>
        </div>
        <div className="card">
          <div className="section-title">
            <h3>Internal underwriting notes</h3>
            <button className="btn small secondary" onClick={() => copy(parsed.underwritingNotes, "Notes")}>Copy</button>
          </div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>
            {renderWithLinks(parsed.underwritingNotes)}
          </div>
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
        <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{renderWithLinks(parsed.text)}</div>
      </div>
    );
  }
  return (
    <div className="card">
      <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{renderWithLinks(parsed.text)}</div>
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
    setMessages([]);
    setInput("");
    setError("");
  }

  return (
    <>
      <div className="card">
        <div className="section-title">
          <h3>Deal Note Organizer + Client Recap</h3>
          {started ? (
            <button className="btn small secondary" onClick={startOver}>New conversation</button>
          ) : (
            <span className="muted">Paste your call notes — get a client email and underwriting notes</span>
          )}
        </div>
        {!started && (
          <p className="muted" style={{ marginTop: -6 }}>
            If anything's missing (income, down payment, timeline, etc.) it'll ask before writing anything —
            just answer right here and it'll continue.
          </p>
        )}
      </div>

      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="card" style={{ boxShadow: "none" }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>YOU</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{m.content}</div>
          </div>
        ) : (
          <AssistantBubble key={i} text={m.content} />
        )
      )}

      <div className="card">
        <div className="field">
          <label>{started ? "Your reply" : "Call notes / transcript"}</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              started
                ? "Answer the questions above, or ask for a change…"
                : "Paste what was discussed on the call — goal, timeline, income, down payment, property, etc."
            }
            style={{ minHeight: started ? 80 : 180 }}
          />
        </div>
        <button className="btn" onClick={send} disabled={loading}>
          {loading ? "Generating…" : started ? "Send" : "Generate"}
        </button>
        {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}
      </div>
    </>
  );
}
