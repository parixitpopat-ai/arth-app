#!/bin/bash
set -e
cd D:/arth-app/src
mkdir -p constants helpers reports screens

cat > constants/theme.js << 'ARTHEOF'
// Arth theme tokens. Every screen reads colors through the `T` object
// (T = dark ? DARK : LIGHT), never hardcoded hex values directly, except
// for the small set of standalone screens that render before this theme
// system loads (PIN lock screen, error boundary) — those intentionally
// hardcode the same green/gray values independently.
export const DARK = { bg:"#08080f", card:"#0f0f1a", border:"#1a1a2e", text:"#e8e4dc", accent:"#22c55e", accentSoft:"rgba(34,197,94,0.12)", success:"#22c55e", danger:"#ef4444", input:"#0b0b18", nav:"#0a0a16", sub:"#5a5a7a", pill:"#14142a", sh:"rgba(0,0,0,0.6)", info:"#06b6d4", purple:"#8b5cf6", warn:"#f97316", gold:"#f0a500" };
export const LIGHT = { bg:"#f4f3ef", card:"#ffffff", border:"#e5e1d8", text:"#1a1a2e", accent:"#16a34a", accentSoft:"rgba(22,163,74,0.1)", success:"#16a34a", danger:"#dc2626", input:"#ede9e3", nav:"#ffffff", sub:"#7a7890", pill:"#eeecea", sh:"rgba(0,0,0,0.06)", info:"#0891b2", purple:"#7c3aed", warn:"#ea6c00", gold:"#d4920a" };

// General-purpose color picker options (person/group colors, category colors, etc.)
// — not theme-dependent, same 15 swatches in light or dark mode.
export const PALETTE = ["#f0a500","#22c55e","#3b82f6","#ef4444","#a855f7","#06b6d4","#f97316","#ec4899","#84cc16","#14b8a6","#8b5cf6","#f43f5e","#0ea5e9","#10b981","#f59e0b"];
ARTHEOF

cat > constants/appConstants.js << 'ARTHEOF'
// Capabilities a person can have — replaces the old hardcoded personType==="dependant"/"contact"
// checks scattered across the app. `personType` (Contact/Dependant/Vendor/...) stays as an
// identity classification, but no longer controls which features are available; `modules` does.
export const PERSON_MODULES = [
  { id:"sharedExpenses", label:"Shared Expenses", icon:"🤝" },
  { id:"borrowMoney", label:"Can Borrow Money", icon:"💳" },
  { id:"budget", label:"Monthly Budget", icon:"📊" },
  { id:"gifts", label:"Gifts", icon:"🎁" },
  { id:"notes", label:"Notes", icon:"📝" },
  { id:"reminders", label:"Reminders", icon:"🔔" },
];

// A person's enabled modules. New people (created after this change) store `modules` explicitly.
// Existing people don't have it yet, so this derives sensible defaults from their current
// personType that reproduce exactly what was visible before — budget only for dependants/isMe
// (the only feature that was actually type-restricted), everything else on for everyone (matches
// today's unrestricted behavior for shared expenses, lending, gifts).
export const getPersonModules = (p) => {
  if(Array.isArray(p?.modules)) return p.modules;
  const base = ["sharedExpenses","gifts","notes","reminders"];
  if(p?.isMe || p?.personType==="dependant") base.push("budget");
  else base.push("borrowMoney");
  return base;
};

// Same idea for groups. Unlike people, no group feature is currently type-restricted at all —
// every group already has full settlement + budget access regardless of type. So the fallback
// here preserves that exactly for existing groups (nothing hides retroactively). The behavior-
// template matrix below only supplies defaults for NEW groups going forward, via Add Group.
export const GROUP_MODULES = [
  { id:"settlement", label:"Settlements", icon:"🤝" },
  { id:"budget", label:"Budget", icon:"📊" },
  { id:"bills", label:"Bills", icon:"🧾" },
  { id:"vendors", label:"Vendors", icon:"🏪" },
];

export const GROUP_TYPE_DEFAULT_MODULES = {
  family:    ["budget","bills","vendors"],
  friends:   ["settlement"],
  relatives: ["settlement"],
  trip:      ["settlement"],
  office:    ["settlement","bills","vendors"],
  building:  ["settlement","bills","vendors"],
  society:   ["budget","bills"],
  business:  ["budget","bills","vendors"],
  other:     ["settlement","budget","bills","vendors"],
};

