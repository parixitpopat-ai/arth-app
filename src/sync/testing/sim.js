// src/sync/testing/sim.js — deterministic simulation kit for the sync engine. TEST-ONLY, SYNTHETIC DATA ONLY.
// A fake clock with manual timers, an in-memory cloud that can fail in the ways real networks do, and
// "devices" that persist their data to a per-device storage so reload/crash can be simulated exactly.

import { createSyncEngine } from "../syncEngine.js";
import { backedUpTxnIds } from "../safetyBackup.js";
import { txnIdsOf } from "../digest.js";

export function createClock(start = Date.parse("2026-10-15T06:00:00.000Z")) {
  let t = start, seq = 0; const timers = new Map();
  return {
    now: () => t,
    setTimer: (fn, ms) => { const id = ++seq; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimer: id => { timers.delete(id); },
    async advance(ms, settle = async () => {}) {
      const target = t + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, x]) => x.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        timers.delete(due[0]); t = Math.max(t, due[1].at); due[1].fn(); await settle();
      }
      t = target;
    },
    pending: () => timers.size,
    dropAll: () => timers.clear(),
  };
}

/** In-memory stand-in for the cloud row, implementing the CasClient contract with real-world failure modes. */
export function createFakeCloud({ clock, serverAssignsToken = false, tokenPrecisionMs = 1, echoMeta = true } = {}) {
  const rows = new Map(); const log = [];
  const faults = { offline: false, offlineDevices: new Set(), rejectNext: 0, dropReplyNext: 0, corruptNext: false };
  const clone = v => JSON.parse(JSON.stringify(v));
  const round = iso => (tokenPrecisionMs > 1 ? new Date(Math.round(Date.parse(iso) / tokenPrecisionMs) * tokenPrecisionMs).toISOString() : iso);
  const mkToken = clientToken => round(serverAssignsToken ? new Date(clock.now()).toISOString() : clientToken);
  function pre(who) {
    if (faults.offline || (who && faults.offlineDevices.has(who))) throw new Error("network offline");
  }
  function write(userId, snapshot, token, kind, who) {
    pre(who);
    if (faults.rejectNext > 0) { faults.rejectNext--; log.push({ kind, outcome: "rejected" }); throw new Error("HTTP 500 injected"); }
    const stored = clone(snapshot);
    if (faults.corruptNext) { faults.corruptNext = false; if (stored.txns?.length) stored.txns.pop(); }
    const row = { token: mkToken(token), snapshot: stored };
    rows.set(userId, row);
    log.push({ kind, outcome: "applied", token: row.token, ids: txnIdsOf(stored) });
    if (faults.dropReplyNext > 0) { faults.dropReplyNext--; throw new Error("connection reset (reply lost)"); }
    return { ok: true, token: row.token, ...(echoMeta ? { meta: clone(snapshot.syncMeta) } : {}) };
  }
  const api = who => ({
    async read(userId) { pre(who); const r = rows.get(userId); return r ? { token: r.token, snapshot: clone(r.snapshot) } : null; },
    async insert(userId, snapshot, token) { if (rows.has(userId)) { pre(who); return { conflict: true }; } return write(userId, snapshot, token, "insert", who); },
    async swap(userId, expected, snapshot, token) { pre(who); const r = rows.get(userId); if (!r || r.token !== expected) return { conflict: true }; return write(userId, snapshot, token, "swap", who); },
    async upsert(userId, snapshot) { return write(userId, snapshot, new Date(clock.now()).toISOString(), "upsert", who); },   // the OLD unconditional write, used only by the legacy reference model
  });
  return {
    faults, log, rows, ...api(null), client: who => api(who),
    seed(userId, snapshot, ageMs = 0) { const token = new Date(clock.now() - ageMs).toISOString(); rows.set(userId, { token, snapshot: clone({ ...snapshot, savedAt: token }) }); return token; },
  };
}

