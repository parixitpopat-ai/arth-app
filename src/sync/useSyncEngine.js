// src/sync/useSyncEngine.js
//
// React wiring for the sync engine (SYNC-SAFETY-002), kept out of App.jsx so the monolith only holds the screens' decisions.
// It creates ONE engine per signed-in account, exposes its status, and owns the "recorded conflict" sheet state. It adds no sync
// logic: every decision is in syncEngine.js / decideSync.js. A device that is offline-resumed has no cloud user, so no engine
// exists and nothing can be sent until the server confirms the account (see domain/identity/offlineResume.js).
import { useCallback, useEffect, useRef, useState } from "react";
import { createSyncEngine } from "./syncEngine";
import { createSupabaseCasClient } from "./supabaseCasClient";

const deviceIdOnThisDevice = () => {
  try {
    let d = localStorage.getItem("arth_device_id");
    if (!d) { d = `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`; localStorage.setItem("arth_device_id", d); }
    return d;
  } catch { return "dev_unknown"; }
};

/**
 * @param {object} p
 * @param {{id?:string}|null} p.cloudUser            the CONFIRMED account (null while signed out or offline-resumed)
 * @param {boolean} p.isCloudSyncConfigured
 * @param {object|null} p.supabase                   the Supabase client
 * @param {(snapshot:object)=>void} p.applyCloudSnapshot   replaces local state (the app's own restore path)
 * @param {{current:object|null}} p.cloudSnapshotRef  always the snapshot built from the current local state
 * @param {()=>object} p.getNormalizers              what the restore path does to each list (backups are checked against it)
 * @param {()=>string} p.genId
 * @param {(iso:string)=>void} p.setLastSyncedAt
 */
export function useSyncEngine({ cloudUser, isCloudSyncConfigured, supabase, applyCloudSnapshot, cloudSnapshotRef, getNormalizers, genId, setLastSyncedAt }) {
  const [syncStatus, setSyncStatus] = useState({ kind: "idle" });
  const [syncConflictOpen, setSyncConflictOpen] = useState(true);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [fileBackupRequest, setFileBackupRequest] = useState(null);
  const [syncKit, setSyncKit] = useState(null);
  const latest = useRef({});
  latest.current = { getNormalizers, genId, setLastSyncedAt };

  useEffect(() => {
    if (!cloudUser?.id || !isCloudSyncConfigured || !supabase) { setSyncKit(null); return undefined; }
    const cloud = createSupabaseCasClient(supabase);
    const engine = createSyncEngine({
      userId: cloudUser.id, userEmail: cloudUser.email || "", deviceId: deviceIdOnThisDevice(), cloud, storage: window.localStorage, normalizers: latest.current.getNormalizers(),
      getSnapshot: () => cloudSnapshotRef.current || {},
      applySnapshot: async snapshot => { applyCloudSnapshot(snapshot); },
      // After applying, wait for React to rebuild the snapshot from the new state so the result can be reconciled against the cloud copy.
      readLocalAfterApply: async () => {
        const before = cloudSnapshotRef.current, t0 = Date.now();
        while (cloudSnapshotRef.current === before && Date.now() - t0 < 3000) await new Promise(r => setTimeout(r, 25));
        await new Promise(r => setTimeout(r, 60));
        return cloudSnapshotRef.current || {};
      },
      // Browser storage cannot hold a backup: the person saves a file and selects it again (see SyncBackupFileSheet).
      requestExternalBackup: (snapshot, reason) => new Promise(resolve => setFileBackupRequest({ snapshot, reason, resolve })),
      genId: () => (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : latest.current.genId()),
      isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
      onStatus: (s, t) => { setSyncStatus({ ...s, text: t }); if (s.verifiedAt) latest.current.setLastSyncedAt(s.verifiedAt); },
    });
    setSyncKit({ engine, cloud });
    return () => { engine.stop(); };
  }, [cloudUser?.id, isCloudSyncConfigured, supabase, applyCloudSnapshot, cloudSnapshotRef]);

  const syncEngine = syncKit?.engine || null;
  useEffect(() => { if (!syncEngine) setSyncStatus({ kind: "idle" }); }, [syncEngine]);

  /** The person's choice in the conflict sheet (keep-local | use-cloud | later). */
  const resolveSyncConflict = useCallback(async choice => {
    if (!syncEngine) return;
    setSyncBusy(true); setSyncError("");
    try {
      const out = await syncEngine.resolveConflict(choice);
      if (out.outcome === "conflict") { if (choice === "later") setSyncConflictOpen(false); else setSyncError("The cloud copy changed again while you were choosing. Review the updated difference and choose again."); }
      else if (out.outcome === "blocked-backup" || out.outcome === "failed" || out.outcome === "paused") setSyncError(out.error || "That choice could not be completed, so nothing was replaced.");
    } finally { setSyncBusy(false); }
  }, [syncEngine]);

  return { syncStatus, syncConflictOpen, setSyncConflictOpen, syncBusy, syncError, setSyncError, fileBackupRequest, setFileBackupRequest, syncKit, syncEngine, resolveSyncConflict };
}