export const getGroupModules = (g) => {
  if(Array.isArray(g?.modules)) return g.modules;
  return ["settlement","budget","bills","vendors"];
};

export const CAT_ICONS = ["🍽️","🍕","🍔","🍜","🥗","🍣","☕","🍺","🛒","🥩","🚗","🏍️","✈️","🚕","⛽","🅿️","🛍️","👗","👟","💄","💍","🧴","⚡","💧","📶","🔌","💊","🏥","🩺","🧘","🏋️","🎬","🎵","🎮","🎨","📚","🏠","🔧","🪴","🛋️","👶","🧒","🎒","✏️","🧸","💰","💳","📈","🏦","🪙","👤","🐕","🐈","🌿","🌍","☀️","🎁","🎂","💼","🖥️","📱","🔭","🪒","💇","💆","💅","🧖","🏊","🚴","⛳","🎯","🎪","🏟️","🚑","🔑","🛁","🧺","🪑","🖼️","⛵","🌊","⛰️","🎓","📖","🏛️"];

export const INVEST_TYPES = [{ id:"mf", name:"Mutual Funds / SIP", icon:"📈", color:"#3b82f6" },{ id:"stocks", name:"Stocks", icon:"📊", color:"#22c55e" },{ id:"fd", name:"Fixed Deposit", icon:"🏦", color:"#f0a500" },{ id:"gold", name:"Gold", icon:"🥇", color:"#f59e0b" },{ id:"ppf", name:"PPF / NPS", icon:"🏛️", color:"#8b5cf6" },{ id:"crypto", name:"Crypto", icon:"₿", color:"#f97316" },{ id:"realestate", name:"Real Estate", icon:"🏘️", color:"#06b6d4" },{ id:"custom", name:"Custom", icon:"💼", color:"#ec4899" }];

export const ACC_TYPES = [{ id:"bank", label:"Bank Account", icon:"🏦" },{ id:"cc", label:"Credit Card", icon:"💳" },{ id:"debit", label:"Debit Card", icon:"🏧" },{ id:"upi", label:"UPI", icon:"📱" },{ id:"cash", label:"Cash", icon:"💵" }];

export const LIABILITY_TYPES = [{ id:"mortgage", name:"Mortgage / Home Loan", icon:"🏠", color:"#f97316" },{ id:"student", name:"Student Loan", icon:"🎓", color:"#8b5cf6" },{ id:"car", name:"Car Loan", icon:"🚗", color:"#3b82f6" },{ id:"tax", name:"Tax Liability", icon:"🏛️", color:"#ef4444" },{ id:"personal", name:"Personal Loan", icon:"🏦", color:"#ec4899" },{ id:"other", name:"Other Liability", icon:"📦", color:"#78716c" }];

export const ASSET_TYPES = [{ id:"realestate", name:"Real Estate", icon:"🏠", color:"#06b6d4" },{ id:"vehicle", name:"Vehicle", icon:"🚗", color:"#3b82f6" },{ id:"valuable", name:"Valuable", icon:"💎", color:"#a855f7" },{ id:"gold", name:"Gold / Jewelry", icon:"🥇", color:"#f59e0b" },{ id:"other", name:"Other Asset", icon:"📦", color:"#22c55e" }];

export const DEFAULT_INCOME_TYPES = ["salary","interest","freelance","rental","royalty","dividend","capital_gains"];

export const INVESTMENT_FREQUENCY_OPTIONS = [
  { value:"daily", label:"Daily" },
  { value:"weekly", label:"Weekly" },
  { value:"monthly", label:"Monthly" },
  { value:"quarterly", label:"Quarterly" },
  { value:"halfyearly", label:"Half-yearly" },
  { value:"yearly", label:"Yearly" },
];

export const ME = { id:"__me__", name:"Me", emoji:"🧑", relation:"Self", color:"#f0a500", personType:"dependant", isMe:true };

