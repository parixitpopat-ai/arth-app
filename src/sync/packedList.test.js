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

test("the same big photo on two records is stored once and comes back identical on both", () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const photo = "data:image/jpeg;base64," + Array.from({ length: 160000 }, () => ALPHA[Math.floor(rnd() * 64)]).join("");   // 160 KB that does not compress, beyond deflate's 32 KB window
  const list = [{ id: "s1", snapshot: { bills: [{ id: "b", imageBase64: photo }], txns: [{ id: "t", imageBase64: photo, note: "x" }, { id: "u", imageBase64: "" }] } }];
  const packed = packList(list);
  assert.ok(packed.startsWith("z2:"));
  const single = packList([{ id: "s1", snapshot: { bills: [{ id: "b", imageBase64: photo }] } }]);
  assert.ok(packed.length < single.length * 1.05, `two copies cost ${packed.length} vs one ${single.length}`);
  assert.deepEqual(unpackList(packed), list);
});
test("a real string that starts with the marker character survives, and a list with no repeats keeps the plain format", () => {
  const big = "\u0001" + "q".repeat(5000);
  const list = [{ a: big, b: big, c: "\u0001\u0001x", d: "\u00012" }];
  assert.deepEqual(unpackList(packList(list)), list);
  assert.ok(packList([{ a: "x" }]).startsWith("z1:"));
});
