// src/sync/tabOwnership.js
//
// Two tabs of one browser profile share localStorage but not memory (SYNC-SAFETY-004). If both stay active, a tab holding stale
// data persists over the other tab's changes and can then sync that stale copy: a silent loss. So:
//   1. ONE tab owns the app at a time (Web Locks API; a localStorage lease where it is unavailable). Other tabs do not mount the
//      app at all, so they never persist or sync; they wait, or the person takes over explicitly ("Use this tab").
//   2. Defence in depth: if the data keys this tab loaded change underneath it (a `storage` event from another tab), this tab is
//      stale and must stop (halt sync, ask for a reload) rather than carry on with old data.
// Pure orchestration; locks, storage, clock and timers are injected so every race is testable deterministically.

export const OWNER_LOCK_NAME = "arth-app-owner";
export const LEASE_KEY = "arth_tab_lease";

// Local data keys that are part of the synced snapshot (a write to any of them by another tab makes this tab stale).
// Guarded by a test that compares this list with the keys App.jsx persists.
export const DATA_KEYS = [
  "arth_account_types","arth_accounts","arth_annual_budget","arth_assets","arth_fuel_fills","arth_invoice_imports","arth_auto_backup_enabled","arth_auto_backup_frequency","arth_auto_category","arth_biller_accounts","arth_billers","arth_bills","arth_budget_carry","arth_budget_spreads","arth_card_order","arth_cats","arth_cc_emi_plans","arth_checkpoints","arth_contributions","arth_custom_base_behaviors","arth_dark","arth_default_group","arth_dismissed_alerts","arth_events","arth_expected_income","arth_fee_payments","arth_fee_periods","arth_fee_schedules","arth_gifts","arth_goals","arth_groups","arth_gym_checkins","arth_hidden_cards","arth_holidays","arth_income_types","arth_insurance_policies","arth_investments","arth_item_catalog","arth_last_fy_target","arth_liabilities","arth_liability_types","arth_loans","arth_mandatory_commitments","arth_master_user_setup_complete","arth_measure_units","arth_membership_relationships","arth_memberships","arth_month_overrides","arth_pay_groups","arth_people","arth_person_budgets","arth_plan_nudges","arth_recurring","arth_school_credit_notes","arth_skipped_investments","arth_txns","arth_vehicles","arth_wealth_snapshots","arth_work_trip",
];
const DATA_SET = new Set(DATA_KEYS);
export const isDataKey = key => DATA_SET.has(key);

/**
 * Calls `onStale(key)` once when another tab changes any synced data key (or clears storage). `target` is `window`.
 * The browser fires `storage` only in OTHER tabs, which is exactly the signal wanted.
 */
export function watchForeignWrites(target, storageArea, onStale) {
  let fired = false;
  const handler = e => {
    if (fired) return;
    if (e.storageArea && storageArea && e.storageArea !== storageArea) return;
    if (e.key === null || isDataKey(e.key)) { fired = true; onStale(e.key); }   // key === null: storage was cleared
  };
  target.addEventListener("storage", handler);
  return () => target.removeEventListener("storage", handler);
}

/**
 * @param {{
 *  locks?: { request: Function } | null,         // navigator.locks, or a fake
 *  storage: { getItem, setItem, removeItem },     // lease fallback
 *  tabId: string, now?: () => number,
 *  setTimer?: Function, clearTimer?: Function,
 *  onChange: (state: "waiting"|"owner"|"lost") => void,
 *  leaseMs?: number, heartbeatMs?: number, pollMs?: number,
 * }} o
 */
export function createTabOwnership({ locks = null, storage, tabId, now = () => Date.now(), setTimer = (f, ms) => setTimeout(f, ms), clearTimer = h => clearTimeout(h), onChange, leaseMs = 9000, heartbeatMs = 3000, pollMs = 1500 }) {
  let state = "waiting", stopped = false, release = null, timers = new Set();
  const set = s => { if (state !== s) { state = s; onChange(s); } };
  const after = (fn, ms) => { const h = setTimer(() => { timers.delete(h); fn(); }, ms); timers.add(h); return h; };
  const clearAll = () => { timers.forEach(clearTimer); timers.clear(); };

  // ── backend 1: Web Locks (atomic, released by the browser when the tab goes away, even on a crash) ──
  function startWithLocks() {
    const hold = () => new Promise(res => { release = res; });
    const grant = async () => { if (stopped) return; set("owner"); await hold(); };
    const lost = e => { if (!stopped && e && e.name === "AbortError") { set("lost"); } };
    Promise.resolve(locks.request(OWNER_LOCK_NAME, { mode: "exclusive" }, grant)).catch(lost);
  }
  function takeOverWithLocks() {
    // `steal` releases the current holder's lock; that holder's request rejects with AbortError and it moves to "lost".
    Promise.resolve(locks.request(OWNER_LOCK_NAME, { mode: "exclusive", steal: true }, async () => { if (stopped) return; set("owner"); await new Promise(res => { release = res; }); })).catch(lost2);
    function lost2(e) { if (!stopped && e && e.name === "AbortError") set("lost"); }
  }

  // ── backend 2: localStorage lease (best effort: not atomic across tabs; used only where Web Locks do not exist) ──
  const readLease = () => { try { return JSON.parse(storage.getItem(LEASE_KEY) || "null"); } catch { return null; } };
  const writeLease = () => storage.setItem(LEASE_KEY, JSON.stringify({ tabId, expiresAt: now() + leaseMs }));
  function tryClaim() {
    if (stopped) return;
    const l = readLease();
    if (!l || l.tabId === tabId || l.expiresAt <= now()) {
      writeLease();
      const check = readLease();                                   // read back: if another tab wrote in between, we lost the race
      if (check && check.tabId === tabId) { set("owner"); after(heartbeat, heartbeatMs); return; }
    }
    set(state === "owner" ? "lost" : "waiting");
    if (state !== "lost") after(tryClaim, pollMs);
  }
  function heartbeat() {
    if (stopped || state !== "owner") return;
    const l = readLease();
    if (l && l.tabId !== tabId && l.expiresAt > now()) { set("lost"); return; }       // someone took over
    writeLease(); after(heartbeat, heartbeatMs);
  }

  return {
    start() { if (locks) startWithLocks(); else tryClaim(); },
    takeOver() {
      if (stopped) return;
      if (locks) takeOverWithLocks();
      else { writeLease(); set("owner"); after(heartbeat, heartbeatMs); }
    },
    stop() { stopped = true; clearAll(); if (release) release(); if (!locks) { const l = readLease(); if (l && l.tabId === tabId) storage.removeItem(LEASE_KEY); } },
    getState: () => state,
  };
}
