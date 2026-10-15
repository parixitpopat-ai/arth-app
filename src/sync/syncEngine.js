// src/sync/syncEngine.js
//
// Orchestrates sync for one signed-in user (SYNC-SAFETY-002). Everything impure is injected (cloud client,
// storage, clock, timers, id generator, the snapshot getter/applier), so the whole engine is exercised
// deterministically in Node tests with no browser, network or real time.
//
// Guarantees (see the design for the full argument):
//  - Local data is never replaced unless this device is clean (nothing unsynced) or a verified backup of it exists.
//  - A write is a compare-and-swap on the cloud version this device last agreed with; a stale write is refused, never applied.
//  - "Unsynced" is derived from content digests persisted across reloads; a failed or interrupted write is simply retried.
//  - A lost reply is recognised by the write id the cloud row carries, so it is neither duplicated nor forgotten.
//  - After a sync the result is reconciled; a mismatch pauses sync instead of being reported as success.

import { decideSync, SYNC_ACTIONS } from "./decideSync.js";
import { digestSnapshot, summarizeDiff, txnIdsOf } from "./digest.js";
import { createSafetyBackup } from "./safetyBackup.js";
import { loadSyncState, saveSyncState } from "./syncState.js";
import { statusText } from "./statusText.js";
import { hasMeaningfulData } from "../domain/identity/masterUserSetup.js";

export const DEFAULT_BACKOFF_MS = [2000, 5000, 15000, 60000, 300000];
// Default: read the saved copy back after EVERY write (reconciliation is never skipped). Costs one extra download per write;
// a larger value trades that bandwidth for a longer window in which a bad cloud copy would go unnoticed.
export const FULL_VERIFY_EVERY_MS = 0;

/** A token strictly later than the one it replaces, so tokens never repeat in a row's history. */
export function advanceToken(baseToken, nowMs) {
  const base = baseToken ? Date.parse(baseToken) : NaN;
  return new Date(Number.isFinite(base) ? Math.max(nowMs, base + 1) : nowMs).toISOString();
}

const sameMeta = (a, b) => Boolean(a && b) && a.writeId === b.writeId && a.digest === b.digest && a.txnCount === b.txnCount;

