"use client";
import { useRef, useState } from "react";
import "./InstaReview.css";
import { PALETTE, FONT_SANS, FONT_SERIF, FONT_SCRIPT } from "@/lib/brandPalette";
import { TEAM, TeamMember } from "@/lib/team";

// Ported from a working Design Component ("Review Post Creator.dc.html")
// built separately in Claude Design. Two things changed for this app:
// - `window.claude.complete` (only available inside the Design canvas)
// became a POST to /api/insta-review/generate, which calls the same
// Anthropic helper (lib/claude.ts) the Email Assistant scenarios use.
// - There's no host "Tweaks panel" here, so the three tweakable props
// from the original spec (captionTone, showRating, legalLine) are plain
// constants below instead of component props.
const CAPTION_TONE: "Warm" | "Direct" | "Story" = "Warm";
const SHOW_RATING = true;
const LEGAL_LINE = "Spire Mortgage Team is powered by the DLCG group of companies.";

// PALETTE/FONT_* now live in lib/brandPalette.ts (shared with Feature
// Sheets). TEAM now lives in lib/team.ts (shared with Feature Sheets) —
// aliased to the old local name here to minimize diff noise below.
type Broker = TeamMember;

type TemplateId = "atmosphere" | "paper" | "confidence" | "portrait" | "clarity";

const TEMPLATES: { id: TemplateId; name: string; description: string; swatch: string }[] = [
  { id: "atmosphere", name: "Atmosphere", description: "House style — sand accents on slate, quote-forward", swatch: PALETTE.atmosphere },
  { id: "paper", name: "Paper", description: "Warm white, logo-led, quiet and editorial", swatch: PALETTE.paper },
  { id: "confidence", name: "Confidence", description: "Deep navy, oversized quote, bold and calm", swatch: PALETTE.confidence },
  { id: "portrait", name: "Portrait", description: "Full-bleed headshot with the quote overlaid", swatch: PALETTE.grey4 },
  { id: "clarity", name: "Clarity card", description: "Floating warm-white card on slate", swatch: PALETTE.clarity },
];

const SAMPLE_REVIEW =
  "Prashant and Renee have been absolutely a Godsend through our first home purchase. They walked us through every step, answered our calls at all hours, and found us a rate we didn't think was possible. We can't thank them enough.";

// --- helpers -----------------------------------------------------------

function fit(text: string, base: number, min: number, budget: number): number {
  const n = (text || "").length;
  if (n <= budget) return base;
  return Math.max(min, Math.round(base * Math.sqrt(budget / n)));
}

