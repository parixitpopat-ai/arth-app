import { test } from "node:test";
import assert from "node:assert/strict";
import { packList, unpackList } from "./packedList.js";

const sample = n => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, vendor: `Vendor ₹ ${i % 30} 🛒`, note: "n".repeat(120), amount: i * 3.5 }));

test("a list survives packing exactly, including ₹ and emoji", () => {
  const list = [{ id: "a", note: "₹1,234.50 — café 🛒", nested: { x: [1, 2, { y: null }] } }];
  assert.deepEqual(unpackList(packList(list)), list);
});
test("packed text is much smaller than plain JSON for repetitive records", () => {
  const list = sample(2000); const plain = JSON.stringify(list), packed = packList(list);
  assert.ok(packed.length < plain.length / 3, `${packed.length} vs ${plain.length}`);
  assert.deepEqual(unpackList(packed), list);
});
test("a list of megabytes packs and unpacks (no stack overflow in the encoder)", () => {
  const list = [{ blob: Array.from({ length: 200000 }, (_, i) => String.fromCharCode(33 + (i * 7919) % 90)).join("") }, ...sample(5000)];
  assert.equal(JSON.stringify(unpackList(packList(list))).length, JSON.stringify(list).length);
});
test("lists stored by earlier versions as plain JSON still load", () => {
  assert.deepEqual(unpackList(JSON.stringify([{ id: 1 }])), [{ id: 1 }]);
});
test("missing, damaged or non-list text reads as an empty list and never throws", () => {
  for (const bad of [null, undefined, "", "{not json", "z1:@@@@", "z1:", JSON.stringify({ a: 1 }), "z1:" + btoa("not zlib")]) assert.deepEqual(unpackList(bad), []);
});
