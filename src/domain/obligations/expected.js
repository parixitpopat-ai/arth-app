// domain/obligations/expected.js
//
// ADR-039 (Approved 2026-09-27, formal sign-off — substance was already locked 26 Sep) —
// Expected obligations. This is the ADR's canonical owner: it derives Expected items; it never
// writes. Expected is never persisted anywhere — not in bills[], not in a new obligations[] or
// schedules[] array. A Financial Relationship's schedule (usual amount, frequency, bill day, due
// day) lives directly on the Relationship row (membershipRelationships[]), exactly as ADR-039's
// own WP-6 planned — there is no separate Schedule store either.
//
// Terminology (locked — do not rename): later product/IA conversation calls this concept
// "Obligation". ADR-039 already named it "Expected" before that language existed, and this module
// keeps ADR-039's name exactly. Internally, the five concepts stay distinct and are never
// collapsed into each other:
//   Financial Relationship — the ongoing relationship (membershipRelationships[], unchanged).
//   Schedule               — the recurrence rule: fields on the Relationship (below).
//   Expected ("Obligation") — one computed, read-only occurrence per qualifying Relationship.
//                             Never Due, never Overdue, never in Payments' "To pay" total.
//   Bill                    — a concrete payable amount (bills[], unchanged) — created either by
//                             confirming an Expected item, or by the pre-existing legacy
//                             no-schedule regeneration path (kept, per ADR-039 §7/§10a).
//   Transaction             — the actual payment event (txns[], untouched by this work).
//
// Command boundaries this module implements (same names the AI layer will call — §15 of the IA
// brief: AI must operate against the same canonical domain commands as the UI):
//   obligation.set     — setRelationshipSchedule(relationship, input)
//   bill.fromSchedule   — buildBillFieldsFromExpected(expected, confirmedAmount) — "Confirm
//                         amount" (ADR-039 §6). This only computes what the new Bill's own fields
//                         are; the caller still creates it exactly like every other Bill-creation
//                         path (genId, name, the billFor.js attribution snapshot, wiring into
//                         bills[]) — this module has no bills[] setter and never will.

// Date math reuses helpers/dateHelpers.js's dateAtDay/toLocalDateStr — the app's one canonical
// "clamp a day into whichever month it lands in" and "format a Date as the local YYYY-MM-DD"
// implementations — rather than this module keeping its own copies (found duplicated, and in one
// case reintroducing a real bug, during the cross-app date-logic audit; see
// domain/bills/periodCalculations.js's header for the full story).
import { dateAtDay, toLocalDateStr } from "../../helpers/dateHelpers.js";
import { getRelationshipStatusAsOfDate } from "../membership/lifecycle.js";
import { getRelationshipTarget } from "../membership/relationship.js";

const FREQUENCIES = ["monthly", "quarterly", "halfyearly", "yearly"];
const MONTHS_TO_ADD = { monthly: 1, quarterly: 3, halfyearly: 6, yearly: 12 };

const ymdToDate = ymd => {
  const [y, m, dd] = String(ymd).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, dd);
};

/**
 * ADR-039 §3 — a schedule is "set" only when every field it names has a real value. A partial
 * schedule (e.g. amount known, due day not) never qualifies; nothing is guessed from it. This is
 * the "no estimation" rule, applied literally.
 */
export function hasCompleteSchedule(relationship) {
  const s = relationship?.schedule;
  if (!s) return false;
  const dueDay = Number(s.dueDay);
  return Number(s.amount) > 0 && FREQUENCIES.includes(s.frequency) && dueDay >= 1 && dueDay <= 31;
}

/**
 * Command boundary: `obligation.set`. The only way a Relationship's schedule is created or
 * changed — never mutated in place elsewhere. `billDay` defaults to `dueDay` when not given
 * separately, the common case (one date, e.g. "the 5th") shown in the design's own gym example —
 * both fields still get a real value either way, which is what "set" requires, not two separate
 * user questions when the product only asks one.
 * @throws {Error} on a missing/invalid required field — never silently drops one.
 */
export function setRelationshipSchedule(relationship, { amount, frequency, dueDay, billDay, billingMode = "regular" } = {}) {
  if (!relationship) throw new Error("setRelationshipSchedule: relationship is required");
  if (!(Number(amount) > 0)) throw new Error("setRelationshipSchedule: amount must be a positive number");
  if (!FREQUENCIES.includes(frequency)) throw new Error(`setRelationshipSchedule: frequency must be one of ${FREQUENCIES.join(", ")}`);
  const due = Number(dueDay);
  if (!(due >= 1 && due <= 31)) throw new Error("setRelationshipSchedule: dueDay must be between 1 and 31");
  if (billingMode !== "regular" && billingMode !== "none" && billingMode !== "unknown") {
    throw new Error('setRelationshipSchedule: billingMode must be "regular", "none" or "unknown"');
  }
  const bill = Number(billDay);
  return {
    ...relationship,
    billingMode,
    schedule: { amount: Number(amount), frequency, dueDay: due, billDay: bill >= 1 && bill <= 31 ? bill : due },
  };
}

