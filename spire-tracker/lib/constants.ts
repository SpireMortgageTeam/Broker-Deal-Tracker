import { Stage, ContactType, Outcome, DocStatus, ClientSource } from "./types";

export const STAGES: Stage[] = [
  "Doc Collection",
  "Pre-App",
  "Submitted",
  "Conditions",
  "Broker Complete",
];

// "Broker Complete" is the terminal stage — once a deal reaches it, the
// broker's work is done, so it drops out of open pipeline counts.
export const ACTIVE_STAGES: Stage[] = STAGES.filter((s) => s !== "Broker Complete");

export const STAGE_COLORS: Record<Stage, string> = {
  "Doc Collection": "#C39D75",
  "Pre-App": "#9FB3AE",
  "Submitted": "#697B81",
  "Conditions": "#B58A5E",
  "Broker Complete": "#5B7B63",
};

export const CONTACT_TYPES: ContactType[] = [
  "Initial Call",
  "Follow-Up Call",
  "Email",
  "Appointment",
  "Underwriting",
  "Condition Management",
  "Client Strategy",
];

// Dropdown options for time spent on a logged activity. Value is stored in
// minutes (for tallying); label is what the broker sees.
export const TIME_SPENT_OPTIONS: { label: string; minutes: number }[] = [
  { label: "5 min", minutes: 5 },
  { label: "10 min", minutes: 10 },
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "60 min", minutes: 60 },
  { label: "90 min", minutes: 90 },
  { label: "120 min", minutes: 120 },
  { label: "180+ min", minutes: 180 },
];

export const OUTCOMES: Outcome[] = [
  "Left voicemail",
  "Spoke with client",
  "Intake email sent",
  "Appointment booked",
  "Waiting for callback",
  "Other",
];

export const DOC_STATUSES: DocStatus[] = ["Complete", "Partial", "None"];

export const CLIENT_SOURCES: ClientSource[] = ["New Lead", "Pre-Approval Revival", "Renewal", "Ownwell"];

// Email Assistant scenarios, for the dropdown in components/EmailAssistant.tsx.
// This is the client-safe side (labels/copy only) — the actual system prompt
// text lives server-side in lib/prompts/*.ts and is looked up by `id` in
// app/api/email-assistant/generate/route.ts. Keep the `id`s in sync between
// the two.
export const EMAIL_ASSISTANT_SCENARIOS: {
  id: string;
  label: string;
  tagline: string;
  inputLabel: string;
  placeholder: string;
  helper: string;
}[] = [
  {
    id: "deal-note-organizer",
    label: "Deal Note Organizer + Client Recap",
    tagline: "Paste your call notes — get a client email and underwriting notes",
    inputLabel: "Call notes / transcript",
    placeholder: "Paste what was discussed on the call — goal, timeline, income, down payment, property, etc.",
    helper: "If anything's missing (income, down payment, timeline, etc.) it'll ask before writing anything — just answer right here and it'll continue.",
  },
  {
    id: "preapproval-generator",
    label: "Preapproval Generator",
    tagline: "Describe the scenario — get a ready-to-send pre-approval email",
    inputLabel: "Scenario details",
    placeholder: "Pre-approval type, purchase price / down payment / amortization for each scenario, key conditions, and rate assumptions.",
    helper: "It'll ask for anything missing from those (pre-approval type, scenarios, conditions, rate assumptions) before generating the email — just answer right here and it'll continue.",
  },
  {
    id: "deal-saver",
    label: "Spire Mortgage Deal Saver",
    tagline: "Client's comparing another lender's rate — get a save-the-deal email",
    inputLabel: "Situation details",
    placeholder: "Property type (owner-occupied or rental), mortgage type (insured or conventional), mortgage amount, and the lender/rate they're considering.",
    helper: "It'll ask for anything missing from those four before writing the comparison — just answer right here and it'll continue.",
  },
];

// Days a deal can sit at one stage before it's flagged as a bottleneck.
// Change this one number if 7 days doesn't match your team's reality.
export const BOTTLENECK_DAYS = 7;

// KV key names — collections are stored as single JSON blobs since the
// dataset (a handful of brokers) is small. Simpler than per-record keys.
export const KV_KEYS = {
  brokers: "data:brokers",
  clients: "data:clients",
  logs: "data:contactlog",
  deals: "data:deals",
  capacity: "data:capacity",
  brokerContacts: "data:brokercontacts",
  opsRecipients: "data:opsrecipients",
} as const;
