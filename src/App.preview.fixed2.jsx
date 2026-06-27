import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { getCurrentCloudUser, isCloudSyncConfigured, loadCloudSnapshot, saveCloudSnapshot, signInWithPassword, signOutCloud, signUpWithPassword, supabase } from "./cloudSync";

// â”€â”€â”€ THEME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DARK  = { bg:"#08080f", card:"#0f0f1a", border:"#1a1a2e", text:"#e8e4dc", accent:"#f0a500", accentSoft:"rgba(240,165,0,0.1)", success:"#22c55e", danger:"#ef4444", input:"#0b0b18", nav:"#0a0a16", sub:"#5a5a7a", pill:"#14142a", sh:"rgba(0,0,0,0.6)", info:"#06b6d4", purple:"#8b5cf6", warn:"#f97316" };
const LIGHT = { bg:"#f4f3ef", card:"#ffffff", border:"#e5e1d8", text:"#1a1a2e", accent:"#d4920a", accentSoft:"rgba(212,146,10,0.08)", success:"#16a34a", danger:"#dc2626", input:"#ede9e3", nav:"#ffffff", sub:"#7a7890", pill:"#eeecea", sh:"rgba(0,0,0,0.06)", info:"#0891b2", purple:"#7c3aed", warn:"#ea6c00" };

// â”€â”€â”€ CONSTANTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PALETTE = ["#f0a500","#22c55e","#3b82f6","#ef4444","#a855f7","#06b6d4","#f97316","#ec4899","#84cc16","#14b8a6","#8b5cf6","#f43f5e","#0ea5e9","#10b981","#f59e0b"];
const CAT_ICONS = ["🍽️","ðŸ•","ðŸ”","🍜","ðŸ¥—","🍣","â˜•","🍺","ðŸ›’","🥩","ðŸš—","🏍️","âœˆ️","ðŸš•","â›½","ðŸ…¿ï¸","ðŸ›ï¸","ðŸ‘—","ðŸ‘Ÿ","ðŸ’„","ðŸ’","🧴","⚡","ðŸ’§","ðŸ“¶","ðŸ”Œ","ðŸ’Š","🏥","🩺","ðŸ§˜","ðŸ‹️","🎬","🎵","🎮","🎨","ðŸ“š","🏠","ðŸ”§","🪴","ðŸ›‹️","ðŸ‘¶","ðŸ§’","ðŸŽ’","✏️","🧸","ðŸ’°","ðŸ’³","ðŸ“ˆ","🏦","ðŸª™","ðŸ‘¤","ðŸ•","ðŸˆ","🌿","🌍","â˜€️","🎁","ðŸŽ‚","ðŸ’¼","ðŸ–¥ï¸","ðŸ“±","ðŸ”­","ðŸª’","ðŸ’‡","ðŸ’†","ðŸ’…","ðŸ§–","🏊","🚴","â›³","🎯","🎪","🏟️","ðŸš‘","ðŸ”‘","ðŸ›","🧺","ðŸª‘","ðŸ–¼ï¸","â›µ","🌊","â›°ï¸","ðŸŽ“","ðŸ“–","ðŸ›️"];
const INVEST_TYPES = [{ id:"mf", name:"Mutual Funds / SIP", icon:"ðŸ“ˆ", color:"#3b82f6" },{ id:"stocks", name:"Stocks", icon:"ðŸ“Š", color:"#22c55e" },{ id:"fd", name:"Fixed Deposit", icon:"🏦", color:"#f0a500" },{ id:"gold", name:"Gold", icon:"ðŸ¥‡", color:"#f59e0b" },{ id:"ppf", name:"PPF / NPS", icon:"ðŸ›️", color:"#8b5cf6" },{ id:"crypto", name:"Crypto", icon:"â‚¿", color:"#f97316" },{ id:"realestate", name:"Real Estate", icon:"ðŸ˜️", color:"#06b6d4" },{ id:"custom", name:"Custom", icon:"ðŸ’¼", color:"#ec4899" }];
const ACC_TYPES = [{ id:"bank", label:"Bank Account", icon:"🏦" },{ id:"cc", label:"Credit Card", icon:"ðŸ’³" },{ id:"debit", label:"Debit Card", icon:"🏧" },{ id:"upi", label:"UPI", icon:"ðŸ“±" },{ id:"cash", label:"Cash", icon:"ðŸ’µ" }];
const LIABILITY_TYPES = [{ id:"mortgage", name:"Mortgage / Home Loan", icon:"🏠", color:"#f97316" },{ id:"student", name:"Student Loan", icon:"ðŸŽ“", color:"#8b5cf6" },{ id:"car", name:"Car Loan", icon:"ðŸš—", color:"#3b82f6" },{ id:"tax", name:"Tax Liability", icon:"ðŸ›️", color:"#ef4444" },{ id:"personal", name:"Personal Loan", icon:"🏦", color:"#ec4899" },{ id:"other", name:"Other Liability", icon:"ðŸ“¦", color:"#78716c" }];
const ASSET_TYPES = [{ id:"realestate", name:"Real Estate", icon:"🏠", color:"#06b6d4" },{ id:"vehicle", name:"Vehicle", icon:"ðŸš—", color:"#3b82f6" },{ id:"valuable", name:"Valuable", icon:"ðŸ’Ž", color:"#a855f7" },{ id:"gold", name:"Gold / Jewelry", icon:"ðŸ¥‡", color:"#f59e0b" },{ id:"other", name:"Other Asset", icon:"ðŸ“¦", color:"#22c55e" }];
const DEFAULT_INCOME_TYPES = ["salary","interest","freelance","rental","royalty","dividend","capital_gains"];

const ME = { id:"__me__", name:"Me", emoji:"ðŸ§‘", relation:"Self", color:"#f0a500", personType:"dependant", isMe:true };

const DEFAULT_CATS = [
  { id:"housing", name:"Housing", icon:"🏠", color:"#06b6d4", budget:15000, fixed:true, subs:[{id:"h1",name:"Rent / EMI"},{id:"h2",name:"Maintenance"},{id:"h3",name:"Repairs"},{id:"h4",name:"Furniture & Appliances"},{id:"h5",name:"Renovation / Interiors"},{id:"h6",name:"Property Tax"}] },
  { id:"utilities", name:"Utilities", icon:"⚡", color:"#f59e0b", budget:5000, fixed:true, subs:[{id:"u1",name:"Electricity"},{id:"u2",name:"Water"},{id:"u3",name:"Gas"},{id:"u4",name:"Internet / WiFi"},{id:"u5",name:"Mobile Bills"},{id:"u6",name:"Software Subscriptions"},{id:"u7",name:"Cloud Storage"}] },
  { id:"groceries", name:"Groceries", icon:"ðŸ›’", color:"#22c55e", budget:10000, fixed:true, subs:[{id:"g1",name:"Staples"},{id:"g2",name:"Vegetables"},{id:"g3",name:"Fruits"},{id:"g4",name:"Dairy"},{id:"g5",name:"Snacks & Packaged Food"}] },
  { id:"food", name:"Food & Dining", icon:"🍽️", color:"#f97316", budget:8000, fixed:false, subs:[{id:"f1",name:"Swiggy / Zomato"},{id:"f2",name:"Restaurants"},{id:"f3",name:"Cafes"},{id:"f4",name:"Treating Others"}] },
  { id:"transport", name:"Transport", icon:"ðŸš—", color:"#3b82f6", budget:5000, fixed:false, subs:[{id:"t1",name:"Fuel"},{id:"t2",name:"Uber / Ola"},{id:"t3",name:"Public Transport"},{id:"t4",name:"EMI"},{id:"t5",name:"Insurance"},{id:"t6",name:"Servicing & Repairs"},{id:"t7",name:"Parking & Tolls"}] },
  { id:"financial", name:"Financial", icon:"ðŸ’³", color:"#8b5cf6", budget:30000, fixed:true, subs:[{id:"fi1",name:"SIP / Mutual Funds"},{id:"fi2",name:"Stocks"},{id:"fi3",name:"PPF / NPS"},{id:"fi4",name:"Term Insurance"},{id:"fi5",name:"Health Insurance"},{id:"fi6",name:"Credit Card Bills"},{id:"fi7",name:"Loan EMI"},{id:"fi8",name:"Bank Charges"}] },
  { id:"health", name:"Health", icon:"ðŸ’Š", color:"#ec4899", budget:3000, fixed:true, subs:[{id:"he1",name:"Doctor Consultation"},{id:"he2",name:"Medicines"},{id:"he3",name:"Diagnostics / Tests"},{id:"he4",name:"Health Checkups"},{id:"he5",name:"Supplements"}] },
  { id:"fitness", name:"Fitness", icon:"ðŸ‹️", color:"#14b8a6", budget:2000, fixed:false, subs:[{id:"fit1",name:"Gym"},{id:"fit2",name:"Sports"},{id:"fit3",name:"Yoga / Trainer"},{id:"fit4",name:"Fitness Apps"}] },
  { id:"personaldev", name:"Personal Development", icon:"ðŸ“š", color:"#0ea5e9", budget:2000, fixed:false, subs:[{id:"pd1",name:"Courses"},{id:"pd2",name:"Books"},{id:"pd3",name:"Workshops"},{id:"pd4",name:"Coaching / Mentorship"}] },
  { id:"lifestyle", name:"Lifestyle", icon:"ðŸ‘—", color:"#a855f7", budget:5000, fixed:false, subs:[{id:"l1",name:"Clothes"},{id:"l2",name:"Shoes"},{id:"l3",name:"Grooming / Salon"},{id:"l4",name:"Skincare / Cosmetics"},{id:"l5",name:"Accessories / Gadgets"}] },
  { id:"entertainment", name:"Entertainment", icon:"🎬", color:"#f43f5e", budget:2000, fixed:false, subs:[{id:"e1",name:"OTT Subscriptions"},{id:"e2",name:"Movies"},{id:"e3",name:"Events / Shows"}] },
  { id:"travel", name:"Travel", icon:"âœˆ️", color:"#06b6d4", budget:5000, fixed:false, subs:[{id:"tr1",name:"Flights"},{id:"tr2",name:"Trains / Buses"},{id:"tr3",name:"Hotels"},{id:"tr4",name:"Local Transport"},{id:"tr5",name:"Activities"},{id:"tr6",name:"Shopping"}] },
  { id:"family", name:"Groups & Social", icon:"ðŸ‘¥", color:"#f0a500", budget:5000, fixed:false, subs:[{id:"fa1",name:"Gifts"},{id:"fa2",name:"Family Support"},{id:"fa3",name:"Festivals"},{id:"fa4",name:"Weddings / Functions"}] },
  { id:"donations", name:"Donations", icon:"ðŸ™", color:"#84cc16", budget:1000, fixed:false, subs:[{id:"d1",name:"Charity"},{id:"d2",name:"Religious Contributions"}] },
  { id:"professional", name:"Professional", icon:"ðŸ’¼", color:"#475569", budget:2000, fixed:false, subs:[{id:"pr1",name:"Work Travel"},{id:"pr2",name:"Networking"},{id:"pr3",name:"Tools / Software"},{id:"pr4",name:"Office Setup"}] },
  { id:"taxes", name:"Taxes", icon:"ðŸ›️", color:"#dc2626", budget:5000, fixed:true, subs:[{id:"tx1",name:"Income Tax"},{id:"tx2",name:"CA / Filing Fees"}] },
  { id:"emergency", name:"Emergency", icon:"ðŸš‘", color:"#ef4444", budget:5000, fixed:true, subs:[{id:"em1",name:"Medical Emergency"},{id:"em2",name:"Urgent Repairs"},{id:"em3",name:"Contingency"}] },
  { id:"misc", name:"Miscellaneous", icon:"ðŸ“¦", color:"#78716c", budget:2000, fixed:false, subs:[{id:"m1",name:"Cash Expenses"},{id:"m2",name:"Tips"},{id:"m3",name:"Unplanned Purchases"}] },
];

const DEFAULT_ACCOUNTS = [
  { id:"bank1", type:"bank", name:"ICICI Savings", last4:"3310", color:"#22c55e", openingBalance:0 },
  { id:"cc1", type:"cc", name:"HDFC Sapphire", last4:"4242", color:"#3b82f6", limit:300000, outstanding:0, statementDate:15, dueDate:5, billingCycle:"15thâ€“14th", alertPct:30 },
  { id:"upi1", type:"upi", name:"GPay", handle:"", color:"#a855f7" },
  { id:"cash1", type:"cash", name:"Cash Wallet", color:"#f0a500", openingBalance:0 },
];

// â”€â”€â”€ UTILS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const genId = () => Math.random().toString(36).slice(2,9);
const todayStr = () => new Date().toISOString().split("T")[0];
const sym = "â‚¹";
const fmt = n => { const num = Number(n||0); return num.toLocaleString("en-IN", { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }); };
const fmtK = n => { const num = Number(n||0); if(num >= 100000) return (num/100000).toFixed(1).replace(/\.0$/,"")+"L"; if(num >= 1000) return (num/1000).toFixed(1).replace(/\.0$/,"")+"K"; return fmt(num); };
const parseMoney = v => {
  const cleaned = String(v ?? "").replace(/[â‚¹,\s]/g,"");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};
const cleanMoneyInput = v => String(v ?? "").replace(/[^\d.]/g,"");
const normalizeIncomeTypeValue = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/&/g," and ")
  .replace(/[^\w\s-]/g,"")
  .replace(/[\s-]+/g,"_")
  .replace(/^_+|_+$/g,"");
const formatIncomeTypeLabel = value => {
  const normalized = normalizeIncomeTypeValue(value) || String(value ?? "").trim();
  return normalized
    .split("_")
    .filter(Boolean)
    .map(part=>part.charAt(0).toUpperCase()+part.slice(1))
    .join(" ");
};
const normalizeIncomeTypes = stored => Array.from(new Set(
  [...DEFAULT_INCOME_TYPES, ...(Array.isArray(stored) ? stored : [])]
    .map(normalizeIncomeTypeValue)
    .filter(Boolean)
));
const normalizeVendorText = value => String(value ?? "")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const VENDOR_CATEGORY_RULES = [
  { pattern: /swiggy|zomato|dominos|pizza|burger|starbucks|kfc|mcd|restaurant|cafe/, catId: "food", label: "food delivery / dining vendor" },
  { pattern: /uber|ola|rapido|petrol|fuel|shell|hpcl|iocl|parking|toll/, catId: "transport", label: "transport vendor" },
  { pattern: /amazon|flipkart|myntra|ajio|nykaa|meesho/, catId: "lifestyle", label: "shopping vendor" },
  { pattern: /apollo|pharmacy|medplus|hospital|clinic|diagnostic/, catId: "health", label: "health vendor" },
  { pattern: /airtel|jio|bsnl|wifi|broadband|electricity|water|gas/, catId: "utilities", label: "utility bill vendor" },
  { pattern: /netflix|spotify|hotstar|prime video|bookmyshow/, catId: "entertainment", label: "entertainment vendor" },
  { pattern: /blinkit|zepto|bigbasket|instamart|grofers/, catId: "groceries", label: "grocery vendor" },
];
const investmentFreqLabel = freq => {
  if(freq==="daily") return "Daily";
  if(freq==="weekly") return "Weekly";
  if(freq==="monthly") return "Monthly";
  if(freq==="halfyearly") return "Half-yearly";
  if(freq==="quarterly") return "Quarterly";
  if(freq==="yearly") return "Yearly";
  if(freq==="one-time") return "One-time";
  return "";
};
const daysInMonth = (monthKey) => {
  if(monthKey){
    const [y,m] = monthKey.split("-").map(Number);
    if(!y||!m) return 31;
    return new Date(y, m, 0).getDate();
  }
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth()+1, 0).getDate();
};
const daysLeft = (monthKey) => {
  const today = new Date();
  const nowKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  if(!monthKey || monthKey === nowKey){
    return Math.max(0, daysInMonth(nowKey) - today.getDate());
  }
  if(monthKey < nowKey) return 0;
  return daysInMonth(monthKey);
};
const toDateOnly = value => {
  if(!value) return null;
  const [y,m,d] = String(value).split("-").map(Number);
  if(!y||!m||!d) return null;
  return new Date(y, m-1, d, 12, 0, 0, 0);
};
const formatShortDate = value => {
  const d = toDateOnly(value);
  return d ? d.toLocaleDateString("en-IN", { day:"2-digit", month:"short" }) : "";
};
const isDateInRange = (txnDate, startDate, endDate) => {
  const txnTime = toDateOnly(txnDate)?.getTime();
  if(!txnTime) return !startDate && !endDate;
  const startTime = startDate ? toDateOnly(startDate)?.getTime() : null;
  const endTime = endDate ? toDateOnly(endDate)?.getTime() : null;
  if(startTime && txnTime < startTime) return false;
  if(endTime && txnTime > endTime) return false;
  return true;
};
const nearlyEqualMoney = (a,b) => Math.abs(Number(a||0) - Number(b||0)) < 0.01;
const dateAtDay = (year, monthIndex, day) => {
  const safeDay = Math.max(1, Number(day)||1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(safeDay, lastDay), 12, 0, 0, 0);
};
const getCardCycleDates = (card, refDate = new Date()) => {
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
const accIcon = t => t==="bank"?"🏦":t==="cc"?"ðŸ’³":t==="debit"?"🏧":t==="upi"?"ðŸ“±":"ðŸ’µ";
const accLabel = t => t==="bank"?"Bank":t==="cc"?"Credit Card":t==="debit"?"Debit":t==="upi"?"UPI":"Cash";
const txnColor = (txnOrType,T) => {
  const type = typeof txnOrType === "string" ? txnOrType : txnOrType?.type;
  const isRefund = typeof txnOrType === "object" && txnOrType?.type === "settlement_in" && txnOrType?.isRefund;
  if(isRefund) return T.text;
  if(type==="income") return T.success;
  if(type==="expense") return T.danger;
  if(type==="transfer" || type==="settlement_in" || type==="settlement_out") return T.info;
  if(type==="cc_payment") return T.purple;
  if(type==="investment") return T.info;
  return T.sub;
};
const txnLabel = txnOrType => {
  const type = typeof txnOrType === "string" ? txnOrType : txnOrType?.type;
  const isRefund = typeof txnOrType === "object" && txnOrType?.type === "settlement_in" && txnOrType?.isRefund;
  if(isRefund) return "Refund";
  return type==="income"?"Income":type==="transfer"?"Transfer":type==="cc_payment"?"CC Payment":type==="settlement_in"?"Settlement":type==="settlement_out"?"Settlement Out":type==="investment"?"Investment":"Expense";
};
const txnEmoji = txnOrType => {
  const type = typeof txnOrType === "string" ? txnOrType : txnOrType?.type;
  const isRefund = typeof txnOrType === "object" && txnOrType?.type === "settlement_in" && txnOrType?.isRefund;
  if(isRefund) return "â†©ï¸";
  return type==="income"?"ðŸ’š":type==="transfer"?"ðŸ”„":type==="cc_payment"?"ðŸ’³":type==="settlement_in"?"ðŸ”µ":type==="settlement_out"?"ðŸ“¤":type==="investment"?"ðŸ’¹":"ðŸ’¸";
};
const remainingShare = info => {
  if(!info) return 0;
  if(info.settled) return 0;
  return Math.max(0, Number(info?.remainingAmt ?? info?.amount ?? 0));
};
const linkedSettlementKey = t => t?.type==="settlement_in" && t?.againstTxnId
  ? [t.fromPersonId||"", t.againstTxnId||"", t.date||"", Number(t.amount||0), t.accId||""].join("|")
  : null;
const dedupeSettlementTxns = txns => {
  const seenLinked = new Set();
  const seenLegacy = new Set();
  return txns.filter(t=>{
    if(t.type!=="settlement_in") return true;
    const linkedKey = linkedSettlementKey(t);
    if(linkedKey){
      if(seenLinked.has(linkedKey)) return false;
      seenLinked.add(linkedKey);
      return true;
    }
    const legacyKey = `${t.fromPersonId||""}_${t.date||""}_${Number(t.amount||0)}`;
    if(seenLegacy.has(legacyKey)) return false;
    seenLegacy.add(legacyKey);
    return true;
  });
};
const CLOUD_SCHEMA_VERSION = 1;
const CAT_MAP = {"food":"food","grocery":"groceries","groceries":"groceries","transport":"transport","bills":"utilities","utilities":"utilities","health":"health","shopping":"lifestyle","household":"housing","selfcare":"lifestyle","baby":"family","entertainment":"entertainment","financial":"financial","fitness":"fitness","travel":"travel","misc":"misc","donations":"donations","professional":"professional","taxes":"taxes","emergency":"emergency","personaldev":"personaldev","family":"family","lifestyle":"lifestyle","housing":"housing"};
const normalizeCats = stored => {
  const list = Array.isArray(stored) ? stored : null;
  const hasLatestDefaults = list?.some(c=>c.id==="housing"||c.id==="utilities"||c.id==="financial");
  return hasLatestDefaults ? list : DEFAULT_CATS;
};
const normalizeAccounts = stored => (Array.isArray(stored) && stored.length ? stored : DEFAULT_ACCOUNTS).map(acc=>({
  ...acc,
  openingBalance:Number(acc?.openingBalance||0),
  openingBalanceDate:acc?.openingBalanceDate||"",
}));
const normalizePeople = stored => {
  const list = Array.isArray(stored) ? stored : [];
  return list.find(p=>p.id==="__me__") ? list : [ME, ...list];
};
const normalizeTxns = stored => {
  const list = Array.isArray(stored) ? stored : [];
  return dedupeSettlementTxns(list.map(t=>{
    const normalizedTxn = t.type==="settlement_in"
      ? { ...t, isRefund: t.isRefund ?? !t.fromPersonId }
      : t;
    const hasSplitPeople = normalizedTxn.type==="expense" && Object.entries(normalizedTxn.people||{}).some(([pid,info])=>pid!=="__me__" && info?.mode==="owes" && Number(info?.amount||0)>0);
    const trackingMode = normalizedTxn.type==="expense"
      ? (normalizedTxn.trackingMode || (hasSplitPeople ? "split" : (normalizedTxn.forPerson || normalizedTxn.groupId ? "tag" : "none")))
      : normalizedTxn.trackingMode;
    const preparedTxn = normalizedTxn.type==="expense"
      ? {
          ...normalizedTxn,
          trackingMode,
          groupCollectiveAmount: trackingMode==="split" ? Number(normalizedTxn.groupCollectiveAmount||0) : 0,
        }
      : normalizedTxn;
    if(!preparedTxn.catId) return preparedTxn;
    const catIdLower = String(preparedTxn.catId).toLowerCase();
    const newCat = CAT_MAP[catIdLower] || CAT_MAP[preparedTxn.catId];
    if(newCat) return {...preparedTxn,catId:newCat,catIds:preparedTxn.catIds?.map(c=>CAT_MAP[String(c).toLowerCase()]||c)||[newCat]};
    return {...preparedTxn,catId:preparedTxn.catId+"!",catIds:[preparedTxn.catId+"!"]};
  }));
};
const normalizeLoans = stored => (Array.isArray(stored) ? stored : []).map(loan=>({
  ...loan,
  direction:loan?.direction==="taken"?"taken":"given",
  principal:Number(loan?.principal ?? loan?.amount ?? 0),
  outstanding:Number(loan?.outstanding ?? loan?.principal ?? loan?.amount ?? 0),
  startDate:loan?.startDate || loan?.date || todayStr(),
  dueDate:loan?.dueDate || "",
  hasInterest:loan?.hasInterest ?? Number(loan?.interestRate||0)>0,
  interestRate:Number(loan?.interestRate||0),
  repayments:Array.isArray(loan?.repayments)?loan.repayments:[],
  status:loan?.status || (Number(loan?.outstanding ?? loan?.principal ?? loan?.amount ?? 0)<=0 ? "closed" : "active"),
}));
const formatSyncTime = value => {
  if(!value) return "Not yet synced";
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return "Not yet synced";
  return d.toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
};

// â”€â”€â”€ PIN SCREEN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PinScreen({ onUnlock, isSetup }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState("enter");
  const [error, setError] = useState("");
  const handleKey = k => {
    setError("");
    if(k==="del"){ step==="confirm"?setConfirm(p=>p.slice(0,-1)):setPin(p=>p.slice(0,-1)); return; }
    if(isSetup){
      if(step==="enter"){ const np=pin+k; setPin(np); if(np.length===4) setStep("confirm"); }
      else { const nc=confirm+k; setConfirm(nc); if(nc.length===4){ if(nc===pin) onUnlock(pin); else { setError("PINs don't match. Try again."); setPin(""); setConfirm(""); setStep("enter"); } } }
    } else { const np=pin+k; setPin(np); if(np.length===4){ onUnlock(np); setPin(""); } }
  };
  const cur = step==="confirm"?confirm:pin;
  return (
    <div style={{minHeight:"100vh",background:"#08080f",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"Nunito,sans-serif"}}>
      <div style={{fontSize:52,marginBottom:12,color:"#f0a500",fontWeight:900,fontFamily:"Nunito,sans-serif"}}>â‚¹</div>
      <div style={{color:"#f0a500",fontSize:30,fontWeight:900,marginBottom:6}}>Arth</div>
      <div style={{color:"#5a5a7a",fontSize:13,marginBottom:40,textAlign:"center"}}>{isSetup?step==="enter"?"Set your 4-digit PIN":"Confirm your PIN":"Enter your PIN"}</div>
      <div style={{display:"flex",gap:18,marginBottom:14}}>
        {[0,1,2,3].map(i=><div key={i} style={{width:18,height:18,borderRadius:"50%",background:cur.length>i?"#f0a500":"transparent",border:"2px solid",borderColor:cur.length>i?"#f0a500":"#2a2a3a",transition:"all 0.15s"}}/>)}
      </div>
      {error&&<div style={{color:"#ef4444",fontSize:12,marginBottom:14,textAlign:"center"}}>{error}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,width:252,marginTop:12}}>
        {["1","2","3","4","5","6","7","8","9","","0","del"].map((k,i)=>k===""?<div key={i}/>:
          <button key={i} onClick={()=>handleKey(k)} style={{background:"#0f0f1a",border:"1px solid #1a1a2e",borderRadius:14,padding:"19px 0",fontSize:k==="del"?18:24,fontWeight:700,color:k==="del"?"#5a5a7a":"#e8e4dc",cursor:"pointer",fontFamily:"Nunito,sans-serif"}}>{k==="del"?"⌫":k}</button>
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ ROOT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={hasError:false,error:""}; }
  static getDerivedStateFromError(e){ return {hasError:true,error:String(e)}; }
  componentDidCatch(e,info){ console.error("Arth error:",e,info); }
  render(){
    if(this.state.hasError) return (
      <div style={{minHeight:"100vh",background:"#08080f",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"Nunito,sans-serif"}}>
        <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
        <div style={{color:"#f0a500",fontSize:20,fontWeight:900,marginBottom:8}}>Something went wrong</div>
        <div style={{color:"#5a5a7a",fontSize:12,marginBottom:24,textAlign:"center",maxWidth:300}}>{this.state.error}</div>
        <button onClick={()=>this.setState({hasError:false,error:""})} style={{background:"#f0a500",color:"#000",border:"none",borderRadius:12,padding:"12px 24px",cursor:"pointer",fontSize:14,fontWeight:800,fontFamily:"Nunito,sans-serif"}}>Try Again</button>
      </div>
    );
    return this.props.children;
  }
}

export default function Arth() {
  const [appPin, setAppPin] = useState(()=>localStorage.getItem("arth_pin")||"");
  const [unlocked, setUnlocked] = useState(false);
  if(!appPin) return <PinScreen isSetup onUnlock={pin=>{localStorage.setItem("arth_pin",pin);setAppPin(pin);setUnlocked(true);}}/>;
  if(!unlocked) return <PinScreen isSetup={false} onUnlock={pin=>{ if(String(pin)===String(appPin)) setUnlocked(true); }}/>;
  return <ErrorBoundary><AppContent onLock={()=>setUnlocked(false)}/></ErrorBoundary>;
}

// â”€â”€â”€ APP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AppContent({ onLock }) {
  const [dark, setDark] = useState(()=>JSON.parse(localStorage.getItem("arth_dark")??"true"));
  const [autoDetectExpenseCategory, setAutoDetectExpenseCategory] = useState(()=>JSON.parse(localStorage.getItem("arth_auto_category")??"true"));
  const T = dark?DARK:LIGHT;
  useEffect(()=>localStorage.setItem("arth_dark",JSON.stringify(dark)),[dark]);
  useEffect(()=>localStorage.setItem("arth_auto_category",JSON.stringify(autoDetectExpenseCategory)),[autoDetectExpenseCategory]);

  // â”€â”€ STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [tab, setTab] = useState("home");
  const [viewMonth, setViewMonth] = useState(()=>{ const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });
  const [cats, setCats] = useState(()=>normalizeCats(JSON.parse(localStorage.getItem("arth_cats")||"null")));
  const [incomeTypes, setIncomeTypes] = useState(()=>normalizeIncomeTypes(JSON.parse(localStorage.getItem("arth_income_types")||"null")));
  const [accounts, setAccounts] = useState(()=>normalizeAccounts(JSON.parse(localStorage.getItem("arth_accounts")||"null")));
  const [balanceCheckpoints, setBalanceCheckpoints] = useState(()=>JSON.parse(localStorage.getItem("arth_checkpoints")||"{}"));
  const [people, setPeople] = useState(()=>normalizePeople(JSON.parse(localStorage.getItem("arth_people")||"[]")));
  const [groups, setGroups] = useState(()=>JSON.parse(localStorage.getItem("arth_groups")||"[]"));
  const [txns, setTxns] = useState(()=>normalizeTxns(JSON.parse(localStorage.getItem("arth_txns")||"[]")));
  const [investments, setInvestments] = useState(()=>JSON.parse(localStorage.getItem("arth_investments")||"[]"));
  const [bills, setBills] = useState(()=>JSON.parse(localStorage.getItem("arth_bills")||"[]"));
  const [liabilities, setLiabilities] = useState(()=>JSON.parse(localStorage.getItem("arth_liabilities")||"[]"));
  const [trackedAssets, setTrackedAssets] = useState(()=>JSON.parse(localStorage.getItem("arth_assets")||"[]"));
  const [loans, setLoans] = useState(()=>normalizeLoans(JSON.parse(localStorage.getItem("arth_loans")||"[]")));
  const [annualBudget, setAnnualBudget] = useState(()=>Number(localStorage.getItem("arth_annual_budget")||600000));
  const [monthOverrides, setMonthOverrides] = useState(()=>JSON.parse(localStorage.getItem("arth_month_overrides")||"{}"));
  const [monthBudget] = useState(()=>Number(localStorage.getItem("arth_budget")||50000));

  useEffect(()=>localStorage.setItem("arth_cats",JSON.stringify(cats)),[cats]);
  useEffect(()=>localStorage.setItem("arth_income_types",JSON.stringify(incomeTypes)),[incomeTypes]);
  useEffect(()=>localStorage.setItem("arth_accounts",JSON.stringify(accounts)),[accounts]);
  useEffect(()=>localStorage.setItem("arth_checkpoints",JSON.stringify(balanceCheckpoints)),[balanceCheckpoints]);
  useEffect(()=>localStorage.setItem("arth_people",JSON.stringify(people)),[people]);
  useEffect(()=>localStorage.setItem("arth_groups",JSON.stringify(groups)),[groups]);
  useEffect(()=>localStorage.setItem("arth_txns",JSON.stringify(txns)),[txns]);
  useEffect(()=>localStorage.setItem("arth_investments",JSON.stringify(investments)),[investments]);
  useEffect(()=>localStorage.setItem("arth_budget",monthBudget),[monthBudget]);
  useEffect(()=>localStorage.setItem("arth_bills",JSON.stringify(bills)),[bills]);
  useEffect(()=>localStorage.setItem("arth_liabilities",JSON.stringify(liabilities)),[liabilities]);
  useEffect(()=>localStorage.setItem("arth_assets",JSON.stringify(trackedAssets)),[trackedAssets]);
  useEffect(()=>localStorage.setItem("arth_loans",JSON.stringify(loans)),[loans]);
  useEffect(()=>localStorage.setItem("arth_annual_budget",annualBudget),[annualBudget]);
  useEffect(()=>localStorage.setItem("arth_month_overrides",JSON.stringify(monthOverrides)),[monthOverrides]);

  // â”€â”€ MODAL STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [showAdd, setShowAdd] = useState(false);
  const [defaultAddType, setDefaultAddType] = useState("expense");
  const [showInvestments, setShowInvestments] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [editingMonthBudget, setEditingMonthBudget] = useState(null); // month key
  const [editingMonthVal, setEditingMonthVal] = useState("");
  const [editingCheckpoint, setEditingCheckpoint] = useState(null); // account id
  const [editingCheckpointVal, setEditingCheckpointVal] = useState("");
  const [editingCheckpointDate, setEditingCheckpointDate] = useState(todayStr());
  const [editingOpeningBalanceVal, setEditingOpeningBalanceVal] = useState("");
  const [editingOpeningBalanceDate, setEditingOpeningBalanceDate] = useState(todayStr());
  const [editingBill, setEditingBill] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [editingTxn, setEditingTxn] = useState(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddInvestment, setShowAddInvestment] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState(null);
  const [showAddLiability, setShowAddLiability] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showAccDetail, setShowAccDetail] = useState(null);
  const [showWealthBreakdown, setShowWealthBreakdown] = useState(null);
  const [selectedInvestmentDetail, setSelectedInvestmentDetail] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState(null);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(null);
  const [confirmDeleteTxn, setConfirmDeleteTxn] = useState(null);
  const [billMatchSuggestion, setBillMatchSuggestion] = useState(null);
  const [refundMatchSuggestion, setRefundMatchSuggestion] = useState(null);
  const [refundSourceTxn, setRefundSourceTxn] = useState(null);
  const [budgetOverrideMonth, setBudgetOverrideMonth] = useState(null);
  const [budgetOverrideVal, setBudgetOverrideVal] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [settleTxn, setSettleTxn] = useState(null);
  const [expandedTxn, setExpandedTxn] = useState(null);
  const [fType, setFType] = useState("All");
  const [txnDateFrom, setTxnDateFrom] = useState("");
  const [txnDateTo, setTxnDateTo] = useState("");
  const [expenseSourceFilter, setExpenseSourceFilter] = useState("all");
  const [expenseCardFilter, setExpenseCardFilter] = useState("all");
  const [incomeTypeFilter, setIncomeTypeFilter] = useState("all");
  const [incomeAccountFilter, setIncomeAccountFilter] = useState("all");
  const [investmentTypeFilter, setInvestmentTypeFilter] = useState("all");
  const [editingLiability, setEditingLiability] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingLoan, setEditingLoan] = useState(null);
  const [repaymentLoan, setRepaymentLoan] = useState(null);
  const [showReceivablesList, setShowReceivablesList] = useState(false);

  const openInvestmentComposer = () => {
    setShowInvestments(false);
    setShowAddInvestment(false);
    setEditingInvestment(null);
    setDefaultAddType("investment");
    setShowAdd(true);
  };

  // â”€â”€ LOOKUPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const getCat = useCallback(id=>{
    if(!id) return {name:"?",color:"#888",icon:"â“",subs:[]};
    const matched = cats.find(c=>c.id===id || c.id.toLowerCase()===String(id).toLowerCase());
    return matched || {name:"?",color:"#888",icon:"â“",subs:[]};
  },[cats]);
  const getAcc = useCallback(id=>accounts.find(a=>a.id===id)||{name:"?",color:"#888",type:"cash"},[accounts]);
  const getPerson = useCallback(id=>people.find(p=>p.id===id)||{name:"?",emoji:"ðŸ‘¤",color:"#888",relation:"",personType:"contact"},[people]);
  const getGroup = useCallback(id=>groups.find(g=>g.id===id)||null,[groups]);
  const getRefundCandidates = useCallback((refundTxn, excludeRefundId = null)=>{
    if(!refundTxn || refundTxn.type!=="settlement_in" || !refundTxn.isRefund) return [];
    const refundAmt = Number(refundTxn.amount||0);
    if(!refundAmt) return [];
    const refundDate = toDateOnly(refundTxn.date) || new Date();
    const refundText = `${refundTxn.desc||""} ${refundTxn.merchant||""}`.toLowerCase();
    const linkedExpenseIds = new Set(
      txns
        .filter(t=>t.type==="settlement_in" && t.againstTxnId && String(t.id)!==String(excludeRefundId||refundTxn.id||""))
        .map(t=>String(t.againstTxnId))
    );

    return txns
      .filter(t=>t.type==="expense" && !linkedExpenseIds.has(String(t.id)) && nearlyEqualMoney(t.amount, refundAmt))
      .filter(t=>{
        const txnDate = toDateOnly(t.date);
        return !txnDate || txnDate <= refundDate;
      })
      .map(t=>{
        const txnText = `${t.desc||""} ${t.merchant||""}`.toLowerCase();
        const merchantMatch = refundText && txnText && (
          refundText.includes(txnText) ||
          txnText.includes(refundText) ||
          refundText.split(/\s+/).some(word=>word.length>3 && txnText.includes(word))
        );
        const txnDate = toDateOnly(t.date) || refundDate;
        const dayGap = Math.abs(Math.round((refundDate - txnDate)/(1000*60*60*24)));
        const score = (merchantMatch ? 12 : 0) + (t.accId && refundTxn.accId && t.accId===refundTxn.accId ? 5 : 0) + Math.max(0, 45 - Math.min(dayGap, 45));
        return { ...t, _refundScore:score, _dayGap:dayGap, _merchantMatch:merchantMatch };
      })
      .sort((a,b)=>b._refundScore-a._refundScore || new Date(b.date||0)-new Date(a.date||0))
      .slice(0,3);
  },[txns]);

  // â”€â”€ CURRENT MONTH FILTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cm = viewMonth;
  const thisMonthTxns = useMemo(()=>txns.filter(t=>t.date&&t.date.startsWith(cm)),[txns,cm]);
  const expenses = useMemo(()=>thisMonthTxns.filter(t=>t.type==="expense"),[thisMonthTxns]);
  const refundTotalsByExpense = useMemo(()=>txns.reduce((map,txn)=>{
    if(txn.type!=="settlement_in" || !txn.againstTxnId) return map;
    const key = String(txn.againstTxnId);
    map[key] = (map[key]||0) + Number(txn.amount||0);
    return map;
  },{}),[txns]);
  const getNetExpenseAmount = useCallback(expense=>Math.max(0, Number(expense?.amount||0) - Number(refundTotalsByExpense[String(expense?.id)]||0)),[refundTotalsByExpense]);
  const getGroupCollectiveDue = useCallback(expense=>{
    if(!expense?.groupId || expense?.type!=="expense") return 0;
    const hasIndividualReceivable = Object.entries(expense?.people||{}).some(([pid,info])=>pid!=="__me__" && info?.mode==="owes" && Number(info?.amount||0)>0 && !info?.settled);
    const trackingMode = expense?.trackingMode || (hasIndividualReceivable ? "split" : (expense?.forPerson || expense?.groupId ? "tag" : "none"));
    if(trackingMode!=="split") return 0;
    if(expense.groupCollectiveAmount !== undefined && expense.groupCollectiveAmount !== null){
      return Math.max(0, Number(expense.groupCollectiveAmount||0));
    }
    return hasIndividualReceivable ? 0 : Math.max(0, Number(expense.amount||0));
  },[]);
  const _getExpenseOutOfPocket = useCallback(expense=>{
    const othersOwed = Object.entries(expense?.people||{}).filter(([pid,info])=>info.mode==="owes"&&pid!=="__me__").reduce((sum,[,info])=>sum+Number(info.amount||0),0);
    const groupCollectiveDue = getGroupCollectiveDue(expense);
    return Math.max(0, getNetExpenseAmount(expense) - othersOwed - groupCollectiveDue);
  },[getNetExpenseAmount,getGroupCollectiveDue]);

  // â”€â”€ COMPUTED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const myActual = useMemo(()=>expenses.reduce((sum,expense)=>sum+getNetExpenseAmount(expense),0),[expenses,getNetExpenseAmount]);

  const totalIncome = useMemo(()=>thisMonthTxns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),[thisMonthTxns]);
  const totalInvested = useMemo(()=>thisMonthTxns.filter(t=>t.type==="investment").reduce((s,t)=>s+t.amount,0),[thisMonthTxns]);
  const trackedInvestments = useMemo(()=>{
    const txnsById = new Map(txns.map(t=>[String(t.id), t]));
    const saved = (investments||[]).flatMap(inv=>{
      const linkedTxn = inv.linkedTxnId ? txnsById.get(String(inv.linkedTxnId)) : null;
      if(inv.linkedTxnId && (!linkedTxn || linkedTxn.type!=="investment")) return [];
      return [{
        ...inv,
        linkedInvestmentId:inv.id,
        linkedTxnId:linkedTxn?.id ?? inv.linkedTxnId ?? null,
        type:linkedTxn?.investType || inv.type || "mf",
        name:linkedTxn?.desc || linkedTxn?.merchant || inv.name || "Investment",
        amount:Number(linkedTxn?.amount ?? inv.amount ?? 0),
        currentValue:Number(linkedTxn?.amount ?? inv.currentValue ?? inv.amount ?? 0),
        freq:linkedTxn?.investFreq || inv.freq || "",
        folioNo:String(linkedTxn?.investFolio ?? inv.folioNo ?? inv.folio ?? "").trim(),
        startDate:linkedTxn?.date || inv.startDate || todayStr(),
      }];
    });
    const knownTxnIds = new Set(saved.map(inv=>String(inv.linkedTxnId)).filter(Boolean));

    const derivedFromTxns = txns
      .filter(t=>t.type==="investment" && !knownTxnIds.has(String(t.id)))
      .map(t=>({
        id:`txn_${t.id}`,
        type:t.investType||"mf",
        name:t.desc||t.merchant||"Investment",
        amount:Number(t.amount||0),
        currentValue:Number(t.amount||0),
        freq:t.investFreq||"",
        folioNo:String(t.investFolio||"").trim(),
        startDate:t.date||todayStr(),
        linkedTxnId:t.id,
        linkedInvestmentId:t.linkedInvestmentId || null,
        source:"transaction",
      }));

    return [...saved, ...derivedFromTxns];
  },[investments,txns]);
  const investmentFolioGroups = useMemo(()=>{
    const map = new Map();
    trackedInvestments.forEach(inv=>{
      const useFolioGrouping = inv.type==="mf" && inv.folioNo;
      const key = useFolioGrouping ? `${inv.type}|${inv.folioNo}` : `${inv.type}|single|${inv.id}`;
      if(!map.has(key)){
        map.set(key, {
          id:key,
          type:inv.type,
          folioNo:useFolioGrouping ? inv.folioNo : "",
          primaryName:inv.name||"Investment",
          items:[],
          total:0,
        });
      }
      const group = map.get(key);
      group.items.push(inv);
      group.total += Number(inv.currentValue ?? inv.amount ?? 0);
    });
    return Array.from(map.values()).sort((a,b)=>b.total-a.total);
  },[trackedInvestments]);
  const monthlyInvestmentCommitment = useMemo(()=>trackedInvestments.reduce((sum,inv)=>inv.freq==="monthly"?sum+Number(inv.amount||0):sum,0),[trackedInvestments]);

  const getInvestmentTxn = useCallback(inv=>{
    const linkedTxnId = inv?.linkedTxnId || (String(inv?.id||"").startsWith("txn_") ? String(inv.id).slice(4) : "");
    return linkedTxnId ? txns.find(t=>String(t.id)===String(linkedTxnId)) || null : null;
  },[txns]);

  const removeTxnAndLinkedInvestment = useCallback(txn=>{
    if(!txn) return;
    if(getAcc(txn.accId)?.type==="cc" && txn.type==="expense"){
      setAccounts(prev=>prev.map(a=>a.id===txn.accId?{...a,outstanding:Math.max(0,(a.outstanding||0)-Number(txn.amount||0))}:a));
    }
    setTxns(prev=>prev.filter(x=>String(x.id)!==String(txn.id)));
    if(txn.type==="investment"){
      setInvestments(prev=>prev.filter(x=>String(x.id)!==String(txn.linkedInvestmentId||"") && String(x.linkedTxnId)!==String(txn.id)));
    }
  },[getAcc]);

  const removeInvestmentEntry = useCallback(inv=>{
    const linkedTxn = getInvestmentTxn(inv);
    if(linkedTxn){
      removeTxnAndLinkedInvestment(linkedTxn);
    } else {
      const targetId = inv?.linkedInvestmentId || inv?.id;
      setInvestments(prev=>prev.filter(x=>String(x.id)!==String(targetId)));
    }
    setSelectedInvestmentDetail(prev=>{
      if(!prev) return prev;
      const nextItems = prev.items.filter(item=>String(item.id)!==String(inv?.id));
      if(nextItems.length===0) return null;
      return {
        ...prev,
        items:nextItems,
        total:nextItems.reduce((sum,item)=>sum+Number(item.currentValue ?? item.amount ?? 0),0),
      };
    });
  },[getInvestmentTxn,removeTxnAndLinkedInvestment]);

  const openInvestmentEditor = useCallback(inv=>{
    const linkedTxn = getInvestmentTxn(inv);
    setSelectedInvestmentDetail(null);
    if(linkedTxn){
      setEditingTxn(linkedTxn);
      return;
    }
    const targetId = inv?.linkedInvestmentId || inv?.id;
    const sourceItem = investments.find(x=>String(x.id)===String(targetId)) || inv;
    setEditingInvestment(sourceItem);
    setShowAddInvestment(true);
  },[getInvestmentTxn,investments]);

  const byCat = useMemo(()=>cats.map(c=>({
    name:c.name,
    value:expenses.filter(e=>e.catId===c.id||(e.catIds&&e.catIds.includes(c.id))).reduce((sum,expense)=>{
      // If multiple cats, divide amount equally among them to avoid double counting
      const catCount=expense.catIds?.length||1;
      return sum+(getNetExpenseAmount(expense)/catCount);
    },0),
    color:c.color,id:c.id,icon:c.icon,budget:c.budget
  })).filter(c=>c.value>0),[expenses,cats,getNetExpenseAmount]);

  const settlements = useMemo(()=>{
    const receivables = {};
    const payables = {};

    txns.forEach(t=>{
      if(t.type==="expense"&&t.people){
        Object.entries(t.people).forEach(([pid,info])=>{
          if(pid==="__me__" || info.mode!=="owes" || info.settled) return;
          receivables[pid] = (receivables[pid]||0) + remainingShare(info);
        });
      }

      if(t.type==="settlement_in"&&t.fromPersonId&&Number(t.extraAmount||0)>0){
        payables[t.fromPersonId] = (payables[t.fromPersonId]||0) + Number(t.extraAmount||0);
      }

      if(t.type==="settlement_out"&&t.toPersonId){
        payables[t.toPersonId] = (payables[t.toPersonId]||0) + Number(t.amount||0);
      }
    });

    bills.forEach(b=>{
      if(b.status!=="unpaid" || !b.splitPeople) return;
      Object.entries(b.splitPeople).forEach(([pid,info])=>{
        if(pid==="__me__" || info.mode!=="owes" || info.settled) return;
        receivables[pid] = (receivables[pid]||0) + remainingShare(info);
      });
    });

    const ids = new Set([...Object.keys(receivables), ...Object.keys(payables)]);
    const map = {};
    ids.forEach(pid=>{
      map[pid] = {
        owesMe: Number(receivables[pid]||0),
        iOwe: Math.max(0, Number(payables[pid]||0)),
      };
    });

    return map;
  },[txns,bills]);

  const personSpend = useMemo(()=>{
    const map={};
    thisMonthTxns.forEach(t=>{
      if(t.type==="expense"&&t.forPerson){
        if(!map[t.forPerson]) map[t.forPerson]=0;
        map[t.forPerson]+=(t.tagPersonAmount||t.amount);
      }
    });
    return map;
  },[thisMonthTxns]);

  const directOwedToMe = useMemo(()=>Object.values(settlements).reduce((s,p)=>s+(p.owesMe||0),0),[settlements]);
  const receivablePeopleList = useMemo(()=>Object.entries(settlements)
    .filter(([,info])=>Number(info?.owesMe||0)>0)
    .map(([pid,info])=>({
      id:pid,
      person:getPerson(pid),
      amount:Number(info?.owesMe||0),
    }))
    .sort((a,b)=>b.amount-a.amount)
  ,[settlements,getPerson]);
  const monthlyReceivables = useMemo(()=>{
    const map = {};

    thisMonthTxns.forEach(t=>{
      if(t.type!=="expense" || !t.people) return;
      Object.entries(t.people).forEach(([pid,info])=>{
        if(pid==="__me__" || info.mode!=="owes" || info.settled) return;
        map[pid] = (map[pid]||0) + remainingShare(info);
      });
    });

    bills
      .filter(b=>b.status==="unpaid" && b.splitPeople)
      .filter(b=>(b.dueDate&&String(b.dueDate).startsWith(cm)) || (b.createdDate&&String(b.createdDate).startsWith(cm)))
      .forEach(b=>{
        Object.entries(b.splitPeople||{}).forEach(([pid,info])=>{
          if(pid==="__me__" || info.mode!=="owes" || info.settled) return;
          map[pid] = (map[pid]||0) + remainingShare(info);
        });
      });

    return map;
  },[thisMonthTxns,bills,cm]);
  const monthDirectOwedToMe = useMemo(()=>Object.values(monthlyReceivables).reduce((sum,amount)=>sum+Number(amount||0),0),[monthlyReceivables]);
  const monthlyReceivablePeopleList = useMemo(()=>Object.entries(monthlyReceivables)
    .filter(([,amount])=>Number(amount||0)>0)
    .map(([pid,amount])=>({
      id:pid,
      person:getPerson(pid),
      amount:Number(amount||0),
    }))
    .sort((a,b)=>b.amount-a.amount)
  ,[monthlyReceivables,getPerson]);
  const collectiveGroupReceivable = useMemo(()=>{
    const txnCollective = txns.reduce((sum,t)=>sum + getGroupCollectiveDue(t),0);
    const billCollective = bills.filter(b=>b.status==="unpaid").reduce((sum,b)=>sum + Number(b.groupCollectiveAmount||0),0);
    return txnCollective + billCollective;
  },[txns,bills,getGroupCollectiveDue]);
  const totalOwedToMe = useMemo(()=>directOwedToMe + collectiveGroupReceivable,[directOwedToMe,collectiveGroupReceivable]);
  const remaining = monthBudget-myActual;
  const safePerDay = monthBudget>0?Math.max(0,Math.round(remaining/Math.max(1,daysLeft()))):null;

  const expenseBaseTxns = useMemo(()=>txns.filter(t=>t.type==="expense" && isDateInRange(t.date, txnDateFrom, txnDateTo)),[txns,txnDateFrom,txnDateTo]);
  const incomeBaseTxns = useMemo(()=>txns.filter(t=>t.type==="income" && isDateInRange(t.date, txnDateFrom, txnDateTo)),[txns,txnDateFrom,txnDateTo]);
  const investmentBaseTxns = useMemo(()=>txns.filter(t=>t.type==="investment" && isDateInRange(t.date, txnDateFrom, txnDateTo)),[txns,txnDateFrom,txnDateTo]);

  const filteredTxns = useMemo(()=>[
    ...txns
  ].filter(t=>{
    if(fType!=="All" && t.type!==fType) return false;
    if(!isDateInRange(t.date, txnDateFrom, txnDateTo)) return false;

    if(fType==="expense"){
      const accType = accounts.find(a=>a.id===t.accId)?.type || "";
      if(expenseSourceFilter!=="all" && accType!==expenseSourceFilter) return false;
      if(expenseSourceFilter==="cc" && expenseCardFilter!=="all" && String(t.accId)!==String(expenseCardFilter)) return false;
    }

    if(fType==="income"){
      if(incomeTypeFilter!=="all" && normalizeIncomeTypeValue(t.incomeType||"salary")!==String(incomeTypeFilter)) return false;
      if(incomeAccountFilter!=="all" && String(t.accId||"")!==String(incomeAccountFilter)) return false;
    }

    if(fType==="investment" && investmentTypeFilter!=="all" && String(t.investType||"mf")!==String(investmentTypeFilter)) return false;

    return true;
  }).sort((a,b)=>{
    const da=new Date(a.date||0); const db=new Date(b.date||0);
    if(db - da !== 0) return db-da;
    return (b.id||0) - (a.id||0);
  }),[txns,fType,txnDateFrom,txnDateTo,accounts,expenseSourceFilter,expenseCardFilter,incomeTypeFilter,incomeAccountFilter,investmentTypeFilter]);

  const accountBalance = useCallback((accId, endDate=null)=>{
    const acc=accounts.find(a=>a.id===accId);
    if(!acc||acc.type==="cc") return 0;
    const openingDate = acc.openingBalanceDate || "";
    let bal=Number(acc.openingBalance||0);
    txns.forEach(t=>{
      if(!isDateInRange(t.date, openingDate, endDate)) return;
      if(t.type==="income"&&t.accId===accId) bal+=Number(t.amount||0);
      if(t.type==="settlement_in"&&t.accId===accId) bal+=Number(t.amount||0);
      if(t.type==="expense"){
        if(t.accId===accId) bal-=Number(t.amount||0);
        if(acc.type==="bank"){
          const linked=accounts.find(a=>a.type==="debit"&&a.linkedBank===accId);
          if(linked&&t.accId===linked.id) bal-=Number(t.amount||0);
        }
      }
      if(t.type==="transfer"&&t.fromAccId===accId) bal-=Number(t.amount||0);
      if(t.type==="transfer"&&t.toAccId===accId) bal+=Number(t.amount||0);
      if(t.type==="cc_payment"&&t.fromAccId===accId) bal-=Number(t.amount||0);
      if(t.type==="investment"&&t.accId===accId) bal-=Number(t.amount||0);
    });
    return bal;
  },[txns,accounts]);

  const bankBalance = useCallback(accId=>{
    const acc=accounts.find(a=>a.id===accId);
    if(!acc||acc.type!=="bank") return 0;
    return accountBalance(accId);
  },[accounts,accountBalance]);

  const cashBankTotal = useMemo(()=>accounts.filter(a=>a.type==="bank").reduce((sum,a)=>sum+accountBalance(a.id),0),[accounts,accountBalance]);
  const cashWalletTotal = useMemo(()=>accounts.filter(a=>a.type==="cash").reduce((sum,a)=>sum+accountBalance(a.id),0),[accounts,accountBalance]);
  const upiTotal = useMemo(()=>accounts.filter(a=>a.type==="upi").reduce((sum,a)=>sum+accountBalance(a.id),0),[accounts,accountBalance]);
  const liquidAssetsTotal = useMemo(()=>accounts.filter(a=>a.type!=="cc").reduce((sum,a)=>sum+accountBalance(a.id),0),[accounts,accountBalance]);
  const investmentAssetsTotal = useMemo(()=>trackedInvestments.reduce((sum,inv)=>sum+Number(inv.currentValue??inv.amount??0),0),[trackedInvestments]);
  const trackedAssetsTotal = useMemo(()=>trackedAssets.reduce((sum,a)=>sum+Number(a.currentValue||0),0),[trackedAssets]);
  const cardOutstanding = useCallback((cardId)=>{
    const spent = txns.reduce((sum,t)=>t.type==="expense" && t.accId===cardId ? sum + Number(t.amount||0) : sum,0);
    const paid = txns.reduce((sum,t)=>t.type==="cc_payment" && t.toAccId===cardId ? sum + Number(t.amount||0) : sum,0);
    const refunds = txns.reduce((sum,t)=>t.type==="settlement_in" && t.accId===cardId ? sum + Number(t.amount||0) : sum,0);
    return Math.max(0, spent - paid - refunds);
  },[txns]);
  const creditCardLiabilityTotal = useMemo(()=>accounts.reduce((sum,a)=>sum+(a.type==="cc"?cardOutstanding(a.id):0),0),[accounts,cardOutstanding]);
  const otherLiabilityTotal = useMemo(()=>liabilities.reduce((sum,l)=>sum+Number(l.outstanding||0),0),[liabilities]);
  const getCardSummary = useCallback((card)=>{
    const { prevStatementDate, lastStatementDate, nextStatementDate, dueOn } = getCardCycleDates(card, new Date());
    const totalOutstanding = cardOutstanding(card.id);
    const currentCycleSpend = Math.max(0, txns.reduce((sum,t)=>{
      if((t.type!=="expense" && t.type!=="settlement_in") || t.accId!==card.id) return sum;
      const txnDate = toDateOnly(t.date);
      if(!txnDate || !lastStatementDate || txnDate<=lastStatementDate) return sum;
      return sum + (t.type==="expense" ? Number(t.amount||0) : -Number(t.amount||0));
    },0));
    const currentDue = Math.max(0, totalOutstanding - currentCycleSpend);
    const alertPct = Number(card.alertPct ?? 30);
    const thresholdAmount = card.limit ? (Number(card.limit||0) * alertPct) / 100 : 0;
    const isOverAlert = Boolean(card.limit) && alertPct>0 && currentCycleSpend >= thresholdAmount && currentCycleSpend > 0;
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
    const daysToDue = Math.ceil((dueOn - todayMid) / (1000*60*60*24));
    return { prevStatementDate, lastStatementDate, nextStatementDate, dueOn, totalOutstanding, currentCycleSpend, currentDue, alertPct, thresholdAmount, isOverAlert, daysToDue };
  },[txns,cardOutstanding]);
  const groupReceivableTotal = useCallback(groupId=>{
    const txnOwed = txns.filter(t=>t.groupId===groupId&&t.type==="expense").reduce((sum,t)=>
      sum + Object.entries(t.people||{}).reduce((inner,[pid,info])=>{
        if(pid==="__me__" || info.mode!=="owes" || info.settled) return inner;
        return inner + remainingShare(info);
      },0) + getGroupCollectiveDue(t)
    ,0);
    const billOwed = bills.filter(b=>b.groupId===groupId&&b.status==="unpaid").reduce((sum,b)=>
      sum + Object.entries(b.splitPeople||{}).reduce((inner,[pid,info])=>{
        if(pid==="__me__" || info.mode!=="owes" || info.settled) return inner;
        return inner + remainingShare(info);
      },0) + Number(b.groupCollectiveAmount||0)
    ,0);
    // manualLimit is a soft spending cap but not owed amount.
    return txnOwed + billOwed;
  },[txns,bills,getGroupCollectiveDue]);

  const _groupReceivableTotalAll = useMemo(()=>groups.reduce((sum,g)=>sum+groupReceivableTotal(g.id),0),[groups,groupReceivableTotal]);
  const activeLoans = useMemo(()=>loans.filter(loan=>loan.status==="active" && Number(loan.outstanding||0)>0),[loans]);
  const loanGivenTotal = useMemo(()=>activeLoans.filter(loan=>loan.direction!=="taken").reduce((sum,loan)=>sum+Number(loan.outstanding||0),0),[activeLoans]);
  const loanTakenTotal = useMemo(()=>activeLoans.filter(loan=>loan.direction==="taken").reduce((sum,loan)=>sum+Number(loan.outstanding||0),0),[activeLoans]);
  const totalAssetsValue = liquidAssetsTotal + investmentAssetsTotal + trackedAssetsTotal + totalOwedToMe + loanGivenTotal;
  const totalLiabilitiesValue = creditCardLiabilityTotal + otherLiabilityTotal + loanTakenTotal;
  const netWorthValue = totalAssetsValue - totalLiabilitiesValue;

  // â”€â”€ STYLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const card = { background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:16, marginBottom:12 };
  const lbl = { color:T.sub, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1.2, display:"block", marginBottom:6 };
  const inp = { background:T.input, border:`1px solid ${T.border}`, borderRadius:10, padding:"11px 14px", color:T.text, fontSize:16, width:"100%", outline:"none", fontFamily:"Nunito,sans-serif", boxSizing:"border-box" };
  const inpSm = { background:T.input, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 10px", color:T.text, fontSize:16, outline:"none", fontFamily:"Nunito,sans-serif" };
  const btnP = { background:T.accent, color:"#000", border:"none", borderRadius:12, padding:13, cursor:"pointer", fontSize:14, fontWeight:800, width:"100%", fontFamily:"Nunito,sans-serif" };
  const btnG = { background:"none", border:`1px solid ${T.border}`, color:T.sub, borderRadius:12, padding:13, cursor:"pointer", fontSize:14, fontWeight:700, fontFamily:"Nunito,sans-serif" };
  const ttStyle = { background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px", fontSize:12, color:T.text };

  const Chip = ({ color, children, onClick, active }) => (
    <button onClick={onClick} style={{ background:active?color+"22":"none", border:`1px solid ${active?color:T.border}`, borderRadius:20, padding:"5px 12px", cursor:"pointer", fontSize:11, fontWeight:700, color:active?color:T.sub, whiteSpace:"nowrap", fontFamily:"Nunito,sans-serif" }}>{children}</button>
  );

  // â”€â”€ TXN ROW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const TxnRow = ({ t, last }) => {
    const cat = t.catId?getCat(t.catId):null;
    const invTypeMeta = t.type==="investment" ? INVEST_TYPES.find(i=>i.id===t.investType) : null;
    const acc = t.accId?getAcc(t.accId):t.fromAccId?getAcc(t.fromAccId):null;
    const color = t.type==="investment" ? (invTypeMeta?.color||txnColor(t,T)) : txnColor(t,T);
    const refundTone = t.type==="settlement_in" && t.isRefund ? txnColor(t,T) : T.info;
    const isPlus = t.type==="income"||t.type==="settlement_in";
    const isExpanded = expandedTxn===t.id;
    const owedPeople = t.type==="expense"?Object.entries(t.people||{}).filter(([pid,info])=>info.mode==="owes"&&!info.settled&&pid!=="__me__"&&remainingShare(info)>0):[];
    const groupCollectiveDue = t.type==="expense" ? getGroupCollectiveDue(t) : 0;
    const totalOwed = owedPeople.reduce((s,[,info])=>s+remainingShare(info),0) + groupCollectiveDue;
    const myShare = t.type==="expense"?Math.max(0, Number(t.amount||0)-Object.entries(t.people||{}).filter(([pid,info])=>info.mode==="owes"&&pid!=="__me__").reduce((s,[,info])=>s+Number(info.amount||0),0)-groupCollectiveDue):t.amount;
    const allSettled = t.type==="expense"&&Object.keys(t.people||{}).filter(p=>p!=="__me__").length>0&&Object.entries(t.people||{}).filter(([p])=>p!=="__me__").every(([,i])=>i.settled||i.mode!=="owes");
    const refundTarget = t.type==="settlement_in" && t.againstTxnId ? txns.find(x=>String(x.id)===String(t.againstTxnId)) : null;
    const linkedRefunds = t.type==="expense" ? txns.filter(x=>x.type==="settlement_in" && x.againstTxnId && String(x.againstTxnId)===String(t.id)) : [];
    const refundedAmount = linkedRefunds.reduce((sum,row)=>sum+Number(row.amount||0),0);
    const netAfterRefund = t.type==="expense" ? Math.max(0, Number(t.amount||0) - refundedAmount) : Number(t.amount||0);
    const refundStatus = refundedAmount<=0 ? "" : refundedAmount >= Number(t.amount||0) - 0.01 ? "Refunded" : "Partially Refunded";
    const dateLabel = t.date ? (() => {
      const d = new Date(t.date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = d.toLocaleString("en-GB", { month: "short" });
      return `${day}/${month}`;
    })() : "--";

    const deleteTxn = e => {
      e.stopPropagation();
      setConfirmDeleteTxn(t);
    };

    const writeOff = e => {
      e.stopPropagation();
      setTxns(p=>p.map(x=>x.id===t.id?{...x,writtenOff:true,people:Object.fromEntries(Object.entries(x.people||{}).map(([pid,info])=>[pid,{...info,settled:true}]))}:x));
      setExpandedTxn(null);
    };

    return (
      <div style={{ borderBottom:!last?`1px solid ${T.border}`:"none" }}>
        {/* COLLAPSED ROW */}
        <div onClick={()=>setExpandedTxn(isExpanded?null:t.id)} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 0", cursor:"pointer" }}>
          <div style={{ width:38,height:38,borderRadius:10,background:color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,position:"relative" }}>
            {t.type==="expense" && cat ? cat.icon : t.type==="investment" && invTypeMeta ? invTypeMeta.icon : txnEmoji(t)}
            {allSettled&&<div style={{position:"absolute",bottom:-3,right:-3,fontSize:9,background:T.card,borderRadius:"50%",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center"}}>âœ…</div>}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:t.writtenOff?T.sub:T.text, fontSize:13, fontWeight:700, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textDecoration:t.writtenOff?"line-through":"none" }}>
              {(t.type==="cc_payment"||t.type==="transfer")?t.desc||(t.merchant||"â€”"):(t.merchant||t.desc||"â€”")}
            </div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center", justifyContent:"flex-start" }}>
              {t.type==="expense"&&(
                <>
                  {(t.catIds?.length>0?t.catIds:t.catId?[t.catId]:[]).map(cid=>{
                    const c=getCat(cid); return <span key={cid} style={{ background:c.color+"20",color:c.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>{c.name.split(" ")[0]}</span>;
                  })}
                  {!t.catIds?.length&&t.catId&&cat&&<span style={{ background:cat.color+"20",color:cat.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>{cat.name.split(" ")[0]}</span>}
                </>
              )}
              {t.type==="investment"&&invTypeMeta&&<span style={{ background:invTypeMeta.color+"20",color:invTypeMeta.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>{invTypeMeta.icon} {invTypeMeta.name.split("/")[0]}</span>}
              {t.type==="investment"&&t.investFolio&&<span style={{ background:T.pill,color:T.sub,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>Folio {t.investFolio}</span>}
              {t.catAllocations&&Object.keys(t.catAllocations).length>0&&<span style={{ color:T.sub,fontSize:10 }}>{Object.entries(t.catAllocations).map(([cid,val])=>`${getCat(cid).name.split(" ")[0]} ${sym}${fmt(val)}`).join(" · ")}</span>}
              {acc&&<span style={{ color:T.sub,fontSize:10 }}>{accIcon(acc.type)} {acc.name}</span>}
              {totalOwed>0&&!allSettled&&<span style={{ color:T.accent,fontSize:10,fontWeight:700 }}>â†— {sym}{fmt(totalOwed)}</span>}
              {t.type==="settlement_in"&&t.isRefund&&<span style={{ background:refundTone+"18",color:refundTone,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>â†© Refund</span>}
              {t.type==="expense"&&refundedAmount>0&&<span style={{ background:T.info+"20",color:T.info,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>â†© {refundStatus}</span>}
              {t.imageBase64&&<span style={{ fontSize:10 }}>ðŸ“·</span>}
            </div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ color, fontSize:14, fontWeight:800 }}>{isPlus?"+":""}{sym}{fmt(t.amount)}</div>
            {t.type==="expense"&&refundedAmount>0&&<div style={{ color:T.info,fontSize:10,marginTop:1,fontWeight:700 }}>net {sym}{fmt(netAfterRefund)}</div>}
            {t.type==="expense"&&myShare>0&&myShare<t.amount&&<div style={{ color:T.sub,fontSize:10,marginTop:1 }}>mine {sym}{fmt(myShare)}</div>}
            <div style={{ color:T.sub,fontSize:10,marginTop:1 }}>{dateLabel}</div>
          </div>
          <div style={{ color:T.sub,fontSize:11,flexShrink:0 }}>{isExpanded?"â–²":"â–¼"}</div>
        </div>

        {/* EXPANDED DETAIL */}
        {isExpanded&&(
          <div style={{ background:T.input,borderRadius:12,padding:14,marginBottom:12 }}>
            <div style={{ color:T.text,fontSize:13,fontWeight:700,marginBottom:10 }}>{t.desc}</div>
            <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:10 }}>
              <span style={{ background:color+"20",color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{txnLabel(t)}</span>
              {t.type==="investment"&&invTypeMeta&&<span style={{ background:invTypeMeta.color+"20",color:invTypeMeta.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{invTypeMeta.icon} {invTypeMeta.name.split("/")[0]}</span>}
              {t.type==="investment"&&t.investFolio&&<span style={{ background:T.pill,color:T.sub,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>Folio {t.investFolio}</span>}
              {cat&&t.type==="expense"&&<span style={{ background:cat.color+"20",color:cat.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{cat.icon} {cat.name}</span>}
              {t.type==="expense"&&(t.subIds?.length>0?t.subIds:(t.subId?[t.subId]:[])).map(sid=>{
                const parentCat = cats.find(c=>c.subs?.some(s=>s.id===sid));
                const sub = parentCat?.subs?.find(s=>s.id===sid);
                if(!sub) return null;
                return <span key={sid} style={{ background:(parentCat?.color||"#888")+"20",color:(parentCat?.color||"#888"),borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{sub.name}</span>;
              })}
              {t.merchant&&t.type!=="cc_payment"&&t.type!=="transfer"&&<span style={{ background:T.pill,color:T.sub,borderRadius:20,padding:"2px 9px",fontSize:10 }}>@ {t.merchant}</span>}
              {acc&&<span style={{ background:acc.color+"20",color:acc.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{accIcon(acc.type)} {acc.name}</span>}
              {t.groupId&&getGroup(t.groupId)&&<span style={{ background:T.pill,color:T.sub,borderRadius:20,padding:"2px 9px",fontSize:10 }}>ðŸ‘¥ {getGroup(t.groupId).name}</span>}
              {allSettled&&<span style={{ background:T.success+"20",color:T.success,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>âœ… Settled</span>}
              {t.type==="settlement_in"&&t.isRefund&&<span style={{ background:refundTone+"18",color:refundTone,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>â†© Refund</span>}
              {t.type==="expense"&&refundedAmount>0&&<span style={{ background:T.info+"20",color:T.info,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>â†© {refundStatus}</span>}
              {t.writtenOff&&<span style={{ background:T.sub+"20",color:T.sub,borderRadius:20,padding:"2px 9px",fontSize:10 }}>Written off</span>}
              {t.smsRaw&&<span style={{ background:T.info+"20",color:T.info,borderRadius:20,padding:"2px 9px",fontSize:10 }}>ðŸ“± SMS</span>}
            {t.isBillPayment&&<span style={{ background:T.accent+"20",color:T.accent,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>🧾 Bill{t.billInvoiceNo?` #${t.billInvoiceNo}`:""}</span>}
            </div>
            {t.type==="expense"&&Object.keys(t.people||{}).filter(p=>p!=="__me__").length>0&&(
              <div style={{ marginBottom:10 }}>
                {Object.entries(t.people).filter(([p])=>p!=="__me__").map(([pid,info])=>{
                  const p=getPerson(pid);
                  return <div key={pid} style={{ fontSize:11,color:info.settled?T.sub:info.mode==="owes"?T.accent:T.sub,textDecoration:info.settled?"line-through":"none",marginBottom:2 }}>
                    {p.emoji} {p.name}: {sym}{fmt(info.settled ? info.amount : remainingShare(info))} {info.mode==="owes"?info.settled?"âœ… paid":"owes you":"on me"}
                  </div>;
                })}
              </div>
            )}
            {t.forPerson&&<div style={{ fontSize:11,color:"#ec4899",marginBottom:8 }}>ðŸ‘¤ for {getPerson(t.forPerson).name}{t.tagPersonAmount&&t.tagPersonAmount!==t.amount?` · ${sym}${fmt(t.tagPersonAmount)} tracked`:""}</div>}
            {t.type==="expense"&&groupCollectiveDue>0&&<div style={{ fontSize:11,color:T.info,marginBottom:8,fontWeight:700 }}>ðŸ‘¥ {getGroup(t.groupId)?.name||"Group"} collectively owes {sym}{fmt(groupCollectiveDue)}</div>}
            {t.note&&<div style={{ fontSize:11,color:T.sub,marginBottom:8 }}>ðŸ“ {t.note}</div>}
            {refundTarget&&<div style={{ fontSize:11,color:T.info,marginBottom:8,fontWeight:700 }}>â†© Linked expense: {refundTarget.desc||refundTarget.merchant||"Original spend"} · {formatShortDate(refundTarget.date)}</div>}
            {t.type==="expense"&&linkedRefunds.length>0&&<>
              <div style={{ fontSize:11,color:T.info,marginBottom:6,fontWeight:700 }}>â†© Linked refund{linkedRefunds.length>1?"s":""}: {linkedRefunds.map(row=>`${sym}${fmt(row.amount)} on ${formatShortDate(row.date)}`).join(" · ")}</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                {linkedRefunds.map(row=><button key={row.id} onClick={e=>{ e.stopPropagation(); setExpandedTxn(null); setEditingTxn(row); }} style={{ background:T.info+"14",border:`1px solid ${T.info}33`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.info,fontFamily:"Nunito,sans-serif" }}>â†© Open refund {sym}{fmt(row.amount)}</button>)}
              </div>
              <div style={{ fontSize:11,color:T.text,marginBottom:8,fontWeight:700 }}>Net after refund: {sym}{fmt(netAfterRefund)}</div>
            </>}
            {t.paidBillName&&<div style={{ fontSize:11,color:T.accent,marginBottom:8,fontWeight:700 }}>🧾 Pays: {t.paidBillName}{t.billInvoiceNo?` · #${t.billInvoiceNo}`:""}</div>}
            {t.imageBase64&&<img src={t.imageBase64} alt="receipt" style={{ width:"100%",borderRadius:8,maxHeight:140,objectFit:"cover",marginBottom:10 }} onError={e=>e.target.style.display="none"}/>}

            {/* Settlement buttons */}
            {owedPeople.length>0&&!t.writtenOff&&(
              <div style={{ marginBottom:10 }}>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8 }}>Pending: {sym}{fmt(totalOwed)}</div>
                <button onClick={e=>{e.stopPropagation();setSettleTxn(t);setExpandedTxn(null);}} style={{ background:T.success+"20",border:`1px solid ${T.success}44`,borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.success,fontFamily:"Nunito,sans-serif",width:"100%" }}>
                  ðŸ’° Settle with {owedPeople.map(([pid])=>getPerson(pid).name).join(", ")}
                </button>
              </div>
            )}
            {owedPeople.length>0&&!t.writtenOff&&(
              <div style={{ marginBottom:10 }}>
                <div style={{ color:T.sub,fontSize:11,marginBottom:6 }}>Can't collect? Write it off.</div>
                <button onClick={writeOff} style={{ background:"none",border:`1px solid ${T.sub}44`,borderRadius:20,padding:"5px 14px",cursor:"pointer",fontSize:11,color:T.sub,fontFamily:"Nunito,sans-serif" }}>✏️ Write off {sym}{fmt(totalOwed)}</button>
              </div>
            )}

            <div style={{ display:"flex",gap:8,paddingTop:8,borderTop:`1px solid ${T.border}` }}>
              <button onClick={e=>{e.stopPropagation();setEditingTxn(t);setExpandedTxn(null);}} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>✏️ Edit</button>
              <button onClick={deleteTxn} style={{ background:T.danger+"18",border:`1px solid ${T.danger}33`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.danger,fontFamily:"Nunito,sans-serif",marginLeft:"auto" }}>ðŸ—‘ Delete</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // â”€â”€ UNIQUE VENDORS FOR AUTOCOMPLETE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const uniqueVendors = useMemo(() => {
    const vendors = new Set();
    txns.forEach(t => {
      if (t.merchant && t.merchant.trim()) {
        vendors.add(t.merchant.trim());
      }
    });
    return Array.from(vendors).sort();
  }, [txns]);
  const incomeTypeOptions = useMemo(
    () => normalizeIncomeTypes([
      ...incomeTypes,
      ...txns.filter(t=>t.type==="income").map(t=>t.incomeType||"salary"),
    ]),
    [incomeTypes, txns]
  );

  // â”€â”€ ADD TRANSACTION MODAL (new flow) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const AddModal = ({ defaultType="expense", prefillTxn=null }) => {
    const refundPrefill = prefillTxn?.type==="expense" ? prefillTxn : null;
    const defaultAccId = accounts.find(a=>a.type==="upi")||accounts.find(a=>a.type==="cc")||accounts[0] ? (accounts.find(a=>a.type==="upi")||accounts.find(a=>a.type==="cc")||accounts[0])?.id : "";
    const initialRefundAmount = refundPrefill ? String(getNetExpenseAmount(refundPrefill) || Number(refundPrefill.amount||0) || "") : "";
    const [txnType, setTxnType] = useState(refundPrefill ? "settlement_in" : (defaultType||"expense"));
    const [incomeType, setIncomeType] = useState("salary");
    const [customIncomeType, setCustomIncomeType] = useState("");
    const incomeTypeChoices = normalizeIncomeTypes([...incomeTypeOptions, incomeType]);
    const addIncomeTypeOption = () => {
      const nextType = normalizeIncomeTypeValue(customIncomeType);
      if(!nextType) return;
      setIncomeTypes(prev=>normalizeIncomeTypes([...prev, nextType]));
      setIncomeType(nextType);
      setCustomIncomeType("");
    };
    const [who, setWho] = useState(refundPrefill?.merchant || refundPrefill?.desc || "");
    const [amount, setAmount] = useState(initialRefundAmount);
    const [date, setDate] = useState(todayStr());
    const [catIds, setCatIds] = useState([]);  // multiple categories
    const [subIds, setSubIds] = useState([]);  // multiple subcats
    const [accId, setAccId] = useState(refundPrefill?.accId || defaultAccId);
    const [fromAccId, setFromAccId] = useState(accounts.find(a=>a.type==="bank")?.id||"");
    const [toAccId, setToAccId] = useState(accounts.find(a=>a.type==="cc")?.id||"");
    const [note, setNote] = useState(refundPrefill ? `Refund for ${refundPrefill.desc||refundPrefill.merchant||"expense"}` : "");
    const [imageBase64, setImageBase64] = useState(null);
    const [smsRaw, setSmsRaw] = useState("");
    const [showSms, setShowSms] = useState(false);
    const [smsTxt, setSmsTxt] = useState("");
    const [splitMode, setSplitMode] = useState("none"); // none | split | tag
    const [splitGroup, setSplitGroup] = useState("");
    const [tagMode, setTagMode] = useState("person"); // person | group | both
    const [tagGroup, setTagGroup] = useState("");
    const [splitPeople, setSplitPeople] = useState({});
    const [splitCalc, setSplitCalc] = useState("equally"); // equally | amount | percent | share
    const [splitCustom, setSplitCustom] = useState({});
    const [tagPerson, setTagPerson] = useState("");
    const [collectMap, setCollectMap] = useState({});
    const [includeMeInSplit, setIncludeMeInSplit] = useState(true);
    const [catAllocations, setCatAllocations] = useState({});
    const [investType, setInvestType] = useState("mf");
    const [investFreq, setInvestFreq] = useState("");
    const [investFolio, setInvestFolio] = useState("");
    const [isBillPayment, setIsBillPayment] = useState(false);
    const [tagPersonAmount, setTagPersonAmount] = useState("");
    const [billInvoiceNo, setBillInvoiceNo] = useState("");
    const [settlementKind, setSettlementKind] = useState("refund");
    const closeModal = () => {
      setShowAdd(false);
      setRefundSourceTxn(null);
    };

    // Autocomplete state
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [categoryTouched, setCategoryTouched] = useState(false);
    const txnsSnapshot = txns;
    const catsSnapshot = cats;
    const autoDetectEnabled = autoDetectExpenseCategory;
    const filteredSuggestions = useMemo(() => {
      if (!who.trim() || txnType === "cc_payment" || txnType === "transfer") return [];
      return uniqueVendors.filter(v => v.toLowerCase().includes(who.toLowerCase())).slice(0, 5);
    }, [who, txnType]);
    const vendorCategorySuggestion = useMemo(() => {
      if(txnType !== "expense" || !autoDetectEnabled) return null;
      const vendorText = normalizeVendorText(who);
      if(!vendorText) return null;

      const rankedMatches = new Map();
      txnsSnapshot.forEach(txn => {
        if(txn.type !== "expense" || !txn.catId) return;
        const merchantText = normalizeVendorText(txn.merchant || txn.desc);
        if(!merchantText) return;

        let score = 0;
        if(merchantText === vendorText) score = 10;
        else if(merchantText.startsWith(vendorText) || vendorText.startsWith(merchantText)) score = 6;
        else if(merchantText.includes(vendorText) || vendorText.includes(merchantText)) score = 3;
        if(!score) return;

        const key = `${txn.catId}__${txn.subId || ""}`;
        const existing = rankedMatches.get(key) || {
          catId: txn.catId,
          subId: txn.subId || null,
          score: 0,
          hits: 0,
          reason: "your previous expense history",
        };
        existing.score += score;
        existing.hits += 1;
        rankedMatches.set(key, existing);
      });

      const topMatch = [...rankedMatches.values()]
        .filter(item=>catsSnapshot.some(cat=>cat.id===item.catId))
        .sort((a,b)=>b.score-a.score || b.hits-a.hits)[0];
      if(topMatch) return topMatch;

      const keywordMatch = VENDOR_CATEGORY_RULES.find(rule=>rule.pattern.test(vendorText));
      if(keywordMatch && catsSnapshot.some(cat=>cat.id===keywordMatch.catId)){
        return {
          catId: keywordMatch.catId,
          subId: null,
          score: 1,
          hits: 1,
          reason: keywordMatch.label,
        };
      }
      return null;
    }, [who, txnType, txnsSnapshot, catsSnapshot, autoDetectEnabled]);
    const applySuggestedExpenseCategory = useCallback((suggestion, markTouched=false) => {
      if(!suggestion || txnType !== "expense") return;
      setCatIds([suggestion.catId]);
      setSubIds(suggestion.subId ? [suggestion.subId] : []);
      setCatAllocations({});
      if(markTouched) setCategoryTouched(true);
    }, [txnType]);

    useEffect(() => {
      if(txnType !== "expense" || categoryTouched || !vendorCategorySuggestion) return;
      const sameCat = catIds.length===1 && catIds[0]===vendorCategorySuggestion.catId;
      const sameSub = (subIds[0]||null)===(vendorCategorySuggestion.subId||null);
      if(!sameCat || !sameSub) applySuggestedExpenseCategory(vendorCategorySuggestion);
    }, [vendorCategorySuggestion, txnType, categoryTouched, catIds, subIds, applySuggestedExpenseCategory]);

    const catId = catIds[0]||null;  // primary cat for backward compat
    const nonCCAccs = accounts.filter(a=>a.type!=="cc");
    const ccAccs = accounts.filter(a=>a.type==="cc");
    const selectedPids = Object.entries(splitPeople).filter(([,v])=>v).map(([k])=>k).filter(p=>p!=="__me__");
    const amt = parseFloat(amount)||0;

    // Auto-select group members when group selected
    const handleGroupSelect = gid => {
      setSplitGroup(gid);
      setSplitMode("split");
      if(!gid){
        setSplitPeople({});
        setIncludeMeInSplit(true);
        return;
      }
      // Selecting a group should not assume everyone owes a share.
      // Leave members unselected by default so the amount can be tracked
      // as a collective house/group due unless the user picks individuals.
      setSplitPeople({});
      setIncludeMeInSplit(false);
    };

    const calcShares = () => {
      if(!selectedPids.length) return {};
      const shares = {};
      if(splitCalc==="equally"){
        const total = selectedPids.length+(includeMeInSplit?1:0);
        const sh = total>0?Math.round(amt/total*100)/100:0;
        selectedPids.forEach(pid=>shares[pid]=sh);
      } else if(splitCalc==="amount"){
        selectedPids.forEach(pid=>shares[pid]=parseFloat(splitCustom[pid])||0);
      } else if(splitCalc==="percent"){
        selectedPids.forEach(pid=>{ const pct=parseFloat(splitCustom[pid])||0; shares[pid]=Math.round(amt*pct/100*100)/100; });
      } else if(splitCalc==="share"){
        const totalShares=selectedPids.reduce((s,pid)=>s+(parseFloat(splitCustom[pid])||1),0)+1;
        selectedPids.forEach(pid=>{ const sh=parseFloat(splitCustom[pid])||1; shares[pid]=Math.round(amt*sh/totalShares*100)/100; });
      }
      return shares;
    };

    const parseSms = txt => {
      setSmsRaw(txt);
      // Strip everything from warning phrases onwards
      const safe = txt.replace(/not you[?.]?.*/i,"").replace(/call.*\d{10}.*/i,"").replace(/helpline.*/i,"").replace(/block.*/i,"").replace(/to dispute.*/i,"").replace(/report.*/i,"").replace(/\d{10,}/g,"");
      const amtM=safe.match(/(?:Rs\.?|INR|\u20b9)\s*([\d,]+(?:\.\d{1,2})?)/i);
      if(amtM) setAmount(amtM[1].replace(/,/g,""));
      const clean=safe;
      const mercM=clean.match(/(?:at|to|for|towards)\s+([A-Za-z0-9][A-Za-z0-9 ]{2,25}?)(?:\s+on|\s+via|\s+ref|\.|,|$)/i);
      const skip=["a/c","ac","account","bank","clearing","neft","imps","upi","ref","txn"];
      const merchant=mercM?.[1]?.trim();
      if(merchant&&!skip.some(w=>merchant.toLowerCase().includes(w))&&txnType!=="cc_payment"&&txnType!=="transfer") setWho(merchant);
      const dateM=txt.match(/(\d{2}[-/]\d{2}[-/]\d{2,4})/);
      if(dateM){ try{ const p=dateM[1].split(/[-/]/); if(p[2].length===2) p[2]="20"+p[2]; setDate(p[2]+"-"+p[1].padStart(2,"0")+"-"+p[0].padStart(2,"0")); }catch{ /* ignore invalid parsed date */ } }
      // Detect transfer pattern
      if(txt.match(/to a\/c|transferred to|sent to/i)) setTxnType("transfer");
      if(txt.match(/bill pay|billpay|credit card.*pay|cc.*pay/i)) { setTxnType("cc_payment"); setWho(""); }
    };

    const submit = () => {
      if(!who.trim()||!amt) return;
      const base = { id:Date.now(), type:txnType, desc:who.trim(), merchant:who.trim(), date, note:note.trim(), smsRaw, imageBase64 };
      if(txnType==="expense"){
        const shares = splitMode==="split"?calcShares():{};
        const psplit = {};
        Object.entries(shares).forEach(([pid,sh])=>{
          const collect = collectMap[pid]!==undefined ? collectMap[pid] : getPerson(pid).personType!=="dependant";
          psplit[pid] = { amount:sh, mode:collect?"owes":"spent_on" };
        });
        const tagAmt=(splitMode==="tag" && (tagMode==="person"||tagMode==="both") && tagPersonAmount && parseFloat(tagPersonAmount)>0) ? parseFloat(tagPersonAmount) : (splitMode==="tag" && (tagMode==="person"||tagMode==="both") ? amt : null);
        const forPersonVal = splitMode==="tag" && (tagMode==="person"||tagMode==="both") ? tagPerson : "";
        const groupIdVal = splitMode==="split" ? (splitGroup||null) : (splitMode==="tag" && (tagMode==="group"||tagMode==="both") ? (tagGroup||null) : null);
        const catAllocNumeric = Object.fromEntries(Object.entries(catAllocations||{}).map(([cid,val])=>[cid,parseFloat(val)||0]));
        const hasCategorySplit = catIds.length>1 && Object.values(catAllocNumeric).reduce((s,v)=>s+v,0) === amt;
        const txnId = Date.now();
        const matchedBill = bills.find(b=>b.status==="unpaid"&&b.catId===catId&&b.amount>0&&b.amount===amt);
        const owedByOthers = Object.entries(psplit).reduce((sum,[,info])=>sum+(info.mode==="owes"?Number(info.amount||0):0),0);
        const myImplicitShare = splitMode==="split" && includeMeInSplit ? Math.max(0, amt-owedByOthers) : 0;
        const groupCollectiveAmount = groupIdVal && splitMode==="split"
          ? Math.max(0, amt-owedByOthers-myImplicitShare)
          : 0;
        const linkedBillId = isBillPayment ? (matchedBill?.id || genId()) : null;
        const linkedBillName = isBillPayment ? (matchedBill?.name || who.trim() || note.trim() || "Bill payment") : null;
        const newTxn = {
          ...base,
          id:txnId,
          amount:amt,
          catId,
          catIds,
          subIds,
          subId:subIds[0]||null,
          accId,
          isBillPayment,
          billInvoiceNo:billInvoiceNo.trim()||null,
          paidBillId:linkedBillId,
          paidBillName:linkedBillName,
          tagPersonAmount:tagAmt,
          people:splitMode==="split"?psplit:{},
          forPerson:forPersonVal,
          groupId:groupIdVal,
          trackingMode:splitMode,
          groupCollectiveAmount,
          catAllocations:hasCategorySplit?catAllocNumeric:null
        };
        setTxns(p=>[newTxn,...p]);
        if(getAcc(accId).type==="cc") setAccounts(prev=>prev.map(a=>a.id===accId?{...a,outstanding:(a.outstanding||0)+amt}:a));

        if(isBillPayment){
          const billRecord = {
            id:linkedBillId,
            name:linkedBillName,
            merchant:who.trim()||"",
            invoiceNo:billInvoiceNo.trim(),
            amount:amt,
            dueDate:date,
            catId,
            catIds,
            subId:subIds[0]||null,
            recurring:matchedBill?.recurring||false,
            frequency:matchedBill?.frequency||"monthly",
            status:"paid",
            paidDate:date,
            createdDate:matchedBill?.createdDate||todayStr(),
            splitPeople:splitMode==="split"?psplit:(matchedBill?.splitPeople||{}),
            groupId:groupIdVal||matchedBill?.groupId||null,
            groupCollectiveAmount:groupCollectiveAmount || Number(matchedBill?.groupCollectiveAmount||0),
            myShare:myImplicitShare,
            paidByTxnId:txnId,
            imageBase64:matchedBill?.imageBase64||null,
          };
          setBills(prev=>prev.some(b=>b.id===linkedBillId)
            ? prev.map(b=>b.id===linkedBillId?{...b,...billRecord}:b)
            : [billRecord,...prev]
          );
        } else if(matchedBill){
          setBillMatchSuggestion({bill:matchedBill,txn:newTxn});
        }
      } else if(txnType==="income"){
        setTxns(p=>[{...base,amount:amt,accId,catId:null,incomeType:normalizeIncomeTypeValue(incomeType)||"salary"},...p]);
      } else if(txnType==="transfer"){
        setTxns(p=>[{...base,amount:amt,fromAccId,toAccId,catId:null},...p]);
      } else if(txnType==="cc_payment"){
        setTxns(p=>[{...base,amount:amt,fromAccId,toAccId,catId:null},...p]);
        setAccounts(prev=>prev.map(a=>a.id===toAccId?{...a,outstanding:Math.max(0,(a.outstanding||0)-amt)}:a));
      } else if(txnType==="investment"){
        const txnId = Date.now();
        const invId = genId();
        const folioNo = investFolio.trim();
        const inv = { id:invId, type:investType, name:who.trim()||"Investment", amount:amt, currentValue:amt, freq:investFreq||"", folioNo, startDate:date, linkedTxnId:txnId };
        setInvestments(p=>[inv,...p]);
        setTxns(p=>[{...base,id:txnId,amount:amt,accId,investType,investFreq:investFreq||"",investFolio:folioNo,catId:null,linkedInvestmentId:invId},...p]);
      } else if(txnType==="settlement_in"){
        const linkedExpenseId = settlementKind==="refund" ? (refundPrefill?.id || null) : null;
        const linkedRefundNote = linkedExpenseId
          ? [note.trim(), `Linked refund for ${refundPrefill?.desc||refundPrefill?.merchant||"expense"}`].filter(Boolean).join(" · ")
          : note.trim();
        const newTxn = { ...base, amount:amt, accId, fromPersonId:tagPerson||null, catId:null, note:linkedRefundNote, isRefund:settlementKind==="refund", againstTxnId:linkedExpenseId };
        setTxns(p=>[newTxn,...p]);
        if(newTxn.isRefund && !newTxn.againstTxnId){
          const matches = getRefundCandidates(newTxn);
          if(matches.length) setRefundMatchSuggestion({ refundTxn:newTxn, matches });
        }
      }
      closeModal();
    };

    const canSubmit = (who.trim()||txnType==="cc_payment"||txnType==="transfer"||txnType==="settlement_in")&&amt>0;

    return (
      <div onClick={e=>e.target===e.currentTarget&&closeModal()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"94vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{refundPrefill?"Add Refund":"Add Transaction"}</div>
            <button onClick={closeModal} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>

          {/* STEP 1 â€” TYPE */}
          <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" }}>
            {[["expense","ðŸ’¸","Expense",T.danger],["income","ðŸ’š","Income",T.success],["investment","ðŸ’¹","Invest",T.info],["transfer","ðŸ”„","Transfer",T.info],["cc_payment","ðŸ’³","CC Pay",T.purple],["settlement_in","âœ…","Settlement",T.info]].map(([v,ic,lb,col])=>(
              <button key={v} onClick={()=>{ setTxnType(v); if(v==="cc_payment"||v==="transfer") setWho(""); }} style={{ flex:1,background:txnType===v?col+"22":"none",border:`1px solid ${txnType===v?col:T.border}`,borderRadius:10,padding:"8px 4px",cursor:"pointer",fontSize:9,fontWeight:700,color:txnType===v?col:T.sub,fontFamily:"Nunito,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
                <span style={{ fontSize:16 }}>{ic}</span>{lb}
              </button>
            ))}
          </div>

          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            {/* STEP 2 â€” WHO + AMOUNT + DATE */}
            {(txnType!=="cc_payment"&&txnType!=="transfer")&&(
              <div style={{ position:"relative" }}>
                <input 
                  style={{ ...inp, fontSize:18, fontWeight:700, border:`1px solid ${!who.trim()&&txnType!=="transfer"&&txnType!=="settlement_in"?T.danger+"66":T.border}` }} 
                  placeholder={txnType==="income"?"Source (e.g. Salary, Freelance)":txnType==="settlement_in"?"Refund / settlement note (store, app, person, etc.)":txnType==="investment"?"Investment name *":"Vendor / Person / Place *"} 
                  value={who} 
                  onChange={e=>{setWho(e.target.value); setShowSuggestions(true);}}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div style={{ position:"absolute", top:"100%", left:0, right:0, background:T.card, border:`1px solid ${T.border}`, borderRadius:8, zIndex:1000, maxHeight:200, overflowY:"auto", boxShadow:"0 4px 12px rgba(0,0,0,0.15)" }}>
                    {filteredSuggestions.map((suggestion, index) => (
                      <button 
                        key={index} 
                        onClick={() => { setWho(suggestion); setShowSuggestions(false); }}
                        style={{ width:"100%", padding:"10px 14px", background:"none", border:"none", textAlign:"left", cursor:"pointer", fontSize:14, color:T.text, fontFamily:"Nunito,sans-serif", borderBottom:index < filteredSuggestions.length - 1 ? `1px solid ${T.border}` : "none" }}
                        onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                {txnType==="expense" && vendorCategorySuggestion && (()=>{
                  const suggestedCat = getCat(vendorCategorySuggestion.catId);
                  if(!suggestedCat) return null;
                  const suggestedSub = vendorCategorySuggestion.subId ? suggestedCat.subs?.find(sub=>sub.id===vendorCategorySuggestion.subId) : null;
                  const isApplied = catIds.length===1 && catIds[0]===vendorCategorySuggestion.catId && (subIds[0]||null)===(vendorCategorySuggestion.subId||null);
                  return (
                    <div style={{ color:isApplied?T.success:T.info,fontSize:10,marginTop:6,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                      <span>{isApplied?"✨ Auto-selected":"✨ Suggested"} {suggestedCat.icon} {suggestedCat.name}{suggestedSub?` â†’ ${suggestedSub.name}`:""} based on {vendorCategorySuggestion.reason}.</span>
                      {!isApplied && <button onClick={()=>applySuggestedExpenseCategory(vendorCategorySuggestion,true)} style={{ background:"none",border:`1px solid ${T.info}44`,borderRadius:12,padding:"2px 8px",cursor:"pointer",fontSize:10,color:T.info,fontFamily:"Nunito,sans-serif" }}>Use</button>}
                    </div>
                  );
                })()}
              </div>
            )}
            {(txnType==="cc_payment"||txnType==="transfer")&&<input style={inp} placeholder="Note (optional)" value={who} onChange={e=>setWho(e.target.value)}/>}

            <div style={{ display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:10 }}>
              <div>
                <span style={lbl}>Amount ({sym}) *</span>
                <input style={{ ...inp,fontSize:22,fontWeight:800,textAlign:"center" }} type="text" inputMode="decimal" placeholder={`e.g. ${sym}5,500`} value={amount?fmt(parseMoney(amount)):""} onChange={e=>setAmount(cleanMoneyInput(e.target.value))}/>
              </div>
              <div>
                <span style={lbl}>Date</span>
                <input style={inp} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
              </div>
            </div>

            {/* STEP 3 â€” PAYMENT METHOD */}
            {txnType==="expense"&&(
              <div>
                <span style={lbl}>Paid via</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {accounts.map(a=>(
                    <button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>
                  ))}
                </div>
              </div>
            )}
            {txnType==="income"&&(
              <div>
                <span style={lbl}>Income type</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                  {incomeTypeChoices.map(type=>(
                    <button key={type} onClick={()=>setIncomeType(type)} style={{ background:incomeType===type?T.accent+"22":"none",border:`1px solid ${incomeType===type?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:incomeType===type?T.accent:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{formatIncomeTypeLabel(type)}</button>
                  ))}
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:10 }}>
                  <input style={inpSm} placeholder="Add custom income type" value={customIncomeType} onChange={e=>setCustomIncomeType(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addIncomeTypeOption(); } }}/>
                  <button onClick={addIncomeTypeOption} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,color:T.accent,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>+ Type</button>
                </div>
                <span style={lbl}>Into account</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {nonCCAccs.map(a=><button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
                </div>
              </div>
            )}
            {(txnType==="transfer"||txnType==="cc_payment")&&(
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div><span style={lbl}>From</span><select style={inp} value={fromAccId} onChange={e=>setFromAccId(e.target.value)}>{(txnType==="cc_payment"?nonCCAccs:accounts).map(a=><option key={a.id} value={a.id}>{accIcon(a.type)} {a.name}</option>)}</select></div>
                <div><span style={lbl}>To</span><select style={inp} value={toAccId} onChange={e=>setToAccId(e.target.value)}>{(txnType==="cc_payment"?ccAccs:accounts).map(a=><option key={a.id} value={a.id}>{accIcon(a.type)} {a.name}</option>)}</select></div>
              </div>
            )}
            {txnType==="investment"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                <div>
                  <span style={lbl}>Type</span>
                  <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                    {INVEST_TYPES.map(it=><Chip key={it.id} color={it.color} active={investType===it.id} onClick={()=>setInvestType(it.id)}>{it.icon} {it.name.split("/")[0]}</Chip>)}
                  </div>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:investType==="mf"?"1fr 1fr":"1fr",gap:10 }}>
                  {investType==="mf"&&<div>
                    <span style={lbl}>Folio No.</span>
                    <input style={inp} placeholder="Optional folio number" value={investFolio} onChange={e=>setInvestFolio(e.target.value)}/>
                  </div>}
                  <div>
                    <span style={lbl}>Frequency</span>
                    <select style={{ ...inp,background:"#fff",color:"#111" }} value={investFreq} onChange={e=>setInvestFreq(e.target.value)}>
                      <option value="" style={{ background:"#fff",color:"#111" }}>One-time / not fixed</option>
                      <option value="monthly" style={{ background:"#fff",color:"#111" }}>Monthly</option>
                      <option value="weekly" style={{ background:"#fff",color:"#111" }}>Weekly</option>
                      <option value="daily" style={{ background:"#fff",color:"#111" }}>Daily</option>
                      <option value="quarterly" style={{ background:"#fff",color:"#111" }}>Quarterly</option>
                      <option value="halfyearly" style={{ background:"#fff",color:"#111" }}>Half-yearly</option>
                      <option value="yearly" style={{ background:"#fff",color:"#111" }}>Yearly</option>
                    </select>
                  </div>
                </div>
                <div>
                  <span style={lbl}>Invested from</span>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {nonCCAccs.map(a=><button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
                  </div>
                </div>
                <div style={{ color:T.sub,fontSize:10 }}>This one entry logs the transaction and also updates your investment holdings.</div>
              </div>
            )}
            {txnType==="settlement_in"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {refundPrefill&&(
                  <div style={{ background:T.input,border:`1px solid ${T.info}33`,borderRadius:12,padding:"10px 12px" }}>
                    <div style={{ color:T.text,fontSize:12,fontWeight:800,marginBottom:4 }}>â†© Refund linked to original expense</div>
                    <div style={{ color:T.sub,fontSize:11 }}>{refundPrefill.desc||refundPrefill.merchant||"Expense"} · {sym}{fmt(refundPrefill.amount||0)}{refundPrefill.accId?` · ${getAcc(refundPrefill.accId).name}`:""}</div>
                  </div>
                )}
                <div>
                  <span style={lbl}>Tag this inflow as</span>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                    {[{id:"refund",label:"â†© Refund",color:T.text},{id:"repayment",label:"ðŸ’° Repayment",color:T.info}].map(opt=>(
                      <button key={opt.id} onClick={()=>setSettlementKind(opt.id)} style={{ background:settlementKind===opt.id?opt.color+"22":"none",border:`1px solid ${settlementKind===opt.id?opt.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:settlementKind===opt.id?opt.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span style={lbl}>Link to contact (optional â€” only for people repayments)</span>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    <button onClick={()=>{ setTagPerson(""); setSettlementKind("refund"); }} style={{ background:!tagPerson?"#88888822":"none",border:`1px solid ${!tagPerson?"#888":T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>No contact / merchant refund</button>
                    {people.filter(p=>!p.isMe).map(p=><button key={p.id} onClick={()=>{ setTagPerson(p.id); setSettlementKind("repayment"); if(!who.trim()) setWho(p.name); }} style={{ background:tagPerson===p.id?p.color+"22":"none",border:`1px solid ${tagPerson===p.id?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:tagPerson===p.id?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>)}
                  </div>
                  <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>{settlementKind==="refund" ? "If the amount matches an earlier expense, Arth will ask whether this is the original spend." : "Use this for money received from a person. Link a contact when relevant."}</div>
                </div>
                <div>
                  <span style={lbl}>Received into</span>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {accounts.map(a=><button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
                  </div>
                  <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>Choose the same credit card here if the refund came back to the card, so liability reduces correctly.</div>
                </div>
              </div>
            )}

            {/* STEP 4 â€” CATEGORY (expense only) */}
            {txnType==="expense"&&(
              <div>
                <span style={lbl}>Categories (select one or more)</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  <button onClick={()=>{ setCategoryTouched(true); setCatIds([]); setSubIds([]); }} style={{ background:!catId?"#88888822":"none",border:`1px solid ${!catId?"#888888":T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:!catId?"#888888":T.sub,fontFamily:"Nunito,sans-serif" }}>â“ None</button>
                  {cats.map(c=>(
                    <button key={c.id} onClick={()=>{ setCategoryTouched(true); const newIds=catIds.includes(c.id)?catIds.filter(x=>x!==c.id):[...catIds,c.id]; setCatIds(newIds); setSubIds(prev=>prev.filter(sid=>newIds.some(cid=>getCat(cid).subs?.find(s=>s.id===sid)))); setCatAllocations(prev=>{ const next={...prev}; if(newIds.includes(c.id)){ next[c.id]=next[c.id]||""; } else { delete next[c.id]; } return next; }); }} style={{ background:catIds.includes(c.id)?c.color+"22":"none",border:`1px solid ${catIds.includes(c.id)?c.color:T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:catIds.includes(c.id)?c.color:T.sub,fontFamily:"Nunito,sans-serif",display:"flex",alignItems:"center",gap:4 }}>{c.icon} {c.name.split(" ")[0]}</button>
                  ))}
                </div>
                {catIds.length>0&&(
                  <div style={{ marginTop:8 }}>
                    {catIds.map(cid=>{ const c=getCat(cid); if(!c.subs?.length) return null; return (
                      <div key={cid} style={{ marginBottom:6 }}>
                        <div style={{ color:c.color,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>{c.icon} {c.name}</div>
                        <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                          {c.subs.map(s=><Chip key={s.id} color={c.color} active={subIds.includes(s.id)} onClick={()=>setSubIds(prev=>prev.includes(s.id)?prev.filter(x=>x!==s.id):[...prev,s.id])}>{s.name}</Chip>)}
                        </div>
                      </div>
                    ); })}
                  </div>
                )}

                {catIds.length>1 && (
                  <div style={{ marginTop:10, background:T.input, borderRadius:10, padding:10 }}>
                    <div style={{ color:T.sub, fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:8 }}>Split amount across selected categories</div>
                    {catIds.map(cid=>{
                      const c=getCat(cid);
                      return (
                        <div key={cid} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                          <span style={{ flex:1, color:c.color, fontSize:12, fontWeight:700 }}>{c.icon} {c.name.split(" ")[0]}</span>
                          <input style={{ ...inpSm, width:90, textAlign:"right" }} type="number" value={catAllocations[cid]||""} placeholder="0" onChange={e=>setCatAllocations(prev=>({...prev,[cid]:e.target.value}))}/>
                        </div>
                      );
                    })}
                    <div style={{ color:T.sub, fontSize:10 }}>Total must equal transaction amount to enforce exact split.</div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5 â€” SPLIT / TAG / NONE */}
            {txnType==="expense"&&(
              <div>
                <span style={lbl}>Split or Tag</span>
                <div style={{ display:"flex",gap:8,marginBottom:12 }}>
                  {[["none","🚫","None"],["split","âš–️","Split"],["tag","ðŸ‘¤","Tag"]].map(([v,ic,lb])=>(
                    <button key={v} onClick={()=>setSplitMode(v)} style={{ flex:1,background:splitMode===v?T.accent+"22":"none",border:`1px solid ${splitMode===v?T.accent:T.border}`,borderRadius:10,padding:"8px 4px",cursor:"pointer",fontSize:10,fontWeight:700,color:splitMode===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",gap:2 }}>
                      <span style={{ fontSize:16 }}>{ic}</span>{lb}
                    </button>
                  ))}
                </div>

                {/* SPLIT UI */}
                {splitMode==="split"&&(
                  <div>
                    {groups.length>0&&(
                      <div style={{ marginBottom:10 }}>
                        <span style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6 }}>Select Group (leave people unselected for collective group due)</span>
                        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                          <Chip color={T.sub} active={!splitGroup} onClick={()=>{setSplitGroup("");setSplitPeople({});}}>None</Chip>
                          {groups.map(g=><Chip key={g.id} color={g.color} active={splitGroup===g.id} onClick={()=>handleGroupSelect(g.id)}>{g.icon} {g.name}</Chip>)}
                        </div>
                      </div>
                    )}
                    <span style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6 }}>People in split</span>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                      {people.filter(p=>!p.isMe).map(p=>(
                        <button key={p.id} onClick={()=>setSplitPeople(prev=>({...prev,[p.id]:!prev[p.id]}))} style={{ background:splitPeople[p.id]?p.color+"22":"none",border:`1px solid ${splitPeople[p.id]?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:splitPeople[p.id]?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>
                      ))}
                    </div>

                    {selectedPids.length>0&&(
                      <>
                        <div style={{ display:"flex",gap:6,marginBottom:10 }}>
                          {[["equally","= Equal"],["amount","â‚¹ Amount"],["percent","% Percent"],["share","âš–️ Share"]].map(([v,lb])=>(
                            <Chip key={v} color={T.accent} active={splitCalc===v} onClick={()=>setSplitCalc(v)}>{lb}</Chip>
                          ))}
                        </div>
                        <div style={{ background:T.input,borderRadius:10,padding:"10px 12px",marginBottom:10 }}>
                          {/* Me toggle */}
                          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}`,marginBottom:6 }}>
                            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                              <input type="checkbox" id="include_me" checked={includeMeInSplit} onChange={e=>setIncludeMeInSplit(e.target.checked)} style={{ width:16,height:16,accentColor:T.accent,cursor:"pointer" }}/>
                              <label htmlFor="include_me" style={{ color:T.accent,fontSize:12,fontWeight:700,cursor:"pointer" }}>ðŸ§‘ Include me in split</label>
                            </div>
                            {includeMeInSplit&&(()=>{ const shares=calcShares(); const myS=amt-Object.values(shares).reduce((s,v)=>s+v,0); return <span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>{sym}{fmt(Math.max(0,myS))}</span>; })()}
                          </div>
                          {selectedPids.map(pid=>{
                            const p=getPerson(pid);
                            const shares=calcShares();
                            const preview=shares[pid]||0;
                            const isDependent=p.personType==="dependant";
                            const willCollect=collectMap[pid]!==undefined?collectMap[pid]:!isDependent;
                            return (
                              <div key={pid} style={{ marginBottom:8 }}>
                                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
                                  <span style={{ color:T.text,fontSize:12,flex:1 }}>{p.emoji} {p.name}</span>
                                  {splitCalc!=="equally"&&<input type="number" placeholder={splitCalc==="percent"?"%":splitCalc==="share"?"shares":"0"} value={splitCustom[pid]||""} onChange={e=>setSplitCustom(prev=>({...prev,[pid]:e.target.value}))} style={{ ...inpSm,width:70,textAlign:"right" }}/>}
                                  <span style={{ color:T.accent,fontSize:12,fontWeight:700,minWidth:60,textAlign:"right" }}>{sym}{fmt(preview)}</span>
                                </div>
                                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                                  <input type="checkbox" id={`collect_${pid}`} checked={willCollect} onChange={e=>setCollectMap(prev=>({...prev,[pid]:e.target.checked}))} style={{ width:16,height:16,accentColor:T.accent,cursor:"pointer" }}/>
                                  <label htmlFor={`collect_${pid}`} style={{ color:T.sub,fontSize:11,cursor:"pointer" }}>Collect from {p.name}?</label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* TAG UI */}
                {splitMode==="tag"&&(
                  <div>
                    <span style={{ color:T.sub,fontSize:11,display:"block",marginBottom:8 }}>Tag this expense to</span>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
                      {["person","group","both"].map(mode=>(
                        <button key={mode} onClick={()=>setTagMode(mode)} style={{ background:tagMode===mode?T.accent+"22":"none",border:`1px solid ${tagMode===mode?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:tagMode===mode?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{mode[0].toUpperCase()+mode.slice(1)}</button>
                      ))}
                    </div>

                    {(tagMode==="person"||tagMode==="both")&&(
                      <>
                        <div style={{ color:T.sub,fontSize:11,display:"block",marginBottom:8 }}>Person</div>
                        <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
                          {people.map(p=>(
                            <button key={p.id} onClick={()=>setTagPerson(p.id)} style={{ background:tagPerson===p.id?p.color+"22":"none",border:`1px solid ${tagPerson===p.id?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:tagPerson===p.id?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}{p.isMe?" (Me)":""}</button>
                          ))}
                        </div>
                        <div style={{ color:T.sub,fontSize:10,marginTop:-4,marginBottom:12 }}>Tip: choose <b>Me</b> for personal spends like grooming or gym; choose a group alone when the amount is owed collectively.</div>
                      </>
                    )}

                    {(tagMode==="group"||tagMode==="both")&&(
                      <>
                        <div style={{ color:T.sub,fontSize:11,display:"block",marginBottom:8 }}>Group</div>
                        <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
                          <button onClick={()=>setTagGroup("")} style={{ background:!tagGroup?"#88888822":"none",border:`1px solid ${!tagGroup?"#888888":T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>None</button>
                          {groups.map(g=>(
                            <button key={g.id} onClick={()=>setTagGroup(g.id)} style={{ background:tagGroup===g.id?g.color+"22":"none",border:`1px solid ${tagGroup===g.id?g.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:tagGroup===g.id?g.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{g.icon} {g.name}</button>
                          ))}
                        </div>
                      </>
                    )}

                    {tagPerson&&(()=>{
                      const p=getPerson(tagPerson);
                      return (
                        <div style={{ background:T.input,borderRadius:12,padding:"12px 14px",marginBottom:10 }}>
                          <div style={{ color:T.text,fontSize:13,fontWeight:700,marginBottom:8 }}>{p.emoji} {p.name} â€” spend tracking</div>
                          <div style={{ color:T.sub,fontSize:11,marginBottom:10 }}>
                            Total bill: {sym}{fmt(amt)}
                            {tagPersonAmount&&parseFloat(tagPersonAmount)>0&&<span style={{ color:p.color,fontWeight:700 }}> · Tagged: {sym}{fmt(parseFloat(tagPersonAmount))}</span>}
                          </div>
                          <div>
                            <span style={lbl}>Amount spent on {p.name} (optional â€” defaults to full amount)</span>
                            <input style={inp} type="number" placeholder={`e.g. ${fmt(amt)} (full) or part of it`} value={tagPersonAmount} onChange={e=>setTagPersonAmount(e.target.value)}/>
                          </div>
                          <div style={{ color:T.sub,fontSize:10,marginTop:8 }}>
                            This does NOT mean they owe you â€” it tracks what you spent on them.
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* NOTE */}
            {txnType!=="cc_payment"&&txnType!=="transfer"&&<input style={inp} placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)}/>}

            {/* WAS THIS A BILL PAYMENT? */}
            {txnType==="expense"&&(
              <div style={{ background:T.input,borderRadius:12,padding:"12px 14px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:isBillPayment?12:0 }}>
                  <input type="checkbox" id="is_bill" checked={isBillPayment} onChange={e=>setIsBillPayment(e.target.checked)} style={{ width:18,height:18,accentColor:T.accent,cursor:"pointer" }}/>
                  <label htmlFor="is_bill" style={{ color:T.text,fontSize:14,fontWeight:700,cursor:"pointer" }}>🧾 This is a bill payment</label>
                </div>
                {isBillPayment&&<input style={{ ...inp,marginTop:8 }} placeholder="Invoice / Bill Number (optional) e.g. MSEB/2026/04/001" value={billInvoiceNo} onChange={e=>setBillInvoiceNo(e.target.value)}/>}
              </div>
            )}

            {/* SMS PASTE */}
            <div style={{ background:T.input,borderRadius:12,overflow:"hidden" }}>
              <button onClick={()=>setShowSms(p=>!p)} style={{ width:"100%",background:"none",border:"none",padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:"Nunito,sans-serif" }}>
                <span>ðŸ“±</span>
                <span style={{ color:T.sub,fontSize:13,fontWeight:700,flex:1,textAlign:"left" }}>Paste Bank SMS to auto-fill</span>
                <span style={{ color:T.sub,fontSize:12 }}>{showSms?"â–²":"â–¼"}</span>
              </button>
              {showSms&&<div style={{ padding:"0 14px 14px" }}>
                <textarea style={{ ...inp,height:80,resize:"none",marginBottom:6 }} placeholder="Paste your bank SMS here..." value={smsTxt} onChange={e=>{ setSmsTxt(e.target.value); parseSms(e.target.value); }}/>
                {smsRaw&&<div style={{ color:T.success,fontSize:11,fontWeight:700 }}>âœ… Parsed â€” check fields above</div>}
              </div>}
            </div>

            {/* IMAGE */}
            <div style={{ background:T.input,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10 }}>
              <span>ðŸ“·</span>
              <span style={{ color:T.sub,fontSize:13,fontWeight:700,flex:1 }}>Attach Receipt</span>
              <label style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>
                {imageBase64?"Change":"Upload"}
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setImageBase64(ev.target.result); r.readAsDataURL(f); }}/>
              </label>
              {imageBase64&&<button onClick={()=>setImageBase64(null)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:16 }}>âœ•</button>}
            </div>
            {imageBase64&&<img src={imageBase64} alt="receipt" style={{ width:"100%",borderRadius:10,maxHeight:160,objectFit:"cover" }} onError={e=>{ e.target.style.display="none"; setImageBase64(null); }}/>}

            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={closeModal} style={btnG}>Cancel</button>
              <button onClick={submit} style={{ ...btnP,opacity:canSubmit?1:0.5 }}>{canSubmit?"Add âœ“":txnType==="investment"?"Fill name & amount":"Fill vendor & amount"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // â”€â”€ SETTLE MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const SettleModal = () => {
    const t = settleTxn;
    const owedPeople = Object.entries(t?.people||{}).filter(([pid,info])=>info.mode==="owes"&&!info.settled&&pid!=="__me__"&&remainingShare(info)>0);
    const [partials, setPartials] = useState(Object.fromEntries(owedPeople.map(([pid,info])=>[pid,String(remainingShare(info))])));
    const [receiptImg, setReceiptImg] = useState(null);
    const [accId, setAccId] = useState(accounts.find(a=>a.type!=="cc")?.id||"");
    if(!t) return null;

    const settle = pid => {
      const dueAmt = t._isBillSettle
        ? (t._billIds||[]).reduce((sum,billId)=>{
            const bill = bills.find(b=>b.id===billId);
            return sum + (bill?.splitPeople?.[pid] ? remainingShare(bill.splitPeople[pid]) : 0);
          },0)
        : remainingShare(t.people?.[pid]);
      const requestedAmt = parseFloat(partials[pid])||0;
      if(!requestedAmt) return;
      const appliedAmt = Math.min(requestedAmt, dueAmt);
      const extraAmt = Math.max(0, requestedAmt - dueAmt);
      const p = getPerson(pid);
      const settleId = Date.now()+Math.random();
      const settleDesc = `${p.name} settled${t.desc?` against '${t.desc}'`:''}${extraAmt>0?` + ${sym}${fmt(extraAmt)} advance`:''}`;
      const newSettleTxn = { id:settleId, type:"settlement_in", desc:settleDesc, merchant:"", date:todayStr(), note:`Against: ${t.desc||"unknown"} · Account: ${getAcc(accId)?.name||"unnamed"}${extraAmt>0?` · Extra ${sym}${fmt(extraAmt)} kept as advance`:""}`, amount:requestedAmt, appliedAmount:appliedAmt, extraAmount:extraAmt, accId, fromPersonId:pid, groupId:t.groupId||null, againstTxnId:t._isFallbackSettle?null:t.id, imageBase64:receiptImg };
      const upsertSettlement = prev => {
        const newKey = linkedSettlementKey(newSettleTxn);
        if(newKey && prev.some(x=>linkedSettlementKey(x)===newKey)) return prev;
        return [newSettleTxn,...prev];
      };
      if(t._isBillSettle){
        // Settle against bills directly
        setTxns(upsertSettlement);
        if(t._billIds){
          let remaining=appliedAmt;
          setBills(prev=>prev.map(b=>{
            if(!t._billIds.includes(b.id)||!b.splitPeople?.[pid]) return b;
            const billAmt=remainingShare(b.splitPeople[pid]);
            if(remaining<=0) return b;
            const paidNow=Math.min(remaining,billAmt);
            remaining-=paidNow;
            const prevSettled = Number(b.splitPeople[pid].settledAmt||0);
            const nextSettled = prevSettled + paidNow;
            const originalAmt = Number(b.splitPeople[pid].amount||0);
            const nextRemaining = Math.max(0, originalAmt-nextSettled);
            return {...b,splitPeople:{...b.splitPeople,[pid]:{...b.splitPeople[pid],settled:nextRemaining<=0,settledAmt:nextSettled,remainingAmt:nextRemaining}}};
          }));
        }
      } else {
        setTxns(prev=>[
          ...upsertSettlement([]),
          ...prev.map(x=>{
            if(x.id!==t.id) return x;
            const originalAmt = Number(x.people[pid]?.amount||0);
            const prevSettled = Number(x.people[pid]?.settledAmt||0);
            const nextSettled = Math.min(originalAmt, prevSettled + appliedAmt);
            const nextRemaining = Math.max(0, originalAmt-nextSettled);
            return { ...x, people:{ ...x.people, [pid]:{ ...x.people[pid], settled:nextRemaining<=0, settledAmt:nextSettled, remainingAmt:nextRemaining } } };
          })
        ]);
      }
    };

    const settleAll = () => {
      owedPeople.forEach(([pid])=>settle(pid));
      setSettleTxn(null);
    };

    return (
      <div onClick={e=>e.target===e.currentTarget&&setSettleTxn(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>ðŸ’° Settle Payment</div>
            <button onClick={()=>setSettleTxn(null)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ color:T.sub,fontSize:12,marginBottom:16 }}>Against: {t.desc} · {sym}{fmt(t.amount)}</div>

          {owedPeople.map(([pid,info])=>{
            const p=getPerson(pid);
            const dueAmt = t._isBillSettle
              ? (t._billIds||[]).reduce((sum,billId)=>{
                  const bill = bills.find(b=>b.id===billId);
                  return sum + (bill?.splitPeople?.[pid] ? remainingShare(bill.splitPeople[pid]) : 0);
                },0)
              : remainingShare(info);
            return (
              <div key={pid} style={{ ...card,marginBottom:10 }}>
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
                  <div style={{ width:38,height:38,borderRadius:"50%",background:p.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{p.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:T.text,fontSize:14,fontWeight:700 }}>{p.name}</div>
                    <div style={{ color:T.sub,fontSize:11 }}>owes {sym}{fmt(dueAmt)}</div>
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <span style={lbl}>Amount received ({sym})</span>
                  <input style={inp} type="number" value={partials[pid]||""} onChange={e=>setPartials(prev=>({...prev,[pid]:e.target.value}))}/>
                  <div style={{ display:"flex",gap:6,marginTop:6 }}>
                    <button onClick={()=>setPartials(prev=>({...prev,[pid]:String(dueAmt)}))} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,color:T.accent,fontFamily:"Nunito,sans-serif" }}>Full {sym}{fmt(dueAmt)}</button>
                  </div>
                </div>
                <button onClick={()=>{ settle(pid); setTimeout(()=>setSettleTxn(null),50); }} style={{ ...btnP,background:T.success }}>âœ… {p.name} paid {sym}{fmt(parseFloat(partials[pid])||0)}</button>
              </div>
            );
          })}

          <div style={{ marginBottom:12 }}>
            <span style={lbl}>Payment mode / received into</span>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {accounts.filter(a=>a.type!=="cc").map(a=><button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
            </div>
            <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>If received amount is more than due, the extra will move to <b>You Owe</b> as advance.</div>
          </div>

          <div style={{ marginBottom:12 }}>
            <span style={lbl}>Payment proof (optional)</span>
            <label style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif",display:"inline-block" }}>
              ðŸ“· {receiptImg?"Change photo":"Attach screenshot"}
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setReceiptImg(ev.target.result); r.readAsDataURL(f); }}/>
            </label>
            {receiptImg&&<img src={receiptImg} alt="proof" style={{ width:"100%",borderRadius:8,maxHeight:120,objectFit:"cover",marginTop:8 }} onError={e=>e.target.style.display="none"}/>}
          </div>

          {owedPeople.length>1&&<button onClick={settleAll} style={btnP}>âœ… Settle All</button>}
        </div>
      </div>
    );
  };

  // â”€â”€ EDIT MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const EditModal = ({ t, onClose }) => {
    const linkedInvestment = investments.find(inv=>inv.id===t.linkedInvestmentId || String(inv.linkedTxnId||"")===String(t.id));
    const [txnType, setTxnType] = useState(t.type||"expense");
    const [investType, setInvestType] = useState(t.investType||linkedInvestment?.type||"mf");
    const [investFreq, setInvestFreq] = useState(t.investFreq||linkedInvestment?.freq||"");
    const [investFolio, setInvestFolio] = useState(t.investFolio||linkedInvestment?.folioNo||"");
    const [note, setNote] = useState(t.desc||"");
    const [merchant, setMerchant] = useState(t.type==="cc_payment"||t.type==="transfer"?"":t.merchant||"");
    const [amount, setAmount] = useState(String(t.amount||""));
    const [incomeType, setIncomeType] = useState(t.incomeType||"salary");
    const [customIncomeType, setCustomIncomeType] = useState("");
    const incomeTypeChoices = normalizeIncomeTypes([...incomeTypeOptions, incomeType]);
    const addIncomeTypeOption = () => {
      const nextType = normalizeIncomeTypeValue(customIncomeType);
      if(!nextType) return;
      setIncomeTypes(prev=>normalizeIncomeTypes([...prev, nextType]));
      setIncomeType(nextType);
      setCustomIncomeType("");
    };
    const [date, setDate] = useState(t.date||todayStr());
    const [catIds, setCatIds] = useState(t.catIds|| (t.catId?[t.catId]:[]));
    const [subIds, setSubIds] = useState(t.subIds|| (t.subId?[t.subId]:[]));
    const [catId, setCatId] = useState(t.catId||t.catIds?.[0]||"");
    const [subId, setSubId] = useState(t.subId||"");
    const [accId, setAccId] = useState(t.accId||t.fromAccId||"");
    const [toAccId, setToAccId] = useState(t.toAccId||"");
    const [settleFromPerson, setSettleFromPerson] = useState(t.fromPersonId||"");
    const [splitGroup, setSplitGroup] = useState(t.type==="expense"?t.groupId||"":"");
    const initialTrackingMode = t.type==="expense"
      ? (t.trackingMode || (Object.keys(t.people||{}).some(pid=>pid!=="__me__") ? "split" : (t.forPerson || t.groupId ? "tag" : "none")))
      : "none";
    const initialHasSplit = t.type==="expense" && initialTrackingMode==="split";
    const initialHasTag = t.type==="expense" && initialTrackingMode==="tag";
    const [splitMode, setSplitMode] = useState(initialHasSplit ? "split" : (initialHasTag ? "tag" : "none"));
    const [tagMode, setTagMode] = useState(t.forPerson && t.groupId ? "both" : t.forPerson ? "person" : "group");
    const [tagGroup, setTagGroup] = useState(t.type==="expense"?t.groupId||"":"");
    const [tagPerson, setTagPerson] = useState(t.forPerson||"");
    const [tagPersonAmount, setTagPersonAmount] = useState(t.tagPersonAmount ? String(t.tagPersonAmount) : "");
    const [splitPeopleState, setSplitPeopleState] = useState(()=>{
      const initial = {};
      if(t.people){
        Object.entries(t.people).forEach(([pid, info])=>{
          if(pid==="__me__") return;
          initial[pid] = { amount: info.amount||0, mode: info.mode||"owes", settled: !!info.settled };
        });
      }
      return initial;
    });
    const [includeMeInSplit, setIncludeMeInSplit] = useState(!!t.people?.__me__);
    const [showSmsEdit, setShowSmsEdit] = useState(false);
    const [smsEditTxt, setSmsEditTxt] = useState(t.smsRaw||"");
    const [isBillPayment, setIsBillPayment] = useState(!!t.isBillPayment);
    const [billInvoiceNo, setBillInvoiceNo] = useState(t.billInvoiceNo||"");
    const [settlementKind, setSettlementKind] = useState((t.isRefund || !t.fromPersonId) ? "refund" : "repayment");
    const amt = parseFloat(amount) || 0;
    const curCat = getCat(catId);
    const availablePeople = people.filter(p=>!p.isMe);
    const splitPersonIds = Object.keys(splitPeopleState);
    const splitTotal = splitPersonIds.reduce((s,pid)=>s + (parseFloat(splitPeopleState[pid]?.amount)||0), 0);
    const save = () => {
      const amt=parseMoney(amount);
      if(!note.trim()||!amt) return;
      const updatedPeople = {};
      if(txnType === "expense" && splitMode === "split"){
        splitPersonIds.forEach(pid => {
          updatedPeople[pid] = { amount: parseFloat(splitPeopleState[pid]?.amount) || 0, mode: splitPeopleState[pid]?.mode || "owes", settled: !!splitPeopleState[pid]?.settled };
        });
        if (includeMeInSplit) {
          updatedPeople.__me__ = { amount: Math.max(0, amt - splitTotal), mode: "self", settled: false };
        }
      }
      const billPeople = Object.fromEntries(Object.entries(updatedPeople).filter(([pid])=>pid!=="__me__"));
      const owedByOthers = Object.entries(billPeople).reduce((sum,[,info])=>sum+(info.mode==="owes"?Number(info.amount||0):0),0);
      const myShareAmount = txnType==="expense" && splitMode==="split" && includeMeInSplit ? Math.max(0, amt - owedByOthers) : 0;
      const tagAmt = txnType==="expense" && splitMode==="tag" && (tagMode==="person"||tagMode==="both")
        ? ((tagPersonAmount && parseFloat(tagPersonAmount)>0) ? parseFloat(tagPersonAmount) : (tagPerson ? amt : null))
        : null;
      const forPersonValue = txnType==="expense" && splitMode==="tag" && (tagMode==="person"||tagMode==="both") ? (tagPerson||"") : "";
      const groupIdValue = txnType==="expense"
        ? (splitMode==="split"
            ? (splitGroup||null)
            : (splitMode==="tag" && (tagMode==="group"||tagMode==="both") ? (tagGroup||null) : null))
        : null;
      const groupCollectiveAmount = txnType==="expense" && groupIdValue && splitMode==="split"
        ? Math.max(0, amt - owedByOthers - myShareAmount)
        : 0;
      const linkedBillId = txnType==="expense" && isBillPayment ? (t.paidBillId || genId()) : null;
      const linkedBillName = txnType==="expense" && isBillPayment ? (merchant.trim() || note.trim() || "Bill payment") : null;
      setTxns(prev=>prev.map(x=>x.id===t.id?{ ...x,
        type:txnType,
        desc:note.trim(),
        merchant:txnType==="cc_payment"||txnType==="transfer"?"":merchant.trim()||note.trim(),
        amount:amt, date:date,
        catId:txnType==="expense"?catId||x.catId:x.catId,
        catIds:txnType==="expense"?catIds:x.catIds,
        subId:txnType==="expense"?subId||null:x.subId,
        subIds:txnType==="expense"?subIds:x.subIds,
        incomeType:txnType==="income"?(normalizeIncomeTypeValue(incomeType)||"salary"):x.incomeType,
        investType:txnType==="investment"?investType:x.investType,
        investFreq:txnType==="investment"?(investFreq||""):x.investFreq,
        investFolio:txnType==="investment"?(investType==="mf"?investFolio.trim():""):x.investFolio,
        accId:(txnType==="expense"||txnType==="income"||txnType==="investment"||txnType==="settlement_in")?accId||x.accId:x.accId,
        fromAccId:txnType==="cc_payment"||txnType==="transfer"?accId||x.fromAccId:x.fromAccId,
        toAccId:txnType==="cc_payment"||txnType==="transfer"?toAccId||x.toAccId:x.toAccId,
        groupId:txnType==="expense"?groupIdValue:x.groupId,
        trackingMode:txnType==="expense"?splitMode:(x.trackingMode||"none"),
        groupCollectiveAmount:txnType==="expense"?groupCollectiveAmount:x.groupCollectiveAmount,
        forPerson:txnType==="expense"?forPersonValue:x.forPerson,
        tagPersonAmount:txnType==="expense"?tagAmt:x.tagPersonAmount,
        fromPersonId:txnType==="settlement_in"?(settleFromPerson||null):x.fromPersonId,
        isRefund:txnType==="settlement_in" ? settlementKind==="refund" : false,
        againstTxnId:txnType==="settlement_in" ? (settlementKind==="refund" ? (x.againstTxnId || t.againstTxnId || null) : null) : x.againstTxnId,
        people:txnType==="expense"?updatedPeople:x.people,
        smsRaw:smsEditTxt||x.smsRaw,
        isBillPayment:txnType==="expense"?isBillPayment:x.isBillPayment,
        billInvoiceNo:txnType==="expense"?billInvoiceNo.trim()||null:x.billInvoiceNo,
        paidBillId:txnType==="expense" ? (isBillPayment ? linkedBillId : null) : x.paidBillId,
        paidBillName:txnType==="expense" ? (isBillPayment ? linkedBillName : null) : x.paidBillName,
      }:x));
      if(txnType==="investment"){
        const linkedId = t.linkedInvestmentId || linkedInvestment?.id;
        if(linkedId){
          setInvestments(prev=>prev.map(inv=>(String(inv.id)===String(linkedId) || String(inv.linkedTxnId||"")===String(t.id))
            ? { ...inv, type:investType, name:note.trim(), amount:amt, currentValue:amt, freq:investFreq||"", folioNo:investType==="mf"?investFolio.trim():"", startDate:date }
            : inv
          ));
        }
      } else if(t.type==="investment"){
        setInvestments(prev=>prev.filter(inv=>String(inv.id)!==String(t.linkedInvestmentId||linkedInvestment?.id||"") && String(inv.linkedTxnId||"")!==String(t.id)));
      }
      if(txnType==="settlement_in" && settlementKind==="refund" && !(t.againstTxnId||null)){
        const refundTxn = { ...t, type:"settlement_in", desc:note.trim(), merchant:merchant.trim()||note.trim(), amount:amt, date, accId:accId||t.accId, fromPersonId:settleFromPerson||null, isRefund:true };
        const matches = getRefundCandidates(refundTxn, t.id);
        if(matches.length) setRefundMatchSuggestion({ refundTxn, matches });
      }
      if(txnType==="expense" && isBillPayment){
        const billPayload = {
          id:linkedBillId,
          name:linkedBillName,
          merchant:merchant.trim()||"",
          invoiceNo:billInvoiceNo.trim(),
          amount:amt,
          dueDate:date,
          catId:catIds[0]||catId||null,
          catIds,
          subId:subIds[0]||subId||null,
          recurring:false,
          frequency:"monthly",
          status:"paid",
          paidDate:date,
          createdDate:t.date||todayStr(),
          splitPeople:splitMode==="split" ? billPeople : {},
          groupId:groupIdValue||null,
          groupCollectiveAmount,
          myShare:myShareAmount,
          paidByTxnId:t.id,
        };
        setBills(prev=>prev.some(b=>b.id===linkedBillId)
          ? prev.map(b=>b.id===linkedBillId?{...b,...billPayload}:b)
          : [billPayload,...prev]
        );
      }
      onClose();
    };
    return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>✏️ Edit</div>
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div>
              <span style={lbl}>Transaction type</span>
              <select style={inp} value={txnType} onChange={e=>setTxnType(e.target.value)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="investment">Investment</option>
                <option value="transfer">Transfer</option>
                <option value="cc_payment">CC Payment</option>
                <option value="settlement_in">Settlement</option>
              </select>
            </div>
            <input style={inp} placeholder="Description *" value={note} onChange={e=>setNote(e.target.value)}/>
            {txnType==="expense"&&<input style={inp} placeholder="Merchant" value={merchant} onChange={e=>setMerchant(e.target.value)}/>}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div><span style={lbl}>Amount ({sym})</span><input style={inp} type="text" inputMode="decimal" value={amount?fmt(parseMoney(amount)):""} onChange={e=>setAmount(cleanMoneyInput(e.target.value))}/></div>
              <div><span style={lbl}>Date</span><input style={inp} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
            </div>
            {(txnType==="expense")&&<>
              <div>
                <span style={lbl}>Category (multiple allowed)</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  <button onClick={()=>{setCatIds([]);setSubIds([]);setCatId("");setSubId("");}} style={{ background:catIds.length===0?"#88888822":"none",border:`1px solid ${catIds.length===0?"#888888":T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>â“ None</button>
                  {cats.map(c=>{
                    const selected=catIds.includes(c.id);
                    return <button key={c.id} onClick={()=>{ const newIds=selected?catIds.filter(x=>x!==c.id):[...catIds,c.id]; setCatIds(newIds); setCatId(newIds[0]||""); setSubIds(prev=>prev.filter(sid=>newIds.some(cid=>getCat(cid).subs?.find(s=>s.id===sid)))); }} style={{ background:selected?c.color+"22":"none",border:`1px solid ${selected?c.color:T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:selected?c.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{c.icon} {c.name.split(" ")[0]}</button>;
                  })}
                </div>
              </div>
              {curCat.subs?.length>0&&<div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                <Chip color={T.sub} active={subIds.length===0} onClick={()=>{setSubIds([]);setSubId("")}}>None</Chip>
                {curCat.subs.map(s=>{
                  const selected=subIds.includes(s.id);
                  return <Chip key={s.id} color={curCat.color} active={selected} onClick={()=>{ setSubIds(prev=>prev.includes(s.id)?prev.filter(x=>x!==s.id):[...prev,s.id]); setSubId(selected?"":s.id); }}>{s.name}</Chip>;
                })}
              </div>}
              <div>
                <span style={lbl}>Paid via</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {accounts.map(a=><button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
                </div>
              </div>
              <div style={{ marginTop:8, padding:8, border:`1px solid ${T.border}`, borderRadius:10, background:T.input }}>
                <div style={{ display:"flex",gap:8,marginBottom:10 }}>
                  {[ ["none","🚫","None"],["split","âš–️","Split"],["tag","ðŸ‘¤","Tag"] ].map(([v,ic,lb])=>(
                    <button key={v} onClick={()=>setSplitMode(v)} style={{ flex:1,background:splitMode===v?T.accent+"22":"none",border:`1px solid ${splitMode===v?T.accent:T.border}`,borderRadius:10,padding:"8px 4px",cursor:"pointer",fontSize:10,fontWeight:700,color:splitMode===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",gap:2 }}>
                      <span style={{ fontSize:16 }}>{ic}</span>{lb}
                    </button>
                  ))}
                </div>

                {splitMode==="none" && <div style={{ fontSize:11,color:T.sub }}>No group or person tracking on this expense.</div>}

                {splitMode==="split" && <>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                    <Chip color={T.sub} active={!splitGroup} onClick={()=>{setSplitGroup(""); setSplitPeopleState({}); setIncludeMeInSplit(true);}}>No Group</Chip>
                    {groups.map(g=><Chip key={g.id} color={g.color} active={splitGroup===g.id} onClick={()=>{ setSplitGroup(g.id); setIncludeMeInSplit(g.includeMe!==false); setSplitPeopleState(prev=>{
                      const next={...prev};
                      g.members?.forEach(pid=>{ if(pid!=="__me__" && !next[pid]) next[pid]={ amount:0, mode:"owes", settled:false }; });
                      return next;
                    }); }}>{g.icon} {g.name}</Chip>)}
                  </div>
                  <label style={{ display:"block", fontSize:11, color:T.sub, marginBottom:4 }}>Split people</label>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                    {availablePeople.map(p=>{
                      const sel=Boolean(splitPeopleState[p.id]);
                      return <button key={p.id} onClick={()=>{
                        setSplitPeopleState(prev=>{
                          const next={...prev};
                          if(sel){ delete next[p.id]; } else { next[p.id]={ amount:Math.round((amt/(availablePeople.length||1))*100)/100, mode:"owes", settled:false }; }
                          return next;
                        });
                      }} style={{ background:sel?p.color+"22":"none",border:`1px solid ${sel?p.color:T.border}`,borderRadius:20,padding:"5px 10px",cursor:"pointer",fontSize:11,color:sel?p.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>;
                    })}
                  </div>
                  <div style={{ fontSize:11, color:T.sub, marginBottom:6 }}>Split total: {sym}{fmt(splitTotal)} / Amount: {sym}{fmt(amount||0)}</div>
                  <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:T.sub, marginBottom:8 }}><input type="checkbox" checked={includeMeInSplit} onChange={e=>setIncludeMeInSplit(e.target.checked)} style={{ accentColor:T.accent }}/> Include Me in split</label>
                  {splitPersonIds.map(pid=>{
                    const p = getPerson(pid);
                    const info = splitPeopleState[pid];
                    return (
                      <div key={pid} style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:6,marginBottom:6 }}>
                        <div style={{ fontSize:12, color:T.text, fontWeight:700 }}>{p.emoji} {p.name}</div>
                        <div><input style={{ ...inp, fontSize:12, padding:"6px" }} type="number" value={info.amount} onChange={e=>setSplitPeopleState(prev=>({...prev,[pid]:{...prev[pid],amount:e.target.value}}))}/></div>
                        <div><select style={{ ...inp, fontSize:11 }} value={info.mode} onChange={e=>setSplitPeopleState(prev=>({...prev,[pid]:{...prev[pid],mode:e.target.value}}))}><option value="owes">owes</option><option value="spent_on">spent</option></select></div>
                        <div><label style={{ display:"flex",alignItems:"center",gap:4,fontSize:11 }}><input type="checkbox" checked={info.settled} onChange={e=>setSplitPeopleState(prev=>({...prev,[pid]:{...prev[pid],settled:e.target.checked}}))}/><span>Settle</span></label></div>
                      </div>
                    );
                  })}
                </>}

                {splitMode==="tag" && (
                  <div>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
                      {["person","group","both"].map(mode=>(
                        <button key={mode} onClick={()=>setTagMode(mode)} style={{ background:tagMode===mode?T.accent+"22":"none",border:`1px solid ${tagMode===mode?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:tagMode===mode?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{mode[0].toUpperCase()+mode.slice(1)}</button>
                      ))}
                    </div>

                    {(tagMode==="person"||tagMode==="both") && <>
                      <div style={{ color:T.sub,fontSize:11,display:"block",marginBottom:8 }}>Person</div>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
                        {people.map(p=>(
                          <button key={p.id} onClick={()=>setTagPerson(p.id)} style={{ background:tagPerson===p.id?p.color+"22":"none",border:`1px solid ${tagPerson===p.id?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:tagPerson===p.id?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}{p.isMe?" (Me)":""}</button>
                        ))}
                      </div>
                    </>}

                    {(tagMode==="group"||tagMode==="both") && <>
                      <div style={{ color:T.sub,fontSize:11,display:"block",marginBottom:8 }}>Group</div>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
                        <button onClick={()=>setTagGroup("")} style={{ background:!tagGroup?"#88888822":"none",border:`1px solid ${!tagGroup?"#888888":T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>None</button>
                        {groups.map(g=>(
                          <button key={g.id} onClick={()=>setTagGroup(g.id)} style={{ background:tagGroup===g.id?g.color+"22":"none",border:`1px solid ${tagGroup===g.id?g.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:tagGroup===g.id?g.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{g.icon} {g.name}</button>
                        ))}
                      </div>
                    </>}

                    {tagPerson && (tagMode==="person"||tagMode==="both") && (()=>{
                      const p=getPerson(tagPerson);
                      return (
                        <div style={{ background:T.card,borderRadius:12,padding:"12px 14px",marginBottom:6 }}>
                          <div style={{ color:T.text,fontSize:13,fontWeight:700,marginBottom:8 }}>{p.emoji} {p.name} â€” spend tracking</div>
                          <div style={{ color:T.sub,fontSize:11,marginBottom:10 }}>Total bill: {sym}{fmt(amt)}</div>
                          <div>
                            <span style={lbl}>Amount spent on {p.name} (optional)</span>
                            <input style={inp} type="number" placeholder={`e.g. ${fmt(amt)} (full or part)`} value={tagPersonAmount} onChange={e=>setTagPersonAmount(e.target.value)}/>
                          </div>
                          <div style={{ color:T.sub,fontSize:10,marginTop:8 }}>Tag tracks spending; it does not create a person receivable by itself.</div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </>}
            {txnType==="income"&&<>
              <div>
                <span style={lbl}>Income type</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                  {incomeTypeChoices.map(type=>(
                    <button key={type} onClick={()=>setIncomeType(type)} style={{ background:incomeType===type?T.accent+"22":"none",border:`1px solid ${incomeType===type?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:incomeType===type?T.accent:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{formatIncomeTypeLabel(type)}</button>
                  ))}
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:10 }}>
                  <input style={inpSm} placeholder="Add custom income type" value={customIncomeType} onChange={e=>setCustomIncomeType(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addIncomeTypeOption(); } }}/>
                  <button onClick={addIncomeTypeOption} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,color:T.accent,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>+ Type</button>
                </div>
              </div>
              <div>
                <span style={lbl}>Received into</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {accounts.filter(a=>a.type!=="cc").map(a=><button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
                </div>
              </div>
            </>}
            {txnType==="settlement_in"&&<>
              <div>
                <span style={lbl}>Tag this inflow as</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                  {[{id:"refund",label:"â†© Refund",color:T.text},{id:"repayment",label:"ðŸ’° Repayment",color:T.info}].map(opt=>(
                    <button key={opt.id} onClick={()=>setSettlementKind(opt.id)} style={{ background:settlementKind===opt.id?opt.color+"22":"none",border:`1px solid ${settlementKind===opt.id?opt.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:settlementKind===opt.id?opt.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <span style={lbl}>Linked contact (optional)</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  <button onClick={()=>{ setSettleFromPerson(""); setSettlementKind("refund"); }} style={{ background:!settleFromPerson?"#88888822":"none",border:`1px solid ${!settleFromPerson?"#888":T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>No contact / merchant refund</button>
                  {people.filter(p=>!p.isMe).map(p=><button key={p.id} onClick={()=>{ setSettleFromPerson(p.id); setSettlementKind("repayment"); }} style={{ background:settleFromPerson===p.id?p.color+"22":"none",border:`1px solid ${settleFromPerson===p.id?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:settleFromPerson===p.id?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>)}
                </div>
                <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>{settlementKind==="refund" ? "If this looks like a merchant refund, Arth will suggest the original spend based on amount match." : "Use this for repayments or money received from people."}</div>
              </div>
              <div>
                <span style={lbl}>Payment mode / received into</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {accounts.map(a=><button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
                </div>
                <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>Choose the same credit card here if the refund landed back on the card.</div>
              </div>
            </>}
            {txnType==="investment"&&<>
              <div>
                <span style={lbl}>Investment type</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {INVEST_TYPES.map(it=><Chip key={it.id} color={it.color} active={investType===it.id} onClick={()=>setInvestType(it.id)}>{it.icon} {it.name.split("/")[0]}</Chip>)}
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:investType==="mf"?"1fr 1fr":"1fr",gap:10 }}>
                {investType==="mf"&&<div>
                  <span style={lbl}>Folio No.</span>
                  <input style={inp} placeholder="Optional folio number" value={investFolio} onChange={e=>setInvestFolio(e.target.value)}/>
                </div>}
                <div>
                  <span style={lbl}>Frequency</span>
                  <select style={inp} value={investFreq} onChange={e=>setInvestFreq(e.target.value)}>
                    <option value="">One-time / not fixed</option>
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="halfyearly">Half-yearly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div>
                <span style={lbl}>Paid via</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {accounts.filter(a=>a.type!=="cc").map(a=><button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
                </div>
              </div>
            </>}
            {(txnType==="cc_payment"||txnType==="transfer")&&<>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div><span style={lbl}>From</span><select style={inp} value={accId} onChange={e=>setAccId(e.target.value)}>{(txnType==="cc_payment"?accounts.filter(a=>a.type!=="cc"):accounts).map(a=><option key={a.id} value={a.id}>{accIcon(a.type)} {a.name}</option>)}</select></div>
                <div><span style={lbl}>To</span><select style={inp} value={toAccId} onChange={e=>setToAccId(e.target.value)}>{(txnType==="cc_payment"?accounts.filter(a=>a.type==="cc"):accounts).map(a=><option key={a.id} value={a.id}>{accIcon(a.type)} {a.name}</option>)}</select></div>
              </div>
            </>}
            {/* SMS section â€” always shown, collapsible */}
            <div style={{ background:T.input,borderRadius:12,overflow:"hidden" }}>
              <button onClick={()=>setShowSmsEdit(p=>!p)} style={{ width:"100%",background:"none",border:"none",padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"Nunito,sans-serif" }}>
                <span>ðŸ“±</span>
                <span style={{ color:T.sub,fontSize:12,fontWeight:700,flex:1,textAlign:"left" }}>{t.smsRaw?"View / Edit SMS":"Paste SMS to update fields"}</span>
                <span style={{ color:T.sub,fontSize:11 }}>{showSmsEdit?"â–²":"â–¼"}</span>
              </button>
              {showSmsEdit&&<div style={{ padding:"0 14px 12px" }}>
                <textarea style={{ ...inp,height:80,resize:"none" }} value={smsEditTxt} onChange={e=>setSmsEditTxt(e.target.value)} placeholder="Paste bank SMS here..."/>
              </div>}
            </div>
            {/* WAS THIS A BILL PAYMENT? */}
            {txnType==="expense"&&(
              <div style={{ background:T.input,borderRadius:12,padding:"12px 14px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:isBillPayment?12:0 }}>
                  <input type="checkbox" id="is_bill_edit" checked={isBillPayment} onChange={e=>setIsBillPayment(e.target.checked)} style={{ width:18,height:18,accentColor:T.accent,cursor:"pointer" }}/>
                  <label htmlFor="is_bill_edit" style={{ color:T.text,fontSize:14,fontWeight:700,cursor:"pointer" }}>🧾 This is a bill payment</label>
                </div>
                {isBillPayment&&<input style={{ ...inp,marginTop:8 }} placeholder="Invoice / Bill Number (optional) e.g. MSEB/2026/04/001" value={billInvoiceNo} onChange={e=>setBillInvoiceNo(e.target.value)}/>}
              </div>
            )}
            {txnType==="expense"&&txns.filter(x=>x.type==="settlement_in" && x.againstTxnId && String(x.againstTxnId)===String(t.id)).length>0&&(
              <div style={{ background:T.input,borderRadius:12,padding:"12px 14px" }}>
                <div style={{ color:T.info,fontSize:12,fontWeight:800,marginBottom:8 }}>â†© Linked refund entries</div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {txns.filter(x=>x.type==="settlement_in" && x.againstTxnId && String(x.againstTxnId)===String(t.id)).map(refundTxn=><button key={refundTxn.id} onClick={()=>{ onClose(); setEditingTxn(refundTxn); }} style={{ background:T.info+"14",border:`1px solid ${T.info}33`,borderRadius:20,padding:"5px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.info,fontFamily:"Nunito,sans-serif" }}>{sym}{fmt(refundTxn.amount)} · {formatShortDate(refundTxn.date)}</button>)}
                </div>
              </div>
            )}
            {txnType==="expense"&&(
              <button onClick={()=>{
                const refundSeed = {
                  id:t.id,
                  type:"expense",
                  amount:parseMoney(amount)||Number(t.amount||0),
                  accId:accId||t.accId||"",
                  desc:note.trim()||t.desc||t.merchant||"Expense",
                  merchant:merchant.trim()||note.trim()||t.merchant||t.desc||"",
                  date:date||t.date||todayStr(),
                };
                onClose();
                setDefaultAddType("settlement_in");
                setRefundSourceTxn(refundSeed);
                setShowAdd(true);
              }} style={{ background:T.text+"10",border:`1px solid ${T.text}33`,borderRadius:12,padding:"11px 14px",cursor:"pointer",fontSize:13,fontWeight:800,color:T.text,fontFamily:"Nunito,sans-serif",width:"100%" }}>
                â†© Add Refund Entry
              </button>
            )}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={onClose} style={btnG}>Cancel</button>
              <button onClick={save} style={btnP}>Save âœ“</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // â”€â”€ ADD ACCOUNT MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const AddAccountModal = () => {
    const [aType,setAType]=useState("bank");
    const [name,setName]=useState("");
    const [last4,setLast4]=useState("");
    const [color,setColor]=useState(PALETTE[2]);
    const [limit,setLimit]=useState("");
    const [statementDate,setStatementDate]=useState("15");
    const [dueDate,setDueDate]=useState("5");
    const [alertPct,setAlertPct]=useState("30");
    const [billingCycle,setBillingCycle]=useState("");
    const [handle,setHandle]=useState("");
    const [linkedBank,setLinkedBank]=useState(accounts.find(a=>a.type==="bank")?.id||"");
    const [openingBalance,setOpeningBalance]=useState("");
    const [openingBalanceDate,setOpeningBalanceDate]=useState(todayStr());
    const [error,setError]=useState("");
    const banks=accounts.filter(a=>a.type==="bank");
    const submit=()=>{
      if(!name.trim()){setError("Name required");return;}
      if(aType==="debit"&&!linkedBank){setError("Please link a bank account â€” required for debit cards");return;}
      const base={id:genId(),type:aType,name:name.trim(),color};
      if(aType==="bank"||aType==="cash") setAccounts(p=>[...p,{...base,last4,openingBalance:parseMoney(openingBalance)||0,openingBalanceDate:openingBalanceDate||todayStr()}]);
      else if(aType==="cc") setAccounts(p=>[...p,{...base,last4,limit:parseFloat(limit)||0,outstanding:0,statementDate:parseInt(statementDate)||15,dueDate:parseInt(dueDate)||5,alertPct:Math.max(0,parseFloat(alertPct)||0),billingCycle:billingCycle||`${statementDate}th`}]);
      else if(aType==="debit") setAccounts(p=>[...p,{...base,last4,linkedBank}]);
      else if(aType==="upi") setAccounts(p=>[...p,{...base,handle}]);
      else setAccounts(p=>[...p,base]);
      setShowAddAccount(false);
    };
    return (
      <div onClick={e=>e.target===e.currentTarget&&setShowAddAccount(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>Add Account</div>
            <button onClick={()=>setShowAddAccount(false)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {ACC_TYPES.map(at=><button key={at.id} onClick={()=>setAType(at.id)} style={{ background:aType===at.id?color+"22":"none",border:`1px solid ${aType===at.id?color:T.border}`,borderRadius:10,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700,color:aType===at.id?color:T.sub,fontFamily:"Nunito,sans-serif" }}>{at.icon} {at.label}</button>)}
            </div>
            <input style={inp} placeholder="Name" value={name} onChange={e=>setName(e.target.value)}/>
            {(aType==="bank"||aType==="cc"||aType==="debit")&&<input style={inp} placeholder="Last 4 digits" maxLength={4} value={last4} onChange={e=>setLast4(e.target.value)}/>}
            {(aType==="bank"||aType==="cash")&&<div style={{ display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:10 }}>
              <input style={inp} type="text" inputMode="decimal" placeholder={aType==="cash"?`Cash in hand (${sym})`:`Opening balance (${sym})`} value={openingBalance?fmt(parseMoney(openingBalance)):""} onChange={e=>setOpeningBalance(cleanMoneyInput(e.target.value))}/>
              <div>
                <span style={lbl}>As on date</span>
                <input style={inp} type="date" value={openingBalanceDate} onChange={e=>setOpeningBalanceDate(e.target.value)}/>
              </div>
            </div>}
            {aType==="cc"&&<>
              <input style={inp} type="number" placeholder={`Credit limit (${sym})`} value={limit} onChange={e=>setLimit(e.target.value)}/>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div><span style={lbl}>Statement Date</span><input style={inp} type="number" min="1" max="31" value={statementDate} onChange={e=>setStatementDate(e.target.value)}/></div>
                <div><span style={lbl}>Due Date</span><input style={inp} type="number" min="1" max="31" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
              </div>
              <div><span style={lbl}>Spend alert (% of limit)</span><input style={inp} type="number" min="0" max="100" value={alertPct} onChange={e=>setAlertPct(e.target.value)}/></div>
              <input style={inp} placeholder="Billing cycle e.g. 15thâ€“14th" value={billingCycle} onChange={e=>setBillingCycle(e.target.value)}/>
            </>}
            {aType==="debit"&&<div>
              <span style={lbl}>Linked Bank Account *</span>
              {banks.length===0?<div style={{ color:T.danger,fontSize:12 }}>Add a bank account first</div>:
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {banks.map(b=><button key={b.id} onClick={()=>setLinkedBank(b.id)} style={{ background:linkedBank===b.id?b.color+"22":"none",border:`1px solid ${linkedBank===b.id?b.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:linkedBank===b.id?b.color:T.sub,fontFamily:"Nunito,sans-serif" }}>🏦 {b.name}</button>)}
              </div>}
            </div>}
            {aType==="upi"&&<input style={inp} placeholder="UPI handle e.g. you@okicici" value={handle} onChange={e=>setHandle(e.target.value)}/>}
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {PALETTE.map(c=><div key={c} onClick={()=>setColor(c)} style={{ width:28,height:28,borderRadius:7,background:c,cursor:"pointer",border:color===c?"3px solid #fff":"3px solid transparent" }}/>)}
            </div>
            {error&&<div style={{ color:T.danger,fontSize:12,fontWeight:700 }}>⚠️ {error}</div>}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={()=>setShowAddAccount(false)} style={btnG}>Cancel</button>
              <button onClick={submit} style={btnP}>Save Account</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // â”€â”€ ADD INVESTMENT MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const AddInvestmentModal = ({ item }) => {
    const isEditing = Boolean(item);
    const closeModal = () => {
      setShowAddInvestment(false);
      setEditingInvestment(null);
    };
    const [iType,setIType]=useState(item?.type||"mf");
    const [name,setName]=useState(item?.name||"");
    const [folioNo,setFolioNo]=useState(item?.folioNo||"");
    const [amount,setAmount]=useState(String(item?.amount||""));
    const [freq,setFreq]=useState(item?.freq||"");
    const [startDate,setStartDate]=useState(item?.startDate||todayStr());
    const [reminderEnabled,setReminderEnabled]=useState(Boolean(item?.reminder));
    const [reminderDate,setReminderDate]=useState(item?.reminder||todayStr());
    const submit=()=>{
      const amt = parseMoney(amount);
      if(!name.trim()||!amt) return;
      const nextItem = {
        ...(item||{}),
        id:item?.id||genId(),
        type:iType,
        name:name.trim(),
        folioNo:iType==="mf"?folioNo.trim():"",
        amount:amt,
        currentValue:amt,
        freq:freq||"",
        startDate,
        reminder:reminderEnabled?reminderDate:null,
      };
      setInvestments(p=>isEditing ? p.map(inv=>String(inv.id)===String(nextItem.id)?nextItem:inv) : [nextItem,...p]);
      closeModal();
    };
    return (
      <div onClick={e=>e.target===e.currentTarget&&closeModal()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{isEditing?"Edit Investment":"Add Investment"}</div>
            <button onClick={closeModal} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
              {INVEST_TYPES.map(it=><Chip key={it.id} color={it.color} active={iType===it.id} onClick={()=>setIType(it.id)}>{it.icon} {it.name.split("/")[0]}</Chip>)}
            </div>
            <input style={inp} placeholder="Name e.g. Axis Bluechip SIP" value={name} onChange={e=>setName(e.target.value)}/>
            {iType==="mf"&&<>
              <input style={inp} placeholder="Folio number (optional)" value={folioNo} onChange={e=>setFolioNo(e.target.value)}/>
              <div style={{ color:T.sub,fontSize:10 }}>If the same fund uses the same folio number, Arth can group those SIPs together.</div>
            </>}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div>
                <span style={lbl}>Amount ({sym})</span>
                <input style={inp} type="text" inputMode="decimal" placeholder={`e.g. ${sym}5,500`} value={amount?fmt(parseMoney(amount)):""} onChange={e=>setAmount(cleanMoneyInput(e.target.value))}/>
              </div>
              <div>
                <span style={lbl}>Frequency</span>
                <select style={{ ...inp,background:"#fff",color:"#111" }} value={freq} onChange={e=>setFreq(e.target.value)}>
                  <option value="" style={{ background:"#fff",color:"#111" }}>Select frequency (optional)</option>
                  <option value="daily" style={{ background:"#fff",color:"#111" }}>Daily</option>
                  <option value="weekly" style={{ background:"#fff",color:"#111" }}>Weekly</option>
                  <option value="monthly" style={{ background:"#fff",color:"#111" }}>Monthly</option>
                  <option value="quarterly" style={{ background:"#fff",color:"#111" }}>Quarterly</option>
                  <option value="halfyearly" style={{ background:"#fff",color:"#111" }}>Half-yearly</option>
                  <option value="yearly" style={{ background:"#fff",color:"#111" }}>Yearly</option>
                </select>
              </div>
            </div>
            <div><span style={lbl}>Start Date</span><input style={inp} type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <input id="reminder_enabled" type="checkbox" checked={reminderEnabled} onChange={e=>setReminderEnabled(e.target.checked)} style={{ width:16,height:16,accentColor:T.accent,cursor:"pointer" }}/>
              <label htmlFor="reminder_enabled" style={{ color:T.text,fontSize:12,fontWeight:700,cursor:"pointer" }}>Set reminder for next instalment</label>
            </div>
            {reminderEnabled&&(
              <div><span style={lbl}>Reminder Date</span><input style={inp} type="date" value={reminderDate} onChange={e=>setReminderDate(e.target.value)}/></div>
            )}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={closeModal} style={btnG}>Cancel</button>
              <button onClick={submit} style={btnP}>{isEditing?"Save Changes":"Save Investment"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // â”€â”€ CONFIRM DELETE CAT / ACCOUNT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ConfirmDelete = () => {
    const category = cats.find(c=>c.id===confirmDeleteCat) || getCat(confirmDeleteCat);
    const linkedExpenseCount = txns.filter(txn=>txn.type==="expense" && (
      String(txn.catId||"")===String(confirmDeleteCat||"") ||
      (Array.isArray(txn.catIds) && txn.catIds.some(id=>String(id)===String(confirmDeleteCat||"")))
    )).length;
    const linkedBillCount = bills.filter(bill=>
      String(bill.catId||"")===String(confirmDeleteCat||"") ||
      (Array.isArray(bill.catIds) && bill.catIds.some(id=>String(id)===String(confirmDeleteCat||"")))
    ).length;
    const isOnlyCategory = cats.length <= 1;
    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20 }}>
        <div style={{ background:T.card,borderRadius:20,padding:24,width:"100%",maxWidth:360 }}>
          <div style={{ color:T.text,fontSize:18,fontWeight:900,marginBottom:10 }}>Delete {category?.name||"Category"}?</div>
          <div style={{ color:T.sub,fontSize:13,marginBottom:12 }}>
            {linkedExpenseCount || linkedBillCount
              ? `Warning: this category is linked to ${linkedExpenseCount} expense${linkedExpenseCount===1?"":"s"}${linkedBillCount?` and ${linkedBillCount} bill${linkedBillCount===1?"":"s"}`:""}. Those records will lose the category label until you edit them.`
              : "This will remove the category from your setup."}
          </div>
          {isOnlyCategory && <div style={{ color:T.warn,fontSize:11,marginBottom:14 }}>Keep at least one category in the app.</div>}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <button onClick={()=>setConfirmDeleteCat(null)} style={btnG}>Cancel</button>
            <button onClick={()=>{ if(!isOnlyCategory) setCats(p=>p.filter(c=>c.id!==confirmDeleteCat)); setConfirmDeleteCat(null); }} style={{ ...btnP,background:T.danger,opacity:isOnlyCategory?0.55:1,cursor:isOnlyCategory?"not-allowed":"pointer" }} disabled={isOnlyCategory}>Delete</button>
          </div>
        </div>
      </div>
    );
  };

  const ConfirmDeleteAccount = () => {
    const account = accounts.find(a=>a.id===confirmDeleteAccount);
    if(!account) return null;
    const linkedTxnCount = txns.filter(txn=>[txn.accId, txn.fromAccId, txn.toAccId].some(id=>String(id||"")===String(account.id))).length;
    const linkedDebitCount = accounts.filter(other=>other.id!==account.id && String(other.linkedBank||"")===String(account.id)).length;
    const hasCheckpoint = Boolean(balanceCheckpoints[account.id]);
    const handleDelete = () => {
      setAccounts(prev=>prev
        .filter(item=>item.id!==account.id)
        .map(item=>String(item.linkedBank||"")===String(account.id) ? { ...item, linkedBank:"" } : item)
      );
      setBalanceCheckpoints(prev=>{
        const next = { ...prev };
        delete next[account.id];
        return next;
      });
      setConfirmDeleteAccount(null);
    };
    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20 }}>
        <div style={{ background:T.card,borderRadius:20,padding:24,width:"100%",maxWidth:360 }}>
          <div style={{ color:T.text,fontSize:18,fontWeight:900,marginBottom:10 }}>Delete {account.name}?</div>
          <div style={{ color:T.sub,fontSize:13,marginBottom:12 }}>
            {linkedTxnCount || linkedDebitCount || hasCheckpoint
              ? `Warning: this account is linked to ${linkedTxnCount} transaction${linkedTxnCount===1?"":"s"}${linkedDebitCount?`, ${linkedDebitCount} debit card${linkedDebitCount===1?"":"s"}`:""}${hasCheckpoint?", and saved balance checks":""}. Linked records will need reassignment later.`
              : "This will remove the account from your setup."}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <button onClick={()=>setConfirmDeleteAccount(null)} style={btnG}>Cancel</button>
            <button onClick={handleDelete} style={{ ...btnP,background:T.danger }}>Delete</button>
          </div>
        </div>
      </div>
    );
  };

  // â”€â”€ ACCOUNT DETAIL MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const AccDetailModal = () => {
    const a=showAccDetail;
    if(!a) return null;

    const linkedBankAcc = a.type==="debit" ? accounts.find(b=>b.id===a.linkedBank) : null;
    const linkedDebitIds = a.type==="bank" ? accounts.filter(x=>x.type==="debit"&&x.linkedBank===a.id).map(x=>x.id) : [];
    const cardSummary = a.type==="cc" ? getCardSummary(a) : null;
    const util = a.type==="cc" && a.limit ? Math.round((((cardSummary?.currentCycleSpend)||0)/a.limit)*100) : 0;
    const utilLimit = cardSummary?.alertPct || 30;
    const currentBalance = a.type==="cc"
      ? Number(cardSummary?.totalOutstanding||0)
      : a.type==="debit"
        ? Number(linkedBankAcc ? bankBalance(linkedBankAcc.id) : 0)
        : Number(accountBalance(a.id)||0);
    const checkpoint = balanceCheckpoints[a.id] || null;
    const expectedAtCheckpoint = checkpoint?.date && a.type!=="cc"
      ? Number(accountBalance(a.id, checkpoint.date)||0)
      : null;
    const discrepancy = checkpoint && expectedAtCheckpoint!==null
      ? Number(checkpoint.amount||0) - Number(expectedAtCheckpoint||0)
      : null;

    const ledgerRows = [...txns].map(t=>{
      let signed = 0;
      let secondary = txnLabel(t.type);

      if(a.type==="cc"){
        if(t.type==="expense" && t.accId===a.id){ signed -= Number(t.amount||0); secondary = t.note || "Card spend"; }
        else if(t.type==="cc_payment" && t.toAccId===a.id){ signed += Number(t.amount||0); secondary = `Payment from ${getAcc(t.fromAccId)?.name||"account"}`; }
        else if(t.type==="settlement_in" && t.accId===a.id){ signed += Number(t.amount||0); secondary = t.fromPersonId ? `Settlement from ${getPerson(t.fromPersonId)?.name||"contact"}` : (t.isRefund ? "Merchant refund" : "Credit adjustment"); }
        else return null;
      } else {
        if(!isDateInRange(t.date, a.openingBalanceDate||"", null)) return null;
        if(t.type==="income" && t.accId===a.id){ signed += Number(t.amount||0); secondary = t.incomeType ? `Income · ${formatIncomeTypeLabel(t.incomeType)}` : "Income"; }
        else if(t.type==="settlement_in" && t.accId===a.id){ signed += Number(t.amount||0); secondary = t.fromPersonId ? `Settlement from ${getPerson(t.fromPersonId)?.name||"contact"}` : (t.isRefund ? "Merchant refund" : "Refund / settlement"); }
        else if(t.type==="transfer" && t.fromAccId===a.id){ signed -= Number(t.amount||0); secondary = `Transfer to ${getAcc(t.toAccId)?.name||"account"}`; }
        else if(t.type==="transfer" && t.toAccId===a.id){ signed += Number(t.amount||0); secondary = `Transfer from ${getAcc(t.fromAccId)?.name||"account"}`; }
        else if(t.type==="cc_payment" && t.fromAccId===a.id){ signed -= Number(t.amount||0); secondary = `CC payment to ${getAcc(t.toAccId)?.name||"card"}`; }
        else if((t.type==="expense"||t.type==="investment") && t.accId===a.id){ signed -= Number(t.amount||0); secondary = t.type==="investment" ? "Investment outflow" : (t.note || "Expense"); }
        else if(a.type==="bank" && linkedDebitIds.includes(t.accId) && (t.type==="expense"||t.type==="investment")){
          signed -= Number(t.amount||0);
          secondary = `Via ${getAcc(t.accId)?.name||"debit card"}`;
        } else {
          return null;
        }
      }

      return {
        id:`${a.id}_${t.id}`,
        t,
        signed,
        color:signed>=0?T.success:T.danger,
        label:signed>=0?"Credit":"Debit",
        secondary,
      };
    }).filter(Boolean).sort((x,y)=>{
      const dx=new Date(x.t.date||0); const dy=new Date(y.t.date||0);
      if(dy-dx!==0) return dy-dx;
      return (y.t.id||0)-(x.t.id||0);
    });

    const totalCredits = ledgerRows.reduce((sum,row)=>sum+(row.signed>0?row.signed:0),0);
    const totalDebits = ledgerRows.reduce((sum,row)=>sum+(row.signed<0?Math.abs(row.signed):0),0);
    const summaryCards = a.type==="cc"
      ? [
          { l:"Limit", v:`${sym}${fmt(a.limit)}`, c:T.text },
          { l:"Due Now", v:`${sym}${fmt(cardSummary?.currentDue||0)}`, c:(cardSummary?.currentDue||0)>0?T.danger:T.success },
          { l:"Unbilled", v:`${sym}${fmt(cardSummary?.currentCycleSpend||0)}`, c:T.warn },
          { l:"Outstanding", v:`${sym}${fmt(cardSummary?.totalOutstanding||0)}`, c:(cardSummary?.totalOutstanding||0)>0?T.danger:T.success },
        ]
      : [
          { l:a.type==="debit"?"Linked Bank":"Live Balance", v:a.type==="debit"?(linkedBankAcc?.name||"Not linked"):`${sym}${fmt(currentBalance)}`, c:currentBalance>=0?T.success:T.danger },
          { l:"Credits", v:`${sym}${fmt(totalCredits)}`, c:T.success },
          { l:"Debits", v:`${sym}${fmt(totalDebits)}`, c:T.danger },
          { l:a.openingBalanceDate?`Opening · ${formatShortDate(a.openingBalanceDate)}`:"Opening", v:`${sym}${fmt(a.openingBalance||0)}`, c:T.text },
          ...(checkpoint ? [
            { l:`Actual · ${formatShortDate(checkpoint.date)}`, v:`${sym}${fmt(checkpoint.amount||0)}`, c:T.info },
            { l:"Gap", v:`${(discrepancy||0)>=0?"+":"âˆ’"}${sym}${fmt(Math.abs(discrepancy||0))}`, c:Math.abs(discrepancy||0)<0.01?T.success:T.warn },
          ] : []),
        ];

    return (
      <div onClick={e=>e.target===e.currentTarget&&setShowAccDetail(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"stretch",justifyContent:"center",zIndex:220 }}>
        <div style={{ background:T.card,borderRadius:0,padding:"22px 18px 40px",width:"100%",maxWidth:"100vw",height:"100vh",maxHeight:"100vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
            <div>
              <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{accIcon(a.type)} {a.name}</div>
              <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{accLabel(a.type)}{a.last4?` · ···${a.last4}`:""}</div>
            </div>
            <button onClick={()=>setShowAccDetail(null)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
            {summaryCards.map(s=>(
              <div key={s.l} style={{ background:T.input,borderRadius:10,padding:"10px 12px" }}>
                <div style={{ color:s.c,fontSize:16,fontWeight:800 }}>{s.v}</div>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginTop:2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {checkpoint && a.type!=="cc" && (
            <div style={{ background:(Math.abs(discrepancy||0)<0.01?T.success:T.warn)+"14",border:`1px solid ${Math.abs(discrepancy||0)<0.01?(T.success+"44"):(T.warn+"44")}`,borderRadius:12,padding:"12px 14px",marginBottom:14 }}>
              <div style={{ color:T.text,fontSize:12,fontWeight:800,marginBottom:6 }}>Balance reconciliation</div>
              <div style={{ color:T.sub,fontSize:11,marginBottom:3 }}>Opening as on {a.openingBalanceDate ? formatShortDate(a.openingBalanceDate) : "start"}: {sym}{fmt(a.openingBalance||0)}</div>
              <div style={{ color:T.sub,fontSize:11,marginBottom:3 }}>Expected on {formatShortDate(checkpoint.date)} from txns: {sym}{fmt(expectedAtCheckpoint||0)}</div>
              <div style={{ color:T.sub,fontSize:11,marginBottom:3 }}>Actual balance on {formatShortDate(checkpoint.date)}: {sym}{fmt(checkpoint.amount||0)}</div>
              <div style={{ color:Math.abs(discrepancy||0)<0.01?T.success:T.warn,fontSize:11,fontWeight:800 }}>{Math.abs(discrepancy||0)<0.01 ? "No gap â€” balances match." : `Discrepancy / gap: ${(discrepancy||0)>=0?"+":"âˆ’"}${sym}${fmt(Math.abs(discrepancy||0))}`}</div>
            </div>
          )}

          {a.type==="cc"&&<>
            <div style={{ color:T.sub,fontSize:11,marginBottom:10 }}>
              {(cardSummary?.totalOutstanding||0)===0 && (cardSummary?.currentCycleSpend||0)===0
                ? `No billed or unbilled spend right now · Alert above ${utilLimit}% of limit`
                : `Statement ${cardSummary?.lastStatementDate?.toLocaleDateString("en-IN",{ day:"2-digit", month:"short" })} · Due ${cardSummary?.dueOn?.toLocaleDateString("en-IN",{ day:"2-digit", month:"short" })} · Alert above ${utilLimit}% of limit`}
            </div>
            <div style={{ height:6,background:T.border,borderRadius:3,marginBottom:10 }}>
              <div style={{ height:"100%",width:`${Math.min(100,util)}%`,background:util>utilLimit?T.danger:T.success,borderRadius:3 }}/>
            </div>
            {util>utilLimit&&<div style={{ background:T.danger+"22",border:`1px solid ${T.danger}44`,borderRadius:10,padding:10,marginBottom:14 }}>⚠️ <span style={{ color:T.danger,fontSize:12,fontWeight:700 }}>Current-cycle spend is above your {utilLimit}% alert limit</span></div>}
          </>}

          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800 }}>Transactions</div>
            <button onClick={()=>{ setShowAccDetail(null); setDefaultAddType(a.type==="cc"?"cc_payment":a.type==="bank"||a.type==="cash"||a.type==="upi"?"income":"expense"); setShowAdd(true); }} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,color:T.accent,borderRadius:10,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>+ Add</button>
          </div>

          {ledgerRows.length===0 ? (
            <div style={{ ...card,textAlign:"center",padding:20,marginBottom:0 }}>
              <div style={{ color:T.sub,fontSize:12 }}>No debit or credit entries yet for this account.</div>
            </div>
          ) : (
            <div style={{ ...card,padding:"8px 12px",marginBottom:0 }}>
              {ledgerRows.map((row,idx)=>(
                <div key={row.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 0",borderBottom:idx<ledgerRows.length-1?`1px solid ${T.border}`:"none" }}>
                  <div style={{ minWidth:0,flex:1 }}>
                    <div style={{ color:T.text,fontSize:12,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{txnEmoji(row.t.type)} {row.t.desc||txnLabel(row.t.type)}</div>
                    <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{row.secondary} · {new Date(row.t.date||todayStr()).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:row.color,fontSize:12,fontWeight:800 }}>{row.signed>=0?"+":"âˆ’"}{sym}{fmt(Math.abs(row.signed))}</div>
                    <div style={{ color:T.sub,fontSize:10 }}>{row.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const InvestmentDetailModal = () => {
    const group = selectedInvestmentDetail;
    if(!group) return null;
    const type = INVEST_TYPES.find(x=>x.id===group.type) || group.typeMeta || INVEST_TYPES[0];
    const monthlyWorth = group.items.reduce((sum,inv)=>inv.freq==="monthly"?sum+Number(inv.amount||0):sum,0);
    return (
      <div onClick={e=>e.target===e.currentTarget&&setSelectedInvestmentDetail(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:220 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"22px 18px 40px",width:"100%",maxWidth:430,maxHeight:"88vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div>
              <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{type.icon} {group.folioNo?`Folio ${group.folioNo}`:group.primaryName}</div>
              <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{type.name} · {group.items.length} entr{group.items.length===1?"y":"ies"}</div>
            </div>
            <button onClick={()=>setSelectedInvestmentDetail(null)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
            {[
              {l:"Worth",v:`${sym}${fmt(group.total)}`,c:type.color},
              {l:"Monthly",v:`${sym}${fmt(monthlyWorth)}`,c:T.purple},
              type.id==="mf"
                ? {l:"Folio",v:group.folioNo||"Not set",c:T.text}
                : {l:type.id==="stocks"?"Stocks":"Entries",v:String(group.items.length),c:T.text},
              {l:"Entries",v:String(group.items.length),c:T.success}
            ].map(s=>(
              <div key={s.l} style={{ background:T.input,borderRadius:10,padding:"10px 12px" }}>
                <div style={{ color:s.c,fontSize:15,fontWeight:800,wordBreak:"break-word" }}>{s.v}</div>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginTop:2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card,marginBottom:0 }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:10 }}>{type.id==="mf"?"Entries in this folio":"Holdings in this section"}</div>
            {group.items.map((inv,idx)=>{
              const linkedTxn = getInvestmentTxn(inv);
              return (
                <div key={inv.id} style={{ display:"flex",justifyContent:"space-between",gap:10,padding:"10px 0",borderBottom:idx<group.items.length-1?`1px solid ${T.border}`:"none" }}>
                  <div style={{ minWidth:0,flex:1 }}>
                    <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{inv.name}</div>
                    <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>
                      {type.id==="stocks"
                        ? `1 stock entry`
                        : (investmentFreqLabel(inv.freq) || "One-time / no frequency")}
                      {inv.startDate?` · ${new Date(inv.startDate).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}`:""}
                      {inv.reminder?` · Reminder ${inv.reminder}`:""}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:type.color,fontSize:12,fontWeight:800 }}>{sym}{fmt(inv.currentValue ?? inv.amount)}</div>
                    <div style={{ display:"flex",gap:4,justifyContent:"flex-end",marginTop:2,flexWrap:"wrap" }}>
                      <button onClick={()=>openInvestmentEditor(inv)} style={{ background:"none",border:"none",color:T.info,cursor:"pointer",fontSize:10,fontFamily:"Nunito,sans-serif" }}>Edit</button>
                      <button onClick={()=>removeInvestmentEntry(inv)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:10,fontFamily:"Nunito,sans-serif" }}>{linkedTxn?"Delete":"Remove"}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // â”€â”€ HOME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const DEFAULT_CARD_ORDER = ["stats","budget","categories","cc","bills","recent"];
  const [cardOrder, setCardOrder] = useState(()=>JSON.parse(localStorage.getItem("arth_card_order")||"null")||DEFAULT_CARD_ORDER);
  const [editingCards, setEditingCards] = useState(false);
  const [syncEmail, setSyncEmail] = useState("");
  const [syncPassword, setSyncPassword] = useState("");
  const [cloudUser, setCloudUser] = useState(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudHydrated, setCloudHydrated] = useState(!isCloudSyncConfigured);
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [cloudStatus, setCloudStatus] = useState(
    isCloudSyncConfigured
      ? "Sign in with the same account on web and desktop to keep your data synced."
      : "Cloud sync is off. Add your Supabase keys in `.env` to enable shared login and sync."
  );
  const applyingCloudSnapshotRef = useRef(false);
  const cloudSnapshotRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("arth_card_order", JSON.stringify(cardOrder));
  }, [cardOrder]);

  const cloudSnapshot = useMemo(() => ({
    version: CLOUD_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    dark,
    autoDetectExpenseCategory,
    cats,
    incomeTypes,
    accounts,
    balanceCheckpoints,
    people,
    groups,
    txns,
    investments,
    bills,
    liabilities,
    trackedAssets,
    loans,
    annualBudget,
    monthOverrides,
    cardOrder,
  }), [dark, autoDetectExpenseCategory, cats, incomeTypes, accounts, balanceCheckpoints, people, groups, txns, investments, bills, liabilities, trackedAssets, loans, annualBudget, monthOverrides, cardOrder]);

  useEffect(() => {
    cloudSnapshotRef.current = cloudSnapshot;
  }, [cloudSnapshot]);

  const applyCloudSnapshot = useCallback((snapshot) => {
    if(!snapshot || typeof snapshot !== "object") return;
    applyingCloudSnapshotRef.current = true;
    setDark(Boolean(snapshot.dark ?? true));
    setAutoDetectExpenseCategory(Boolean(snapshot.autoDetectExpenseCategory ?? true));
    setCats(normalizeCats(snapshot.cats));
    setIncomeTypes(normalizeIncomeTypes(snapshot.incomeTypes));
    setAccounts(normalizeAccounts(snapshot.accounts));
    setBalanceCheckpoints(snapshot.balanceCheckpoints && typeof snapshot.balanceCheckpoints === "object" ? snapshot.balanceCheckpoints : {});
    setPeople(normalizePeople(snapshot.people));
    setGroups(Array.isArray(snapshot.groups) ? snapshot.groups : []);
    setTxns(normalizeTxns(snapshot.txns));
    setInvestments(Array.isArray(snapshot.investments) ? snapshot.investments : []);
    setBills(Array.isArray(snapshot.bills) ? snapshot.bills : []);
    setLiabilities(Array.isArray(snapshot.liabilities) ? snapshot.liabilities : []);
    setTrackedAssets(Array.isArray(snapshot.trackedAssets) ? snapshot.trackedAssets : []);
    setLoans(normalizeLoans(snapshot.loans));
    setAnnualBudget(Number(snapshot.annualBudget || 600000));
    setMonthOverrides(snapshot.monthOverrides && typeof snapshot.monthOverrides === "object" ? snapshot.monthOverrides : {});
    if(Array.isArray(snapshot.cardOrder) && snapshot.cardOrder.length) setCardOrder(snapshot.cardOrder);
    window.setTimeout(() => { applyingCloudSnapshotRef.current = false; }, 0);
  }, [setCardOrder]);

  const pushCloudSnapshot = useCallback(async (statusText = "Cloud sync complete.", quiet = false) => {
    if(!cloudUser?.id || !isCloudSyncConfigured) return;
    if(!quiet) setCloudBusy(true);
    try{
      const nextSnapshot = cloudSnapshotRef.current || {};
      const saved = await saveCloudSnapshot(cloudUser.id, nextSnapshot);
      setLastSyncedAt(saved?.updated_at || nextSnapshot.savedAt || new Date().toISOString());
      setCloudStatus(statusText);
    }catch(err){
      setCloudStatus(`Sync failed: ${err.message}`);
    }finally{
      if(!quiet) setCloudBusy(false);
    }
  }, [cloudUser]);

  const pullCloudSnapshot = useCallback(async () => {
    if(!cloudUser?.id || !isCloudSyncConfigured) return;
    setCloudBusy(true);
    try{
      const record = await loadCloudSnapshot(cloudUser.id);
      if(record?.snapshot){
        applyCloudSnapshot(record.snapshot);
        setLastSyncedAt(record.updated_at || record.snapshot?.savedAt || new Date().toISOString());
        setCloudStatus("Cloud data loaded for this account.");
      } else {
        const nextSnapshot = cloudSnapshotRef.current || {};
        const seeded = await saveCloudSnapshot(cloudUser.id, nextSnapshot);
        setLastSyncedAt(seeded?.updated_at || nextSnapshot.savedAt || new Date().toISOString());
        setCloudStatus("First sync complete. Current data is now shared across your web and desktop apps.");
      }
    }catch(err){
      setCloudStatus(`Cloud load failed: ${err.message}`);
    }finally{
      setCloudBusy(false);
      setCloudHydrated(true);
    }
  }, [cloudUser, applyCloudSnapshot]);

  const handleCloudAuth = useCallback(async (mode = "signin") => {
    if(!isCloudSyncConfigured) return;
    if(!syncEmail.trim() || !syncPassword.trim()){
      setCloudStatus("Enter your email and password first.");
      return;
    }
    setCloudBusy(true);
    try{
      const data = mode==="signup"
        ? await signUpWithPassword(syncEmail.trim(), syncPassword)
        : await signInWithPassword(syncEmail.trim(), syncPassword);
      const nextUser = data?.session?.user ?? null;
      if(nextUser?.email) setSyncEmail(nextUser.email);
      setCloudUser(nextUser);
      setCloudHydrated(!nextUser);
      setCloudStatus(
        mode==="signup"
          ? (nextUser ? "Account created and signed in. Loading your cloud data..." : "Account created. Check your email if confirmation is enabled, then sign in.")
          : "Signed in. Loading your cloud data..."
      );
      setSyncPassword("");
    }catch(err){
      setCloudStatus(`${mode==="signup" ? "Sign-up" : "Sign-in"} failed: ${err.message}`);
    }finally{
      setCloudBusy(false);
    }
  }, [syncEmail, syncPassword]);

  const handleCloudSignOut = useCallback(async () => {
    setCloudBusy(true);
    try{
      await signOutCloud();
      setCloudUser(null);
      setCloudHydrated(true);
      setLastSyncedAt("");
      setSyncPassword("");
      setCloudStatus("Signed out. Local data stays on this device until you sign back in.");
    }catch(err){
      setCloudStatus(`Sign-out failed: ${err.message}`);
    }finally{
      setCloudBusy(false);
    }
  }, []);

  useEffect(() => {
    if(!isCloudSyncConfigured || !supabase) return;
    let mounted = true;
    getCurrentCloudUser()
      .then(user => {
        if(!mounted) return;
        setCloudUser(user);
        setCloudHydrated(!user);
        if(user?.email) setSyncEmail(user.email);
      })
      .catch(err => {
        if(!mounted) return;
        setCloudStatus(`Cloud setup error: ${err.message}`);
        setCloudHydrated(true);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if(!mounted) return;
      const nextUser = session?.user ?? null;
      setCloudUser(nextUser);
      if(nextUser?.email) setSyncEmail(nextUser.email);
      if(!nextUser){
        setLastSyncedAt("");
        setCloudHydrated(true);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if(!cloudUser?.id || !isCloudSyncConfigured) return;
    setCloudHydrated(false);
    setCloudStatus("Loading cloud data...");
    pullCloudSnapshot();
  }, [cloudUser?.id, pullCloudSnapshot]);

  useEffect(() => {
    if(!cloudUser?.id || !isCloudSyncConfigured || !cloudHydrated || applyingCloudSnapshotRef.current) return;
    const timer = window.setTimeout(() => {
      pushCloudSnapshot("Synced across your signed-in web and desktop apps.", true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [cloudUser?.id, cloudHydrated, dark, autoDetectExpenseCategory, cats, incomeTypes, accounts, balanceCheckpoints, people, groups, txns, investments, bills, liabilities, trackedAssets, loans, annualBudget, monthOverrides, cardOrder, pushCloudSnapshot]);

  const moveCard = (idx, dir) => {
    const arr = cardOrder.map(x=>x); // fully mutable copy
    const swap = idx + dir;
    if(swap < 0 || swap >= arr.length) return;
    const tmp = arr[idx];
    arr[idx] = arr[swap];
    arr[swap] = tmp;
    const newArr = arr.map(x=>x);
    setCardOrder(newArr);
    localStorage.setItem("arth_card_order", JSON.stringify(newArr));
  };

  const Home = () => {
    const ccList = accounts.filter(a=>a.type==="cc");
    const ccSummaries = ccList.map(card=>({ card, ...getCardSummary(card) }));
    const totalDue = ccSummaries.reduce((s,item)=>s+item.currentDue,0);
    const totalUnbilled = ccSummaries.reduce((s,item)=>s+item.currentCycleSpend,0);
    const anyHighUtil = ccSummaries.some(item=>item.isOverAlert);
    const nextDueCard = [...ccSummaries].filter(item=>item.currentDue>0).sort((a,b)=>a.dueOn-b.dueOn)[0] || null;
    const monthly = monthOverrides[viewMonth] || Math.round(annualBudget/12);
    const budgetPct = Math.min(100,Math.round(myActual/Math.max(1,monthly)*100));
    const diff = monthly - myActual;
    const isOver = diff < 0;

    const groupSpent = byCat.find(c=>c.id==="family")?.value || 0;
    const leftDays = daysLeft(viewMonth);
    const CARDS = {
      stats: (
        <div key="stats" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          {[
            {label:"Income",value:`${sym}${fmt(totalIncome)}`,color:T.success,icon:"ðŸ’š",action:()=>{ setTab("transactions"); setFType("income"); }},
            {label:"Investment",value:`${sym}${fmt(totalInvested)}`,color:T.info,icon:"ðŸ’¹",action:()=>setShowInvestments(true)},
            {label:"People & Groups",value:`${sym}${fmt(groupSpent)}`,color:T.info,icon:"ðŸ‘¥",action:()=>setTab("people")},
            {label:"Budget",value:`${sym}${fmt(monthly)}`,color:T.warn,icon:"🎯",action:()=>{ setShowSettings(true); setSettingsSection("budget"); }},
            {label:"To Receive",value:`${sym}${fmt(monthDirectOwedToMe)}`,color:T.accent,icon:"ðŸ”„",action:()=>setShowReceivablesList(true)},
            {label:"Net Savings",value:`${sym}${fmtK(Math.max(0,totalIncome-myActual-totalInvested))}`,color:T.success,icon:"ðŸ’°",action:()=>setTab("home")},
          ].map(s=>(
            <div key={s.label} onClick={s.action} style={{ ...card,marginBottom:0,padding:"12px",cursor:"pointer" }}>
              <div style={{ fontSize:20,marginBottom:4 }}>{s.icon}</div>
              <div style={{ color:s.color,fontSize:16,fontWeight:800 }}>{s.value}</div>
              <div style={{ color:T.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      ),


      categories: byCat.length>0 ? (
        <div key="categories" style={{ ...card,padding:"16px 14px" }}>
          <div style={{ color:T.text,fontSize:15,fontWeight:800,marginBottom:14 }}>Spend by Category</div>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={byCat} cx="50%" cy="50%" innerRadius={38} outerRadius={68} dataKey="value" stroke="none">
                  {byCat.map((c,i)=><Cell key={i} fill={c.color} opacity={0.9}/>)}
                </Pie>
                <Tooltip content={({active,payload})=>active&&payload?.length?<div style={ttStyle}><b style={{color:payload[0].payload.color}}>{payload[0].payload.icon} {payload[0].name}</b><br/>{sym}{fmt(payload[0].value)}</div>:null}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex:1 }}>
              {[...byCat].sort((a,b)=>b.value-a.value).slice(0,6).map((c,i)=>{
                return (
                  <div key={i} style={{ marginBottom:7 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2 }}>
                      <span style={{ color:T.sub,fontSize:11 }}>{c.icon} {c.name.split(" ")[0]}</span>
                      <span style={{ color:T.text,fontSize:11,fontWeight:800 }}>{sym}{fmtK(c.value)}</span>
                    </div>
                    {c.budget>0&&<div style={{ height:2,background:T.border,borderRadius:1 }}>
                      <div style={{ height:"100%",width:`${Math.min(100,Math.round(c.value/c.budget*100))}%`,background:c.value>c.budget?T.danger:c.color,borderRadius:1 }}/>
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null,

      cc: ccList.length>0 ? (
        <div key="cc" onClick={()=>{
          if(ccList.length===1) setShowAccDetail(ccList[0]);
          else { setShowSettings(true); setSettingsSection("accounts"); }
        }} style={{ ...card,cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:36,height:36,borderRadius:10,background:T.danger+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>ðŸ’³</div>
          <div style={{ flex:1 }}>
            <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{ccList.length} Credit Card{ccList.length>1?"s":""}</div>
            <div style={{ color:T.sub,fontSize:11,marginTop:1 }}>{ccList.map(a=>a.name).join(" · ")}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:totalDue>0?T.danger:T.success,fontSize:14,fontWeight:800 }}>{sym}{fmt(totalDue)} due now</div>
            <div style={{ color:anyHighUtil?T.danger:T.sub,fontSize:10 }}>
              {totalUnbilled>0
                ? `${sym}${fmt(totalUnbilled)} unbilled`
                : nextDueCard
                  ? `Due ${nextDueCard.dueOn.toLocaleDateString("en-IN",{ day:"2-digit", month:"short" })}`
                  : "No current due"}
            </div>
          </div>
          <div style={{ color:T.sub,fontSize:16 }}>â€º</div>
        </div>
      ) : null,

      bills: (()=>{
        const today = new Date();
        const upcoming = bills.filter(b=>b.status==="unpaid").sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).slice(0,4);
        const overdue = upcoming.filter(b=>new Date(b.dueDate)<today);
        if(!upcoming.length) return null;
        return (
          <div key="bills" style={card}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
              <span style={{ color:T.text,fontSize:15,fontWeight:800 }}>ðŸ“… Bills Due</span>
              {overdue.length>0&&<span style={{ background:T.danger+"22",color:T.danger,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700 }}>{overdue.length} overdue</span>}
            </div>
            {upcoming.map(b=>{
              const daysUntil=Math.ceil((new Date(b.dueDate)-today)/(1000*60*60*24));
              const isOverdue=daysUntil<0;
              const cat=getCat(b.catId);
              return (
                <div key={b.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ width:32,height:32,borderRadius:9,background:(isOverdue?T.danger:daysUntil<=3?T.warn:T.success)+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>{cat.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{b.name}</div>
                    <div style={{ color:isOverdue?T.danger:daysUntil<=3?T.warn:T.sub,fontSize:11 }}>{isOverdue?`${Math.abs(daysUntil)}d overdue`:daysUntil===0?"Due today":`Due in ${daysUntil}d`}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    {b.amount>0&&<div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{sym}{fmt(b.amount)}</div>}
                    <button onClick={e=>{ e.stopPropagation();
                      const accId=b.accId||accounts.find(a=>a.type!=="cc")?.id||"";
                      setTxns(p=>[{id:Date.now(),type:"expense",desc:b.name,merchant:b.merchant||"",date:todayStr(),note:"Bill payment",catId:b.catId,catIds:b.catIds||[b.catId],subId:b.subId||null,accId,people:b.splitPeople||{},forPerson:"",groupId:b.groupId||null,groupCollectiveAmount:Number(b.groupCollectiveAmount||0),amount:b.amount||0,isBillPayment:true,billInvoiceNo:b.invoiceNo||null,paidBillId:b.id,paidBillName:b.name},...p]);
                      setBills(p=>p.map(x=>x.id===b.id?{...x,status:"paid",paidDate:todayStr()}:x));
                      if(b.recurring){ const next=new Date(b.dueDate); if(b.frequency==="monthly") next.setMonth(next.getMonth()+1); else if(b.frequency==="quarterly") next.setMonth(next.getMonth()+3); else if(b.frequency==="halfyearly") next.setMonth(next.getMonth()+6); else if(b.frequency==="yearly") next.setFullYear(next.getFullYear()+1); setBills(p=>[...p,{...b,id:genId(),status:"unpaid",dueDate:next.toISOString().split("T")[0],paidDate:null}]); }
                    }} style={{ background:T.success+"22",border:`1px solid ${T.success}44`,borderRadius:8,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.success,fontFamily:"Nunito,sans-serif" }}>Pay</button>
                  </div>
                </div>
              );
            })}
            <button onClick={()=>setTab("bills")} style={{ background:"none",border:"none",color:T.accent,fontSize:12,fontWeight:800,cursor:"pointer",marginTop:8,width:"100%",textAlign:"right" }}>Manage bills â†’</button>
          </div>
        );
      })(),

      recent: txns.length>0 ? (
        <div key="recent" style={card}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <span style={{ color:T.text,fontSize:15,fontWeight:800 }}>Recent</span>
            <button onClick={()=>setTab("transactions")} style={{ background:"none",border:"none",color:T.accent,fontSize:12,fontWeight:800,cursor:"pointer" }}>See all â†’</button>
          </div>
          {[...txns]
            .sort((a,b)=>{
              const da = new Date(a.date||0);
              const db = new Date(b.date||0);
              if(db-da!==0) return db-da;
              return String(b.id||"").localeCompare(String(a.id||""));
            })
            .slice(0,5)
            .map((t,i,arr)=><TxnRow key={t.id} t={t} last={i===arr.length-1}/>)}
        </div>
      ) : (
        <div key="recent" style={{ ...card,textAlign:"center",padding:40 }}>
          <div style={{ fontSize:48,marginBottom:12 }}>ðŸ’¸</div>
          <div style={{ color:T.text,fontSize:16,fontWeight:800,marginBottom:8 }}>No transactions yet</div>
          <div style={{ color:T.sub,fontSize:13,marginBottom:20 }}>Tap + Add to get started</div>
          <button onClick={()=>setShowAdd(true)} style={btnP}>+ Add First Expense</button>
        </div>
      ),
    };

    return (
      <div>
        {/* Hero â€” sticky spend+budget+month nav */}
        <div style={{ position:"sticky",top:56,zIndex:40,background:dark?"#0d0a05":"#fffbf0",borderBottom:`1px solid ${T.border}`,padding:"14px 18px 16px" }}>
          {/* Month nav */}
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
            <button onClick={()=>setViewMonth(m=>{ const [y,mo]=m.split("-").map(Number); const d=new Date(y,mo-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })} style={{ background:"none",border:"none",color:T.accent,fontSize:22,cursor:"pointer",padding:0,lineHeight:1 }}>â€¹</button>
            <div style={{ color:T.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,flex:1,textAlign:"center" }}>{new Date(viewMonth+"-01").toLocaleString("en-IN",{month:"long",year:"numeric"})}</div>
            <button onClick={()=>setViewMonth(m=>{ const [y,mo]=m.split("-").map(Number); const d=new Date(y,mo,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })} style={{ background:"none",border:"none",color:T.accent,fontSize:22,cursor:"pointer",padding:0,lineHeight:1 }}>â€º</button>
          </div>
          {/* Spend + Budget side by side */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12 }}>
            <div>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:3 }}>Spent</div>
              <div style={{ color:T.danger,fontSize:28,fontWeight:900,lineHeight:1 }}>{sym}{fmt(myActual)}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:3 }}>Budget</div>
              <div style={{ color:T.text,fontSize:28,fontWeight:900,lineHeight:1 }}>{sym}{fmt(monthly)}</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height:6,background:T.border,borderRadius:3,marginBottom:6 }}>
            <div style={{ height:"100%",width:`${budgetPct}%`,background:budgetPct>90?T.danger:budgetPct>70?T.warn:T.success,borderRadius:3,transition:"width 0.3s" }}/>
          </div>
          {/* Bottom row */}
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ color:isOver?T.danger:T.success,fontSize:12,fontWeight:800 }}>{isOver?"âˆ’":"+"}{sym}{fmt(Math.abs(diff))} {isOver?"over":"left"} · {leftDays}d</span>
            {safePerDay!==null&&<span style={{ color:T.success,fontSize:12,fontWeight:800 }}>Safe/day: {sym}{fmt(safePerDay)}</span>}
          </div>
        </div>

        <div style={{ padding:"14px 16px 0" }}>
          {/* Edit cards toggle */}
          <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:8 }}>
            <button onClick={()=>setEditingCards(e=>!e)} style={{ background:editingCards?T.accent+"22":"none",border:`1px solid ${editingCards?T.accent:T.border}`,borderRadius:20,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700,color:editingCards?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{editingCards?"âœ“ Done":"⠿ Arrange"}</button>
          </div>

          {/* Cards in user-defined order */}
          {cardOrder.map((cardId, idx) => {
            const cardEl = CARDS[cardId];
            if(!cardEl) return null;
            return (
              <div key={cardId} style={{ position:"relative",marginBottom:12 }}>
                {editingCards&&(
                  <div style={{ position:"absolute",right:-8,top:"50%",transform:"translateY(-50%)",display:"flex",flexDirection:"column",gap:4,zIndex:10 }}>
                    <button onClick={()=>moveCard(idx,-1)} disabled={idx===0} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:8,width:28,height:28,cursor:idx===0?"not-allowed":"pointer",fontSize:14,color:idx===0?T.border:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Nunito,sans-serif" }}>â†‘</button>
                    <button onClick={()=>moveCard(idx,1)} disabled={idx===cardOrder.length-1} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:8,width:28,height:28,cursor:idx===cardOrder.length-1?"not-allowed":"pointer",fontSize:14,color:idx===cardOrder.length-1?T.border:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Nunito,sans-serif" }}>â†“</button>
                  </div>
                )}
                <div style={{ marginRight:editingCards?36:0, transition:"margin 0.2s" }}>
                  {cardEl}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // â”€â”€ TRANSACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const Transactions = () => {
    const expenseAccountTypes = ACC_TYPES.filter(opt=>accounts.some(a=>a.type===opt.id));
    const hasActiveFilters = Boolean(
      txnDateFrom ||
      txnDateTo ||
      expenseSourceFilter !== "all" ||
      expenseCardFilter !== "all" ||
      incomeTypeFilter !== "all" ||
      incomeAccountFilter !== "all" ||
      investmentTypeFilter !== "all"
    );

    const clearTxnFilters = () => {
      setTxnDateFrom("");
      setTxnDateTo("");
      setExpenseSourceFilter("all");
      setExpenseCardFilter("all");
      setIncomeTypeFilter("all");
      setIncomeAccountFilter("all");
      setInvestmentTypeFilter("all");
    };

    return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ color:T.text,fontSize:20,fontWeight:900 }}>Transactions</div>
          <div style={{ color:T.sub,fontSize:11,fontWeight:700 }}>{filteredTxns.length} shown</div>
        </div>

        <div style={{ display:"flex",flexWrap:"wrap",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:10 }}>
          {["All","expense","income","investment","transfer","cc_payment","settlement_in"].map(type=>(
            <Chip key={type} color={type==="All"?T.accent:txnColor(type,T)} active={fType===type} onClick={()=>setFType(type)}>
              {type==="All" ? "All" : txnLabel(type)}
            </Chip>
          ))}
        </div>

        <div style={{ ...card,padding:"12px 14px" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12 }}>
            <div>
              <span style={lbl}>TXN from</span>
              <input style={inp} type="date" value={txnDateFrom} onChange={e=>setTxnDateFrom(e.target.value)}/>
            </div>
            <div>
              <span style={lbl}>TXN to</span>
              <input style={inp} type="date" value={txnDateTo} onChange={e=>setTxnDateTo(e.target.value)}/>
            </div>
          </div>

          {fType==="expense"&&(
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              <div>
                <span style={lbl}>Paid via</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  <Chip color={T.accent} active={expenseSourceFilter==="all"} onClick={()=>{ setExpenseSourceFilter("all"); setExpenseCardFilter("all"); }}>
                    All ({expenseBaseTxns.length})
                  </Chip>
                  {expenseAccountTypes.map(opt=>{
                    const count = expenseBaseTxns.filter(txn=>getAcc(txn.accId)?.type===opt.id).length;
                    return (
                      <Chip key={opt.id} color={opt.id==="cc"?T.danger:T.info} active={expenseSourceFilter===opt.id} onClick={()=>{
                        setExpenseSourceFilter(opt.id);
                        if(opt.id !== "cc") setExpenseCardFilter("all");
                      }}>
                        {opt.icon} {opt.label.replace(" Account","").replace(" Card","")} ({count})
                      </Chip>
                    );
                  })}
                </div>
              </div>

              {expenseSourceFilter==="cc"&&accounts.some(a=>a.type==="cc")&&(
                <div>
                  <span style={lbl}>Card</span>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    <Chip color={T.accent} active={expenseCardFilter==="all"} onClick={()=>setExpenseCardFilter("all")}>
                      All Cards ({expenseBaseTxns.filter(txn=>getAcc(txn.accId)?.type==="cc").length})
                    </Chip>
                    {accounts.filter(a=>a.type==="cc").map(cardAcc=>{
                      const count = expenseBaseTxns.filter(txn=>String(txn.accId)===String(cardAcc.id)).length;
                      return (
                        <Chip key={cardAcc.id} color={cardAcc.color} active={expenseCardFilter===cardAcc.id} onClick={()=>setExpenseCardFilter(cardAcc.id)}>
                          ðŸ’³ {cardAcc.name} ({count})
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {fType==="income"&&(
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              <div>
                <span style={lbl}>Income type</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  <Chip color={T.accent} active={incomeTypeFilter==="all"} onClick={()=>setIncomeTypeFilter("all")}>
                    All ({incomeBaseTxns.length})
                  </Chip>
                  {incomeTypeOptions.map(type=>{
                    const count = incomeBaseTxns.filter(txn=>normalizeIncomeTypeValue(txn.incomeType||"salary")===type).length;
                    return (
                      <Chip key={type} color={T.success} active={incomeTypeFilter===type} onClick={()=>setIncomeTypeFilter(type)}>
                        {formatIncomeTypeLabel(type)} ({count})
                      </Chip>
                    );
                  })}
                </div>
              </div>
              <div>
                <span style={lbl}>Account</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  <Chip color={T.accent} active={incomeAccountFilter==="all"} onClick={()=>setIncomeAccountFilter("all")}>
                    All Accounts ({incomeBaseTxns.length})
                  </Chip>
                  {accounts.filter(a=>a.type!=="cc").map(acc=>{
                    const count = incomeBaseTxns.filter(txn=>String(txn.accId)===String(acc.id)).length;
                    return (
                      <Chip key={acc.id} color={acc.color} active={incomeAccountFilter===acc.id} onClick={()=>setIncomeAccountFilter(acc.id)}>
                        {accIcon(acc.type)} {acc.name} ({count})
                      </Chip>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {fType==="investment"&&(
            <div>
              <span style={lbl}>Investment type</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                <Chip color={T.accent} active={investmentTypeFilter==="all"} onClick={()=>setInvestmentTypeFilter("all")}>
                  All ({investmentBaseTxns.length})
                </Chip>
                {INVEST_TYPES.map(type=>{
                  const count = investmentBaseTxns.filter(txn=>String(txn.investType||"mf")===type.id).length;
                  return (
                    <Chip key={type.id} color={type.color} active={investmentTypeFilter===type.id} onClick={()=>setInvestmentTypeFilter(type.id)}>
                      {type.icon} {type.name.split("/")[0]} ({count})
                    </Chip>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,paddingTop:10,borderTop:`1px solid ${T.border}` }}>
            <span style={{ color:T.sub,fontSize:11 }}>{filteredTxns.length} transaction{filteredTxns.length!==1?"s":""} shown</span>
            <button onClick={clearTxnFilters} style={{ ...btnG,width:"auto",padding:"8px 12px",fontSize:11,opacity:hasActiveFilters?1:0.65 }}>
              Clear filters
            </button>
          </div>
        </div>

        <div style={card}>
          {filteredTxns.length===0?<div style={{ textAlign:"center",padding:40,color:T.sub }}>No transactions match the selected filters</div>
            :filteredTxns.map((t,i)=><TxnRow key={t.id} t={t} last={i===filteredTxns.length-1}/>)}
        </div>
      </div>
    );
  };

  // â”€â”€ PEOPLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const People = () => {
    const [newName,setNewName]=useState("");
    const [newEmoji,setNewEmoji]=useState("ðŸ‘¤");
    const [newRelation,setNewRelation]=useState("");
    const [editingGroupName,setEditingGroupName]=useState("");
    const [editingGroupBudget,setEditingGroupBudget]=useState("");
    const [editingGroupMembers,setEditingGroupMembers]=useState([]);
    const [editingGroupIncludeMe,setEditingGroupIncludeMe]=useState(true);
    const [isEditingGroup,setIsEditingGroup]=useState(false);
    const [newColor,setNewColor]=useState(PALETTE[1]);
    const [newPersonType,setNewPersonType]=useState("contact");
    const [newCreditLimit,setNewCreditLimit]=useState("");
    const [newSpendBudget,setNewSpendBudget]=useState("");
    const [newGroupName,setNewGroupName]=useState("");
    const [newGroupType,setNewGroupType]=useState("");
    const [newGroupColor,setNewGroupColor]=useState(PALETTE[5]);
    const [newGroupMembers,setNewGroupMembers]=useState([]);
    const [newGroupIncludeMe,setNewGroupIncludeMe]=useState(true);
    const [newGroupManualLimit,setNewGroupManualLimit]=useState("");
    const [subView,setSubView]=useState("people");
    const mePerson = people.find(p=>p.isMe) || ME;
    const sortedPeople = people
      .filter(p=>!p.isMe)
      .slice()
      .sort((a,b)=>{
        const favDiff = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
        if(favDiff) return favDiff;
        return a.name.localeCompare(b.name, "en", { sensitivity:"base" });
      });
    const listedPeople = [mePerson, ...sortedPeople].filter(Boolean);

    useEffect(()=>{
      if(selectedGroup){
        setEditingGroupName(selectedGroup.name||"");
        setEditingGroupBudget(String(selectedGroup.manualLimit||""));
        setEditingGroupMembers([...(selectedGroup.members||[])]);
        setEditingGroupIncludeMe(selectedGroup.includeMe !== false);
        setIsEditingGroup(false);
      }
    },[selectedGroup]);

    const toggleFavorite = person => {
      const nextFavorite = !person.favorite;
      setPeople(prev=>prev.map(x=>x.id===person.id?{...x,favorite:nextFavorite}:x));
      setSelectedPerson(prev=>prev?.id===person.id?{...prev,favorite:nextFavorite}:prev);
    };

    const addPerson=()=>{
      if(!newName.trim()) return;
      setPeople(p=>[...p,{ id:genId(), name:newName.trim(), emoji:newEmoji, relation:newRelation, color:newColor, personType:newPersonType, creditLimit:parseFloat(newCreditLimit)||0, spendBudget:parseFloat(newSpendBudget)||0, favorite:false }]);
      setNewName(""); setNewRelation(""); setNewCreditLimit(""); setNewSpendBudget("");
    };

    const addGroup=()=>{
      if(!newGroupName.trim()) return;
      const gtlow=(newGroupType||"group").toLowerCase();
      const gicon=gtlow.includes("house")||gtlow.includes("flat")||gtlow.includes("property")?"🏠":gtlow.includes("trip")||gtlow.includes("travel")?"âœˆ️":gtlow.includes("office")||gtlow.includes("work")?"ðŸ’¼":gtlow.includes("family")?"ðŸ‘¨â€ðŸ‘©â€ðŸ‘§":gtlow.includes("friend")?"ðŸ‘«":gtlow.includes("society")||gtlow.includes("building")?"🏢":"ðŸ‘¥";
      setGroups(p=>[...p,{ id:genId(), type:newGroupType||"Group", name:newGroupName.trim(), icon:gicon, color:newGroupColor, members:newGroupMembers, includeMe:newGroupIncludeMe, manualLimit:parseFloat(newGroupManualLimit)||0 }]);
      setNewGroupName(""); setNewGroupMembers([]); setNewGroupManualLimit(""); setNewGroupIncludeMe(true);
    };

    if(selectedPerson){
      const p=selectedPerson;
      const s=settlements[p.id]||{owesMe:0,iOwe:0};
      const selfTrackedSpend = Number(personSpend["__me__"]||0);
      const overallSpentByMe = myActual;
      const spent=p.isMe ? selfTrackedSpend : (personSpend[p.id]||0);
      const creditLimit=p.creditLimit||0;
      const creditPct=creditLimit>0?Math.min(100,Math.round(s.owesMe/creditLimit*100)):0;
      const spendBudget=p.spendBudget||0;
      const spentPct=spendBudget>0?Math.min(100,Math.round(spent/spendBudget*100)):0;
      const relTxns=txns.filter(t=>t.type==="expense"&&t.people&&t.people[p.id]&&!p.isMe);
      const taggedTxns=p.isMe
        ? txns.filter(t=>{
            if(t.type!=="expense") return false;
            return t.forPerson===p.id || Boolean(t.people?.__me__);
          })
        : txns.filter(t=>t.type==="expense"&&t.forPerson===p.id);
      const settlementTxns=txns.filter(t=>t.type==="settlement_in"&&t.fromPersonId===p.id).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
      return (
        <div style={{ padding:"14px 16px 0" }}>
          <button onClick={()=>setSelectedPerson(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:13,fontWeight:700,marginBottom:16,fontFamily:"Nunito,sans-serif" }}>â† People</button>
          <div style={{ ...card,background:`linear-gradient(135deg,${p.color}14,${T.card})` }}>
            <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:16 }}>
              <div style={{ width:52,height:52,borderRadius:"50%",background:p.color+"30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26 }}>{p.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ color:T.text,fontSize:20,fontWeight:900 }}>{p.name}{p.favorite?<span style={{ color:T.accent,fontSize:15,marginLeft:6 }}>â˜…</span>:""}</div>
                <div style={{ color:T.sub,fontSize:12,marginTop:1 }}>{p.relation} · <span style={{ color:p.personType==="dependant"?T.info:T.accent,fontWeight:700 }}>{p.personType==="dependant"?"Dependant":"Contact"}</span></div>
              </div>
              {!p.isMe&&<button onClick={e=>{ e.stopPropagation(); toggleFavorite(p); }} style={{ background:p.favorite?T.accentSoft:"none",border:`1px solid ${p.favorite?T.accent:T.border}`,borderRadius:10,padding:"7px 10px",cursor:"pointer",fontSize:13,fontWeight:800,color:p.favorite?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.favorite?"â˜… Fav":"â˜† Fav"}</button>}
            </div>

            {!p.isMe&&(
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
                <div style={{ background:T.input,borderRadius:10,padding:"10px 12px",textAlign:"center" }}>
                  <div style={{ color:T.success,fontSize:18,fontWeight:800 }}>{sym}{fmt(s.owesMe)}</div>
                  <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Owes You</div>
                  {creditLimit>0&&<><div style={{ height:3,background:T.border,borderRadius:2,marginTop:6,marginBottom:2 }}>
                    <div style={{ height:"100%",width:`${creditPct}%`,background:creditPct>80?T.danger:T.success,borderRadius:2 }}/>
                  </div><div style={{ color:T.sub,fontSize:9 }}>Credit limit: {sym}{fmt(creditLimit)}</div></>}
                </div>
                <div style={{ background:T.input,borderRadius:10,padding:"10px 12px",textAlign:"center" }}>
                  <div style={{ color:T.danger,fontSize:18,fontWeight:800 }}>{sym}{fmt(s.iOwe)}</div>
                  <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>You Owe</div>
                </div>
              </div>
            )}

            {(spent>0 || spendBudget>0)&&(
              <div style={{ background:T.input,borderRadius:10,padding:"10px 12px",marginBottom:14, border:`1px solid ${spendBudget>0 && spent>spendBudget ? T.danger : T.border}` }}>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginBottom:4 }}>{p.isMe ? "Your personal budget spend this month" : `Spent on ${p.name} this month`}</div>
                <div style={{ color:spent>spendBudget && spendBudget>0 ? T.danger : p.color,fontSize:20,fontWeight:900 }}>{sym}{fmt(spent)}</div>
                {p.isMe && <div style={{ color:T.sub,fontSize:10,marginTop:4 }}>Overall spent this month: {sym}{fmt(overallSpentByMe)}</div>}
                {spendBudget>0&&<><div style={{ height:3,background:T.border,borderRadius:2,marginTop:6,marginBottom:2 }}>
                  <div style={{ height:"100%",width:`${spentPct}%`,background:spentPct>90?T.danger:p.color,borderRadius:2 }}/>
                </div><div style={{ color:T.sub,fontSize:9 }}>{spendBudget>0?`Budget: ${sym}${fmt(spendBudget)} · ${sym}${fmt(Math.max(0,spendBudget-spent))} remaining`:""}</div>
                {spent>spendBudget && <div style={{ color:T.danger,fontSize:10,fontWeight:700,marginTop:4 }}>⚠️ Over budget by {sym}{fmt(spent-spendBudget)}</div>}</>}
              </div>
            )}

            {!p.isMe&&s.owesMe>0&&<button onClick={()=>{
              // Find first unsettled expense txn with this person
              const t=txns.find(x=>x.type==="expense"&&x.people&&x.people[p.id]&&!x.people[p.id]?.settled&&remainingShare(x.people[p.id])>0);
              if(t){ setSettleTxn(t); return; }
              // If only bills pending â€” build a synthetic txn for the settle modal
              const pendingBills=bills.filter(x=>x.status==="unpaid"&&x.splitPeople&&x.splitPeople[p.id]?.mode==="owes"&&remainingShare(x.splitPeople[p.id])>0);
              if(pendingBills.length>0){
                // Merge all pending bill amounts into one synthetic txn for the modal
                const totalAmt=pendingBills.reduce((s,b)=>s+remainingShare(b.splitPeople[p.id]),0);
                const syntheticTxn={
                  id:"bill_settle_"+p.id,
                  type:"expense",
                  desc:pendingBills.length===1?pendingBills[0].name:`${pendingBills.length} pending bills`,
                  amount:totalAmt,
                  people:{ [p.id]:{ amount:totalAmt, mode:"owes", settled:false } },
                  _billIds:pendingBills.map(b=>b.id),
                  _isBillSettle:true,
                };
                setSettleTxn(syntheticTxn);
                return;
              }
              setSettleTxn({
                id:"person_settle_"+p.id,
                type:"expense",
                desc:`Settlement with ${p.name}`,
                amount:s.owesMe,
                people:{ [p.id]:{ amount:s.owesMe, mode:"owes", settled:false } },
                _isFallbackSettle:true,
              });
            }} style={{ ...btnP,marginBottom:10 }}>ðŸ’° Settle with {p.name}</button>}
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={()=>setEditingPerson(p)} style={{ ...btnP,background:T.accentSoft,border:`1px solid ${T.accent}33`,color:T.accent,flex:1 }}>{p.isMe?"🎯 Edit My Budget":"✏️ Edit Profile"}</button>
              {!p.isMe&&<button onClick={()=>{ setPeople(prev=>prev.filter(x=>x.id!==p.id)); setSelectedPerson(null); }} style={{ ...btnP,background:"transparent",border:`1px solid ${T.danger}`,color:T.danger,flex:1 }}>ðŸ—‘️ Remove</button>}
            </div>
            {p.isMe&&<div style={{ color:T.sub,fontSize:11,textAlign:"center",padding:"8px 0" }}>This is you â€” you can edit your monthly self budget here</div>}
          </div>

          {(()=>{
            const personBills=bills.filter(b=>b.status==="unpaid"&&b.splitPeople&&b.splitPeople[p.id]&&b.splitPeople[p.id].mode==="owes"&&remainingShare(b.splitPeople[p.id])>0);
            if(!personBills.length) return null;
            return (
              <div style={{ ...card,border:`1px solid ${T.danger}44`,marginBottom:12 }}>
                <div style={{ color:T.danger,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10 }}>Pending Bills</div>
                {personBills.map((b,idx,arr)=>(
                  <div key={b.id} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:idx<arr.length-1?`1px solid ${T.border}`:"none" }}>
                    <div>
                      <div style={{ color:T.text,fontSize:13,fontWeight:600 }}>{b.name}</div>
                      <div style={{ color:T.danger,fontSize:11 }}>Due {b.dueDate}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ color:T.accent,fontSize:13,fontWeight:700 }}>{sym}{fmt(remainingShare(b.splitPeople[p.id]))}</div>
                      <div style={{ color:T.sub,fontSize:10 }}>owes you</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          {(relTxns.length>0||taggedTxns.length>0||settlementTxns.length>0)&&(
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:10 }}>Transactions</div>
          )}
          {relTxns.length>0&&(
            <div style={card}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10 }}>Shared expenses</div>
              {relTxns.map((t,idx,arr)=>{ const info=t.people[p.id]; return (
                <div key={t.id} style={{ display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:idx<arr.length-1?`1px solid ${T.border}`:"none" }}>
                  <div>
                    <div style={{ color:T.text,fontSize:13,fontWeight:600 }}>{t.desc}</div>
                    <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{t.date}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:info.mode==="owes"&&!info.settled?T.accent:T.sub,fontSize:13,fontWeight:700,textDecoration:info.settled?"line-through":"none" }}>{sym}{fmt(info.settled ? info.amount : remainingShare(info))}</div>
                    <div style={{ color:T.sub,fontSize:10 }}>{info.settled?"paid":info.mode==="owes"?"owes you":"on you"}</div>
                  </div>
                </div>
              );})}
            </div>
          )}
          {taggedTxns.length>0&&(
            <div style={card}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10 }}>{p.isMe ? "Your expense entries" : `Spent on ${p.name}`}</div>
              {taggedTxns.map((t,idx,arr)=>{
                const explicitMeAmt = Number(t.people?.__me__?.amount || 0);
                const displayAmt = p.isMe ? (t.forPerson===p.id ? Number(t.amount||0) : explicitMeAmt) : Number(t.amount||0);
                return (
                  <div key={t.id} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:idx<arr.length-1?`1px solid ${T.border}`:"none" }}>
                    <div>
                      <div style={{ color:T.text,fontSize:13,fontWeight:600 }}>{t.desc}</div>
                      <div style={{ color:T.sub,fontSize:10 }}>{t.date} · {getCat(t.catId)?.name}</div>
                    </div>
                    <div style={{ color:p.color,fontSize:13,fontWeight:700 }}>{sym}{fmt(displayAmt)}</div>
                  </div>
                );
              })}
            </div>
          )}
          {settlementTxns.length>0&&(
            <div style={card}>
              <div style={{ color:T.success,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10 }}>Settlements received</div>
              {settlementTxns.map((st,idx,arr)=>(
                <div key={st.id} onClick={()=>setEditingTxn(st)} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:idx<arr.length-1?`1px solid ${T.border}`:"none",cursor:"pointer" }}>
                  <div>
                    <div style={{ color:T.text,fontSize:13,fontWeight:600 }}>{st.desc||`Settlement from ${p.name}`}</div>
                    <div style={{ color:T.sub,fontSize:10 }}>{st.date} · {getAcc(st.accId)?.name||"account"}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:T.success,fontSize:13,fontWeight:700 }}>+{sym}{fmt(st.amount)}</div>
                    <div style={{ color:T.info,fontSize:10 }}>tap to edit</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if(selectedGroup){
      const g=selectedGroup;
      const gTxns=txns.filter(t=>t.groupId===g.id);
      const gBills=bills.filter(b=>b.groupId===g.id&&b.status==="unpaid");
      const total=groupReceivableTotal(g.id);
      const currentMembers=isEditingGroup ? editingGroupMembers : (g.members||[]);
      const groupIncludeMe = isEditingGroup ? editingGroupIncludeMe : (g.includeMe !== false);
      const displayedMemberCount = currentMembers.length + (groupIncludeMe ? 1 : 0);
      const nonMembers=people.filter(p=>!p.isMe&&!currentMembers.includes(p.id));

      const groupTotalSpend = gTxns.filter(t=>t.type==="expense").reduce((sum,t)=>sum+Number(t.amount||0),0) + gBills.reduce((sum,b)=>sum+Number(b.amount||0),0);
      const groupBudget = Number(g.manualLimit||0);
      const groupOver = groupBudget>0 && groupTotalSpend>groupBudget;

      const groupPaidByMe = gTxns.filter(t=>t.type==="expense").reduce((sum,t)=>sum+Number(t.amount||0),0);
      const groupMySpend = gTxns.reduce((sum,t)=>{
        if(t.type!=="expense") return sum;
        const otherOwed = Object.entries(t.people||{}).filter(([pid])=>pid!=="__me__").reduce((s,[,info])=>s+(Number(info.amount||0)),0);
        return sum + Math.max(0, Number(t.amount||0) - otherOwed - getGroupCollectiveDue(t));
      },0);
      const groupIOwe = gTxns.reduce((sum,t)=>{
        const me=t.people?.__me__;
        if(!me||me.mode!=="owes"||me.settled) return sum;
        return sum + remainingShare(me);
      },0);
      const groupOwesMe = total;

      const getGroupMemberOwed = (groupId,pid)=>{
        const txnOwed = txns.filter(t=>t.groupId===groupId&&t.type==="expense"&&t.people&&t.people[pid]&&t.people[pid].mode==="owes"&&!t.people[pid].settled).reduce((sum,t)=>sum + remainingShare(t.people[pid]),0);
        const billOwed = bills.filter(b=>b.groupId===groupId&&b.status==="unpaid"&&b.splitPeople&&b.splitPeople[pid]&&b.splitPeople[pid].mode==="owes"&&!b.splitPeople[pid].settled).reduce((sum,b)=>sum + remainingShare(b.splitPeople[pid]),0);
        return txnOwed + billOwed;
      };

      const toggleMember=(pid)=>{
        const isMember=currentMembers.includes(pid);
        if(isMember){
          const owed=getGroupMemberOwed(g.id,pid);
          if(owed>0){
            const personName = getPerson(pid)?.name||pid;
            const choice = window.prompt(`Member ${personName} has ${sym}${fmt(owed)} unsettled in group '${g.name}'.\nChoose: 1) Remove + write off, 2) Cancel, 3) Keep in group`, "1");
            if(choice===null||choice.trim()==="2") return;
            if(choice.trim()==="3") return;
            if(choice.trim()==="1"){
              setTxns(prev=>prev.map(t=>{
                if(t.groupId!==g.id||t.type!=="expense"||!t.people||!t.people[pid]) return t;
                const info = t.people[pid];
                if(info.mode!=="owes"||info.settled) return t;
                return { ...t, people:{ ...t.people, [pid]:{ ...info, settled:true } } };
              }));
              setBills(prev=>prev.map(b=>{
                if(b.groupId!==g.id||b.status!=="unpaid"||!b.splitPeople||!b.splitPeople[pid]) return b;
                const info = b.splitPeople[pid];
                if(info.mode!=="owes"||info.settled) return b;
                return { ...b, splitPeople:{ ...b.splitPeople, [pid]:{ ...info, settled:true } } };
              }));
            }
          }
          setEditingGroupMembers(prev=>prev.filter(x=>x!==pid));
        } else {
          setEditingGroupMembers(prev=>[...prev,pid]);
        }
      };

      const startEditingGroup = () => {
        setEditingGroupName(g.name||"");
        setEditingGroupBudget(String(g.manualLimit||""));
        setEditingGroupMembers([...(g.members||[])]);
        setEditingGroupIncludeMe(g.includeMe !== false);
        setIsEditingGroup(true);
      };

      const cancelEditingGroup = () => {
        setEditingGroupName(g.name||"");
        setEditingGroupBudget(String(g.manualLimit||""));
        setEditingGroupMembers([...(g.members||[])]);
        setEditingGroupIncludeMe(g.includeMe !== false);
        setIsEditingGroup(false);
      };

      const saveGroupEdits = () => {
        const name = editingGroupName.trim();
        if(!name) return;
        const updated = {
          ...g,
          name,
          manualLimit:parseMoney(editingGroupBudget),
          members:editingGroupMembers,
          includeMe:editingGroupIncludeMe,
        };
        setGroups(prev=>prev.map(x=>x.id===g.id?updated:x));
        setSelectedGroup(updated);
        setIsEditingGroup(false);
      };

      return (
        <div style={{ padding:"14px 16px 0" }}>
          <button onClick={()=>setSelectedGroup(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:13,fontWeight:700,marginBottom:16,fontFamily:"Nunito,sans-serif" }}>â† Groups</button>
          <div style={card}>
            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
              <div style={{ width:46,height:46,borderRadius:14,background:g.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>{g.icon}</div>
              <div style={{ flex:1 }}>
                {isEditingGroup ? (
                  <div style={{ display:"flex",flexDirection:"column",gap:8,marginTop:2 }}>
                    <input value={editingGroupName} onChange={e=>setEditingGroupName(e.target.value)} style={{ ...inp, padding:"8px 10px", fontSize:16, fontWeight:700, width:"100%" }} placeholder="Group name" />
                    <input value={editingGroupBudget} onChange={e=>setEditingGroupBudget(e.target.value)} style={{ ...inp, padding:"8px 10px", fontSize:14, width:"100%" }} type="text" inputMode="decimal" placeholder="Group budget (0 = no budget)" />
                    <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                      <button onClick={saveGroupEdits} style={{ background:T.accent,border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:"#000",fontFamily:"Nunito,sans-serif" }}>Save</button>
                      <button onClick={cancelEditingGroup} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                    <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{g.name}</div>
                    <button onClick={startEditingGroup} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,color:T.accent,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>✏️ Edit Group</button>
                  </div>
                )}
                <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{g.type} · {sym}{fmt(total)} owes you · {displayedMemberCount} members{groupIncludeMe?" · you included":" · you not included"}</div>
                {(groupBudget>0 || groupTotalSpend>0) && (
                  <div style={{ marginTop:8, padding:10, borderRadius:10, background:groupOver?T.danger+"22":T.input, border:`1px solid ${groupOver?T.danger:T.border}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:groupOver?T.danger:T.sub }}>Group budget{groupBudget>0?`: ${sym}${fmt(groupBudget)}`:" (not set)"}</div>
                    <div style={{ fontSize:12, fontWeight:800, color:groupOver?T.danger:T.text, marginTop:3 }}>Spent: {sym}{fmt(groupTotalSpend)} {groupBudget>0 && `(remaining ${sym}${fmt(Math.max(0, groupBudget-groupTotalSpend))})`}</div>
                    {groupOver && <div style={{ color:T.danger, fontSize:11, fontWeight:700, marginTop:4 }}>⚠️ Over budget by {sym}{fmt(groupTotalSpend-groupBudget)}</div>}
                  </div>
                )}
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10 }}>
                  <div style={{ background:T.input,borderRadius:10,padding:8,textAlign:"center" }}>
                    <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>You paid</div>
                    <div style={{ color:T.info,fontSize:16,fontWeight:800 }}>{sym}{fmt(groupPaidByMe)}</div>
                  </div>
                  <div style={{ background:T.input,borderRadius:10,padding:8,textAlign:"center" }}>
                    <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>Your share</div>
                    <div style={{ color:T.accent,fontSize:16,fontWeight:800 }}>{sym}{fmt(groupMySpend)}</div>
                  </div>
                  <div style={{ background:T.input,borderRadius:10,padding:8,textAlign:"center" }}>
                    <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>You owe</div>
                    <div style={{ color:T.danger,fontSize:16,fontWeight:800 }}>{sym}{fmt(groupIOwe)}</div>
                  </div>
                  <div style={{ background:T.input,borderRadius:10,padding:8,textAlign:"center" }}>
                    <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>Group owes</div>
                    <div style={{ color:T.success,fontSize:16,fontWeight:800 }}>{sym}{fmt(groupOwesMe)}</div>
                  </div>
                </div>
              </div>
              <button onClick={()=>setGroups(prev=>prev.filter(x=>x.id!==g.id))&&setSelectedGroup(null)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:20 }}>ðŸ—‘</button>
            </div>

            <div style={{ marginBottom:12 }}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8 }}>{isEditingGroup ? "Add / Remove / Replace Members" : "Members"}</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                {isEditingGroup ? (
                  <button onClick={()=>setEditingGroupIncludeMe(prev=>!prev)} style={{ background:editingGroupIncludeMe?T.accentSoft:"none",border:`1px solid ${editingGroupIncludeMe?T.accent:T.border}`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,color:editingGroupIncludeMe?T.accent:T.sub,cursor:"pointer",fontFamily:"Nunito,sans-serif",display:"flex",alignItems:"center",gap:4 }}>
                    ðŸ§‘ Me {editingGroupIncludeMe ? "âœ“" : "+"}
                  </button>
                ) : groupIncludeMe ? (
                  <div style={{ background:T.accentSoft,border:`1px solid ${T.accent}44`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif",display:"flex",alignItems:"center",gap:4 }}>
                    ðŸ§‘ Me
                  </div>
                ) : null}
                {currentMembers.map(pid=>{ const p=getPerson(pid); return isEditingGroup ? (
                  <button key={pid} onClick={()=>toggleMember(pid)} style={{ background:p.color+"22",border:`1px solid ${p.color}66`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,color:p.color,cursor:"pointer",fontFamily:"Nunito,sans-serif",display:"flex",alignItems:"center",gap:4 }}>
                    {p.emoji} {p.name} <span style={{ fontSize:10,opacity:0.7 }}>âœ•</span>
                  </button>
                ) : (
                  <div key={pid} style={{ background:p.color+"18",border:`1px solid ${p.color}44`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,color:p.color,fontFamily:"Nunito,sans-serif",display:"flex",alignItems:"center",gap:4 }}>
                    {p.emoji} {p.name}
                  </div>
                ); })}
              </div>
            </div>

            {isEditingGroup && nonMembers.length>0&&<div style={{ marginBottom:14 }}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8 }}>Available people to add</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {nonMembers.map(p=>(
                  <button key={p.id} onClick={()=>toggleMember(p.id)} style={{ background:"none",border:`1px dashed ${T.border}`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,color:T.sub,cursor:"pointer",fontFamily:"Nunito,sans-serif",display:"flex",alignItems:"center",gap:4 }}>
                    {p.emoji} {p.name} <span style={{ fontSize:14,color:T.success }}>+</span>
                  </button>
                ))}
              </div>
            </div>}

            <div style={{ borderTop:`1px solid ${T.border}`,paddingTop:12,marginTop:4 }}>
              {(g.manualLimit||0)>0&&<div style={{ ...card,marginBottom:12,padding:"12px 14px",background:T.accentSoft,border:`1px solid ${T.accent}33` }}>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Manual group spend cap</div>
                <div style={{ color:T.accent,fontSize:18,fontWeight:900 }}>{sym}{fmt(g.manualLimit)}</div>
              </div>}
              {gBills.length>0&&<>
                <div style={{ color:T.danger,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8 }}>Pending Bills</div>
                {gBills.map(b=>(
                  <div key={b.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}` }}>
                    <div>
                      <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{b.name}</div>
                      <div style={{ color:T.danger,fontSize:11 }}>Due {b.dueDate}</div>
                    </div>
                    <div style={{ color:T.danger,fontSize:13,fontWeight:700 }}>{sym}{fmt(b.amount)}</div>
                  </div>
                ))}
                <div style={{ marginBottom:12 }}/>
              </>}
              <div style={{ color:T.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10 }}>Expenses</div>
              {gTxns.length===0&&gBills.length===0
                ?<div style={{ color:T.sub,fontSize:12,textAlign:"center",padding:20 }}>No expenses yet</div>
                :gTxns.map((t,idx,arr)=><TxnRow key={t.id} t={t} last={idx===arr.length-1}/>)}
              {/* Settlements related to group members */}
              {(()=>{
                const memberIds=g.members||[];
                const groupSettlements=txns.filter(t=>t.type==="settlement_in"&&memberIds.includes(t.fromPersonId));
                if(!groupSettlements.length) return null;
                return (<>
                  <div style={{ color:T.success,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginTop:12,marginBottom:8 }}>Settlements Received</div>
                  {groupSettlements.map(t=>{
                    const p=getPerson(t.fromPersonId);
                    return <div key={t.id} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}` }}>
                      <div><div style={{ color:T.text,fontSize:13,fontWeight:600 }}>{p.emoji} {p.name} paid</div><div style={{ color:T.sub,fontSize:11 }}>{t.date}{t.note?` · ${t.note}`:""}</div></div>
                      <div style={{ color:T.success,fontSize:13,fontWeight:700 }}>+{sym}{fmt(t.amount)}</div>
                    </div>;
                  })}
                </>);
              })()}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",gap:0,marginBottom:16,background:T.pill,borderRadius:12,padding:4 }}>
          {[["people","ðŸ‘¥ People"],["groups","ðŸ˜️ Groups"]].map(([v,l])=>(
            <button key={v} onClick={()=>setSubView(v)} style={{ flex:1,background:subView===v?T.card:"transparent",border:subView===v?`1px solid ${T.border}`:"none",borderRadius:9,padding:"8px 0",cursor:"pointer",fontSize:13,fontWeight:700,color:subView===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
          ))}
        </div>

        {subView==="people"&&<>
          {totalOwedToMe>0&&<div style={{ ...card,background:`linear-gradient(135deg,${T.success}10,${T.card})`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Total to Recover</div>
              <div style={{ color:T.success,fontSize:22,fontWeight:900,marginTop:4 }}>{sym}{fmt(totalOwedToMe)}</div>
            </div>
            <div style={{ fontSize:32 }}>ðŸ’°</div>
          </div>}

          {listedPeople.map(p=>{
            const s=settlements[p.id];
            const personalSpent = Number(personSpend["__me__"]||0);
            const spent=p.isMe ? personalSpent : (personSpend[p.id]||0);
            const net=(s?.owesMe||0)-(s?.iOwe||0);
            const creditLimit=p.creditLimit||0;
            const atLimit=!p.isMe&&creditLimit>0&&(s?.owesMe||0)>=creditLimit*0.9;
            return (
              <div key={p.id} onClick={()=>setSelectedPerson(p)} style={{ ...card,cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ width:42,height:42,borderRadius:"50%",background:p.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,position:"relative" }}>
                  {p.emoji}
                  {p.personType==="dependant"&&<div style={{ position:"absolute",bottom:-2,right:-2,fontSize:9,background:T.info,borderRadius:"50%",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center" }}>â™¥</div>}
                  {p.favorite&&<div style={{ position:"absolute",top:-2,right:-2,fontSize:9,background:T.accent,color:"#000",borderRadius:"50%",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900 }}>â˜…</div>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text,fontSize:14,fontWeight:800 }}>{p.name}{p.isMe?<span style={{ color:T.accent,fontSize:10,marginLeft:6 }}>you</span>:""}</div>
                  <div style={{ color:T.sub,fontSize:11,marginTop:1 }}>
                    {p.relation||p.personType}
                    {p.isMe
                      ? (myActual>0 ? ` · ${sym}${fmtK(spent)} personal · ${sym}${fmtK(myActual)} total` : (spent>0 ? ` · ${sym}${fmtK(spent)} personal` : ""))
                      : (spent>0 ? ` · ${sym}${fmtK(spent)} spent` : "")}
                    {atLimit&&<span style={{ color:T.danger,fontSize:10,fontWeight:700,marginLeft:6 }}>⚠️ Credit limit</span>}
                  </div>
                </div>
                {!p.isMe&&<button onClick={e=>{ e.stopPropagation(); toggleFavorite(p); }} style={{ background:p.favorite?T.accentSoft:"none",border:`1px solid ${p.favorite?T.accent:T.border}`,borderRadius:8,padding:"5px 8px",cursor:"pointer",fontSize:12,fontWeight:800,color:p.favorite?T.accent:T.sub,fontFamily:"Nunito,sans-serif",flexShrink:0 }}>{p.favorite?"â˜…":"â˜†"}</button>}
                {!p.isMe&&net!==0&&(
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:net>0?T.success:T.danger,fontSize:13,fontWeight:800 }}>{net>0?"+":""}{sym}{fmt(Math.abs(net))}</div>
                    <div style={{ color:net>0?T.success:T.danger,fontSize:10 }}>{net>0?"owes you":"you owe"}</div>
                  </div>
                )}
                <div style={{ color:T.sub,fontSize:12 }}>â†’</div>
              </div>
            );
          })}

          <div style={{ ...card,border:`1px dashed ${T.border}` }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:12 }}>âž• Add Person</div>
            <div style={{ display:"flex",gap:8,marginBottom:10 }}>
              {[["contact","🤝 Contact","They may owe you"],["dependant","â™¥ Dependant","Family, you cover them"]].map(([v,l,sub])=>(
                <button key={v} onClick={()=>setNewPersonType(v)} style={{ flex:1,background:newPersonType===v?T.accentSoft:"none",border:`1px solid ${newPersonType===v?T.accent:T.border}`,borderRadius:10,padding:"8px",cursor:"pointer",fontFamily:"Nunito,sans-serif",textAlign:"left" }}>
                  <div style={{ fontSize:12,fontWeight:700,color:newPersonType===v?T.accent:T.text }}>{l}</div>
                  <div style={{ fontSize:10,color:T.sub,marginTop:2 }}>{sub}</div>
                </button>
              ))}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10 }}>
              <input style={inp} placeholder="Name *" value={newName} onChange={e=>setNewName(e.target.value)}/>
              <select style={inp} value={newRelation} onChange={e=>setNewRelation(e.target.value)}>
                <option value="">Select Relation</option>
                <option value="Spouse">Spouse</option>
                <option value="Child">Child</option>
                <option value="Parent">Parent</option>
                <option value="Uncle">Uncle</option>
                <option value="Aunt">Aunt</option>
                <option value="Cousin">Cousin</option>
                <option value="Friend">Friend</option>
                <option value="Colleague">Colleague</option>
                <option value="Sibling">Sibling</option>
                <option value="Grandparent">Grandparent</option>
                <option value="Grandchild">Grandchild</option>
                <option value="In-law">In-law</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={{ display:"flex",gap:8,marginBottom:10 }}>
              {["ðŸ‘¤","ðŸ‘¨","ðŸ‘©","ðŸ‘¶","ðŸ‘´","ðŸ‘µ","ðŸ•"].map(em=><button key={em} onClick={()=>setNewEmoji(em)} style={{ background:newEmoji===em?T.accentSoft:"none",border:`1px solid ${newEmoji===em?T.accent:T.border}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:18 }}>{em}</button>)}
            </div>
            {newPersonType==="contact"&&(
              <div style={{ marginBottom:10 }}>
                <span style={lbl}>Credit limit (how much they can owe you)</span>
                <input style={inp} type="number" placeholder={`e.g. 5000 (0 = unlimited)`} value={newCreditLimit} onChange={e=>setNewCreditLimit(e.target.value)}/>
              </div>
            )}
            {newPersonType==="dependant"&&(
              <div style={{ marginBottom:10 }}>
                <span style={lbl}>Monthly spend awareness budget</span>
                <input style={inp} type="number" placeholder={`e.g. 3000 (0 = no limit)`} value={newSpendBudget} onChange={e=>setNewSpendBudget(e.target.value)}/>
              </div>
            )}
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
              {PALETTE.map(c=><div key={c} onClick={()=>setNewColor(c)} style={{ width:24,height:24,borderRadius:6,background:c,cursor:"pointer",border:newColor===c?"3px solid #fff":"3px solid transparent" }}/>)}
            </div>
            <button onClick={addPerson} style={btnP}>Add Person</button>
          </div>
        </>}

        {subView==="groups"&&<>
          {[...new Set(groups.map(g=>g.type||"Group"))].map(gtype=>{
            const grps=groups.filter(g=>(g.type||"Group")===gtype);
            if(!grps.length) return null;
            return (
              <div key={gtype} style={{ marginBottom:16 }}>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,marginBottom:10 }}>{gtype}</div>
                {grps.map(g=>{
                  const gTotalSpend = txns.filter(t=>t.groupId===g.id&&t.type==="expense").reduce((sum,t)=>sum+Number(t.amount||0),0) + bills.filter(b=>b.groupId===g.id&&b.status==="unpaid").reduce((sum,b)=>sum+Number(b.amount||0),0);
                  const gBudget = Number(g.manualLimit||0);
                  const gOver = gBudget>0 && gTotalSpend>gBudget;
                  return (
                    <div key={g.id} onClick={()=>{ setSelectedGroup(g); setEditingGroupName(g.name||""); setEditingGroupBudget(String(g.manualLimit||"")); setEditingGroupMembers([...(g.members||[])]); setIsEditingGroup(false); }} style={{ ...card,cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}>
                      <div style={{ width:42,height:42,borderRadius:12,background:g.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{g.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ color:T.text,fontSize:14,fontWeight:800 }}>{g.name}</div>
                        <div style={{ color:T.sub,fontSize:11,marginTop:1 }}>{(g.members?.length||0) + (g.includeMe===false?0:1)} members{g.includeMe===false?" · you not included":" · you included"}</div>
                        <div style={{ color:gOver?T.danger:T.sub,fontSize:10,marginTop:2 }}>{gBudget>0?`Budget ${sym}${fmt(gBudget)} · `:""}Spent {sym}{fmt(gTotalSpend)}{gOver?` · ⚠️ Over ${sym}${fmt(gTotalSpend-gBudget)}`:""}</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ color:g.color,fontSize:14,fontWeight:800 }}>{sym}{fmt(groupReceivableTotal(g.id))}</div>
                        <div style={{ color:T.sub,fontSize:10 }}>â†’</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div style={{ ...card,border:`1px dashed ${T.border}` }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:12 }}>âž• New Group</div>
            <input style={{ ...inp,marginBottom:10 }} placeholder="Group name *" value={newGroupName} onChange={e=>setNewGroupName(e.target.value)}/>
            <div style={{ marginBottom:10 }}>
              <span style={lbl}>Group type (e.g. Society, Trip, House)</span>
              <input style={{ ...inp,marginBottom:8 }} placeholder="Type or pick below..." value={newGroupType} onChange={e=>setNewGroupType(e.target.value)}/>
              <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                {["Society","Trip","House","Office","Family","Friends","Flat","Building"].map(t=>(
                  <button key={t} onClick={()=>setNewGroupType(t)} style={{ background:newGroupType===t?T.accentSoft:"none",border:`1px solid ${newGroupType===t?T.accent:T.border}`,borderRadius:20,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:newGroupType===t?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{t}</button>
                ))}
              </div>
            </div>
            <span style={lbl}>Members</span>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
              <button onClick={()=>setNewGroupIncludeMe(prev=>!prev)} style={{ background:newGroupIncludeMe?T.accentSoft:"none",border:`1px solid ${newGroupIncludeMe?T.accent:T.border}`,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:newGroupIncludeMe?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>ðŸ§‘ Me {newGroupIncludeMe?"âœ“":"+"}</button>
              {people.filter(p=>!p.isMe).map(p=>(
                <button key={p.id} onClick={()=>setNewGroupMembers(prev=>prev.includes(p.id)?prev.filter(id=>id!==p.id):[...prev,p.id])} style={{ background:newGroupMembers.includes(p.id)?p.color+"22":"none",border:`1px solid ${newGroupMembers.includes(p.id)?p.color:T.border}`,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:newGroupMembers.includes(p.id)?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>
              ))}
            </div>
            <div style={{ color:T.sub,fontSize:10,marginTop:-2,marginBottom:10 }}>Turn `Me` off for groups like neighbour-only houses; keep it on for family or home groups.</div>
            <div style={{ background:T.input,borderRadius:12,padding:"12px 14px",marginBottom:10 }}>
              <div>
                <span style={lbl}>Manual group spend limit (optional)</span>
                <input style={inp} type="number" placeholder="e.g. 5000" value={newGroupManualLimit} onChange={e=>setNewGroupManualLimit(e.target.value)}/>
              </div>
            </div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
              {PALETTE.map(c=><div key={c} onClick={()=>setNewGroupColor(c)} style={{ width:24,height:24,borderRadius:6,background:c,cursor:"pointer",border:newGroupColor===c?"3px solid #fff":"3px solid transparent" }}/>)}
            </div>
            <button onClick={addGroup} style={btnP}>Create Group</button>
          </div>
        </>}
      </div>
    );
  };

  // â”€â”€ INVESTMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const Investments = () => {
    const byType=INVEST_TYPES.map(it=>{
      const items = trackedInvestments.filter(i=>i.type===it.id);
      const folios = items.reduce((acc,inv)=>{
        const useFolioGrouping = it.id==="mf" && inv.folioNo;
        const key = useFolioGrouping ? `${it.id}|${inv.folioNo}` : `${it.id}|entry|${inv.id}`;
        if(!acc[key]) acc[key] = { id:key, type:it.id, folioNo:useFolioGrouping ? inv.folioNo : "", primaryName:inv.name||it.name, total:0, items:[] };
        acc[key].items.push(inv);
        acc[key].total += Number(inv.currentValue??inv.amount??0);
        return acc;
      },{});
      return {
        ...it,
        items,
        total:items.reduce((s,i)=>s+Number(i.currentValue??i.amount??0),0),
        folios:Object.values(folios).sort((a,b)=>b.total-a.total)
      };
    }).filter(it=>it.items.length>0);
    const grandTotal=trackedInvestments.reduce((s,i)=>s+Number(i.currentValue??i.amount??0),0);
    const pieData=byType.map(it=>({ name:it.name,value:it.total,color:it.color,icon:it.icon }));
    const folioCount = investmentFolioGroups.length;
    return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ color:T.text,fontSize:20,fontWeight:900 }}>ðŸ’¹ Investments</div>
          <button onClick={openInvestmentComposer} style={{ background:T.accent,border:"none",color:"#000",borderRadius:10,padding:"7px 16px",cursor:"pointer",fontSize:13,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>+ Add</button>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
          {[{label:"Total",value:`${sym}${fmt(grandTotal)}`,color:T.info,icon:"ðŸ’¹"},{label:"Monthly",value:`${sym}${fmt(monthlyInvestmentCommitment)}`,color:T.purple,icon:"ðŸ”"},{label:"Folios",value:folioCount,color:T.success,icon:"ðŸ—‚️"},{label:"This Month",value:`${sym}${fmt(totalInvested)}`,color:T.accent,icon:"ðŸ“…"}].map(s=>(
            <div key={s.label} style={{ ...card,marginBottom:0,padding:"12px" }}>
              <div style={{ fontSize:20,marginBottom:4 }}>{s.icon}</div>
              <div style={{ color:s.color,fontSize:16,fontWeight:800 }}>{s.value}</div>
              <div style={{ color:T.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ color:T.sub,fontSize:10,marginBottom:14 }}>
          Total = all tracked investments · Monthly = only items marked as monthly · Folios = grouped view by folio number · This Month = actual investment transactions in the selected month. Tap any folio to open it clearly.
        </div>
        {trackedInvestments.length===0?(
          <div style={{ ...card,textAlign:"center",padding:40 }}>
            <div style={{ fontSize:48,marginBottom:12 }}>ðŸ’¹</div>
            <div style={{ color:T.text,fontSize:16,fontWeight:800,marginBottom:8 }}>No investments yet</div>
            <button onClick={openInvestmentComposer} style={btnP}>+ Add Investment</button>
          </div>
        ):<>
          {pieData.length>0&&<div style={{ ...card,padding:"16px 14px" }}>
            <div style={{ color:T.text,fontSize:15,fontWeight:800,marginBottom:12 }}>Portfolio</div>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={68} dataKey="value" stroke="none">
                    {pieData.map((c,i)=><Cell key={i} fill={c.color} opacity={0.9}/>)}
                  </Pie>
                  <Tooltip content={({active,payload})=>active&&payload?.length?<div style={ttStyle}><b style={{color:payload[0].payload.color}}>{payload[0].payload.icon} {payload[0].name}</b><br/>{sym}{fmt(payload[0].value)}</div>:null}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex:1 }}>
                {pieData.map((c,i)=>(
                  <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                      <div style={{ width:8,height:8,borderRadius:"50%",background:c.color }}/>
                      <span style={{ color:T.sub,fontSize:11 }}>{c.name.split("/")[0]}</span>
                    </div>
                    <span style={{ color:T.text,fontSize:11,fontWeight:800 }}>{grandTotal?Math.round(c.value/grandTotal*100):0}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>}
          {byType.map(it=>(
            <div key={it.id} style={card}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                <div style={{ width:34,height:34,borderRadius:10,background:it.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>{it.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{it.name}</div>
                </div>
                <div style={{ color:it.color,fontSize:14,fontWeight:800 }}>{sym}{fmt(it.total)}</div>
              </div>
              {it.folios.map((folio,idx,arr)=>(
                <div key={folio.id} onClick={()=>setSelectedInvestmentDetail({...folio,typeMeta:it})} style={{ padding:"8px 0",borderBottom:idx<arr.length-1?`1px solid ${T.border}`:"none",cursor:"pointer" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",gap:10 }}>
                    <div style={{ minWidth:0,flex:1 }}>
                      <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{folio.folioNo?`Folio ${folio.folioNo}`:folio.primaryName}</div>
                      <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>
                        {it.id==="stocks"
                          ? `${folio.items.length} stock${folio.items.length===1?"":"s"}`
                          : (folio.folioNo
                            ? `Folio ${folio.folioNo} · ${folio.items.length} entr${folio.items.length===1?"y":"ies"}`
                            : (investmentFreqLabel(folio.items[0]?.freq) || "No frequency set"))}
                      </div>
                      {folio.items.slice(0,2).map(item=><div key={item.id} style={{ color:T.sub,fontSize:10,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.name} · {sym}{fmt(item.amount)}</div>)}
                      {folio.items.length>2&&<div style={{ color:T.sub,fontSize:10,marginTop:3 }}>+{folio.items.length-2} more</div>}
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ color:it.color,fontSize:12,fontWeight:800 }}>{sym}{fmt(folio.total)}</div>
                      <div style={{ color:T.sub,fontSize:10 }}>Tap to view</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>}
      </div>
    );
  };

  // â”€â”€ SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const LoanModal = ({ item, onClose }) => {
    const [direction,setDirection]=useState(item?.direction||"given");
    const [name,setName]=useState(item?.name||"");
    const [principal,setPrincipal]=useState(String(item?.principal ?? item?.amount ?? ""));
    const [outstanding,setOutstanding]=useState(String(item?.outstanding ?? item?.principal ?? item?.amount ?? ""));
    const [startDate,setStartDate]=useState(item?.startDate||todayStr());
    const [dueDate,setDueDate]=useState(item?.dueDate||"");
    const [hasInterest,setHasInterest]=useState(item?.hasInterest ?? (Number(item?.interestRate||0)>0));
    const [interestRate,setInterestRate]=useState(String(item?.interestRate||""));
    const [note,setNote]=useState(item?.note||"");

    const save=()=>{
      if(!name.trim()) return;
      const principalNum = Math.max(0, parseFloat(principal)||0);
      const outstandingNum = Math.max(0, parseFloat(outstanding)||0);
      const nextStatus = item?.status==="written_off"
        ? "written_off"
        : item?.status==="converted_to_expense"
          ? "converted_to_expense"
          : outstandingNum<=0
            ? "closed"
            : "active";
      const nextItem={
        id:item?.id||genId(),
        direction,
        name:name.trim(),
        principal:principalNum,
        outstanding:outstandingNum,
        startDate:startDate||todayStr(),
        dueDate,
        hasInterest,
        interestRate:hasInterest?Math.max(0,parseFloat(interestRate)||0):0,
        note:note.trim(),
        repayments:Array.isArray(item?.repayments)?item.repayments:[],
        status:nextStatus,
        closedDate:nextStatus==="closed"?(item?.closedDate||todayStr()):item?.closedDate||"",
        writtenOffDate:item?.writtenOffDate||"",
        convertedDate:item?.convertedDate||"",
      };
      setLoans(prev=>item?prev.map(x=>x.id===item.id?{...x,...nextItem}:x):[nextItem,...prev]);
      setEditingLoan(null);
      setShowAddLoan(false);
      onClose();
    };

    return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{item?"Edit Loan":"Add Loan"}</div>
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              <Chip color={T.accent} active={direction==="given"} onClick={()=>setDirection("given")}>🫴 Loan Given</Chip>
              <Chip color={T.danger} active={direction==="taken"} onClick={()=>setDirection("taken")}>🤲 Loan Taken</Chip>
            </div>
            <input style={inp} placeholder={direction==="given"?"Who did you lend to?":"Who did you borrow from?"} value={name} onChange={e=>setName(e.target.value)}/>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div>
                <span style={lbl}>Principal ({sym})</span>
                <input style={inp} type="number" value={principal} onChange={e=>setPrincipal(e.target.value)}/>
              </div>
              <div>
                <span style={lbl}>Outstanding ({sym})</span>
                <input style={inp} type="number" value={outstanding} onChange={e=>setOutstanding(e.target.value)}/>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div>
                <span style={lbl}>Start Date</span>
                <input style={inp} type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/>
              </div>
              <div>
                <span style={lbl}>Due Date</span>
                <input style={inp} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
              </div>
            </div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,background:T.input,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px" }}>
              <div>
                <div style={{ color:T.text,fontSize:12,fontWeight:800 }}>Interest</div>
                <div style={{ color:T.sub,fontSize:10 }}>{hasInterest?"Track rate for reference":"No-interest loan"}</div>
              </div>
              <button onClick={()=>setHasInterest(v=>!v)} style={{ background:hasInterest?T.accent:T.pill,border:`1px solid ${hasInterest?T.accent:T.border}`,borderRadius:18,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:800,color:hasInterest?"#000":T.sub,fontFamily:"Nunito,sans-serif" }}>{hasInterest?"Interest ON":"No Interest"}</button>
            </div>
            {hasInterest&&<div>
              <span style={lbl}>Interest Rate (% p.a.)</span>
              <input style={inp} type="number" value={interestRate} onChange={e=>setInterestRate(e.target.value)} placeholder="e.g. 12"/>
            </div>}
            <input style={inp} placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)}/>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={onClose} style={btnG}>Cancel</button>
              <button onClick={save} style={btnP}>Save Loan</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const LoanRepaymentModal = ({ item, onClose }) => {
    const [amount,setAmount]=useState(String(item?.outstanding||""));
    const [date,setDate]=useState(todayStr());
    const [note,setNote]=useState("");
    const label = item?.direction==="given" ? "Record money received" : "Record repayment made";

    const save=()=>{
      const outstandingNow = Number(item?.outstanding||0);
      const repaymentAmount = Math.min(outstandingNow, Math.max(0, parseFloat(amount)||0));
      if(!item || repaymentAmount<=0) return;
      setLoans(prev=>prev.map(loan=>{
        if(loan.id!==item.id) return loan;
        const nextOutstanding = Math.max(0, Number(loan.outstanding||0) - repaymentAmount);
        return {
          ...loan,
          outstanding:nextOutstanding,
          status:nextOutstanding<=0?"closed":"active",
          closedDate:nextOutstanding<=0?(date||todayStr()):loan.closedDate||"",
          repayments:[...(Array.isArray(loan.repayments)?loan.repayments:[]),{ id:genId(), date:date||todayStr(), amount:repaymentAmount, note:note.trim() }],
        };
      }));
      setRepaymentLoan(null);
      onClose();
    };

    return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:210,padding:20 }}>
        <div style={{ background:T.card,borderRadius:20,padding:22,width:"100%",maxWidth:360 }}>
          <div style={{ color:T.text,fontSize:16,fontWeight:900,marginBottom:8 }}>{label}</div>
          <div style={{ color:T.sub,fontSize:12,marginBottom:14 }}>{item?.name} · outstanding {sym}{fmt(item?.outstanding||0)}</div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div>
              <span style={lbl}>Amount ({sym})</span>
              <input style={inp} type="number" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus/>
            </div>
            <div>
              <span style={lbl}>Date</span>
              <input style={inp} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
            <input style={inp} placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)}/>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <button onClick={onClose} style={btnG}>Cancel</button>
              <button onClick={save} style={btnP}>Save Entry</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const LiabilityModal = ({ item, onClose }) => {
    const [name,setName]=useState(item?.name||"");
    const [type,setType]=useState(item?.type||LIABILITY_TYPES[0].id);
    const [outstanding,setOutstanding]=useState(String(item?.outstanding||""));
    const [nextDue,setNextDue]=useState(item?.nextDue||todayStr());
    const [note,setNote]=useState(item?.note||"");
    const save=()=>{
      if(!name.trim()) return;
      const nextItem={ id:item?.id||genId(), name:name.trim(), type, outstanding:parseFloat(outstanding)||0, nextDue, note:note.trim() };
      setLiabilities(prev=>item?prev.map(x=>x.id===item.id?nextItem:x):[nextItem,...prev]);
      setEditingLiability(null);
      setShowAddLiability(false);
      onClose();
    };
    return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{item?"Edit Liability":"Add Liability"}</div>
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <input style={inp} placeholder="Loan / liability name" value={name} onChange={e=>setName(e.target.value)}/>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {LIABILITY_TYPES.map(l=><Chip key={l.id} color={l.color} active={type===l.id} onClick={()=>setType(l.id)}>{l.icon} {l.name}</Chip>)}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div><span style={lbl}>Outstanding ({sym})</span><input style={inp} type="number" value={outstanding} onChange={e=>setOutstanding(e.target.value)}/></div>
              <div><span style={lbl}>Next Due</span><input style={inp} type="date" value={nextDue} onChange={e=>setNextDue(e.target.value)}/></div>
            </div>
            <input style={inp} placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)}/>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={onClose} style={btnG}>Cancel</button>
              <button onClick={save} style={btnP}>Save Liability</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AssetModal = ({ item, onClose }) => {
    const [name,setName]=useState(item?.name||"");
    const [type,setType]=useState(item?.type||ASSET_TYPES[0].id);
    const [currentValue,setCurrentValue]=useState(String(item?.currentValue||""));
    const [note,setNote]=useState(item?.note||"");
    const save=()=>{
      if(!name.trim()) return;
      const nextItem={ id:item?.id||genId(), name:name.trim(), type, currentValue:parseFloat(currentValue)||0, note:note.trim() };
      setTrackedAssets(prev=>item?prev.map(x=>x.id===item.id?nextItem:x):[nextItem,...prev]);
      setEditingAsset(null);
      setShowAddAsset(false);
      onClose();
    };
    return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{item?"Edit Asset":"Add Asset"}</div>
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <input style={inp} placeholder="Asset name" value={name} onChange={e=>setName(e.target.value)}/>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {ASSET_TYPES.map(a=><Chip key={a.id} color={a.color} active={type===a.id} onClick={()=>setType(a.id)}>{a.icon} {a.name}</Chip>)}
            </div>
            <div><span style={lbl}>Current Value ({sym})</span><input style={inp} type="number" value={currentValue} onChange={e=>setCurrentValue(e.target.value)}/></div>
            <input style={inp} placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)}/>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={onClose} style={btnG}>Cancel</button>
              <button onClick={save} style={btnP}>Save Asset</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const WealthPage = () => {
    const getLoanStatusMeta = loan => {
      if(loan.status==="written_off") return { label:"Written off", color:T.sub };
      if(loan.status==="converted_to_expense") return { label:"Converted to expense", color:T.warn };
      if(loan.status==="closed" || Number(loan.outstanding||0)<=0) return { label:"Closed", color:T.success };
      return { label:loan.direction==="taken"?"To repay":"To receive", color:loan.direction==="taken"?T.danger:T.accent };
    };

    const activeGivenLoans = loans.filter(loan=>loan.direction!=="taken" && loan.status==="active" && Number(loan.outstanding||0)>0);
    const activeTakenLoans = loans.filter(loan=>loan.direction==="taken" && loan.status==="active" && Number(loan.outstanding||0)>0);

    const inlineSections = {
      banks: accounts.filter(a=>a.type==="bank").map(a=>({
        id:a.id,
        title:a.name,
        meta:`Balance ${sym}${fmt(accountBalance(a.id))}`,
        value:`${sym}${fmt(accountBalance(a.id))}`,
        color:accountBalance(a.id)>=0?T.success:T.danger,
        onClick:()=>setShowAccDetail(a),
      })),
      cash: accounts.filter(a=>a.type==="cash").map(a=>({
        id:a.id,
        title:a.name,
        meta:`Cash in hand ${sym}${fmt(accountBalance(a.id))}`,
        value:`${sym}${fmt(accountBalance(a.id))}`,
        color:accountBalance(a.id)>=0?T.success:T.danger,
        onClick:()=>setShowAccDetail(a),
      })),
      upi: accounts.filter(a=>a.type==="upi").map(a=>({
        id:a.id,
        title:a.name,
        meta:`${a.handle||"UPI"} · ${sym}${fmt(accountBalance(a.id))}`,
        value:`${sym}${fmt(accountBalance(a.id))}`,
        color:accountBalance(a.id)>=0?T.success:T.danger,
        onClick:()=>setShowAccDetail(a),
      })),
      investments: INVEST_TYPES.map(type=>{
        const items = trackedInvestments.filter(inv=>inv.type===type.id);
        const total = items.reduce((sum,inv)=>sum + Number(inv.currentValue ?? inv.amount ?? 0),0);
        if(!items.length || total<=0) return null;
        return {
          id:type.id,
          title:type.name.split("/")[0].trim(),
          meta:`${items.length} ${items.length===1?"entry":"entries"}`,
          value:`${sym}${fmt(total)}`,
          color:type.color,
          onClick:()=>setShowInvestments(true),
        };
      }).filter(Boolean),
      owed: Object.entries(settlements).filter(([,val])=>Number(val?.owesMe||0)>0).map(([pid,val])=>({
        id:`person_${pid}`,
        title:getPerson(pid).name,
        meta:"Amount to receive",
        value:`${sym}${fmt(val.owesMe||0)}`,
        color:T.accent,
      })),
      loanGiven: activeGivenLoans.map(loan=>({
        id:loan.id,
        title:loan.name,
        meta:`${getLoanStatusMeta(loan).label}${loan.dueDate?` · due ${loan.dueDate}`:""}${loan.hasInterest&&Number(loan.interestRate||0)>0?` · ${loan.interestRate}% p.a.`:" · no interest"}`,
        value:`${sym}${fmt(loan.outstanding||0)}`,
        color:T.accent,
        onClick:()=>setEditingLoan(loan),
      })),
      trackedAssets: trackedAssets.map(asset=>({
        id:asset.id,
        title:asset.name,
        meta:(ASSET_TYPES.find(x=>x.id===asset.type)?.name)||"Asset",
        value:`${sym}${fmt(asset.currentValue||0)}`,
        color:T.purple,
      })),
      cc: accounts.filter(a=>a.type==="cc").map(a=>{
        const summary = getCardSummary(a);
        return {
          id:a.id,
          title:a.name,
          meta:`Due now ${sym}${fmt(summary.currentDue)} · Unbilled ${sym}${fmt(summary.currentCycleSpend)} · Outstanding ${sym}${fmt(summary.totalOutstanding||0)}`,
          value:`${sym}${fmt(summary.totalOutstanding||0)}`,
          color:T.danger,
          onClick:()=>setShowAccDetail(a),
        };
      }),
      loanTaken: activeTakenLoans.map(loan=>({
        id:loan.id,
        title:loan.name,
        meta:`${getLoanStatusMeta(loan).label}${loan.dueDate?` · due ${loan.dueDate}`:""}${loan.hasInterest&&Number(loan.interestRate||0)>0?` · ${loan.interestRate}% p.a.`:" · no interest"}`,
        value:`${sym}${fmt(loan.outstanding||0)}`,
        color:T.danger,
        onClick:()=>setEditingLoan(loan),
      }))
    };

    const renderInlineBreakdown = mode => {
      const items = inlineSections[mode] || [];
      return (
        <div style={{ padding:"0 0 8px 10px" }}>
          {items.length===0 ? (
            <div style={{ background:T.input,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",color:T.sub,fontSize:11 }}>Nothing to show here yet.</div>
          ) : items.map(item=>(
            <div key={item.id} onClick={item.onClick} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,background:T.input,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 10px",marginBottom:6,cursor:item.onClick?"pointer":"default" }}>
              <div style={{ minWidth:0,flex:1 }}>
                <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{item.title}</div>
                <div style={{ color:T.sub,fontSize:10,marginTop:2,whiteSpace:"normal" }}>{item.meta}</div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ color:item.color,fontSize:12,fontWeight:800 }}>{item.value}</div>
                {item.onClick&&<div style={{ color:T.sub,fontSize:12 }}>â€º</div>}
              </div>
            </div>
          ))}
        </div>
      );
    };

    const assetBreakdownItems = [
      { label:"Cash in bank", value:cashBankTotal, color:T.success, icon:"🏦", mode:"banks" },
      { label:"Cash at hand", value:cashWalletTotal, color:T.success, icon:"ðŸª™", mode:"cash" },
      { label:"UPI balance", value:upiTotal, color:T.success, icon:"ðŸ“±", mode:"upi" },
      { label:"Investments", value:investmentAssetsTotal, color:T.info, icon:"ðŸ“ˆ", mode:"investments" },
      { label:"People owe you", value:directOwedToMe, color:T.accent, icon:"🤝", mode:"owed" },
      { label:"Loans given", value:loanGivenTotal, color:T.accent, icon:"🫴", mode:"loanGiven" },
      { label:"Tracked assets", value:trackedAssetsTotal, color:T.purple, icon:"🏠", mode:"trackedAssets" },
    ];

    return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ ...card,background:`linear-gradient(135deg,${T.success}10,${T.card})` }}>
          <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>Net Worth</div>
          <div style={{ color:netWorthValue>=0?T.success:T.danger,fontSize:30,fontWeight:900,marginBottom:14 }}>{sym}{fmt(netWorthValue)}</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div style={{ background:T.input,borderRadius:12,padding:"12px 14px" }}>
              <div style={{ color:T.success,fontSize:18,fontWeight:800 }}>{sym}{fmt(totalAssetsValue)}</div>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Assets</div>
            </div>
            <div style={{ background:T.input,borderRadius:12,padding:"12px 14px" }}>
              <div style={{ color:T.danger,fontSize:18,fontWeight:800 }}>{sym}{fmt(totalLiabilitiesValue)}</div>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Liabilities</div>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ color:T.text,fontSize:15,fontWeight:800,marginBottom:12 }}>Assets Breakdown</div>
          {assetBreakdownItems.map((item,idx)=>{
            const isOpen = showWealthBreakdown===item.mode;
            return (
              <div key={item.label} style={{ borderBottom:idx===assetBreakdownItems.length-1?"none":`1px solid ${T.border}` }}>
                <div onClick={()=>setShowWealthBreakdown(isOpen?null:item.mode)} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",cursor:"pointer" }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{item.icon} {item.label}</div>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <div style={{ color:item.value>=0?item.color:T.danger,fontSize:13,fontWeight:800 }}>{sym}{fmt(item.value)}</div>
                    <div style={{ color:T.sub,fontSize:12 }}>{isOpen?"â–²":"â–¼"}</div>
                  </div>
                </div>
                {isOpen && renderInlineBreakdown(item.mode)}
              </div>
            );
          })}
        </div>

        <div style={card}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <div style={{ color:T.text,fontSize:15,fontWeight:800 }}>Tracked Assets</div>
            <button onClick={()=>setShowAddAsset(true)} style={{ background:T.info+"22",border:`1px solid ${T.info}33`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.info,fontFamily:"Nunito,sans-serif" }}>+ Add</button>
          </div>
          {trackedAssets.length===0?<div style={{ color:T.sub,fontSize:12 }}>Add real estate, vehicles, gold, valuables, or other assets you want included in net worth.</div>
            :trackedAssets.map((asset,idx)=>{
              const type=ASSET_TYPES.find(x=>x.id===asset.type)||ASSET_TYPES[ASSET_TYPES.length-1];
              return <div key={asset.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:idx===trackedAssets.length-1?"none":`1px solid ${T.border}` }}>
                <div style={{ width:36,height:36,borderRadius:10,background:type.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>{type.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{asset.name}</div>
                  <div style={{ color:T.sub,fontSize:10 }}>{type.name}{asset.note?` · ${asset.note}`:""}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ color:type.color,fontSize:13,fontWeight:800 }}>{sym}{fmt(asset.currentValue)}</div>
                  <div style={{ display:"flex",gap:4,justifyContent:"flex-end",marginTop:2 }}>
                    <button onClick={()=>setEditingAsset(asset)} style={{ background:"none",border:"none",color:T.info,cursor:"pointer",fontSize:11,fontFamily:"Nunito,sans-serif" }}>Edit</button>
                    <button onClick={()=>setTrackedAssets(prev=>prev.filter(x=>x.id!==asset.id))} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:11,fontFamily:"Nunito,sans-serif" }}>Delete</button>
                  </div>
                </div>
              </div>;
            })}
        </div>

        <div style={card}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <div style={{ color:T.text,fontSize:15,fontWeight:800 }}>Loans</div>
            <button onClick={()=>setShowAddLoan(true)} style={{ background:T.accent+"22",border:`1px solid ${T.accent}33`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>+ Add</button>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12 }}>
            <div style={{ background:T.input,borderRadius:12,padding:"10px 12px" }}>
              <div style={{ color:T.accent,fontSize:16,fontWeight:800 }}>{sym}{fmt(loanGivenTotal)}</div>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Loans given</div>
            </div>
            <div style={{ background:T.input,borderRadius:12,padding:"10px 12px" }}>
              <div style={{ color:T.danger,fontSize:16,fontWeight:800 }}>{sym}{fmt(loanTakenTotal)}</div>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Loans taken</div>
            </div>
          </div>
          {loans.length===0 ? <div style={{ color:T.sub,fontSize:12 }}>Track loans you gave or took, mark them no-interest, record repayments, then close, write off, or convert them later.</div>
            : loans.map((loan,idx)=>{
              const statusMeta = getLoanStatusMeta(loan);
              const progressAmount = Math.max(
                Number(loan.principal||0) - Number(loan.outstanding||0),
                (Array.isArray(loan.repayments)?loan.repayments:[]).reduce((sum,row)=>sum+Number(row.amount||0),0)
              );
              const lastRepayment = Array.isArray(loan.repayments)&&loan.repayments.length ? loan.repayments[loan.repayments.length-1] : null;
              const isActive = loan.status==="active" && Number(loan.outstanding||0)>0;
              return <div key={loan.id} style={{ display:"flex",alignItems:"flex-start",gap:12,padding:"10px 0",borderBottom:idx===loans.length-1?"none":`1px solid ${T.border}` }}>
                <div style={{ width:36,height:36,borderRadius:10,background:(loan.direction==="taken"?T.danger:T.accent)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>{loan.direction==="taken"?"🤲":"🫴"}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{loan.name}</div>
                  <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>
                    {loan.direction==="taken"?"You borrowed":"You lent"} {sym}{fmt(loan.principal||0)}
                    {loan.startDate?` · ${formatShortDate(loan.startDate)||loan.startDate}`:""}
                    {loan.dueDate?` · due ${formatShortDate(loan.dueDate)||loan.dueDate}`:""}
                  </div>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:6 }}>
                    <span style={{ background:statusMeta.color+"22",border:`1px solid ${statusMeta.color}33`,borderRadius:999,padding:"2px 8px",fontSize:10,fontWeight:800,color:statusMeta.color }}>{statusMeta.label}</span>
                    <span style={{ background:T.info+"16",border:`1px solid ${T.info}33`,borderRadius:999,padding:"2px 8px",fontSize:10,fontWeight:800,color:T.info }}>{loan.hasInterest&&Number(loan.interestRate||0)>0?`${fmt(loan.interestRate)}% interest`:"No interest"}</span>
                    {progressAmount>0&&<span style={{ background:T.success+"16",border:`1px solid ${T.success}33`,borderRadius:999,padding:"2px 8px",fontSize:10,fontWeight:800,color:T.success }}>Settled {sym}{fmt(progressAmount)}</span>}
                  </div>
                  {loan.note&&<div style={{ color:T.sub,fontSize:10,marginTop:6 }}>{loan.note}</div>}
                  {lastRepayment&&<div style={{ color:T.sub,fontSize:10,marginTop:6 }}>Last entry {formatShortDate(lastRepayment.date)||lastRepayment.date} · {sym}{fmt(lastRepayment.amount)}</div>}
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:8 }}>
                    {isActive&&<button onClick={()=>setRepaymentLoan(loan)} style={{ background:T.success+"18",border:`1px solid ${T.success}33`,borderRadius:16,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:800,color:T.success,fontFamily:"Nunito,sans-serif" }}>{loan.direction==="taken"?"Repay":"Record receipt"}</button>}
                    <button onClick={()=>setEditingLoan(loan)} style={{ background:T.info+"18",border:`1px solid ${T.info}33`,borderRadius:16,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:800,color:T.info,fontFamily:"Nunito,sans-serif" }}>Edit</button>
                    {isActive&&loan.direction!=="taken"&&<button onClick={()=>{ if(window.confirm(`Convert ${loan.name} to expense?`)){ setLoans(prev=>prev.map(x=>x.id===loan.id?{ ...x, status:"converted_to_expense", outstanding:0, convertedDate:todayStr(), closedDate:todayStr() }:x)); } }} style={{ background:T.warn+"16",border:`1px solid ${T.warn}33`,borderRadius:16,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:800,color:T.warn,fontFamily:"Nunito,sans-serif" }}>Convert</button>}
                    {isActive&&<button onClick={()=>{ if(window.confirm(`Mark ${loan.name} as written off?`)){ setLoans(prev=>prev.map(x=>x.id===loan.id?{ ...x, status:"written_off", outstanding:0, writtenOffDate:todayStr(), closedDate:todayStr() }:x)); } }} style={{ background:T.danger+"16",border:`1px solid ${T.danger}33`,borderRadius:16,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:800,color:T.danger,fontFamily:"Nunito,sans-serif" }}>Write off</button>}
                    <button onClick={()=>setLoans(prev=>prev.filter(x=>x.id!==loan.id))} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:16,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:800,color:T.sub,fontFamily:"Nunito,sans-serif" }}>Delete</button>
                  </div>
                </div>
                <div style={{ textAlign:"right",minWidth:86 }}>
                  <div style={{ color:statusMeta.color,fontSize:13,fontWeight:800 }}>{sym}{fmt(loan.outstanding||0)}</div>
                  <div style={{ color:T.sub,fontSize:10 }}>Outstanding</div>
                </div>
              </div>;
            })}
        </div>

        <div style={card}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <div style={{ color:T.text,fontSize:15,fontWeight:800 }}>Manage Liabilities</div>
            <button onClick={()=>setShowAddLiability(true)} style={{ background:T.danger+"22",border:`1px solid ${T.danger}33`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.danger,fontFamily:"Nunito,sans-serif" }}>+ Add</button>
          </div>
          <div style={{ borderBottom:`1px solid ${T.border}` }}>
            <div onClick={()=>setShowWealthBreakdown(showWealthBreakdown==="cc"?null:"cc")} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",cursor:"pointer" }}>
              <div>
                <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>ðŸ’³ Credit Card Debt</div>
                <div style={{ color:T.sub,fontSize:10 }}>{accounts.filter(a=>a.type==="cc").length} card(s)</div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ color:T.danger,fontSize:13,fontWeight:800 }}>{sym}{fmt(creditCardLiabilityTotal)}</div>
                <div style={{ color:T.sub,fontSize:12 }}>{showWealthBreakdown==="cc"?"â–²":"â–¼"}</div>
              </div>
            </div>
            {showWealthBreakdown==="cc" && renderInlineBreakdown("cc")}
          </div>
          <div style={{ borderBottom:liabilities.length===0?"none":`1px solid ${T.border}` }}>
            <div onClick={()=>setShowWealthBreakdown(showWealthBreakdown==="loanTaken"?null:"loanTaken")} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",cursor:"pointer" }}>
              <div>
                <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>🤲 Loans Taken</div>
                <div style={{ color:T.sub,fontSize:10 }}>{activeLoans.filter(loan=>loan.direction==="taken").length} active loan(s)</div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ color:T.danger,fontSize:13,fontWeight:800 }}>{sym}{fmt(loanTakenTotal)}</div>
                <div style={{ color:T.sub,fontSize:12 }}>{showWealthBreakdown==="loanTaken"?"â–²":"â–¼"}</div>
              </div>
            </div>
            {showWealthBreakdown==="loanTaken" && renderInlineBreakdown("loanTaken")}
          </div>
          {liabilities.length===0?<div style={{ color:T.sub,fontSize:12,paddingTop:10 }}>Add mortgages, student loans, car loans, tax dues, or any other debt here.</div>
            :liabilities.map((liability,idx)=>{
              const type=LIABILITY_TYPES.find(x=>x.id===liability.type)||LIABILITY_TYPES[LIABILITY_TYPES.length-1];
              return <div key={liability.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:idx===liabilities.length-1?"none":`1px solid ${T.border}` }}>
                <div style={{ width:36,height:36,borderRadius:10,background:type.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>{type.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{liability.name}</div>
                  <div style={{ color:T.sub,fontSize:10 }}>{type.name}{liability.nextDue?` · due ${liability.nextDue}`:""}{liability.note?` · ${liability.note}`:""}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ color:T.danger,fontSize:13,fontWeight:800 }}>{sym}{fmt(liability.outstanding)}</div>
                  <div style={{ display:"flex",gap:4,justifyContent:"flex-end",marginTop:2 }}>
                    <button onClick={()=>setEditingLiability(liability)} style={{ background:"none",border:"none",color:T.info,cursor:"pointer",fontSize:11,fontFamily:"Nunito,sans-serif" }}>Edit</button>
                    <button onClick={()=>setLiabilities(prev=>prev.filter(x=>x.id!==liability.id))} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:11,fontFamily:"Nunito,sans-serif" }}>Delete</button>
                  </div>
                </div>
              </div>;
            })}
        </div>
      </div>
    );
  };

  const WealthBreakdownModal = () => {
    if(!showWealthBreakdown) return null;

    const close = () => setShowWealthBreakdown(null);
    const openAccount = acc => {
      close();
      setShowAccDetail(acc);
    };

    const sections = {
      banks: {
        title:"🏦 Cash in bank",
        subtitle:"Bank-wise breakup",
        items: accounts.filter(a=>a.type==="bank").map(a=>({
          id:a.id,
          title:a.name,
          meta:`Balance ${sym}${fmt(accountBalance(a.id))}`,
          value:`${sym}${fmt(accountBalance(a.id))}`,
          color:accountBalance(a.id)>=0?T.success:T.danger,
          onClick:()=>openAccount(a),
        }))
      },
      cash: {
        title:"ðŸª™ Cash at hand",
        subtitle:"Cash wallet breakup",
        items: accounts.filter(a=>a.type==="cash").map(a=>({
          id:a.id,
          title:a.name,
          meta:`Cash in hand ${sym}${fmt(accountBalance(a.id))}`,
          value:`${sym}${fmt(accountBalance(a.id))}`,
          color:accountBalance(a.id)>=0?T.success:T.danger,
          onClick:()=>openAccount(a),
        }))
      },
      upi: {
        title:"ðŸ“± UPI balance",
        subtitle:"App-wise breakup",
        items: accounts.filter(a=>a.type==="upi").map(a=>({
          id:a.id,
          title:a.name,
          meta:`${a.handle||"UPI"} · ${sym}${fmt(accountBalance(a.id))}`,
          value:`${sym}${fmt(accountBalance(a.id))}`,
          color:accountBalance(a.id)>=0?T.success:T.danger,
          onClick:()=>openAccount(a),
        }))
      },
      investments: {
        title:"ðŸ“ˆ Investments",
        subtitle:"Folio-wise breakup",
        items: investmentFolioGroups.map(group=>({
          id:group.id,
          title:group.folioNo?`Folio ${group.folioNo}`:group.primaryName,
          meta:`${group.items.length} entr${group.items.length===1?"y":"ies"}`,
          value:`${sym}${fmt(group.total)}`,
          color:T.info,
          onClick:()=>{ close(); setSelectedInvestmentDetail(group); }
        }))
      },
      owed: {
        title:"🤝 People owe you",
        subtitle:"Receivables by person",
        items: Object.entries(settlements).filter(([,val])=>Number(val?.owesMe||0)>0).map(([pid,val])=>({
          id:`person_${pid}`,
          title:getPerson(pid).name,
          meta:"Amount to receive",
          value:`${sym}${fmt(val.owesMe||0)}`,
          color:T.accent,
        }))
      },
      trackedAssets: {
        title:"🏠 Tracked assets",
        subtitle:"Asset-wise breakup",
        items: trackedAssets.map(asset=>({
          id:asset.id,
          title:asset.name,
          meta:(ASSET_TYPES.find(x=>x.id===asset.type)?.name)||"Asset",
          value:`${sym}${fmt(asset.currentValue||0)}`,
          color:T.purple,
        }))
      },
      cc: {
        title:"ðŸ’³ Credit card breakup",
        subtitle:"Current due vs total outstanding",
        items: accounts.filter(a=>a.type==="cc").map(a=>{
          const summary = getCardSummary(a);
          return {
            id:a.id,
            title:a.name,
            meta:`Due now ${sym}${fmt(summary.currentDue)} · Unbilled ${sym}${fmt(summary.currentCycleSpend)} · Outstanding ${sym}${fmt(a.outstanding||0)}`,
            value:`${sym}${fmt(a.outstanding||0)}`,
            color:T.danger,
            onClick:()=>openAccount(a),
          };
        })
      }
    };

    const section = sections[showWealthBreakdown] || { title:"Breakdown", subtitle:"", items:[] };

    return (
      <div onClick={e=>e.target===e.currentTarget&&close()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"stretch",justifyContent:"center",zIndex:230 }}>
        <div style={{ background:T.card,borderRadius:0,padding:"22px 18px 40px",width:"100%",maxWidth:"100vw",height:"100vh",maxHeight:"100vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{section.title}</div>
            <button onClick={close} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ color:T.sub,fontSize:11,marginBottom:14 }}>{section.subtitle}{section.items.some(item=>item.onClick)?" · Tap a row to open details":""}</div>

          {section.items.length===0 ? (
            <div style={{ ...card,textAlign:"center",marginBottom:0 }}>
              <div style={{ color:T.sub,fontSize:12 }}>Nothing to show here yet.</div>
            </div>
          ) : (
            <div style={{ ...card,marginBottom:0 }}>
              {section.items.map((item,idx)=>(
                <div key={item.id} onClick={item.onClick} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 0",borderBottom:idx<section.items.length-1?`1px solid ${T.border}`:"none",cursor:item.onClick?"pointer":"default" }}>
                  <div style={{ minWidth:0,flex:1 }}>
                    <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{item.title}</div>
                    <div style={{ color:T.sub,fontSize:10,marginTop:2,whiteSpace:"normal" }}>{item.meta}</div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <div style={{ color:item.color,fontSize:12,fontWeight:800,textAlign:"right" }}>{item.value}</div>
                    {item.onClick&&<div style={{ color:T.sub,fontSize:14 }}>â€º</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const Settings = () => {
    const [addSubTo,setAddSubTo]=useState(null);
    const [subInput,setSubInput]=useState("");
    const [newCatName,setNewCatName]=useState("");
    const [newCatIcon,setNewCatIcon]=useState("🍽️");
    const [newCatColor,setNewCatColor]=useState(PALETTE[0]);
    const [newCatBudget,setNewCatBudget]=useState("");
    const [showIconPk,setShowIconPk]=useState(false);
    const [iconSearch,setIconSearch]=useState("");
    const [newIncomeTypeInput,setNewIncomeTypeInput]=useState("");

    const filteredIcons=iconSearch?CAT_ICONS.filter(ic=>ic.includes(iconSearch)):CAT_ICONS;
    const parseIncomeTypeNames = value => Array.from(new Set(
      String(value ?? "")
        .split(/[\n,]+/)
        .map(item=>normalizeIncomeTypeValue(item))
        .filter(Boolean)
    ));
    const addIncomeTypes = () => {
      const names = parseIncomeTypeNames(newIncomeTypeInput);
      if(!names.length) return;
      setIncomeTypes(prev=>normalizeIncomeTypes([...prev, ...names]));
      setNewIncomeTypeInput("");
    };
    const parseSubcategoryNames = value => Array.from(new Set(
      String(value ?? "")
        .split(/[\n,]+/)
        .map(item=>item.trim())
        .filter(Boolean)
    ));
    const addSubcategories = categoryId => {
      const names = parseSubcategoryNames(subInput);
      if(!names.length) return;
      setCats(prev=>prev.map(cat=>{
        if(cat.id!==categoryId) return cat;
        const existing = new Set((cat.subs||[]).map(item=>String(item.name||"").trim().toLowerCase()));
        const additions = names
          .filter(name=>!existing.has(name.toLowerCase()))
          .map(name=>({ id:genId(), name }));
        return additions.length ? { ...cat, subs:[...(cat.subs||[]), ...additions] } : cat;
      }));
      setSubInput("");
      setAddSubTo(null);
    };

    const Row=({ icon,title,subtitle,onClick,right })=>(
      <div onClick={onClick} style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:`1px solid ${T.border}`,cursor:onClick?"pointer":"default" }}>
        <div style={{ width:36,height:36,borderRadius:10,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{icon}</div>
        <div style={{ flex:1 }}>
          <div style={{ color:T.text,fontSize:14,fontWeight:600 }}>{title}</div>
          {subtitle&&<div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{subtitle}</div>}
        </div>
        {right||(onClick&&<div style={{ color:T.sub,fontSize:16 }}>â€º</div>)}
      </div>
    );

    const Toggle=({ val,fn })=>(
      <div onClick={fn} style={{ width:44,height:24,borderRadius:12,background:val?T.accent:T.border,position:"relative",cursor:"pointer",flexShrink:0,transition:"background 0.2s" }}>
        <div style={{ position:"absolute",top:2,left:val?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s" }}/>
      </div>
    );

    if(settingsSection==="income_types") return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>â†</button>
          <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>Income Types</div>
        </div>
        <div style={{ ...card,marginBottom:12 }}>
          <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:10 }}>Income types</div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {incomeTypeOptions.map(type=>{
              const count = txns.filter(txn=>txn.type==="income" && normalizeIncomeTypeValue(txn.incomeType||"salary")===type).length;
              const isDefault = DEFAULT_INCOME_TYPES.includes(type);
              return (
                <span key={type} style={{ background:T.success+"18",color:T.success,borderRadius:20,padding:"5px 10px",fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:6 }}>
                  {formatIncomeTypeLabel(type)}
                  <span style={{ color:T.sub,fontSize:10 }}>({count})</span>
                  {isDefault ? (
                    <span style={{ color:T.sub,fontSize:10 }}>default</span>
                  ) : (
                    <button onClick={()=>setIncomeTypes(prev=>prev.filter(item=>item!==type))} style={{ background:"none",border:"none",cursor:"pointer",color:T.sub,fontSize:10,padding:0 }}>âœ•</button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ ...card,border:`1px dashed ${T.border}`,marginBottom:12 }}>
          <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:10 }}>âž• Add income type</div>
          <input style={{ ...inp,marginBottom:8 }} placeholder="e.g. Bonus, Side Hustle, Consulting" value={newIncomeTypeInput} onChange={e=>setNewIncomeTypeInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addIncomeTypes(); } }}/>
          <div style={{ color:T.sub,fontSize:10,marginBottom:10 }}>Tip: separate multiple income types with commas.</div>
          <button onClick={addIncomeTypes} style={btnP}>Add Income Type</button>
        </div>
      </div>
    );

    if(settingsSection==="liabilities") return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>â†</button>
          <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>Liability Types</div>
        </div>
        <div style={{ ...card,marginBottom:12 }}>
          <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:10 }}>Available liability types</div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {LIABILITY_TYPES.map(type=>(
              <span key={type.id} style={{ background:type.color+"18",color:type.color,borderRadius:20,padding:"5px 10px",fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:6 }}>
                <span>{type.icon}</span>
                <span>{type.name}</span>
              </span>
            ))}
          </div>
          <div style={{ color:T.sub,fontSize:10,marginTop:10 }}>Manage individual liabilities from the `Wealth` tab.</div>
        </div>
      </div>
    );

    if(settingsSection==="investments") return (
      <div style={{ padding:"14px 0 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"0 16px 16px" }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>â†</button>
          <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>Investments</div>
          <button onClick={openInvestmentComposer} style={{ background:T.accent,border:"none",color:"#000",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>+ Add</button>
        </div>
        <div style={{ padding:"0 16px" }}>
          {trackedInvestments.length===0 ? <div style={{ color:T.sub,fontSize:12,paddingTop:10 }}>No investments yet.</div> : trackedInvestments.map((inv)=>{
            const type=INVEST_TYPES.find(x=>x.id===inv.type)||INVEST_TYPES[0];
            return <div key={inv.id} style={{ ...card,display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ width:36,height:36,borderRadius:10,background:type.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>{type.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{inv.name}</div>
                <div style={{ color:T.sub,fontSize:10 }}>{type.name} · {investmentFreqLabel(inv.freq) || "No frequency set"}{inv.reminder?` · reminder: ${inv.reminder}`:""}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:T.info,fontSize:13,fontWeight:800 }}>{sym}{fmt(inv.amount)}</div>
                <div style={{ display:"flex",gap:4,justifyContent:"flex-end",marginTop:2,flexWrap:"wrap" }}>
                  <button onClick={()=>openInvestmentEditor(inv)} style={{ background:"none",border:"none",color:T.info,cursor:"pointer",fontSize:11,fontFamily:"Nunito,sans-serif" }}>Edit</button>
                  <button onClick={()=>removeInvestmentEntry(inv)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:11,fontFamily:"Nunito,sans-serif" }}>{getInvestmentTxn(inv)?"Delete":"Remove"}</button>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>
    );

    if(settingsSection==="accounts") return (
      <div style={{ padding:"14px 0 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"0 16px 16px" }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>â†</button>
          <div style={{ color:T.text,fontSize:18,fontWeight:900,flex:1 }}>Accounts</div>
          <button onClick={()=>setShowAddAccount(true)} style={{ background:T.accent,border:"none",color:"#000",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>+ Add</button>
        </div>
        <div style={{ padding:"0 16px" }}>
          {["bank","cc","debit","upi","cash"].map(type=>{
            const accs=accounts.filter(a=>a.type===type);
            if(!accs.length) return null;
            return (
              <div key={type} style={{ marginBottom:16 }}>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,marginBottom:8 }}>{accLabel(type)}s</div>
                {accs.map(a=>{
                  const bal=a.type==="cc"?null:accountBalance(a.id);
                  const linkedB=a.type==="debit"?accounts.find(b=>b.id===a.linkedBank):null;
                  const ccSummary = a.type==="cc" ? getCardSummary(a) : null;
                  return (
                    <div key={a.id} style={{ ...card,cursor:"pointer" }} onClick={()=>setShowAccDetail(a)}>
                      <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                        <div style={{ width:38,height:38,borderRadius:11,background:a.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>{accIcon(a.type)}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{a.name}{a.last4?` ···${a.last4}`:""}</div>
                          <div style={{ color:T.sub,fontSize:11,marginTop:1 }}>
                            {a.type==="bank"&&<>
                              <div>Balance: {sym}{fmt(bal)}</div>
                              {balanceCheckpoints[a.id]?.date&&(()=>{
                                const expectedAtDate = accountBalance(a.id, balanceCheckpoints[a.id].date);
                                const gap = Number(balanceCheckpoints[a.id].amount||0) - Number(expectedAtDate||0);
                                return <div style={{ color:Math.abs(gap)<0.01?T.success:T.warn,fontSize:10,marginTop:2 }}>Actual {formatShortDate(balanceCheckpoints[a.id].date)} · {Math.abs(gap)<0.01?"Matched":`Gap ${gap>=0?"+":"âˆ’"}${sym}${fmt(Math.abs(gap))}`}</div>;
                              })()}
                            </>}
                            {a.type==="cc"&&`${sym}${fmt(ccSummary?.currentDue||0)} due now · ${sym}${fmt(ccSummary?.totalOutstanding||0)} total`}
                            {a.type==="debit"&&`Linked: ${linkedB?.name||"?"}`}
                            {a.type==="upi"&&`${a.handle||"UPI"} · ${sym}${fmt(bal)}`}
                            {a.type==="cash"&&`Cash in hand: ${sym}${fmt(bal)}`}
                          </div>
                        </div>
                        <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                          {a.type==="bank"&&<button onClick={e=>{
                            e.stopPropagation();
                            const checkpoint = balanceCheckpoints[a.id];
                            setEditingCheckpoint(a.id);
                            setEditingOpeningBalanceVal(String(Number(a.openingBalance||0)));
                            setEditingOpeningBalanceDate(a.openingBalanceDate || todayStr());
                            setEditingCheckpointVal(checkpoint?.amount!=null ? String(checkpoint.amount) : String(Number(accountBalance(a.id)||0)));
                            setEditingCheckpointDate(checkpoint?.date || todayStr());
                          }} style={{ background:T.info+"22",border:`1px solid ${T.info}33`,borderRadius:8,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.info,fontFamily:"Nunito,sans-serif" }}>ðŸ“ Balance</button>}
                          <button onClick={e=>{e.stopPropagation();setEditingAccount(a);}} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>✏️ Edit</button>
                          <button onClick={e=>{e.stopPropagation();setConfirmDeleteAccount(a.id);}} style={{ background:"none",border:"none",color:T.danger,fontSize:14,cursor:"pointer" }}>ðŸ—‘</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );

    if(settingsSection==="budget") return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>â†</button>
          <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>🎯 Budget</div>
        </div>
        <div style={card}>
          <div style={{ color:T.text,fontSize:14,fontWeight:700,marginBottom:8 }}>Annual Budget (FY {new Date().getMonth()>=3?new Date().getFullYear():new Date().getFullYear()-1}â€“{new Date().getMonth()>=3?new Date().getFullYear()+1:new Date().getFullYear()})</div>
          <input style={{ ...inp,marginBottom:8 }} type="text" inputMode="decimal" placeholder={`e.g. ${sym}6,00,000`} value={annualBudget?fmt(annualBudget):""} onChange={e=>setAnnualBudget(parseMoney(e.target.value))}/>
          <div style={{ color:T.sub,fontSize:11 }}>Monthly: {sym}{fmt(Math.round(annualBudget/12))} · Tap any month to view it</div>
        </div>
        <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:10 }}>Month by Month</div>
        {(()=>{
          const fy=new Date().getMonth()>=3?new Date().getFullYear():new Date().getFullYear()-1;
          const months=Array.from({length:12},(_,i)=>{ const d=new Date(fy,3+i,1); return { key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, label:d.toLocaleString("en-IN",{month:"long",year:"2-digit"}) }; });
          const monthly=Math.round(annualBudget/12);
          return months.map(m=>{
            const mSpend=txns.filter(t=>t.type==="expense"&&t.date?.startsWith(m.key)).reduce((sum,expense)=>sum+getNetExpenseAmount(expense),0);
            const mBudget=monthOverrides[m.key]||monthly;
            const diff=mBudget-mSpend;
            const isOver=diff<0;
            const isCurrent=m.key===viewMonth;
            const pct=mSpend?Math.min(100,Math.round(mSpend/mBudget*100)):0;
            return (
              <div key={m.key} onClick={()=>{ setViewMonth(m.key); setShowSettings(false); }} style={{ ...card,cursor:"pointer",marginBottom:8,border:`1px solid ${isCurrent?T.accent:T.border}`,background:isCurrent?T.accentSoft:T.card }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                  <div style={{ color:isCurrent?T.accent:T.text,fontSize:13,fontWeight:isCurrent?800:600,flex:1 }}>{m.label}</div>
                  <div style={{ color:T.sub,fontSize:12 }}>{sym}{fmt(mSpend)}</div>
                  <div style={{ fontSize:12,fontWeight:700,color:isOver?T.danger:T.success }}>{isOver?"âˆ’":"+"}{sym}{fmt(Math.abs(diff))}</div>
                </div>
                <div style={{ height:5,background:T.border,borderRadius:3,marginBottom:4 }}>
                  <div style={{ height:"100%",width:`${pct}%`,background:isOver?T.danger:pct>70?T.warn:T.success,borderRadius:3 }}/>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between" }}>
                  <span style={{ color:T.sub,fontSize:10 }}>Budget: {sym}{fmt(mBudget)}</span>
                  <button onClick={e=>{ e.stopPropagation(); setEditingMonthBudget(m.key); setEditingMonthVal(fmt(mBudget)); }} style={{ background:"none",border:"none",color:T.info,fontSize:10,cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>Edit</button>
                </div>
              </div>
            );
          });
        })()}
      </div>
    );

    if(settingsSection==="categories") return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>â†</button>
          <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>Categories</div>
        </div>
        {cats.map(cat=>{
          const spent=expenses.filter(e=>e.catId===cat.id).reduce((sum,expense)=>sum+getNetExpenseAmount(expense),0);
          const pct=cat.budget?Math.min(100,Math.round(spent/cat.budget*100)):0;
          return (
            <div key={cat.id} style={card}>
              <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:8 }}>
                <div style={{ width:36,height:36,borderRadius:10,background:cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>{cat.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{cat.name} {cat.fixed?"ðŸ”’":"ðŸ”“"}</div>
                  <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
                    <span style={{ color:T.sub,fontSize:11 }}>{cat.subs?.length||0} subs</span>
                    <button onClick={()=>{ const el=document.getElementById("catbudget_"+cat.id); if(el) el.style.display=el.style.display==="none"?"flex":"none"; }} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:10,color:T.accent,fontFamily:"Nunito,sans-serif" }}>â‚¹ {cat.budget>0?fmt(cat.budget):"Set budget"}</button>
                    <button onClick={()=>setCats(p=>p.map(c=>c.id===cat.id?{...c,fixed:!c.fixed}:c))} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:10,color:T.sub,fontFamily:"Nunito,sans-serif" }}>{cat.fixed?"Fixed":"Flexible"}</button>
                  </div>
                  {cat.budget>0 && spent>cat.budget && <div style={{ color:T.danger,fontSize:11,fontWeight:700,marginTop:4 }}>⚠️ Over budget by {sym}{fmt(spent-cat.budget)}</div>}
                  <div id={"catbudget_"+cat.id} style={{ display:"none",gap:6,marginTop:4,alignItems:"center" }}>
                    <input type="number" defaultValue={cat.budget||0} onBlur={e=>setCats(p=>p.map(c=>c.id===cat.id?{...c,budget:parseFloat(e.target.value)||0}:c))} style={{ ...inpSm,width:110 }} placeholder="Monthly budget"/>
                    <span style={{ color:T.sub,fontSize:11 }}>/ month</span>
                  </div>
                </div>
                <div style={{ textAlign:"right",marginRight:8 }}>
                  <div style={{ color:cat.color,fontSize:13,fontWeight:800 }}>{sym}{fmt(spent)}</div>
                </div>
                <button onClick={()=>setConfirmDeleteCat(cat.id)} style={{ background:"none",border:`1px solid ${T.border}`,color:T.danger,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>Del</button>
              </div>
              {cat.budget>0&&<div style={{ height:3,background:T.border,borderRadius:2,marginBottom:8 }}>
                <div style={{ height:"100%",width:`${pct}%`,background:pct>90?T.danger:cat.color,borderRadius:2 }}/>
              </div>}
              <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:8 }}>
                {cat.subs?.map(s=>(
                  <span key={s.id} style={{ background:cat.color+"18",color:cat.color,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4 }}>
                    {s.name}
                    <button onClick={()=>setCats(p=>p.map(c=>c.id===cat.id?{...c,subs:c.subs.filter(x=>x.id!==s.id)}:c))} style={{ background:"none",border:"none",cursor:"pointer",color:T.sub,fontSize:10,padding:0 }}>âœ•</button>
                  </span>
                ))}
              </div>
              {addSubTo===cat.id?(
                <div>
                  <div style={{ display:"flex",gap:6 }}>
                    <input style={{ ...inpSm,flex:1 }} placeholder="Subcategory name(s) â€” e.g. Milk, Eggs, Bread" value={subInput} onChange={e=>setSubInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addSubcategories(cat.id); } }} autoFocus/>
                    <button onClick={()=>addSubcategories(cat.id)} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,color:T.accent,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>Add</button>
                    <button onClick={()=>{setAddSubTo(null);setSubInput("");}} style={{ background:"none",border:`1px solid ${T.border}`,color:T.sub,borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:12,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
                  </div>
                  <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>Tip: separate multiple items with commas to add them all at once.</div>
                </div>
              ):(
                <button onClick={()=>setAddSubTo(cat.id)} style={{ background:"none",border:`1px dashed ${T.border}`,color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>+ subcategory / items</button>
              )}
            </div>
          );
        })}
        <div style={{ ...card,border:`1px dashed ${T.border}` }}>
          <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:14 }}>âž• New Category</div>
          <div style={{ display:"flex",gap:10,alignItems:"center",marginBottom:12 }}>
            <div style={{ position:"relative" }}>
              <button onClick={()=>setShowIconPk(p=>!p)} style={{ background:newCatColor+"22",border:`1px solid ${newCatColor}44`,borderRadius:10,padding:"10px 12px",cursor:"pointer",fontSize:22 }}>{newCatIcon}</button>
              {showIconPk&&<div style={{ position:"absolute",top:"110%",left:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:12,zIndex:30,width:240,boxShadow:`0 4px 20px ${T.sh}` }}>
                <input style={{ ...inpSm,width:"100%",marginBottom:8 }} placeholder="Search icons..." value={iconSearch} onChange={e=>setIconSearch(e.target.value)}/>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,maxHeight:180,overflowY:"auto" }}>
                  {filteredIcons.map(ic=><button key={ic} onClick={()=>{setNewCatIcon(ic);setShowIconPk(false);setIconSearch("");}} style={{ background:T.input,border:"none",borderRadius:8,padding:6,cursor:"pointer",fontSize:18 }}>{ic}</button>)}
                </div>
              </div>}
            </div>
            <input style={{ ...inp,flex:1 }} placeholder="Category name" value={newCatName} onChange={e=>setNewCatName(e.target.value)}/>
          </div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
            {PALETTE.map(c=><div key={c} onClick={()=>setNewCatColor(c)} style={{ width:26,height:26,borderRadius:7,background:c,cursor:"pointer",border:newCatColor===c?"3px solid #fff":"3px solid transparent" }}/>)}
          </div>
          <input style={{ ...inp,marginBottom:12 }} type="number" placeholder={`Monthly budget (${sym}) â€” optional`} value={newCatBudget} onChange={e=>setNewCatBudget(e.target.value)}/>
          <button onClick={()=>{ if(!newCatName.trim()) return; setCats(p=>[...p,{id:genId(),name:newCatName.trim(),icon:newCatIcon,color:newCatColor,budget:parseFloat(newCatBudget)||0,subs:[]}]); setNewCatName(""); setNewCatBudget(""); }} style={btnP}>Create Category</button>
        </div>
      </div>
    );

    return (
      <div style={{ padding:"14px 0 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"0 16px 16px" }}>
          <button onClick={()=>setShowSettings(false)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>â†</button>
          <div style={{ color:T.text,fontSize:20,fontWeight:900 }}>Settings</div>
        </div>
        <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,padding:"0 16px 8px" }}>Appearance</div>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,marginBottom:16,overflow:"hidden",marginLeft:16,marginRight:16 }}>
          <Row icon="ðŸŒ™" title="Dark Mode" subtitle="Switch between dark and light" right={<Toggle val={dark} fn={()=>setDark(d=>!d)}/>}/>
          <Row icon="✨" title="Auto Suggest" right={<Toggle val={autoDetectExpenseCategory} fn={()=>setAutoDetectExpenseCategory(v=>!v)}/>}/>
        </div>
        <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,padding:"0 16px 8px" }}>Finance</div>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,marginBottom:16,overflow:"hidden",marginLeft:16,marginRight:16 }}>
          <Row icon="🏦" title="Manage Accounts" subtitle={`${accounts.length} accounts`} onClick={()=>setSettingsSection("accounts")}/>
          <Row icon="💚" title="Income Types" subtitle={`${incomeTypeOptions.length} types`} onClick={()=>setSettingsSection("income_types")}/>
          <Row icon="🏠" title="Liability Types" subtitle={`${LIABILITY_TYPES.length} types`} onClick={()=>setSettingsSection("liabilities")}/>
          <Row icon="🏷️" title="Manage Categories" subtitle={`${cats.length} categories`} onClick={()=>setSettingsSection("categories")}/>
          <Row icon="👥" title="People & Groups" subtitle={`${people.filter(p=>!p.isMe).length} people · ${groups.length} groups`} onClick={()=>{ setShowSettings(false); setTab("people"); }}/>
        </div>
        <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,padding:"0 16px 8px" }}>Data</div>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,marginBottom:16,overflow:"hidden",marginLeft:16,marginRight:16 }}>
          <Row icon="ðŸ“Š" title="Import Bank Statement" subtitle="Coming in Phase 6"/>
          <Row icon="ðŸ’¾" title="Backup / Export" subtitle="Download your data"/>
        </div>
        <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,padding:"0 16px 8px" }}>Security</div>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,marginBottom:16,overflow:"hidden",marginLeft:16,marginRight:16 }}>
          <Row icon="ðŸ”’" title="Change PIN" onClick={()=>{ localStorage.removeItem("arth_pin"); window.location.reload(); }}/>
          <Row icon="ðŸ”" title="Lock App" onClick={onLock}/>
        </div>
        <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,padding:"0 16px 8px" }}>About</div>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,marginBottom:40,overflow:"hidden",marginLeft:16,marginRight:16 }}>
          <Row icon="ðŸ’°" title="Arth" subtitle="Personal Finance · v3.0"/>
          <Row icon="🧹" title="Remove Duplicate Settlements" subtitle="Clean up accidental double-entries" onClick={()=>{
            const cleaned=dedupeSettlementTxns(txns);
            const removed=txns.length-cleaned.length;
            setTxns(cleaned);
            alert(`Removed ${removed} duplicate settlement${removed===1?"":"s"}.`);
          }}/>
        </div>
      </div>
    );
  };

  // â”€â”€ EDIT ACCOUNT MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const EditAccountModal = ({ a, onClose }) => {
    const [name, setName] = useState(a.name||"");
    const [last4, setLast4] = useState(a.last4||"");
    const [color, setColor] = useState(a.color||PALETTE[0]);
    const [limit, setLimit] = useState(String(a.limit||""));
    const [statementDate, setStatementDate] = useState(String(a.statementDate||"15"));
    const [dueDate, setDueDate] = useState(String(a.dueDate||"5"));
    const [alertPct, setAlertPct] = useState(String(a.alertPct ?? "30"));
    const [billingCycle, setBillingCycle] = useState(a.billingCycle||"");
    const [handle, setHandle] = useState(a.handle||"");
    const [openingBalance, setOpeningBalance] = useState(String(a.openingBalance||"0"));
    const [openingBalanceDate, setOpeningBalanceDate] = useState(a.openingBalanceDate||todayStr());
    const [linkedBank, setLinkedBank] = useState(a.linkedBank||"");
    const banks = accounts.filter(x=>x.type==="bank"&&x.id!==a.id);

    const save = () => {
      if(!name.trim()) return;
      setAccounts(prev=>prev.map(x=>x.id===a.id?{
        ...x, name:name.trim(), last4, color,
        ...(a.type==="cc"&&{ limit:parseFloat(limit)||0, statementDate:parseInt(statementDate)||15, dueDate:parseInt(dueDate)||5, alertPct:Math.max(0,parseFloat(alertPct)||0), billingCycle:billingCycle||`${statementDate}thâ€“${dueDate}th` }),
        ...((a.type==="bank"||a.type==="cash")&&{ openingBalance:parseMoney(openingBalance)||0, openingBalanceDate:openingBalanceDate||todayStr() }),
        ...(a.type==="upi"&&{ handle }),
        ...(a.type==="debit"&&{ linkedBank }),
      }:x));
      onClose();
    };

    return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>✏️ Edit {a.name}</div>
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ background:T.input,borderRadius:10,padding:"8px 14px" }}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1 }}>Type: {a.type==="cc"?"Credit Card":a.type==="bank"?"Bank Account":a.type==="debit"?"Debit Card":a.type==="upi"?"UPI":"Cash"}</div>
            </div>
            <input style={inp} placeholder="Account name *" value={name} onChange={e=>setName(e.target.value)}/>
            {(a.type==="bank"||a.type==="cc"||a.type==="debit")&&<input style={inp} placeholder="Last 4 digits" maxLength={4} value={last4} onChange={e=>setLast4(e.target.value)}/>}
            {(a.type==="bank"||a.type==="cash")&&<div style={{ display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:10 }}>
              <div>
                <span style={lbl}>{a.type==="cash"?`Cash in hand (${sym})`:`Opening balance (${sym})`}</span>
                <input style={inp} type="text" inputMode="decimal" value={openingBalance?fmt(parseMoney(openingBalance)):""} onChange={e=>setOpeningBalance(cleanMoneyInput(e.target.value))}/>
              </div>
              <div>
                <span style={lbl}>As on date</span>
                <input style={inp} type="date" value={openingBalanceDate} onChange={e=>setOpeningBalanceDate(e.target.value)}/>
              </div>
            </div>}
            {a.type==="cc"&&<>
              <div><span style={lbl}>Credit limit ({sym})</span><input style={inp} type="number" value={limit} onChange={e=>setLimit(e.target.value)}/></div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div><span style={lbl}>Statement Date</span><input style={inp} type="number" min="1" max="31" value={statementDate} onChange={e=>setStatementDate(e.target.value)}/></div>
                <div><span style={lbl}>Due Date</span><input style={inp} type="number" min="1" max="31" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
              </div>
              <div><span style={lbl}>Spend alert (% of limit)</span><input style={inp} type="number" min="0" max="100" value={alertPct} onChange={e=>setAlertPct(e.target.value)}/></div>
              <div><span style={lbl}>Billing Cycle (e.g. 15thâ€“14th)</span><input style={inp} placeholder="e.g. 15thâ€“14th" value={billingCycle} onChange={e=>setBillingCycle(e.target.value)}/></div>
            </>}
            {a.type==="upi"&&<input style={inp} placeholder="UPI handle" value={handle} onChange={e=>setHandle(e.target.value)}/>}
            {a.type==="debit"&&banks.length>0&&<div>
              <span style={lbl}>Linked Bank Account</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {banks.map(b=><button key={b.id} onClick={()=>setLinkedBank(b.id)} style={{ background:linkedBank===b.id?b.color+"22":"none",border:`1px solid ${linkedBank===b.id?b.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:linkedBank===b.id?b.color:T.sub,fontFamily:"Nunito,sans-serif" }}>🏦 {b.name}</button>)}
              </div>
            </div>}
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {PALETTE.map(c=><div key={c} onClick={()=>setColor(c)} style={{ width:28,height:28,borderRadius:7,background:c,cursor:"pointer",border:color===c?"3px solid #fff":"3px solid transparent" }}/>)}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={onClose} style={btnG}>Cancel</button>
              <button onClick={save} style={btnP}>Save Changes âœ“</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // â”€â”€ BUDGET PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const BudgetPage = () => {
    const fy = new Date().getMonth()>=3 ? new Date().getFullYear() : new Date().getFullYear()-1;
    const fyLabel = `FY ${fy}â€“${fy+1}`;
    const months = Array.from({length:12},(_,i)=>{ const d=new Date(fy,3+i,1); return { key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, label:d.toLocaleString("en-IN",{month:"short",year:"2-digit"}) }; });
    const monthlySlice = Math.round(annualBudget/12);
    const fySpend = months.reduce((s,m)=>s+txns.filter(t=>t.type==="expense"&&t.date?.startsWith(m.key)).reduce((a,t)=>a+getNetExpenseAmount(t),0),0);
    const fyRemaining = annualBudget - fySpend;
    const fyPct = Math.min(100,Math.round(fySpend/Math.max(1,annualBudget)*100));

    return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ color:T.text,fontSize:20,fontWeight:900,marginBottom:14 }}>ðŸ’° Budget</div>

        {/* FY Summary */}
        <div style={{ ...card,background:`linear-gradient(135deg,${T.accent}10,${T.card})` }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12 }}>
            <div>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>{fyLabel}</div>
              <div style={{ color:T.text,fontSize:22,fontWeight:900 }}>{sym}{fmt(annualBudget)}</div>
              <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>Annual budget · {sym}{fmt(monthlySlice)}/month</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:T.danger,fontSize:16,fontWeight:800 }}>{sym}{fmt(fySpend)}</div>
              <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>Spent so far</div>
              <div style={{ color:fyRemaining>=0?T.success:T.danger,fontSize:14,fontWeight:800,marginTop:4 }}>{fyRemaining>=0?"+":""}{sym}{fmt(fyRemaining)}</div>
              <div style={{ color:T.sub,fontSize:10 }}>{fyRemaining>=0?"remaining":"over budget"}</div>
            </div>
          </div>
          <div style={{ height:6,background:T.border,borderRadius:3,marginBottom:4 }}>
            <div style={{ height:"100%",width:`${fyPct}%`,background:fyPct>90?T.danger:fyPct>70?T.warn:T.success,borderRadius:3 }}/>
          </div>
          <div style={{ color:T.sub,fontSize:11 }}>{fyPct}% of annual budget used</div>
        </div>

        {/* Edit annual budget */}
        <div style={{ ...card }}>
          <div style={{ color:T.text,fontSize:13,fontWeight:700,marginBottom:8 }}>Edit Annual Budget</div>
          <input style={{ ...inp,marginBottom:6 }} type="text" inputMode="decimal" value={annualBudget?fmt(annualBudget):""} onChange={e=>setAnnualBudget(parseMoney(e.target.value))} placeholder={`e.g. ${sym}6,00,000`}/>
          <div style={{ color:T.sub,fontSize:11 }}>Monthly slice: {sym}{fmt(monthlySlice)}</div>
        </div>

        {/* Month by month */}
        <div style={{ color:T.text,fontSize:15,fontWeight:800,marginBottom:10 }}>Month by Month</div>
        {months.map(m=>{
          const mSpend = txns.filter(t=>t.type==="expense"&&t.date?.startsWith(m.key)).reduce((s,t)=>s+getNetExpenseAmount(t),0);
          const mBudget = monthOverrides[m.key]||monthlySlice;
          const diff = mBudget - mSpend;
          const isOver = diff < 0;
          const pct = mSpend ? Math.min(100,Math.round(mSpend/mBudget*100)) : 0;
          const isCurrent = m.key===viewMonth;
          const isFuture = m.key > viewMonth;
          return (
            <div key={m.key} onClick={()=>{ setViewMonth(m.key); setTab("home"); }} style={{ ...card,cursor:"pointer",border:`1px solid ${isCurrent?T.accent:T.border}`,background:isCurrent?T.accentSoft:T.card,opacity:isFuture?0.6:1,marginBottom:8 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6 }}>
                <div style={{ color:isCurrent?T.accent:T.text,fontSize:13,fontWeight:isCurrent?800:600,minWidth:52 }}>{m.label}{isCurrent?<span style={{ color:T.accent,fontSize:9,marginLeft:4 }}>NOW</span>:""}</div>
                <div style={{ flex:1,height:5,background:T.border,borderRadius:3 }}>
                  <div style={{ height:"100%",width:`${pct}%`,background:isOver?T.danger:pct>70?T.warn:T.success,borderRadius:3 }}/>
                </div>
                <div style={{ color:T.sub,fontSize:12,minWidth:60,textAlign:"right" }}>{sym}{fmtK(mSpend)}</div>
                <div style={{ fontSize:12,fontWeight:700,color:isOver?T.danger:T.success,minWidth:52,textAlign:"right" }}>{isOver?"âˆ’":"+"}{sym}{fmtK(Math.abs(diff))}</div>
              </div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ color:T.sub,fontSize:10 }}>Budget: {sym}{fmt(mBudget)}</span>
                <button onClick={e=>{ e.stopPropagation(); setEditingMonthBudget(m.key); setEditingMonthVal(fmt(mBudget)); }} style={{ background:"none",border:"none",color:T.info,fontSize:10,cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>Edit</button>
              </div>
            </div>
          );
        })}


      </div>
    );
  };

  // â”€â”€ EDIT BILL MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const EditBillModal = ({ b, onClose }) => {
    const [name,setName]=useState(b.name||"");
    const [amount,setAmount]=useState(String(b.amount||""));
    const [dueDate,setDueDate]=useState(b.dueDate||todayStr());
    const [catId,setCatId]=useState(b.catId||cats[0]?.id||"");
    const [subId,setSubId]=useState(b.subId||"");
    const [recurring,setRecurring]=useState(b.recurring||false);
    const [frequency,setFrequency]=useState(b.frequency||"monthly");
    const [merchant,setMerchant]=useState(b.merchant||"");
    const [invoiceNo,setInvoiceNo]=useState(b.invoiceNo||"");
    const [editPhoto,setEditPhoto]=useState(b.imageBase64||null);
    const [editSplitPeople,setEditSplitPeople]=useState(()=>{ const m={}; Object.entries(b.splitPeople||{}).forEach(([pid])=>m[pid]=true); return m; });
    const [editSplitCalc,setEditSplitCalc]=useState("equally");
    const [editSplitCustom,setEditSplitCustom]=useState({});
    const [editGroup,setEditGroup]=useState(b.groupId||"");
    const curCat=getCat(catId||"");
    const editSelectedPids=Object.entries(editSplitPeople).filter(([,v])=>v).map(([k])=>k);
    const editAmt=parseFloat(amount)||0;

    const editIncludeMe = editGroup ? (getGroup(editGroup)?.includeMe !== false) : true;
    const calcEditShares=()=>{
      if(!editSelectedPids.length) return {};
      const shares={};
      if(editSplitCalc==="equally"){ const total=editSelectedPids.length+(editIncludeMe?1:0); const sh=total>0?Math.round(editAmt/total*100)/100:0; editSelectedPids.forEach(pid=>shares[pid]=sh); }
      else if(editSplitCalc==="amount"){ editSelectedPids.forEach(pid=>shares[pid]=parseFloat(editSplitCustom[pid])||0); }
      else if(editSplitCalc==="percent"){ editSelectedPids.forEach(pid=>{ const pct=parseFloat(editSplitCustom[pid])||0; shares[pid]=Math.round(editAmt*pct/100*100)/100; }); }
      else if(editSplitCalc==="share"){ const totalShares=editSelectedPids.reduce((s,pid)=>s+(parseFloat(editSplitCustom[pid])||1),0)+(editIncludeMe?1:0); editSelectedPids.forEach(pid=>{ const sh=parseFloat(editSplitCustom[pid])||1; shares[pid]=totalShares>0?Math.round(editAmt*sh/totalShares*100)/100:0; }); }
      return shares;
    };

    const save=()=>{
      const shares=calcEditShares();
      const peopleSplit={};
      Object.entries(shares).forEach(([pid,sh])=>{ const p=getPerson(pid); peopleSplit[pid]={amount:sh,mode:p.personType!=="dependant"?"owes":"spent_on"}; });
      const owedByOthers = Object.entries(peopleSplit).reduce((sum,[,info])=>sum+(info.mode==="owes"?Number(info.amount||0):0),0);
      const myShare=editIncludeMe ? Math.max(0, editAmt-owedByOthers) : 0;
      const groupCollectiveAmount = editGroup ? Math.max(0, editAmt-owedByOthers-myShare) : 0;
      setBills(prev=>prev.map(x=>x.id===b.id?{...x,name:name.trim(),amount:parseFloat(amount)||0,dueDate,catId,subId:subId||null,recurring,frequency,merchant:merchant.trim(),invoiceNo:invoiceNo.trim(),imageBase64:editPhoto,splitPeople:peopleSplit,groupId:editGroup||null,groupCollectiveAmount,myShare}:x));
      onClose();
    };

    return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>✏️ Edit Bill</div>
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <input style={inp} placeholder="Bill name *" value={name} onChange={e=>setName(e.target.value)}/>
            <input style={inp} placeholder="Merchant / Provider" value={merchant} onChange={e=>setMerchant(e.target.value)}/>
            <input style={inp} placeholder="Invoice / Bill Number (optional)" value={invoiceNo} onChange={e=>setInvoiceNo(e.target.value)}/>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div><span style={lbl}>Amount ({sym})</span><input style={{ ...inp,fontSize:20,fontWeight:800,textAlign:"center" }} type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
              <div><span style={lbl}>Due Date</span><input style={inp} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
            </div>
            <div>
              <span style={lbl}>Category</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {cats.map(c=><button key={c.id} onClick={()=>{setCatId(c.id);setSubId("");}} style={{ background:catId===c.id?c.color+"22":"none",border:`1px solid ${catId===c.id?c.color:T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:catId===c.id?c.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{c.icon} {c.name.split(" ")[0]}</button>)}
              </div>
              {curCat.subs?.length>0&&<div style={{ display:"flex",gap:5,flexWrap:"wrap",marginTop:8 }}>
                <button onClick={()=>setSubId("")} style={{ background:!subId?T.pill:"none",border:`1px solid ${T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:11,color:T.sub,fontFamily:"Nunito,sans-serif" }}>None</button>
                {curCat.subs.map(s=><button key={s.id} onClick={()=>setSubId(s.id)} style={{ background:subId===s.id?curCat.color+"22":"none",border:`1px solid ${subId===s.id?curCat.color:T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:11,color:subId===s.id?curCat.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{s.name}</button>)}
              </div>}
            </div>
            {/* Split */}
            <div>
              <span style={lbl}>Split with (optional)</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                <button onClick={()=>{setEditSplitPeople({});setEditGroup("");}} style={{ background:editSelectedPids.length===0&&!editGroup?"#88888822":"none",border:`1px solid ${editSelectedPids.length===0&&!editGroup?"#888888":T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>None</button>
                {groups.map(g=><button key={g.id} onClick={()=>{setEditGroup(editGroup===g.id?"":g.id); setEditSplitPeople({});}} style={{ background:editGroup===g.id?g.color+"22":"none",border:`1px solid ${editGroup===g.id?g.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:editGroup===g.id?g.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{g.icon} {g.name}</button>)}
              </div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:editSelectedPids.length>0?10:0 }}>
                {people.filter(p=>!p.isMe).map(p=><button key={p.id} onClick={()=>setEditSplitPeople(prev=>({...prev,[p.id]:!prev[p.id]}))} style={{ background:editSplitPeople[p.id]?p.color+"22":"none",border:`1px solid ${editSplitPeople[p.id]?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:editSplitPeople[p.id]?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>)}
              </div>
              {editSelectedPids.length>0&&<>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                  {[["equally","= Equal"],["amount","â‚¹ Amount"],["percent","% Percent"],["share","âš–️ Share"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setEditSplitCalc(v)} style={{ background:editSplitCalc===v?T.accent+"22":"none",border:`1px solid ${editSplitCalc===v?T.accent:T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:editSplitCalc===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
                  ))}
                </div>
                <div style={{ background:T.input,borderRadius:10,padding:"10px 12px" }}>
                  {(()=>{ const shares=calcEditShares(); const myS=editAmt-Object.values(shares).reduce((s,v)=>s+v,0); return <div style={{ display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}`,marginBottom:6 }}><span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>ðŸ§‘ My share</span><span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>{sym}{fmt(Math.max(0,myS))}</span></div>; })()}
                  {editSelectedPids.map(pid=>{ const p=getPerson(pid); const shares=calcEditShares(); return (
                    <div key={pid} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                      <span style={{ color:T.text,fontSize:12,flex:1 }}>{p.emoji} {p.name}</span>
                      {editSplitCalc!=="equally"&&<input type="number" placeholder="0" value={editSplitCustom[pid]||""} onChange={e=>setEditSplitCustom(prev=>({...prev,[pid]:e.target.value}))} style={{ ...inp,width:70,padding:"6px 8px",textAlign:"right" }}/>}
                      <span style={{ color:T.accent,fontSize:12,fontWeight:700,minWidth:60,textAlign:"right" }}>{sym}{fmt(shares[pid]||0)}</span>
                    </div>
                  ); })}
                </div>
              </>}
            </div>

            <div style={{ background:T.input,borderRadius:12,padding:"12px 14px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:recurring?12:0 }}>
                <input type="checkbox" id="edit_recurring" checked={recurring} onChange={e=>setRecurring(e.target.checked)} style={{ width:18,height:18,accentColor:T.accent,cursor:"pointer" }}/>
                <label htmlFor="edit_recurring" style={{ color:T.text,fontSize:14,fontWeight:700,cursor:"pointer" }}>ðŸ” Recurring bill</label>
              </div>
              {recurring&&<div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {[["monthly","Monthly"],["quarterly","Quarterly"],["halfyearly","Half-yearly"],["yearly","Yearly"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setFrequency(v)} style={{ background:frequency===v?T.accent+"22":"none",border:`1px solid ${frequency===v?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:frequency===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
                ))}
              </div>}
            </div>
            {/* Bill photo */}
            <div style={{ background:T.input,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10 }}>
              <span>ðŸ“·</span>
              <span style={{ color:T.sub,fontSize:13,fontWeight:700,flex:1 }}>Bill Photo (optional)</span>
              <label style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>
                {editPhoto?"Change":"Upload"}
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setEditPhoto(ev.target.result); r.readAsDataURL(f); }}/>
              </label>
              {editPhoto&&<button onClick={()=>setEditPhoto(null)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:16 }}>âœ•</button>}
            </div>
            {editPhoto&&<img src={editPhoto} alt="bill" style={{ width:"100%",borderRadius:10,maxHeight:160,objectFit:"cover" }} onError={e=>e.target.style.display="none"}/>}

            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={onClose} style={btnG}>Cancel</button>
              <button onClick={save} style={btnP}>Save Changes âœ“</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // â”€â”€ TABS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // â”€â”€ BILLS PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const BillsPage = () => {
    const [bFilter, setBFilter] = useState("unpaid");
    const filtered = bills.filter(b=>bFilter==="all"||b.status===bFilter);
    const totalUnpaid = bills.filter(b=>b.status==="unpaid").reduce((s,b)=>s+(b.amount||0),0);
    return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ color:T.text,fontSize:20,fontWeight:900 }}>ðŸ“… Bills</div>
          <button onClick={()=>setShowAddBill(true)} style={{ background:T.accent,border:"none",color:"#000",borderRadius:10,padding:"7px 16px",cursor:"pointer",fontSize:13,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>+ Add Bill</button>
        </div>
        {totalUnpaid>0&&<div style={{ ...card,background:`linear-gradient(135deg,${T.danger}10,${T.card})`,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div>
            <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Total Unpaid</div>
            <div style={{ color:T.danger,fontSize:22,fontWeight:900,marginTop:4 }}>{sym}{fmt(totalUnpaid)}</div>
          </div>
          <div style={{ fontSize:32 }}>ðŸ“‹</div>
        </div>}
        <div style={{ display:"flex",gap:6,marginBottom:14 }}>
          {[["unpaid","ðŸ”´ Unpaid"],["paid","âœ… Paid"],["all","All"]].map(([v,l])=>(
            <button key={v} onClick={()=>setBFilter(v)} style={{ background:bFilter===v?T.accent+"22":"none",border:`1px solid ${bFilter===v?T.accent:T.border}`,borderRadius:20,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:700,color:bFilter===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
          ))}
        </div>
        {filtered.length===0?<div style={{ ...card,textAlign:"center",padding:40 }}>
          <div style={{ fontSize:40,marginBottom:12 }}>ðŸ“­</div>
          <div style={{ color:T.sub,fontSize:13 }}>No bills here</div>
        </div>:filtered.map(b=>{
          const today=new Date();
          const daysUntil=Math.ceil((new Date(b.dueDate)-today)/(1000*60*60*24));
          const isOverdue=b.status==="unpaid"&&daysUntil<0;
          const cat=getCat(b.catId);
          return (
            <div key={b.id} style={{ ...card,border:`1px solid ${isOverdue?T.danger+"44":T.border}` }}>
              <div style={{ display:"flex",alignItems:"flex-start",gap:12,marginBottom:10 }}>
                <div style={{ width:40,height:40,borderRadius:11,background:cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{cat.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text,fontSize:14,fontWeight:800 }}>{b.name}</div>
                  <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{getCat(b.catId||b.catIds?.[0])?.name||"â€”"}{b.recurring?` · ðŸ” ${b.frequency}`:""}</div>
                  {b.invoiceNo&&<div style={{ color:T.sub,fontSize:10,marginTop:1 }}>#{b.invoiceNo}</div>}
                  {b.splitPeople&&Object.keys(b.splitPeople).length>0&&(
                    <div style={{ marginTop:6 }}>
                      {Object.entries(b.splitPeople).map(([pid,info])=>{ const p=getPerson(pid); return (
                        <div key={pid} style={{ fontSize:11,color:info.mode==="owes"?T.accent:T.sub,marginBottom:2 }}>
                          {p.emoji} {p.name}: {sym}{fmt(info.amount)} {info.mode==="owes"?"owes you":"on you"}
                        </div>
                      ); })}
                      <div style={{ fontSize:11,color:T.success,fontWeight:700,marginTop:4 }}>
                        Your share: {sym}{fmt(b.myShare ?? b.amount)}
                      </div>
                    </div>
                  )}
                  <div style={{ color:isOverdue?T.danger:daysUntil<=3&&b.status==="unpaid"?T.warn:T.sub,fontSize:11,marginTop:2 }}>
                    {b.status==="paid"?`âœ… Paid ${b.paidDate||""}`:isOverdue?`⚠️ ${Math.abs(daysUntil)}d overdue`:daysUntil===0?"Due today":`Due ${new Date(b.dueDate).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}`}
                  </div>
                  {b.imageBase64&&<img src={b.imageBase64} alt="bill" style={{ width:44,height:44,borderRadius:8,objectFit:"cover",marginTop:4,cursor:"pointer" }} onClick={()=>window.open(b.imageBase64,"_blank")} onError={e=>e.target.style.display="none"}/>}
                </div>
                <div style={{ textAlign:"right" }}>
                  {b.amount>0&&<div style={{ color:T.text,fontSize:15,fontWeight:800 }}>{sym}{fmt(b.amount)}</div>}
                  <div style={{ display:"flex",gap:6,justifyContent:"flex-end",marginTop:4 }}>
                    <button onClick={()=>setEditingBill(b)} style={{ background:"none",border:"none",color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"Nunito,sans-serif",fontWeight:700 }}>✏️</button>
                    <button onClick={()=>setBills(p=>p.filter(x=>x.id!==b.id))} style={{ background:"none",border:"none",color:T.danger,fontSize:11,cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>ðŸ—‘</button>
                  </div>
                </div>
              </div>
              {b.status==="unpaid"&&(
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  <button onClick={()=>{
                    const payAccId=accounts.find(a=>a.type!=="cc")?.id||"";
                    setTxns(p=>[{id:Date.now(),type:"expense",desc:b.name,merchant:b.merchant||"",date:todayStr(),note:"Bill payment",catId:b.catId,catIds:b.catIds||[b.catId],subId:b.subId||null,accId:payAccId,people:b.splitPeople||{},forPerson:"",groupId:b.groupId||null,groupCollectiveAmount:Number(b.groupCollectiveAmount||0),amount:b.amount||0,isBillPayment:true,billInvoiceNo:b.invoiceNo||null,paidBillId:b.id,paidBillName:b.name},...p]);
                    setBills(p=>p.map(x=>x.id===b.id?{...x,status:"paid",paidDate:todayStr()}:x));
                    if(b.recurring){
                      const next=new Date(b.dueDate);
                      if(b.frequency==="monthly") next.setMonth(next.getMonth()+1);
                      else if(b.frequency==="quarterly") next.setMonth(next.getMonth()+3);
                      else if(b.frequency==="halfyearly") next.setMonth(next.getMonth()+6);
                      else if(b.frequency==="yearly") next.setFullYear(next.getFullYear()+1);
                      setBills(p=>[...p,{...b,id:genId(),status:"unpaid",dueDate:next.toISOString().split("T")[0],amount:b.amount,paidDate:null}]);
                    }
                  }} style={{ ...btnP,flex:1,padding:"9px" }}>âœ… Mark as Paid</button>
                  <button onClick={()=>setEditingBill(b)} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:12,padding:"9px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>✏️ Edit</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // â”€â”€ ADD BILL MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const AddBillModal = () => {
    const [name,setName]=useState("");
    const [amount,setAmount]=useState("");
    const [dueDate,setDueDate]=useState(todayStr());
    const [billCatIds,setBillCatIds]=useState([cats[0]?.id||""]);
    const [subId,setSubId]=useState("");
    const [recurring,setRecurring]=useState(false);
    const [frequency,setFrequency]=useState("monthly");
    const [merchant,setMerchant]=useState("");
    const [billPhoto,setBillPhoto]=useState(null);
    const [invoiceNo,setInvoiceNo]=useState("");
    // Split state
    const [billSplitPeople,setBillSplitPeople]=useState({});
    const [billGroup,setBillGroup]=useState("");
    const [splitCalc,setSplitCalc]=useState("equally");
    const [splitCustom,setSplitCustom]=useState({});

    const selectedPids=Object.entries(billSplitPeople).filter(([,v])=>v).map(([k])=>k);
    const amt=parseFloat(amount)||0;

    const billIncludeMe = billGroup ? (getGroup(billGroup)?.includeMe !== false) : true;
    const calcShares=()=>{
      if(!selectedPids.length) return {};
      const shares={};
      if(splitCalc==="equally"){ const total=selectedPids.length+(billIncludeMe?1:0); const sh=total>0?Math.round(amt/total*100)/100:0; selectedPids.forEach(pid=>shares[pid]=sh); }
      else if(splitCalc==="amount"){ selectedPids.forEach(pid=>shares[pid]=parseFloat(splitCustom[pid])||0); }
      else if(splitCalc==="percent"){ selectedPids.forEach(pid=>{ const pct=parseFloat(splitCustom[pid])||0; shares[pid]=Math.round(amt*pct/100*100)/100; }); }
      else if(splitCalc==="share"){ const totalShares=selectedPids.reduce((s,pid)=>s+(parseFloat(splitCustom[pid])||1),0)+(billIncludeMe?1:0); selectedPids.forEach(pid=>{ const sh=parseFloat(splitCustom[pid])||1; shares[pid]=totalShares>0?Math.round(amt*sh/totalShares*100)/100:0; }); }
      return shares;
    };

    const handleGroupSelect=gid=>{
      setBillGroup(gid);
      setBillSplitPeople({});
    };

    const submit=()=>{
      if(!name.trim()||!parseFloat(amount)) return;
      const shares=calcShares();
      const peopleSplit={};
      Object.entries(shares).forEach(([pid,sh])=>{ const p=getPerson(pid); peopleSplit[pid]={amount:sh,mode:p.personType!=="dependant"?"owes":"spent_on"}; });
      const owedByOthers = Object.entries(peopleSplit).reduce((sum,[,info])=>sum+(info.mode==="owes"?Number(info.amount||0):0),0);
      const myShare = billIncludeMe ? Math.max(0, amt-owedByOthers) : 0;
      const groupCollectiveAmount = billGroup ? Math.max(0, amt-owedByOthers-myShare) : 0;
      const newBill={id:genId(),name:name.trim(),merchant:merchant.trim()||"",invoiceNo:invoiceNo.trim(),amount:amt,dueDate,catId:billCatIds[0]||null,catIds:billCatIds,subId:subId||null,recurring,frequency,status:"unpaid",paidDate:null,createdDate:todayStr(),splitPeople:peopleSplit,groupId:billGroup||null,groupCollectiveAmount,myShare,imageBase64:billPhoto};
      setBills(p=>[...p,newBill]);

      const matchingTxn = txns.find(t=>t.type==="expense" && !t.isBillPayment && !t.paidBillId && Number(t.amount)===amt && (billCatIds[0]? t.catId===billCatIds[0] : true));
      if(matchingTxn){
        setBillMatchSuggestion({bill:newBill,txn:matchingTxn});
      }

      setShowAddBill(false);
    };

    return (
      <div onClick={e=>e.target===e.currentTarget&&setShowAddBill(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"92vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>ðŸ“… Add Bill</div>
            <button onClick={()=>setShowAddBill(false)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>

            <input style={{ ...inp,fontSize:17,fontWeight:700,border:`1px solid ${!name.trim()?T.danger+"66":T.border}` }} placeholder="Bill name * (required)" value={name} onChange={e=>setName(e.target.value)}/>
            <input style={inp} placeholder="Merchant / Provider (optional)" value={merchant} onChange={e=>setMerchant(e.target.value)}/>
            <input style={inp} placeholder="Invoice / Bill Number (optional) e.g. MSEB/2026/04/001" value={invoiceNo} onChange={e=>setInvoiceNo(e.target.value)}/>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div><span style={lbl}>Amount ({sym}) *</span><input style={{ ...inp,fontSize:20,fontWeight:800,textAlign:"center",border:`1px solid ${amount&&parseFloat(amount)>0?T.border:T.danger+"66"}` }} type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
              <div><span style={lbl}>Due Date</span><input style={inp} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
            </div>

            <div>
              <span style={lbl}>Categories (select one or more)</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {cats.map(c=><button key={c.id} onClick={()=>setBillCatIds(prev=>prev.includes(c.id)?prev.filter(x=>x!==c.id):[...prev,c.id])} style={{ background:billCatIds.includes(c.id)?c.color+"22":"none",border:`1px solid ${billCatIds.includes(c.id)?c.color:T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:billCatIds.includes(c.id)?c.color:T.sub,fontFamily:"Nunito,sans-serif",display:"flex",alignItems:"center",gap:4 }}>{c.icon} {c.name.split(" ")[0]}</button>)}
              </div>
              {billCatIds.length>0&&<div style={{ marginTop:8 }}>
                {billCatIds.map(cid=>{ const c=getCat(cid); if(!c.subs?.length) return null; return (
                  <div key={cid} style={{ marginBottom:6 }}>
                    <div style={{ color:c.color,fontSize:10,fontWeight:700,marginBottom:4 }}>{c.icon} {c.name}</div>
                    <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                      {c.subs.map(s=><button key={s.id} onClick={()=>setSubId(prev=>prev===s.id?"":s.id)} style={{ background:subId===s.id?c.color+"22":"none",border:`1px solid ${subId===s.id?c.color:T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:11,color:subId===s.id?c.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{s.name}</button>)}
                    </div>
                  </div>
                ); })}
              </div>}
            </div>

            {/* Split section */}
            <div>
              <span style={lbl}>Split with (optional)</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                <button onClick={()=>{setBillSplitPeople({});setBillGroup("");}} style={{ background:selectedPids.length===0&&!billGroup?"#88888822":"none",border:`1px solid ${selectedPids.length===0&&!billGroup?"#888888":T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>None â€” just me</button>
                {groups.map(g=><button key={g.id} onClick={()=>handleGroupSelect(billGroup===g.id?"":g.id)} style={{ background:billGroup===g.id?g.color+"22":"none",border:`1px solid ${billGroup===g.id?g.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:billGroup===g.id?g.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{g.icon} {g.name}</button>)}
              </div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:selectedPids.length>0?10:0 }}>
                {people.filter(p=>!p.isMe).map(p=><button key={p.id} onClick={()=>setBillSplitPeople(prev=>({...prev,[p.id]:!prev[p.id]}))} style={{ background:billSplitPeople[p.id]?p.color+"22":"none",border:`1px solid ${billSplitPeople[p.id]?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:billSplitPeople[p.id]?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>)}
              </div>

              {selectedPids.length>0&&<>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                  {[["equally","= Equal"],["amount","â‚¹ Amount"],["percent","% Percent"],["share","âš–️ Share"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setSplitCalc(v)} style={{ background:splitCalc===v?T.accent+"22":"none",border:`1px solid ${splitCalc===v?T.accent:T.border}`,borderRadius:20,padding:"5px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:splitCalc===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
                  ))}
                </div>
                <div style={{ background:T.input,borderRadius:10,padding:"10px 12px" }}>
                  {/* My share row */}
                  {(()=>{ const shares=calcShares(); const myS=amt-Object.values(shares).reduce((s,v)=>s+v,0); return <div style={{ display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}`,marginBottom:6 }}><span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>ðŸ§‘ My share</span><span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>{sym}{fmt(Math.max(0,myS))}</span></div>; })()}
                  {selectedPids.map(pid=>{
                    const p=getPerson(pid);
                    const shares=calcShares();
                    return (
                      <div key={pid} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                        <span style={{ color:T.text,fontSize:12,flex:1 }}>{p.emoji} {p.name}</span>
                        {splitCalc!=="equally"&&<input type="number" placeholder={splitCalc==="percent"?"%":splitCalc==="share"?"shares":"0"} value={splitCustom[pid]||""} onChange={e=>setSplitCustom(prev=>({...prev,[pid]:e.target.value}))} style={{ ...inp,width:70,padding:"6px 8px",textAlign:"right" }}/>}
                        <span style={{ color:T.accent,fontSize:12,fontWeight:700,minWidth:60,textAlign:"right" }}>{sym}{fmt(shares[pid]||0)}</span>
                      </div>
                    );
                  })}
                </div>
              </>}
            </div>

            {/* Recurring */}
            <div style={{ background:T.input,borderRadius:12,padding:"12px 14px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:recurring?12:0 }}>
                <input type="checkbox" id="recurring" checked={recurring} onChange={e=>setRecurring(e.target.checked)} style={{ width:18,height:18,accentColor:T.accent,cursor:"pointer" }}/>
                <label htmlFor="recurring" style={{ color:T.text,fontSize:14,fontWeight:700,cursor:"pointer" }}>ðŸ” Recurring bill</label>
              </div>
              {recurring&&<div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {[["monthly","Monthly"],["quarterly","Quarterly"],["halfyearly","Half-yearly"],["yearly","Yearly"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setFrequency(v)} style={{ background:frequency===v?T.accent+"22":"none",border:`1px solid ${frequency===v?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:frequency===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
                ))}
              </div>}
            </div>

            {/* Bill photo â€” optional */}
            <div style={{ background:T.input,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10 }}>
              <span>ðŸ“·</span>
              <span style={{ color:T.sub,fontSize:13,fontWeight:700,flex:1 }}>Attach Bill Photo (optional)</span>
              <label style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>
                {billPhoto?"Change":"Upload"}
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setBillPhoto(ev.target.result); r.readAsDataURL(f); }}/>
              </label>
              {billPhoto&&<button onClick={()=>setBillPhoto(null)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:16 }}>âœ•</button>}
            </div>
            {billPhoto&&<img src={billPhoto} alt="bill" style={{ width:"100%",borderRadius:10,maxHeight:160,objectFit:"cover" }} onError={e=>{ e.target.style.display="none"; setBillPhoto(null); }}/>}

            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={()=>setShowAddBill(false)} style={btnG}>Cancel</button>
              <button onClick={submit} style={{ ...btnP,opacity:name.trim()?1:0.5 }}>Add Bill</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

    // â”€â”€ EDIT PERSON MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const EditPersonModal = ({ p, onClose }) => {
    const [name,setName]=useState(p.name||"");
    const [emoji,setEmoji]=useState(p.emoji||"ðŸ‘¤");
    const [relation,setRelation]=useState(p.relation||"");
    const [color,setColor]=useState(p.color||PALETTE[0]);
    const [personType,setPersonType]=useState(p.personType||"contact");
    const [creditLimit,setCreditLimit]=useState(String(p.creditLimit||""));
    const [spendBudget,setSpendBudget]=useState(String(p.spendBudget||""));
    const [favorite,setFavorite]=useState(Boolean(p.favorite));
    const save=()=>{
      setPeople(prev=>prev.map(x=>x.id===p.id?{...x,name:name.trim(),emoji,relation,color,personType,creditLimit:parseFloat(creditLimit)||0,spendBudget:parseFloat(spendBudget)||0,favorite}:x));
      setSelectedPerson(prev=>prev?{...prev,name:name.trim(),emoji,relation,color,personType,creditLimit:parseFloat(creditLimit)||0,spendBudget:parseFloat(spendBudget)||0,favorite}:null);
      onClose();
    };
    return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>✏️ Edit {p.name}</div>
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <input style={inp} placeholder="Name" value={name} onChange={e=>setName(e.target.value)}/>
              <input style={inp} placeholder="Relation" value={relation} onChange={e=>setRelation(e.target.value)}/>
            </div>
            <div style={{ background:T.input,borderRadius:12,padding:"12px 14px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <input type="checkbox" id="person_favorite" checked={favorite} onChange={e=>setFavorite(e.target.checked)} style={{ width:18,height:18,accentColor:T.accent,cursor:"pointer" }}/>
                <label htmlFor="person_favorite" style={{ color:T.text,fontSize:13,fontWeight:700,cursor:"pointer" }}>Mark as favorite</label>
              </div>
            </div>
            <div style={{ display:"flex",gap:8 }}>
              {["ðŸ‘¤","ðŸ‘¨","ðŸ‘©","ðŸ‘¶","ðŸ‘´","ðŸ‘µ","ðŸ•"].map(em=><button key={em} onClick={()=>setEmoji(em)} style={{ background:emoji===em?T.accentSoft:"none",border:`1px solid ${emoji===em?T.accent:T.border}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:18 }}>{em}</button>)}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              {[["contact","🤝 Contact","They may owe you"],["dependant","â™¥ Dependant","Family, you cover them"]].map(([v,l,sub])=>(
                <button key={v} onClick={()=>setPersonType(v)} style={{ flex:1,background:personType===v?T.accentSoft:"none",border:`1px solid ${personType===v?T.accent:T.border}`,borderRadius:10,padding:"8px",cursor:"pointer",fontFamily:"Nunito,sans-serif",textAlign:"left" }}>
                  <div style={{ fontSize:12,fontWeight:700,color:personType===v?T.accent:T.text }}>{l}</div>
                  <div style={{ fontSize:10,color:T.sub,marginTop:2 }}>{sub}</div>
                </button>
              ))}
            </div>
            {personType==="contact"&&<div>
              <span style={lbl}>Credit limit (max they can owe you)</span>
              <input style={inp} type="number" placeholder="0 = unlimited" value={creditLimit} onChange={e=>setCreditLimit(e.target.value)}/>
            </div>}
            {(personType==="dependant" || p.isMe)&&<div>
              <span style={lbl}>{p.isMe ? "Monthly self budget" : "Monthly spend awareness budget"}</span>
              <input style={inp} type="number" placeholder={p.isMe ? "e.g. 15000 for your own spends" : "0 = no limit"} value={spendBudget} onChange={e=>setSpendBudget(e.target.value)}/>
            </div>}
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {PALETTE.map(c=><div key={c} onClick={()=>setColor(c)} style={{ width:26,height:26,borderRadius:7,background:c,cursor:"pointer",border:color===c?"3px solid #fff":"3px solid transparent" }}/>)}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={onClose} style={btnG}>Cancel</button>
              <button onClick={save} style={btnP}>Save Changes âœ“</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TABS=[
    {id:"home",icon:"🏠",label:"Home"},
    {id:"transactions",icon:"ðŸ“‹",label:"Txns"},
    {id:"bills",icon:"ðŸ“…",label:"Bills"},
    {id:"wealth",icon:"ðŸ“ˆ",label:"Wealth"},
    {id:"settings_tab",icon:"âš™️",label:"Settings"}
  ];

  const [wealthUnlocked, setWealthUnlocked] = useState(false);
  const [showWealthPin, setShowWealthPin] = useState(false);

  const handleTab=t=>{
    if(t==="settings_tab"){ setShowWealthPin(false); setShowSettings(true); setSettingsSection(null); return; }
    if(t==="wealth"){
      if(wealthUnlocked){ setShowSettings(false); setTab("wealth"); setSelectedPerson(null); setSelectedGroup(null); }
      else { setShowSettings(false); setShowWealthPin(true); }
      return;
    }
    // Leave wealth, lock it again for next access
    setShowWealthPin(false);
    if(tab==="wealth") setWealthUnlocked(false);
    setShowSettings(false);
    setTab(t);
    setSelectedPerson(null);
    setSelectedGroup(null);
  };

  const isTabActive=t=>t==="settings_tab"?showSettings:(tab===t&&!showSettings);

  return (
    <div style={{ background:T.bg,minHeight:"100vh",transition:"background 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{display:none;}
        input,textarea,select{font-size:16px!important;-webkit-text-size-adjust:100%;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:${dark?"invert(1)":"none"};}
        select option{background:#13131a;}
        textarea{font-family:Nunito,sans-serif;}
      `}</style>
      <div style={{ maxWidth:430,margin:"0 auto",minHeight:"100vh",position:"relative",paddingBottom:80,fontFamily:"Nunito,sans-serif" }}>

        {/* Top bar */}
        {!showSettings&&<div style={{ background:T.nav,borderBottom:`1px solid ${T.border}`,padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:50 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:32,height:32,borderRadius:9,background:T.accentSoft,border:`1px solid ${T.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:900,color:T.accent,fontFamily:"Nunito,sans-serif" }}>â‚¹</div>
            <div>
              <div style={{ color:T.text,fontSize:16,fontWeight:900,lineHeight:1 }}>Arth</div>
              <div style={{ color:T.sub,fontSize:9,marginTop:1,textTransform:"uppercase",letterSpacing:1 }}>Personal Finance</div>
            </div>
          </div>
          <button onClick={()=>{ if(tab==="bills") setShowAddBill(true); else { const typeMap={"expense":"expense","income":"income","transfer":"transfer","cc_payment":"cc_payment","investment":"investment","settlement_in":"settlement_in"}; setDefaultAddType(typeMap[fType]||"expense"); setShowAdd(true); } }} style={{ background:T.accent,border:"none",color:"#000",borderRadius:10,padding:"6px 16px",cursor:"pointer",fontSize:13,fontWeight:900,fontFamily:"Nunito,sans-serif" }}>+ Add</button>
        </div>}

        {/* Pages */}
        {!showSettings&&tab==="home"&&<Home/>}
        {!showSettings&&tab==="transactions"&&<Transactions/>}
        {!showSettings&&tab==="people"&&<People/>}
        {!showSettings&&tab==="budget"&&<BudgetPage/>}
        {!showSettings&&tab==="bills"&&<BillsPage/>}
        {!showSettings&&tab==="wealth"&&wealthUnlocked&&<WealthPage/>}
        {showSettings&&<Settings/>}

{showWealthPin&&(
          <div style={{ position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.92)" }}>
            <PinScreen isSetup={false} onUnlock={pin=>{ if(String(pin)===String(localStorage.getItem("arth_pin"))){ setWealthUnlocked(true); setShowWealthPin(false); setTab("wealth"); } }}/>
          </div>
        )}

        {/* Bottom Nav */}
        <div style={{ position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:T.nav,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-around",padding:"10px 0 16px",zIndex:100 }}>
          {TABS.map(t=>{
            const active=isTabActive(t.id);
            return (
              <button key={t.id} onClick={()=>handleTab(t.id)} style={{ background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"2px 6px" }}>
                <span style={{ fontSize:18,opacity:active?1:0.3,transition:"all 0.2s" }}>{t.icon}</span>
                <span style={{ fontSize:8,fontWeight:800,color:active?T.accent:T.sub,textTransform:"uppercase",letterSpacing:0.8,fontFamily:"Nunito,sans-serif" }}>{t.label}</span>
                {active&&<div style={{ width:14,height:3,borderRadius:2,background:T.accent }}/>}
              </button>
            );
          })}
        </div>

        {/* Modals */}
        {showAdd&&<AddModal defaultType={defaultAddType} prefillTxn={refundSourceTxn}/>}
        {showInvestments&&(
          <div onClick={e=>e.target===e.currentTarget&&setShowInvestments(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
            <div style={{ background:T.card,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto",paddingBottom:40 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 18px 0" }}>
                <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>ðŸ’¹ Investments</div>
                <button onClick={()=>setShowInvestments(false)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
              </div>
              <div style={{ padding:"14px 16px 0" }}><Investments/></div>
            </div>
          </div>
        )}
        {showAddBill&&<AddBillModal/>}
        {editingBill&&<EditBillModal b={editingBill} onClose={()=>setEditingBill(null)}/>}
        {billMatchSuggestion&&(
          <div style={{ position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",width:"calc(100% - 32px)",maxWidth:398,background:T.card,border:`1px solid ${T.success}66`,borderRadius:16,padding:"14px 16px",zIndex:300,boxShadow:`0 4px 24px ${T.sh}` }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:6 }}>🎯 Bill matched!</div>
            <div style={{ color:T.sub,fontSize:12,marginBottom:12 }}>&#34;{billMatchSuggestion.bill.name}&#34; ({sym}{fmt(billMatchSuggestion.bill.amount)}) â€” mark as paid?</div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>setBillMatchSuggestion(null)} style={{ ...btnG,flex:1,padding:"8px" }}>Skip</button>
              <button onClick={()=>{
                const b=billMatchSuggestion.bill;
                setBills(p=>p.map(x=>x.id===b.id?{...x,status:"paid",paidDate:todayStr(),paidByTxnId:billMatchSuggestion.txn.id}:x));
                setTxns(p=>p.map(x=>x.id===billMatchSuggestion.txn.id?{...x,isBillPayment:true,billInvoiceNo:b.invoiceNo||"",paidBillId:b.id,paidBillName:b.name}:x));
                if(b.recurring){ const next=new Date(b.dueDate); if(b.frequency==="monthly") next.setMonth(next.getMonth()+1); else if(b.frequency==="quarterly") next.setMonth(next.getMonth()+3); else if(b.frequency==="halfyearly") next.setMonth(next.getMonth()+6); else if(b.frequency==="yearly") next.setFullYear(next.getFullYear()+1); setBills(p=>[...p,{...b,id:genId(),status:"unpaid",dueDate:next.toISOString().split("T")[0],paidDate:null}]); }
                setBillMatchSuggestion(null);
              }} style={{ ...btnP,flex:2,padding:"8px",background:T.success }}>âœ… Yes, mark paid</button>
            </div>
          </div>
        )}
        {refundMatchSuggestion&&(
          <div style={{ position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",width:"calc(100% - 32px)",maxWidth:398,background:T.card,border:`1px solid ${T.info}66`,borderRadius:16,padding:"14px 16px",zIndex:300,boxShadow:`0 4px 24px ${T.sh}` }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:6 }}>â†© Refund match found</div>
            <div style={{ color:T.sub,fontSize:12,marginBottom:12 }}>This refund of {sym}{fmt(refundMatchSuggestion.refundTxn.amount)} looks like an earlier spend. Is this the original transaction?</div>
            <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:10 }}>
              {refundMatchSuggestion.matches.map(candidate=>(
                <button key={candidate.id} onClick={()=>{
                  setTxns(prev=>prev.map(x=>String(x.id)===String(refundMatchSuggestion.refundTxn.id)
                    ? { ...x, againstTxnId:candidate.id, note:[x.note, `Matched to ${candidate.desc||candidate.merchant||"original spend"} (${formatShortDate(candidate.date)})`].filter(Boolean).join(" · ") }
                    : x
                  ));
                  setRefundMatchSuggestion(null);
                }} style={{ background:T.input,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",textAlign:"left",fontFamily:"Nunito,sans-serif" }}>
                  <div style={{ color:T.text,fontSize:12,fontWeight:800 }}>{candidate.desc||candidate.merchant||"Expense"} · {sym}{fmt(candidate.amount)}</div>
                  <div style={{ color:T.sub,fontSize:10,marginTop:3 }}>{formatShortDate(candidate.date)}{candidate.accId?` · ${getAcc(candidate.accId).name}`:""}</div>
                </button>
              ))}
            </div>
            <button onClick={()=>setRefundMatchSuggestion(null)} style={{ ...btnG,width:"100%",padding:"8px" }}>Skip for now</button>
          </div>
        )}
        {budgetOverrideMonth&&(
          <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20 }}>
            <div style={{ background:T.card,borderRadius:20,padding:24,width:"100%",maxWidth:360 }}>
              <div style={{ color:T.text,fontSize:16,fontWeight:900,marginBottom:12 }}>Edit Budget â€” {budgetOverrideMonth.label}</div>
              <input style={{ ...inp,marginBottom:16 }} type="text" inputMode="decimal" value={budgetOverrideVal} onChange={e=>setBudgetOverrideVal(e.target.value?fmt(parseMoney(e.target.value)):"")} placeholder={`e.g. ${sym}65,000`} autoFocus/>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <button onClick={()=>setBudgetOverrideMonth(null)} style={btnG}>Cancel</button>
                <button onClick={()=>{ const val=parseMoney(budgetOverrideVal); if(val>0) setMonthOverrides(p=>({...p,[budgetOverrideMonth.key]:val})); setBudgetOverrideMonth(null); }} style={btnP}>Save</button>
              </div>
            </div>
          </div>
        )}
        {editingMonthBudget&&(
          <div onClick={()=>setEditingMonthBudget(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24 }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:T.card,borderRadius:20,padding:24,width:"100%",maxWidth:360 }}>
              <div style={{ color:T.text,fontSize:16,fontWeight:900,marginBottom:16 }}>Edit Budget â€” {new Date(editingMonthBudget+"-01").toLocaleString("en-IN",{month:"long",year:"2-digit"})}</div>
              <input style={{ ...inp,marginBottom:16 }} type="text" inputMode="decimal" placeholder={`Enter budget amount (${sym})`} value={editingMonthVal} onChange={e=>setEditingMonthVal(e.target.value?fmt(parseMoney(e.target.value)):"")} autoFocus/>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <button onClick={()=>setEditingMonthBudget(null)} style={btnG}>Cancel</button>
                <button onClick={()=>{ const val=parseMoney(editingMonthVal); if(val>0){ setMonthOverrides(p=>({...p,[editingMonthBudget]:val})); } setEditingMonthBudget(null); }} style={btnP}>Save</button>
              </div>
            </div>
          </div>
        )}
        {editingCheckpoint&&(
          <div onClick={()=>setEditingCheckpoint(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24 }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:T.card,borderRadius:20,padding:24,width:"100%",maxWidth:380 }}>
              <div style={{ color:T.text,fontSize:16,fontWeight:900,marginBottom:8 }}>Bank Reconciliation</div>
              <div style={{ color:T.sub,fontSize:12,marginBottom:16 }}>{accounts.find(a=>a.id===editingCheckpoint)?.name}</div>
              <div style={{ background:T.input,borderRadius:12,padding:12,marginBottom:12 }}>
                <div style={{ color:T.text,fontSize:12,fontWeight:800,marginBottom:10 }}>Opening balance</div>
                <div style={{ display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:10 }}>
                  <div>
                    <span style={lbl}>Opening ({sym})</span>
                    <input style={inp} type="text" inputMode="decimal" placeholder="e.g. 5,600" value={editingOpeningBalanceVal?fmt(parseMoney(editingOpeningBalanceVal)):""} onChange={e=>setEditingOpeningBalanceVal(cleanMoneyInput(e.target.value))}/>
                  </div>
                  <div>
                    <span style={lbl}>As on date</span>
                    <input style={inp} type="date" value={editingOpeningBalanceDate} onChange={e=>setEditingOpeningBalanceDate(e.target.value)}/>
                  </div>
                </div>
              </div>
              <div style={{ background:T.input,borderRadius:12,padding:12,marginBottom:16 }}>
                <div style={{ color:T.text,fontSize:12,fontWeight:800,marginBottom:10 }}>Actual balance check</div>
                <div style={{ display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:10 }}>
                  <div>
                    <span style={lbl}>Actual balance ({sym})</span>
                    <input style={inp} type="text" inputMode="decimal" placeholder="e.g. 2,300" value={editingCheckpointVal?fmt(parseMoney(editingCheckpointVal)):""} onChange={e=>setEditingCheckpointVal(cleanMoneyInput(e.target.value))} autoFocus/>
                  </div>
                  <div>
                    <span style={lbl}>As on date</span>
                    <input style={inp} type="date" value={editingCheckpointDate} onChange={e=>setEditingCheckpointDate(e.target.value)}/>
                  </div>
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <button onClick={()=>setEditingCheckpoint(null)} style={btnG}>Cancel</button>
                <button onClick={()=>{
                  const openingVal = parseMoney(editingOpeningBalanceVal);
                  const actualVal = parseMoney(editingCheckpointVal);
                  setAccounts(prev=>prev.map(acc=>acc.id===editingCheckpoint ? { ...acc, openingBalance:openingVal, openingBalanceDate:editingOpeningBalanceDate||todayStr() } : acc));
                  setBalanceCheckpoints(p=>({...p,[editingCheckpoint]:{amount:actualVal,date:editingCheckpointDate||todayStr()}}));
                  setEditingCheckpoint(null);
                }} style={btnP}>Save</button>
              </div>
            </div>
          </div>
        )}
        {editingPerson&&<EditPersonModal p={editingPerson} onClose={()=>setEditingPerson(null)}/>}
        {editingTxn&&<EditModal t={editingTxn} onClose={()=>setEditingTxn(null)}/>}
        {settleTxn&&<SettleModal/>}
        {showAddAccount&&<AddAccountModal/>}
        {editingAccount&&<EditAccountModal a={editingAccount} onClose={()=>setEditingAccount(null)}/>}
        {showAddInvestment&&<AddInvestmentModal item={editingInvestment}/>}
        {selectedInvestmentDetail&&<InvestmentDetailModal/>}
        {showReceivablesList&&(
          <div onClick={()=>setShowReceivablesList(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:280,padding:20 }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:T.card,borderRadius:20,padding:22,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                <div style={{ color:T.text,fontSize:17,fontWeight:900 }}>Amounts to Receive</div>
                <button onClick={()=>setShowReceivablesList(false)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>âœ•</button>
              </div>
              <div style={{ color:T.sub,fontSize:11,marginBottom:14 }}>{new Date(viewMonth+"-01").toLocaleString("en-IN",{month:"long",year:"numeric"})} receivables from people</div>
              {monthlyReceivablePeopleList.length===0 ? (
                <div style={{ color:T.sub,fontSize:12 }}>No pending amount to receive for this month.</div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {monthlyReceivablePeopleList.map(item=>(
                    <div key={item.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,background:T.input,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px" }}>
                      <div style={{ minWidth:0,flex:1 }}>
                        <div style={{ color:T.text,fontSize:12,fontWeight:800 }}>{item.person?.emoji||"ðŸ‘¤"} {item.person?.name||"Person"}</div>
                        <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{item.person?.relation||"Pending receivable"}</div>
                      </div>
                      <div style={{ color:T.accent,fontSize:13,fontWeight:900 }}>{sym}{fmt(item.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {(showAddLoan||editingLoan)&&<LoanModal item={editingLoan} onClose={()=>{ setShowAddLoan(false); setEditingLoan(null); }}/>}        
        {repaymentLoan&&<LoanRepaymentModal item={repaymentLoan} onClose={()=>setRepaymentLoan(null)}/>}        
        {(showAddLiability||editingLiability)&&<LiabilityModal item={editingLiability} onClose={()=>{ setShowAddLiability(false); setEditingLiability(null); }}/>}
        {(showAddAsset||editingAsset)&&<AssetModal item={editingAsset} onClose={()=>{ setShowAddAsset(false); setEditingAsset(null); }}/>}
        {showAccDetail&&<AccDetailModal/>}
        {confirmDeleteCat&&<ConfirmDelete/>}
        {confirmDeleteAccount&&<ConfirmDeleteAccount/>}
        {confirmDeleteTxn&&(
          <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20 }}>
            <div style={{ background:T.card,borderRadius:20,padding:24,width:"100%",maxWidth:360 }}>
              <div style={{ color:T.text,fontSize:17,fontWeight:900,marginBottom:8 }}>Delete transaction?</div>
              <div style={{ color:T.sub,fontSize:13,marginBottom:20 }}>{confirmDeleteTxn.desc} · {sym}{fmt(confirmDeleteTxn.amount)}</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <button onClick={()=>setConfirmDeleteTxn(null)} style={btnG}>Cancel</button>
                <button onClick={()=>{ removeTxnAndLinkedInvestment(confirmDeleteTxn); setExpandedTxn(null); setConfirmDeleteTxn(null); }} style={{ ...btnP,background:T.danger }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
