// TRX-002C2 — Characterization extraction of `applyRepaymentAllocations`.
//
// THIS IS NOT A REWRITE. Every line of logic below is copied byte-for-byte from
// `src/App.jsx`'s real `applyRepaymentAllocations` (the `useCallback` at the top
// of `AppContent`), as it exists today, patches from this session included.
// The ONLY changes made:
//   - `setTxns(prev=>prev.map(fn))`  ->  `txns = txns.map(fn)`
//   - `setBills(prev=>prev.map(fn))` ->  `bills = bills.map(fn)`
//   - `todayStr()` (a helper defined elsewhere in AppContent) is passed in as a
//     parameter instead of closed over.
//   - Returns `{ txns, bills }` instead of calling React state setters.
//
// This is a mechanical, behavior-preserving extraction (Michael Feathers' "seam"
// technique) — its entire purpose is to make the CURRENT behavior testable
// before anything is allowed to touch the real function. It is a twin, not a
// fix. Any bug present in the real function is present here too, deliberately.
//
// Sequencing note, preserved exactly: React batches multiple `setTxns(prev=>...)`
// calls within one synchronous execution, chaining each updater's `prev` to the
// previous updater's result. The `txns = txns.map(...)` reassignments below
// replicate that chaining exactly — each block operates on the already-updated
// array from the block before it, not the original input.

