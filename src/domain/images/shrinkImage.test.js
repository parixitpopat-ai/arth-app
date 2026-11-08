import { test } from "node:test";
import assert from "node:assert/strict";
import { targetSize, isShrinkable, shrinkDataUrl, shrinkAllPhotos, listPhotos } from "./shrinkImage.js";

const big = (mime = "jpeg", n = 120000) => `data:image/${mime};base64,` + "A".repeat(n);
const small = `data:image/jpeg;base64,${"A".repeat(2000)}`;
const half = async url => `data:image/jpeg;base64,${"B".repeat(Math.floor(url.length / 4))}`;   // an encoder that returns a quarter of the size

test("targetSize keeps the aspect ratio, never enlarges, and rounds sensibly", () => {
  assert.deepEqual(targetSize(4000, 3000, 1600), { width: 1600, height: 1200, scaled: true });
  assert.deepEqual(targetSize(3000, 4000, 1600), { width: 1200, height: 1600, scaled: true });
  assert.deepEqual(targetSize(800, 600, 1600), { width: 800, height: 600, scaled: false });
  assert.deepEqual(targetSize(1600, 1600, 1600), { width: 1600, height: 1600, scaled: false });
  assert.ok(targetSize(10000, 1, 1600).height >= 1);
});

test("only photo data URLs are touched; documents, small photos and other types are left exactly as they are", async () => {
  let calls = 0; const encode = async u => { calls++; return half(u); };
  for (const keep of [small, "data:application/pdf;base64," + "A".repeat(200000), big("gif"), "", null, undefined, 42, "https://x/y.jpg"]) {
    const r = await shrinkDataUrl(keep, { encode }); assert.equal(r.dataUrl, keep); assert.equal(r.changed, false);
  }
  assert.equal(calls, 0, "the encoder was never asked about them");
  assert.equal(isShrinkable(big("png")), true); assert.equal(isShrinkable(big("webp")), true); assert.equal(isShrinkable(big("gif")), false);
});

test("a photo is replaced only when the result is clearly smaller; any failure keeps the original", async () => {
  const photo = big("png");
  const ok = await shrinkDataUrl(photo, { encode: half });
  assert.equal(ok.changed, true); assert.ok(ok.after < ok.before * 0.9); assert.match(ok.dataUrl, /^data:image\/jpeg;base64,/);
  assert.equal((await shrinkDataUrl(photo, { encode: async u => u.replace("png", "jpeg") })).changed, false, "not smaller: kept");
  assert.equal((await shrinkDataUrl(photo, { encode: async () => { throw new Error("decode failed"); } })).dataUrl, photo, "failure: kept");
  assert.equal((await shrinkDataUrl(photo, { encode: async () => "not a data url" })).dataUrl, photo, "garbage: kept");
  assert.equal((await shrinkDataUrl(photo, { encode: async () => `data:image/png;base64,${"A".repeat(10)}` })).dataUrl, photo, "wrong type back: kept");
});

test("shrinkAllPhotos: every record's photos, shared ones once, input untouched, everything else identical", async () => {
  const p1 = big("jpeg", 150000), p2 = big("png", 200000), pay = big("jpeg", 90000);
  const input = {
    txns: [{ id: "t1", amount: 5, imageBase64: p1, paymentImageBase64: pay }, { id: "t2", imageBase64: "" }, { id: "t3", imageBase64: p1 }],
    bills: [{ id: "b1", imageBase64: p1, paymentImageBase64: pay, name: "Power" }, { id: "b2", imageBase64: p2 }],
    billerAccounts: [{ id: "a1", documents: [{ id: "d1", name: "x.pdf", dataUrl: "data:application/pdf;base64,AAAA" }, { id: "d2", dataUrl: p2 }] }, { id: "a2" }],
  };
  const frozen = JSON.stringify(input); let encodes = 0;
  const out = await shrinkAllPhotos(input, { encode: async u => { encodes++; return half(u); } });
  assert.equal(JSON.stringify(input), frozen, "input not mutated");
  assert.equal(encodes, 3, "three different photos, each encoded once");
  assert.equal(out.photos, 7); assert.equal(out.changed, 7);
  assert.ok(out.after < out.before / 3);
  assert.equal(out.txns[0].imageBase64, out.txns[2].imageBase64, "the same photo stays the same on both records");
  assert.equal(out.txns[1], input.txns[1], "records without photos are the same objects");
  assert.equal(out.txns[0].amount, 5); assert.equal(out.bills[0].name, "Power");
  assert.equal(out.billerAccounts[0].documents[0].dataUrl, "data:application/pdf;base64,AAAA", "a PDF is not a photo");
  assert.notEqual(out.billerAccounts[0].documents[1].dataUrl, p2);
  assert.equal(out.billerAccounts[1], input.billerAccounts[1]);
});

test("shrinkAllPhotos on data with no photos changes nothing and reports zero", async () => {
  const input = { txns: [{ id: "a" }], bills: [], billerAccounts: [] };
  const out = await shrinkAllPhotos(input, { encode: half });
  assert.equal(out.photos, 0); assert.equal(out.changed, 0); assert.equal(out.txns[0], input.txns[0]);
});

test("listPhotos counts photos where they are", () => {
  const l = listPhotos({ txns: [{ id: "t", imageBase64: big() }, { id: "u", imageBase64: "" }], bills: [{ id: "b", paymentImageBase64: big() }], billerAccounts: [{ id: "a", documents: [{ dataUrl: big("png") }] }] });
  assert.deepEqual(l.map(x => x.where), ["txns", "bills", "billerAccounts"]);
});

import { applyReplacements } from "./shrinkImage.js";
test("applyReplacements swaps only photos that were shrunk, on the data as it is now", async () => {
  const p1 = big("jpeg", 150000), later = big("png", 130000);
  const before = { txns: [{ id: "t1", imageBase64: p1 }], bills: [], billerAccounts: [] };
  const res = await shrinkAllPhotos(before, { encode: half });
  const now = { txns: [{ id: "t1", imageBase64: p1, amount: 9 }, { id: "t9", imageBase64: later }], bills: [{ id: "b", imageBase64: p1 }], billerAccounts: [] };
  const out = applyReplacements(now, res.replacements);
  assert.notEqual(out.txns[0].imageBase64, p1); assert.equal(out.txns[0].amount, 9);
  assert.equal(out.txns[1].imageBase64, later, "a photo added after the preview is untouched");
  assert.notEqual(out.bills[0].imageBase64, p1, "the same photo elsewhere is swapped too");
  assert.equal(applyReplacements(now, new Map()).txns[1], now.txns[1]);
});
