// domain/budget/nudge.js
//
// Plan Ahead PA8/PA9 — the over-budget nudge on Next-month readiness. A suggestion only: nothing changes
// unless the person taps. It looks at planned SPENDING (budget used, never investments) against that
// month's budget and decides which of four things the screen shows:
//   "card"      planned spending is over budget and the person hasn't answered yet
//   "dismissed" they chose "Not now" - the card stays away unless planned spending rises further
//   "raised"    they accepted - the month's budget now covers the plan
//   null        nothing to say
// `record` is what was stored for that month: { dismissedAtUsed, raisedFrom, raisedTo, hadOverride, prevOverride }.

/** Planned figure rounded UP to the next ₹1,000. */
export function nudgeAmount(budgetUsed) {
  const v = Number(budgetUsed) || 0;
  return v <= 0 ? 0 : Math.ceil(v / 1000) * 1000;
}

export function planNudge({ budgetUsed, monthBudget, over, record }) {
  const rec = record || {};
  if (rec.raisedTo != null && Number(monthBudget) === Number(rec.raisedTo) && Number(monthBudget) >= Number(budgetUsed)) {
    return { kind: "raised", raisedFrom: rec.raisedFrom, raisedTo: rec.raisedTo };
  }
  if (!(over > 0)) return null;
  const raiseTo = nudgeAmount(budgetUsed);
  if (rec.dismissedAtUsed != null && Number(budgetUsed) <= Number(rec.dismissedAtUsed)) return { kind: "dismissed", raiseTo };
  return { kind: "card", raiseTo };
}
