import { test } from "node:test";
import assert from "node:assert/strict";
import { mapLoanToDebtServiceEvent, projectLoansToDebtServiceEvents, computeNextCcEmiDueDate } from "./futureMoney.js";

const TODAY = new Date(2026, 7, 10); // 10 Aug 2026, fixed reference date throughout

const toDateOnly = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

const takenLoan = (overrides = {}) => ({
  id: "loan1", direction: "taken", name: "Test Loan", principal: 50000, outstanding: 30000,
  emiAmount: 5000, ...overrides,
});

test("direction:taken loan with a real emiAmount is included", () => {
  const event = mapLoanToDebtServiceEvent(takenLoan(), [], [], toDateOnly, TODAY);
  assert.ok(event);
  assert.equal(event.sourceType, "debt");
  assert.equal(event.sourceId, "loan1");
  assert.equal(event.category, "debtService");
});

test("direction:given loan is excluded — receivable, not our debt", () => {
  const event = mapLoanToDebtServiceEvent(takenLoan({ direction: "given" }), [], [], toDateOnly, TODAY);
  assert.equal(event, null);
});

test("taken loan without an EMI amount is excluded from recurring Debt Service", () => {
  assert.equal(mapLoanToDebtServiceEvent(takenLoan({ emiAmount: 0 }), [], [], toDateOnly, TODAY), null);
  assert.equal(mapLoanToDebtServiceEvent(takenLoan({ emiAmount: undefined }), [], [], toDateOnly, TODAY), null);
});

test("taken loan with EMI produces the correct amount — exactly emiAmount, never outstanding", () => {
  const event = mapLoanToDebtServiceEvent(takenLoan({ emiAmount: 5000, outstanding: 47000 }), [], [], toDateOnly, TODAY);
  assert.equal(event.amount, 5000);
});

test("loan.outstanding is never substituted for emiAmount, even when outstanding is smaller", () => {
  const event = mapLoanToDebtServiceEvent(takenLoan({ emiAmount: 5000, outstanding: 1200 }), [], [], toDateOnly, TODAY);
  assert.equal(event.amount, 5000);
});

test("personal-loan date is only produced when dueDay is actually present and valid", () => {
  const withDate = mapLoanToDebtServiceEvent(takenLoan({ dueDay: 15 }), [], [], toDateOnly, TODAY);
  assert.equal(withDate.date, "2026-08-15");
  assert.equal(mapLoanToDebtServiceEvent(takenLoan({}), [], [], toDateOnly, TODAY).date, null);
  assert.equal(mapLoanToDebtServiceEvent(takenLoan({ dueDay: 0 }), [], [], toDateOnly, TODAY).date, null);
  assert.equal(mapLoanToDebtServiceEvent(takenLoan({ dueDay: 40 }), [], [], toDateOnly, TODAY).date, null);
});

test("CC EMI: not yet logged this cycle -> projects the current cycle's real dueOn from getCardCycleDates", () => {
  const loan = takenLoan({ ccEmiPlanId: "plan1", linkedCardId: "card1" });
  const accounts = [{ id: "card1", type: "cc", statementDate: 20, dueDate: 5 }];
  const event = mapLoanToDebtServiceEvent(loan, accounts, [], toDateOnly, TODAY);
  assert.equal(event.date, "2026-08-05");
  assert.equal(event.subCategory, "ccEmi");
});

test("CC EMI: already logged this cycle -> does NOT repeat the current dueOn (already in currentDue/Committed Spending) — projects the following cycle instead", () => {
  const loan = takenLoan({ ccEmiPlanId: "plan1", linkedCardId: "card1" });
  const accounts = [{ id: "card1", type: "cc", statementDate: 20, dueDate: 5 }];
  const txns = [{ type: "cc_emi", ccEmiPlanId: "plan1", date: "2026-07-05" }];
  const event = mapLoanToDebtServiceEvent(loan, accounts, txns, toDateOnly, TODAY);
  assert.notEqual(event.date, "2026-08-05");
  assert.equal(event.date, "2026-09-05");
});

test("CC EMI: a cc_emi transaction for a DIFFERENT plan does not count as this loan's cycle being logged", () => {
  const loan = takenLoan({ ccEmiPlanId: "plan1", linkedCardId: "card1" });
  const accounts = [{ id: "card1", type: "cc", statementDate: 20, dueDate: 5 }];
  const txns = [{ type: "cc_emi", ccEmiPlanId: "some-other-plan", date: "2026-07-05" }];
  const event = mapLoanToDebtServiceEvent(loan, accounts, txns, toDateOnly, TODAY);
  assert.equal(event.date, "2026-08-05");
});

