// src/storage/repairStored.js — runs ONCE at start-up, before the app draws anything.
// Problem it solves: the app reads about 60 saved lists with JSON.parse and no safety net, so ONE unreadable list (for example text cut short by a write that
// was interrupted) made the app show "Something went wrong" on every launch, with no way out. Now, for each damaged list:
//   1. the damaged text is copied to `arth_damaged_<key>` first, so it is never lost and can be inspected;
//   2. the newest GOOD copy of that list in the safety backups or the rolling auto-backups is put back, and a notice records it (`arth_recovery_notice`);
//   3. if no backup holds that list, NOTHING is changed and the person is asked (StoredDataRecovery): start that part empty, or leave it.
// Healthy lists are never touched. Pure apart from the storage object passed in.
import { unpackList } from "../sync/packedList.js";

/** storage key -> the field of a backup snapshot that holds the same data (null: not part of backups). */
export const KEY_TO_FIELD = {
  arth_account_types: "accountTypes",
  arth_accounts: "accounts",
  arth_assets: "trackedAssets",
  arth_auto_backup_enabled: "autoBackupEnabled",
  arth_auto_category: "autoDetectExpenseCategory",
  arth_biller_accounts: "billerAccounts",
  arth_billers: "billers",
  arth_bills: "bills",
  arth_budget_carry: "budgetCarryForward",
  arth_budget_spreads: "budgetSpreads",
  arth_card_order: "cardOrder",
  arth_cats: "cats",
  arth_cc_emi_plans: "ccEmiPlans",
  arth_checkpoints: "balanceCheckpoints",
  arth_contributions: "contributions",
  arth_custom_base_behaviors: "customBaseBehaviors",
  arth_dark: "dark",
  arth_dismissed_alerts: "dismissedAlerts",
  arth_events: "events",
  arth_expected_income: "expectedIncome",
  arth_fee_payments: "feePayments",
  arth_fee_periods: "feePeriods",
  arth_fee_schedules: "feeSchedules",
  arth_fuel_fills: "fuelFills",
  arth_gifts: "gifts",
  arth_goals: "goals",
  arth_groups: "groups",
  arth_gym_checkins: "gymCheckIns",
  arth_holidays: "arthHolidays",
  arth_income_types: "incomeTypes",
  arth_insurance_policies: "insurancePolicies",
  arth_investments: "investments",
  arth_invoice_imports: "invoiceImports",
  arth_item_catalog: "itemCatalog",
  arth_liabilities: "liabilities",
  arth_liability_types: "liabilityTypes",
  arth_loans: "loans",
  arth_mandatory_commitments: "mandatoryCommitments",
  arth_master_user_setup_complete: "masterUserSetupComplete",
  arth_measure_units: "measureUnits",
  arth_membership_relationships: "membershipRelationships",
  arth_memberships: "memberships",
  arth_month_overrides: "monthOverrides",
  arth_pay_groups: "payGroups",
  arth_people: "people",
  arth_person_budgets: "perPersonBudgets",
  arth_plan_nudges: "planNudges",
  arth_recurring: "recurringSchedules",
  arth_school_credit_notes: "schoolCreditNotes",
  arth_school_relationships: "schoolRelationships",
  arth_skipped_investments: "skippedInvestmentMonths",
  arth_txns: "txns",
  arth_vehicles: "vehicles",
  arth_vendor_not_same: null,
  arth_wealth_snapshots: "wealthSnapshots",
  arth_work_trip: "workTripMode"
};
const MAPS = new Set(["arth_checkpoints", "arth_person_budgets", "arth_month_overrides", "arth_plan_nudges"]);
const BOOLS = new Set(["arth_dark", "arth_auto_category", "arth_work_trip", "arth_master_user_setup_complete", "arth_auto_backup_enabled", "arth_budget_carry"]);
const kindOf = key => (MAPS.has(key) ? "map" : BOOLS.has(key) ? "bool" : "list");
export const RECOVERY_NOTICE_KEY = "arth_recovery_notice";
export const DAMAGED_PREFIX = "arth_damaged_";
const BACKUP_KEYS = ["arth_sync_safety_backups", "arth_auto_backups"];

