import test from "node:test";
import assert from "node:assert/strict";
import { readBillFromImage, shrinkForBill } from "./ocrBill.js";

const file = (size = 1000, type = "image/jpeg") => ({ size, type });
const text = "CONSUMERID BILL DATE DUE DATE\n70012345 16/11/2026 30/11/2026\nNET PAYABLE\n5904\nRupees Five Nine Zero Four Only";
const worker = (t = text) => ({ recognize: async () => ({ data: { text: t } }), setParameters: async () => {}, terminate: async () => {} });
const opts = (over = {}) => ({ baseUrl: "http://x/", makeWorker: async () => worker(), sizeOf: async () => ({ width: 2000, height: 1500 }), shrink: async f => f, ...over });

test("a normal photo is read as it is", async () => {
  const r = await readBillFromImage(file(), opts());
  assert.equal(r.ok, true); assert.equal(r.amount, 5904);
});
test("a 50 megapixel camera photo is shrunk first and then read, not refused", async () => {
  let shrunk = false;
  const r = await readBillFromImage(file(9_000_000), opts({ sizeOf: async f => (f.shrunk ? { width: 2600, height: 1950 } : { width: 8160, height: 6120 }), shrink: async f => { shrunk = true; return { ...f, shrunk: true, size: 900_000 }; } }));
  assert.equal(shrunk, true); assert.equal(r.ok, true);
});
test("shrinkForBill leaves a small picture alone", async () => {
  const f = file(500_000);
  assert.equal(await shrinkForBill(f, { width: 1500, height: 2000 }), f);
});
test("not a picture type is declined with a reason", async () => {
  const r = await readBillFromImage(file(1000, "application/pdf"), opts());
  assert.deepEqual([r.ok, r.reason], [false, "type"]);
});
test("a failure of the engine says what failed (no personal data, short)", async () => {
  const r = await readBillFromImage(file(), opts({ makeWorker: async () => { throw new Error("wasm out of memory"); } }));
  assert.equal(r.ok, false); assert.equal(r.reason, "engine"); assert.match(r.detail, /wasm out of memory/);
});
test("a failure while shrinking is reported as such", async () => {
  const r = await readBillFromImage(file(), opts({ shrink: async () => { throw new Error("bitmap failed"); } }));
  assert.equal(r.reason, "shrink"); assert.match(r.detail, /bitmap failed/);
});
test("the reader never returns the name or address from the bill", async () => {
  const r = await readBillFromImage(file(), opts({ makeWorker: async () => worker(text + "\nMR SAMPLE OWNER\n12 EXAMPLE ROAD") }));
  assert.ok(!JSON.stringify(r).match(/SAMPLE|EXAMPLE/));
});
