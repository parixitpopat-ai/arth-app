// First module in domain/cards/. Both functions passed the parameterization audit clean —
// getCardSummary closed over exactly `accounts` and `txns` (confirmed via its own useCallback
// dependency array), no setters, no refs, no other memoized values.
//
// `toDateOnly` is taken as an explicit parameter rather than imported, deliberately — it's part
// of the date-parsing chain deferred in ADR-002 ("business logic still evolving"). Extracting it
// now just because it happens to block this pass would reopen that decision without re-auditing
// the whole chain (normalizeToIsoDate -> buildIsoDate/toFourDigitYear/MONTH_NAME_MAP,
// extractDateFromText). Passing it as a parameter keeps this pass contained to exactly what was
// scoped: Cards.

import { dateAtDay } from "../../helpers/dateHelpers";

export const getCardCycleDates = (card, refDate = new Date()) => {
  const statementDay = Math.max(1, Math.min(31, parseInt(card?.statementDate || 15, 10)));
  const dueDay = Math.max(1, Math.min(31, parseInt(card?.dueDate || 5, 10)));
  const ref = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12, 0, 0, 0);

  let lastStatementDate = dateAtDay(ref.getFullYear(), ref.getMonth(), statementDay);
  if(ref < lastStatementDate) lastStatementDate = dateAtDay(ref.getFullYear(), ref.getMonth() - 1, statementDay);

  const prevStatementDate = dateAtDay(lastStatementDate.getFullYear(), lastStatementDate.getMonth() - 1, statementDay);
  const nextStatementDate = dateAtDay(lastStatementDate.getFullYear(), lastStatementDate.getMonth() + 1, statementDay);

  let dueOn = dateAtDay(lastStatementDate.getFullYear(), lastStatementDate.getMonth(), dueDay);
  if(dueOn <= lastStatementDate) dueOn = dateAtDay(lastStatementDate.getFullYear(), lastStatementDate.getMonth() + 1, dueDay);

  return { prevStatementDate, lastStatementDate, nextStatementDate, dueOn };
};

export const getCardSummary = (card, accounts, txns, toDateOnly) => {
  const { prevStatementDate, lastStatementDate, nextStatementDate, dueOn } = getCardCycleDates(card, new Date());
  const linkedUpiIds = accounts.filter(a=>a.type==="upi"&&a.linkedAccount===card.id).map(a=>a.id);
  const allIds = [card.id, ...linkedUpiIds];
  const today = new Date();
  const todayMid = new Date(today.getFullYear(),today.getMonth(),today.getDate(),12,0,0,0);
  const todayS = today.toISOString().split("T")[0];
  const lastCycleCharges = txns.reduce((sum,t)=>{
    if((t.type!=="expense"&&t.type!=="investment"&&t.type!=="cc_emi")||!allIds.includes(t.accId)) return sum;
    if(!t.date||String(t.date)>todayS) return sum;
    const d=toDateOnly(t.date);
    if(!d||!lastStatementDate||d<=prevStatementDate||d>lastStatementDate) return sum;
    return sum+Number(t.amount||0);
  },0);
  const inCycleRefunds = txns.reduce((sum,t)=>{
    if(t.type!=="settlement_in"||!t.isRefund||!allIds.includes(t.accId)) return sum;
    const d=toDateOnly(t.date);
    if(!d||!lastStatementDate||d<=prevStatementDate||d>lastStatementDate) return sum;
    return sum+Number(t.amount||0);
  },0);
  const paymentsSinceStatement = txns.reduce((sum,t)=>{
    const isCcPayment = t.type==="cc_payment" && t.toAccId===card.id;
    const isCcRefund = t.type==="settlement_in" && t.isRefund && allIds.includes(t.accId);
    if(!isCcPayment && !isCcRefund) return sum;
    const d=toDateOnly(t.date);
    if(!d||!lastStatementDate||d<=lastStatementDate) return sum;
    return sum+Number(t.amount||0);
  },0);
  const totalOutstanding = Math.max(0, lastCycleCharges - inCycleRefunds - paymentsSinceStatement);
  const currentCycleSpend = Math.max(0, txns.reduce((sum,t)=>{
    if((t.type!=="expense"&&t.type!=="cc_emi")||!allIds.includes(t.accId)) return sum;
    const txnDate=toDateOnly(t.date);
    if(!txnDate||!lastStatementDate||txnDate<=lastStatementDate||txnDate>todayMid) return sum;
    return sum+Number(t.amount||0);
  },0));
  const currentDue = totalOutstanding;
  const alertPct=Number(card.alertPct??30);
  const thresholdAmount=card.limit?(Number(card.limit||0)*alertPct)/100:0;
  const isOverAlert=Boolean(card.limit)&&alertPct>0&&currentCycleSpend>=thresholdAmount&&currentCycleSpend>0;
  const daysToDue=Math.ceil((dueOn-todayMid)/(1000*60*60*24));
  return { prevStatementDate,lastStatementDate,nextStatementDate,dueOn,totalOutstanding,currentCycleSpend,currentDue,alertPct,thresholdAmount,isOverAlert,daysToDue };
};
