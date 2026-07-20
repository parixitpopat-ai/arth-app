// First domain service module — extracted per the Function Extraction Checklist
// (CODING_STANDARDS.md): no React hooks, no closure over component state, no setters, no JSX,
// no DOM access, no implicit globals. All three functions moved here verbatim — no signature
// changes, no behavior changes, exactly the "mechanical extraction only" rule that's governed
// every pass so far (Pass 3A/3B, ADR-002).
//
// This is the first module under src/domain/ — the pattern this establishes (pure business logic
// grouped by the domain it serves, separate from both App.jsx and useArthData()) is meant to
// generalize to other domains (goals, events, people) as their own coupling gets audited the
// same way Bills' was.

export const computeNextDueDate = (bill, paidDate) => {
  const base = bill.billingModel === "prorata"
    ? new Date(paidDate || bill.dueDate || bill.activationDate || new Date())
    : new Date(bill.periodEnd || bill.dueDate || new Date());
  const next = new Date(base);
  const freq = bill.frequency || "monthly";
  if(freq === "monthly") next.setMonth(next.getMonth() + 1);
  else if(freq === "quarterly") next.setMonth(next.getMonth() + 3);
  else if(freq === "halfyearly") next.setMonth(next.getMonth() + 6);
  else if(freq === "annual" || freq === "yearly") next.setFullYear(next.getFullYear() + 1);
  else if(freq === "custom" && bill.validityDays) next.setDate(next.getDate() + Number(bill.validityDays));
  return next.toISOString().split("T")[0];
};

export const computeNextPeriod = (bill, paidDate) => {
  if(bill.billingModel !== "calendar" || !bill.periodStart || !bill.periodEnd) return null;
  const start = new Date(bill.periodEnd); start.setDate(start.getDate() + 1);
  const end = new Date(start);
  const freq = bill.frequency || "monthly";
  if(freq === "monthly") end.setMonth(end.getMonth() + 1);
  else if(freq === "quarterly") end.setMonth(end.getMonth() + 3);
  else if(freq === "halfyearly") end.setMonth(end.getMonth() + 6);
  else if(freq === "annual" || freq === "yearly") end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1);
  return { periodStart: start.toISOString().split("T")[0], periodEnd: end.toISOString().split("T")[0] };
};

// Not Bills-specific by name (also used for person/group settlement shares elsewhere), but lives
// here because Bills is the first domain to have its business logic actually audited. If a
// people/settlements domain module gets built later, this may move again — noted, not acted on.
export const remainingShare = info => {
  if(!info) return 0;
  if(info.settled) return 0;
  return Math.max(0, Number(info?.remainingAmt ?? info?.amount ?? 0));
};
