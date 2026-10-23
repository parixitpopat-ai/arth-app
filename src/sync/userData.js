// src/sync/userData.js
//
// "Does this snapshot hold anything a person created?" for sync decisions (SYNC-SAFETY-004). The older hasMeaningfulData() looks
// only at transactions, bills, loans and a few similar lists, which is right for the first-sign-in screen but too narrow here:
// a person who has only added people, groups, billers, budgets or Plan Ahead choices has real data that must never be replaced
// without a choice, and must reach the cloud. NOT counted: accounts, categories and units (every install starts with defaults) and the lists a
// fresh install creates by itself (biller accounts and billers for the default cards, the first net-worth snapshot). Verified against a real
// fresh install in the browser harness: counting those made every new device look like it had data and forced a conflict screen.
import { hasMeaningfulData } from "../domain/identity/masterUserSetup.js";

const LISTS = ["groups", "membershipRelationships", "vehicles", "insurancePolicies", "mandatoryCommitments", "recurringSchedules", "events",
  "contributions", "feeSchedules", "feePeriods", "feePayments", "schoolCreditNotes", "gymCheckIns", "dismissedAlerts", "liabilities", "ccEmiPlans", "trackedAssets",
  "expectedIncome", "payGroups", "budgetSpreads", "memberships", "bills", "investments", "loans", "gifts", "goals", "fuelFills", "txns"];
const MAPS = ["planNudges", "monthOverrides", "perPersonBudgets", "balanceCheckpoints"];

export function hasUserData(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (hasMeaningfulData(snapshot)) return true;
  if (Array.isArray(snapshot.people) && snapshot.people.filter(p => p && p.id !== "__me__" && !p.isMe).length > 0) return true;
  if (LISTS.some(k => Array.isArray(snapshot[k]) && snapshot[k].length > 0)) return true;
  return MAPS.some(k => snapshot[k] && typeof snapshot[k] === "object" && !Array.isArray(snapshot[k]) && Object.keys(snapshot[k]).length > 0);
}
