// domain/cards/alerts.js
//
// A card's spend alert, as a notification. getCardSummary already decides whether a card is over its alert
// (isOverAlert: limit set, alert % > 0, current-cycle spend at or above that share of the limit); this only turns that
// into a notification record. The id includes the billing cycle, so dismissing it silences the card for that cycle
// and the next cycle can alert again. Pure.

import { toLocalDateStr } from "../../helpers/dateHelpers.js";

/**
 * @param {object} card - a credit card account
 * @param {object} summary - getCardSummary(card, ...)
 * @returns {{id:string, cardId:string, name:string, pct:number, spend:number, limit:number, alertPct:number}|null}
 */
export function getCardAlert(card, summary) {
  if (!card || card.type !== "cc" || !summary || !summary.isOverAlert) return null;
  const limit = Number(card.limit || 0);
  const spend = Number(summary.currentCycleSpend || 0);
  if (!(limit > 0) || !(spend > 0)) return null;
  const cycle = summary.lastStatementDate ? toLocalDateStr(summary.lastStatementDate) : "none";
  return { id: `card_${card.id}_${cycle}`, cardId: card.id, name: card.name || "Card", pct: Math.round(spend / limit * 100), spend, limit, alertPct: Number(summary.alertPct || 0) };
}

/** Alerts for every card, highest use first; `dismissed` is the app's dismissedAlerts id list. */
export function getCardAlerts(cards, summaryFor, dismissed = []) {
  return (cards || [])
    .map(card => getCardAlert(card, summaryFor(card)))
    .filter(a => a && !(dismissed || []).includes(a.id))
    .sort((a, b) => b.pct - a.pct);
}
