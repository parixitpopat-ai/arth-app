import { test } from "node:test";
import assert from "node:assert/strict";
import { getGroupMemberOwed, getGroupMemberIOwe } from "./balances.js";

// --- transaction-based amounts ---------------------------------------------------------

test("getGroupMemberOwed sums an unsettled owes-mode transaction entry for the given group and person", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes", settled: false } } },
  ];
  assert.equal(getGroupMemberOwed(txns, [], "g1", "p1"), 100);
});

test("getGroupMemberOwed sums remainingAmt over amount when present (partial settlement)", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, remainingAmt: 40, mode: "owes", settled: false } } },
  ];
  assert.equal(getGroupMemberOwed(txns, [], "g1", "p1"), 40);
});

// --- bill/split-based amounts ---------------------------------------------------------

test("getGroupMemberOwed sums an unsettled owes-mode bill splitPeople entry for the given group and person", () => {
  const bills = [
    { id: "b1", groupId: "g1", status: "unpaid", splitPeople: { p1: { amount: 60, mode: "owes", settled: false } } },
  ];
  assert.equal(getGroupMemberOwed([], bills, "g1", "p1"), 60);
});

test("getGroupMemberOwed combines transaction and bill amounts for the same group/person", () => {
  const txns = [{ id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes", settled: false } } }];
  const bills = [{ id: "b1", groupId: "g1", status: "unpaid", splitPeople: { p1: { amount: 60, mode: "owes", settled: false } } }];
  assert.equal(getGroupMemberOwed(txns, bills, "g1", "p1"), 160);
});

test("getGroupMemberOwed ignores paid bills", () => {
  const bills = [{ id: "b1", groupId: "g1", status: "paid", splitPeople: { p1: { amount: 60, mode: "owes", settled: false } } }];
  assert.equal(getGroupMemberOwed([], bills, "g1", "p1"), 0);
});

// --- multiple groups ---------------------------------------------------------

test("getGroupMemberOwed scopes strictly to the requested group — the same person's amount in a different group is excluded", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes", settled: false } } },
    { id: "t2", groupId: "g2", type: "expense", people: { p1: { amount: 999, mode: "owes", settled: false } } },
  ];
  assert.equal(getGroupMemberOwed(txns, [], "g1", "p1"), 100);
  assert.equal(getGroupMemberOwed(txns, [], "g2", "p1"), 999);
});

// --- zero amounts ---------------------------------------------------------

test("getGroupMemberOwed returns 0 for a person with no matching entries at all", () => {
  const txns = [{ id: "t1", groupId: "g1", type: "expense", people: { p2: { amount: 100, mode: "owes", settled: false } } }];
  assert.equal(getGroupMemberOwed(txns, [], "g1", "p1"), 0);
});

test("getGroupMemberOwed returns 0 for already-settled entries", () => {
  const txns = [{ id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes", settled: true } } }];
  assert.equal(getGroupMemberOwed(txns, [], "g1", "p1"), 0);
});

test("getGroupMemberOwed returns 0 for spent_on mode entries (not a receivable)", () => {
  const txns = [{ id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "spent_on", settled: false } } }];
  assert.equal(getGroupMemberOwed(txns, [], "g1", "p1"), 0);
});

test("getGroupMemberOwed handles empty/missing txns and bills gracefully", () => {
  assert.equal(getGroupMemberOwed([], [], "g1", "p1"), 0);
  assert.equal(getGroupMemberOwed(undefined, undefined, "g1", "p1"), 0);
});

// --- records unrelated to the requested group ---------------------------------------------------------

test("getGroupMemberOwed excludes non-expense transactions even if groupId/pid match", () => {
  const txns = [{ id: "t1", groupId: "g1", type: "income", people: { p1: { amount: 100, mode: "owes", settled: false } } }];
  assert.equal(getGroupMemberOwed(txns, [], "g1", "p1"), 0);
});

test("getGroupMemberOwed excludes transactions/bills with no groupId at all", () => {
  const txns = [{ id: "t1", groupId: null, type: "expense", people: { p1: { amount: 100, mode: "owes", settled: false } } }];
  const bills = [{ id: "b1", groupId: null, status: "unpaid", splitPeople: { p1: { amount: 100, mode: "owes", settled: false } } }];
  assert.equal(getGroupMemberOwed(txns, bills, "g1", "p1"), 0);
});

// --- historical/archived group references ---------------------------------------------------------

