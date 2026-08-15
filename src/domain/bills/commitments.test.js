// domain/bills/commitments.test.js
//
// Phase A: characterizes CURRENT Home and Outlook behavior (their existing,
// independently-assembled, mixed Bill+SIP+CC-statement arrays) — as a
// historical record and drift-detection baseline, NOT as the target the new
// read model should match. Per explicit instruction, the new model is built
// against the approved semantic contract, not against this legacy shape.
//
// Phase B: unit tests for the new getCommitments read model's semantic
// mapping, covering all 11 required cases.

import { test } from "node:test";
import assert from "node:assert/strict";
import { getCommitments, isRechargeBiller } from "./commitments.js";
import { getCardSummary } from "../cards/summaries.js";

// ============================================================
// Phase A — Characterization of CURRENT Home/Outlook behavior
// ============================================================

// Outlook's real, live logic (billsForForecast construction), reproduced
// verbatim from the confirmed evidence-pass read of App.jsx.
function legacyOutlookMerge(bills, recurringSchedules, accounts, txns, toDateOnly, getCardSummary) {
  const todayDate = new Date("2026-08-15"); todayDate.setHours(0,0,0,0);
  const sipsAsBills = (recurringSchedules||[]).filter(r=>r.active!==false).map(r=>{
    const thisMonthDue = new Date(todayDate.getFullYear(), todayDate.getMonth(), r.day);
    const nextDue = thisMonthDue >= todayDate ? thisMonthDue : new Date(todayDate.getFullYear(), todayDate.getMonth()+1, r.day);
    return { id:`sip_${r.id}`, type:"sip", name:r.name?`${r.name} SIP`:"SIP", amount:r.amount, dueDate:nextDue.toISOString().slice(0,10), status:"unpaid" };
  });
  const ccStatementsAsBills = (accounts||[]).filter(a=>a.type==="cc").map(a=>{
    const summary = getCardSummary(a, accounts, txns, toDateOnly);
    if(!summary.currentDue || summary.currentDue<=0) return null;
    return { id:`ccstmt_${a.id}`, type:"cc_statement", name:`${a.name} Statement`, amount:summary.currentDue, dueDate:summary.dueOn.toISOString().slice(0,10), status:"unpaid" };
  }).filter(Boolean);
  return [...(bills||[]), ...sipsAsBills, ...ccStatementsAsBills];
}

// Home's real, live logic — reproduced verbatim. Note the MISSING `name`
// field on sipsAsBills entries, confirmed as a real drift during evidence.
function legacyHomeMerge(bills, recurringSchedules, accounts, txns, toDateOnly, getCardSummary) {
  const todayDate = new Date("2026-08-15"); todayDate.setHours(0,0,0,0);
  const homeSipsAsBills = (recurringSchedules||[]).filter(r=>r.active!==false).map(r=>{
    const thisMonthDue = new Date(todayDate.getFullYear(), todayDate.getMonth(), r.day);
    const nextDue = thisMonthDue >= todayDate ? thisMonthDue : new Date(todayDate.getFullYear(), todayDate.getMonth()+1, r.day);
    return { id:`sip_${r.id}`, type:"sip", amount:r.amount, dueDate:nextDue.toISOString().slice(0,10), status:"unpaid" }; // NO `name` field — confirmed drift
  });
  const homeCcStatementsAsBills = (accounts||[]).filter(a=>a.type==="cc").map(a=>{
    const summary = getCardSummary(a, accounts, txns, toDateOnly);
    if(!summary.currentDue || summary.currentDue<=0) return null;
    return { id:`ccstmt_${a.id}`, type:"cc_statement", amount:summary.currentDue, dueDate:summary.dueOn.toISOString().slice(0,10), status:"unpaid" };
  }).filter(Boolean);
  return [...(bills||[]), ...homeSipsAsBills, ...homeCcStatementsAsBills];
}

test("characterize: Outlook's current merge includes a `name` field on SIP entries", () => {
  const schedules = [{ id: "r1", name: "Axis Bluechip", amount: 5000, day: 5, active: true }];
  const result = legacyOutlookMerge([], schedules, [], [], null, getCardSummary);
  const sipEntry = result.find(x => x.type === "sip");
  assert.equal(sipEntry.name, "Axis Bluechip SIP");
});

test("characterize: Home's current merge OMITS the `name` field on SIP entries — confirmed drift, not assumed", () => {
  const schedules = [{ id: "r1", name: "Axis Bluechip", amount: 5000, day: 5, active: true }];
  const result = legacyHomeMerge([], schedules, [], [], null, getCardSummary);
  const sipEntry = result.find(x => x.type === "sip");
  assert.equal(sipEntry.name, undefined, "Home's version genuinely lacks a name field — this is real drift between the two 'duplicate' implementations, not identical duplication");
});