export const DEFAULT_CATS = [
  { id:"housing", name:"Housing", icon:"🏠", color:"#06b6d4", budget:15000, fixed:true, subs:[{id:"h1",name:"Rent / EMI"},{id:"h2",name:"Maintenance"},{id:"h3",name:"Repairs"},{id:"h4",name:"Furniture & Appliances"},{id:"h5",name:"Renovation / Interiors"},{id:"h6",name:"Property Tax"}] },
  { id:"utilities", name:"Utilities", icon:"⚡", color:"#f59e0b", budget:5000, fixed:true, subs:[{id:"u1",name:"Electricity"},{id:"u2",name:"Water"},{id:"u3",name:"Gas"},{id:"u4",name:"Internet / WiFi"},{id:"u5",name:"Mobile Bills"},{id:"u6",name:"Software Subscriptions"},{id:"u7",name:"Cloud Storage"}] },
  { id:"groceries", name:"Groceries", icon:"🛒", color:"#22c55e", budget:10000, fixed:true, subs:[{id:"g1",name:"Staples"},{id:"g2",name:"Vegetables"},{id:"g3",name:"Fruits"},{id:"g4",name:"Dairy"},{id:"g5",name:"Snacks & Packaged Food"}] },
  { id:"food", name:"Food & Dining", icon:"🍽️", color:"#f97316", budget:8000, fixed:false, subs:[{id:"f1",name:"Swiggy / Zomato"},{id:"f2",name:"Restaurants"},{id:"f3",name:"Cafes"},{id:"f4",name:"Treating Others"}] },
  { id:"transport", name:"Transport", icon:"🚗", color:"#3b82f6", budget:5000, fixed:false, subs:[{id:"t1",name:"Fuel"},{id:"t2",name:"Uber / Ola"},{id:"t3",name:"Public Transport"},{id:"t4",name:"EMI"},{id:"t5",name:"Insurance"},{id:"t6",name:"Servicing & Repairs"},{id:"t7",name:"Parking & Tolls"},{id:"t8",name:"PUC"},{id:"t9",name:"Challan / Fine"}] },
  { id:"financial", name:"Financial", icon:"💳", color:"#8b5cf6", budget:30000, fixed:true, subs:[{id:"fi1",name:"SIP / Mutual Funds"},{id:"fi2",name:"Stocks"},{id:"fi3",name:"PPF / NPS"},{id:"fi4",name:"Term Insurance"},{id:"fi5",name:"Health Insurance"},{id:"fi6",name:"Credit Card Bills"},{id:"fi7",name:"Loan EMI"},{id:"fi8",name:"Bank Charges"}] },
  { id:"health", name:"Health", icon:"💊", color:"#ec4899", budget:3000, fixed:true, subs:[{id:"he1",name:"Doctor Consultation"},{id:"he2",name:"Medicines"},{id:"he3",name:"Diagnostics / Tests"},{id:"he4",name:"Health Checkups"},{id:"he5",name:"Supplements"}] },
  { id:"fitness", name:"Fitness", icon:"🏋️", color:"#14b8a6", budget:2000, fixed:false, subs:[{id:"fit1",name:"Gym"},{id:"fit2",name:"Sports"},{id:"fit3",name:"Yoga / Trainer"},{id:"fit4",name:"Fitness Apps"}] },
  { id:"personaldev", name:"Personal Development", icon:"📚", color:"#0ea5e9", budget:2000, fixed:false, subs:[{id:"pd1",name:"Courses"},{id:"pd2",name:"Books"},{id:"pd3",name:"Workshops"},{id:"pd4",name:"Coaching / Mentorship"}] },
  { id:"lifestyle", name:"Lifestyle", icon:"👗", color:"#a855f7", budget:5000, fixed:false, subs:[{id:"l1",name:"Clothes"},{id:"l2",name:"Shoes"},{id:"l3",name:"Grooming / Salon"},{id:"l4",name:"Skincare / Cosmetics"},{id:"l5",name:"Accessories / Gadgets"}] },
  { id:"entertainment", name:"Entertainment", icon:"🎬", color:"#f43f5e", budget:2000, fixed:false, subs:[{id:"e1",name:"OTT Subscriptions"},{id:"e2",name:"Movies"},{id:"e3",name:"Events / Shows"}] },
  { id:"travel", name:"Travel", icon:"✈️", color:"#06b6d4", budget:5000, fixed:false, subs:[{id:"tr1",name:"Flights"},{id:"tr2",name:"Trains / Buses"},{id:"tr3",name:"Hotels"},{id:"tr4",name:"Local Transport"},{id:"tr5",name:"Activities"},{id:"tr6",name:"Shopping"}] },
  { id:"family", name:"Groups & Social", icon:"👥", color:"#f0a500", budget:5000, fixed:false, subs:[{id:"fa1",name:"Gifts"},{id:"fa2",name:"Family Support"},{id:"fa3",name:"Festivals"},{id:"fa4",name:"Weddings / Functions"}] },
  { id:"donations", name:"Donations", icon:"🙏", color:"#84cc16", budget:1000, fixed:false, subs:[{id:"d1",name:"Charity"},{id:"d2",name:"Religious Contributions"}] },
  { id:"professional", name:"Professional", icon:"💼", color:"#475569", budget:2000, fixed:false, subs:[{id:"pr1",name:"Work Travel"},{id:"pr2",name:"Networking"},{id:"pr3",name:"Tools / Software"},{id:"pr4",name:"Office Setup"}] },
  { id:"taxes", name:"Taxes", icon:"🏛️", color:"#dc2626", budget:5000, fixed:true, subs:[{id:"tx1",name:"Income Tax"},{id:"tx2",name:"CA / Filing Fees"}] },
  { id:"emergency", name:"Emergency", icon:"🚑", color:"#ef4444", budget:5000, fixed:true, subs:[{id:"em1",name:"Medical Emergency"},{id:"em2",name:"Urgent Repairs"},{id:"em3",name:"Contingency"}] },
  { id:"misc", name:"Miscellaneous", icon:"📦", color:"#78716c", budget:2000, fixed:false, subs:[{id:"m1",name:"Cash Expenses"},{id:"m2",name:"Tips"},{id:"m3",name:"Unplanned Purchases"}] },
];

