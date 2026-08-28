"use client";
import { useState } from "react";
import { showToast } from "./Toast";

type Result =
  | { kind: "split"; clientEmail: string; underwritingNotes: string }
  | { kind: "questions"; text: string }
  | { kind: "raw"; text: string };

// Splits Claude's response on the "# Client-Facing Email" / "# Internal
// Underwriting Notes" headers the prompt asks for. If the model instead came
// back with clarifying questions (per the prompt's "never guess" core rule),
// that's shown as its own panel so the flow is: read the questions, add the
// answers to your notes, and regenerate — never a guessed-at draft.
function parseResult(text: string): Result {
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

export default function EmailAssistant() {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function generate() {
    if (!notes.trim()) {
      showToast("Paste in your call notes first");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/email-assistant/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: "deal-note-organizer", notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong generating this — try again.");
      } else {
        setResult(parseResult(data.text));
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="section-title">
          <h3>Deal Note Organizer + Client Recap</h3>
          <span className="muted">Paste your call notes — get a client email and underwriting notes</span>
        </div>
        <div className="field">
          <label>Call notes / transcript</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste what was discussed on the call — goal, timeline, income, down payment, property, etc."
            style={{ minHeight: 180 }}
          />
        </div>
        <button className="btn" onClick={generate} disabled={loading}>
          {loading ? "Generating…" : "Generate"}
        </button>
        {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      {result?.kind === "questions" && (
        <div className="card">
          <div className="section-title">
            <h3>Clarifying questions</h3>
            <span className="muted">Missing info — answer these in your notes above, then regenerate</span>
          </div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{result.text}</div>
        </div>
      )}

      {result?.kind === "split" && (
        <>
          <div className="card">
            <div className="section-title">
              <h3>Client-facing email</h3>
              <button className="btn small secondary" onClick={() => copy(result.clientEmail, "Email")}>Copy</button>
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{result.clientEmail}</div>
          </div>
          <div className="card">
            <div className="section-title">
              <h3>Internal underwriting notes</h3>
              <button className="btn small secondary" onClick={() => copy(result.underwritingNotes, "Notes")}>Copy</button>
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{result.underwritingNotes}</div>
          </div>
        </>
      )}

      {result?.kind === "raw" && (
        <div className="card">
          <div className="section-title">
            <h3>Result</h3>
            <button className="btn small secondary" onClick={() => copy(result.text, "Result")}>Copy</button>
          </div>
          <p className="muted" style={{ marginTop: -6 }}>
            Didn't come back in the expected format — here's the raw output.
          </p>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6 }}>{result.text}</div>
        </div>
      )}
    </>
  );
}