/** Does the parsed value have the shape the app expects for this key? null is accepted (the app has a default for it). */
export function shapeOk(key, value) {
  if (value === null) return true;
  const k = kindOf(key);
  if (k === "list") return Array.isArray(value);
  if (k === "map") return typeof value === "object" && !Array.isArray(value);
  return typeof value === "boolean";
}

/** @returns {{key:string, raw:string, why:"unreadable"|"wrong shape"}[]} */
export function findDamaged(storage) {
  const out = [];
  for (const key of Object.keys(KEY_TO_FIELD)) {
    let raw = null;
    try { raw = storage.getItem(key); } catch { continue; }
    if (raw == null) continue;
    try {
      const v = JSON.parse(raw);
      if (!shapeOk(key, v)) out.push({ key, raw, why: "wrong shape" });
    } catch { out.push({ key, raw, why: "unreadable" }); }
  }
  return out;
}

/** The newest good copy of this key's data in the backups: { value, at, from } or null. */
export function newestBackupValue(storage, key) {
  const field = KEY_TO_FIELD[key];
  if (!field) return null;
  let best = null;
  for (const listKey of BACKUP_KEYS) {
    let list = [];
    try { list = unpackList(storage.getItem(listKey)); } catch { list = []; }
    for (const b of Array.isArray(list) ? list : []) {
      const snap = b && b.snapshot;
      if (!snap || typeof snap !== "object" || !(field in snap)) continue;
      const v = snap[field];
      if (v === undefined || v === null || !shapeOk(key, v)) continue;
      const at = String(b.at || "");
      if (!best || at > best.at) best = { value: v, at, from: listKey === "arth_sync_safety_backups" ? "safety backup" : "automatic backup" };
    }
  }
  return best;
}

/**
 * @returns {{restored:{key:string, from:string, at:string}[], needsChoice:{key:string, why:string}[]}}
 * Never throws. Restores only what a backup can supply; leaves the rest exactly as it was.
 */
export function repairStored(storage) {
  const restored = [], needsChoice = [];
  let damaged = [];
  try { damaged = findDamaged(storage); } catch { return { restored, needsChoice }; }
  for (const d of damaged) {
    try { storage.setItem(DAMAGED_PREFIX + d.key, d.raw); } catch { /* storage full: the repair still proceeds only if a backup can replace it */ }
    const b = newestBackupValue(storage, d.key);
    if (b) {
      try { storage.setItem(d.key, JSON.stringify(b.value)); restored.push({ key: d.key, from: b.from, at: b.at }); continue; } catch { /* could not write: ask instead */ }
    }
    needsChoice.push({ key: d.key, why: d.why });
  }
  if (restored.length) { try { storage.setItem(RECOVERY_NOTICE_KEY, JSON.stringify(restored)); } catch { /* the notice is a courtesy */ } }
  return { restored, needsChoice };
}

/** The person chose to start these parts empty: the damaged text stays in `arth_damaged_<key>`; the app then uses its defaults. */
export function startEmpty(storage, keys) {
  for (const key of keys) { try { storage.removeItem(key); } catch { /* ignore */ } }
}

export function readNotice(storage) {
  try { const v = JSON.parse(storage.getItem(RECOVERY_NOTICE_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function clearNotice(storage) { try { storage.removeItem(RECOVERY_NOTICE_KEY); } catch { /* ignore */ } }

const LABELS = { arth_txns: "Transactions", arth_people: "People", arth_accounts: "Accounts", arth_bills: "Bills", arth_cats: "Categories", arth_groups: "Groups", arth_investments: "Investments", arth_loans: "Loans", arth_goals: "Goals", arth_vehicles: "Vehicles", arth_fuel_fills: "Fuel refills", arth_billers: "Providers", arth_biller_accounts: "Provider accounts", arth_checkpoints: "Balance checks" };
export const labelFor = key => LABELS[key] || key.replace(/^arth_/, "").replace(/_/g, " ");
