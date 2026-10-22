// Read-back overhead of the sync engine on realistic SYNTHETIC snapshots (SYNC-SAFETY-004). Node only; loopback to the local fake server.
// Measures what runs on the device (JSON, digest, integrity checks, safety backup) and payload sizes; network time on a phone is
// ESTIMATED from stated link profiles, not measured. Usage: node tools/sync-sim/perf.mjs [--json out.json]
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { startFakeSupabase } from "./fakeSupabase.mjs";
import { digestSnapshot, stableStringify } from "../../src/sync/digest.js";
import { missingFrom, sameRecords, danglingReferences } from "../../src/sync/snapshotIntegrity.js";
import { differences } from "../../src/sync/differences.js";
import { createSafetyBackup } from "../../src/sync/safetyBackup.js";
import { createMemoryStorage } from "../../src/sync/testing/sim.js";

// Deterministic pseudo-random so every run builds identical data.
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const b64 = n => { const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; let s = ""; for (let i = 0; i < n; i++) s += chars[(rnd() * 64) | 0]; return s; };

function snapshot({ txns, images = 0, imageKB = 150 }) {
  const t = Array.from({ length: txns }, (_, i) => ({
    id: `t${i}`, type: "expense", desc: `Synthetic expense number ${i}`, merchant: "SYN Merchant", date: `2026-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`,
    amount: 100 + (i % 5000), catId: "food", catIds: ["food"], subId: null, accId: "syn_bank", note: i % 7 ? "" : "synthetic note", people: {}, lineItems: i % 11 === 0 ? [{ id: `li${i}`, label: "item", qty: 1, unitPrice: 50 }] : null,
  }));
  for (let k = 0; k < images; k++) t[(k * 7) % t.length].paymentImageBase64 = "data:image/jpeg;base64," + b64(imageKB * 1024 * 4 / 3);   // base64 of an imageKB JPEG
  return {
    version: 1, savedAt: "x", masterUserSetupComplete: true,
    accounts: [{ id: "syn_bank", name: "SYN Bank", type: "bank", balance: 100000 }], txns: t,
    bills: Array.from({ length: Math.max(10, txns / 20 | 0) }, (_, i) => ({ id: `b${i}`, name: `Bill ${i}`, amount: 500 + i, status: i % 3 ? "paid" : "unpaid", paidByTxnId: i % 3 ? `t${i}` : null })),
    contributions: Array.from({ length: Math.max(10, txns / 20 | 0) }, (_, i) => ({ id: `c${i}`, obligationType: "bill", obligationId: `b${i}`, txnId: `t${i}`, amount: 500 + i })),
    people: [{ id: "__me__", isMe: true }], planNudges: {}, monthOverrides: {},
  };
}
const CASES = [
  { name: "typical year, no images", cfg: { txns: 1200 } },
  { name: "heavy history, no images", cfg: { txns: 8000 } },
  { name: "500 txns + 10 receipt photos (150 KB)", cfg: { txns: 500, images: 10, imageKB: 150 } },
  { name: "500 txns + 25 receipt photos (150 KB)", cfg: { txns: 500, images: 25, imageKB: 150 } },
  { name: "1000 txns + 60 receipt photos (150 KB)", cfg: { txns: 1000, images: 60, imageKB: 150 } },
];
const LINKS = [
  { name: "4G good (10 up / 25 down Mbps, 60 ms RTT)", up: 10e6, down: 25e6, rtt: 60 },
  { name: "4G poor (2 up / 5 down Mbps, 150 ms RTT)", up: 2e6, down: 5e6, rtt: 150 },
  { name: "3G (0.4 up / 1 down Mbps, 300 ms RTT)", up: 0.4e6, down: 1e6, rtt: 300 },
];
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
async function time(fn, n = 5) { const t = []; for (let i = 0; i < n; i++) { const s = performance.now(); await fn(); t.push(performance.now() - s); } return med(t); }
const mb = b => +(b / 1048576).toFixed(2), ms = x => +x.toFixed(1);

const fake = await startFakeSupabase({ port: 54398, users: { tok: { id: "u1" } } });
const H = { authorization: "Bearer tok", "content-type": "application/json" }, BASE = "http://127.0.0.1:54398/rest/v1/arth_snapshots";
const out = [];
for (const c of CASES) {
  seed = 12345;
  const snap = snapshot(c.cfg);
  const text = JSON.stringify(snap), bytes = Buffer.byteLength(text);
  const row = { case: c.name, txns: snap.txns.length, images: c.cfg.images || 0, jsonMB: mb(bytes) };
  row.stringifyMs = ms(await time(() => JSON.stringify(snap)));
  row.digestMs = ms(await time(() => digestSnapshot(snap)));
  row.parseMs = ms(await time(() => JSON.parse(text)));
  const copy = JSON.parse(text);
  row.integrityMs = ms(await time(() => { missingFrom(copy, snap); sameRecords(copy, snap); danglingReferences(copy); }));
  row.differencesMs = ms(await time(() => differences(copy, snap), 3));
  row.safetyBackupMs = ms(await time(async () => { const s = createMemoryStorage(); await createSafetyBackup(s, { reason: "perf", snapshot: snap, genId: () => "g" }); }, 3));
  // loopback: one write (PATCH) then the read-back (GET), as the engine does after every push
  fake.rows.clear(); fake.seed("u1", { txns: [] }, "2026-01-01T00:00:00.000Z");
  let token = "2026-01-01T00:00:00.000000+00:00";
  const put = await time(async () => { const next = new Date(Date.parse(token) + 1000).toISOString(); const r = await fetch(`${BASE}?user_id=eq.u1&updated_at=eq.${encodeURIComponent(token)}`, { method: "PATCH", headers: H, body: JSON.stringify({ snapshot: snap, updated_at: next }) }); token = (await r.json())[0].updated_at; }, 3);
  const get = await time(async () => { const r = await fetch(`${BASE}?user_id=eq.u1&select=snapshot,updated_at`, { headers: H }); const j = await r.json(); return j.length; }, 3);
  row.loopbackWriteMs = ms(put); row.loopbackReadBackMs = ms(get);
  row.estimates = LINKS.map(l => ({
    link: l.name,
    writeS: +(bytes * 8 / l.up + l.rtt / 1000).toFixed(2),
    readBackS: +(bytes * 8 / l.down + l.rtt / 1000).toFixed(2),
  })).map(e => ({ ...e, withVerifyS: +(e.writeS + e.readBackS).toFixed(2), extraPct: +(100 * e.readBackS / e.writeS).toFixed(0) }));
  row.dataPerWriteMB = { writeOnly: mb(bytes), withReadBack: mb(bytes * 2) };
  out.push(row);
  console.log(JSON.stringify({ case: row.case, jsonMB: row.jsonMB, digestMs: row.digestMs, integrityMs: row.integrityMs, backupMs: row.safetyBackupMs, loopbackWriteMs: row.loopbackWriteMs, loopbackReadBackMs: row.loopbackReadBackMs, est3G: row.estimates[2] }));
}
await fake.close();
const rec = { at: new Date().toISOString(), node: process.version, note: "device-side timings are measured on this machine (loopback); phone network times are estimates from stated link profiles", links: LINKS, rows: out };
const argi = process.argv.indexOf("--json"); if (argi > 0) fs.writeFileSync(process.argv[argi + 1], JSON.stringify(rec, null, 2));
console.log("done");
