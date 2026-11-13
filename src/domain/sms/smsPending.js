// src/domain/sms/smsPending.js — bank messages caught as they arrive, turned into items for Arth's bell list. Pure: nothing is stored or added here.
// An item is only a PROPOSAL: the person accepts (the Add form opens filled in; nothing is saved until Save) or discards. An item that looks like an entry
// already in Arth is marked "match" so Accept can link it instead of adding a copy.
import { sortSmsToAccounts } from "./smsInbox.js";
import { withImportKeys } from "../imports/statement.js";
import { matchStatement } from "../imports/matchStatement.js";
import { importedKeysOf, cleanMerchant, cleanCardMerchant } from "../imports/buildImport.js";
import { getLinkedMethodIds } from "../accounts/accountBalance.js";

const titleCase = s => String(s || "").toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\s+/g, " ").trim();

/** New queue messages -> items. Ids in `haveIds` (already held or already handled) are skipped. @returns {{items:object[], unreadable:number}} */
export function toPendingItems(messages, accounts, { haveIds = [] } = {}) {
  const have = new Set(haveIds.map(String));
  const scan = (accounts || []).filter(a => a && (a.type === "bank" || a.type === "cc"));
  const sorted = sortSmsToAccounts(messages, scan);
  const items = [];
  const push = (p, accId) => {
    if (have.has(p.smsId)) return;
    have.add(p.smsId);
    const keyed = withImportKeys([{ ...p.row, line: 1 }], accId || "sms")[0];
    items.push({ id: p.smsId, accountId: accId || "", date: p.row.date, amountPaise: p.row.amountPaise, desc: p.row.desc, ref: p.row.ref || "", upiId: p.row.upiId || "", ...(p.row.noName ? { noName: true } : {}), importKey: keyed.importKey, row: keyed });
  };
  for (const [accId, list] of sorted.byAccount) list.forEach(p => push(p, accId));
  sorted.noAccount.forEach(p => push(p, ""));
  // a message that looks like money but cannot be read is kept as a "could not read" item, never dropped silently
  const unread = sorted.unreadable.filter(u => !have.has(u.id)).map(u => ({ id: u.id, unreadable: true, why: u.why, text: u.text, date: u.date }));
  return { items, unreadable: sorted.unreadable.length, unread };
}

/**
 * Where each item stands against the entries in Arth now: "saved" (an entry already carries its key: drop it), "match" (looks like an entry you have;
 * `matchId` says which) or "new". @returns {Array<object & {status:string, matchId?:string}>}
 */
export function itemStatuses(items, { txns, accounts }) {
  const keys = new Set(importedKeysOf(txns));
  const utrs = (txns || []).filter(t => t.importKey && t.transactionRef).map(t => t.transactionRef);
  return (items || []).map(it => {
    if (keys.has(it.importKey)) return { ...it, status: "saved" };
    if (!it.accountId) return { ...it, status: "new" };
    const m = matchStatement([it.row], { transactions: txns, accountId: it.accountId, importedKeys: [...keys], linkedIds: getLinkedMethodIds(it.accountId, accounts), importedUtrs: utrs });
    const r = m.results[0];
    if (r && r.status === "already-imported") return { ...it, status: "saved" };
    if (r && r.status === "probable-match") return { ...it, status: "match", matchId: r.matchId };
    return { ...it, status: "new" };
  });
}

/** The vendor/source name to put in the Add form: a UPI id Arth already knows, else the name in the message. */
export function nameFor(item, accounts, payeeByUpiId) {
  const known = item.upiId && payeeByUpiId && payeeByUpiId.get ? payeeByUpiId.get(item.upiId) : "";
  if (known) return known;
  if (item.noName) return "";                                          // the message names nobody: leave the box for the person to fill
  const acc = (accounts || []).find(a => String(a.id) === String(item.accountId));
  const n = acc && acc.type === "cc" ? titleCase(cleanCardMerchant(item.desc)) : cleanMerchant(item.desc);
  return n || titleCase(cleanCardMerchant(item.desc));
}

/** What the Add form needs to open filled in. The extra fields ride along onto the saved entry so a later scan or statement recognises it. */
export function draftFor(item, accounts, payeeByUpiId) {
  const credit = item.amountPaise > 0;
  return {
    type: credit ? "income" : "expense",
    prefill: {
      who: nameFor(item, accounts, payeeByUpiId), amount: String(Math.abs(item.amountPaise) / 100), date: item.date, accId: item.accountId || undefined, transactionRef: item.ref || "",
      extra: { importKey: item.importKey, importSource: "sms", bankNarration: item.desc, ...(item.upiId ? { upiId: item.upiId } : {}), ...(item.ref ? { transactionRef: item.ref } : {}) },
    },
  };
}
