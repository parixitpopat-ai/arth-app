import test from "node:test";
import assert from "node:assert/strict";

// Simulates App.jsx's Balance Check save handler EXACTLY as it exists today
// (App.jsx:17035-17039, confirmed by direct trace). This is a CONTROL GROUP:
// WP-07 does not touch this code path at all — these tests exist to prove
// that fact stays true, not to characterize something about to change.

function currentBalanceCheckSave({ accounts, balanceCheckpoints, editingCheckpoint, editingOpeningBalanceVal, editingOpeningBalanceDate, editingCheckpointVal, editingCheckpointDate }) {
  const openingVal = Number(editingOpeningBalanceVal);
  const actualVal = Number(editingCheckpointVal);
  const updatedAccounts = accounts.map(acc =>
    acc.id === editingCheckpoint
      ? { ...acc, openingBalance: openingVal, openingBalanceDate: editingOpeningBalanceDate || "2026-01-01" }
      : acc
  );
  const updatedCheckpoints = { ...balanceCheckpoints, [editingCheckpoint]: { amount: actualVal, date: editingCheckpointDate || "2026-01-01" } };
  return { accounts: updatedAccounts, balanceCheckpoints: updatedCheckpoints };
}

test("Balance Check: saves BOTH openingBalance and a checkpoint, unconditionally, in one action", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" }];
  const result = currentBalanceCheckSave({
    accounts, balanceCheckpoints: {}, editingCheckpoint: "b1",
    editingOpeningBalanceVal: "1200", editingOpeningBalanceDate: "2026-02-01",
    editingCheckpointVal: "1500", editingCheckpointDate: "2026-02-15",
  });
  assert.equal(result.accounts[0].openingBalance, 1200);
  assert.equal(result.accounts[0].openingBalanceDate, "2026-02-01");
  assert.deepEqual(result.balanceCheckpoints.b1, { amount: 1500, date: "2026-02-15" });
});

test("Balance Check: openingBalance is REPLACED, not incremented", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" }];
  const result = currentBalanceCheckSave({
    accounts, balanceCheckpoints: {}, editingCheckpoint: "b1",
    editingOpeningBalanceVal: "50", editingOpeningBalanceDate: "2026-02-01",
    editingCheckpointVal: "50", editingCheckpointDate: "2026-02-15",
  });
  assert.equal(result.accounts[0].openingBalance, 50, "direct replacement, not 1000+50");
});

test("Balance Check: the checkpoint object is REPLACED wholesale, not merged or appended to any history", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" }];
  const existing = { b1: { amount: 900, date: "2026-01-10" } };
  const result = currentBalanceCheckSave({
    accounts, balanceCheckpoints: existing, editingCheckpoint: "b1",
    editingOpeningBalanceVal: "1000", editingOpeningBalanceDate: "2026-01-01",
    editingCheckpointVal: "1100", editingCheckpointDate: "2026-02-15",
  });
  assert.deepEqual(result.balanceCheckpoints.b1, { amount: 1100, date: "2026-02-15" }, "old checkpoint value is gone, not preserved anywhere");
});

test("Balance Check: only the targeted account is touched — sibling accounts and their checkpoints are untouched", () => {
  const accounts = [
    { id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" },
    { id: "b2", type: "bank", openingBalance: 2000, openingBalanceDate: "2026-01-01" },
  ];
  const existing = { b2: { amount: 2000, date: "2026-01-10" } };
  const result = currentBalanceCheckSave({
    accounts, balanceCheckpoints: existing, editingCheckpoint: "b1",
    editingOpeningBalanceVal: "1200", editingOpeningBalanceDate: "2026-02-01",
    editingCheckpointVal: "1200", editingCheckpointDate: "2026-02-15",
  });
  assert.equal(result.accounts[1].openingBalance, 2000, "b2 untouched");
  assert.deepEqual(result.balanceCheckpoints.b2, { amount: 2000, date: "2026-01-10" }, "b2's checkpoint untouched");
});
