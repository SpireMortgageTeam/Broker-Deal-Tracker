import { Stage, ContactType, Outcome, DocStatus } from "./types";

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
