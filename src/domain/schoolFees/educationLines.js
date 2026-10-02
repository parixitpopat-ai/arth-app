// domain/schoolFees/educationLines.js
//
// Education transaction flow — pure helpers. An Expense whose category is Education can carry
// several Education subcategory lines in ONE Transaction (School Fees, Registration Fees,
// Uniform, Books, ...), each with its own amount. This module owns:
//   - the stable Education category/subcategory ids (so nothing identifies "Education" by
//     guessing at a display name),
//   - which subcategories are School Fee *obligations* (School Fees -> tuition periods,
//     Registration Fees -> a one-time registration period, Uniform -> a one-time uniform period)
//     versus ordinary Education lines (Books, Activities, Exams, Other: never promoted into Fee
//     Periods),
//   - mapping a School Fees month range onto the school's existing tuition Fee Periods,
//   - turning the lines into the Transaction's real lineItems[] plus the per-period settlement
//     allocations that schoolFees/settlement.js (settleFeePeriods) already requires.
//
// Nothing here creates a Transaction, a Fee Period, or settles anything — it never touches
// state. settlement.js stays the single settlement authority and keeps its locked rule: when the
// amount differs from the selected periods' outstanding total, EXPLICIT per-period allocations
// are required (this module only *suggests* an earliest-first split for the user to confirm; it
// never applies one on its own).

import { calculateOutstanding } from "./outstanding.js";
import { declareFeePeriodStartingState } from "./startingState.js";

export const EDUCATION_CAT_ID = "education";

export const EDU_SUB = {
  SCHOOL_FEES: "edu_school_fees",
  REGISTRATION: "edu_registration",
  UNIFORM: "edu_uniform",
  BOOKS: "edu_books",
  ACTIVITIES: "edu_activities",
  EXAMS: "edu_exams",
  OTHER: "edu_other",
};

// {id,name} only — the exact subcategory shape every category in the app uses.
export const EDUCATION_SUBS = [
  { id: EDU_SUB.SCHOOL_FEES, name: "School Fees" },
  { id: EDU_SUB.REGISTRATION, name: "Registration Fees" },
  { id: EDU_SUB.UNIFORM, name: "Uniform" },
  { id: EDU_SUB.BOOKS, name: "Books" },
  { id: EDU_SUB.ACTIVITIES, name: "Activities" },
  { id: EDU_SUB.EXAMS, name: "Exams" },
  { id: EDU_SUB.OTHER, name: "Other" },
];

// Display-only descriptions (the subcategory record itself stays {id,name}).
export const EDUCATION_SUB_DESC = {
  [EDU_SUB.SCHOOL_FEES]: "Tuition and regular school fees",
  [EDU_SUB.REGISTRATION]: "One-time admission/registration",
  [EDU_SUB.UNIFORM]: "One-time or when needed",
  [EDU_SUB.BOOKS]: "Textbooks and study material",
  [EDU_SUB.ACTIVITIES]: "Extracurricular activities",
  [EDU_SUB.EXAMS]: "Exam and assessment fees",
  [EDU_SUB.OTHER]: "Anything else education-related",
};

// The Education category exactly as it is seeded into DEFAULT_CATS. budget:0 — adding it must
// never change anyone's existing budget totals.
export const EDUCATION_CATEGORY = {
  id: EDUCATION_CAT_ID, name: "Education", icon: "🎓", color: "#6366f1", budget: 0, fixed: false,
  subs: EDUCATION_SUBS,
};

const norm = v => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");

// Name aliases used ONLY to recognise a user's own existing Education category/subcategories as
// the standard ones (so we reuse them instead of creating duplicates).
const ROLE_ALIASES = {
  [EDU_SUB.SCHOOL_FEES]: ["school fees", "school fee"],
  [EDU_SUB.REGISTRATION]: ["registration fees", "registration fee", "registration"],
  [EDU_SUB.UNIFORM]: ["uniform", "uniforms"],
  [EDU_SUB.BOOKS]: ["books", "book"],
  [EDU_SUB.ACTIVITIES]: ["activities", "activity"],
  [EDU_SUB.EXAMS]: ["exams", "exam"],
  [EDU_SUB.OTHER]: ["other"],
};

