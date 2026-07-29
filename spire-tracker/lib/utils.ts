export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysBetween(a: string, b: string): number {
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

function getMonday(dateISO: string): Date {
  const date = new Date(dateISO + "T00:00:00");
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export interface WeekRange {
  start: string;
  end: string;
  label: string;
}

export function weekRange(offset: number): WeekRange {
  const base = new Date();
  base.setDate(base.getDate() + offset * 7);
  const monday = getMonday(base.toISOString().slice(0, 10));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const start = monday.toISOString().slice(0, 10);
  const end = sunday.toISOString().slice(0, 10);
  return { start, end, label: `${fmtDate(start)} – ${fmtDate(end)}` };
}

export function inRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

export function nowISO(): string {
  return new Date().toISOString();
}

// Business hours: Monday–Friday, 8am–5pm (9-hour business day).
// Change these two numbers if your team's hours differ.
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 17;
const BUSINESS_HOURS_PER_DAY = BUSINESS_END_HOUR - BUSINESS_START_HOUR;

// Minutes elapsed between two ISO datetimes, counting only the portions
// that fall Mon–Fri, 8am–5pm. Weekends and after-hours time don't count.
export function businessMinutesBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0;
  let totalMinutes = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getDay(); // 0 = Sun, 6 = Sat
    if (day >= 1 && day <= 5) {
      const dayStart = new Date(cursor);
      dayStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(BUSINESS_END_HOUR, 0, 0, 0);
      const overlapStart = start > dayStart ? start : dayStart;
      const overlapEnd = end < dayEnd ? end : dayEnd;
      if (overlapEnd > overlapStart) {
        totalMinutes += (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return totalMinutes;
}

// Formats a business-minutes duration as business days + hours, e.g.
// "1.8 business days (16.2 hrs)". Falls back to a plain minutes/hours
// reading for anything under a full business day.
export function formatBusinessDuration(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  const hours = minutes / 60;
  const days = hours / BUSINESS_HOURS_PER_DAY;
  if (hours < 1) return `${Math.round(minutes)} min (business hrs)`;
  if (days < 1) return `${hours.toFixed(1)} business hrs`;
  return `${days.toFixed(1)} business days (${hours.toFixed(1)} hrs)`;
}

// Plain calendar days elapsed since an ISO datetime (not business-hours
// aware) — used for "how long ago" displays, not resolution-time metrics.
export function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

// Human-readable date + time for displaying escalation/resolution timestamps.
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function totalMinutesForDeal(logs: { dealId: string | null; timeSpentMinutes: number }[], dealId: string): number {
  return logs.filter((l) => l.dealId === dealId).reduce((sum, l) => sum + (l.timeSpentMinutes || 0), 0);
}
