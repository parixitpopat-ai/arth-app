// domain/bills/prepaidAlerts.js
//
// Notifications for a prepaid plan / recharge that is about to end or has ended: three alerts per plan, each its own notification so dismissing an
// earlier one never hides a later one —
//   "pre"  : it ends in 1–3 days
//   "day"  : it ends today (the last covered day)
//   "post" : it ended (shown for up to 30 days, or until a newer recharge exists)
// A connection that has been ENDED or PAUSED (every Financial Relationship it has is ended/paused) raises none: the person said it is over, so
// being told to recharge it is wrong. A connection with no relationship at all (never attached to a person) is treated as live.
// Coverage comes from getPrepaidCoverage (the one place that decides which period is current). Pure; nothing is written.

import { getPrepaidCoverage } from "./prepaidUtilisation.js";
import { isRechargeBiller } from "./commitments.js";

export const PRE_DAYS = 3;
export const POST_DAYS = 30;

/** true when the connection has no relationship yet, or at least one active relationship */
export function isConnectionLive(billerAccountId, relationships) {
  const mine = (relationships || []).filter(r => String(r.billerAccountId) === String(billerAccountId));
  return mine.length === 0 || mine.some(r => r.status === "active");
}

/** "ended" when every relationship is ended, "paused" when none is active but one is paused, else null (live) */
export function connectionInactiveState(billerAccountId, relationships) {
  if (isConnectionLive(billerAccountId, relationships)) return null;
  const mine = (relationships || []).filter(r => String(r.billerAccountId) === String(billerAccountId));
  return mine.some(r => r.status === "paused") ? "paused" : "ended";
}

/**
 * @returns {Array<{id:string, billerAccountId:string, name:string, stage:"pre"|"day"|"post", daysRemaining:number, validUntil:string, isSubscription:boolean}>}
 *   most urgent first: ends today, then ending soon (fewest days), then already ended (most recent first)
 */
export function getPrepaidAlerts({ billerAccounts, bills, relationships, today = new Date(), dismissed = [] }) {
  const out = [];
  for (const ba of billerAccounts || []) {
    if (!ba || !isRechargeBiller(ba.type) || ba.archived || ba.status === "ended") continue;
    if (!isConnectionLive(ba.id, relationships)) continue;
    const cov = getPrepaidCoverage((bills || []).filter(b => String(b.billerAccountId) === String(ba.id)), today);
    if (!cov) continue;
    const d = cov.daysRemaining;
    const stage = d === 0 ? "day" : d > 0 && d <= PRE_DAYS ? "pre" : d < 0 && -d <= POST_DAYS ? "post" : null;
    if (!stage) continue;
    const id = `prepaid_${ba.id}_${cov.validUntil}_${stage}`;
    if ((dismissed || []).includes(id)) continue;
    out.push({ id, billerAccountId: ba.id, name: ba.name || ba.type, stage, daysRemaining: d, validUntil: cov.validUntil, isSubscription: ba.type === "OTT / Streaming" || /subscription/i.test(ba.type || "") });
  }
  const rank = a => (a.stage === "day" ? 0 : a.stage === "pre" ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || (a.stage === "post" ? b.daysRemaining - a.daysRemaining : a.daysRemaining - b.daysRemaining));
}

/** The line shown in the notification */
export function prepaidAlertText(a) {
  const what = a.name;
  if (a.stage === "day") return `${what} ends today`;
  if (a.stage === "pre") return `${what} ends in ${a.daysRemaining} day${a.daysRemaining === 1 ? "" : "s"}`;
  const n = -a.daysRemaining;
  return `${what} ended ${n} day${n === 1 ? "" : "s"} ago`;
}