/** The Education category to use: the canonical one, else a user-created one named "Education". */
export function findEducationCategory(cats) {
  const list = Array.isArray(cats) ? cats : [];
  return list.find(c => c.id === EDUCATION_CAT_ID) || list.find(c => norm(c.name) === "education") || null;
}

/**
 * Which standard Education role (EDU_SUB id) a subcategory of `cat` plays, or null for a
 * user-defined subcategory that isn't one of the standard seven. Matches by stable id first,
 * then by name — so a user's own "School Fees" subcategory keeps its own id and history.
 */
export function roleOfEducationSub(cat, subId) {
  const sub = (cat?.subs || []).find(x => x.id === subId);
  if (!sub) return null;
  if (EDUCATION_SUBS.some(x => x.id === sub.id)) return sub.id;
  const n = norm(sub.name);
  return Object.keys(ROLE_ALIASES).find(role => ROLE_ALIASES[role].includes(n)) || null;
}

/**
 * Idempotent initialisation of the Education category inside a categories list.
 *  - canonical Education present            -> unchanged
 *  - user-created "Education" present       -> reused; only standard subcategories it lacks are
 *                                              appended (nothing renamed/removed/re-id'd)
 *  - none                                   -> the standard Education category is added once
 * Returns the SAME array when nothing needed to change.
 */
export function ensureEducationCategory(cats) {
  const list = Array.isArray(cats) ? cats : [];
  if (list.some(c => c.id === EDUCATION_CAT_ID)) return list;
  const existing = findEducationCategory(list);
  if (!existing) return [...list, EDUCATION_CATEGORY];
  const have = new Set((existing.subs || []).map(x => roleOfEducationSub(existing, x.id)).filter(Boolean));
  const missing = EDUCATION_SUBS.filter(x => !have.has(x.id));
  if (missing.length === 0) return list;
  return list.map(c => (c === existing ? { ...c, subs: [...(c.subs || []), ...missing] } : c));
}

// Only these three Education subcategories can be School Fee obligations. Everything else
// (Books, Activities, Exams, Other) is an ordinary Education line — Education subcategory is not
// the same thing as a School Fee obligation.
const SUB_TO_FEE_KIND = {
  [EDU_SUB.SCHOOL_FEES]: "tuition",
  [EDU_SUB.REGISTRATION]: "registration",
  [EDU_SUB.UNIFORM]: "uniform",
};

/** @returns {"tuition"|"registration"|"uniform"|null} the Fee Period kind this sub can settle */
export function feeKindForEducationSub(subId) {
  return SUB_TO_FEE_KIND[subId] || null;
}

/** Only School Fees (tuition) takes a period selector; Registration/Uniform are one-time. */
export function educationSubNeedsPeriod(subId) {
  return feeKindForEducationSub(subId) === "tuition";
}

export function isEducationSub(subId) {
  return EDUCATION_SUBS.some(s => s.id === subId);
}

/** True if any selected sub is a School Fee obligation, i.e. the School linker applies. */
export function selectionNeedsSchool(subIds) {
  return (subIds || []).some(id => feeKindForEducationSub(id) !== null);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parseYM = ym => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ""));
  if (!m) return null;
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return { y: Number(m[1]), m: mo };
};

const lastDayOfMonth = (y, m) => new Date(y, m, 0).getDate();
const pad = n => String(n).padStart(2, "0");

/**
 * "By Month" selector: a start month and an end month (both "YYYY-MM") -> inclusive date range.
 * @returns {{from:string,to:string,months:number,label:string}|null} null if invalid/inverted
 */
export function monthRangeToDates(startYM, endYM) {
  const s = parseYM(startYM);
  const e = parseYM(endYM);
  if (!s || !e) return null;
  const months = (e.y - s.y) * 12 + (e.m - s.m) + 1;
  if (months < 1) return null;
  const from = `${s.y}-${pad(s.m)}-01`;
  const to = `${e.y}-${pad(e.m)}-${pad(lastDayOfMonth(e.y, e.m))}`;
  return { from, to, months, label: formatCoverLabel(from, to) };
}

/**
 * "By Date" selector: any two dates -> same shape. Months = calendar months touched.
 */
export function dateRangeToDates(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to || ""))) return null;
  if (from > to) return null;
  const s = parseYM(from.slice(0, 7));
  const e = parseYM(to.slice(0, 7));
  const months = (e.y - s.y) * 12 + (e.m - s.m) + 1;
  return { from, to, months, label: formatCoverLabel(from, to) };
}

