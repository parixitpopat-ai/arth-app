// TRX-002C2 — Characterization extraction of `SettleModal`'s `settle(pid)`.
//
// Same discipline as the `applyRepaymentAllocations` extraction: every line of
// logic is copied from `src/App.jsx` as it exists today, no rewrites. Closure
// variables (t, bills, txns, accId, receiptImg, settleRef, settleDate,
// requestedAmt) become explicit parameters. `remainingShare` and
// `linkedSettlementKey` are imported/copied from their real, already-extracted
// locations (`src/domain/shared/remainingShare.js`, and `App.jsx`'s own
// module-scope `linkedSettlementKey`, not duplicated logic).
//
// Display-only helpers (getPerson, getAcc, sym, fmt — used only to build
// human-readable description/note strings, not to decide any settled/amount
// state) are accepted as injected functions with simple defaults, since
// characterizing exact string formatting isn't this ticket's concern — the
// DATA behavior (settled/settledAmt/remainingAmt/status transitions) is.

import { remainingShare } from "../../shared/remainingShare.js";

const defaultLinkedSettlementKey = t => t?.type === "settlement_in" && t?.againstTxnId
  ? [t.fromPersonId || "", t.againstTxnId || "", t.date || "", Number(t.amount || 0), t.accId || ""].join("|")
  : null;

