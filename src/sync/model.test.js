// Seeded randomised two-device model test. Whatever the interleaving of edits, restarts, offline spells,
// rejected writes, lost replies, time passing and conflict choices, (I1) no transaction any device ever created may
// be missing from every device, the cloud and every verified backup, and (I2) cloud tokens only ever advance.
// The event log is hashed: running the same seed twice must produce the identical hash.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import * as S from "./scenarios.js";
import { lostIds } from "./testing/sim.js";

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function runModel(seed, steps = 90) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)];
  const kit = S.makeKit("new"); kit.seed(0);
  const devs = [kit.mk("A"), kit.mk("B")];
  for (const d of devs) { await d.start(); await d.settle(100); }
  const log = []; const violations = [];
  const check = (what) => {
    const lost = lostIds(devs, kit.cloud); if (lost.length) violations.push(`${what}: lost ${lost.join(",")}`);
    const toks = kit.cloud.log.filter(l => l.outcome === "applied").map(l => l.token);
    for (let i = 1; i < toks.length; i++) if (!(toks[i] > toks[i - 1])) { violations.push(`${what}: token did not advance`); break; }
  };
  for (let i = 0; i < steps; i++) {
    const d = pick(devs); const roll = r(); let act;
    if (roll < 0.38) { act = `add ${d.name} ${d.addTxn("m")}`; await d.settle(0); }
    else if (roll < 0.58) { const ms = pick([200, 2000, 20000, 180000, 900000]); act = `time ${ms}`; for (const x of devs) await x.settle(ms); }
    else if (roll < 0.66) { act = `reload ${d.name}`; await d.reload(); await d.settle(0); }
    else if (roll < 0.72) { const off = kit.cloud.faults.offlineDevices; if (off.has(d.name)) { off.delete(d.name); act = `online ${d.name}`; } else { off.add(d.name); act = `offline ${d.name}`; } }
    else if (roll < 0.77) { kit.cloud.faults.rejectNext = 1 + Math.floor(r() * 2); act = "reject"; }
    else if (roll < 0.82) { kit.cloud.faults.dropReplyNext = 1; act = "droplost"; }
    else if (roll < 0.90) { act = `syncNow ${d.name}`; await d.engine.syncNow(); await d.settle(0); }
    else if (roll < 0.94) { act = `visible ${d.name}`; await d.engine.onVisible(); await d.settle(0); }
    else if (d.status().kind === "conflict") { const c = pick(["keep-local", "use-cloud", "later"]); act = `resolve ${d.name} ${c}`; const o = await d.engine.resolveConflict(c); act += ` ->${o.outcome}`; await d.settle(0); }
    else { act = "noop"; }
    log.push(act); check(`step ${i} (${act})`);
  }
  // Heal the world and require convergence.
  kit.cloud.faults.offline = false; kit.cloud.faults.offlineDevices.clear(); kit.cloud.faults.rejectNext = 0; kit.cloud.faults.dropReplyNext = 0;
  for (let round = 0; round < 8; round++) {
    for (const d of devs) {
      if (d.status().kind === "conflict") { log.push(`final resolve ${d.name}`); await d.engine.resolveConflict(d.name === "A" ? "keep-local" : "use-cloud"); }
      await d.engine.syncNow(); await d.settle(400000);
    }
  }
  check("final");
  const kinds = devs.map(d => d.status().kind);
  const ids = devs.map(d => d.ids().join(","));
  const cloudIds = (kit.cloud.rows.get(S.USER)?.snapshot.txns || []).map(t => String(t.id)).sort().join(",");
  const converged = kinds.every(k => k === "synced" || k === "sent") && ids[0] === ids[1] && ids[0] === cloudIds;
  return { violations, hash: crypto.createHash("sha256").update(log.join("\n") + "|" + cloudIds + "|" + kinds.join()).digest("hex"), converged, kinds, steps: log.length, ids, cloudIds };
}

for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
  test(`model seed ${seed}: no transaction is ever lost, tokens advance, devices converge after healing, and a re-run is identical`, async () => {
    const a = await runModel(seed);
    assert.deepEqual(a.violations, []);
    assert.equal(a.converged, true, `did not converge: ${JSON.stringify({ kinds: a.kinds, ids: a.ids, cloud: a.cloudIds })}`);
    const b = await runModel(seed);
    assert.equal(b.hash, a.hash, "same seed, different event log");
  });
}
