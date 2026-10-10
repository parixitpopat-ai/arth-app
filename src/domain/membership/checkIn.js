// domain/membership/checkIn.js
//
// Daily Gym check-in ("did you go today?") + per-visit cost. A small, deliberately separate
// feature from everything else in the Gym fix — it never touches memberships[]/bills[]/
// membershipRelationships[] itself, only reads them to decide whether to ask, and writes its own
// gymCheckIns[] records. Purpose (the user's own words): "help us determine how much did I spend
// vs how many days I utilised, to get per day cost."

import { getRelationshipStatusAsOfDate } from "./lifecycle.js";

const GYM_TYPE = "Gym / Fitness";
/** How far back a catch-up reaches. Older unanswered days are left unasked: nobody remembers them. */
export const GYM_CATCH_UP_DAYS = 31;

/**
 * The one active Gym/Fitness relationship still needing today's check-in, or null. Never asks
 * twice in one day, never asks on a day the relationship is paused (traveling) or a day the user
 * has marked as a public holiday.
 *
 * @param {Object} params
 * @param {Array} params.relationships - membershipRelationships[]
 * @param {Array} params.billerAccounts
 * @param {Array} params.billers - biller shells (the real "Genesis Calisthenics Park" etc.); a
 *   Biller Account's own `name` is often just a nickname the user gave it to tell accounts apart
 *   (e.g. "Parixit" or "Nidhi Genesis" for two people's memberships at the same gym), so asking
 *   "did you go to Parixit today?" reads as nonsense — the shell's real name is what this is for.
 * @param {Array} params.checkIns - gymCheckIns[]: {relationshipId, date, attended}
 * @param {Array} params.holidays - "YYYY-MM-DD" strings the user has marked
 * @param {string} params.today - "YYYY-MM-DD"
 * @returns {{relationshipId:string, billerAccountId:string, billerName:string}|null}
 */
export function getPendingGymCheckIn({ relationships, billerAccounts, billers, checkIns, holidays, today }) {
  if ((holidays || []).includes(today)) return null;
  const gymAccountIds = new Set((billerAccounts || []).filter(ba => ba.type === GYM_TYPE).map(ba => ba.id));
  if (!gymAccountIds.size) return null;

  const alreadyAnswered = new Set((checkIns || []).filter(c => c.date === today).map(c => c.relationshipId));

  const pending = (relationships || []).find(r =>
    r.status === "active" &&
    gymAccountIds.has(r.billerAccountId) &&
    !alreadyAnswered.has(r.id)
  );
  if (!pending) return null;

  const ba = (billerAccounts || []).find(x => x.id === pending.billerAccountId);
  const shell = ba?.billerId ? (billers || []).find(x => x.id === ba.billerId) : null;
  return { relationshipId: pending.id, billerAccountId: pending.billerAccountId, billerName: shell?.name || ba?.name || "Gym" };
}

/** A new gymCheckIns[] record for one answer. `attended` is true/false; holidays are recorded via
 *  markHoliday below instead of a check-in, since a holiday was never expected to be a visit. */
export function recordGymCheckIn({ relationshipId, billerAccountId, date, attended, genId }) {
  return { id: genId(), relationshipId, billerAccountId, date, attended: Boolean(attended), createdAt: Date.now() };
}

/**
 * Cost per visit for a Gym relationship: total spend on it (the caller already knows this - e.g.
 * a membership's lifetimeSpend) divided by the count of "attended: true" check-ins recorded for
 * it. Null (not zero) when there's nothing to divide by yet — "no visits logged" is not the same
 * fact as "free."
 */
export function getCostPerVisit(checkIns, relationshipId, lifetimeSpend) {
  const visits = (checkIns || []).filter(c => c.relationshipId === relationshipId && c.attended).length;
  if (!visits) return null;
  return lifetimeSpend / visits;
}

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (dateStr, n) => { const d = new Date(`${dateStr}T12:00:00`); d.setDate(d.getDate() + n); return ymd(d); };

/** The day a relationship started being asked about: its first "active" history entry, else the day it was created. */
function relationshipStartDate(rel, today) {
  const firstActive = (rel.statusHistory || []).filter(h => h.status === "active" && h.effectiveDate).map(h => h.effectiveDate).sort()[0];
  if (firstActive) return firstActive;
  if (rel.createdAt) { const d = new Date(Number(rel.createdAt)); if (!Number.isNaN(d.getTime())) return ymd(d); }
  return today;
}

/**
 * Every day the one active Gym relationship still owes an answer for, oldest first, today included.
 * Open the app after 10 days and this returns 10 days, not just today, so Arth can ask "were you on a break?".
 * Skips: days the user marked as a public holiday, days already answered, days before the relationship began,
 * days it was paused or ended (traveling), and anything older than GYM_CATCH_UP_DAYS.
 *
 * @returns {{relationshipId:string, billerAccountId:string, billerName:string, days:string[]}|null}
 */
export function getPendingGymCatchUp({ relationships, billerAccounts, billers, checkIns, holidays, today }) {
  const gymAccountIds = new Set((billerAccounts || []).filter(ba => ba.type === GYM_TYPE).map(ba => ba.id));
  if (!gymAccountIds.size) return null;
  const holidaySet = new Set(holidays || []);
  const answered = new Set((checkIns || []).map(c => `${c.relationshipId}|${c.date}`));

  for (const rel of relationships || []) {
    if (!gymAccountIds.has(rel.billerAccountId) || rel.status !== "active") continue;
    const earliest = addDays(today, -(GYM_CATCH_UP_DAYS - 1));
    const start = relationshipStartDate(rel, today);
    const from = start > earliest ? start : earliest;
    const hasHistory = Array.isArray(rel.statusHistory) && rel.statusHistory.length > 0;
    const days = [];
    for (let d = from; d <= today; d = addDays(d, 1)) {
      if (holidaySet.has(d) || answered.has(`${rel.id}|${d}`)) continue;
      if (hasHistory && getRelationshipStatusAsOfDate(rel.statusHistory, d) !== "active") continue;
      days.push(d);
    }
    if (!days.length) continue;
    const ba = (billerAccounts || []).find(x => x.id === rel.billerAccountId);
    const shell = ba?.billerId ? (billers || []).find(x => x.id === ba.billerId) : null;
    return { relationshipId: rel.id, billerAccountId: rel.billerAccountId, billerName: shell?.name || ba?.name || "Gym", days };
  }
  return null;
}

/** One check-in record per day for a break: not attended, flagged so it is never mistaken for a skipped day. */
export function recordGymBreak({ relationshipId, billerAccountId, days, genId }) {
  return (days || []).map(date => ({ ...recordGymCheckIn({ relationshipId, billerAccountId, date, attended: false, genId }), onBreak: true }));
}
