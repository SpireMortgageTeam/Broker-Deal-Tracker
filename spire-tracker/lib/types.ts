export type Stage =
  | "Doc Collection"
  | "Pre-App"
  | "Submitted"
  | "Conditions"
  | "Broker Complete";

export type ContactType = "Initial Call" | "Follow-Up Call" | "Email" | "Appointment" | "Underwriting/Fulfillment";
export type Outcome =
  | "Left voicemail"
  | "Spoke with client"
  | "Intake email sent"
  | "Appointment booked"
  | "Waiting for callback"
  | "Other";
export type DocStatus = "Complete" | "Partial" | "None";
export type WorkloadStatus = "Low" | "Moderate" | "At Capacity";

export interface Client {
  id: string;
  name: string;
  broker: string;
  createdDate: string; // ISO date
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
}

export interface EscalationRecord {
  id: string;
  reason: string;
  opsResponse: string;
  escalatedAt: string;
  resolvedAt: string;
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
  escalatedAt: string | null; // ISO date
  opsResponse: string; // ops manager's response to the current, unresolved escalation
  escalationHistory: EscalationRecord[]; // past escalations on this deal, resolved
  createdAt: string;
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
}

export type Role = "broker" | "ops" | null;
