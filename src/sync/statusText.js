// src/sync/statusText.js
//
// Every sync/backup message the person sees is produced here, from verified state only (SYNC-SAFETY-002 §3.9).
// "Saved"/"synced" wording appears only for the kinds that carry a verified outcome.

const when = iso => { try { return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); } catch { return String(iso); } };

export const STATUS_KINDS = Object.freeze(["idle", "syncing", "synced", "sent", "pending", "failed", "conflict", "blocked-backup", "paused-token", "paused-reconcile", "local-only"]);

/**
 * @param {{kind:string, verifiedAt?:string, nextRetryAt?:string, error?:string, detail?:string, backup?:{at:string,txnCount:number}, diff?:{onlyLocal:string[],onlyCloud:string[]}}} s
 * @returns {{ headline: string, detail: string, tone: "ok"|"warn"|"error"|"neutral" }}
 */
export function statusText(s) {
  switch (s.kind) {
    case "synced":
      return { headline: "Synced", detail: s.verifiedAt ? `Cloud copy verified ${when(s.verifiedAt)}.` : "Cloud copy verified.", tone: "ok" };
    case "sent":
      return { headline: "Sent to cloud", detail: "The cloud accepted the update, but the saved copy has not been read back yet, so it is not counted as verified.", tone: "neutral" };
    case "syncing":
      return { headline: "Syncing…", detail: "Not confirmed yet.", tone: "neutral" };
    case "pending":
      return { headline: "Changes not synced yet", detail: `Your latest changes are saved on this device and will be sent to the cloud${s.nextRetryAt ? ` (next try ${when(s.nextRetryAt)})` : ""}. They are not in the cloud yet.`, tone: "warn" };
    case "failed":
      return { headline: "Couldn't sync", detail: `${s.error || "The cloud could not be reached"}. Your data is safe on this device and sync will retry${s.nextRetryAt ? ` (next try ${when(s.nextRetryAt)})` : ""}.`, tone: "error" };
    case "conflict": {
      const a = s.diff?.onlyLocal?.length ?? 0, b = s.diff?.onlyCloud?.length ?? 0;
      return { headline: "This device and your cloud copy both changed", detail: `${a} transaction${a === 1 ? "" : "s"} only on this device, ${b} only in the cloud. Nothing has been replaced. Choose which copy to keep; the other is backed up first.`, tone: "warn" };
    }
    case "blocked-backup":
      return { headline: "Sync stopped to protect your data", detail: `A backup could not be verified${s.error ? ` (${s.error})` : ""}, so nothing was replaced. Download a backup file, then try again.`, tone: "error" };
    case "paused-token":
      return { headline: "Sync paused", detail: "The cloud's change-detection could not be confirmed as reliable, so Arth is not overwriting cloud data. Your data is safe on this device.", tone: "error" };
    case "paused-reconcile":
      return { headline: "Sync paused: copies don't match", detail: `After syncing, the cloud copy did not match what was sent${s.detail ? ` (${s.detail})` : ""}. Nothing further was overwritten.`, tone: "error" };
    case "local-only":
      return { headline: "Not signed in", detail: "Data is saved on this device only.", tone: "neutral" };
    default:
      return { headline: "Sync idle", detail: "", tone: "neutral" };
  }
}

/** Backup wording: only ever states a backup that was read back and matched. */
export function backupText(b) {
  return b ? `Backup verified ${when(b.at)}: ${b.txnCount} transaction${b.txnCount === 1 ? "" : "s"}.` : "No verified backup.";
}
