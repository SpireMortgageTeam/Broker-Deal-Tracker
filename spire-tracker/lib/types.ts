export type Stage =
  | "Doc Collection"
  | "Pre-App"
  | "Submitted"
  | "Conditions"
  | "Broker Complete";

export type ContactType = "Initial Call" | "Follow-Up Call" | "Email" | "Appointment" | "Underwriting" | "Condition Management" | "Client Strategy";
export type Outcome =
  | "Left voicemail"
  | "Spoke with client"
  | "Intake email sent"
  | "Appointment booked"
  | "Waiting for callback"
  | "Other";
export type DocStatus = "Complete" | "Partial" | "None";
export type WorkloadStatus = "Low" | "Moderate" | "At Capacity";

export type ClientSource = "New Lead" | "Pre-Approval Revival" | "Renewal" | "Ownwell";

export interface Client {
  id: string;
  name: string;
  broker: string;
  createdDate: string; // ISO date
  source: ClientSource;
}

export interface ContactLog {
  id: string;
  clientId: string;
  broker: string;
  date: string; // ISO date
  type: ContactType;
  outcome: Outcome;
  notes: string;
  timeSpentMinutes: number;
  dealId: string | null; // which deal this time/touch applies to, if any
  stageAtLog: string | null; // the deal's stage at the moment this was logged
}

export interface EscalationRecord {
  id: string;
  reason: string;
  opsResponse: string;
  escalatedAt: string; // ISO datetime (not date-only) — needed for business-hours math
  resolvedAt: string; // ISO datetime
}

export interface Deal {
  id: string;
  clientId: string;
  broker: string;
  value: number;
  stage: Stage;
  stageEnteredDate: string; // ISO date, updated whenever stage changes
  docStatus: DocStatus;
  escalation: boolean;
  escalationReason: string;
  escalatedAt: string | null; // ISO datetime (not date-only) — needed for business-hours math
  escalationNotifiedAt?: string | null; // when the "flagged" email was sent to ops (prevents duplicate alerts)
  opsResponse: string; // ops manager's response to the current, unresolved escalation
  escalationHistory: EscalationRecord[]; // past escalations on this deal, resolved
  createdAt: string;
}

// Maps a broker's name (the app's only identifier, since login is a shared
// team password) to the email address that should receive their notifications.
export interface BrokerContact {
  name: string;
  email: string;
}

export interface CapacityCheckin {
  broker: string;
  weekStart: string; // ISO date, Monday of the week
  status: WorkloadStatus;
  callsCapacity: string;
  dealsCapacity: string;
  comments: string;
  savedAt: string;
}

export interface TrackerDB {
  brokers: string[];
  clients: Client[];
  logs: ContactLog[];
  deals: Deal[];
  capacity: CapacityCheckin[];
  brokerContacts: BrokerContact[]; // name -> email, for notifications
  opsRecipients: string[]; // email addresses that get escalation alerts
}

export type Role = "broker" | "ops" | null;
