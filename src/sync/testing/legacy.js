// src/sync/testing/legacy.js — REFERENCE MODEL of the sync rules that shipped before SYNC-SAFETY-002, ported from
// App.jsx (pullCloudSnapshot / pushCloudSnapshot / auto-push effect / Sync Now) as documented in SYNC-SAFETY-001.
// Used ONLY as a negative control: each regression scenario must show the loss here and no loss in the new engine,
// proving the scenario really catches the bug. It is a model, not the original code; the browser harness
// (tools/sync-sim) is the evidence against the real application.

import { txnIdsOf } from "../digest.js";
import { createMemoryStorage } from "./sim.js";
import { SAFETY_BACKUPS_KEY } from "../safetyBackup.js";

export function createLegacyDevice({ name, userId = "synthetic-user-0001", clock, cloud: cloudRoot, storage = createMemoryStorage() }) {
  const cloud = cloudRoot.client ? cloudRoot.client(name) : cloudRoot;
  let data = null, lastRebuild = clock.now(), conflictPending = false, hydrated = false, pushTimer = null, seq = 0, busy = null;
  const mine = new Set(); const created = [];
  const KEY = "arth_data", preSyncKey = "legacy_pre_sync";
  const persist = () => storage.setItem(KEY, JSON.stringify(data));
  const load = () => { const raw = storage.getItem(KEY); data = raw ? JSON.parse(raw) : { txns: [], accounts: [{ id: "syn_bank", name: "SYN Bank", type: "bank", balance: 100000 }], bills: [], people: [], planNudges: {} }; };
  const snapshot = () => ({ version: 1, savedAt: new Date(lastRebuild).toISOString(), ...JSON.parse(JSON.stringify(data)) });
  const setTimer = (fn, ms) => { const id = clock.setTimer(() => { mine.delete(id); fn(); }, ms); mine.add(id); return id; };

  // The old pre-sync backup: skipped when the previous one is under 2 minutes old; the persisted list is the first 3 entries,
  // and an "auto" backup made at boot sits ahead of pre-sync entries (so a later pre-sync entry is not persisted).
  function preSyncBackup(local) {
    const list = JSON.parse(storage.getItem(preSyncKey) || "[]");
    const last = list.filter(b => b.type === "pre-sync").slice(-1)[0];
    if (last && clock.now() - last.at < 2 * 60 * 1000) return;
    list.push({ type: "pre-sync", at: clock.now(), snapshot: local });
    storage.setItem(preSyncKey, JSON.stringify(list));
    const autoCount = 1;   // the daily auto backup that is already in the list ahead of pre-sync entries
    const persisted = list.slice(0, Math.max(0, 3 - autoCount));
    storage.setItem(SAFETY_BACKUPS_KEY, JSON.stringify(persisted.map((b, i) => ({ id: "legacy" + i, snapshot: b.snapshot }))));
  }
  async function pull(force) {
    let rec; try { rec = await cloud.read(userId); } catch { return; }
    if (rec && rec.snapshot) {
      const local = snapshot();
      preSyncBackup(local);
      const l = Date.parse(local.savedAt), c = Date.parse(rec.snapshot.savedAt);
      if (!force && l && c && l > c + 60000) { conflictPending = true; hydrated = true; return; }
      const { savedAt, syncMeta, ...rest } = rec.snapshot; data = JSON.parse(JSON.stringify(rest)); persist(); lastRebuild = clock.now();
      conflictPending = false; hydrated = true; schedulePush();
    } else {
      try { await cloud.upsert(userId, snapshot()); } catch { /* status text only */ }
      hydrated = true;
    }
  }
  function schedulePush() {
    if (pushTimer != null) clock.clearTimer(pushTimer);
    pushTimer = setTimer(async () => { pushTimer = null; if (!hydrated || conflictPending) return; busy = (async () => { try { await cloud.upsert(userId, snapshot()); } catch { /* old behaviour: status text only */ } })(); await busy; busy = null; }, 900);
  }
  const dev = { name, storage, clock, cloud: cloudRoot, created };
  dev.start = async () => { load(); lastRebuild = clock.now(); hydrated = false; conflictPending = false; await pull(false); };
  dev.reload = async () => { [...mine].forEach(id => clock.clearTimer(id)); mine.clear(); pushTimer = null; await dev.start(); };
  dev.addTxn = (desc, amount = 100) => { const id = `${name}-t${++seq}`; data.txns.push({ id, type: "expense", desc, amount, date: "2026-10-15", catId: "food", catIds: ["food"], accId: "syn_bank", people: {} }); persist(); lastRebuild = clock.now(); created.push(id); schedulePush(); return id; };
  dev.syncNow = async () => { await pull(conflictPending); };   // one tap: forces the pull when a conflict is pending
  dev.settle = async (ms = 1000) => { await clock.advance(ms, async () => { if (busy) await busy; }); };
  dev.engine = { notifyChange() {}, whenIdle: async () => {} };
  dev.ids = () => txnIdsOf(snapshot());
  return dev;
}
