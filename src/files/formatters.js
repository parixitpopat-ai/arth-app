import { getInvestmentMetricConfig } from "../constants/investmentConfig";

export const sym = "₹";

export const fmt = n => { const num = Number(n||0); return num.toLocaleString("en-IN", { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }); };

export const fmtK = n => { const num = Number(n||0); if(num >= 100000) return (num/100000).toFixed(1).replace(/\.0$/,"")+"L"; if(num >= 1000) return (num/1000).toFixed(1).replace(/\.0$/,"")+"K"; return fmt(num); };

export const accountBucketLabel = bucket => bucket==="investment" ? "Investment / Wealth" : bucket==="liability" ? "Liability" : "Cash / Spending";

export const accIcon = value => {
  if(value && typeof value === "object" && value.typeIcon) return value.typeIcon;
  const t = typeof value === "object" ? value?.type : value;
  return t==="bank"?"🏦":t==="cc"?"💳":t==="debit"?"🏧":t==="upi"?"📱":"💵";
};

export const accLabel = value => {
  if(value && typeof value === "object" && value.typeLabel) return value.typeLabel;
  const t = typeof value === "object" ? value?.type : value;
  return t==="bank"?"Bank Account":t==="cc"?"Credit Card":t==="debit"?"Debit Card":t==="upi"?"UPI":"Cash";
};

// txnColor takes the current theme (T) as a parameter rather than closing over it — genuinely
// pure given its inputs, safe to extract despite the name suggesting theme coupling.
export const txnColor = (txnOrType,T) => {
  const type = typeof txnOrType === "string" ? txnOrType : txnOrType?.type;
  const isRefund = typeof txnOrType === "object" && txnOrType?.type === "settlement_in" && txnOrType?.isRefund;
  if(isRefund) return T.text;
  if(type==="income") return T.success;
  if(type==="expense") return T.danger;
  if(type==="transfer" || type==="settlement_in" || type==="settlement_out") return T.info;
  if(type==="cc_payment" || type==="cc_emi") return T.purple;
  if(type==="investment") return T.info;
  return T.sub;
};

export const txnLabel = txnOrType => {
  const type = typeof txnOrType === "string" ? txnOrType : txnOrType?.type;
  const isRefund = typeof txnOrType === "object" && txnOrType?.type === "settlement_in" && txnOrType?.isRefund;
  if(isRefund) return "Refund";
  const hasSettlementLinks = typeof txnOrType === "object" && (txnOrType?.settlementLinks?.length||0)>0;
  if(type==="settlement_in") return hasSettlementLinks ? "Repayment" : "Reimbursement";
  return type==="income"?"Income":type==="transfer"?"Transfer":type==="cc_payment"?"CC Payment":type==="cc_emi"?"CC EMI":type==="settlement_out"?"Settlement Out":type==="investment"?"Investment":"Expense";
};

export const txnEmoji = txnOrType => {
  const type = typeof txnOrType === "string" ? txnOrType : txnOrType?.type;
  const isRefund = typeof txnOrType === "object" && txnOrType?.type === "settlement_in" && txnOrType?.isRefund;
  if(isRefund) return "↩️";
  return type==="income"?"💚":type==="transfer"?"🔄":type==="cc_payment"?"💳":type==="cc_emi"?"💳":type==="settlement_in"?"💼":type==="settlement_out"?"📤":type==="investment"?"💹":"💸";
};

// The one formatter that needed investmentConfig — confirmed here, not forced into a generic
// bucket. formatters.js depends on investmentConfig.js; investmentConfig.js has no dependency
// back on formatters.js, so there's no circularity.
export const formatInvestmentMetric = (type, rawValue) => {
  const value = Number(rawValue || 0);
  if(!value) return "";
  if(type==="mf") return `NAV ${fmt(value)}`;
  if(type==="gold") return `${fmt(value)} g`;
  if(type==="stocks" || type==="crypto") return `${fmt(value)} units`;
  const config = getInvestmentMetricConfig(type);
  return config.show && config.shortLabel ? `${config.shortLabel} ${fmt(value)}` : "";
};