/** "Jul 2026 – Sep 2026" (or "Jul 2026" for a single month). */
export function formatCoverLabel(from, to) {
  const f = parseYM(String(from).slice(0, 7));
  const t = parseYM(String(to).slice(0, 7));
  if (!f || !t) return "";
  const a = `${MONTHS[f.m - 1]} ${f.y}`;
  const b = `${MONTHS[t.m - 1]} ${t.y}`;
  return a === b ? a : `${a} – ${b}`;
}

// A period created before the Fee Period `kind` field existed (legacy monthly generation) is a
// tuition period by definition.
const kindOf = p => p.kind || "tuition";

/**
 * The school's Fee Periods that a School Fee line could settle. Always scoped to ONE school
 * (billerAccountId) — never another school's periods.
 *
 * - tuition: periods overlapping the chosen range by date.
 * - registration / uniform: every period of that kind for this school (they are one-time
 *   obligations, so there is no date range to match against).
 *
 * Undeclared periods are returned flagged `needsDeclaration` (their status is unknown until the
 * user says so; saving a payment against them declares them unpaid first, via the existing
 * declareFeePeriodStartingState). Fully-settled periods are excluded — a later payment for the
 * same range therefore only ever sees what is still outstanding.
 *
 * @returns {Array<{period:Object, outstanding:number, needsDeclaration:boolean}>} due-date order
 */
export function findApplicablePeriods({ feePeriods, feeSchedules, billerAccountId, kind, from, to }) {
  const scheduleIds = new Set(
    (feeSchedules || []).filter(s => String(s.billerAccountId) === String(billerAccountId)).map(s => s.id)
  );
  return (feePeriods || [])
    .filter(p => scheduleIds.has(p.scheduleId) && kindOf(p) === kind)
    .filter(p => kind !== "tuition" || (from && to && p.periodStart <= to && p.periodEnd >= from))
    .map(p => {
      const needsDeclaration = !p.startingStateDeclared;
      const effective = needsDeclaration ? declareFeePeriodStartingState(p, false) : p;
      return { period: p, outstanding: calculateOutstanding(effective), needsDeclaration };
    })
    .filter(x => x.outstanding > 0)
    .sort((a, b) => String(a.period.dueDate || a.period.periodStart).localeCompare(String(b.period.dueDate || b.period.periodStart)));
}

const round2 = n => Math.round(n * 100) / 100;

/**
 * How a line's amount relates to what is outstanding on its applicable periods.
 *  - "exact":   amount equals the total outstanding -> every period gets exactly its own
 *               outstanding; fully deterministic (settlement.js's own rule).
 *  - "partial": amount is less -> settlement.js REQUIRES explicit per-period allocations. We
 *               return an earliest-due-first *suggestion* for the user to see and edit.
 *  - "excess":  amount is more than everything outstanding -> cannot be fully applied.
 *  - "none":    no applicable periods at all.
 *
 * @param {Array<{period:Object,outstanding:number}>} applicable
 * @param {number} amount
 */
export function planFeeAllocation(applicable, amount) {
  const amt = round2(Number(amount) || 0);
  const totalOutstanding = round2((applicable || []).reduce((s, x) => s + x.outstanding, 0));
  if (!applicable || applicable.length === 0) {
    return { status: "none", totalOutstanding: 0, suggested: [], excess: amt };
  }
  if (Math.abs(amt - totalOutstanding) < 0.005) {
    return { status: "exact", totalOutstanding, suggested: applicable.map(x => ({ periodId: x.period.id, amount: x.outstanding })), excess: 0 };
  }
  if (amt > totalOutstanding) {
    return { status: "excess", totalOutstanding, suggested: applicable.map(x => ({ periodId: x.period.id, amount: x.outstanding })), excess: round2(amt - totalOutstanding) };
  }
  let left = amt;
  const suggested = applicable.map(x => {
    const take = round2(Math.min(left, x.outstanding));
    left = round2(left - take);
    return { periodId: x.period.id, amount: take };
  });
  return { status: "partial", totalOutstanding, suggested, excess: 0 };
}

/**
 * Validate the allocation that will actually be sent to settlement.js.
 * @param {Array<{period:Object,outstanding:number}>} applicable
 * @param {Array<{periodId:string,amount:number}>} allocations
 * @param {number} amount - the line's amount
 * @returns {string|null} an error message, or null if valid
 */
