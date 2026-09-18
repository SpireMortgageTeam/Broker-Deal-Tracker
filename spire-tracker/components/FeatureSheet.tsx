"use client";
import { useRef, useState } from "react";
import { Builder, TrackerDB } from "@/lib/types";
import { PALETTE, FONT_SANS, FONT_SERIF } from "@/lib/brandPalette";
import { TEAM, TeamMember, teamEmail } from "@/lib/team";
import { buildDownPaymentScenario } from "@/lib/mortgageMath";
import { fileToDataUrl } from "@/lib/imageUpload";
import { uid } from "@/lib/utils";
import { showToast } from "./Toast";
import type { Mutate } from "@/app/page";

// Redesigned to match the co-branded builder feature sheets Trico/Renée are
// actually producing (see the Summit sheet): one full page PER price point
// (a distinct floorplan/unit) rather than a single page comparing three
// down-payment tiers across every price. The number of pages is however
// many price points the user has entered — no hardcoded count anywhere.
// Two-column layout (form | live preview), same technique as InstaReview.tsx:
// each page is built as real DOM at exact print resolution (US Letter,
// 150dpi = 1275x1650), scaled down on screen via CSS transform for preview,
// and rasterized at full size for a multi-page PDF export.

const PAGE_W = 1275;
const PAGE_H = 1650;

interface FeatureUnit {
  id: string;
  name: string; // e.g. "Tonquin" — the floorplan/model name
  price: number;
  type: string; // e.g. "Condominium"
  layout: string; // e.g. "1 Bedroom"
  size: string; // e.g. "534 sq.ft" — free text, ranges are common
  hasCondoFee: boolean;
  condoFee: number;
}

function newUnit(): FeatureUnit {
  return { id: uid(), name: "", price: 0, type: "", layout: "", size: "", hasCondoFee: false, condoFee: 0 };
}

interface RateScenario {
  id: string;
  rate: number; // rate often differs by down payment tier (insured vs. conventional)
  downPaymentPercent: number;
}

const ZERO_SCENARIO = { downPayment: 0, downPercent: 0, premiumRate: 0, premiumAmount: 0, principal: 0, monthlyPayment: 0 };

