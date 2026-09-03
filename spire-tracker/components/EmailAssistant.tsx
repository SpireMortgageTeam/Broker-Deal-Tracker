"use client";
import { useState } from "react";
import { EMAIL_ASSISTANT_SCENARIOS } from "@/lib/constants";
import { showToast } from "./Toast";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Parsed =
  | { kind: "split"; clientEmail: string; underwritingNotes: string }
  | { kind: "questions"; text: string }
  | { kind: "raw"; text: string };

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
// Matches EITHER a link OR bold text, so a single left-to-right scan can
// interleave both into the right order (used for on-screen rendering).
const INLINE_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*/g;
const HEADING_RE = /^#{1,6}\s+(.*)$/;

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

// Renders "[label](url)" as a real link and "**text**" as real bold within a
// single line — the model uses both, and plain text can't show either.
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  const re = new RegExp(INLINE_RE); // fresh instance — avoids stale lastIndex across calls
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
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
    } else if (match[2] !== undefined) {
      nodes.push(<strong key={key++}>{match[2]}</strong>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// Renders a full block of text line by line, so a "## Heading" line (the
// underwriting-notes format) becomes a real bold heading instead of showing
// its hash marks, with normal lines passed through renderInline.
function renderBlock(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    const heading = line.match(HEADING_RE);
    if (heading) {
      out.push(
        <div key={`h${i}`} style={{ fontWeight: 700, marginTop: i === 0 ? 0 : 10, marginBottom: 2 }}>
          {renderInline(heading[1])}
        </div>
      );
    } else {
      out.push(<span key={`l${i}`}>{renderInline(line)}</span>);
      if (i < lines.length - 1) out.push(<br key={`b${i}`} />);
    }
  });
  return out;
}

function inlineToHtml(s: string): string {
  return s.replace(LINK_RE, '<a href="$2">$1</a>').replace(BOLD_RE, "<strong>$1</strong>");
}

// Converts the same markdown (links, bold, ## headings, line breaks) into
// real HTML, so the copy button hands the email client actual formatting
// instead of literal markdown syntax.
function toEmailHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = escaped.split("\n").map((line) => {
    const heading = line.match(HEADING_RE);
    return heading ? `<strong>${inlineToHtml(heading[1])}</strong>` : inlineToHtml(line);
  });
  return lines.join("<br>");
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
          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{renderBlock(parsed.clientEmail)}</div>
        </div>
        <div className="card">
          <div className="section-title">
            <h3>Internal underwriting notes</h3>
            <button className="btn small secondary" onClick={() => copy(parsed.underwritingNotes, "Notes")}>Copy</button>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{renderBlock(parsed.underwritingNotes)}</div>
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
        <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{renderBlock(parsed.text)}</div>
      </div>
    );
  }
  return (
    <div className="card">
      <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{renderBlock(parsed.text)}</div>
    </div>
  );
}

export default function EmailAssistant() {
  const [scenarioId, setScenarioId] = useState(EMAIL_ASSISTANT_SCENARIOS[0].id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const scenario = EMAIL_ASSISTANT_SCENARIOS.find((s) => s.id === scenarioId) ?? EMAIL_ASSISTANT_SCENARIOS[0];
  const started = messages.length > 0;

  // Switching scenarios mid-conversation would mix one tool's context into
  // another's system prompt, so it starts a fresh conversation — same as
  // clicking "New conversation".
  function changeScenario(id: string) {
    setScenarioId(id);
    setMessages([]);
    setInput("");
    setError("");
  }

  // Only commits the new turn to state once a reply comes back successfully —
  // that keeps the message history strictly alternating user/assistant, which
  // the Claude API requires. On failure, nothing is added and the typed text
  // stays in the box so it isn't lost.
  async function send() {
    const text = input.trim();
    if (!text) {
      showToast(started ? "Type a reply first" : `Fill in ${scenario.inputLabel.toLowerCase()} first`);
      return;
    }
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/email-assistant/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenarioId, messages: next }),
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
        <div className="field" style={{ marginBottom: started ? 0 : 14 }}>
          <label>Tool</label>
          <select value={scenarioId} onChange={(e) => changeScenario(e.target.value)}>
            {EMAIL_ASSISTANT_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="section-title">
          <h3>{scenario.label}</h3>
          {started ? (
            <button className="btn small secondary" onClick={startOver}>New conversation</button>
          ) : (
            <span className="muted">{scenario.tagline}</span>
          )}
        </div>
        {!started && (
          <p className="muted" style={{ marginTop: -6 }}>
            {scenario.helper}
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
          <label>{started ? "Your reply" : scenario.inputLabel}</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={started ? "Answer the questions above, or ask for a change…" : scenario.placeholder}
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