export function validateFeeAllocation(applicable, allocations, amount) {
  const byId = new Map((applicable || []).map(x => [x.period.id, x]));
  let sum = 0;
  for (const a of allocations || []) {
    const x = byId.get(a.periodId);
    if (!x) return "That fee period is not part of this payment.";
    const n = Number(a.amount);
    if (!Number.isFinite(n) || n < 0) return "Amounts must be zero or more.";
    if (n - x.outstanding > 1e-9) return `Only ₹${x.outstanding} is outstanding on ${x.period.label}.`;
    sum += n;
  }
  if (Math.abs(round2(sum) - round2(Number(amount) || 0)) > 0.005) {
    return `Months add up to ₹${round2(sum)} but this line is ₹${round2(Number(amount) || 0)}.`;
  }
  return null;
}

/**
 * Turn the Education lines into the Transaction's real lineItems[] — the one category-attribution
 * representation the whole app reads. Every line carries catId "education" and its own subId.
 * A fee-linked line also carries feePeriodId/feePeriodIds (traceability only; the canonical settlement
 * record is each Fee Period's settlementLinks, written by settleFeePeriods). Books/Activities/Exams/Other carry NO fee period.
 *
 * @param {Array<{id:string, subId:string, name:string, amount:number, coversLabel?:string,
 *   allocations?:Array<{periodId:string,amount:number}>}>} lines
 * @param {string} [catId] - the Education category id in use (canonical, or a user's own)
 */
export function buildEducationLineItems(lines, catId = EDUCATION_CAT_ID) {
  return (lines || []).map(l => {
    const ids = (l.allocations || []).filter(a => a.amount > 0).map(a => a.periodId);
    const item = {
      id: l.id,
      label: l.coversLabel ? `${l.name} (${l.coversLabel})` : l.name,
      qty: 1,
      unit: "nos",
      unitPrice: Number(l.amount) || 0,
      catId,
      subId: l.subId,
    };
    if (ids.length > 0) {
      item.feePeriodIds = ids;
      if (ids.length === 1) item.feePeriodId = ids[0];
    }
    return item;
  });
}

/**
 * Merge every fee-linked line's allocations into the Transaction's one linkedFeePeriods array.
 * linkedFeePeriods is NOT a settlement model: it is the Transaction's reverse link (same shape
 * Pay Fees already writes) and the explicit-allocation INPUT handed to settleFeePeriods. The
 * canonical record of what was settled is each Fee Period's settlementLinks[{txnId,amount}] and
 * paidAmount; nothing reads linkedFeePeriods to compute an outstanding balance.
 */
export function collectLinkedFeePeriods(lines) {
  const byPeriod = new Map();
  for (const l of lines || []) {
    for (const a of l.allocations || []) {
      if (!(a.amount > 0)) continue;
      byPeriod.set(a.periodId, round2((byPeriod.get(a.periodId) || 0) + a.amount));
    }
  }
  return [...byPeriod.entries()].map(([periodId, amount]) => ({ periodId, amount }));
}

/**
 * Settle the Transaction's fee-linked allocations against the Fee Periods, using the existing
 * settlement command. Periods whose status was never established are declared "unpaid" first
 * (explicitly disclosed to the user in the form) — exactly the existing declaration command.
 *
 * @param {Array} feePeriods
 * @param {Array<{periodId:string,amount:number}>} linkedFeePeriods
 * @param {number|string} txnId
 * @param {(periods:Array, ids:Array<string>, total:number, txnId:any, allocations:Array)=>Array} settle
 *   schoolFeesService.settlePeriods — injected so this module stays free of service wiring.
 * @returns {Array} the new feePeriods array
 */
export function applyEducationSettlement(feePeriods, linkedFeePeriods, txnId, settle) {
  if (!linkedFeePeriods || linkedFeePeriods.length === 0) return feePeriods;
  const ids = linkedFeePeriods.map(a => a.periodId);
  const declared = feePeriods.map(p => (ids.includes(p.id) && !p.startingStateDeclared ? declareFeePeriodStartingState(p, false) : p));
  const total = round2(linkedFeePeriods.reduce((s, a) => s + a.amount, 0));
  return settle(declared, ids, total, txnId, linkedFeePeriods);
}
