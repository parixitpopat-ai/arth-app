// domain/person/reminders.js
//
// Pure, DISPLAY-ONLY next-occurrence date math. This module makes no
// claim about notifications, scheduling, or delivery — nothing in this
// session's trace found any existing notification/push/cron
// infrastructure in the app. PERSON_MODULES already lists "reminders" as
// a toggle concept, but that only gates whether this display section is
// shown — it does not mean anything is actually scheduled. This module
// computes "when is the next birthday/anniversary" as pure information,
// nothing more.

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Parses a "YYYY-MM-DD" string into {year, month, day} via plain integer
// parsing — deliberately never uses `new Date(str)` (UTC) mixed with
// `new Date(y,m,d)` (local) for the same logical date. Mixing those two
// construction styles is exactly the bug a real coder run caught: in a
// timezone ahead of UTC, `new Date(y,m,d)` (local midnight) can represent
// an earlier absolute instant than `new Date(str)` (UTC midnight) for the
// literal same calendar day, making `<` comparisons wrong right at the
// boundary. Every date in this file is now built via this same helper,
// so comparisons are always apples-to-apples.
function parseDateOnly(str) {
  if (!str) return null;
  const parts = String(str).split("-").map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

/**
 * Given a stored date string (DOB or anniversary, "YYYY-MM-DD"), compute
 * the next upcoming occurrence of that month+day, relative to today.
 * Never fabricates a date — returns null if no real date is stored.
 *
 * @param {string|null|undefined} dateStr - the stored date, or absent
 * @param {string} todayStr - "YYYY-MM-DD", injected for determinism
 * @returns {{ nextDate:string, label:string, daysAway:number } | null}
 */
export function getNextOccurrence(dateStr, todayStr) {
  const parsed = parseDateOnly(dateStr);
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  const today = parseDateOnly(todayStr);
  if (!today || Number.isNaN(today.getTime())) return null;

  const month = parsed.getMonth();
  const day = parsed.getDate();

  let next = new Date(today.getFullYear(), month, day);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month, day);
  }

  const daysAway = Math.round((next - today) / (1000 * 60 * 60 * 24));
  const nextDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  const label = `${next.getDate()} ${MONTH_LABELS[next.getMonth()]}`;

  return { nextDate, label, daysAway };
}

/**
 * Builds the Reminders section's real, honest content for a person — only
 * from dates that are actually stored (WP-2's dob/anniversary fields).
 * Never invents a reminder for a date that doesn't exist.
 *
 * @param {Object} person - a people[] record
 * @param {string} todayStr
 * @returns {Array<{type:"birthday"|"anniversary", label, ...getNextOccurrence result}>}
 */
export function getPersonReminders(person, todayStr) {
  const reminders = [];
  const birthday = getNextOccurrence(person?.dob, todayStr);
  if (birthday) reminders.push({ type: "birthday", label: "Birthday", ...birthday });
  const anniversary = getNextOccurrence(person?.anniversary, todayStr);
  if (anniversary) reminders.push({ type: "anniversary", label: "Anniversary", ...anniversary });
  return reminders;
}
