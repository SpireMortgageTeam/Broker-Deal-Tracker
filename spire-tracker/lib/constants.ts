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

// Email Assistant tab is restricted to these broker names while it's being
// tested. Add a name here to give someone else access — remove this
// allowlist entirely (and the check that uses it) once it's ready for the
// whole team.
export const EMAIL_ASSISTANT_BROKERS: string[] = ["Prashant"];

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