test("CC EMI: a cc_emi transaction for this plan OUTSIDE the current cycle window does not count as logged", () => {
  const loan = takenLoan({ ccEmiPlanId: "plan1", linkedCardId: "card1" });
  const accounts = [{ id: "card1", type: "cc", statementDate: 20, dueDate: 5 }];
  const txns = [{ type: "cc_emi", ccEmiPlanId: "plan1", date: "2026-06-20" }];
  const event = mapLoanToDebtServiceEvent(loan, accounts, txns, toDateOnly, TODAY);
  assert.equal(event.date, "2026-08-05");
});

test("CC EMI boundary: a cc_emi transaction dated exactly on lastStatementDate DOES count (matches getCardSummary's inclusive upper bound)", () => {
  const loan = takenLoan({ ccEmiPlanId: "plan1", linkedCardId: "card1" });
  const accounts = [{ id: "card1", type: "cc", statementDate: 20, dueDate: 5 }];
  const txns = [{ type: "cc_emi", ccEmiPlanId: "plan1", date: "2026-07-20" }];
  const event = mapLoanToDebtServiceEvent(loan, accounts, txns, toDateOnly, TODAY);
  assert.equal(event.date, "2026-09-05");
});

test("CC EMI: linked card not found -> date is null, never guessed", () => {
  const loan = takenLoan({ ccEmiPlanId: "plan1", linkedCardId: "nonexistent" });
  const event = mapLoanToDebtServiceEvent(loan, [], [], toDateOnly, TODAY);
  assert.equal(event.date, null);
});

test("computeNextCcEmiDueDate: no card -> null", () => {
  assert.equal(computeNextCcEmiDueDate(null, [], "plan1", toDateOnly, TODAY), null);
});

test("pre-materialized CC EMI transactions (autoScheduled) are not projected again, even with an otherwise-eligible ccEmiPlanId/dueDay", () => {
  const loan = takenLoan({ autoScheduled: true, scheduledInstallmentIds: ["t1", "t2", "t3"], dueDay: 15, ccEmiPlanId: "plan1", linkedCardId: "card1" });
  const accounts = [{ id: "card1", statementDate: 15, dueDate: 5 }];
  const event = mapLoanToDebtServiceEvent(loan, accounts, [], toDateOnly, TODAY);
  assert.equal(event, null);
});

test("autoScheduled short-circuits before any card/cycle lookup happens at all", () => {
  const loan = takenLoan({ autoScheduled: true, emiAmount: 9999, ccEmiPlanId: "plan1", linkedCardId: "does-not-exist" });
  assert.doesNotThrow(() => mapLoanToDebtServiceEvent(loan, [], [], toDateOnly, TODAY));
  assert.equal(mapLoanToDebtServiceEvent(loan, [], [], toDateOnly, TODAY), null);
});

test("projectLoansToDebtServiceEvents produces no duplicate commitment for a mixed set of loans", () => {
  const loans = [
    takenLoan({ id: "l1", dueDay: 10 }),
    takenLoan({ id: "l2", direction: "given" }),
    takenLoan({ id: "l3", emiAmount: 0 }),
    takenLoan({ id: "l4", autoScheduled: true }),
    takenLoan({ id: "l5", ccEmiPlanId: "p1", linkedCardId: "c1" }),
  ];
  const accounts = [{ id: "c1", statementDate: 12, dueDate: 3 }];
  const events = projectLoansToDebtServiceEvents(loans, accounts, [], toDateOnly, TODAY);
  assert.equal(events.length, 2);
  const sourceIds = events.map(e => e.sourceId).sort();
  assert.deepEqual(sourceIds, ["l1", "l5"]);
  assert.equal(new Set(sourceIds).size, sourceIds.length);
});

test("recurs is always true", () => {
  assert.equal(mapLoanToDebtServiceEvent(takenLoan({ dueDay: 15 }), [], [], toDateOnly, TODAY).recurs, true);
});

test("never mutates loan, accounts, or txns inputs", () => {
  const loan = takenLoan({ ccEmiPlanId: "plan1", linkedCardId: "card1" });
  const accounts = [{ id: "card1", statementDate: 20, dueDate: 5 }];
  const txns = [{ type: "cc_emi", ccEmiPlanId: "plan1", date: "2026-07-05" }];
  const [loanB, accB, txnsB] = [JSON.stringify(loan), JSON.stringify(accounts), JSON.stringify(txns)];
  mapLoanToDebtServiceEvent(loan, accounts, txns, toDateOnly, TODAY);
  assert.equal(JSON.stringify(loan), loanB);
  assert.equal(JSON.stringify(accounts), accB);
  assert.equal(JSON.stringify(txns), txnsB);
});

test("handles empty/missing loans array and malformed loan entries without throwing", () => {
  assert.deepEqual(projectLoansToDebtServiceEvents([], [], [], toDateOnly, TODAY), []);
  assert.deepEqual(projectLoansToDebtServiceEvents(null, [], [], toDateOnly, TODAY), []);
  assert.equal(mapLoanToDebtServiceEvent(null, [], [], toDateOnly, TODAY), null);
  assert.equal(mapLoanToDebtServiceEvent({}, [], [], toDateOnly, TODAY), null);
});
