import test from "node:test";
import assert from "node:assert/strict";
import { findImportedDuplicates, applyDuplicateMerge, undoDuplicateMerge } from "./duplicatePairs.js";

const mine = { id: "m1", type: "expense", amount: 365.71, date: "2026-10-16", accId: "cc1", merchant: "McDonald's", catIds: ["food"] };
const imp = { id: "i1", type: "expense", amount: 365.71, date: "2026-10-16", accId: "cc1", merchant: "Mcdonald S", catIds: [], importKey: "K1", importBatchId: "B1", importSource: "bank-statement", transactionRef: "171831146733" };
const other = { id: "o1", type: "expense", amount: 365.71, date: "2026-10-16", accId: "bank1", merchant: "x" };

test("pairs: a hand-made entry and an imported copy on the same account, same amount, within 2 days; each used once; other accounts, merged or same-amount-different-sign are ignored", () => {
  const txns = [mine, imp, other, { ...imp, id: "i2", importKey: "K2", date: "2026-10-30" }, { ...mine, id: "m2", amount: 10 }, { ...imp, id: "i3", importKey: "K3", importMerged: true }];
  const pairs = findImportedDuplicates({ txns, accountId: "cc1", linkedIds: [] });
  assert.deepEqual(pairs.map(p => [p.manual.id, p.imported.id]), [["m1", "i1"]]);
  const two = findImportedDuplicates({ txns: [mine, imp, { ...imp, id: "i9", importKey: "K9" }], accountId: "cc1" });
  assert.equal(two.length, 1);                                                                    // one hand-made entry covers one imported copy
  assert.equal(findImportedDuplicates({ txns: [{ ...mine, type: "income" }, imp], accountId: "cc1" }).length, 0);
});
test("merge keeps my entry, links it, copies the UTR and (only if I had none) the category; removes the copy; undo restores both exactly", () => {
  const txns = [mine, imp, other];
  const pairs = findImportedDuplicates({ txns, accountId: "cc1" });
  const { txns: after, undo } = applyDuplicateMerge(txns, pairs);
  assert.equal(after.length, 2); assert.equal(after.find(t => t.id === "i1"), undefined);
  const m = after.find(t => t.id === "m1");
  assert.equal(m.merchant, "McDonald's"); assert.deepEqual(m.catIds, ["food"]); assert.equal(m.importKey, "K1"); assert.equal(m.importMerged, true); assert.equal(m.transactionRef, "171831146733"); assert.equal(m.importSetRef, true);
  assert.equal(after.find(t => t.id === "o1"), other);
  const back = undoDuplicateMerge(after, undo);
  assert.deepEqual(back.find(t => t.id === "m1"), mine); assert.deepEqual(back.find(t => t.id === "i1"), imp); assert.equal(back.length, 3);
  // a category only the import's copy has is carried over
  const catted = applyDuplicateMerge([{ ...mine, catIds: [], catId: null }, { ...imp, catIds: ["travel"], catId: "travel", subIds: ["t1"], subId: "t1" }], findImportedDuplicates({ txns: [{ ...mine, catIds: [], catId: null }, { ...imp, catIds: ["travel"] }], accountId: "cc1" })).txns.find(t => t.id === "m1");
  assert.deepEqual(catted.catIds, ["travel"]);
});
