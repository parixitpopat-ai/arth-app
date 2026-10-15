// src/sync/digest.js
//
// Content identity for sync (SYNC-SAFETY-002). "Is this device's data the same as what was last
// confirmed on the cloud?" is answered by comparing digests of CONTENT, never timestamps.
// savedAt and syncMeta are volatile (re-stamped on every rebuild / every write) and are excluded.

export const VOLATILE_KEYS = ["savedAt", "syncMeta"];

/** JSON.stringify with object keys sorted, so equal content always gives equal text. */
export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(v => (v === undefined ? "null" : stableStringify(v))).join(",") + "]";
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

export function canonicalContent(snapshot) {
  const out = {};
  for (const k of Object.keys(snapshot || {})) if (!VOLATILE_KEYS.includes(k)) out[k] = snapshot[k];
  return out;
}

/** SHA-256 (hex) of a snapshot's canonical content. Throws if no Web Crypto is available (callers must then treat the state as unknown/dirty, never as synced). */
export async function digestSnapshot(snapshot) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error("Web Crypto is not available");
  const bytes = new TextEncoder().encode(stableStringify(canonicalContent(snapshot)));
  const hash = new Uint8Array(await subtle.digest("SHA-256", bytes));
  return Array.from(hash, b => b.toString(16).padStart(2, "0")).join("");
}

export function txnIdsOf(snapshot) {
  return (Array.isArray(snapshot?.txns) ? snapshot.txns : []).map(t => String(t?.id)).sort();
}

/** Which transaction ids exist only on one side, plus simple counts of the other lists. */
export function summarizeDiff(local, cloud) {
  const l = new Set(txnIdsOf(local)), c = new Set(txnIdsOf(cloud));
  const count = (s, k) => (Array.isArray(s?.[k]) ? s[k].length : 0);
  return {
    onlyLocal: [...l].filter(id => !c.has(id)).sort(),
    onlyCloud: [...c].filter(id => !l.has(id)).sort(),
    counts: Object.fromEntries(["txns", "bills", "accounts", "people", "memberships"].map(k => [k, { local: count(local, k), cloud: count(cloud, k) }])),
  };
}
