import { test } from "node:test";
import assert from "node:assert/strict";
import { digestSnapshot, stableStringify, summarizeDiff, txnIdsOf } from "./digest.js";

test("equal content gives equal digests regardless of key order, savedAt and syncMeta", async () => {
  const a = { savedAt: "2026-01-01", syncMeta: { writeId: "1" }, txns: [{ id: 1, amount: 5, desc: "x" }], dark: true };
  const b = { dark: true, txns: [{ desc: "x", amount: 5, id: 1 }], syncMeta: { writeId: "2" }, savedAt: "2030-01-01" };
  assert.equal(await digestSnapshot(a), await digestSnapshot(b));
});

test("any content change changes the digest (including a single amount, an added or removed record, order of a list)", async () => {
  const base = { txns: [{ id: 1, amount: 5 }, { id: 2, amount: 6 }] };
  const d0 = await digestSnapshot(base);
  for (const changed of [{ txns: [{ id: 1, amount: 6 }, { id: 2, amount: 6 }] }, { txns: [{ id: 1, amount: 5 }] }, { txns: [...base.txns, { id: 3, amount: 1 }] }, { txns: [base.txns[1], base.txns[0]] }, { txns: base.txns, dark: false }]) {
    assert.notEqual(await digestSnapshot(changed), d0);
  }
});

test("stable stringify treats undefined like JSON does and sorts keys", () => {
  assert.equal(stableStringify({ b: 1, a: undefined, c: [undefined, 2] }), '{"b":1,"c":[null,2]}');
});

test("diff lists transaction ids only on one side", () => {
  const d = summarizeDiff({ txns: [{ id: "a" }, { id: "x" }] }, { txns: [{ id: "a" }, { id: "y" }], bills: [{}] });
  assert.deepEqual([d.onlyLocal, d.onlyCloud, d.counts.bills], [["x"], ["y"], { local: 0, cloud: 1 }]);
  assert.deepEqual(txnIdsOf({}), []);
});
