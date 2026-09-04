"use client";
import { useRef, useState } from "react";
import { Builder, TrackerDB } from "@/lib/types";
import { PALETTE, FONT_SANS, FONT_SERIF } from "@/lib/brandPalette";
import { TEAM, TeamMember, teamEmail } from "@/lib/team";
import { buildPriceRow, PriceRow } from "@/lib/mortgageMath";
import { fileToDataUrl } from "@/lib/imageUpload";
import { uid } from "@/lib/utils";
import { showToast } from "./Toast";
import type { Mutate } from "@/app/page";

// Ported from the same Claude Design spec Renée wrote for co-branded
// builder-partner feature sheets — see the plan file for the full prompt.
// Two-column layout (form | live preview), same technique as InstaReview.tsx:
// the preview is built as real DOM at exact print resolution (US Letter,
// 150dpi = 1275x1650), scaled down on screen via CSS transform, then
// rasterized at full size for export.

const PAGE_W = 1275;
const PAGE_H = 1650;

const DISCLAIMER =
  "Figures assume the fixed rate and amortization shown, and semi-annual compounding, per Canadian mortgage convention. Minimum-down and 10% scenarios include the applicable CMHC mortgage default insurance premium, added to the mortgage. Payments are principal and interest only and exclude property tax, home insurance, and utilities. Estimates only — subject to change, qualification, and lender approval.";