test("characterize: both current implementations merge Bills, SIPs, and CC-statements into ONE flat array with no semantic distinction — this is exactly what the new contract must not do", () => {
  const bills = [{ id: "b1", name: "Electricity", amount: 2000, status: "unpaid" }];
  const schedules = [{ id: "r1", name: "SIP", amount: 5000, day: 5, active: true }];
  const outlookResult = legacyOutlookMerge(bills, schedules, [], [], null, getCardSummary);
  assert.equal(outlookResult.length, 2, "one real bill + one SIP, indistinguishable in the flat array");
  assert.equal(outlookResult.every(x => !("category" in x)), true, "current legacy shape has no category field at all — confirms the contract violation this session's work exists to fix");
});

// ============================================================
// Phase B — New Commitment Read Model, semantic mapping tests
// ============================================================

test("commitment: real utility Bill with recurring:false is INCLUDED in Committed Spending (the critical semantic rule)", () => {
  const bills = [{ id: "b1", name: "Goa Electricity Department", amount: 2713, status: "paid", recurring: false, dueDate: "2026-07-10" }];
  const { committedSpending } = getCommitments(bills, [], [], [], [], null, getCardSummary, {});
  assert.equal(committedSpending.length, 1);
  assert.equal(committedSpending[0].recurs, false, "recurring:false is preserved as metadata, NOT used to exclude the record");
  assert.equal(committedSpending[0].subCategory, "scheduledObligation");
});

test("commitment: a Bill with recurring:true is also included, correctly tagged as recurring metadata", () => {
  const bills = [{ id: "b1", name: "Netflix", amount: 649, status: "unpaid", recurring: true, dueDate: "2026-09-01" }];
  const { committedSpending } = getCommitments(bills, [], [], [], [], null, getCardSummary, {});
  assert.equal(committedSpending[0].recurs, true);
});

test("commitment: a recharge-type Bill (billerCategory in the recharge list) is tagged subCategory:'recharge'", () => {
  const bills = [{ id: "b1", name: "Metro Card", amount: 500, status: "unpaid", billerCategory: "Metro Recharge" }];
  const { committedSpending } = getCommitments(bills, [], [], [], [], null, getCardSummary, {});
  assert.equal(committedSpending[0].subCategory, "recharge");
});

test("commitment: CC-statement obligation is included in Committed Spending, synthetic sourceType, unpaid by construction", () => {
  const accounts = [{ id: "cc1", name: "HDFC Card", type: "cc", _testSummary: { currentDue: 15000, dueOn: new Date("2026-09-05") } }];
  const { committedSpending } = getCommitments([], [], accounts, [], [], null, getCardSummary, {});
  const ccEntry = committedSpending.find(x => x.sourceType === "ccStatement");
  assert.equal(ccEntry.amount, 15000);
  assert.equal(ccEntry.status, "unpaid");
  assert.equal(ccEntry.category, "committedSpending");
});

test("commitment: a CC account with currentDue <= 0 produces NO entry (no phantom commitment for a paid-off card)", () => {
  const accounts = [{ id: "cc1", name: "HDFC Card", type: "cc", _testSummary: { currentDue: 0, dueOn: new Date("2026-09-05") } }];
  const { committedSpending } = getCommitments([], [], accounts, [], [], null, getCardSummary, {});
  assert.equal(committedSpending.find(x => x.sourceType === "ccStatement"), undefined);
});

test("commitment: active SIP/recurringSchedule appears in Committed Saving, NOT Committed Spending", () => {
  const schedules = [{ id: "r1", name: "Axis Bluechip", amount: 5000, day: 5, active: true }];
  const { committedSpending, committedSaving } = getCommitments([], schedules, [], [], [], null, getCardSummary, {});
  assert.equal(committedSpending.length, 0, "SIP must never silently appear inside Committed Spending — the core rule this contract exists to enforce");
  assert.equal(committedSaving.length, 1);
  assert.equal(committedSaving[0].category, "committedSaving");
  assert.equal(committedSaving[0].name, "Axis Bluechip SIP");
});

test("commitment: inactive SIP is EXCLUDED entirely — does not appear in either array", () => {
  const schedules = [{ id: "r1", name: "Old SIP", amount: 3000, day: 10, active: false }];
  const { committedSpending, committedSaving } = getCommitments([], schedules, [], [], [], null, getCardSummary, {});
  assert.equal(committedSaving.length, 0, "inactive schedules represent no live commitment and must be excluded, not merely marked inactive");
  assert.equal(committedSpending.length, 0);
});