test("getGroupMemberOwed does not consult a groups[] array at all — it reads only txns/bills by groupId string, so it continues to correctly compute the balance for an archived group's id (historical resolution must keep working per PGRP-001's explicit invariant)", () => {
  // No groups[] parameter exists on this function's signature at all —
  // this test documents that structurally, not just asserts a behavior.
  assert.equal(getGroupMemberOwed.length, 4); // (txns, bills, groupId, pid) — no groups param
  const txns = [{ id: "t1", groupId: "g_archived", type: "expense", people: { p1: { amount: 75, mode: "owes", settled: false } } }];
  assert.equal(getGroupMemberOwed(txns, [], "g_archived", "p1"), 75);
});

// ============================================================================
// getGroupMemberIOwe — transaction-only, implemented per explicit decision
// ============================================================================

test("getGroupMemberIOwe sums an owes_by_me transaction entry for the given group and person", () => {
  const txns = [{ id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 200, mode: "owes_by_me" } } }];
  assert.equal(getGroupMemberIOwe(txns, "g1", "p1"), 200);
});

test("getGroupMemberIOwe uses the raw amount, not remainingShare — matching the unscoped source's exact (unfixed) asymmetry", () => {
  const txns = [{ id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 200, remainingAmt: 50, mode: "owes_by_me" } } }];
  assert.equal(getGroupMemberIOwe(txns, "g1", "p1"), 200); // NOT 50
});

test("getGroupMemberIOwe does not check settled at all — matching the unscoped source's exact (unfixed) asymmetry", () => {
  const txns = [{ id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 200, mode: "owes_by_me", settled: true } } }];
  assert.equal(getGroupMemberIOwe(txns, "g1", "p1"), 200); // still counted
});

test("getGroupMemberIOwe scopes strictly to the requested group", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes_by_me" } } },
    { id: "t2", groupId: "g2", type: "expense", people: { p1: { amount: 999, mode: "owes_by_me" } } },
  ];
  assert.equal(getGroupMemberIOwe(txns, "g1", "p1"), 100);
});

test("getGroupMemberIOwe returns 0 for owes mode (that's the other direction) and spent_on mode", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes" } } },
    { id: "t2", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "spent_on" } } },
  ];
  assert.equal(getGroupMemberIOwe(txns, "g1", "p1"), 0);
});

test("getGroupMemberIOwe returns 0 for __me__ unconditionally, matching the unscoped source's explicit self-exclusion", () => {
  const txns = [{ id: "t1", groupId: "g1", type: "expense", people: { __me__: { amount: 100, mode: "owes_by_me" } } }];
  assert.equal(getGroupMemberIOwe(txns, "g1", "__me__"), 0);
});

test("getGroupMemberIOwe excludes non-expense transactions and transactions with no groupId", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "income", people: { p1: { amount: 100, mode: "owes_by_me" } } },
    { id: "t2", groupId: null, type: "expense", people: { p1: { amount: 100, mode: "owes_by_me" } } },
  ];
  assert.equal(getGroupMemberIOwe(txns, "g1", "p1"), 0);
});

test("getGroupMemberIOwe handles empty/missing input gracefully", () => {
  assert.equal(getGroupMemberIOwe([], "g1", "p1"), 0);
  assert.equal(getGroupMemberIOwe(undefined, "g1", "p1"), 0);
});

test("getGroupMemberIOwe continues to resolve correctly for an archived group's id — no groups[] dependency, same invariant as getGroupMemberOwed", () => {
  assert.equal(getGroupMemberIOwe.length, 3); // (txns, groupId, pid) — no groups/bills param
  const txns = [{ id: "t1", groupId: "g_archived", type: "expense", people: { p1: { amount: 50, mode: "owes_by_me" } } }];
  assert.equal(getGroupMemberIOwe(txns, "g_archived", "p1"), 50);
});

// ============================================================================
// WP-3 mandatory reconciliation test
//
// referenceUnscopedIOwe below is a faithful, test-only re-implementation of
// the exact three sources that feed App.jsx's real settlements useMemo
// (~line 1671) for the "iOwe" direction — confirmed by direct trace, not
// guessed:
//   1. settlement_in with fromPersonId + extraAmount>0 + settlementLinks.length>0
//   2. settlement_out with toPersonId
//   3. expense transactions' t.people[pid].mode==="owes_by_me" (raw amount,
//      no settled check — see the two asymmetry tests above)
// This duplication exists ONLY in this test file, for reconciliation proof.
// It is never imported into production code, and production's real
// settlements calculation is not modified anywhere in this WP.
// ============================================================================

function referenceUnscopedIOwe(txns, pid) {
  let payable = 0;
  (txns || []).forEach(t => {
    if (t.type === "settlement_in" && t.fromPersonId === pid && Number(t.extraAmount || 0) > 0 && (t.settlementLinks || []).length > 0) {
      payable += Number(t.extraAmount || 0);
    }
    if (t.type === "settlement_out" && t.toPersonId === pid) {
      payable += Number(t.amount || 0);
    }
    if (t.type === "expense" && t.people) {
      Object.entries(t.people).forEach(([p, info]) => {
        if (p !== pid || p === "__me__" || info.mode !== "owes_by_me") return;
        payable += Number(info.amount || 0);
      });
    }
  });
  return Math.max(0, payable);
}

