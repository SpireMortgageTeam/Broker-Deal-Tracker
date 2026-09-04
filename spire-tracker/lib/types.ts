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
  isFollowUp?: boolean; // for non-deal outreach: true = follow-up on an existing client, false/undefined = a brand-new touch point
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

// ---------------------------------------------------------------------------
// Community Tracker (migrated from the standalone spire-community-tracker
// app — see /root/.claude/plans/composed-weaving-parrot.md for context).
// Brokers each "own" a set of Trico show-home communities; periodically a
// broker calls/visits and comes back with answers to a fixed questionnaire.
// The latest answer to each question is the "current snapshot" (CommunityIntel);
// every call is also kept in a permanent, append-only CallLog.
// ---------------------------------------------------------------------------

export type CommunityStatus = "Open" | "Coming Soon" | "Closed";
export type PreferredContactMethod = "Email" | "Phone" | "Text" | "Mixed / no strong preference";
export type CallSource = "Plaud" | "Manual notes" | "In-person" | "Other";

export interface Associate {
  name: string;
  phone: string;
  email: string;
}

export interface Community {
  id: string;
  name: string;
  status: CommunityStatus;
  city: string;
  showhomeAddress: string;
  showhomeModel: string;
  showhomePhone: string;
  areaManagerName: string;
  areaManagerPhone: string;
  areaManagerEmail: string;
  associates: Associate[]; // 1-2 people, some communities run with two
  newSAStartDate: string | null; // ISO date; set if a new sales associate is on probation
  probationEndDate: string | null;
  assignedBroker: string | null; // one of db.brokers, or null (e.g. Coming Soon)
  spreadsheetNotes: string; // freeform carry-over text, e.g. "SH Closed", "Now Open!"
  createdAt: string;
}

// The 20 questionnaire fields, grouped into 6 categories for display — see
// lib/intelFields.ts for the category -> fields -> label mapping.
export type IntelFieldKey =
  | "pricePoints"
  | "propertyTypes"
  | "preferredContactMethod"
  | "updateFrequency"
  | "followUpExpectations"
  | "sidewaysCommunication"
  | "currentBuyerTypes"
  | "sellingWell"
  | "harderToMove"
  | "financingObjections"
  | "whereBuyersStuck"
  | "fallClosingsWorried"
  | "financingReviewNeeded"
  | "appraisalValuationIssues"
  | "challengingModelsLotsUpgrades"
  | "whatWouldHelp"
  | "toolsGuidesWishlist"
  | "whereDroppedBall"
  | "whatCouldBeBetter"
  | "valuableExtensionVision";

export interface IntelValue {
  value: string;
  updatedAt: string | null; // ISO date
  updatedBy: string | null; // broker name (or "Ops")
  callId: string | null; // which CallLog entry last set this value, if any
}

// One record per community — communityId is the identity. Fields live under
// a nested "fields" map (rather than the source app's flat index-signature
// shape) so this diffs/upserts cleanly through this app's per-record
// persistDiff logic, same as every other hash collection here.
export interface CommunityIntel {
  communityId: string;
  fields: Partial<Record<IntelFieldKey, IntelValue>>;
}

// Append-only log of every call/visit. Never edited after the fact (except
// typo fixes).
export interface CallLog {
  id: string;
  communityId: string;
  broker: string;
  date: string; // ISO date of the call
  source: CallSource;
  transcript: string; // pasted Plaud transcript or raw notes, optional
  summary: string; // required short recap of the call
  fieldsUpdated: IntelFieldKey[]; // which snapshot fields this call changed
  createdAt: string; // ISO datetime
}

// ---------------------------------------------------------------------------
// Feature Sheets (co-branded builder-partner mortgage sheets)
// ---------------------------------------------------------------------------

export interface Builder {
  id: string;
  name: string;
  logo: string; // base64 data URL
  brandColor?: string; // hex; falls back to the Atmosphere palette color
}

export interface TrackerDB {
  brokers: string[];
  clients: Client[];
  logs: ContactLog[];
  deals: Deal[];
  capacity: CapacityCheckin[];
  brokerContacts: BrokerContact[]; // name -> email, for notifications
  opsRecipients: string[]; // email addresses that get escalation alerts
  communities: Community[];
  communityIntel: CommunityIntel[];
  callLogs: CallLog[];
  builders: Builder[];
}

export type Role = "broker" | "ops" | "resources" | null;