export function createSyncEngine({
  userId, deviceId, cloud, storage, getSnapshot, applySnapshot, readLocalAfterApply,
  now = () => Date.now(), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = h => clearTimeout(h),
  genId, onStatus = () => {}, isOnline = () => true,
  debounceMs = 900, backoffMs = DEFAULT_BACKOFF_MS, fullVerifyEveryMs = FULL_VERIFY_EVERY_MS,
}) {
  let running = null, rerun = false, attempt = 0, retryTimer = null, debounceTimer = null, status = { kind: "idle" };
  let lastFullVerifyAt = 0;
  const iso = ms => new Date(ms).toISOString();
  const load = () => loadSyncState(storage, userId);
  const save = st => saveSyncState(storage, st);

  function setStatus(s) { status = s; try { onStatus(s, statusText(s)); } catch { /* a UI callback must never break sync */ } return s; }
  const conflictStatus = st => ({ kind: "conflict", diff: st.conflict?.diff, detail: st.conflict?.type });
  const pausedStatus = st => (st.paused === "token-unreliable" ? { kind: "paused-token" } : { kind: "paused-reconcile", detail: st.lastReconcile?.detail });

  function clearRetry() { if (retryTimer != null) { clearTimer(retryTimer); retryTimer = null; } attempt = 0; }
  function scheduleRetry() {
    if (retryTimer != null) clearTimer(retryTimer);
    const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)];
    attempt += 1;
    retryTimer = setTimer(() => { retryTimer = null; syncOnce("retry"); }, delay);
    return iso(now() + delay);
  }

  function failed(err, dirty) {
    const nextRetryAt = scheduleRetry();
    setStatus({ kind: dirty ? "pending" : "failed", error: String((err && err.message) || err), nextRetryAt });
    return { outcome: "failed", error: String((err && err.message) || err) };
  }

  /** If a previous write's reply was lost, learn from the cloud row whether it landed. */
  function resolvePendingWrite(st, rec) {
    if (!st.pendingWrite) return st;
    const landed = rec && rec.snapshot && rec.snapshot.syncMeta && rec.snapshot.syncMeta.writeId === st.pendingWrite.writeId;
    return save(landed
      ? { ...st, baseToken: rec.token, baseDigest: st.pendingWrite.digest, pendingWrite: null }
      : { ...st, pendingWrite: null });
  }

  const withBackup = (st, bk, reason) => ({ ...st, lastBackup: { id: bk.id, at: bk.at, txnCount: bk.txnCount, reason } });

  async function backupOrBlock(snapshot, reason) {
    const bk = await createSafetyBackup(storage, { reason, snapshot, now, genId });
    if (!bk.ok) setStatus({ kind: "blocked-backup", error: bk.error });
    return bk;
  }

  /** Write local content to the cloud as a compare-and-swap (or first insert). */
  async function pushLocal(st, local, localDigest, expectedToken, trigger) {
    const writeId = genId();
    const meta = { deviceId, writeId, digest: localDigest, txnCount: txnIdsOf(local).length };
    const sent = { ...local, syncMeta: meta };
    st = save({ ...st, pendingWrite: { writeId, digest: localDigest } });     // persisted BEFORE sending
    const nextToken = advanceToken(expectedToken, now());
    let res;
    try {
      res = expectedToken ? await cloud.swap(userId, expectedToken, sent, nextToken) : await cloud.insert(userId, sent, nextToken);
    } catch (e) {
      return { st, result: failed(e, true) };      // pendingWrite stays: the next cycle works out whether it landed
    }
    if (res.conflict) { st = save({ ...st, pendingWrite: null }); return { st, result: { outcome: "conflict-retry" } }; }
    if (expectedToken && res.token === expectedToken) {
      st = save({ ...st, pendingWrite: null, paused: "token-unreliable" });
      setStatus(pausedStatus(st));
      return { st, result: { outcome: "paused" } };
    }
    st = save({ ...st, baseToken: res.token, baseDigest: localDigest, pendingWrite: null });
    // Reconcile: the echoed write metadata when the backend gives it; otherwise a full read-back (every write by default, or at most every fullVerifyEveryMs).
    let verified = null, detail = "";
    if (res.meta !== undefined) { verified = sameMeta(res.meta, meta); if (!verified) detail = "write metadata differs"; }
    else if (trigger === "manual" || trigger === "resolve" || now() - lastFullVerifyAt >= fullVerifyEveryMs) {
      try {
        const back = await cloud.read(userId);
        if (back) {
          const backDigest = await digestSnapshot(back.snapshot);
          verified = backDigest === localDigest && txnIdsOf(back.snapshot).length === meta.txnCount;
          if (!verified) detail = `cloud has ${txnIdsOf(back.snapshot).length} transactions, sent ${meta.txnCount}`;
        }
        lastFullVerifyAt = now();
      } catch { verified = null; }
    }
    const reconcile = { at: iso(now()), ok: verified, localCount: meta.txnCount, cloudCount: verified === false ? undefined : meta.txnCount, detail };
    if (verified === false) {
      st = save({ ...st, paused: "reconcile-mismatch", lastReconcile: reconcile });
      setStatus(pausedStatus(st));
      return { st, result: { outcome: "paused" } };
    }
    st = save({ ...st, lastReconcile: reconcile, ...(verified ? { lastVerifiedAt: iso(now()) } : {}) });
    clearRetry();
    setStatus(verified ? { kind: "synced", verifiedAt: st.lastVerifiedAt } : { kind: "sent" });
    return { st, result: { outcome: "pushed", verified } };
  }

  /** Replace this device's data with the cloud copy, after a verified backup of what is replaced. */
  async function takeCloud(st, local, rec, cloudDigest, reason) {
    const bk = await backupOrBlock(local, reason);
    if (!bk.ok) return { st, result: { outcome: "blocked-backup", error: bk.error } };
    st = withBackup(st, bk, reason);
    await applySnapshot(rec.snapshot);
    const after = await readLocalAfterApply();
    const want = txnIdsOf(rec.snapshot), got = txnIdsOf(after);
    const ok = want.length === got.length && want.every((id, i) => id === got[i]);
    const reconcile = { at: iso(now()), ok, localCount: got.length, cloudCount: want.length, detail: ok ? "" : `applied ${got.length} of ${want.length} transactions` };
    // The device's own (possibly re-normalised) content after adoption is what counts as "in sync", so normalisation never makes a
    // freshly adopted copy look changed (which would bounce a needless write between devices).
    const afterDigest = ok ? await digestSnapshot(after) : cloudDigest;
    st = save({ ...st, baseToken: rec.token, baseDigest: afterDigest, pendingWrite: null, conflict: null, lastReconcile: reconcile, ...(ok ? { lastVerifiedAt: iso(now()) } : { paused: "reconcile-mismatch" }) });
    if (!ok) { setStatus(pausedStatus(st)); return { st, result: { outcome: "paused" } }; }
    clearRetry();
    setStatus({ kind: "synced", verifiedAt: st.lastVerifiedAt });
    return { st, result: { outcome: "pulled", backupId: bk.id } };
  }

  async function runCycle(trigger, depth = 0) {
    let st = load();
    if (st.paused) { setStatus(pausedStatus(st)); return { outcome: "paused" }; }
    if (st.conflict) { setStatus(conflictStatus(st)); return { outcome: "conflict" }; }
    if (!isOnline()) return failed(new Error("offline"), true);

    const local = getSnapshot();
    let localDigest;
    try { localDigest = await digestSnapshot(local); } catch (e) { return failed(e, true); }   // unknown content is never treated as synced

    // Fast path for ordinary edits: no full download; the conditional write itself detects a stale base.
    if (trigger === "change" && st.baseToken && !st.pendingWrite) {
      if (localDigest === st.baseDigest) return { outcome: "noop" };
      const r = await pushLocal(st, local, localDigest, st.baseToken, trigger);
      if (r.result.outcome !== "conflict-retry") return r.result;
      st = r.st;
    }

    let rec;
    try { rec = await cloud.read(userId); } catch (e) { return failed(e, st.baseDigest ? localDigest !== st.baseDigest : true); }
    st = resolvePendingWrite(st, rec);
    const cloudDigest = rec ? await digestSnapshot(rec.snapshot) : null;
    const d = decideSync({
      networkOk: true, hasBase: Boolean(st.baseToken), baseToken: st.baseToken, baseDigest: st.baseDigest,
      localDigest, localMeaningful: hasMeaningfulData(local),
      cloud: rec ? { token: rec.token, digest: cloudDigest, meaningful: hasMeaningfulData(rec.snapshot) } : null,
    });

    switch (d.action) {
      case SYNC_ACTIONS.NOOP: {
        st = save({ ...st, ...(rec ? { lastVerifiedAt: iso(now()) } : {}) });
        clearRetry();
        setStatus(rec ? { kind: "synced", verifiedAt: st.lastVerifiedAt } : { kind: "idle" });
        return { outcome: "noop" };
      }
      case SYNC_ACTIONS.ADOPT_BASE: {
        st = save({ ...st, baseToken: rec.token, baseDigest: localDigest, lastVerifiedAt: iso(now()) });
        clearRetry();
        setStatus({ kind: "synced", verifiedAt: st.lastVerifiedAt });
        return { outcome: "adopted" };
      }
      case SYNC_ACTIONS.PUSH:
      case SYNC_ACTIONS.INSERT: {
        let r = await pushLocal(st, local, localDigest, d.action === SYNC_ACTIONS.PUSH ? d.expectedToken : null, trigger);
        if (r.result.outcome === "conflict-retry") {       // someone wrote between our read and our write: decide again from fresh state
          if (depth >= 3) return failed(new Error("the cloud kept changing during sync"), true);
          setStatus({ kind: "syncing" });
          return runCycle("retry-after-conflict", depth + 1);
        }
        return r.result;
      }
      case SYNC_ACTIONS.FAST_FORWARD:
        return (await takeCloud(st, local, rec, cloudDigest, "before-fast-forward")).result;
      case SYNC_ACTIONS.CONFLICT: {
        st = save({ ...st, conflict: { type: "diverged", detectedAt: iso(now()), cloudToken: rec.token, reason: d.reason, diff: summarizeDiff(local, rec.snapshot) } });
        setStatus(conflictStatus(st));
        return { outcome: "conflict" };
      }
      default:
        return failed(new Error("cloud unreachable"), d.dirty);
    }
  }

  function syncOnce(trigger) {
    if (running) { rerun = true; return running; }
    running = (async () => {
      try {
        let out, t = trigger;
        do { rerun = false; out = await runCycle(t, 0); t = "change"; } while (rerun);
        return out;
      } catch (e) {
        return failed(e, true);
      } finally { running = null; }
    })();
    return running;
  }

  /** Person's explicit choice for a recorded conflict. Never merges; the replaced side is backed up first. */
  async function resolveConflict(choice) {
    let st = load();
    if (!st.conflict) return { outcome: "none" };
    if (choice === "later") { setStatus(conflictStatus(st)); return { outcome: "conflict" }; }
    if (running) await running;
    const local = getSnapshot();
    let localDigest, rec;
    try { localDigest = await digestSnapshot(local); rec = await cloud.read(userId); } catch (e) { return failed(e, true); }
    if (choice === "keep-local") {
      let base = { ...st, conflict: null };
      if (rec) { const bk = await backupOrBlock(rec.snapshot, "before-keep-local"); if (!bk.ok) return { outcome: "blocked-backup", error: bk.error }; base = withBackup(base, bk, "before-keep-local"); }
      const r = await pushLocal(base, local, localDigest, rec ? rec.token : null, "resolve");
      if (r.result.outcome === "pushed") { save({ ...r.st, conflict: null }); return { outcome: "resolved-keep-local" }; }
      if (r.result.outcome === "conflict-retry") {         // the cloud moved again while deciding: record the new situation, ask again
        let fresh = rec; try { fresh = await cloud.read(userId); } catch { /* keep the earlier copy for the report */ }
        const again = save({ ...load(), conflict: { ...st.conflict, detectedAt: iso(now()), cloudToken: fresh ? fresh.token : null, diff: fresh ? summarizeDiff(local, fresh.snapshot) : st.conflict.diff } });
        setStatus(conflictStatus(again));
        return { outcome: "conflict" };
      }
      save({ ...r.st, conflict: st.conflict }); return r.result;
    }
    if (choice === "use-cloud") {
      if (!rec) return { outcome: "none" };
      const cloudDigest = await digestSnapshot(rec.snapshot);
      const r = await takeCloud({ ...st, conflict: null }, local, rec, cloudDigest, "before-use-cloud");
      if (r.result.outcome === "pulled") return { outcome: "resolved-use-cloud" };
      save({ ...r.st, conflict: st.conflict }); return r.result;
    }
    return { outcome: "none" };
  }

  return {
    boot: () => syncOnce("boot"),
    syncNow: () => syncOnce("manual"),
    notifyChange() { if (debounceTimer != null) clearTimer(debounceTimer); debounceTimer = setTimer(() => { debounceTimer = null; syncOnce("change"); }, debounceMs); },
    onOnline() { clearRetry(); return syncOnce("online"); },
    onVisible() { return syncOnce("visible"); },
    resolveConflict,
    whenIdle: async () => { while (running) await running; },
    getStatus: () => status,
    getState: load,
  };
}
