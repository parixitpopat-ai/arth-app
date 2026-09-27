// domain/membership/checkIn.js
//
// Daily Gym check-in ("did you go today?") + per-visit cost. A small, deliberately separate
// feature from everything else in the Gym fix — it never touches memberships[]/bills[]/
// membershipRelationships[] itself, only reads them to decide whether to ask, and writes its own
// gymCheckIns[] records. Purpose (the user's own words): "help us determine how much did I spend
// vs how many days I utilised, to get per day cost."

const GYM_TYPE = "Gym / Fitness";

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
