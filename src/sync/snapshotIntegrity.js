// src/sync/snapshotIntegrity.js
//
// Whole-snapshot integrity checks (SYNC-SAFETY-004). The snapshot holds transactions AND everything that depends on them
// (bills, payments/contributions, allocations, relationships, schedules, ...). Sync is only "successful" when none of that
// went missing, and a backup only counts when it could really be restored. Pure functions, no I/O.

const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const idOf = x => (isObj(x) && x.id != null ? String(x.id) : null);
const IGNORED = new Set(["savedAt", "syncMeta", "version"]);

/** Per top-level key: how many records, and (when records carry ids) which ids. */
export function listSummary(snapshot) {
  const out = {};
  for (const [key, value] of Object.entries(snapshot || {})) {
    if (IGNORED.has(key)) continue;
    if (Array.isArray(value)) {
      const ids = value.map(idOf);
      out[key] = { kind: "list", count: value.length, ids: ids.every(i => i !== null) ? ids : null };
    } else if (isObj(value)) {
      out[key] = { kind: "map", count: Object.keys(value).length, ids: Object.keys(value) };
    }
  }
  return out;
}

/**
 * Records present in `source` that are missing from `result` (a superset is fine: normalisation may ADD defaults).
 * For lists with ids: ids missing. For id-less lists: fewer records than the source. For maps: missing keys.
 * @returns {{ ok: boolean, missing: Array<{key:string, kind:string, ids?:string[], sourceCount:number, resultCount:number}> }}
 */
export function missingFrom(result, source) {
  const r = listSummary(result), s = listSummary(source), missing = [];
  for (const [key, sv] of Object.entries(s)) {
    const rv = r[key] || { kind: sv.kind, count: 0, ids: sv.ids ? [] : null };
    if (sv.ids && rv.ids) {
      const have = new Set(rv.ids);
      const gone = sv.ids.filter(id => !have.has(id));
      if (gone.length) missing.push({ key, kind: sv.kind, ids: gone, sourceCount: sv.count, resultCount: rv.count });
    } else if (rv.count < sv.count) {
      missing.push({ key, kind: sv.kind, sourceCount: sv.count, resultCount: rv.count });
    }
  }
  return { ok: missing.length === 0, missing };
}

/** Exact comparison in both directions (used for backups, where nothing may be added or dropped). */
export function sameRecords(a, b) {
  const ab = missingFrom(a, b), ba = missingFrom(b, a);
  return { ok: ab.ok && ba.ok, missingInA: ab.missing, missingInB: ba.missing };
}

// Cross-references between records. A reference to a record that does not exist is "dangling".
const REFS = [
  { from: "contributions", field: "txnId", to: "txns" },
  { from: "contributions", field: "obligationId", to: "bills", when: c => c?.obligationType === "bill" },
  { from: "bills", field: "paidByTxnId", to: "txns" },
  { from: "txns", field: "paidBillId", to: "bills" },
  { from: "txns", field: "linkedMembershipId", to: "memberships" },
  { from: "memberships", field: "linkedTxnId", to: "txns" },
  { from: "membershipRelationships", field: "billerAccountId", to: "billerAccounts" },
  { from: "feePeriods", field: "scheduleId", to: "feeSchedules" },
];

/** Count dangling references per relation. */
export function danglingReferences(snapshot) {
  const idSet = key => new Set((Array.isArray(snapshot?.[key]) ? snapshot[key] : []).map(idOf).filter(Boolean));
  const targets = {};
  const out = [];
  for (const r of REFS) {
    const list = Array.isArray(snapshot?.[r.from]) ? snapshot[r.from] : [];
    targets[r.to] = targets[r.to] || idSet(r.to);
    const bad = [];
    for (const rec of list) {
      if (r.when && !r.when(rec)) continue;
      const v = rec?.[r.field];
      if (v == null || v === "") continue;
      if (!targets[r.to].has(String(v))) bad.push(idOf(rec) ?? String(v));
    }
    if (bad.length) out.push({ relation: `${r.from}.${r.field} -> ${r.to}`, count: bad.length, sample: bad.slice(0, 5) });
  }
  return out;
}

/** Dangling references the result has that the source did not (i.e. introduced by the sync or restore itself). */
export function introducedDangling(result, source) {
  const before = new Map(danglingReferences(source).map(d => [d.relation, d.count]));
  return danglingReferences(result).filter(d => d.count > (before.get(d.relation) || 0));
}

/**
 * Would restoring this snapshot keep every record? `normalizers` maps a snapshot key to the function the restore path
 * applies to it (App's applyCloudSnapshot). Records the restore path itself drops are reported; a snapshot is
 * "recoverable" when the restore drops nothing, or nothing beyond what restoring the original source drops.
 */
export function restoreRehearsal(snapshot, normalizers = {}) {
  const restored = { ...snapshot };
  for (const [key, fn] of Object.entries(normalizers)) if (key in (snapshot || {})) restored[key] = fn(snapshot[key]);
  const lost = missingFrom(restored, snapshot);
  return { ok: lost.ok, dropped: lost.missing };
}

export function rehearsalNoWorse(readBack, source, normalizers) {
  const a = restoreRehearsal(readBack, normalizers), b = restoreRehearsal(source, normalizers);
  const key = d => `${d.key}:${(d.ids || []).join(",")}:${d.sourceCount}:${d.resultCount}`;
  const base = new Set(b.dropped.map(key));
  return { ok: a.dropped.every(d => base.has(key(d))), dropped: a.dropped };
}

export function describeMissing(missing) {
  return missing.map(m => `${m.key}: ${m.ids ? m.ids.length : m.sourceCount - m.resultCount} missing`).join(", ");
}