export function createMemoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial)); const limit = { bytes: Infinity }; const failKeys = new Set();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      if (failKeys.has(k)) { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; }
      const used = [...m.entries()].filter(([kk]) => kk !== k).reduce((n, [, vv]) => n + vv.length, 0);
      if (used + String(v).length > limit.bytes) { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; }
      m.set(k, String(v));
    },
    removeItem: k => { m.delete(k); },
    limit, failKeys, raw: m,
  };
}

const BASE_ACCOUNTS = [{ id: "syn_bank", name: "SYN Bank", type: "bank", balance: 100000 }];

export function createDevice({ name, userId = "synthetic-user-0001", clock, cloud: cloudRoot, storage = createMemoryStorage(), engineOpts = {}, applyTransform = null }) {
  const cloud = cloudRoot.client ? cloudRoot.client(name) : cloudRoot;
  let seq = 0, data = null, engine = null, lastRebuild = clock.now(), idc = 0;
  const KEY = "arth_data";
  const created = []; const dev = { name, storage, clock, cloud: cloudRoot, created };
  const mine = new Set();   // this device's timers only, so one device's restart never cancels another's
  const setTimer = (fn, ms) => { const id = clock.setTimer(() => { mine.delete(id); fn(); }, ms); mine.add(id); return id; };
  const clearTimer = id => { mine.delete(id); clock.clearTimer(id); };
  const persist = () => storage.setItem(KEY, JSON.stringify(data));
  const loadData = () => { const raw = storage.getItem(KEY); data = raw ? JSON.parse(raw) : { txns: [], accounts: BASE_ACCOUNTS.map(a => ({ ...a })), bills: [], people: [], planNudges: {} }; };
  const snapshot = () => ({ version: 1, savedAt: new Date(lastRebuild).toISOString(), ...JSON.parse(JSON.stringify(data)) });
  function boot() {
    loadData(); lastRebuild = clock.now();
    engine = createSyncEngine({
      userId, deviceId: name, cloud, storage, now: clock.now, setTimer, clearTimer,
      genId: () => `${name}-id${++idc}`,
      getSnapshot: snapshot,
      applySnapshot: async s => { const { savedAt, syncMeta, ...rest } = s; data = JSON.parse(JSON.stringify(rest)); if (applyTransform) data = applyTransform(data); persist(); lastRebuild = clock.now(); },
      readLocalAfterApply: async () => snapshot(),
      ...engineOpts,
    });
    dev.engine = engine;
  }
  dev.start = async () => { boot(); await engine.boot(); };
  /** A normal restart (app closed and reopened): in-memory work is lost, persisted data and sync state remain. */
  dev.reload = async () => { if (engine) engine.stop(); [...mine].forEach(id => clock.clearTimer(id)); mine.clear(); boot(); await engine.boot(); };   // a reload kills the old page's engine, like a real tab
  dev.addTxn = (desc, amount = 100) => { const id = `${name}-t${++seq}`; data.txns.push({ id, type: "expense", desc, amount, date: "2026-10-15", catId: "food", catIds: ["food"], accId: "syn_bank", people: {} }); persist(); lastRebuild = clock.now(); created.push(id); engine.notifyChange(); return id; };
  dev.settle = async (ms = 1000) => { await clock.advance(ms, async () => { await engine.whenIdle(); }); await engine.whenIdle(); };
  dev.ids = () => txnIdsOf(snapshot());
  dev.status = () => engine.getStatus();
  dev.state = () => engine.getState();
  dev.data = () => data;
  return dev;
}

/** I1 (no silent loss): every transaction id ever created on any device exists live on a device, in the cloud, or in a verified backup. */
export function lostIds(devices, cloud, userId = "synthetic-user-0001") {
  const live = new Set(devices.flatMap(d => d.ids()));
  const row = cloud.rows.get(userId); (row ? txnIdsOf(row.snapshot) : []).forEach(i => live.add(i));
  devices.forEach(d => backedUpTxnIds(d.storage).forEach(i => live.add(i)));
  return devices.flatMap(d => d.created).filter(id => !live.has(id));
}