export const DEFAULT_ACCOUNTS = [
  { id:"bank1", type:"bank", name:"ICICI Savings", last4:"3310", color:"#22c55e", openingBalance:0 },
  { id:"cc1", type:"cc", name:"HDFC Sapphire", last4:"4242", color:"#3b82f6", limit:300000, outstanding:0, statementDate:15, dueDate:5, billingCycle:"15th–14th", alertPct:30 },
  { id:"upi1", type:"upi", name:"GPay", handle:"", color:"#a855f7" },
  { id:"cash1", type:"cash", name:"Cash Wallet", color:"#f0a500", openingBalance:0 },
];

export const DEFAULT_MEASURE_UNITS = ["kg","g","ltr","ml","nos","pkt","dozen","box"];

export const VENDOR_CATEGORY_RULES = [
  { pattern: /swiggy|zomato|dominos|pizza|burger|starbucks|kfc|mcd|restaurant|cafe/, catId: "food", label: "food delivery / dining vendor" },
  { pattern: /uber|ola|rapido|petrol|fuel|shell|hpcl|iocl|parking|toll/, catId: "transport", label: "transport vendor" },
  { pattern: /amazon|flipkart|myntra|ajio|nykaa|meesho/, catId: "lifestyle", label: "shopping vendor" },
  { pattern: /apollo|pharmacy|medplus|hospital|clinic|diagnostic/, catId: "health", label: "health vendor" },
  { pattern: /airtel|jio|bsnl|wifi|broadband|electricity|water|gas/, catId: "utilities", label: "utility bill vendor" },
  { pattern: /netflix|spotify|hotstar|prime video|bookmyshow/, catId: "entertainment", label: "entertainment vendor" },
  { pattern: /blinkit|zepto|bigbasket|instamart|grofers/, catId: "groceries", label: "grocery vendor" },
];

export const CLOUD_SCHEMA_VERSION = 1;

export const GOAL_ICONS = ["🏠","🚗","💍","👶","🎓","✈️","🏖️","💰","🎯","🏥","📱","🛡️"];
ARTHEOF

cat > constants/investmentConfig.js << 'ARTHEOF'
import { normalizeVendorText } from "../helpers/textHelpers";