export function applyRepaymentAllocationsCharacterization({ txns, bills, personId, settlementLinks, todayStr }) {
  const links = (settlementLinks || [])
    .map(link => ({ ...link, amount: Math.max(0, Number(link.amount || 0)) }))
    .filter(link => link.id && link.amount > 0);
  if (!links.length) return { txns, bills };

  const personLinks = links.filter(l => l.kind === "txn" || l.kind === "bill");
  const groupTxnLinks = links.filter(l => l.kind === "group-txn");
  const groupBillLinks = links.filter(l => l.kind === "group-bill");

  if (personId && personLinks.length) {
    txns = txns.map(txn => {
      if (txn.type !== "expense" || !txn.people?.[personId]) return txn;
      const link = personLinks.find(item => item.kind === "txn" && String(item.id) === String(txn.id));
      if (!link) return txn;
      const info = txn.people[personId];
      const originalAmt = Number(info.amount || 0);
      const prevSettled = Number(info.settledAmt || 0);
      const nextSettled = Math.min(originalAmt, prevSettled + Number(link.amount || 0));
      const nextRemaining = Math.max(0, originalAmt - nextSettled);
      const addedAmt = nextSettled - prevSettled;
      const groupCap = Number(txn.groupCollectiveAmount || 0);
      const nextGroupSettled = groupCap > 0
        ? Math.min(groupCap, Number(txn.groupCollectiveSettledAmt || 0) + addedAmt)
        : txn.groupCollectiveSettledAmt;
      return {
        ...txn,
        people: { ...txn.people, [personId]: { ...info, settled: nextRemaining <= 0, settledAmt: nextSettled, remainingAmt: nextRemaining } },
        ...(groupCap > 0 ? { groupCollectiveSettledAmt: nextGroupSettled } : {}),
      };
    });

    const billTxnMirrors = [];
    bills = bills.map(bill => {
      if (!bill.splitPeople?.[personId]) return bill;
      const link = personLinks.find(item => item.kind === "bill" && String(item.id) === String(bill.id));
      if (!link) return bill;
      const info = bill.splitPeople[personId];
      const originalAmt = Number(info.amount || 0);
      const prevSettled = Number(info.settledAmt || 0);
      const nextSettled = Math.min(originalAmt, prevSettled + Number(link.amount || 0));
      const nextRemaining = Math.max(0, originalAmt - nextSettled);
      const addedAmt = nextSettled - prevSettled;
      const groupCap = Number(bill.groupCollectiveAmount || 0);
      const nextGroupSettled = groupCap > 0
        ? Math.min(groupCap, Number(bill.groupCollectiveSettledAmt || 0) + addedAmt)
        : bill.groupCollectiveSettledAmt;
      const updatedSplitPeople = { ...bill.splitPeople, [personId]: { ...info, settled: nextRemaining <= 0, settledAmt: nextSettled, remainingAmt: nextRemaining } };
      const allOwedSettled = Object.entries(updatedSplitPeople).filter(([p]) => p !== "__me__").every(([, i]) => i.settled || i.mode !== "owes");
      if (bill.paidByTxnId && addedAmt > 0) billTxnMirrors.push({ txnId: bill.paidByTxnId, addedAmt });
      return {
        ...bill,
        splitPeople: updatedSplitPeople,
        ...(groupCap > 0 ? { groupCollectiveSettledAmt: nextGroupSettled } : {}),
        ...(allOwedSettled ? { status: "paid", paidDate: todayStr() } : {}),
      };
    });

    if (billTxnMirrors.length) {
      txns = txns.map(txn => {
        const mirror = billTxnMirrors.find(m => String(m.txnId) === String(txn.id));
        if (!mirror || !txn.people?.[personId]) return txn;
        const info = txn.people[personId];
        const originalAmt = Number(info.amount || 0);
        const prevSettled = Number(info.settledAmt || 0);
        const nextSettled = Math.min(originalAmt, prevSettled + mirror.addedAmt);
        const nextRemaining = Math.max(0, originalAmt - nextSettled);
        return { ...txn, people: { ...txn.people, [personId]: { ...info, settled: nextRemaining <= 0, settledAmt: nextSettled, remainingAmt: nextRemaining } } };
      });
    }
  }

  if (groupTxnLinks.length) {
    txns = txns.map(txn => {
      if (txn.type !== "expense") return txn;
      const link = groupTxnLinks.find(l => String(l.id) === String(txn.id));
      if (!link) return txn;
      const prevSettled = Number(txn.groupCollectiveSettledAmt || 0);
      const cap = Number(txn.groupCollectiveAmount || 0);
      const nextGroupSettled = cap > 0 ? Math.min(cap, prevSettled + Number(link.amount || 0)) : prevSettled;
      const linkPersonId = link.personId || personId;
      let updatedPeople = txn.people;
      if (linkPersonId && txn.people?.[linkPersonId]) {
        const info = txn.people[linkPersonId];
        const origAmt = Number(info.amount || 0);
        const prevPSettled = Number(info.settledAmt || 0);
        const nextPSettled = Math.min(origAmt, prevPSettled + Number(link.amount || 0));
        const nextPRemaining = Math.max(0, origAmt - nextPSettled);
        updatedPeople = { ...txn.people, [linkPersonId]: { ...info, settled: nextPRemaining <= 0, settledAmt: nextPSettled, remainingAmt: nextPRemaining } };
      }
      return { ...txn, ...(cap > 0 ? { groupCollectiveSettledAmt: nextGroupSettled } : {}), people: updatedPeople };
    });
  }

  if (groupBillLinks.length) {
    bills = bills.map(bill => {
      const link = groupBillLinks.find(l => String(l.id) === String(bill.id));
      if (!link) return bill;
      const prevSettled = Number(bill.groupCollectiveSettledAmt || 0);
      const cap = Number(bill.groupCollectiveAmount || 0);
      const nextGroupSettled = cap > 0 ? Math.min(cap, prevSettled + Number(link.amount || 0)) : prevSettled;
      const linkPersonId = link.personId || personId;
      let updatedSplitPeople = bill.splitPeople;
      if (linkPersonId && bill.splitPeople?.[linkPersonId]) {
        const info = bill.splitPeople[linkPersonId];
        const origAmt = Number(info.amount || 0);
        const prevPSettled = Number(info.settledAmt || 0);
        const nextPSettled = Math.min(origAmt, prevPSettled + Number(link.amount || 0));
        const nextPRemaining = Math.max(0, origAmt - nextPSettled);
        updatedSplitPeople = { ...bill.splitPeople, [linkPersonId]: { ...info, settled: nextPRemaining <= 0, settledAmt: nextPSettled, remainingAmt: nextPRemaining } };
      }
      const allOwedSettled = Object.entries(updatedSplitPeople || {}).filter(([p]) => p !== "__me__").every(([, i]) => i.settled || i.mode !== "owes");
      return { ...bill, ...(cap > 0 ? { groupCollectiveSettledAmt: nextGroupSettled } : {}), splitPeople: updatedSplitPeople, ...(allOwedSettled ? { status: "paid", paidDate: todayStr() } : {}) };
    });
  }

  const taggedLinks = links.filter(l => l.kind === "tagged");
  if (personId && taggedLinks.length) {
    txns = txns.map(t => {
      const link = taggedLinks.find(l => String(l.id) === String(t.id));
      if (!link) return t;
      if (t.people?.[personId]) return t;
      return { ...t, people: { ...(t.people || {}), [personId]: { amount: link.amount, mode: "owes", settled: true, settledAmt: link.amount, remainingAmt: 0 } } };
    });
  }

  return { txns, bills };
}