export default function FeatureSheet({ db, mutate }: { db: TrackerDB; mutate: Mutate }) {
  const [builderId, setBuilderId] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [communityNameOverride, setCommunityNameOverride] = useState("");
  const [cityProvince, setCityProvince] = useState("");
  const [heroPhoto, setHeroPhoto] = useState("");
  const [scenarios, setScenarios] = useState<RateScenario[]>([{ id: uid(), rate: 4.99, downPaymentPercent: 10 }]);
  const [brokerId, setBrokerId] = useState(TEAM[0]?.id || "");
  const [areaManagerName, setAreaManagerName] = useState("");
  const [areaManagerPhone, setAreaManagerPhone] = useState("");
  const [areaManagerEmail, setAreaManagerEmail] = useState("");
  const [builderWebsite, setBuilderWebsite] = useState("");
  const [units, setUnits] = useState<FeatureUnit[]>([newUnit()]);
  const [rateHoldMonths, setRateHoldMonths] = useState(24);
  const [rateHoldIntro, setRateHoldIntro] = useState(
    "Buyers have early clarity — a financing position established now, without locking into today's rate environment permanently."
  );
  const [rateHoldBullets, setRateHoldBullets] = useState(
    "Full pre-approval completed today.\nIncome, credit, and down payment reviewed upfront.\nFile refreshed before possession to confirm the best available options at that time."
  );
  const [estimatedCompletion, setEstimatedCompletion] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [showAddBuilder, setShowAddBuilder] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const exportRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const builder = db.builders.find((b) => b.id === builderId);
  const community = db.communities.find((c) => c.id === communityId);
  const broker = TEAM.find((t) => t.id === brokerId);
  const scale = 420 / PAGE_W; // on-screen preview scale, matches InstaReview's fixed-preview-width approach

  const validUnits = units.filter((u) => u.price > 0);
  const activeUnit = validUnits[Math.min(previewIndex, Math.max(validUnits.length - 1, 0))];

  function pickCommunity(id: string) {
    setCommunityId(id);
    const c = db.communities.find((x) => x.id === id);
    if (!c) return;
    setCommunityNameOverride(c.name);
    setCityProvince(c.city);
    setAreaManagerName(c.areaManagerName);
    setAreaManagerPhone(c.areaManagerPhone);
    setAreaManagerEmail(c.areaManagerEmail);
  }

  function addScenario() {
    setScenarios((rows) => [...rows, { id: uid(), rate: 0, downPaymentPercent: 0 }]);
  }
  function removeScenario(id: string) {
    setScenarios((rows) => rows.filter((r) => r.id !== id));
  }
  function updateScenario<K extends keyof RateScenario>(id: string, field: K, value: RateScenario[K]) {
    setScenarios((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addUnit() {
    setUnits((rows) => [...rows, newUnit()]);
  }
  function removeUnit(id: string) {
    setUnits((rows) => rows.filter((u) => u.id !== id));
  }
  function updateUnit<K extends keyof FeatureUnit>(id: string, field: K, value: FeatureUnit[K]) {
    setUnits((rows) => rows.map((u) => (u.id === id ? { ...u, [field]: value } : u)));
  }

  async function onHeroPhoto(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file, 1400); // wide band, needs more than a logo-sized cap
      setHeroPhoto(dataUrl);
    } catch {
      setError("Couldn't load that photo — try a different file.");
    }
  }

  async function downloadPdf() {
    if (validUnits.length === 0) {
      setError("Add at least one price point with a price before exporting.");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });
      for (let i = 0; i < validUnits.length; i++) {
        const node = exportRefs.current[validUnits[i].id];
        if (!node) continue;
        const dataUrl = await toPng(node, {
          width: PAGE_W,
          height: PAGE_H,
          pixelRatio: 1,
          cacheBust: true,
          style: { transform: "none", transformOrigin: "top left" },
        });
        if (i > 0) pdf.addPage();
        pdf.addImage(dataUrl, "PNG", 0, 0, 8.5, 11);
      }
      const slug = (communityNameOverride || "sheet").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      pdf.save(`spire-feature-sheet-${slug}.pdf`);
    } catch {
      setError("PDF export failed. Try again.");
    } finally {
      setExporting(false);
    }
  }

  const communityLine = [communityNameOverride, cityProvince].filter(Boolean).join(" · ");
  const bullets = rateHoldBullets.split("\n").map((b) => b.trim()).filter(Boolean);

  const sharedCanvasProps = {
    builder,
    communityLine: communityLine || "Community Name · City, Province",
    heroPhoto,
    scenarios: scenarios.filter((s) => s.downPaymentPercent > 0 && s.rate > 0),
    broker,
    areaManagerName,
    areaManagerPhone,
    areaManagerEmail,
    builderWebsite,
    rateHoldMonths,
    rateHoldIntro,
    bullets,
    estimatedCompletion,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "470px 1fr", gap: 0, fontFamily: FONT_SANS, color: PALETTE.confidence, background: PALETTE.paper, margin: "0 -24px" }}>
      <div style={{ background: "#fff", borderRight: `1px solid ${PALETTE.clarity}`, padding: "32px 30px 64px" }}>
        <SectionLabel n={1} label="Builder & community" />
        <div style={{ marginTop: 14 }}>
          <FieldLabel>Builder</FieldLabel>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <select value={builderId} onChange={(e) => setBuilderId(e.target.value)} style={selectStyle}>
              <option value="">Select a builder…</option>
              {db.builders.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button type="button" className="btn secondary small" onClick={() => setShowAddBuilder((v) => !v)}>
              {showAddBuilder ? "Cancel" : "+ New"}
            </button>
          </div>
          {showAddBuilder && <AddBuilderForm mutate={mutate} onDone={(id) => { setBuilderId(id); setShowAddBuilder(false); }} />}
        </div>

        <div style={{ marginTop: 14 }}>
          <FieldLabel>Community</FieldLabel>
          <select value={communityId} onChange={(e) => pickCommunity(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: 6 }}>
            <option value="">Select a community…</option>
            {db.communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <TextField label="Community name" value={communityNameOverride} onChange={setCommunityNameOverride} placeholder="The Summit — Wentworth" />
          <TextField label="City, province" value={cityProvince} onChange={setCityProvince} placeholder="Calgary, AB T3H 5K5" />
        </div>

        <div style={{ marginTop: 12 }}>
          <FieldLabel>Hero photo</FieldLabel>
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onHeroPhoto(f); }} style={{ marginTop: 6 }} />
        </div>

        <Divider />
        <SectionLabel n={2} label="Assumptions" />
        <div style={{ marginTop: 6, fontSize: 11.5, color: PALETTE.grey4 }}>
          Rate often differs by down payment tier (insured vs. conventional) — add one scenario per rate/down-payment pairing.
        </div>
        <div style={{ marginTop: 8 }}>
          <FieldLabel>Down payment &amp; rate scenarios</FieldLabel>
          {scenarios.map((s, i) => (
            <div key={s.id} style={{ marginTop: 10, padding: 10, border: `1px solid ${PALETTE.grey1}`, borderRadius: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: PALETTE.grey4, textTransform: "uppercase" }}>Scenario {i + 1}</span>
                {scenarios.length > 1 && (
                  <button type="button" className="x-link" onClick={() => removeScenario(s.id)}>Remove</button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                <div>
                  <FieldLabel>Down payment (%)</FieldLabel>
                  <input
                    type="number"
                    step="1"
                    value={s.downPaymentPercent || ""}
                    onChange={(e) => updateScenario(s.id, "downPaymentPercent", Number(e.target.value))}
                    placeholder="10"
                    style={{ ...inputStyle, marginTop: 6 }}
                  />
                </div>
                <div>
                  <FieldLabel>Rate (%)</FieldLabel>
                  <input
                    type="number"
                    step="0.01"
                    value={s.rate || ""}
                    onChange={(e) => updateScenario(s.id, "rate", Number(e.target.value))}
                    placeholder="4.99"
                    style={{ ...inputStyle, marginTop: 6 }}
                  />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="btn secondary small" style={{ marginTop: 8 }} onClick={addScenario}>+ Add scenario</button>
        </div>

        <Divider />
        <SectionLabel n={3} label="Price points" />
        <div style={{ marginTop: 6, fontSize: 11.5, color: PALETTE.grey4 }}>
          One page is generated per price point below — currently {units.length === 1 ? "1 page" : `${units.length} pages`}.
        </div>
        {units.map((u, i) => (
          <UnitCard key={u.id} unit={u} index={i} onChange={updateUnit} onRemove={() => removeUnit(u.id)} canRemove={units.length > 1} />
        ))}
        <button type="button" className="btn secondary small" style={{ marginTop: 8 }} onClick={addUnit}>+ Add price point</button>

        <Divider />
        <SectionLabel n={4} label="Contacts" />
        <div style={{ marginTop: 14 }}>
          <FieldLabel>Mortgage broker</FieldLabel>
          <select value={brokerId} onChange={(e) => setBrokerId(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: 6 }}>
            {TEAM.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <TextField label="Builder contact name" value={areaManagerName} onChange={setAreaManagerName} />
          <TextField label="Builder contact phone" value={areaManagerPhone} onChange={setAreaManagerPhone} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <TextField label="Builder contact email" value={areaManagerEmail} onChange={setAreaManagerEmail} />
          <TextField label="Builder website" value={builderWebsite} onChange={setBuilderWebsite} placeholder="www.tricohomes.com" />
        </div>

        <Divider />
        <SectionLabel n={5} label="Rate hold program" />
        <div style={{ marginTop: 14 }}>
          <FieldLabel>Rate hold length (months)</FieldLabel>
          <input type="number" value={rateHoldMonths} onChange={(e) => setRateHoldMonths(Number(e.target.value))} style={inputStyle} />
        </div>
        <div style={{ marginTop: 12 }}>
          <FieldLabel>Intro copy</FieldLabel>
          <textarea value={rateHoldIntro} onChange={(e) => setRateHoldIntro(e.target.value)} style={{ ...textareaStyle, height: 64, marginTop: 6 }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <FieldLabel>Bullet points (one per line)</FieldLabel>
          <textarea value={rateHoldBullets} onChange={(e) => setRateHoldBullets(e.target.value)} style={{ ...textareaStyle, height: 80, marginTop: 6 }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <TextField label="Estimated completion" value={estimatedCompletion} onChange={setEstimatedCompletion} placeholder="Summer 2028" />
        </div>

        <button
          type="button"
          onClick={downloadPdf}
          disabled={exporting}
          style={{ width: "100%", marginTop: 20, padding: "12px 16px", background: PALETTE.confidence, color: "#fff", border: "none", borderRadius: 4, fontSize: 13.5, fontWeight: 600, cursor: exporting ? "default" : "pointer", opacity: exporting ? 0.75 : 1 }}
        >
          {exporting ? "Exporting…" : `Download PDF (${validUnits.length || 0} page${validUnits.length === 1 ? "" : "s"})`}
        </button>
        {error && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: PALETTE.errorBg, borderLeft: `3px solid ${PALETTE.errorText}`, color: PALETTE.errorText, fontSize: 12.5, borderRadius: 2 }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ background: PALETTE.paper, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", minHeight: 560 }}>
        {validUnits.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
            {validUnits.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setPreviewIndex(i)}
                className={`btn secondary small${i === previewIndex ? " active" : ""}`}
                style={i === previewIndex ? { background: PALETTE.confidence, color: "#fff" } : undefined}
              >
                {u.name || `Page ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        {activeUnit ? (
          <div style={{ width: PAGE_W * scale, height: PAGE_H * scale, overflow: "hidden", boxShadow: "0 14px 30px rgba(34,67,75,0.12), 0 4px 8px rgba(34,67,75,0.06)" }}>
            <div style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <FeatureSheetCanvas unit={activeUnit} {...sharedCanvasProps} />
            </div>
          </div>
        ) : (
          <div style={{ color: PALETTE.grey3, fontSize: 13.5, textAlign: "center", maxWidth: 320 }}>
            Add a price point with a price to see a preview.
          </div>
        )}
        <div style={{ marginTop: 20, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: PALETTE.grey2 }}>
          US Letter · 8.5 × 11in · exports at print resolution
        </div>
      </div>

      {/* Hidden full-size render of every valid unit, used only to rasterize the multi-page PDF export. */}
      <div style={{ position: "fixed", top: 0, left: -99999, pointerEvents: "none" }}>
        {validUnits.map((u) => (
          <div key={u.id} ref={(el) => { exportRefs.current[u.id] = el; }} style={{ width: PAGE_W, height: PAGE_H }}>
            <FeatureSheetCanvas unit={u} {...sharedCanvasProps} />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- shared little form pieces (kept local so this file doesn't need
// InstaReview's private helpers) ------------------------------------------

const selectStyle: React.CSSProperties = { flex: 1, padding: "10px 11px", fontSize: 13.5, border: `1px solid ${PALETTE.grey1}`, borderRadius: 2 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 11px", fontSize: 13.5, border: `1px solid ${PALETTE.grey1}`, borderRadius: 2 };
const textareaStyle: React.CSSProperties = { width: "100%", padding: 10, fontSize: 13, lineHeight: 1.5, border: `1px solid ${PALETTE.grey1}`, borderRadius: 2, resize: "vertical" };

function Divider() {
  return <div style={{ height: 1, background: PALETTE.clarity, margin: "24px 0" }} />;
}

function SectionLabel({ n, label }: { n: number; label: string }) {
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
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, marginTop: 6 }} />
    </div>
  );
}

function UnitCard({
  unit, index, onChange, onRemove, canRemove,
}: {
  unit: FeatureUnit;
  index: number;
  onChange: <K extends keyof FeatureUnit>(id: string, field: K, value: FeatureUnit[K]) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div style={{ marginTop: 14, padding: 12, border: `1px solid ${PALETTE.grey1}`, borderRadius: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: PALETTE.grey4, textTransform: "uppercase" }}>Price point {index + 1}</span>
        {canRemove && <button type="button" className="x-link" onClick={onRemove}>Remove</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
        <TextField label="Unit / model name" value={unit.name} onChange={(v) => onChange(unit.id, "name", v)} placeholder="Tonquin" />
        <div>
          <FieldLabel>Price</FieldLabel>
          <input type="number" value={unit.price || ""} onChange={(e) => onChange(unit.id, "price", Number(e.target.value))} placeholder="333900" style={{ ...inputStyle, marginTop: 6 }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <TextField label="Type" value={unit.type} onChange={(v) => onChange(unit.id, "type", v)} placeholder="Condominium" />
        <TextField label="Layout" value={unit.layout} onChange={(v) => onChange(unit.id, "layout", v)} placeholder="1 Bedroom" />
      </div>
      <div style={{ marginTop: 10 }}>
        <TextField label="Size" value={unit.size} onChange={(v) => onChange(unit.id, "size", v)} placeholder="534 sq.ft" />
      </div>
      <div style={{ marginTop: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: PALETTE.confidence }}>
          <input type="checkbox" checked={unit.hasCondoFee} onChange={(e) => onChange(unit.id, "hasCondoFee", e.target.checked)} />
          Are there condo fees?
        </label>
        {unit.hasCondoFee && (
          <input
            type="number"
            value={unit.condoFee || ""}
            onChange={(e) => onChange(unit.id, "condoFee", Number(e.target.value))}
            placeholder="247"
            style={{ ...inputStyle, marginTop: 6 }}
          />
        )}
      </div>
    </div>
  );
}

function AddBuilderForm({ mutate, onDone }: { mutate: Mutate; onDone: (id: string) => void }) {
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [saving, setSaving] = useState(false);

  async function onLogo(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file, 400);
      setLogo(dataUrl);
    } catch {
      showToast("Couldn't load that logo");
    }
  }

  async function save() {
    if (!name.trim() || !logo) {
      showToast("A name and logo are both required");
      return;
    }
    setSaving(true);
    try {
      const newBuilder: Builder = { id: uid(), name: name.trim(), logo };
      await mutate("builders", (arr: TrackerDB["builders"]) => [...arr, newBuilder]);
      onDone(newBuilder.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 10, padding: 12, border: `1px solid ${PALETTE.grey1}`, borderRadius: 4 }}>
      <TextField label="Builder name" value={name} onChange={setName} placeholder="Trico Homes" />
      <div style={{ marginTop: 10 }}>
        <FieldLabel>Logo</FieldLabel>
        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); }} style={{ marginTop: 6 }} />
        {logo && <img src={logo} alt="logo preview" style={{ height: 40, marginTop: 8, display: "block" }} />}
      </div>
      <button type="button" className="btn small" style={{ marginTop: 10 }} disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save builder"}
      </button>
    </div>
  );
}

// --- the print canvas: one page per price point -----------------------------

function FeatureSheetCanvas({
  unit, builder, communityLine, heroPhoto, scenarios: rateScenarios, broker,
  areaManagerName, areaManagerPhone, areaManagerEmail, builderWebsite,
  rateHoldMonths, rateHoldIntro, bullets, estimatedCompletion,
}: {
  unit: FeatureUnit;
  builder: Builder | undefined;
  communityLine: string;
  heroPhoto: string;
  scenarios: RateScenario[];
  broker: TeamMember | undefined;
  areaManagerName: string;
  areaManagerPhone: string;
  areaManagerEmail: string;
  builderWebsite: string;
  rateHoldMonths: number;
  rateHoldIntro: string;
  bullets: string[];
  estimatedCompletion: string;
}) {
  const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const condoFee = unit.hasCondoFee ? unit.condoFee : 0;
  const rows = (rateScenarios.length > 0 ? rateScenarios : [{ id: "placeholder", rate: 0, downPaymentPercent: 0 }]).map((s) => {
    const scenario = unit.price > 0 && s.downPaymentPercent > 0 ? buildDownPaymentScenario(unit.price, s.downPaymentPercent, s.rate) : ZERO_SCENARIO;
    return { pct: s.downPaymentPercent, rate: s.rate, scenario, total: scenario.monthlyPayment + condoFee };
  });
  const anyPremium = rows.some((r) => r.scenario.premiumAmount > 0);

  return (
    <div style={{ width: PAGE_W, height: PAGE_H, background: PALETTE.paper, fontFamily: FONT_SANS, color: PALETTE.confidence, display: "flex", flexDirection: "column" }}>
      {/* 1. Hero photo band */}
      <div style={{ position: "relative", height: 480, background: heroPhoto ? undefined : PALETTE.grey1, flexShrink: 0 }}>
        {heroPhoto && <img src={heroPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${PALETTE.confidence}E6, ${PALETTE.confidence}40 55%, transparent 85%)` }} />
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 12.5, letterSpacing: "0.2em", color: PALETTE.warmth, textTransform: "uppercase" }}>{communityLine}</div>
            <div style={{ fontSize: 50, fontWeight: 600, color: "#fff", textTransform: "uppercase", lineHeight: 1.05, marginTop: 8 }}>{unit.name || "Unit Name"}</div>
            <div style={{ width: 56, height: 3, background: PALETTE.warmth, marginTop: 12 }} />
          </div>
          <div style={{ textAlign: "right", color: "#fff" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.18em", color: "#fff", opacity: 0.85, textTransform: "uppercase" }}>
              Purchase Price
            </div>
            <div style={{ fontSize: 42, fontWeight: 700, marginTop: 6 }}>{money(unit.price)}</div>
          </div>
        </div>
      </div>

      {/* 2. Stat bar */}
      <div style={{ display: "flex", gap: 56, padding: "28px 64px", borderBottom: `1px solid ${PALETTE.clarity}`, flexShrink: 0 }}>
        <Stat label="Type" value={unit.type || "—"} />
        <Stat label="Layout" value={unit.layout || "—"} />
        <Stat label="Size" value={unit.size || "—"} />
        <Stat label="Condo Fee" value={condoFee > 0 ? `${money(condoFee)} / Month` : "No condo fees"} />
      </div>

      {/* 3. Numbers box + rate hold program, two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, padding: "32px 64px", flex: 1 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: "0.18em", color: PALETTE.grey4, textTransform: "uppercase" }}>
            Your numbers — 30-year amortization
          </div>
          <div style={{ marginTop: 16, border: `1px solid ${PALETTE.grey1}`, borderRadius: 6, background: "#fff", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: PALETTE.confidence, color: "#fff" }}>
                  <th style={miniTh}>Down</th>
                  <th style={miniTh}>Rate</th>
                  <th style={miniTh}>Down payment</th>
                  <th style={miniTh}>Mortgage pmt</th>
                  <th style={miniTh}>Total monthly</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 ? PALETTE.paper : "#fff" }}>
                    <td style={miniTd}><b>{r.pct}%</b></td>
                    <td style={miniTd}>{r.rate.toFixed(2)}%</td>
                    <td style={miniTd}>{money(r.scenario.downPayment)}</td>
                    <td style={miniTd}>{money(r.scenario.monthlyPayment)}</td>
                    <td style={{ ...miniTd, fontWeight: 700, color: PALETTE.warmthDark }}>{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {condoFee > 0 && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: PALETTE.grey4 }}>
              Total monthly above includes the {money(condoFee)}/month condo fee.
            </div>
          )}
        </div>

        <div style={{ borderLeft: `1px solid ${PALETTE.clarity}`, paddingLeft: 48 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.14em", color: PALETTE.warmthDark, textTransform: "uppercase", fontWeight: 700 }}>
            {rateHoldMonths}-Month Rate Hold Program Available
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, marginTop: 14 }}>{rateHoldIntro}</div>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {bullets.map((b, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>{b}</div>
            ))}
          </div>
          {estimatedCompletion && (
            <div style={{ marginTop: 18, fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 13.5, color: PALETTE.grey4 }}>
              Estimated completion: {estimatedCompletion}.
            </div>
          )}
        </div>
      </div>

      {/* 4. Footer */}
      <div style={{ background: PALETTE.confidence, color: "#fff", padding: "28px 64px", flexShrink: 0 }}>
        <img src="/insta-review/assets/logo-spire-stacked-white.png" alt="Spire Mortgage" style={{ height: 44 }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: PALETTE.warmth, textTransform: "uppercase" }}>Mortgage</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{broker?.name || "—"}</div>
            <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>
              {broker ? `${broker.phone}${broker.phone ? " · " : ""}${teamEmail(broker)}` : ""}
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.85 }}>www.spiremortgage.ca</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: PALETTE.warmth, textTransform: "uppercase" }}>{builder?.name || "Builder"}</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{areaManagerName || "—"}</div>
            <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>
              {areaManagerPhone}{areaManagerPhone && areaManagerEmail ? " · " : ""}{areaManagerEmail}
            </div>
            {builderWebsite && <div style={{ fontSize: 11.5, opacity: 0.85 }}>{builderWebsite}</div>}
          </div>
        </div>
        <div style={{ fontSize: 9.5, lineHeight: 1.5, opacity: 0.7, marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 12 }}>
          Figures assume the fixed rate(s), down payment(s), and 30-year amortization shown above
          {anyPremium ? ", with the applicable CMHC insurance premium added to the mortgage where the down payment is under 20%" : ""}
          {condoFee > 0 ? ". Total monthly figures include the condo fee shown above" : ""}.
          Payments are principal and interest only and exclude property tax, home insurance, and utilities. Estimates only — subject to change, qualification, and lender approval.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, letterSpacing: "0.14em", color: PALETTE.warmthDark, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const miniTh: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 };
const miniTd: React.CSSProperties = { padding: "12px 14px", borderBottom: `1px solid ${PALETTE.clarity}`, fontSize: 14 };
