// src/sync/recoverableExport.js
//
// The file fallback for when browser storage cannot hold a safety backup (SYNC-SAFETY-004). A downloaded file cannot be
// verified by the browser, so a file only counts after the person selects it again and it is checked against the data about
// to be replaced: right format, digest matches, every record of every list present. The envelope keeps `snapshot` at the top
// level so Arth's existing "Restore backup" accepts the file unchanged.

import { digestSnapshot, txnIdsOf } from "./digest.js";
import { listSummary, sameRecords, describeMissing } from "./snapshotIntegrity.js";

export const EXPORT_KIND = "sync-safety-backup";

export async function buildRecoverableExport(snapshot, { reason, now = () => Date.now() }) {
  const counts = Object.fromEntries(Object.entries(listSummary(snapshot)).map(([k, v]) => [k, v.count]));
  return {
    app: "Arth", backupType: EXPORT_KIND, kind: EXPORT_KIND, formatVersion: 1,
    exportedAt: new Date(now()).toISOString(), reason,
    digest: await digestSnapshot(snapshot), txnCount: txnIdsOf(snapshot).length, counts,
    snapshot,
  };
}

/** @returns {Promise<{ok:true,digest:string,txnCount:number}|{ok:false,error:string}>} */
export async function verifyRecoverableExport(parsed, expectedSnapshot) {
  try {
    if (!parsed || typeof parsed !== "object" || parsed.kind !== EXPORT_KIND || !parsed.snapshot || typeof parsed.snapshot !== "object") return { ok: false, error: "this is not an Arth sync backup file" };
    const expected = await digestSnapshot(expectedSnapshot);
    const actual = await digestSnapshot(parsed.snapshot);
    if (parsed.digest !== actual) return { ok: false, error: "the file is damaged (its checksum does not match its contents)" };
    if (actual !== expected) return { ok: false, error: "this file is a backup of different data than the data about to be replaced" };
    const same = sameRecords(parsed.snapshot, expectedSnapshot);
    if (!same.ok) return { ok: false, error: `the file is missing records (${describeMissing([...same.missingInB, ...same.missingInA])})` };
    return { ok: true, digest: actual, txnCount: txnIdsOf(parsed.snapshot).length };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}