/**
 * The next occurrence of `dueDay` on or after `fromYMD` — the first Expected cycle for a
 * Relationship with no Bills yet.
 */
function firstDueOnOrAfter(fromYMD, dueDay) {
  const base = ymdToDate(fromYMD);
  const candidate = dateAtDay(base.getFullYear(), base.getMonth(), dueDay);
  if (candidate < base) return toLocalDateStr(dateAtDay(base.getFullYear(), base.getMonth() + 1, dueDay));
  return toLocalDateStr(candidate);
}

/** One frequency step past an existing Bill's due date — ADR-039 §4/§5's "the next cycle". */
function nextDueAfter(lastBillDueYMD, frequency, dueDay) {
  const base = ymdToDate(lastBillDueYMD);
  return toLocalDateStr(dateAtDay(base.getFullYear(), base.getMonth() + MONTHS_TO_ADD[frequency], dueDay));
}

/**
 * The one Expected item for a Relationship, or null. ADR-039 §3-§5: derives only when —
 *   - the Relationship was active as of refDate (statusHistory, not just current status)
 *   - billingMode is "regular" and the schedule is complete (hasCompleteSchedule)
 *   - no Bill — of ANY status, including cancelled (§5) — already covers the next cycle
 * "Bills for this Relationship" is matched on billerAccountId AND the Bill's own For snapshot, so
 * two Relationships sharing one Provider (the 1:N model) each get their own Expected, never each
 * other's.
 * @returns {{relationshipId, billerAccountId, targetType, targetId, amount, dueDate}|null}
 */
export function getExpectedForRelationship(relationship, bills, refDate = new Date()) {
  if (!relationship || relationship.billingMode !== "regular") return null;
  if (!hasCompleteSchedule(relationship)) return null;
  const refYMD = toLocalDateStr(refDate);
  if (getRelationshipStatusAsOfDate(relationship.statusHistory, refYMD) !== "active") return null;

  const target = getRelationshipTarget(relationship);
  const ownBills = (bills || []).filter(b =>
    b && String(b.billerAccountId) === String(relationship.billerAccountId)
    && b.forType === target.targetType && String(b.forId) === String(target.targetId)
  );

  const { frequency, dueDay, amount } = relationship.schedule;
  const dueDate = ownBills.length
    ? nextDueAfter(ownBills.slice().sort((a, b) => String(b.dueDate || "").localeCompare(String(a.dueDate || "")))[0].dueDate, frequency, dueDay)
    : firstDueOnOrAfter(refYMD, dueDay);

  return { relationshipId: relationship.id, billerAccountId: relationship.billerAccountId, targetType: target.targetType, targetId: target.targetId, amount, dueDate };
}

/**
 * Every Relationship's Expected item, skipping the ones with none. Convenience wrapper over
 * getExpectedForRelationship for a list of relationships — still derives nothing new.
 */
export function getExpectedItems(relationships, bills, refDate = new Date()) {
  return (relationships || [])
    .map(r => getExpectedForRelationship(r, bills, refDate))
    .filter(Boolean);
}

/**
 * Command boundary: `bill.fromSchedule` — "Confirm amount" (ADR-039 §6). Returns the fields a new,
 * real Bill needs; the caller creates it through the same path every other Bill uses (genId, name,
 * billFor.js's attribution snapshot, wiring into bills[]) — this module never writes bills[].
 * Confirming with a different amount than the schedule's usual one is allowed (ADR-039's own
 * "Pay early" journey confirms first, at whatever amount is actually due) — it does not change the
 * schedule itself; that only happens through obligation.set.
 */
export function buildBillFieldsFromExpected(expected, confirmedAmount) {
  if (!expected) throw new Error("buildBillFieldsFromExpected: expected is required");
  const amount = confirmedAmount !== undefined && confirmedAmount !== null ? Number(confirmedAmount) : expected.amount;
  if (!(amount > 0)) throw new Error("buildBillFieldsFromExpected: amount must be a positive number");
  return {
    billerAccountId: expected.billerAccountId,
    amount,
    dueDate: expected.dueDate,
    status: "unpaid",
    recurring: true,
  };
}