function stripDiacritics(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectBrokerIds(text: string): string[] {
  const norm = stripDiacritics(text).toLowerCase();
  return TEAM.filter((b) => {
    const name = stripDiacritics(b.first).toLowerCase();
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
    return re.test(norm);
  }).map((b) => b.id);
}

type ChatKind = never; // placeholder to keep this file's export shape simple

export default function InstaReview() {
  // Step 01 state
  const [clientName, setClientName] = useState("");
  const [context, setContext] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [brokerIds, setBrokerIds] = useState<string[]>([]);
  const [multi, setMulti] = useState(false);
  const [noHeadshot, setNoHeadshot] = useState(false);
  const [brokerTouched, setBrokerTouched] = useState(false);
  const [brokerRole, setBrokerRole] = useState("Mortgage Broker");

  // Step 02 state
  const [format, setFormat] = useState<"square" | "story">("square");
  const [templateId, setTemplateId] = useState<TemplateId>("atmosphere");

  // Step 03 state
  const [quote, setQuote] = useState("");
  const [caption, setCaption] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);

  // Async / UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const postRef = useRef<HTMLDivElement>(null);

  const selectedBrokers = TEAM.filter((b) => brokerIds.includes(b.id));
  const isSquare = format === "square";
  const canvasH = isSquare ? 1080 : 1920;
  const scale = isSquare ? 0.5 : 0.3125;

  // Portrait needs exactly one broker's headshot to fill the frame — with
  // zero or several selected, fall back to Atmosphere instead.
  const effectiveTemplateId: TemplateId =
    templateId === "portrait" && selectedBrokers.length !== 1 ? "atmosphere" : templateId;

  const displayClientName = (clientName.trim() || "Spire Client").toUpperCase();
  const displayContext = (context.trim() || "Verified Review").toUpperCase();
  const displayBrokerRole = (brokerRole.trim() || "Mortgage Broker").toUpperCase();
  const displayBrokerName = noHeadshot || !selectedBrokers.length
    ? "Spire Mortgage Team"
    : selectedBrokers.map((b) => b.name).join(" & ");
  const displayQuote = quote.trim() || "The strongest line from the review lands here — verbatim, in the client's own words.";

  function handleReviewChange(val: string) {
    setReviewText(val);
    if (brokerTouched) return;
    const ids = detectBrokerIds(val);
    if (ids.length >= 2) {
      setMulti(true);
      setBrokerIds(ids);
    } else if (ids.length === 1) {
      setMulti(false);
      setBrokerIds(ids);
    }
  }

  function clickAvatar(id: string) {
    setBrokerTouched(true);
    setNoHeadshot(false);
    setBrokerIds((prev) => {
      if (multi) {
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      }
      return prev.length === 1 && prev[0] === id ? prev : [id];
    });
  }

  function toggleMulti() {
    setBrokerTouched(true);
    setMulti((m) => !m);
  }

  function toggleNoHeadshot() {
    setBrokerTouched(true);
    setNoHeadshot((v) => {
      const next = !v;
      if (next) setBrokerIds([]);
      return next;
    });
  }

  function loadSample() {
    setReviewText(SAMPLE_REVIEW);
    handleReviewChange(SAMPLE_REVIEW);
    if (!clientName.trim()) setClientName("Sarah M.");
    if (!context.trim()) setContext("First-time buyers");
  }

  async function generate() {
    setError("");
    if (reviewText.trim().length < 25) {
      setError("Paste the full review first — a sentence or two at minimum.");
      return;
    }
    if (!clientName.trim()) {
      setError("Add the client's name first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/insta-review/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review: reviewText,
          brokerNames: selectedBrokers.map((b) => b.name),
          captionTone: CAPTION_TONE,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Couldn't draft that one — try again, or write the quote and caption by hand below.");
      } else {
        setQuote(data.quote || "");
        // The user's typed name/context win — only fall back to the AI's
        // values if those fields are still empty.
        if (!clientName.trim() && data.attribution) setClientName(data.attribution);
        if (!context.trim() && data.context) setContext(data.context);
        const withLegal = data.caption ? `${data.caption}\n\n${LEGAL_LINE}` : "";
        setCaption(withLegal);
        setHasGenerated(true);
      }
    } catch {
      setError("Couldn't draft that one — try again, or write the quote and caption by hand below.");
    } finally {
      setLoading(false);
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy — select and copy manually.");
    }
  }

  async function downloadPng() {
    if (!postRef.current) return;
    setExporting(true);
    setError("");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(postRef.current, {
        width: 1080,
        height: canvasH,
        pixelRatio: 1,
        cacheBust: true,
        style: { transform: "none", transformOrigin: "top left" },
      });
      const slug = (clientName.trim() || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `spire-review-${slug}-${effectiveTemplateId}-${format}.png`;
      a.click();
    } catch {
      setError("PNG export failed. Try again — or screenshot the preview.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "470px 1fr", gap: 0, fontFamily: FONT_SANS, color: PALETTE.confidence, background: PALETTE.paper, margin: "0 -24px" }}>
      <div style={{ background: "#fff", borderRight: `1px solid ${PALETTE.clarity}`, padding: "32px 30px 64px" }}>
        {/* STEP 01 */}
        <Step01
          clientName={clientName}
          setClientName={setClientName}
          context={context}
          setContext={setContext}
          multi={multi}
          toggleMulti={toggleMulti}
          noHeadshot={noHeadshot}
          toggleNoHeadshot={toggleNoHeadshot}
          brokerIds={brokerIds}
          clickAvatar={clickAvatar}
          brokerRole={brokerRole}
          setBrokerRole={setBrokerRole}
          reviewText={reviewText}
          onReviewChange={handleReviewChange}
          loading={loading}
          hasGenerated={hasGenerated}
          onGenerate={generate}
          onSample={loadSample}
          error={error}
        />

        {hasGenerated && (
          <>
            <Divider />
            <Step02
              format={format}
              setFormat={setFormat}
              templateId={templateId}
              setTemplateId={setTemplateId}
            />
            <Divider />
            <Step03
              quote={quote}
              setQuote={setQuote}
              caption={caption}
              setCaption={setCaption}
              copied={copied}
              onCopy={copyCaption}
              exporting={exporting}
              onDownload={downloadPng}
            />
          </>
        )}
      </div>

      <div style={{ background: PALETTE.paper, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", minHeight: 560 }}>
        <div
          style={{
            width: 1080 * scale,
            height: canvasH * scale,
            overflow: "hidden",
            boxShadow: "0 14px 30px rgba(34,67,75,0.12), 0 4px 8px rgba(34,67,75,0.06)",
          }}
        >
          <div ref={postRef} style={{ width: 1080, height: canvasH, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative" }}>
            <PostCanvas
              templateId={effectiveTemplateId}
              isSquare={isSquare}
              canvasH={canvasH}
              quote={displayQuote}
              clientName={displayClientName}
              context={displayContext}
              brokerName={displayBrokerName}
              brokerRole={displayBrokerRole}
              brokers={noHeadshot ? [] : selectedBrokers}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: PALETTE.grey2 }}>
          <span>{isSquare ? "1080 × 1080" : "1080 × 1920"}</span>
          <span style={{ width: 1, height: 12, background: PALETTE.grey1 }} />
          <span>{TEMPLATES.find((t) => t.id === effectiveTemplateId)?.name}</span>
          <span style={{ width: 1, height: 12, background: PALETTE.grey1 }} />
          <span>Exports at full resolution</span>
        </div>

        <div style={{ maxWidth: 560, marginTop: 20, background: "#fff", border: `1px solid ${PALETTE.clarity}`, borderRadius: 8, padding: "14px 18px", fontSize: 12.5, lineHeight: 1.6, color: PALETTE.grey4 }}>
          <b style={{ color: PALETTE.confidence }}>Before you post —</b> get the client&apos;s okay to use their words publicly, and keep the quote verbatim. {LEGAL_LINE}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: PALETTE.clarity, margin: "24px 0" }} />;
}

// --- Step 01 -------------------------------------------------------------

function Step01({
  clientName, setClientName, context, setContext,
  multi, toggleMulti, noHeadshot, toggleNoHeadshot,
  brokerIds, clickAvatar, brokerRole, setBrokerRole,
  reviewText, onReviewChange, loading, hasGenerated, onGenerate, onSample, error,
}: {
  clientName: string; setClientName: (v: string) => void;
  context: string; setContext: (v: string) => void;
  multi: boolean; toggleMulti: () => void;
  noHeadshot: boolean; toggleNoHeadshot: () => void;
  brokerIds: string[]; clickAvatar: (id: string) => void;
  brokerRole: string; setBrokerRole: (v: string) => void;
  reviewText: string; onReviewChange: (v: string) => void;
  loading: boolean; hasGenerated: boolean; onGenerate: () => void; onSample: () => void;
  error: string;
}) {
  const ghostBtn = (active: boolean): React.CSSProperties => ({
    background: "none",
    border: "none",
    padding: "4px 8px",
    fontSize: 11.5,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: active ? PALETTE.confidence : PALETTE.grey2,
    cursor: "pointer",
  });

  return (
    <div>
      <StepLabel n={1} label="Client, broker & review" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <TextField label="Client name" value={clientName} onChange={setClientName} placeholder="Sarah M." />
        <TextField label="Context" value={context} onChange={setContext} placeholder="First-time buyers" />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
        <FieldLabel>Broker</FieldLabel>
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" style={ghostBtn(multi)} onClick={toggleMulti}>Multiple people</button>
          <button type="button" style={ghostBtn(noHeadshot)} onClick={toggleNoHeadshot}>No headshot</button>
        </div>
      </div>
      {multi && (
        <div style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: PALETTE.grey2, marginTop: 2, marginBottom: 6 }}>
          Broker (multiple)
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px 10px", marginTop: 10 }}>
        {TEAM.map((b) => {
          const active = brokerIds.includes(b.id);
          return (
            <div key={b.id} onClick={() => clickAvatar(b.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <div
                role="img"
                aria-label={b.name}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  backgroundImage: `url(${b.photo})`,
                  backgroundSize: `${b.zoom * 100}%`,
                  backgroundPosition: b.pos,
                  backgroundRepeat: "no-repeat",
                  border: active ? `2px solid ${PALETTE.warmth}` : `1px solid ${PALETTE.grey1}`,
                  transition: "border-color 160ms cubic-bezier(0.22,0.61,0.36,1)",
                }}
              />
              <span style={{ fontSize: 11, color: active ? PALETTE.confidence : PALETTE.grey2, fontWeight: active ? 600 : 400 }}>{b.first}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <TextField label="Broker role" value={brokerRole} onChange={setBrokerRole} placeholder="Mortgage Broker" />
      </div>

      <div style={{ height: 1, background: PALETTE.clarity, margin: "20px 0" }} />

      <FieldLabel>Review text</FieldLabel>
      <textarea
        value={reviewText}
        onChange={(e) => onReviewChange(e.target.value)}
        placeholder="Paste the client's review here…"
        style={{
          width: "100%",
          height: 130,
          marginTop: 6,
          padding: 12,
          fontFamily: FONT_SERIF,
          fontSize: 14,
          lineHeight: 1.5,
          color: PALETTE.confidence,
          background: PALETTE.paper,
          border: `1px solid ${PALETTE.clarity}`,
          borderRadius: 2,
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px 16px",
            background: PALETTE.confidence,
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontSize: 13.5,
            fontWeight: 600,
            letterSpacing: "0.02em",
            cursor: loading ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading && <Spinner />}
          {loading ? "Drafting" : hasGenerated ? "Redraft" : "Generate post + caption"}
        </button>
        <button
          type="button"
          onClick={onSample}
          style={{
            padding: "12px 16px",
            background: "#fff",
            color: PALETTE.confidence,
            border: `1px solid ${PALETTE.grey1}`,
            borderRadius: 4,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sample
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: PALETTE.errorBg, borderLeft: `3px solid ${PALETTE.errorText}`, color: PALETTE.errorText, fontSize: 12.5, borderRadius: 2 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 13,
        height: 13,
        border: "2px solid rgba(255,255,255,0.4)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "insta-review-spin 700ms linear infinite",
      }}
    />
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: PALETTE.warmthDark }}>STEP 0{n}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: PALETTE.confidence }}>{label}</span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: PALETTE.grey4, textTransform: "uppercase" }}>{children}</label>;
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          marginTop: 6,
          padding: "10px 11px",
          fontSize: 13.5,
          color: PALETTE.confidence,
          border: `1px solid ${PALETTE.grey1}`,
          borderRadius: 2,
        }}
      />
    </div>
  );
}

