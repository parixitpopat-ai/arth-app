// domain/payments/whichConnection.js
//
// Payments v2 (WP18c) — D6 "Add bill · Which connection?". Pure, read-only composition, same
// spirit as homeCategories.js (WP18b): given the flat connection summaries Home already builds,
// decide which ones are even eligible for the generic Add Bill flow, and how to lay the eligible
// ones out ("Recent first, max 3", then grouped like Home).
//
// Eligibility — the spec's own words: "Education, Prepaid and Membership connections are excluded
// here (they use Pay fees, Recharge and renewal notice)." Credit Card is excluded too, but that
// isn't a new rule this WP invents — AddBillModal already refuses to create a Bill against a
// Credit Card connection (CC-8: a card's bills are generated from its Account, never typed in
// here), so listing one in "Which connection?" would be a dead end before the user even got there.
//
// "Membership" here means the narrow, spec-literal sense (Gym/Fitness, Club Membership, Other
// Subscription, Society Maintenance, Rental) — NOT Insurance, which the D6 mockup itself lists as
// a normal pickable connection (its own renewal-notice flow only replaces the *Expected* item;
// nothing stops a one-off ad hoc bill against an insurance connection too).
import { isRechargeBiller } from "../bills/commitments.js";
import { groupConnectionsByCategory } from "./homeCategories.js";

const EDUCATION_TYPES = ["School Fees", "Education Fees"];
const MEMBERSHIP_ONLY_TYPES = ["Gym / Fitness", "Club Membership", "Other Subscription", "Society Maintenance", "Rental"];

/** @returns {boolean} whether a connection of this Biller Account type can receive a generic Add Bill */
export function isEligibleForAddBill(billerType) {
  if (!billerType) return true;
  if (billerType === "Credit Card") return false;
  if (EDUCATION_TYPES.includes(billerType)) return false;
  if (isRechargeBiller(billerType)) return false;
  if (MEMBERSHIP_ONLY_TYPES.includes(billerType)) return false;
  return true;
}

/**
 * @param {Array<{id:string, billerType:string, categoryLabel:string, name:string, hasOverdueOrDueBill:boolean}>} connections
 * @param {Array<string>} recentIds - connection ids in most-recent-first order
 * @returns {{recent:Array, categories:Array}} `recent` is at most 3 eligible connections, most
 *   recent first; `categories` is every remaining eligible connection, grouped/ordered exactly as
 *   homeCategories.groupConnectionsByCategory already does for Home.
 */
export function buildWhichConnectionList(connections, recentIds = []) {
  const eligible = (connections || []).filter(c => isEligibleForAddBill(c.billerType));
  const order = new Map((recentIds || []).map((id, i) => [String(id), i]));
  const recent = eligible
    .filter(c => order.has(String(c.id)))
    .sort((a, b) => order.get(String(a.id)) - order.get(String(b.id)))
    .slice(0, 3);
  const recentIdSet = new Set(recent.map(c => String(c.id)));
  const rest = eligible.filter(c => !recentIdSet.has(String(c.id)));
  return { recent, categories: groupConnectionsByCategory(rest) };
}
