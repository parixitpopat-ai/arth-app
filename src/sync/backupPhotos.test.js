import { test } from "node:test";
import assert from "node:assert/strict";
import { photoSet, stripSurvivingPhotos, fillOmittedPhotos } from "./backupPhotos.js";
import { createSafetyBackup, readSafetyBackups } from "./safetyBackup.js";
import { createMemoryStorage } from "./testing/sim.js";
import * as S from "./scenarios.js";
import { listSafetyBackups } from "./safetyBackup.js";

const photo = tag => `data:image/jpeg;base64,${tag}${"Q".repeat(5000)}`;
const P1 = photo("one"), P2 = photo("two"), ONLY = photo("only-here");
const data = () => ({
  txns: [{ id: "t1", amount: 5, imageBase64: P1, paymentImageBase64: "" }, { id: "t2", amount: 6, imageBase64: ONLY }, { id: "t3", amount: 7 }],
  bills: [{ id: "b1", imageBase64: P1, paymentImageBase64: P2 }],
  billerAccounts: [{ id: "a1", documents: [{ id: "d1", dataUrl: P2 }, { id: "d2", dataUrl: "data:application/pdf;base64,AAAA" }] }],
  accounts: [{ id: "x" }],
});

test("photos that exist in the surviving data are left out; photos that exist nowhere else are kept", () => {
  const survivor = { txns: [{ id: "t1", imageBase64: P1 }], bills: [{ id: "b1", paymentImageBase64: P2 }] };
  const { snapshot, omitted } = stripSurvivingPhotos(data(), survivor);
  assert.equal(snapshot.txns[0].imageBase64, ""); assert.equal(snapshot.bills[0].imageBase64, ""); assert.equal(snapshot.bills[0].paymentImageBase64, "");
  assert.equal(snapshot.billerAccounts[0].documents[0].dataUrl, "");
  assert.equal(snapshot.txns[1].imageBase64, ONLY, "a photo found nowhere else stays");
  assert.equal(snapshot.billerAccounts[0].documents[1].dataUrl, "data:application/pdf;base64,AAAA", "a short or non-photo value stays");
  assert.equal(snapshot.txns[0].amount, 5); assert.equal(snapshot.accounts[0].id, "x");
  assert.equal(omitted.length, 4);
});
test("nothing to leave out returns the same object; the input is never changed", () => {
  const d = data(), frozen = JSON.stringify(d);
  assert.equal(stripSurvivingPhotos(d, {}).snapshot, d);
  assert.equal(stripSurvivingPhotos(d, null).snapshot, d);
  stripSurvivingPhotos(d, { txns: [{ imageBase64: P1 }] }); assert.equal(JSON.stringify(d), frozen);
});
test("filling puts the photos back exactly, by record, from the data as it is now", () => {
  const original = data(), survivor = data();
  const { snapshot, omitted } = stripSurvivingPhotos(original, survivor);
  const back = fillOmittedPhotos(snapshot, omitted, survivor);
  assert.deepEqual(back.snapshot, original); assert.equal(back.filled, omitted.length); assert.equal(back.missing, 0);
});
test("a photo whose record no longer holds it is counted as missing and the record is otherwise restored", () => {
  const { snapshot, omitted } = stripSurvivingPhotos(data(), data());
  const now = data(); now.txns = now.txns.filter(t => t.id !== "t1"); now.bills[0].imageBase64 = "";
  const back = fillOmittedPhotos(snapshot, omitted, now);
  assert.equal(back.snapshot.txns[0].amount, 5); assert.equal(back.snapshot.txns[0].imageBase64, "");
  assert.ok(back.missing >= 2); assert.ok(back.filled >= 1);
  assert.equal(fillOmittedPhotos(snapshot, null, now).snapshot, snapshot);
});

test("a safety copy taken before a replacement leaves out the photos the replacement keeps, is verified, and is smaller", async () => {
  const s1 = createMemoryStorage(), s2 = createMemoryStorage(); let n = 0;
  const survivor = data();
  const full = await createSafetyBackup(s1, { reason: "before-fast-forward", snapshot: data(), genId: () => `g${++n}` });
  const lean = await createSafetyBackup(s2, { reason: "before-fast-forward", snapshot: data(), survivor, genId: () => `g${++n}` });
  assert.ok(full.ok && lean.ok, lean.error);
  const entry = readSafetyBackups(s2)[0];
  assert.ok(entry.omitted.length >= 1 && entry.snapshot.txns[0].imageBase64 === "");
  assert.ok(s2.getItem("arth_sync_safety_backups").length < s1.getItem("arth_sync_safety_backups").length, "smaller");
  const back = fillOmittedPhotos(entry.snapshot, entry.omitted, survivor);
  assert.deepEqual(back.snapshot.txns, data().txns);
});
test("pinned copies (conflict holds, sign-out, hand-over) are never reduced, even when a survivor is given", async () => {
  const s = createMemoryStorage();
  const r = await createSafetyBackup(s, { reason: "conflict-device-copy", snapshot: data(), survivor: data(), pinned: true, conflictId: "c1", genId: () => "g" });
  assert.ok(r.ok);
  const e = readSafetyBackups(s)[0]; assert.equal(e.omitted, undefined); assert.equal(e.snapshot.txns[0].imageBase64, P1);
});
test("photoSet ignores empty, short and non-data values", () => {
  assert.equal(photoSet({ txns: [{ imageBase64: "" }, { imageBase64: "data:x" }, { imageBase64: P1 }] }).size, 1);
});

test("engine: a clean device that takes the newer cloud copy keeps a verified backup that leaves out the photos the cloud copy holds", async () => {
  const kit = S.makeKit("new");
  const seeded = () => { const d = S.baseData(); d.txns.push({ id: "ph1", type: "expense", amount: 9, date: "2026-10-01", imageBase64: P1 }); return d; };
  const cloudSnap = { version: 1, savedAt: new Date(kit.clock.now()).toISOString(), ...JSON.parse(JSON.stringify(seeded())) };
  kit.cloud.seed(S.USER, cloudSnap, 0);
  const st = createMemoryStorage({ arth_data: JSON.stringify(seeded()) });
  const A = kit.mk("A", st), B = kit.mk("B", createMemoryStorage({ arth_data: JSON.stringify(seeded()) }));
  await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  const bId = B.addTxn("b"); await B.settle(1500);
  const out = await A.poll(); await A.settle(500);
  assert.equal(out.outcome, "pulled"); assert.ok(A.ids().includes(bId));
  const ff = readSafetyBackups(A.storage).find(b => b.reason === "before-fast-forward");
  assert.ok(ff, "a backup was taken first");
  assert.equal(ff.snapshot.txns.find(t => t.id === "ph1").imageBase64, "", "the photo the cloud copy holds was left out");
  assert.ok(ff.omitted.some(o => o.id === "ph1"));
  assert.ok(listSafetyBackups(A.storage).length >= 1);
  assert.equal(A.data().txns.find(t => t.id === "ph1").imageBase64, P1, "the live data still has the photo");
});