// --- Step 02 -------------------------------------------------------------

function Step02({
  format, setFormat, templateId, setTemplateId,
}: {
  format: "square" | "story"; setFormat: (f: "square" | "story") => void;
  templateId: TemplateId; setTemplateId: (t: TemplateId) => void;
}) {
  function formatBtn(active: boolean): React.CSSProperties {
    return {
      flex: 1,
      padding: "10px 12px",
      background: active ? PALETTE.confidence : "#fff",
      color: active ? "#fff" : PALETTE.confidence,
      border: active ? "none" : `1px solid ${PALETTE.grey1}`,
      borderRadius: 4,
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
    };
  }
  return (
    <div>
      <StepLabel n={2} label="Size & template" />
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" style={formatBtn(format === "square")} onClick={() => setFormat("square")}>Square 1:1</button>
        <button type="button" style={formatBtn(format === "story")} onClick={() => setFormat("story")}>Story 9:16</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 14 }}>
        {TEMPLATES.map((t) => {
          const active = templateId === t.id;
          return (
            <div
              key={t.id}
              onClick={() => setTemplateId(t.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 8px",
                borderRadius: 4,
                cursor: "pointer",
                background: active ? PALETTE.paper : "transparent",
              }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 4, background: t.swatch, border: t.id === "paper" ? `1px solid ${PALETTE.grey1}` : "none", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: PALETTE.confidence }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: PALETTE.grey2 }}>{t.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Step 03 -------------------------------------------------------------

function Step03({
  quote, setQuote, caption, setCaption, copied, onCopy, exporting, onDownload,
}: {
  quote: string; setQuote: (v: string) => void;
  caption: string; setCaption: (v: string) => void;
  copied: boolean; onCopy: () => void;
  exporting: boolean; onDownload: () => void;
}) {
  return (
    <div>
      <StepLabel n={3} label="The words" />
      <div style={{ marginTop: 14 }}>
        <FieldLabel>Pull quote</FieldLabel>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          style={{
            width: "100%",
            height: 80,
            marginTop: 6,
            padding: 12,
            fontFamily: FONT_SERIF,
            fontStyle: "italic",
            fontSize: 14,
            lineHeight: 1.5,
            color: PALETTE.confidence,
            border: `1px solid ${PALETTE.grey1}`,
            borderRadius: 2,
            resize: "vertical",
          }}
        />
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <FieldLabel>Instagram caption</FieldLabel>
          <span style={{ fontSize: 11, color: PALETTE.grey2 }}>{caption.length} chars</span>
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          style={{
            width: "100%",
            height: 120,
            marginTop: 6,
            padding: 12,
            fontSize: 13.5,
            lineHeight: 1.6,
            color: PALETTE.confidence,
            border: `1px solid ${PALETTE.grey1}`,
            borderRadius: 2,
            resize: "vertical",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          type="button"
          onClick={onCopy}
          style={{ flex: 1, padding: "12px 16px", background: "#fff", color: PALETTE.confidence, border: `1px solid ${PALETTE.grey1}`, borderRadius: 4, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
        >
          {copied ? "Caption copied" : "Copy caption"}
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={exporting}
          style={{ flex: 1, padding: "12px 16px", background: PALETTE.warmth, color: "#fff", border: "none", borderRadius: 4, fontSize: 13.5, fontWeight: 600, cursor: exporting ? "default" : "pointer", opacity: exporting ? 0.75 : 1 }}
        >
          {exporting ? "Exporting…" : "Download PNG"}
        </button>
      </div>
    </div>
  );
}

// --- Post canvas (the five templates) -------------------------------------

function PostCanvas({
  templateId, isSquare, canvasH, quote, clientName, context, brokerName, brokerRole, brokers,
}: {
  templateId: TemplateId; isSquare: boolean; canvasH: number;
  quote: string; clientName: string; context: string; brokerName: string; brokerRole: string;
  brokers: Broker[];
}) {
  const common = { isSquare, canvasH, quote, clientName, context, brokerName, brokerRole, brokers };
  switch (templateId) {
    case "paper":
      return <TemplatePaper {...common} />;
    case "confidence":
      return <TemplateConfidence {...common} />;
    case "portrait":
      return <TemplatePortrait {...common} broker={brokers[0]} />;
    case "clarity":
      return <TemplateClarity {...common} />;
    case "atmosphere":
    default:
      return <TemplateAtmosphere {...common} />;
  }
}

function Stars() {
  if (!SHOW_RATING) return null;
  return <div style={{ color: PALETTE.warmth, fontSize: 22, letterSpacing: "0.2em" }}>★★★★★</div>;
}

function AvatarStack({ brokers, size, ring }: { brokers: Broker[]; size: number; ring?: string }) {
  return (
    <div style={{ display: "flex" }}>
      {brokers.map((b, i) => (
        <div
          key={b.id}
          role="img"
          aria-label={b.name}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundImage: `url(${b.photo})`,
            backgroundSize: `${b.zoom * 100}%`,
            backgroundPosition: b.pos,
            backgroundRepeat: "no-repeat",
            border: ring ? `2px solid ${ring}` : `2px solid #fff`,
            marginLeft: i === 0 ? 0 : -18,
            zIndex: brokers.length - i,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

type TemplateProps = {
  isSquare: boolean; canvasH: number; quote: string; clientName: string; context: string;
  brokerName: string; brokerRole: string; brokers: Broker[];
};

function TemplateAtmosphere({ isSquare, canvasH, quote, clientName, context, brokerName, brokerRole, brokers }: TemplateProps) {
  const qSize = fit(quote, isSquare ? 72 : 76, 42, 130);
  return (
    <div style={{ width: 1080, height: canvasH, background: PALETTE.atmosphere, position: "relative", overflow: "hidden", fontFamily: FONT_SANS, display: "flex", flexDirection: "column", padding: "90px 96px" }}>
      <div style={{ position: "absolute", top: -160, right: -160, width: 540, height: 540, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.10)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 30, height: 2, background: PALETTE.warmth }} />
          <span style={{ fontSize: 14, letterSpacing: "0.18em", color: PALETTE.warmth, textTransform: "uppercase" }}>Client Review</span>
        </div>
        <img src="/insta-review/assets/logo-spire-stacked-white.png" alt="Spire Mortgage" style={{ height: 108 }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 24, textAlign: "center", position: "relative" }}>
        <Stars />
        <div style={{ fontFamily: FONT_SERIF, fontSize: 132, color: "rgba(195,157,117,0.92)", lineHeight: "62px", height: 62 }}>&ldquo;</div>
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: qSize, lineHeight: 1.32, color: "#fff", maxWidth: 820 }}>{quote}</div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.22)", paddingTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "#fff" }}>{clientName}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em" }}>{context}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{brokerName}</div>
            <div style={{ fontSize: 11, color: PALETTE.warmth, letterSpacing: "0.08em" }}>{brokerRole}</div>
          </div>
          {brokers.length > 0 && <AvatarStack brokers={brokers} size={126} ring="rgba(255,255,255,0.5)" />}
        </div>
      </div>
    </div>
  );
}

function TemplatePaper({ isSquare, canvasH, quote, clientName, context, brokerName, brokerRole, brokers }: TemplateProps) {
  // This template's square format needed specific tuning in the original
  // build — the header/quote/footer stack overflowed 1080x1080. Smaller
  // header logo, tighter quote size ramp, min-height:0 center column, and
  // a flex:none footer are all deliberate — keep them.
  const qSize = fit(quote, isSquare ? 54 : 66, 34, 105);
  return (
    <div style={{ width: 1080, height: canvasH, background: PALETTE.paper, position: "relative", overflow: "hidden", fontFamily: FONT_SANS, display: "flex", flexDirection: "column", padding: "56px 104px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <img src="/insta-review/assets/logo-spire-stacked-dark.png" alt="Spire Mortgage" style={{ height: 92 }} />
        <span style={{ fontSize: 13, letterSpacing: "0.18em", color: PALETTE.warmthDark, textTransform: "uppercase" }}>Client Review</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 28, textAlign: "center" }}>
        <Stars />
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: qSize, lineHeight: 1.34, color: PALETTE.confidence, maxWidth: 800 }}>{quote}</div>
        <div style={{ width: 92, height: 2, background: PALETTE.warmth }} />
        <div>
          <div style={{ fontSize: 19, fontWeight: 500, color: PALETTE.confidence }}>{clientName}</div>
          <div style={{ fontSize: 12.5, color: PALETTE.grey4, letterSpacing: "0.06em" }}>{context}</div>
        </div>
      </div>
      <div style={{ flex: "none", borderTop: `1px solid ${PALETTE.grey1}`, paddingTop: 24, display: "flex", justifyContent: "center", alignItems: "center", gap: 18 }}>
        {brokers.length > 0 && <AvatarStack brokers={brokers} size={96} ring="#fff" />}
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: PALETTE.confidence }}>{brokerName}</div>
          <div style={{ fontSize: 10.5, color: PALETTE.warmthDark, letterSpacing: "0.08em" }}>{brokerRole}</div>
        </div>
      </div>
    </div>
  );
}

function TemplateConfidence({ isSquare, canvasH, quote, clientName, context, brokerName, brokerRole, brokers }: TemplateProps) {
  const qSize = fit(quote, isSquare ? 80 : 86, 46, 120);
  return (
    <div style={{ width: 1080, height: canvasH, background: PALETTE.confidence, position: "relative", overflow: "hidden", fontFamily: FONT_SANS, display: "flex", flexDirection: "column", padding: "90px 100px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 2, background: PALETTE.warmth }} />
        <span style={{ fontSize: 14, letterSpacing: "0.18em", color: PALETTE.warmth, textTransform: "uppercase" }}>In Their Words</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 46 }}>
        <Stars />
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: qSize, lineHeight: 1.28, color: "#fff", maxWidth: 900 }}>{quote}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 1, background: "rgba(255,255,255,0.3)" }} />
          <div>
            <span style={{ fontSize: 17, fontWeight: 500, color: "#fff" }}>{clientName}</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginLeft: 10 }}>{context}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {brokers.length > 0 && <AvatarStack brokers={brokers} size={104} ring="rgba(195,157,117,0.65)" />}
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{brokerName}</div>
            <div style={{ fontSize: 11, color: PALETTE.warmth, letterSpacing: "0.08em" }}>{brokerRole}</div>
          </div>
        </div>
        <img src="/insta-review/assets/logo-spire-stacked-white.png" alt="Spire Mortgage" style={{ height: 104 }} />
      </div>
    </div>
  );
}