export default function FeatureSheet({ db, mutate }: { db: TrackerDB; mutate: Mutate }) {
  const [builderId, setBuilderId] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [communityNameOverride, setCommunityNameOverride] = useState("");
  const [cityProvince, setCityProvince] = useState("");
  const [heroPhoto, setHeroPhoto] = useState("");
  const [homeType, setHomeType] = useState("");
  const [rate, setRate] = useState(4.99);
  const [eyebrow, setEyebrow] = useState("NOW SELLING");
  const [brokerId, setBrokerId] = useState(TEAM[0]?.id || "");
  const [areaManagerName, setAreaManagerName] = useState("");
  const [areaManagerPhone, setAreaManagerPhone] = useState("");
  const [areaManagerEmail, setAreaManagerEmail] = useState("");
  const [priceRows, setPriceRows] = useState<number[]>([680000, 715000, 750000]);
  const [pullLine, setPullLine] = useState("Principal and interest only. Insurance premiums are already built into every figure below.");
  const [leftTitle, setLeftTitle] = useState("Why 5% isn't a flat 5%");
  const [leftBody, setLeftBody] = useState(
    "Above $500,000 purchase price, Canada's minimum down payment is 5% on the first $500,000 and 10% on everything above it. On a $750,000 home that's $50,000 — not $37,500. The first column reflects the real minimum."
  );
  const [rightTitle, setRightTitle] = useState("12-month rate hold protection available");
  const [rightBody, setRightBody] = useState(
    "Income, credit, and down payment are reviewed now, so the financing position is established up front. If rates move lower before possession, the file is reviewed again so your buyer takes the better of the two."
  );
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [showAddBuilder, setShowAddBuilder] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);

  const builder = db.builders.find((b) => b.id === builderId);
  const community = db.communities.find((c) => c.id === communityId);
  const broker = TEAM.find((t) => t.id === brokerId);
  const scale = 420 / PAGE_W; // on-screen preview scale, matches InstaReview's fixed-preview-width approach

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

  function addPriceRow() {
    setPriceRows((rows) => [...rows, 0]);
  }
  function removePriceRow(i: number) {
    setPriceRows((rows) => rows.filter((_, idx) => idx !== i));
  }
  function updatePriceRow(i: number, value: number) {
    setPriceRows((rows) => rows.map((r, idx) => (idx === i ? value : r)));
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
    if (!sheetRef.current) return;
    setExporting(true);
    setError("");
    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");
      const dataUrl = await toPng(sheetRef.current, {
        width: PAGE_W,
        height: PAGE_H,
        pixelRatio: 1,
        cacheBust: true,
        style: { transform: "none", transformOrigin: "top left" },
      });
      const pdf = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });
      pdf.addImage(dataUrl, "PNG", 0, 0, 8.5, 11);
      const slug = (communityNameOverride || "sheet").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      pdf.save(`spire-feature-sheet-${slug}.pdf`);
    } catch {
      setError("PDF export failed. Try again.");
    } finally {
      setExporting(false);
    }
  }

  const rows: PriceRow[] = priceRows.filter((p) => p > 0).map((p) => buildPriceRow(p, rate));

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
          <TextField label="Community name" value={communityNameOverride} onChange={setCommunityNameOverride} placeholder="Southbow Landing" />
          <TextField label="City, province" value={cityProvince} onChange={setCityProvince} placeholder="Cochrane, Alberta" />
        </div>

        <div style={{ marginTop: 12 }}>
          <FieldLabel>Hero photo</FieldLabel>
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onHeroPhoto(f); }} style={{ marginTop: 6 }} />
        </div>

        <Divider />
        <SectionLabel n={2} label="Home details" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <TextField label="Home type" value={homeType} onChange={setHomeType} placeholder="Front-attached garage homes" />
          <div>
            <FieldLabel>Rate (%)</FieldLabel>
            <input type="number" step="0.01" value={rate} onChange={(e) => setRate(Number(e.target.value))} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <TextField label="Eyebrow" value={eyebrow} onChange={setEyebrow} placeholder="NOW SELLING" />
        </div>

        <div style={{ marginTop: 14 }}>
          <FieldLabel>Price points</FieldLabel>
          {priceRows.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input type="number" value={p || ""} onChange={(e) => updatePriceRow(i, Number(e.target.value))} placeholder="750000" style={inputStyle} />
              <button type="button" className="x-link" onClick={() => removePriceRow(i)}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn secondary small" style={{ marginTop: 8 }} onClick={addPriceRow}>+ Add price point</button>
        </div>

        <Divider />
        <SectionLabel n={3} label="Contacts" />
        <div style={{ marginTop: 14 }}>
          <FieldLabel>Mortgage broker</FieldLabel>
          <select value={brokerId} onChange={(e) => setBrokerId(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: 6 }}>
            {TEAM.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <TextField label="Sales associate name" value={areaManagerName} onChange={setAreaManagerName} />
          <TextField label="Sales associate phone" value={areaManagerPhone} onChange={setAreaManagerPhone} />
        </div>
        <div style={{ marginTop: 12 }}>
          <TextField label="Sales associate email" value={areaManagerEmail} onChange={setAreaManagerEmail} />
        </div>

        <Divider />
        <SectionLabel n={4} label="Copy" />
        <div style={{ marginTop: 14 }}>
          <FieldLabel>Editorial pull-line (italic, top right)</FieldLabel>
          <textarea value={pullLine} onChange={(e) => setPullLine(e.target.value)} style={{ ...textareaStyle, height: 50 }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <TextField label="Left explainer heading" value={leftTitle} onChange={setLeftTitle} />
          <FieldLabel>Left explainer body</FieldLabel>
          <textarea value={leftBody} onChange={(e) => setLeftBody(e.target.value)} style={{ ...textareaStyle, height: 80, marginTop: 6 }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <TextField label="Right explainer heading" value={rightTitle} onChange={setRightTitle} />
          <FieldLabel>Right explainer body</FieldLabel>
          <textarea value={rightBody} onChange={(e) => setRightBody(e.target.value)} style={{ ...textareaStyle, height: 80, marginTop: 6 }} />
        </div>

        <button
          type="button"
          onClick={downloadPdf}
          disabled={exporting}
          style={{ width: "100%", marginTop: 20, padding: "12px 16px", background: PALETTE.confidence, color: "#fff", border: "none", borderRadius: 4, fontSize: 13.5, fontWeight: 600, cursor: exporting ? "default" : "pointer", opacity: exporting ? 0.75 : 1 }}
        >
          {exporting ? "Exporting…" : "Download PDF"}
        </button>
        {error && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: PALETTE.errorBg, borderLeft: `3px solid ${PALETTE.errorText}`, color: PALETTE.errorText, fontSize: 12.5, borderRadius: 2 }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ background: PALETTE.paper, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", minHeight: 560 }}>
        <div style={{ width: PAGE_W * scale, height: PAGE_H * scale, overflow: "hidden", boxShadow: "0 14px 30px rgba(34,67,75,0.12), 0 4px 8px rgba(34,67,75,0.06)" }}>
          <div ref={sheetRef} style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <FeatureSheetCanvas
              builder={builder}
              communityName={communityNameOverride || "Community Name"}
              cityProvince={cityProvince || "City, Province"}
              heroPhoto={heroPhoto}
              eyebrow={eyebrow}
              homeType={homeType}
              rate={rate}
              pullLine={pullLine}
              rows={rows}
              leftTitle={leftTitle}
              leftBody={leftBody}
              rightTitle={rightTitle}
              rightBody={rightBody}
              broker={broker}
              areaManagerName={areaManagerName}
              areaManagerPhone={areaManagerPhone}
              areaManagerEmail={areaManagerEmail}
            />
          </div>
        </div>
        <div style={{ marginTop: 20, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: PALETTE.grey2 }}>
          US Letter · 8.5 × 11in · exports at print resolution
        </div>
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

// --- the print canvas ------------------------------------------------------

function FeatureSheetCanvas({
  builder, communityName, cityProvince, heroPhoto, eyebrow, homeType, rate, pullLine, rows,
  leftTitle, leftBody, rightTitle, rightBody, broker, areaManagerName, areaManagerPhone, areaManagerEmail,
}: {
  builder: Builder | undefined;
  communityName: string;
  cityProvince: string;
  heroPhoto: string;
  eyebrow: string;
  homeType: string;
  rate: number;
  pullLine: string;
  rows: PriceRow[];
  leftTitle: string;
  leftBody: string;
  rightTitle: string;
  rightBody: string;
  broker: TeamMember | undefined;
  areaManagerName: string;
  areaManagerPhone: string;
  areaManagerEmail: string;
}) {
  const accent = builder?.brandColor || PALETTE.atmosphere;
  const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

  return (
    <div style={{ width: PAGE_W, height: PAGE_H, background: PALETTE.paper, fontFamily: FONT_SANS, color: PALETTE.confidence, display: "flex", flexDirection: "column", padding: "48px 64px" }}>
      {/* 1. Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {builder?.logo ? <img src={builder.logo} alt={builder.name} style={{ height: 64 }} /> : <div style={{ height: 64 }} />}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, letterSpacing: "0.2em", color: PALETTE.warmthDark, textTransform: "uppercase" }}>Mortgage Detail Prepared By</span>
          <img src="/insta-review/assets/logo-spire-horizontal-dark.png" alt="Spire Mortgage" style={{ height: 40 }} />
        </div>
      </div>

      {/* 2. Hero photo band */}
      <div style={{ position: "relative", height: 360, marginTop: 20, borderRadius: 6, overflow: "hidden", background: heroPhoto ? undefined : PALETTE.grey1 }}>
        {heroPhoto && <img src={heroPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${PALETTE.confidence}D9, transparent 60%)` }} />
        <div style={{ position: "absolute", left: 28, right: 28, bottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.18em", color: PALETTE.warmth, textTransform: "uppercase" }}>{eyebrow} · {cityProvince}</div>
            <div style={{ fontSize: 34, fontWeight: 600, color: "#fff", textTransform: "uppercase", lineHeight: 1.1, marginTop: 4 }}>{communityName}</div>
          </div>
          <div style={{ textAlign: "right", color: "#fff", fontSize: 12.5, lineHeight: 1.6 }}>
            {homeType && <div>{homeType}</div>}
            <div>{rate.toFixed(2)}% Fixed · 30-Year Amortization</div>
          </div>
        </div>
      </div>

      {/* 3. Section intro */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 26 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: PALETTE.warmthDark, textTransform: "uppercase" }}>What your monthly payment looks like</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: PALETTE.confidence, marginTop: 2 }}>Three price points · Three down payments</div>
        </div>
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 13, color: PALETTE.grey4, maxWidth: 280, textAlign: "right" }}>{pullLine}</div>
      </div>

      {/* 4. Price matrix */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr style={{ background: PALETTE.confidence, color: "#fff" }}>
            <th style={thStyle}>Purchase price</th>
            <th style={thStyle}>Minimum down<br /><span style={subTh}>5% + 10% tiered</span></th>
            <th style={thStyle}>10% down<br /><span style={subTh}>insured</span></th>
            <th style={thStyle}>20% down<br /><span style={subTh}>no premium</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 ? PALETTE.paper : "#fff" }}>
              <td style={tdStyle}><b style={{ fontSize: 17 }}>{money(row.price)}</b></td>
              <PriceCell col={row.minimum} money={money} />
              <PriceCell col={row.tenPercent} money={money} />
              <PriceCell col={row.twentyPercent} money={money} accent />
            </tr>
          ))}
        </tbody>
      </table>

      {/* 5. Explainer columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 24 }}>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: "0.16em", color: PALETTE.warmthDark, textTransform: "uppercase" }}>{leftTitle}</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: PALETTE.grey4, marginTop: 4 }}>{leftBody}</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: "0.16em", color: PALETTE.warmthDark, textTransform: "uppercase" }}>{rightTitle}</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: PALETTE.grey4, marginTop: 4 }}>{rightBody}</div>
        </div>
      </div>

      {/* 6. Footer */}
      <div style={{ marginTop: "auto", paddingTop: 20 }}>
        <div style={{ width: 38, height: 2, background: accent, marginBottom: 14 }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: PALETTE.warmthDark, textTransform: "uppercase" }}>Mortgage</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{broker?.name || "—"}</div>
            <div className="muted" style={{ fontSize: 11.5, color: PALETTE.grey4 }}>
              {broker ? `${broker.phone}${broker.phone ? " · " : ""}${teamEmail(broker)}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: PALETTE.warmthDark, textTransform: "uppercase" }}>Sales Associate</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{areaManagerName || "—"}</div>
            <div style={{ fontSize: 11.5, color: PALETTE.grey4 }}>
              {areaManagerPhone}{areaManagerPhone && areaManagerEmail ? " · " : ""}{areaManagerEmail}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 9.5, lineHeight: 1.5, color: PALETTE.grey3, marginTop: 14 }}>{DISCLAIMER}</div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 };
const subTh: React.CSSProperties = { fontSize: 9, letterSpacing: "0.04em", textTransform: "none", opacity: 0.75, fontWeight: 400 };
const tdStyle: React.CSSProperties = { padding: "14px", borderBottom: `1px solid ${PALETTE.clarity}`, verticalAlign: "top" };

function PriceCell({ col, money, accent }: { col: PriceRow["minimum"]; money: (n: number) => string; accent?: boolean }) {
  return (
    <td style={tdStyle}>
      <div style={{ fontSize: 17, fontWeight: 600, color: accent ? PALETTE.warmthDark : PALETTE.confidence }}>{money(col.monthlyPayment)}/mo</div>
      <div style={{ fontSize: 11, color: PALETTE.grey4, marginTop: 2 }}>{money(col.downPayment)} down</div>
    </td>
  );
}