export const investmentFreqLabel = freq => {
  if(freq==="daily") return "Daily";
  if(freq==="weekly") return "Weekly";
  if(freq==="monthly") return "Monthly";
  if(freq==="halfyearly") return "Half-yearly";
  if(freq==="quarterly") return "Quarterly";
  if(freq==="yearly") return "Yearly";
  if(freq==="one-time") return "One-time";
  return "";
};

export const getInvestmentBudgetMeta = type => {
  if(type==="mf") return { catId:"financial", subId:"fi1" };
  if(type==="stocks" || type==="crypto" || type==="gold") return { catId:"financial", subId:"fi2" };
  if(type==="ppf" || type==="fd" || type==="realestate") return { catId:"financial", subId:"fi3" };
  return { catId:"financial", subId:null };
};

export const getInvestmentMetricConfig = type => {
  if(type==="mf") return { show:true, label:"NAV", placeholder:"e.g. 23.45", hint:"Track the latest NAV per unit for this fund.", shortLabel:"NAV" };
  if(type==="stocks") return { show:true, label:"Units", placeholder:"e.g. 10", hint:"Track how many shares or units were bought.", shortLabel:"Units" };
  if(type==="gold") return { show:true, label:"Weight (grams)", placeholder:"e.g. 12.5", hint:"Track gold weight in grams.", shortLabel:"Gold" };
  if(type==="crypto") return { show:true, label:"Units", placeholder:"e.g. 0.015", hint:"Track the number of coins or tokens.", shortLabel:"Units" };
  if(type==="ppf") return { show:false, label:"", placeholder:"", hint:"PPF / NPS is tracked by contribution amount; no NAV is required. If you created a PPF account, record the money movement as a Transfer into that account.", shortLabel:"" };
  if(type==="fd") return { show:false, label:"", placeholder:"", hint:"FD is tracked by deposit value; no NAV is required.", shortLabel:"" };
  if(type==="realestate") return { show:false, label:"", placeholder:"", hint:"Real estate is tracked by current value; no NAV is required.", shortLabel:"" };
  return { show:false, label:"", placeholder:"", hint:"This holding is tracked by amount or current value.", shortLabel:"" };
};

export const getInvestmentGroupMeta = inv => {
  const type = String(inv?.type || "custom");
  const folioNo = String(inv?.folioNo || "").trim();
  const name = String(inv?.name || "Investment").trim() || "Investment";
  if(type === "mf" && folioNo) return { key:`${type}|folio|${folioNo.toLowerCase()}`, folioNo, primaryName:name };
  const normalizedName = normalizeVendorText(name);
  if(normalizedName) return { key:`${type}|name|${normalizedName}`, folioNo:"", primaryName:name };
  return { key:`${type}|single|${String(inv?.linkedInvestmentId || inv?.id || name)}`, folioNo:"", primaryName:name };
};

export const inferInvestmentTypeId = value => {
  const text = normalizeVendorText(value);
  if(!text) return "custom";
  if(/mutual fund|sip\b|mf\b/.test(text)) return "mf";
  if(/stocks?|share|equity|demat/.test(text)) return "stocks";
  if(/ppf|nps|pf\b|provident|retirement/.test(text)) return "ppf";
  if(/fd\b|fixed deposit|term deposit/.test(text)) return "fd";
  if(/gold|sovereign/.test(text)) return "gold";
  if(/crypto|bitcoin|btc|eth/.test(text)) return "crypto";
  if(/real estate|property|house|flat|plot/.test(text)) return "realestate";
  return "custom";
};
ARTHEOF

cat > helpers/dateHelpers.js << 'ARTHEOF'
export const todayStr = () => new Date().toISOString().split("T")[0];

export const addDaysToDateStr = (dateStr, days) => {
  if(!dateStr) return dateStr;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days||0));
  return d.toISOString().split("T")[0];
};

// A membership period's real coverage end, accounting for any grace days attached to it. Grace
// extends how long a period is treated as "active" before it's lapsed, but is never baked into
// the stored `to` date itself — keeping `to` as the clean plan-end and `graceDays` as separate
// metadata is what lets the UI show e.g. "Quarterly (+15d grace)" instead of silently stretching
// the date. Every active/lapsed/expiring check should use this instead of comparing `to` directly.
export const getPeriodEffectiveEnd = (period) => addDaysToDateStr(period?.to, period?.graceDays||0);

