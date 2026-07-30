// Server-only email helper. Sends transactional notifications via Resend's
// HTTP API (no SDK dependency — just fetch), and builds the two escalation
// email templates. Never import this from a client component; it reads the
// RESEND_API_KEY secret from the server environment.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Brand palette, mirrored from app/globals.css. Email clients strip <style>
// blocks and CSS variables, so every color is inlined below.
const COLORS = {
  charcoal: "#22434b",
  tan: "#c39d75",
  danger: "#b5533c",
  greyblue: "#697b81",
  bg: "#faf8f4",
  warmgrey: "#d5d3cd",
  white: "#ffffff",
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function appUrl(): string {
  return (process.env.APP_URL || "https://broker-deal-tracker.vercel.app").replace(/\/$/, "");
}

interface SendArgs {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Sends an email through Resend. Returns a result object rather than throwing,
 * so a notification failure can never break the underlying user action
 * (flagging a deal, saving a response, etc.).
 */
export async function sendEmail({ to, subject, html, replyTo }: SendArgs): Promise<{
  ok: boolean;
  skipped?: string;
  error?: string;
}> {
  const recipients = to.map((t) => t.trim()).filter(Boolean);
  if (!recipients.length) return { ok: false, skipped: "no recipients configured" };
  if (!isEmailConfigured()) return { ok: false, skipped: "RESEND_API_KEY / EMAIL_FROM not set" };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: recipients,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

// ---- Templates ---------------------------------------------------------------

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ShellArgs {
  accent: string;
  eyebrow: string;
  heading: string;
  intro: string;
  rows: [string, string][]; // label, value
  note?: string;
  ctaLabel: string;
  ctaUrl: string;
}

function shell({ accent, eyebrow, heading, intro, rows, note, ctaLabel, ctaUrl }: ShellArgs): string {
  const rowHtml = rows
    .filter(([, v]) => v && v.trim())
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${COLORS.warmgrey};font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:${COLORS.greyblue};font-weight:700;width:150px;vertical-align:top;">${esc(label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid ${COLORS.warmgrey};font-size:14px;color:${COLORS.charcoal};vertical-align:top;">${esc(value)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:${COLORS.white};border:1px solid ${COLORS.warmgrey};border-radius:14px;overflow:hidden;">
          <tr>
            <td style="height:5px;background:${accent};"></td>
          </tr>
          <tr>
            <td style="padding:26px 30px 4px;">
              <div style="font-family:'Brush Script MT',cursive;color:${COLORS.tan};font-size:22px;font-weight:600;">Spire</div>
              <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${accent};font-weight:700;margin-top:14px;">${esc(eyebrow)}</div>
              <h1 style="margin:6px 0 0;font-size:21px;line-height:1.25;color:${COLORS.charcoal};">${esc(heading)}</h1>
              <p style="margin:12px 0 20px;font-size:14px;line-height:1.55;color:${COLORS.greyblue};">${esc(intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowHtml}</table>
            </td>
          </tr>
          ${
            note
              ? `<tr><td style="padding:18px 30px 0;"><div style="background:${COLORS.bg};border-left:3px solid ${accent};border-radius:6px;padding:12px 14px;font-size:13.5px;line-height:1.5;color:${COLORS.charcoal};">${esc(note)}</div></td></tr>`
              : ""
          }
          <tr>
            <td style="padding:24px 30px 30px;">
              <a href="${esc(ctaUrl)}" style="display:inline-block;background:${COLORS.charcoal};color:${COLORS.white};text-decoration:none;font-size:13px;font-weight:600;padding:11px 20px;border-radius:8px;">${esc(ctaLabel)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 30px;background:${COLORS.bg};border-top:1px solid ${COLORS.warmgrey};font-size:11.5px;color:${COLORS.greyblue};line-height:1.5;">
              Spire Pipeline Tracker · automated notification. You're receiving this because you're set up in the team tracker.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface EscalationEmailData {
  broker: string;
  clientName: string;
  stage: string;
  value?: number;
  reason: string;
  flaggedAt: string; // human-readable
}

export function escalationEmail(d: EscalationEmailData): { subject: string; html: string } {
  return {
    subject: `🚩 Escalation flagged: ${d.clientName} (${d.broker})`,
    html: shell({
      accent: COLORS.danger,
      eyebrow: "New escalation",
      heading: `${d.broker} flagged a deal for help`,
      intro: `${d.broker} has escalated a deal that needs ops attention. Details below — open the tracker to respond.`,
      rows: [
        ["Broker", d.broker],
        ["Client", d.clientName],
        ["Stage", d.stage],
        ["Deal value", typeof d.value === "number" && d.value > 0 ? `$${d.value.toLocaleString()}` : ""],
        ["Flagged", d.flaggedAt],
      ],
      note: d.reason ? `Reason / what's needed: ${d.reason}` : "No reason was provided with the flag.",
      ctaLabel: "Open escalations",
      ctaUrl: `${appUrl()}/`,
    }),
  };
}

export interface OpsUpdateEmailData {
  broker: string;
  clientName: string;
  stage: string;
  reason: string;
  opsResponse: string;
  kind: "response" | "resolved";
}

export function opsUpdateEmail(d: OpsUpdateEmailData): { subject: string; html: string } {
  const resolved = d.kind === "resolved";
  return {
    subject: resolved
      ? `✅ Escalation resolved: ${d.clientName}`
      : `💬 Ops responded on your escalation: ${d.clientName}`,
    html: shell({
      accent: resolved ? "#5B7B63" : COLORS.tan,
      eyebrow: resolved ? "Escalation resolved" : "Ops response",
      heading: resolved
        ? `Your escalation on ${d.clientName} is resolved`
        : `Ops responded to your escalation on ${d.clientName}`,
      intro: resolved
        ? "Your ops manager has closed out this escalation. Here's the final summary."
        : "Your ops manager has responded to the deal you flagged. Details below.",
      rows: [
        ["Client", d.clientName],
        ["Stage", d.stage],
        ["Your reason", d.reason],
      ],
      note: d.opsResponse
        ? `Ops response: ${d.opsResponse}`
        : resolved
        ? "Marked resolved (no written response left)."
        : "",
      ctaLabel: "View in tracker",
      ctaUrl: `${appUrl()}/`,
    }),
  };
}