test("RECONCILIATION (WP-3, mandatory): group-scoped iOwe across every group the person belongs to, plus the non-group remainder, equals the unscoped reference figure — transaction-based amounts, multiple groups", () => {
  const pid = "p1";
  const personsGroups = ["g1", "g2"];
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes_by_me" } } },
    { id: "t2", groupId: "g2", type: "expense", people: { p1: { amount: 50, mode: "owes_by_me" } } },
    { id: "t3", groupId: null, type: "expense", people: { p1: { amount: 30, mode: "owes_by_me" } } }, // non-group
  ];
  const expected = referenceUnscopedIOwe(txns, pid);
  const scopedSum = personsGroups.reduce((sum, gid) => sum + getGroupMemberIOwe(txns, gid, pid), 0);
  const nonGroupRemainder = expected - scopedSum;
  assert.equal(scopedSum + nonGroupRemainder, expected);
  // Concrete, not just tautological: prove the actual split is what we expect.
  assert.equal(scopedSum, 150); // 100 (g1) + 50 (g2)
  assert.equal(nonGroupRemainder, 30); // the ungrouped entry
});

test("RECONCILIATION (WP-3, mandatory): settlement_in/settlement_out contributions land entirely in the non-group remainder — the scoped function correctly does not (and structurally cannot) attribute them to any group", () => {
  const pid = "p1";
  const personsGroups = ["g1"];
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 40, mode: "owes_by_me" } } },
    { id: "t2", type: "settlement_in", fromPersonId: "p1", extraAmount: 25, settlementLinks: [{ kind: "txn", id: "x", amount: 10 }] },
    { id: "t3", type: "settlement_out", toPersonId: "p1", amount: 15 },
  ];
  const expected = referenceUnscopedIOwe(txns, pid); // 40 + 25 + 15 = 80
  assert.equal(expected, 80);
  const scopedSum = personsGroups.reduce((sum, gid) => sum + getGroupMemberIOwe(txns, gid, pid), 0);
  assert.equal(scopedSum, 40); // only the group-tagged owes_by_me entry
  const nonGroupRemainder = expected - scopedSum;
  assert.equal(nonGroupRemainder, 40); // the two settlement transactions, entirely
  assert.equal(scopedSum + nonGroupRemainder, expected);
});

test("RECONCILIATION (WP-3, mandatory): zero-amount case — a person with no iOwe anywhere reconciles to exactly zero on both sides", () => {
  const pid = "p_no_debt";
  const txns = [{ id: "t1", groupId: "g1", type: "expense", people: { other_person: { amount: 500, mode: "owes_by_me" } } }];
  const expected = referenceUnscopedIOwe(txns, pid);
  const scopedSum = getGroupMemberIOwe(txns, "g1", pid);
  assert.equal(expected, 0);
  assert.equal(scopedSum, 0);
  assert.equal(scopedSum + (expected - scopedSum), expected);
});

test("RECONCILIATION (WP-3, mandatory): records unrelated to the person or unrelated groups never leak into either side", () => {
  const pid = "p1";
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes_by_me" } } },
    { id: "t2", groupId: "g_unrelated", type: "expense", people: { p2: { amount: 999, mode: "owes_by_me" } } }, // different person entirely
    { id: "t3", groupId: "g1", type: "expense", people: { p1: { amount: 50, mode: "owes" } } }, // wrong direction
  ];
  const expected = referenceUnscopedIOwe(txns, pid);
  assert.equal(expected, 100);
  const scopedSum = getGroupMemberIOwe(txns, "g1", pid);
  assert.equal(scopedSum, 100);
  assert.equal(scopedSum + (expected - scopedSum), expected);
});

test("RECONCILIATION (WP-3, mandatory): an archived group's historical owes_by_me entries still reconcile correctly — archiving must not silently drop a person from the group-scoped side while the unscoped total still counts it", () => {
  const pid = "p1";
  const txns = [{ id: "t1", groupId: "g_archived", type: "expense", people: { p1: { amount: 60, mode: "owes_by_me" } } }];
  const expected = referenceUnscopedIOwe(txns, pid);
  const scopedSum = getGroupMemberIOwe(txns, "g_archived", pid); // caller passes the id directly — no groups[] filter inside this function
  assert.equal(expected, 60);
  assert.equal(scopedSum, 60);
  assert.equal(scopedSum + (expected - scopedSum), expected);
});