function TemplatePortrait({ isSquare, canvasH, quote, clientName, context, brokerName, brokerRole, broker }: TemplateProps & { broker?: Broker }) {
  const qSize = fit(quote, isSquare ? 56 : 62, 36, 130);
  return (
    <div style={{ width: 1080, height: canvasH, position: "relative", overflow: "hidden", fontFamily: FONT_SANS, display: "flex", flexDirection: "column" }}>
      {broker && (
        <div
          role="img"
          aria-label={broker.name}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${broker.photo})`,
            backgroundSize: `${broker.zoom * 100}%`,
            backgroundPosition: broker.wide,
            backgroundRepeat: "no-repeat",
            filter: "saturate(0.82) contrast(1.02)",
          }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, background: "rgba(105,123,129,0.55)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "62%", background: "linear-gradient(to bottom, transparent, rgba(24,47,53,0.86))" }} />

      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "72px 90px 0" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 30, height: 2, background: PALETTE.warmth }} />
            <span style={{ fontSize: 14, letterSpacing: "0.18em", color: PALETTE.warmth, textTransform: "uppercase" }}>Client Review</span>
          </div>
          <div style={{ marginTop: 16 }}><Stars /></div>
        </div>
        <img src="/insta-review/assets/logo-spire-stacked-white.png" alt="Spire Mortgage" style={{ height: 100 }} />
      </div>

      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 90px 176px", gap: 20 }}>
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: qSize, lineHeight: 1.32, color: "#fff", maxWidth: 820 }}>{quote}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 500, color: "#fff" }}>{clientName}</span>
          <div style={{ width: 40, height: 1, background: "rgba(255,255,255,0.4)" }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{context}</span>
        </div>
      </div>

      <div style={{ position: "relative", flex: "none", background: PALETTE.confidence, padding: "34px 88px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>{brokerName}</span>
        <span style={{ fontSize: 12, letterSpacing: "0.1em", color: PALETTE.warmth, textTransform: "uppercase" }}>{brokerRole}</span>
      </div>
    </div>
  );
}

function TemplateClarity({ isSquare, canvasH, quote, clientName, context, brokerName, brokerRole, brokers }: TemplateProps) {
  const qSize = fit(quote, isSquare ? 56 : 62, 36, 130);
  return (
    <div style={{ width: 1080, height: canvasH, background: PALETTE.atmosphere, position: "relative", overflow: "hidden", fontFamily: FONT_SANS, display: "flex", flexDirection: "column", alignItems: "center", padding: "72px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 14, letterSpacing: "0.18em", color: "#fff", textTransform: "uppercase" }}>Client Review</span>
      </div>
      <img src="/insta-review/assets/logo-spire-stacked-white.png" alt="Spire Mortgage" style={{ height: 92, marginTop: 10 }} />

      <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "center" }}>
        <div style={{ width: "100%", background: PALETTE.paper, borderRadius: 8, padding: "76px 72px 68px", boxShadow: "0 14px 30px rgba(24,47,53,0.18)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Stars />
            <div style={{ fontFamily: FONT_SERIF, fontSize: 104, color: PALETTE.warmth, lineHeight: "60px", height: 60 }}>&ldquo;</div>
          </div>
          <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: qSize, lineHeight: 1.34, color: PALETTE.ink, marginTop: 26 }}>{quote}</div>
          <div style={{ borderTop: `1px solid ${PALETTE.grey1}`, marginTop: 34, paddingTop: 26, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 500, color: PALETTE.confidence }}>{clientName}</div>
              <div style={{ fontSize: 12, color: PALETTE.grey4, letterSpacing: "0.06em" }}>{context}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: PALETTE.confidence }}>{brokerName}</div>
                <div style={{ fontSize: 10, color: PALETTE.warmthDark, letterSpacing: "0.08em" }}>{brokerRole}</div>
              </div>
              {brokers.length > 0 && <AvatarStack brokers={brokers} size={96} ring="#fff" />}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 8 }}>{LEGAL_LINE}</div>
    </div>
  );
}
