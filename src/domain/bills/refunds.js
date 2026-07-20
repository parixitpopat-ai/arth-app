// Pass 2 of Domain Layer Phase 2 (Bills). Both functions passed the audit clean:
// computeRefundTotalsByBill is a pure reduction over txns; getNetBillAmount reads only its own
// two parameters. Neither has hidden transitive dependencies the way getCardSummary's toDateOnly
// did in Pass 1 (Cards) — checked directly, not assumed.

export const computeRefundTotalsByBill = (txns) => txns.reduce((map, txn) => {
  if(txn.type!=="settlement_in" || !txn.isRefund || !txn.againstBillId) return map;
  const key = String(txn.againstBillId);
  map[key] = (map[key]||0) + Number(txn.amount||0);
  return map;
}, {});

export const getNetBillAmount = (bill, refundTotalsByBill) =>
  Math.max(0, Number(bill?.amount||0) - Number(refundTotalsByBill[String(bill?.id)]||0));