test("commitment: cc_emi transactions are never read by this module at all — Debt Service stays completely separate", () => {
  const txns = [{ id: "t1", type: "cc_emi", amount: 4500, ccEmiPlanId: "plan1", installmentNo: 3 }];
  const { committedSpending, committedSaving } = getCommitments([], [], [], txns, [], null, getCardSummary, {});
  assert.equal(committedSpending.length, 0);
  assert.equal(committedSaving.length, 0);
  // txns is accepted as a parameter (needed by getCardSummary internally) but
  // this module has no code path that reads t.type==="cc_emi" anywhere —
  // confirmed by inspection of commitments.js, not just by this passing test.
});

test("commitment: an ordinary recurring transaction with NO Bill/recurringSchedule record behind it produces NO commitment entry", () => {
  // Simulates a household re-buying the same grocery item monthly with
  // nothing in `bills` or `recurringSchedules` — per the approved contract,
  // this must NOT be auto-promoted into a commitment.
  const txns = [
    { id: "t1", type: "expense", amount: 1200, date: "2026-06-10", merchant: "BigBasket" },
    { id: "t2", type: "expense", amount: 1250, date: "2026-07-10", merchant: "BigBasket" },
    { id: "t3", type: "expense", amount: 1180, date: "2026-08-10", merchant: "BigBasket" },
  ];
  const { committedSpending, committedSaving } = getCommitments([], [], [], txns, [], null, getCardSummary, {});
  assert.equal(committedSpending.length, 0, "no pattern-detection or auto-promotion happens — confirmed by design, not just by empty input");
  assert.equal(committedSaving.length, 0);
});

test("commitment: source identity is preserved — every entry traces back to its real underlying record ID", () => {
  const bills = [{ id: "bill_abc123", name: "Water Bill", amount: 800, status: "unpaid" }];
  const schedules = [{ id: "sched_xyz789", name: "PPF", amount: 12500, day: 1, active: true }];
  const { committedSpending, committedSaving } = getCommitments(bills, schedules, [], [], [], null, getCardSummary, {});
  assert.equal(committedSpending[0].sourceId, "bill_abc123");
  assert.equal(committedSpending[0].sourceType, "bill");
  assert.equal(committedSaving[0].sourceId, "sched_xyz789");
  assert.equal(committedSaving[0].sourceType, "recurringSchedule");
});

test("commitment: Spending and Saving are returned as genuinely separate arrays — mixed input never cross-contaminates", () => {
  const bills = [{ id: "b1", name: "Electricity", amount: 2000, status: "unpaid" }];
  const schedules = [{ id: "r1", name: "SIP", amount: 5000, day: 5, active: true }];
  const { committedSpending, committedSaving } = getCommitments(bills, schedules, [], [], [], null, getCardSummary, {});
  assert.equal(committedSpending.length, 1);
  assert.equal(committedSaving.length, 1);
  assert.equal(committedSpending.some(x => x.category === "committedSaving"), false);
  assert.equal(committedSaving.some(x => x.category === "committedSpending"), false);
});

test("commitment: no accidental double-counting — a household with one Bill, one SIP, and one CC statement produces exactly 2 spending entries and 1 saving entry, not more", () => {
  const bills = [{ id: "b1", name: "Electricity", amount: 2000, status: "unpaid" }];
  const schedules = [{ id: "r1", name: "SIP", amount: 5000, day: 5, active: true }];
  const accounts = [{ id: "cc1", name: "Card", type: "cc", _testSummary: { currentDue: 8000, dueOn: new Date("2026-09-05") } }];
  const { committedSpending, committedSaving } = getCommitments(bills, schedules, accounts, [], [], null, getCardSummary, {});
  assert.equal(committedSpending.length, 2, "1 bill + 1 CC statement");
  assert.equal(committedSaving.length, 1, "1 SIP");
});

test("commitment: household share (getMyBillShare replica) correctly nets a split bill, matching the real inline logic", () => {
  const bills = [{
    id: "b1", name: "Shared Rent", amount: 20000, status: "unpaid",
    splitPeople: { p1: { amount: 8000, mode: "owes" } },
  }];
  const { committedSpending } = getCommitments(bills, [], [], [], [], null, getCardSummary, {});
  assert.equal(committedSpending[0].amount, 12000, "20000 - 8000 owed by p1 = 12000 is genuinely the household's own share");
});

test("commitment: refunds are netted before household-share calculation, via existing getNetBillAmount", () => {
  const bills = [{ id: "b1", name: "Overcharged Bill", amount: 5000, status: "paid" }];
  const refundTotalsByBill = { b1: 1000 };
  const { committedSpending } = getCommitments(bills, [], [], [], [], null, getCardSummary, refundTotalsByBill);
  assert.equal(committedSpending[0].amount, 4000, "5000 - 1000 refund = 4000");
});