export function settleCharacterization({
  t, pid, requestedAmt, bills, txns, accId, settleDate, todayStr,
  getPerson = (id) => ({ name: id }),
  getAcc = (id) => ({ name: id }),
  sym = "₹",
  fmt = (n) => String(n),
  linkedSettlementKey = defaultLinkedSettlementKey,
}) {
  const billsDue = (t._billIds || []).reduce((sum, billId) => {
    const bill = bills.find(b => b.id === billId);
    return sum + (bill?.splitPeople?.[pid] ? remainingShare(bill.splitPeople[pid]) : 0);
  }, 0);
  const txnsDue = (t._txnIds || []).reduce((sum, txnId) => {
    const txn = txns.find(x => x.id === txnId);
    return sum + (txn?.people?.[pid] ? remainingShare(txn.people[pid]) : 0);
  }, 0);
  const dueAmt = t._isBillSettle ? billsDue + txnsDue : remainingShare(t.people?.[pid]);

  if (!requestedAmt) return { txns, bills, settlementCreated: false };
  const appliedAmt = Math.min(requestedAmt, dueAmt);
  const extraAmt = Math.max(0, requestedAmt - dueAmt);
  const p = getPerson(pid);
  const settleId = `char-${pid}-${Date.now()}`;
  const settleDesc = `${p.name} settled${t.desc ? ` against '${t.desc}'` : ""}${extraAmt > 0 ? ` + ${sym}${fmt(extraAmt)} advance` : ""}`;

  const settlementLinks = [];
  if (t._isBillSettle) {
    let linkRem = appliedAmt;
    (t._billIds || []).forEach(billId => {
      const bill = bills.find(b => b.id === billId);
      if (!bill?.splitPeople?.[pid] || linkRem <= 0) return;
      const ba = remainingShare(bill.splitPeople[pid]);
      if (ba <= 0) return;
      const paidNow = Math.min(linkRem, ba);
      linkRem -= paidNow;
      settlementLinks.push({ kind: "bill", id: billId, personId: pid, amount: paidNow, title: bill.name || bill.merchant || "Bill" });
    });
    (t._txnIds || []).forEach(txnId => {
      const txn = txns.find(x => x.id === txnId);
      if (!txn?.people?.[pid] || linkRem <= 0) return;
      const ta = remainingShare(txn.people[pid]);
      if (ta <= 0) return;
      const paidNow = Math.min(linkRem, ta);
      linkRem -= paidNow;
      settlementLinks.push({ kind: "txn", id: txnId, personId: pid, amount: paidNow, title: txn.desc || txn.merchant || "Expense" });
    });
  } else if (!t._isFallbackSettle && t.id) {
    settlementLinks.push({ kind: "txn", id: t.id, personId: pid, amount: appliedAmt, title: t.desc || t.merchant || "Expense" });
  }

  const newSettleTxn = {
    id: settleId, type: "settlement_in", desc: settleDesc, merchant: "",
    date: settleDate || todayStr(),
    note: `Against: ${t.desc || "unknown"} · Account: ${getAcc(accId)?.name || "unnamed"}${extraAmt > 0 ? ` · Extra ${sym}${fmt(extraAmt)} kept as advance` : ""}`,
    amount: requestedAmt, appliedAmount: appliedAmt, extraAmount: extraAmt, accId,
    fromPersonId: pid, groupId: t.groupId || null,
    againstTxnId: (t._isBillSettle || t._isFallbackSettle) ? null : t.id,
    settlementLinks, transactionRef: null,
  };
  const upsertSettlement = prev => {
    const newKey = linkedSettlementKey(newSettleTxn);
    if (newKey && prev.some(x => linkedSettlementKey(x) === newKey)) return prev;
    return [newSettleTxn, ...prev];
  };

  let resultTxns = txns;
  let resultBills = bills;

  if (t._isBillSettle) {
    let remaining = appliedAmt;
    resultTxns = upsertSettlement(resultTxns).map(x => {
      if (t._txnIds?.includes(x.id) && x.people?.[pid]) {
        const origAmt = Number(x.people[pid]?.amount || 0);
        const prevP = Number(x.people[pid]?.settledAmt || 0);
        const txnAmt = remainingShare(x.people[pid]);
        const paidNow = Math.min(remaining, txnAmt);
        const nextP = Math.min(origAmt, prevP + paidNow);
        const nextPRem = Math.max(0, origAmt - nextP);
        const groupCap = Number(x.groupCollectiveAmount || 0);
        const nextGrp = groupCap > 0 ? Math.min(groupCap, Number(x.groupCollectiveSettledAmt || 0) + paidNow) : x.groupCollectiveSettledAmt;
        remaining -= paidNow;
        return { ...x, people: { ...x.people, [pid]: { ...x.people[pid], settled: nextPRem <= 0, settledAmt: nextP, remainingAmt: nextPRem } }, ...(groupCap > 0 ? { groupCollectiveSettledAmt: nextGrp } : {}) };
      }
      const billForTxn = (t._billIds || []).map(id => bills.find(b => b.id === id)).find(b => b?.paidByTxnId && String(b.paidByTxnId) === String(x.id));
      if (!billForTxn || !x.people?.[pid]) return x;
      const origAmt = Number(x.people[pid]?.amount || 0);
      const prevP = Number(x.people[pid]?.settledAmt || 0);
      const nextP = Math.min(origAmt, prevP + appliedAmt);
      const nextPRem = Math.max(0, origAmt - nextP);
      const addedP = nextP - prevP;
      const groupCap = Number(x.groupCollectiveAmount || 0);
      const nextGrp = groupCap > 0 ? Math.min(groupCap, Number(x.groupCollectiveSettledAmt || 0) + addedP) : x.groupCollectiveSettledAmt;
      return { ...x, people: { ...x.people, [pid]: { ...x.people[pid], settled: nextPRem <= 0, settledAmt: nextP, remainingAmt: nextPRem } }, ...(groupCap > 0 ? { groupCollectiveSettledAmt: nextGrp } : {}) };
    });

    if (t._billIds) {
      resultBills = resultBills.map(b => {
        const link = settlementLinks.find(l => l.kind === "bill" && String(l.id) === String(b.id));
        if (!link || !b.splitPeople?.[pid]) return b;
        const paidNow = link.amount;
        if (paidNow <= 0) return b;
        const prevSettled = Number(b.splitPeople[pid].settledAmt || 0);
        const nextSettled = prevSettled + paidNow;
        const originalAmt = Number(b.splitPeople[pid].amount || 0);
        const nextRemaining = Math.max(0, originalAmt - nextSettled);
        const groupCap = Number(b.groupCollectiveAmount || 0);
        const nextGroupSettled = groupCap > 0 ? Math.min(groupCap, Number(b.groupCollectiveSettledAmt || 0) + paidNow) : b.groupCollectiveSettledAmt;
        const updatedSplit = { ...b.splitPeople, [pid]: { ...b.splitPeople[pid], settled: nextRemaining <= 0, settledAmt: nextSettled, remainingAmt: nextRemaining } };
        const allOwedSettled = Object.values(updatedSplit).filter(i => i.mode === "owes").every(i => i.settled);
        return { ...b, splitPeople: updatedSplit, ...(groupCap > 0 ? { groupCollectiveSettledAmt: nextGroupSettled } : {}), ...(allOwedSettled ? { status: "paid", paidDate: todayStr() } : {}) };
      });
    }
  } else {
    resultTxns = [
      ...upsertSettlement([]),
      ...resultTxns.map(x => {
        if (x.id !== t.id) return x;
        const originalAmt = Number(x.people[pid]?.amount || 0);
        const prevSettled = Number(x.people[pid]?.settledAmt || 0);
        const nextSettled = Math.min(originalAmt, prevSettled + appliedAmt);
        const nextRemaining = Math.max(0, originalAmt - nextSettled);
        const addedAmt = nextSettled - prevSettled;
        const groupCap = Number(x.groupCollectiveAmount || 0);
        const nextGroupSettled = groupCap > 0 ? Math.min(groupCap, Number(x.groupCollectiveSettledAmt || 0) + addedAmt) : x.groupCollectiveSettledAmt;
        return { ...x, people: { ...x.people, [pid]: { ...x.people[pid], settled: nextRemaining <= 0, settledAmt: nextSettled, remainingAmt: nextRemaining } }, ...(groupCap > 0 ? { groupCollectiveSettledAmt: nextGroupSettled } : {}) };
      }),
    ];

    resultBills = resultBills.map(b => {
      const isPaidBillLink = t.paidBillId && String(b.id) === String(t.paidBillId);
      const isMirroredSplit = !t.paidBillId && b.splitPeople?.[pid] && b.splitPeople[pid].mode === "owes" && !b.splitPeople[pid].settled && remainingShare(b.splitPeople[pid]) > 0;
      if (!isPaidBillLink && !isMirroredSplit) return b;
      if (!b.splitPeople?.[pid]) return b;
      const origAmt = Number(b.splitPeople[pid].amount || 0);
      const prevP = Number(b.splitPeople[pid].settledAmt || 0);
      const nextP = Math.min(origAmt, prevP + appliedAmt);
      const nextPRem = Math.max(0, origAmt - nextP);
      const addedP = nextP - prevP;
      const groupCap = Number(b.groupCollectiveAmount || 0);
      const nextGrp = groupCap > 0 ? Math.min(groupCap, Number(b.groupCollectiveSettledAmt || 0) + addedP) : b.groupCollectiveSettledAmt;
      const updatedSplit = { ...b.splitPeople, [pid]: { ...b.splitPeople[pid], settled: nextPRem <= 0, settledAmt: nextP, remainingAmt: nextPRem } };
      const allOwedSettled = Object.values(updatedSplit).filter(i => i.mode === "owes").every(i => i.settled);
      return { ...b, splitPeople: updatedSplit, ...(groupCap > 0 ? { groupCollectiveSettledAmt: nextGrp } : {}), ...(allOwedSettled ? { status: "paid", paidDate: todayStr() } : {}) };
    });
  }

  return { txns: resultTxns, bills: resultBills, settlementCreated: true, appliedAmt, extraAmt };
}
