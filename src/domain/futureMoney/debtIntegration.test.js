import { test } from "node:test";
import assert from "node:assert/strict";
import { composeFutureMoneyCommitments } from "./compose.js";
import { projectLoansToDebtServiceEvents } from "../debt/futureMoney.js";
import { projectFeePeriodsToCommitments } from "../schoolFees/futureMoney.js";

const TODAY = new Date(2026, 7, 10);
const toDateOnly = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

test("real Debt Service events compose alongside a real School Fees event without disturbing it", () => {
  const loans = [
    { id: "loan1", direction: "taken", name: "Bike Loan", emiAmount: 3000, dueDay: 12 },
    { id: "loan2", direction: "given", name: "Lent to cousin", emiAmount: 2000, dueDay: 1 }, // must be excluded
  ];
  const period = {
    id: "period1", startingStateDeclared: true, obligationAmount: 4500, paidAmount: 0,
    discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, label: "September", dueDate: "2026-09-01",
  };

  const debtEvents = projectLoansToDebtServiceEvents(loans, [], [], toDateOnly, TODAY);
  const schoolFeeEvents = projectFeePeriodsToCommitments([period]);

  const commitmentsResult = { committedSpending: [], committedSaving: [] };
  const result = composeFutureMoneyCommitments(commitmentsResult, [schoolFeeEvents, debtEvents]);

  // Debt Service: only the "taken" loan projected, the "given" one excluded
  assert.equal(result.debtService.length, 1);
  assert.equal(result.debtService[0].sourceId, "loan1");
  assert.equal(result.debtService[0].amount, 3000);

  // School Fees event lands in committedSpending, completely unaffected by Debt Service existing
  assert.equal(result.committedSpending.length, 1);
  assert.equal(result.committedSpending[0].sourceId, "period1");
  assert.equal(result.committedSpending[0].sourceType, "feePeriod");
});

test("a pre-materialized CC EMI loan produces zero events end-to-end — confirmed via the real adapter, not a stub", () => {
  const loans = [
    { id: "loan3", direction: "taken", name: "TV EMI", emiAmount: 4000, dueDay: 10, autoScheduled: true, scheduledInstallmentIds: ["t1", "t2"] },
  ];
  const debtEvents = projectLoansToDebtServiceEvents(loans, [], [], toDateOnly, TODAY);
  const result = composeFutureMoneyCommitments({ committedSpending: [], committedSaving: [] }, [debtEvents]);
  assert.equal(result.debtService.length, 0); // never projected — already real transactions in txns[]
});

test("real CC-EMI-plan loan, already logged this cycle, composes to the following cycle's date — no duplicate against a real currentDue-style figure", () => {
  const loans = [
    { id: "loan4", direction: "taken", name: "Laptop EMI", emiAmount: 5500, ccEmiPlanId: "plan9", linkedCardId: "card9" },
  ];
  const accounts = [{ id: "card9", type: "cc", statementDate: 20, dueDate: 5 }];
  const txns = [{ type: "cc_emi", ccEmiPlanId: "plan9", date: "2026-07-05" }]; // logged within (20 Jun, 20 Jul]

  const debtEvents = projectLoansToDebtServiceEvents(loans, accounts, txns, toDateOnly, TODAY);
  const result = composeFutureMoneyCommitments({ committedSpending: [], committedSaving: [] }, [debtEvents]);

  assert.equal(result.debtService.length, 1);
  assert.notEqual(result.debtService[0].date, "2026-08-05"); // the already-reflected current-cycle date
  assert.equal(result.debtService[0].date, "2026-09-05");
});

test("mixed loans (taken/given, EMI/no-EMI, personal/CC/pre-materialized) produce exactly the expected composed set, no duplicates, no omissions", () => {
  const loans = [
    { id: "a", direction: "taken", emiAmount: 1000, dueDay: 5, name: "A" },
    { id: "b", direction: "given", emiAmount: 1000, dueDay: 5, name: "B" },
    { id: "c", direction: "taken", name: "C" }, // no emiAmount
    { id: "d", direction: "taken", emiAmount: 2000, autoScheduled: true, name: "D" },
    { id: "e", direction: "taken", emiAmount: 1500, ccEmiPlanId: "p1", linkedCardId: "cc1", name: "E" },
  ];
  const accounts = [{ id: "cc1", statementDate: 15, dueDate: 2 }];
  const debtEvents = projectLoansToDebtServiceEvents(loans, accounts, [], toDateOnly, TODAY);
  const result = composeFutureMoneyCommitments({ committedSpending: [], committedSaving: [] }, [debtEvents]);
  const ids = result.debtService.map(e => e.sourceId).sort();
  assert.deepEqual(ids, ["a", "e"]);
});