export const daysInMonth = (monthKey) => {
  if(monthKey){
    const [y,m] = monthKey.split("-").map(Number);
    if(!y||!m) return 31;
    return new Date(y, m, 0).getDate();
  }
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth()+1, 0).getDate();
};

export const daysLeft = (monthKey) => {
  const today = new Date();
  const nowKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  if(!monthKey || monthKey === nowKey){
    return Math.max(0, daysInMonth(nowKey) - today.getDate());
  }
  if(monthKey < nowKey) return 0;
  return daysInMonth(monthKey);
};

export const getMonthBounds = (monthKey = todayStr().slice(0,7)) => {
  const [year, month] = String(monthKey || todayStr().slice(0,7)).split("-").map(Number);
  const safeYear = year || new Date().getFullYear();
  const safeMonth = month || (new Date().getMonth() + 1);
  const start = `${safeYear}-${String(safeMonth).padStart(2,"0")}-01`;
  const end = `${safeYear}-${String(safeMonth).padStart(2,"0")}-${String(new Date(safeYear, safeMonth, 0).getDate()).padStart(2,"0")}`;
  return { start, end };
};

export const getPreviousMonthKey = (monthKey = todayStr().slice(0,7)) => {
  const [year, month] = String(monthKey || todayStr().slice(0,7)).split("-").map(Number);
  const ref = new Date((year || new Date().getFullYear()), (month || 1) - 2, 1);
  return `${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,"0")}`;
};
ARTHEOF

cat > helpers/textHelpers.js << 'ARTHEOF'
// Normalizes free text for matching purposes (vendor/merchant names against
// category rules, investment type inference). Lowercase, strip punctuation,
// collapse whitespace. Not a display formatter — output is for comparison,
// never shown to the user directly.
export const normalizeVendorText = value => String(value ?? "")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();
ARTHEOF

cat > helpers/formatters.js << 'ARTHEOF'
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
ARTHEOF

cat > helpers/idGenerator.js << 'ARTHEOF'
// Generates a short, random, non-cryptographic ID for new records
// (transactions, people, bills, etc.). Not a UUID — collisions are
// astronomically unlikely at this app's scale, and the shortness matters
// for readability when IDs show up in debug output or URLs.
export const genId = () => Math.random().toString(36).slice(2,9);
ARTHEOF

cat > helpers/currency.js << 'ARTHEOF'
// Money input parsing and comparison. Pairs with helpers/formatters.js
// (which handles the *display* direction — number to string); these
// handle the *input* direction — string to number — plus float-safe
// comparison. No validators.js exists separately: checked the codebase,
// there's no distinct "is this valid" logic beyond what's here, and these
// are money-domain functions, not generic validation, per the domain-first
// rule.

