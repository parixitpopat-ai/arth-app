// src/sync/differences.js — what differs between this device and the cloud copy, for EVERY list (not just transactions),
// so a conflict that is only about, say, a Plan Ahead choice or a bill is described honestly instead of "0 transactions differ".
import { stableStringify } from "./digest.js";

const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const VOLATILE = new Set(["savedAt", "syncMeta", "version"]);
export const LABELS = {
  txns: "transactions", bills: "bills", contributions: "payments and allocations", accounts: "accounts", people: "people", groups: "groups",
  memberships: "memberships", membershipRelationships: "membership relationships", billerAccounts: "biller accounts", billers: "billers",
  loans: "loans", investments: "investments", goals: "goals", feePayments: "fee payments", feeSchedules: "fee schedules", feePeriods: "fee periods",
  planNudges: "Plan Ahead choices", monthOverrides: "monthly budget changes", budgetSpreads: "budget spreads", payGroups: "pay-together groups",
  mandatoryCommitments: "mandatory commitments", recurringSchedules: "recurring schedules", insurancePolicies: "insurance policies", vehicles: "vehicles",
  cats: "categories", dismissedAlerts: "dismissed alerts", hiddenCards: "hidden cards", wealthSnapshots: "net-worth snapshots", gymCheckIns: "gym check-ins",
};
const label = key => LABELS[key] || key;

function entries(value) {
  if (Array.isArray(value)) {
    const withIds = value.every(x => isObj(x) && x.id != null);
    return withIds ? new Map(value.map(x => [String(x.id), stableStringify(x)])) : null;
  }
  if (isObj(value)) return new Map(Object.entries(value).map(([k, v]) => [k, stableStringify(v)]));
  return null;
}

/** @returns {Array<{key:string,label:string,onlyLocal:string[],onlyCloud:string[],changed:string[],countLocal:number,countCloud:number}>} only lists that differ */
export function differences(local, cloud) {
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(cloud || {})].filter(k => !VOLATILE.has(k)));
  const out = [];
  for (const key of [...keys].sort()) {
    const lv = local?.[key], cv = cloud?.[key];
    if (!(Array.isArray(lv) || Array.isArray(cv) || isObj(lv) || isObj(cv))) continue;
    const le = entries(lv ?? (Array.isArray(cv) ? [] : {})), ce = entries(cv ?? (Array.isArray(lv) ? [] : {}));
    if (le && ce) {
      const onlyLocal = [...le.keys()].filter(k => !ce.has(k)).sort(), onlyCloud = [...ce.keys()].filter(k => !le.has(k)).sort();
      const changed = [...le.keys()].filter(k => ce.has(k) && ce.get(k) !== le.get(k)).sort();
      if (onlyLocal.length || onlyCloud.length || changed.length) out.push({ key, label: label(key), onlyLocal, onlyCloud, changed, countLocal: le.size, countCloud: ce.size });
    } else if (stableStringify(lv) !== stableStringify(cv)) {
      out.push({ key, label: label(key), onlyLocal: [], onlyCloud: [], changed: [key], countLocal: Array.isArray(lv) ? lv.length : 0, countCloud: Array.isArray(cv) ? cv.length : 0 });
    }
  }
  return out;
}

/** One line per differing list, in plain words. */
export function describeDifferenceLines(list) {
  return (list || []).filter(d => d.key !== "txns").map(d => {
    const parts = [];
    if (d.onlyLocal.length) parts.push(`${d.onlyLocal.length} only on this device`);
    if (d.onlyCloud.length) parts.push(`${d.onlyCloud.length} only in the cloud`);
    if (d.changed.length) parts.push(`${d.changed.length} edited differently`);
    return `${d.label}: ${parts.join(", ")}`;
  });
}
