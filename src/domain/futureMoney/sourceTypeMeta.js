// domain/futureMoney/sourceTypeMeta.js
//
// Outlook redesign (handoff: "Arth · Outlook, Budget and Insights") — "One row, seven source
// types... Only two things depend on sourceType, and both come from a lookup table: the type
// label and the screen the row opens." This file owns the type-label half of that lookup (the
// "opens" half stays in OutlookPage's existing openCommitmentRow dispatcher in App.jsx, which
// already does exactly this and is not duplicated here).
//
// Also owns the display status shown next to the amount (Due / Unpaid / Scheduled / Expected)
// and whether an occurrence is "solid" (a real, currently-known amount) or "dashed" (a generic
// rhythm estimate, shown as "~₹" per the handoff's "Solid vs dashed" rule). Both are looked up
// by sourceType alone — no new stored field, no per-record judgment call.
//
// The real status values already stored on events today are "unpaid" (bill/ccStatement/
// membership/insurancePolicy) and "upcoming" (debt) — narrower than the four display labels the
// handoff mocks show, because those are a display-layer vocabulary, not a raw data field. This
// table is that mapping, confirmed once here rather than re-decided ad hoc at each render site.
// getDisplayStatus returns a key into the shared STATUS token table (src/constants/theme.js),
// not the label text directly — callers get the label via STATUS[key].label and the pill's
// colour via statusStyle(key, T), the same as every other status pill in the app.

export const SOURCE_TYPE_LABEL = {
  bill: "Bill",
  ccStatement: "Card statement",
  recurringSchedule: "Scheduled",
  feePeriod: "School fee",
  debt: "Loan",
  membership: "Membership",
  insurancePolicy: "Insurance",
};

export const SOURCE_TYPE_DISPLAY_STATUS = {
  bill: "due",
  ccStatement: "due",
  recurringSchedule: "scheduled",
  feePeriod: "unpaid",
  debt: "scheduled",
  membership: "expected",
  insurancePolicy: "scheduled",
};

export function getSourceTypeLabel(sourceType) {
  return SOURCE_TYPE_LABEL[sourceType] || sourceType || "";
}

/** Returns a STATUS token key (src/constants/theme.js) — not label text. */
export function getDisplayStatus(sourceType) {
  return SOURCE_TYPE_DISPLAY_STATUS[sourceType] || "scheduled";
}

// category on the composed event is the Spending/Saving/Debt bucket (committedSpending /
// committedSaving / debtService) — already computed by every adapter. This just gives it the
// three-word display split the handoff's coverage card uses, so nothing re-derives it.
const CATEGORY_SPLIT_LABEL = {
  committedSpending: "Spending",
  committedSaving: "Saving",
  debtService: "Debt",
};

export function getSplitLabel(category) {
  return CATEGORY_SPLIT_LABEL[category] || "Spending";
}

// "Solid vs dashed... A real amount (a Bill, a statement, a fixed EMI or premium) is solid. An
// estimate is dashed." Worked out from the handoff's own mock, occurrence by occurrence: a
// membership fee is treated as an estimate everywhere (gym-type fees vary run to run); a Bill or
// card statement is a real, already-known amount for its immediate next occurrence (shown in
// "next 30 days") but an estimate once the row is describing the general monthly rhythm rather
// than a specific known bill ("every month... last amount"); a school fee term is real once its
// period is imminent (next 30 days) but an estimate for a future term that hasn't been billed
// yet. A loan EMI, a SIP and an insurance premium are fixed by contract and never estimates,
// in any section — confirmed by every occurrence of those three in the handoff's mock showing
// no "~" at all.
const ALWAYS_ESTIMATED_SOURCE_TYPES = ["membership"];
const ESTIMATED_ONCE_PROJECTED_SOURCE_TYPES = ["bill", "ccStatement", "feePeriod"];

export function isEstimatedOccurrence(sourceType, section) {
  if (ALWAYS_ESTIMATED_SOURCE_TYPES.includes(sourceType)) return true;
  if (section === "next30") return false;
  return ESTIMATED_ONCE_PROJECTED_SOURCE_TYPES.includes(sourceType);
}