// Parses a money string (possibly with ₹, commas, whitespace) into a
// number. Used when reading a stored/typed value that's already complete.
export const parseMoney = v => {
  const cleaned = String(v ?? "").replace(/[₹,\s]/g,"");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

// Cleans a money input *as the user types it* — strips currency symbols
// and non-digit characters, but keeps it as a string (not parsed to a
// number yet) and collapses multiple decimal points down to one. Used on
// onChange handlers where you don't want to force-parse mid-keystroke.
export const cleanMoneyInput = v => {
  const stripped = String(v ?? "").replace(/[₹,\s]/g, "");
  const cleaned = stripped.replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  if(dotIndex === -1) return cleaned;
  const whole = cleaned.slice(0, dotIndex);
  const decimal = cleaned.slice(dotIndex + 1).replace(/\./g, "");
  return `${whole}.${decimal}`;
};

// Float-safe equality for money — avoids the classic 0.1 + 0.2 !== 0.3
// class of bugs when comparing computed totals against a stored amount.
export const nearlyEqualMoney = (a,b) => Math.abs(Number(a||0) - Number(b||0)) < 0.01;
ARTHEOF

cat > reports/csv.js << 'ARTHEOF'
// Purely mechanical CSV helpers — escaping, joining, and triggering a
// browser download. Zero knowledge of what the rows represent. Whoever
// calls this decides the columns and how to turn a domain object (a
// transaction, a bill, whatever) into a row — that mapping is business
// logic and stays with the feature that owns it, not here.

export const rowsToCsvString = (rows) =>
  rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");

export const downloadCsvFile = (filename, csvString) => {
  const blob = new Blob([csvString], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
ARTHEOF

cat > screens/GoalsScreen.jsx << 'ARTHEOF'
// Goals — extracted per the Extraction Readiness Score (all three pieces
// scored under 10 external dependencies, verified mechanically). Each
// component takes only the props it actually uses, per the extraction
// checklist ("imports only what it needs") — AddContributionModal doesn't
// receive GOAL_ICONS or accounts, for example, since it never touches them.

import React, { useState } from "react";
import { GOAL_ICONS } from "../constants/appConstants";
import { genId } from "../helpers/idGenerator";

export const AddGoalModal = ({ existing, onClose, T, inp, lbl, accounts, setGoals }) => {
  const isEdit = Boolean(existing);
  const [name, setName] = useState(existing?.name||"");
  const [icon, setIcon] = useState(existing?.icon||"🎯");
  const [targetAmount, setTargetAmount] = useState(existing?.targetAmount?String(existing.targetAmount):"");
  const [currentAmount, setCurrentAmount] = useState(existing?.currentAmount?String(existing.currentAmount):"");
  const [targetDate, setTargetDate] = useState(existing?.targetDate||"");
  const [linkedAccountId, setLinkedAccountId] = useState(existing?.linkedAccountId||"");
  const canSave = name.trim() && parseFloat(targetAmount)>0;
  const handleSave = () => {
    if(!canSave) return;
    const record = {
      id: existing?.id||genId(), name:name.trim(), icon, targetAmount:parseFloat(targetAmount)||0,
      currentAmount: linkedAccountId ? 0 : (parseFloat(currentAmount)||0), // auto-tracked goals derive progress live from the account, not a stored number
      targetDate:targetDate||null, linkedAccountId:linkedAccountId||null,
      status: existing?.status||"active", createdAt: existing?.createdAt||Date.now(),
    };
    setGoals(prev=>isEdit?prev.map(x=>x.id===existing.id?record:x):[record,...prev]);
    onClose();
  };
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:340,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
      <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"85vh",overflowY:"auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{isEdit?"Edit":"New"} Goal</div>
          <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          <div>
            <span style={lbl}>Icon</span>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {GOAL_ICONS.map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{ background:icon===ic?T.accent+"22":T.input,border:`1px solid ${icon===ic?T.accent:T.border}`,borderRadius:10,padding:"7px 10px",cursor:"pointer",fontSize:18 }}>{ic}</button>)}
            </div>
          </div>
          <div>
            <span style={lbl}>Name *</span>
            <input style={{ ...inp,fontSize:15,fontWeight:700 }} placeholder="e.g. House Down Payment" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
          </div>
          <div>
            <span style={lbl}>Target Amount *</span>
            <input style={inp} type="number" placeholder="e.g. 2000000" value={targetAmount} onChange={e=>setTargetAmount(e.target.value)}/>
          </div>
          <div>
            <span style={lbl}>Target Date (optional)</span>
            <input style={inp} type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/>
          </div>
          <div>
            <span style={lbl}>Track progress from an account (optional)</span>
            <select style={inp} value={linkedAccountId} onChange={e=>setLinkedAccountId(e.target.value)}>
              <option value="">Manual — I'll log contributions myself</option>
              {accounts.filter(a=>a.type!=="cc").map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div style={{ color:T.sub,fontSize:10,marginTop:4 }}>{linkedAccountId?"Progress will always match this account's live balance.":"You'll add contributions manually as you save toward this."}</div>
          </div>
          {!linkedAccountId&&(
            <div>
              <span style={lbl}>Already saved (optional)</span>
              <input style={inp} type="number" placeholder="0" value={currentAmount} onChange={e=>setCurrentAmount(e.target.value)}/>
            </div>
          )}
          <button onClick={handleSave} disabled={!canSave} style={{ background:canSave?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:canSave?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>{isEdit?"Save Changes":"Create Goal"}</button>
        </div>
      </div>
    </div>
  );
};

export const AddContributionModal = ({ goal, onClose, T, inp, btnP, sym, setGoals }) => {
  const [amount, setAmount] = useState("");
  const save = () => {
    const amt = parseFloat(amount)||0;
    if(amt<=0) return;
    setGoals(prev=>prev.map(x=>x.id===goal.id?{...x,currentAmount:Number(x.currentAmount||0)+amt}:x));
    onClose();
  };
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:345,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
      <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 40px",width:"100%",maxWidth:430 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ color:T.text,fontSize:15,fontWeight:900 }}>Add to {goal.icon} {goal.name}</div>
          <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
        </div>
        <input autoFocus style={{ ...inp,fontSize:22,fontWeight:800,marginBottom:14 }} type="number" placeholder={`${sym}0`} value={amount} onChange={e=>setAmount(e.target.value)}/>
        <button onClick={save} disabled={!(parseFloat(amount)>0)} style={{ ...btnP,opacity:parseFloat(amount)>0?1:0.5 }}>Add Contribution</button>
      </div>
    </div>
  );
};

export const GoalsListModal = ({ onClose, T, sym, fmt, formatShortDate, goals, setGoals, getGoalProgress, setEditingGoal, setShowAddGoal, setShowAddContribution }) => {
  const activeGoals = goals.filter(g=>g.status!=="completed");
  const completedGoals = goals.filter(g=>g.status==="completed");
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:335,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
      <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"85vh",overflowY:"auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>🎯 Goals</div>
          <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
          {activeGoals.length===0&&<div style={{ color:T.sub,fontSize:12,textAlign:"center",padding:"16px 0" }}>No goals yet. Give a rupee a purpose.</div>}
          {activeGoals.map(g=>{
            const { current, pct, complete } = getGoalProgress(g);
            return (
              <div key={g.id} style={{ background:T.input,borderRadius:14,padding:"12px 14px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                  <div onClick={()=>{ setEditingGoal(g); setShowAddGoal(true); }} style={{ cursor:"pointer" }}>
                    <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{g.icon} {g.name}</div>
                    <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{sym}{fmt(current)} of {sym}{fmt(g.targetAmount)}{g.targetDate?` · by ${formatShortDate(g.targetDate)||g.targetDate}`:""}{g.linkedAccountId?" · auto-tracked":""}</div>
                  </div>
                  <span style={{ color:complete?T.success:T.accent,fontSize:14,fontWeight:900 }}>{pct}%</span>
                </div>
                <div style={{ height:6,background:T.border,borderRadius:3,marginBottom:complete||g.linkedAccountId?0:8 }}>
                  <div style={{ height:"100%",width:`${pct}%`,background:complete?T.success:T.accent,borderRadius:3 }}/>
                </div>
                {complete&&<button onClick={()=>setGoals(prev=>prev.map(x=>x.id===g.id?{...x,status:"completed"}:x))} style={{ marginTop:8,background:T.success+"22",border:`1px solid ${T.success}44`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.success,fontFamily:"Nunito,sans-serif" }}>✓ Mark Complete</button>}
                {!complete&&!g.linkedAccountId&&<button onClick={()=>setShowAddContribution(g)} style={{ marginTop:8,background:"none",border:`1px solid ${T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>+ Add Contribution</button>}
              </div>
            );
          })}
        </div>
        {completedGoals.length>0&&(
          <div style={{ marginBottom:16 }}>
            <div style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5,marginBottom:8 }}>COMPLETED</div>
            {completedGoals.map(g=>(
              <div key={g.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}` }}>
                <span style={{ color:T.text,fontSize:12,fontWeight:700 }}>{g.icon} {g.name}</span>
                <span style={{ color:T.success,fontSize:12,fontWeight:800 }}>✓ {sym}{fmt(g.targetAmount)}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={()=>{ setEditingGoal(null); setShowAddGoal(true); }} style={{ width:"100%",background:T.accent,border:"none",borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif" }}>+ New Goal</button>
      </div>
    </div>
  );
};
ARTHEOF

echo "All 10 files created."
ls -la constants/ helpers/ reports/ screens/
