import { Stage, ContactType, Outcome, DocStatus } from "./types";

export const STAGES: Stage[] = [
  "Lead",
  "Pre-Approval",
  "Docs Collection",
  "Conditions",
  "Underwriting",
  "Funding",
  "Closed - Won",
  "Dead - Lost",
];

export const ACTIVE_STAGES: Stage[] = STAGES.filter(
  (s) => !s.startsWith("Closed") && !s.startsWith("Dead")
);

export const STAGE_COLORS: Record<Stage, string> = {
  "Lead": "#BFCACA",
  "Pre-Approval": "#9FB3AE",
  "Docs Collection": "#C39D75",
  "Conditions": "#B58A5E",
  "Underwriting": "#697B81",
  "Funding": "#4F6E76",
  "Closed - Won": "#5B7B63",
  "Dead - Lost": "#B5533C",
};

export const CONTACT_TYPES: ContactType[] = [
  "Initial Call",
  "Follow-Up Call",
  "Email",
  "Appointment",
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
} as const;
