import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
// Build-time version stamp: V4.DDMMYYHHmmss
const _bt = typeof __BUILD_TIME__ !== "undefined" ? new Date(__BUILD_TIME__) : new Date();
const APP_VERSION = `V4.${String(_bt.getDate()).padStart(2,"0")}${String(_bt.getMonth()+1).padStart(2,"0")}${String(_bt.getFullYear()).slice(-2)}${String(_bt.getHours()).padStart(2,"0")}${String(_bt.getMinutes()).padStart(2,"0")}${String(_bt.getSeconds()).padStart(2,"0")}`;
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { getCurrentCloudUser, isCloudSyncConfigured, loadCloudSnapshot, saveCloudSnapshot, signInWithPassword, signOutCloud, signUpWithPassword, supabase } from "./cloudSync";
// smsBridge — stub (native SMS not available in web PWA)
const isNativeSmsAvailable = () => false;
const readCopiedSms = async () => ({ text: "", error: "Not supported" });
const readLatestPhoneSms = async () => ({ text: "", error: "Not supported" });

// ─── THEME ───────────────────────────────────────────────────────────────────
const DARK  = { bg:"#08080f", card:"#0f0f1a", border:"#1a1a2e", text:"#e8e4dc", accent:"#f0a500", accentSoft:"rgba(240,165,0,0.1)", success:"#22c55e", danger:"#ef4444", input:"#0b0b18", nav:"#0a0a16", sub:"#5a5a7a", pill:"#14142a", sh:"rgba(0,0,0,0.6)", info:"#06b6d4", purple:"#8b5cf6", warn:"#f97316" };
const LIGHT = { bg:"#f4f3ef", card:"#ffffff", border:"#e5e1d8", text:"#1a1a2e", accent:"#d4920a", accentSoft:"rgba(212,146,10,0.08)", success:"#16a34a", danger:"#dc2626", input:"#ede9e3", nav:"#ffffff", sub:"#7a7890", pill:"#eeecea", sh:"rgba(0,0,0,0.06)", info:"#0891b2", purple:"#7c3aed", warn:"#ea6c00" };

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PALETTE = ["#f0a500","#22c55e","#3b82f6","#ef4444","#a855f7","#06b6d4","#f97316","#ec4899","#84cc16","#14b8a6","#8b5cf6","#f43f5e","#0ea5e9","#10b981","#f59e0b"];
const CAT_ICONS = ["🍽️","🍕","🍔","🍜","🥗","🍣","☕","🍺","🛒","🥩","🚗","🏍️","✈️","🚕","⛽","🅿️","🛍️","👗","👟","💄","💍","🧴","⚡","💧","📶","🔌","💊","🏥","🩺","🧘","🏋️","🎬","🎵","🎮","🎨","📚","🏠","🔧","🪴","🛋️","👶","🧒","🎒","✏️","🧸","💰","💳","📈","🏦","🪙","👤","🐕","🐈","🌿","🌍","☀️","🎁","🎂","💼","🖥️","📱","🔭","🪒","💇","💆","💅","🧖","🏊","🚴","⛳","🎯","🎪","🏟️","🚑","🔑","🛁","🧺","🪑","🖼️","⛵","🌊","⛰️","🎓","📖","🏛️"];
const INVEST_TYPES = [{ id:"mf", name:"Mutual Funds / SIP", icon:"📈", color:"#3b82f6" },{ id:"stocks", name:"Stocks", icon:"📊", color:"#22c55e" },{ id:"fd", name:"Fixed Deposit", icon:"🏦", color:"#f0a500" },{ id:"gold", name:"Gold", icon:"🥇", color:"#f59e0b" },{ id:"ppf", name:"PPF / NPS", icon:"🏛️", color:"#8b5cf6" },{ id:"crypto", name:"Crypto", icon:"₿", color:"#f97316" },{ id:"realestate", name:"Real Estate", icon:"🏘️", color:"#06b6d4" },{ id:"custom", name:"Custom", icon:"💼", color:"#ec4899" }];
const ACC_TYPES = [{ id:"bank", label:"Bank Account", icon:"🏦" },{ id:"cc", label:"Credit Card", icon:"💳" },{ id:"debit", label:"Debit Card", icon:"🏧" },{ id:"upi", label:"UPI", icon:"📱" },{ id:"cash", label:"Cash", icon:"💵" }];
const LIABILITY_TYPES = [{ id:"mortgage", name:"Mortgage / Home Loan", icon:"🏠", color:"#f97316" },{ id:"student", name:"Student Loan", icon:"🎓", color:"#8b5cf6" },{ id:"car", name:"Car Loan", icon:"🚗", color:"#3b82f6" },{ id:"tax", name:"Tax Liability", icon:"🏛️", color:"#ef4444" },{ id:"personal", name:"Personal Loan", icon:"🏦", color:"#ec4899" },{ id:"other", name:"Other Liability", icon:"📦", color:"#78716c" }];
const ASSET_TYPES = [{ id:"realestate", name:"Real Estate", icon:"🏠", color:"#06b6d4" },{ id:"vehicle", name:"Vehicle", icon:"🚗", color:"#3b82f6" },{ id:"valuable", name:"Valuable", icon:"💎", color:"#a855f7" },{ id:"gold", name:"Gold / Jewelry", icon:"🥇", color:"#f59e0b" },{ id:"other", name:"Other Asset", icon:"📦", color:"#22c55e" }];
const DEFAULT_INCOME_TYPES = ["salary","interest","freelance","rental","royalty","dividend","capital_gains"];
const INVESTMENT_FREQUENCY_OPTIONS = [
  { value:"daily", label:"Daily" },
  { value:"weekly", label:"Weekly" },
  { value:"monthly", label:"Monthly" },
  { value:"quarterly", label:"Quarterly" },
  { value:"halfyearly", label:"Half-yearly" },
  { value:"yearly", label:"Yearly" },
];

const ME = { id:"__me__", name:"Me", emoji:"🧑", relation:"Self", color:"#f0a500", personType:"dependant", isMe:true };

const DEFAULT_CATS = [
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

const DEFAULT_ACCOUNTS = [
  { id:"bank1", type:"bank", name:"ICICI Savings", last4:"3310", color:"#22c55e", openingBalance:0 },
  { id:"cc1", type:"cc", name:"HDFC Sapphire", last4:"4242", color:"#3b82f6", limit:300000, outstanding:0, statementDate:15, dueDate:5, billingCycle:"15th–14th", alertPct:30 },
  { id:"upi1", type:"upi", name:"GPay", handle:"", color:"#a855f7" },
  { id:"cash1", type:"cash", name:"Cash Wallet", color:"#f0a500", openingBalance:0 },
];
const DEFAULT_MEASURE_UNITS = ["kg","g","ltr","ml","nos","pkt","dozen","box"];

// ─── UTILS ───────────────────────────────────────────────────────────────────
const genId = () => Math.random().toString(36).slice(2,9);
const todayStr = () => new Date().toISOString().split("T")[0];
const sym = "₹";
const fmt = n => { const num = Number(n||0); return num.toLocaleString("en-IN", { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }); };
const fmtK = n => { const num = Number(n||0); if(num >= 100000) return (num/100000).toFixed(1).replace(/\.0$/,"")+"L"; if(num >= 1000) return (num/1000).toFixed(1).replace(/\.0$/,"")+"K"; return fmt(num); };
const parseMoney = v => {
  const cleaned = String(v ?? "").replace(/[₹,\s]/g,"");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};
const cleanMoneyInput = v => {
  const stripped = String(v ?? "").replace(/[₹,\s]/g, "");
  const cleaned = stripped.replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  if(dotIndex === -1) return cleaned;
  const whole = cleaned.slice(0, dotIndex);
  const decimal = cleaned.slice(dotIndex + 1).replace(/\./g, "");
  return `${whole}.${decimal}`;
};
const extractTxnReference = txt => {
  const s = String(txt ?? "");
  const labeled = s.match(/(?:utr|rrn|ref(?:erence)?(?:\s*(?:no\.?|id|number))?|txn(?:\s*(?:id|no|ref))?|transaction\s*(?:id|no|ref)?|upi\s*(?:ref(?:erence)?)?(?:\s*(?:no\.?|id))?|imps\s*(?:ref(?:no\.?)?)?|neft\s*(?:ref)?)[\s:#\/-]*([A-Z0-9]{6,})/i);
  if(labeled?.[1]) return labeled[1].trim();
  return "";
};
const extractSmsBalance = txt => {
  const m = String(txt ?? "").match(/(?:avail(?:able)?[\s\w]{0,10}(?:bal(?:ance)?|limit)|(?:a\/c\s+)?bal(?:ance)?(?:\s+(?:is|:|-))?|closing\s+bal|avl\.?\s+bal|a\/c\s+bal)[\s:]*(?:Rs\.?|INR|\u20b9)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  return m ? parseFloat(m[1].replace(/,/g,"")) : null;
};
// F12: Compute next due date based on billing model
const computeNextDueDate = (bill, paidDate) => {
  const base = bill.billingModel === "prorata"
    ? new Date(paidDate || bill.dueDate || bill.activationDate || new Date())
    : new Date(bill.periodEnd || bill.dueDate || new Date());
  const next = new Date(base);
  const freq = bill.frequency || "monthly";
  if(freq === "monthly") next.setMonth(next.getMonth() + 1);
  else if(freq === "quarterly") next.setMonth(next.getMonth() + 3);
  else if(freq === "halfyearly") next.setMonth(next.getMonth() + 6);
  else if(freq === "annual" || freq === "yearly") next.setFullYear(next.getFullYear() + 1);
  else if(freq === "custom" && bill.validityDays) next.setDate(next.getDate() + Number(bill.validityDays));
  return next.toISOString().split("T")[0];
};
const computeNextPeriod = (bill, paidDate) => {
  if(bill.billingModel !== "calendar" || !bill.periodStart || !bill.periodEnd) return null;
  const start = new Date(bill.periodEnd); start.setDate(start.getDate() + 1);
  const end = new Date(start);
  const freq = bill.frequency || "monthly";
  if(freq === "monthly") end.setMonth(end.getMonth() + 1);
  else if(freq === "quarterly") end.setMonth(end.getMonth() + 3);
  else if(freq === "halfyearly") end.setMonth(end.getMonth() + 6);
  else if(freq === "annual" || freq === "yearly") end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1);
  return { periodStart: start.toISOString().split("T")[0], periodEnd: end.toISOString().split("T")[0] };
};
const normalizeIncomeTypeValue = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/&/g," and ")
  .replace(/[^\w\s-]/g,"")
  .replace(/[\s-]+/g,"_")
  .replace(/^_+|_+$/g,"");
const normalizeMeasureUnitValue = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/\./g, "")
  .replace(/\s+/g, "_");
const formatMeasureUnitLabel = value => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, ch=>ch.toUpperCase());
const normalizeMeasureUnits = stored => {
  const fromStored = Array.isArray(stored) ? stored : [];
  return Array.from(new Set([...DEFAULT_MEASURE_UNITS, ...fromStored]
    .map(normalizeMeasureUnitValue)
    .filter(Boolean)));
};
const normalizeItemCatalog = stored => {
  const list = Array.isArray(stored) ? stored : [];
  return list
    .map(item=>({
      id:item?.id || genId(),
      name:String(item?.name || "").trim(),
      unit:normalizeMeasureUnitValue(item?.unit || "nos") || "nos",
      catId:item?.catId || "",
      subId:item?.subId || "",
    }))
    .filter(item=>item.name);
};
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
const normalizeLiabilityTypes = stored => {
  const extras = [];
  const seenIds = new Set(LIABILITY_TYPES.map(item=>item.id));
  const seenNames = new Set(LIABILITY_TYPES.map(item=>normalizeIncomeTypeValue(item.name)));
  (Array.isArray(stored) ? stored : []).forEach((entry, index) => {
    const rawName = typeof entry === "string" ? entry : entry?.name;
    const name = String(rawName ?? "").trim();
    const normalizedName = normalizeIncomeTypeValue(name);
    if(!name || !normalizedName || seenNames.has(normalizedName)) return;
    let id = normalizedName || `liability_${index+1}`;
    while(seenIds.has(id)) id = `${normalizedName}_${index+1}`;
    seenIds.add(id);
    seenNames.add(normalizedName);
    extras.push({
      id,
      name,
      icon: typeof entry === "object" && entry?.icon ? entry.icon : "🧾",
      color: typeof entry === "object" && entry?.color ? entry.color : "#ef4444",
      custom:true,
    });
  });
  return extras;
};
const defaultAccountTypeBucket = baseType => baseType==="cc" ? "liability" : "cash";
const inferAccountBucket = (value, fallback = "cash") => {
  const text = String(value ?? "").toLowerCase();
  if(/ppf|nps|pf\b|provident|retirement|fd\b|fixed deposit|term deposit|demat|broker|investment|mutual fund|sip\b|stocks?|equity|gold|crypto|real estate|property/.test(text)) return "investment";
  return fallback;
};
const accountBucketLabel = bucket => bucket==="investment" ? "Investment / Wealth" : bucket==="liability" ? "Liability" : "Cash / Spending";
const normalizeAccountTypes = (stored, extraBehaviors=[]) => {
  const allBaseBehaviors = [...ACC_TYPES, ...(Array.isArray(extraBehaviors) ? extraBehaviors : [])];
  const rawList = Array.isArray(stored) ? stored : [];
  const overrides = new Map(
    rawList
      .filter(entry=>entry && typeof entry === "object" && entry.id)
      .map(entry=>[String(entry.id), entry])
  );
  const defaults = allBaseBehaviors.map(item=>{
    const override = overrides.get(item.id);
    return {
      ...item,
      label:override?.label || item.label,
      icon:override?.icon || item.icon,
      baseType:item.id,
      bucket:override?.bucket || defaultAccountTypeBucket(item.baseType||item.id),
      custom:false,
    };
  });
  const seenIds = new Set(defaults.map(item=>item.id));
  const extras = [];
  rawList.forEach((entry, index) => {
    if(!entry || typeof entry !== "object") return;
    const label = String(entry.label ?? entry.name ?? "").trim();
    if(!label) return;
    const requestedId = String(entry.id ?? "").trim();
    if(requestedId && seenIds.has(requestedId)) return;
    const baseType = allBaseBehaviors.some(item=>item.id===entry.baseType) ? entry.baseType : "bank";
    let id = requestedId || normalizeIncomeTypeValue(label) || `account_type_${index+1}`;
    while(seenIds.has(id)) id = `${normalizeIncomeTypeValue(label) || "account_type"}_${index+1}`;
    seenIds.add(id);
    const baseMeta = allBaseBehaviors.find(item=>item.id===baseType) || ACC_TYPES[0];
    extras.push({
      id,
      label,
      icon:entry.icon || baseMeta.icon,
      baseType,
      bucket:entry.bucket || inferAccountBucket(label, defaultAccountTypeBucket(baseType)),
      custom:true,
    });
  });
  return [...defaults, ...extras];
};
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
const getInvestmentBudgetMeta = type => {
  if(type==="mf") return { catId:"financial", subId:"fi1" };
  if(type==="stocks" || type==="crypto" || type==="gold") return { catId:"financial", subId:"fi2" };
  if(type==="ppf" || type==="fd" || type==="realestate") return { catId:"financial", subId:"fi3" };
  return { catId:"financial", subId:null };
};
const getInvestmentMetricConfig = type => {
  if(type==="mf") return { show:true, label:"NAV", placeholder:"e.g. 23.45", hint:"Track the latest NAV per unit for this fund.", shortLabel:"NAV" };
  if(type==="stocks") return { show:true, label:"Units", placeholder:"e.g. 10", hint:"Track how many shares or units were bought.", shortLabel:"Units" };
  if(type==="gold") return { show:true, label:"Weight (grams)", placeholder:"e.g. 12.5", hint:"Track gold weight in grams.", shortLabel:"Gold" };
  if(type==="crypto") return { show:true, label:"Units", placeholder:"e.g. 0.015", hint:"Track the number of coins or tokens.", shortLabel:"Units" };
  if(type==="ppf") return { show:false, label:"", placeholder:"", hint:"PPF / NPS is tracked by contribution amount; no NAV is required. If you created a PPF account, record the money movement as a Transfer into that account.", shortLabel:"" };
  if(type==="fd") return { show:false, label:"", placeholder:"", hint:"FD is tracked by deposit value; no NAV is required.", shortLabel:"" };
  if(type==="realestate") return { show:false, label:"", placeholder:"", hint:"Real estate is tracked by current value; no NAV is required.", shortLabel:"" };
  return { show:false, label:"", placeholder:"", hint:"This holding is tracked by amount or current value.", shortLabel:"" };
};
const formatInvestmentMetric = (type, rawValue) => {
  const value = Number(rawValue || 0);
  if(!value) return "";
  if(type==="mf") return `NAV ${fmt(value)}`;
  if(type==="gold") return `${fmt(value)} g`;
  if(type==="stocks" || type==="crypto") return `${fmt(value)} units`;
  const config = getInvestmentMetricConfig(type);
  return config.show && config.shortLabel ? `${config.shortLabel} ${fmt(value)}` : "";
};
const getInvestmentGroupMeta = inv => {
  const type = String(inv?.type || "custom");
  const folioNo = String(inv?.folioNo || "").trim();
  const name = String(inv?.name || "Investment").trim() || "Investment";
  if(type === "mf" && folioNo) return { key:`${type}|folio|${folioNo.toLowerCase()}`, folioNo, primaryName:name };
  const normalizedName = normalizeVendorText(name);
  if(normalizedName) return { key:`${type}|name|${normalizedName}`, folioNo:"", primaryName:name };
  return { key:`${type}|single|${String(inv?.linkedInvestmentId || inv?.id || name)}`, folioNo:"", primaryName:name };
};
const inferInvestmentTypeId = value => {
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
const getTxnCategoryIds = txn => {
  if(txn?.type==="investment") return [];
  if(Array.isArray(txn?.catIds) && txn.catIds.length) return txn.catIds.filter(Boolean);
  if(txn?.catId) return [txn.catId];
  return [];
};
const getTxnSubIds = txn => {
  if(txn?.type==="investment") return [];
  if(Array.isArray(txn?.subIds) && txn.subIds.length) return txn.subIds.filter(Boolean);
  if(txn?.subId) return [txn.subId];
  return [];
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
const getMonthBounds = (monthKey = todayStr().slice(0,7)) => {
  const [year, month] = String(monthKey || todayStr().slice(0,7)).split("-").map(Number);
  const safeYear = year || new Date().getFullYear();
  const safeMonth = month || (new Date().getMonth() + 1);
  const start = `${safeYear}-${String(safeMonth).padStart(2,"0")}-01`;
  const end = `${safeYear}-${String(safeMonth).padStart(2,"0")}-${String(new Date(safeYear, safeMonth, 0).getDate()).padStart(2,"0")}`;
  return { start, end };
};
const getPreviousMonthKey = (monthKey = todayStr().slice(0,7)) => {
  const [year, month] = String(monthKey || todayStr().slice(0,7)).split("-").map(Number);
  const ref = new Date((year || new Date().getFullYear()), (month || 1) - 2, 1);
  return `${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,"0")}`;
};
const MONTH_NAME_MAP = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12 };
const toFourDigitYear = year => {
  const num = Number(year);
  if(!Number.isFinite(num)) return null;
  if(num >= 100) return num;
  return num >= 70 ? 1900 + num : 2000 + num;
};
const buildIsoDate = (year, month, day) => {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if(!y || !m || !d || m < 1 || m > 12) return "";
  const maxDay = new Date(y, m, 0).getDate();
  if(d < 1 || d > maxDay) return "";
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
};
const normalizeToIsoDate = value => {
  if(!value) return "";
  if(value instanceof Date && !Number.isNaN(value.getTime())){
    return buildIsoDate(value.getFullYear(), value.getMonth()+1, value.getDate());
  }
  const cleaned = String(value)
    .trim()
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");
  if(!cleaned) return "";

  let match = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if(match) return buildIsoDate(match[1], match[2], match[3]);

  match = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if(match){
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = toFourDigitYear(match[3]);
    if(!year) return "";
    if(first > 12 && second <= 12) return buildIsoDate(year, second, first);
    if(second > 12 && first <= 12) return buildIsoDate(year, first, second);
    return buildIsoDate(year, second, first); // default DD/MM for ambiguous numeric dates
  }

  match = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{2,4})$/);
  if(match){
    const month = MONTH_NAME_MAP[match[1].slice(0,4).toLowerCase()] || MONTH_NAME_MAP[match[1].slice(0,3).toLowerCase()];
    const year = toFourDigitYear(match[3]);
    return month && year ? buildIsoDate(year, month, match[2]) : "";
  }

  match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
  if(match){
    const month = MONTH_NAME_MAP[match[2].slice(0,4).toLowerCase()] || MONTH_NAME_MAP[match[2].slice(0,3).toLowerCase()];
    const year = toFourDigitYear(match[3]);
    return month && year ? buildIsoDate(year, month, match[1]) : "";
  }

  const fallback = new Date(cleaned);
  if(!Number.isNaN(fallback.getTime())){
    return buildIsoDate(fallback.getFullYear(), fallback.getMonth()+1, fallback.getDate());
  }
  return "";
};
const extractDateFromText = text => {
  const patterns = [
    /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/,
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,)?\s+\d{2,4}\b/i,
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*(?:\s*,)?\s+\d{2,4}\b/i,
  ];
  for(const pattern of patterns){
    const match = String(text || "").match(pattern);
    const iso = normalizeToIsoDate(match?.[0] || "");
    if(iso) return iso;
  }
  return "";
};
const toDateOnly = value => {
  const iso = normalizeToIsoDate(value);
  if(!iso) return null;
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y, m-1, d, 12, 0, 0, 0);
};
const formatShortDate = value => {
  const d = toDateOnly(value);
  if(!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-IN", { month:"short" });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};
const getRecordedSortValue = item => {
  if(!item) return 0;
  const activityText = item.date || item.paidDate || item.createdDate || item.dueDate || "";
  const activityTime = toDateOnly(activityText)?.getTime() || 0;
  if(Number.isFinite(activityTime) && activityTime > 0) return activityTime;
  const updatedAt = Number(item.updatedAt || 0);
  if(Number.isFinite(updatedAt) && updatedAt > 0) return updatedAt;
  const createdAt = Number(item.createdAt || 0);
  if(Number.isFinite(createdAt) && createdAt > 0) return createdAt;
  const numericId = Number(item.id || 0);
  if(Number.isFinite(numericId) && numericId > 0) return numericId;
  return 0;
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
const txnHasPerson = (txn, personId) => {
  if(!txn || !personId || personId === "all") return true;
  if(String(txn.forPerson||"")===String(personId)) return true;
  if(String(txn.fromPersonId||"")===String(personId)) return true;
  if(String(txn.toPersonId||"")===String(personId)) return true;
  return Object.keys(txn.people||{}).some(pid=>String(pid)===String(personId));
};
const nearlyEqualMoney = (a,b) => Math.abs(Number(a||0) - Number(b||0)) < 0.01;
const dateAtDay = (year, monthIndex, day) => {
  const safeDay = Math.max(1, Number(day)||1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(safeDay, lastDay), 12, 0, 0, 0);
};
const getNextDueDate = (startDate, dueDay) => {
  const base = toDateOnly(startDate) || new Date();
  const safeDay = Math.max(1, Math.min(31, parseInt(dueDay || base.getDate(), 10) || base.getDate()));
  let candidate = dateAtDay(base.getFullYear(), base.getMonth(), safeDay);
  if(candidate < base) candidate = dateAtDay(base.getFullYear(), base.getMonth() + 1, safeDay);
  return candidate.toISOString().split("T")[0];
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
const accIcon = value => {
  if(value && typeof value === "object" && value.typeIcon) return value.typeIcon;
  const t = typeof value === "object" ? value?.type : value;
  return t==="bank"?"🏦":t==="cc"?"💳":t==="debit"?"🏧":t==="upi"?"📱":"💵";
};
const accLabel = value => {
  if(value && typeof value === "object" && value.typeLabel) return value.typeLabel;
  const t = typeof value === "object" ? value?.type : value;
  return t==="bank"?"Bank Account":t==="cc"?"Credit Card":t==="debit"?"Debit Card":t==="upi"?"UPI":"Cash";
};
const isInvestmentAccount = account => {
  if(!account || account.type==="cc") return false;
  if(account.typeBucket==="investment" || account.bucket==="investment" || account.accountTypeBucket==="investment") return true;
  const fallback = defaultAccountTypeBucket(account.type || account.baseType || "bank");
  return inferAccountBucket(`${account.typeLabel||account.label||""} ${account.name||""} ${account.accountTypeId||account.baseType||""}`, fallback) === "investment";
};
const txnColor = (txnOrType,T) => {
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
const txnLabel = txnOrType => {
  const type = typeof txnOrType === "string" ? txnOrType : txnOrType?.type;
  const isRefund = typeof txnOrType === "object" && txnOrType?.type === "settlement_in" && txnOrType?.isRefund;
  if(isRefund) return "Refund";
  const hasSettlementLinks = typeof txnOrType === "object" && (txnOrType?.settlementLinks?.length||0)>0;
  if(type==="settlement_in") return hasSettlementLinks ? "Repayment" : "Reimbursement";
  return type==="income"?"Income":type==="transfer"?"Transfer":type==="cc_payment"?"CC Payment":type==="cc_emi"?"CC EMI":type==="settlement_out"?"Settlement Out":type==="investment"?"Investment":"Expense";
};
const txnEmoji = txnOrType => {
  const type = typeof txnOrType === "string" ? txnOrType : txnOrType?.type;
  const isRefund = typeof txnOrType === "object" && txnOrType?.type === "settlement_in" && txnOrType?.isRefund;
  if(isRefund) return "↩️";
  return type==="income"?"💚":type==="transfer"?"🔄":type==="cc_payment"?"💳":type==="cc_emi"?"💳":type==="settlement_in"?"💼":type==="settlement_out"?"📤":type==="investment"?"💹":"💸";
};
const getTxnDisplayTitle = txn => {
  if(!txn) return "—";
  const desc = String(txn.desc || "").trim();
  const merchant = String(txn.merchant || "").trim();
  const note = String(txn.note || "").trim();
  if(txn.type === "cc_payment" || txn.type === "transfer") return desc || note || merchant || "—";
  return desc || merchant || note || "—";
};
const extractSmsLast4s = txt => {
  const text = String(txt||"");
  const hits = [];
  const patterns = [
    /(?:a\/c|acct|account|card|ending(?:\s+with)?|xx|x{2,}|\*{2,}|last\s*4)[^\d]{0,12}(\d{4})/ig,
    /(?:xx|x{2,}|\*{2,})\s*(\d{4})/ig,
  ];
  patterns.forEach(rx=>{
    for(const match of text.matchAll(rx)){
      if(match[1]) hits.push(match[1]);
    }
  });
  return Array.from(new Set(hits));
};
const detectSmsDirection = txt => {
  const text = String(txt||"").toLowerCase();
  if(/\b(credited|received|deposited|refund(?:ed)?|reversal|cashback|salary)\b/.test(text)) return "credit";
  if(/\b(debited|spent|paid|purchase|withdrawn|sent|dr)\b/.test(text)) return "debit";
  return "";
};
const findSmsAccountMatches = (txt, accounts=[]) => {
  const text = String(txt||"");
  const lower = text.toLowerCase();
  const last4s = extractSmsLast4s(text);
  const upiHandles = Array.from(new Set([...text.matchAll(/\b[a-z0-9._-]{2,}@[a-z][a-z0-9.-]{1,}\b/ig)].map(m=>m[0].toLowerCase())));
  return accounts
    .map(account=>{
      let score = 0;
      const accLast4 = String(account?.last4||"").trim();
      const accNameTokens = String(account?.name||"").toLowerCase().split(/\s+/).filter(token=>token.length>2);
      if(accLast4 && last4s.includes(accLast4)) score += 10;
      if(account?.handle){
        const handle = String(account.handle).toLowerCase();
        if(upiHandles.some(item=>item.includes(handle) || handle.includes(item))) score += 8;
      }
      if(accNameTokens.some(token=>lower.includes(token))) score += 2;
      if(account?.type==="cc" && /\b(credit card|visa|mastercard|rupay|amex|card)\b/i.test(text)) score += 3;
      if(account?.type==="debit" && /\b(debit card|atm card)\b/i.test(text)) score += 3;
      if(account?.type==="upi" && /\b(upi|vpa)\b/i.test(text)) score += 3;
      if(account?.type==="bank" && /\b(a\/c|account|acct|savings|current)\b/i.test(text)) score += 1;
      return score>0 ? { account, score } : null;
    })
    .filter(Boolean)
    .sort((a,b)=>b.score-a.score || String(a.account?.name||"").localeCompare(String(b.account?.name||"")));
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
const normalizeAccounts = stored => (Array.isArray(stored) && stored.length ? stored : DEFAULT_ACCOUNTS).map(acc=>{
  const baseType = ACC_TYPES.some(item=>item.id===acc?.type) ? acc.type : "bank";
  const typeMeta = normalizeAccountTypes([]).find(item=>item.id===String(acc?.accountTypeId || baseType)) || ACC_TYPES.find(item=>item.id===baseType) || ACC_TYPES[0];
  const typeLabel = acc?.typeLabel || typeMeta.label || accLabel(baseType);
  const typeBucket = acc?.typeBucket || typeMeta.bucket || inferAccountBucket(`${typeLabel} ${acc?.name||""} ${acc?.accountTypeId || baseType}`, defaultAccountTypeBucket(baseType));
  return {
    ...acc,
    type:baseType,
    accountTypeId:acc?.accountTypeId || typeMeta.id || baseType,
    typeLabel,
    typeIcon:acc?.typeIcon || typeMeta.icon || accIcon(baseType),
    typeBucket,
    openingBalance:Number(acc?.openingBalance||0),
    openingBalanceDate:acc?.openingBalanceDate||"",
  };
});
const normalizePeople = stored => {
  const list = Array.isArray(stored) ? stored : [];
  return list.find(p=>p.id==="__me__") ? list : [ME, ...list];
};
const normalizeTxns = stored => {
  const list = Array.isArray(stored) ? stored : [];
  const normalizeTxnCatId = value => {
    const raw = String(value ?? "").trim();
    if(!raw) return "";
    const cleaned = raw.replace(/!+$/g, "");
    return CAT_MAP[cleaned.toLowerCase()] || CAT_MAP[cleaned] || cleaned;
  };
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
          groupCollectiveAmount: (trackingMode==="split"||trackingMode==="allocate") ? Number(normalizedTxn.groupCollectiveAmount||0) : 0,
        }
      : normalizedTxn;
    const normalizedCatIds = (Array.isArray(preparedTxn.catIds) && preparedTxn.catIds.length
      ? preparedTxn.catIds
      : (preparedTxn.catId ? [preparedTxn.catId] : []))
      .map(normalizeTxnCatId)
      .filter(Boolean);
    const normalizedCatId = normalizeTxnCatId(preparedTxn.catId || normalizedCatIds[0] || "") || null;
    return {
      ...preparedTxn,
      catId: normalizedCatId,
      catIds: normalizedCatIds.length ? normalizedCatIds : (normalizedCatId ? [normalizedCatId] : []),
    };
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

// ─── SECURITY ────────────────────────────────────────────────────────────────
async function hashPin(pin) {
  const data = new TextEncoder().encode(pin + "|arth_v1");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

// ─── PIN SCREEN ───────────────────────────────────────────────────────────────
function PinScreen({ onUnlock, isSetup, onCancel }) {
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
  // B16: Physical keyboard support
  React.useEffect(() => {
    const handler = e => {
      if(e.key >= "0" && e.key <= "9") handleKey(e.key);
      else if(e.key === "Backspace" || e.key === "Delete") handleKey("del");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pin, confirm, step]);
  const cur = step==="confirm"?confirm:pin;
  const hiddenInputRef = React.useRef(null);
  React.useEffect(() => { hiddenInputRef.current?.focus(); }, [cur.length]);
  return (
    <div style={{minHeight:"100vh",background:"#08080f",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"Nunito,sans-serif"}}>
      {/* B15: Hidden input keeps mobile keyboard context */}
      <input ref={hiddenInputRef} type="tel" inputMode="numeric" pattern="[0-9]*" style={{position:"absolute",opacity:0,width:1,height:1,pointerEvents:"none"}} onChange={e=>{ const v=e.target.value.replace(/\D/g,""); if(v) { handleKey(v[v.length-1]); e.target.value=""; } }} onKeyDown={e=>{ if(e.key==="Backspace") handleKey("del"); }}/>
      <div style={{fontSize:52,marginBottom:12,color:"#f0a500",fontWeight:900,fontFamily:"Nunito,sans-serif"}}>₹</div>
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
      {onCancel&&<button onClick={onCancel} style={{marginTop:18,background:"none",border:"1px solid #2a2a3a",borderRadius:12,padding:"10px 22px",cursor:"pointer",fontSize:13,fontWeight:700,color:"#5a5a7a",fontFamily:"Nunito,sans-serif"}}>Cancel</button>}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
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
  const idleTimer = useRef(null);
  const idleWarnTimer = useRef(null);
  const countdownInterval = useRef(null);
  const resetIdleRef = useRef(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(120);
  // PIN lockout state — must be declared before any early returns (Rules of Hooks)
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinLockedUntil, setPinLockedUntil] = useState(()=>Number(sessionStorage.getItem("arth_pin_locked_until")||0));
  const pinIsLocked = pinLockedUntil > Date.now();
  const pinLockMinsLeft = pinIsLocked ? Math.ceil((pinLockedUntil-Date.now())/60000) : 0;
  const lock = useCallback(()=>{ setUnlocked(false); setShowIdleWarning(false); setIdleCountdown(120); },[]);

  // Two-phase idle timer: warn at 5 minutes, lock 2 minutes later (7 min total)
  useEffect(()=>{
    if(!unlocked) return;
    const WARN_MS = 5 * 60_000;   // 5 minutes before warning
    const LOCK_MS = 2 * 60_000;   // 2 more minutes to respond
    const clearAll = ()=>{ clearTimeout(idleTimer.current); clearTimeout(idleWarnTimer.current); clearInterval(countdownInterval.current); };
    const reset = ()=>{
      clearAll();
      setShowIdleWarning(false);
      setIdleCountdown(120);
      idleWarnTimer.current = setTimeout(()=>{
        setShowIdleWarning(true);
        let cd = 120;
        setIdleCountdown(cd);
        countdownInterval.current = setInterval(()=>{ cd--; setIdleCountdown(cd); if(cd<=0) clearInterval(countdownInterval.current); }, 1000);
        idleTimer.current = setTimeout(lock, LOCK_MS);
      }, WARN_MS);
    };
    resetIdleRef.current = reset;
    const events = ["mousemove","keydown","touchstart","touchend","click","scroll","pointerdown"];
    events.forEach(e=>window.addEventListener(e,reset,{passive:true}));
    reset();
    return ()=>{ events.forEach(e=>window.removeEventListener(e,reset)); clearAll(); resetIdleRef.current=null; };
  },[unlocked,lock]);

  // Pause timers when app goes to background; reset fresh when returning
  useEffect(()=>{
    if(!unlocked) return;
    const clearAll = ()=>{ clearTimeout(idleTimer.current); clearTimeout(idleWarnTimer.current); clearInterval(countdownInterval.current); };
    const handle = ()=>{
      if(document.visibilityState==="hidden"){
        // Pause all timers — don't lock while user is in another app
        clearAll();
        setShowIdleWarning(false);
      } else if(document.visibilityState==="visible"){
        // Give a fresh 60s when returning
        resetIdleRef.current?.();
      }
    };
    document.addEventListener("visibilitychange",handle);
    return ()=>document.removeEventListener("visibilitychange",handle);
  },[unlocked]);

  if(!appPin) return <PinScreen isSetup onUnlock={async pin=>{
    const hash = await hashPin(pin);
    localStorage.setItem("arth_pin",hash);
    setAppPin(hash);
    setUnlocked(true);
  }}/>;

  if(!unlocked) return (
    <div style={{ minHeight:"100vh",background:"#08080f",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24 }}>
      {pinIsLocked ? (
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:48,marginBottom:12 }}>🔒</div>
          <div style={{ color:"#f0a500",fontSize:18,fontWeight:900,marginBottom:8 }}>Too many attempts</div>
          <div style={{ color:"rgba(255,255,255,0.5)",fontSize:13 }}>Try again in {pinLockMinsLeft} minute{pinLockMinsLeft!==1?"s":""}</div>
        </div>
      ) : (
        <PinScreen isSetup={false} onUnlock={async pin=>{
          if(appPin.length<=6){
            if(String(pin)===String(appPin)){
              const hash = await hashPin(pin);
              localStorage.setItem("arth_pin",hash);
              setAppPin(hash);
              setUnlocked(true);
              setPinAttempts(0);
            } else {
              const na = pinAttempts+1;
              setPinAttempts(na);
              if(na>=5){ const lu=Date.now()+30*60*1000; setPinLockedUntil(lu); sessionStorage.setItem("arth_pin_locked_until",String(lu)); setPinAttempts(0); }
            }
          } else {
            const hash = await hashPin(pin);
            if(hash===appPin){ setUnlocked(true); setPinAttempts(0); }
            else {
              const na = pinAttempts+1;
              setPinAttempts(na);
              if(na>=5){ const lu=Date.now()+30*60*1000; setPinLockedUntil(lu); sessionStorage.setItem("arth_pin_locked_until",String(lu)); setPinAttempts(0); }
            }
          }
        }}/>
      )}
    </div>
  );

  return <>
    <ErrorBoundary><AppContent onLock={lock}/></ErrorBoundary>
    {showIdleWarning && (
      <div onClick={()=>resetIdleRef.current?.()} style={{position:"fixed",bottom:0,left:0,right:0,zIndex:99999,background:"#1a1a1aee",backdropFilter:"blur(8px)",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"2px solid #f0a500",cursor:"pointer"}}>
        <span style={{color:"#fff",fontSize:13,fontWeight:700}}>🔒 Locking in {idleCountdown}s due to inactivity</span>
        <button onClick={e=>{e.stopPropagation();resetIdleRef.current?.();}} style={{background:"#f0a500",color:"#000",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"Nunito,sans-serif"}}>Stay active</button>
      </div>
    )}
  </>;
}

// ─── APP ──────────────────────────────────────────────────────────────────────
function AppContent({ onLock }) {
  const [dark, setDark] = useState(()=>JSON.parse(localStorage.getItem("arth_dark")??"true"));
  const [autoDetectExpenseCategory, setAutoDetectExpenseCategory] = useState(()=>JSON.parse(localStorage.getItem("arth_auto_category")??"true"));
  const [workTripMode, setWorkTripMode] = useState(()=>JSON.parse(localStorage.getItem("arth_work_trip")??"false"));
  const T = dark?DARK:LIGHT;
  useEffect(()=>localStorage.setItem("arth_dark",JSON.stringify(dark)),[dark]);
  useEffect(()=>localStorage.setItem("arth_auto_category",JSON.stringify(autoDetectExpenseCategory)),[autoDetectExpenseCategory]);
  useEffect(()=>localStorage.setItem("arth_work_trip",JSON.stringify(workTripMode)),[workTripMode]);
  // Request persistent storage so browser never evicts app data under disk pressure
  useEffect(()=>{ navigator.storage?.persist?.(); },[]);

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("home");
  const [viewMonth, setViewMonth] = useState(()=>{ const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });
  const [cats, setCats] = useState(()=>normalizeCats(JSON.parse(localStorage.getItem("arth_cats")||"null")));
  const [customBaseBehaviors, setCustomBaseBehaviors] = useState(()=>JSON.parse(localStorage.getItem("arth_custom_base_behaviors")||"[]"));
  const [accountTypes, setAccountTypes] = useState(()=>normalizeAccountTypes(JSON.parse(localStorage.getItem("arth_account_types")||"null")));
  const [incomeTypes, setIncomeTypes] = useState(()=>normalizeIncomeTypes(JSON.parse(localStorage.getItem("arth_income_types")||"null")));
  const [customLiabilityTypes, setCustomLiabilityTypes] = useState(()=>normalizeLiabilityTypes(JSON.parse(localStorage.getItem("arth_liability_types")||"null")));
  const [accounts, setAccounts] = useState(()=>normalizeAccounts(JSON.parse(localStorage.getItem("arth_accounts")||"null")));
  const [balanceCheckpoints, setBalanceCheckpoints] = useState(()=>JSON.parse(localStorage.getItem("arth_checkpoints")||"{}"));
  const [people, setPeople] = useState(()=>normalizePeople(JSON.parse(localStorage.getItem("arth_people")||"[]")));
  const [groups, setGroups] = useState(()=>JSON.parse(localStorage.getItem("arth_groups")||"[]"));
  const [measureUnits, setMeasureUnits] = useState(()=>normalizeMeasureUnits(JSON.parse(localStorage.getItem("arth_measure_units")||"null")));
  const [itemCatalog, setItemCatalog] = useState(()=>normalizeItemCatalog(JSON.parse(localStorage.getItem("arth_item_catalog")||"[]")));
  const [txns, setTxns] = useState(()=>normalizeTxns(JSON.parse(localStorage.getItem("arth_txns")||"[]")));
  const [investments, setInvestments] = useState(()=>JSON.parse(localStorage.getItem("arth_investments")||"[]"));
  const [recurringSchedules, setRecurringSchedules] = useState(()=>JSON.parse(localStorage.getItem("arth_recurring")||"[]"));
  const [skippedInvestmentMonths, setSkippedInvestmentMonths] = useState(()=>JSON.parse(localStorage.getItem("arth_skipped_investments")||"[]"));
  const [gifts, setGifts] = useState(()=>JSON.parse(localStorage.getItem("arth_gifts")||"[]"));
  const [showAddGift, setShowAddGift] = useState(false);
  const [giftForPersonId, setGiftForPersonId] = useState(null);
  const [giftFilter, setGiftFilter] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);
  const [editTxn, setEditTxn] = useState(null);
  const [defaultGroupId, setDefaultGroupId] = useState(()=>localStorage.getItem("arth_default_group")||"");
  const [editingRecurring, setEditingRecurring] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vType, setVType] = useState("car");
  const [vNumber, setVNumber] = useState("");
  const [vName, setVName] = useState("");
  const [vColor, setVColor] = useState(PALETTE[2]);
  const [bills, setBills] = useState(()=>JSON.parse(localStorage.getItem("arth_bills")||"[]"));
  const [billerAccounts, setBillerAccounts] = useState(()=>JSON.parse(localStorage.getItem("arth_biller_accounts")||"[]"));
  const [billers, setBillers] = useState(()=>JSON.parse(localStorage.getItem("arth_billers")||"[]"));
  const [memberships, setMemberships] = useState(()=>JSON.parse(localStorage.getItem("arth_memberships")||"[]"));
  const [feePayments, setFeePayments] = useState(()=>JSON.parse(localStorage.getItem("arth_fee_payments")||"[]"));
  const [showAddMembership, setShowAddMembership] = useState(false);
  const [editingMembership, setEditingMembership] = useState(null);
  const [showAddFeePayment, setShowAddFeePayment] = useState(false);
  const [activeBillerForAction, setActiveBillerForAction] = useState(null);
  const [attachExpensesFor, setAttachExpensesFor] = useState(null); // holds the biller account while picking old unlinked expenses to attach
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
  const askConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });
  const [categoryAccountsView, setCategoryAccountsView] = useState(null); // holds biller "type" string when viewing its accounts list
  const [showAddBillerAccount, setShowAddBillerAccount] = useState(false);
  const [editingBillerAccount, setEditingBillerAccount] = useState(null);
  const [billSearch, setBillSearch] = useState("");
  const [preselectedBillerType, setPreselectedBillerType] = useState("");
  const [preselectedBillerProvider, setPreselectedBillerProvider] = useState("");
  const [preselectedBillerId, setPreselectedBillerId] = useState("");
  const [showAddBillerModal, setShowAddBillerModal] = useState(false);
  const [addBillerPresetType, setAddBillerPresetType] = useState("");
  const [activeBillerShell, setActiveBillerShell] = useState(null);
  const [liabilities, setLiabilities] = useState(()=>JSON.parse(localStorage.getItem("arth_liabilities")||"[]"));
  const [trackedAssets, setTrackedAssets] = useState(()=>JSON.parse(localStorage.getItem("arth_assets")||"[]"));
  const [vehicles, setVehicles] = useState(()=>JSON.parse(localStorage.getItem("arth_vehicles")||"[]"));
  const [loans, setLoans] = useState(()=>normalizeLoans(JSON.parse(localStorage.getItem("arth_loans")||"[]")));
  const [ccEmiPlans, setCcEmiPlans] = useState(()=>JSON.parse(localStorage.getItem("arth_cc_emi_plans")||"[]"));
  const currentFYStartYear = new Date().getMonth()>=3 ? new Date().getFullYear() : new Date().getFullYear()-1;
  const [annualBudget, setAnnualBudget] = useState(()=>Number(localStorage.getItem("arth_annual_budget")||600000));
  const [perPersonBudgets, setPerPersonBudgets] = useState(()=>JSON.parse(localStorage.getItem("arth_person_budgets")||"{}"));
  const [budgetCarryForward, setBudgetCarryForward] = useState(()=>JSON.parse(localStorage.getItem("arth_budget_carry")||"false"));
  const [lastFYTarget, setLastFYTarget] = useState(()=>Number(localStorage.getItem("arth_last_fy_target")||0));
  const [selectedBudgetFY, setSelectedBudgetFY] = useState(currentFYStartYear);
  const [monthOverrides, setMonthOverrides] = useState(()=>JSON.parse(localStorage.getItem("arth_month_overrides")||"{}"));
  const [monthBudget] = useState(()=>Number(localStorage.getItem("arth_budget")||50000));

  useEffect(()=>localStorage.setItem("arth_cats",JSON.stringify(cats)),[cats]);
  useEffect(()=>localStorage.setItem("arth_account_types",JSON.stringify(accountTypes)),[accountTypes]);
  useEffect(()=>localStorage.setItem("arth_income_types",JSON.stringify(incomeTypes)),[incomeTypes]);
  useEffect(()=>localStorage.setItem("arth_liability_types",JSON.stringify(customLiabilityTypes)),[customLiabilityTypes]);
  useEffect(()=>localStorage.setItem("arth_accounts",JSON.stringify(accounts)),[accounts]);
  useEffect(()=>localStorage.setItem("arth_checkpoints",JSON.stringify(balanceCheckpoints)),[balanceCheckpoints]);
  useEffect(()=>localStorage.setItem("arth_people",JSON.stringify(people)),[people]);
  useEffect(()=>localStorage.setItem("arth_groups",JSON.stringify(groups)),[groups]);
  useEffect(()=>localStorage.setItem("arth_custom_base_behaviors",JSON.stringify(customBaseBehaviors)),[customBaseBehaviors]);
  useEffect(()=>localStorage.setItem("arth_measure_units",JSON.stringify(measureUnits)),[measureUnits]);
  useEffect(()=>localStorage.setItem("arth_item_catalog",JSON.stringify(itemCatalog)),[itemCatalog]);
  useEffect(()=>localStorage.setItem("arth_txns",JSON.stringify(txns)),[txns]);
  useEffect(()=>localStorage.setItem("arth_investments",JSON.stringify(investments)),[investments]);
  useEffect(()=>localStorage.setItem("arth_recurring",JSON.stringify(recurringSchedules)),[recurringSchedules]);
  useEffect(()=>localStorage.setItem("arth_skipped_investments",JSON.stringify(skippedInvestmentMonths)),[skippedInvestmentMonths]);
  useEffect(()=>localStorage.setItem("arth_gifts",JSON.stringify(gifts)),[gifts]);
  useEffect(()=>localStorage.setItem("arth_budget",monthBudget),[monthBudget]);
  useEffect(()=>localStorage.setItem("arth_bills",JSON.stringify(bills)),[bills]);
  useEffect(()=>localStorage.setItem("arth_biller_accounts",JSON.stringify(billerAccounts)),[billerAccounts]);
  useEffect(()=>localStorage.setItem("arth_billers",JSON.stringify(billers)),[billers]);
  // One-time migration: existing biller accounts predate the parent "Biller" concept and don't have a
  // billerId yet. Group them by type+provider (same key as the account-list provider grouping) and
  // create a parent shell for each group, linking the existing accounts to it. Idempotent — only touches
  // accounts that don't already have a billerId, so it's safe to leave running on every load.
  useEffect(()=>{
    const unmigrated = billerAccounts.filter(ba=>!ba.billerId);
    if(unmigrated.length===0) return;
    const groups = [];
    unmigrated.forEach(ba=>{
      const key = `${ba.type}||${(ba.provider||"").trim().toLowerCase()}`;
      let g = groups.find(x=>x.key===key);
      if(!g){ g = { key, type:ba.type, provider:(ba.provider||"").trim(), ids:[] }; groups.push(g); }
      g.ids.push(ba.id);
    });
    const newBillers = groups.map(g=>({ id:genId(), name:g.provider||g.type, type:g.type, provider:g.provider, createdAt:Date.now() }));
    setBillers(prev=>[...prev, ...newBillers]);
    setBillerAccounts(prev=>prev.map(ba=>{
      if(ba.billerId) return ba;
      const key = `${ba.type}||${(ba.provider||"").trim().toLowerCase()}`;
      const g = groups.find(x=>x.key===key);
      const nb = newBillers[groups.indexOf(g)];
      return nb ? {...ba, billerId:nb.id} : ba;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>localStorage.setItem("arth_memberships",JSON.stringify(memberships)),[memberships]);
  useEffect(()=>localStorage.setItem("arth_fee_payments",JSON.stringify(feePayments)),[feePayments]);
  useEffect(()=>localStorage.setItem("arth_liabilities",JSON.stringify(liabilities)),[liabilities]);
  useEffect(()=>localStorage.setItem("arth_assets",JSON.stringify(trackedAssets)),[trackedAssets]);
  useEffect(()=>localStorage.setItem("arth_vehicles",JSON.stringify(vehicles)),[vehicles]);
  useEffect(()=>localStorage.setItem("arth_loans",JSON.stringify(loans)),[loans]);
  useEffect(()=>localStorage.setItem("arth_cc_emi_plans",JSON.stringify(ccEmiPlans)),[ccEmiPlans]);
  useEffect(()=>localStorage.setItem("arth_annual_budget",annualBudget),[annualBudget]);
  useEffect(()=>localStorage.setItem("arth_person_budgets",JSON.stringify(perPersonBudgets)),[perPersonBudgets]);
  useEffect(()=>localStorage.setItem("arth_gifts",JSON.stringify(gifts)),[gifts]);
  useEffect(()=>localStorage.setItem("arth_budget_carry",JSON.stringify(budgetCarryForward)),[budgetCarryForward]);
  useEffect(()=>{ if(defaultGroupId) localStorage.setItem("arth_default_group",defaultGroupId); else localStorage.removeItem("arth_default_group"); },[defaultGroupId]);
  useEffect(()=>localStorage.setItem("arth_last_fy_target",lastFYTarget),[lastFYTarget]);
  useEffect(()=>localStorage.setItem("arth_month_overrides",JSON.stringify(monthOverrides)),[monthOverrides]);

  // ── MODAL STATE ────────────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [defaultAddType, setDefaultAddType] = useState("expense");
  const [addPrefill, setAddPrefill] = useState(null);
  const [showInvestments, setShowInvestments] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [defaultBillerAccountId, setDefaultBillerAccountId] = useState("");
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
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(null);
  const [confirmDeleteTxn, setConfirmDeleteTxn] = useState(null);
  const [billMatchSuggestion, setBillMatchSuggestion] = useState(null);
  const [refundMatchSuggestion, setRefundMatchSuggestion] = useState(null);
  const [reimbursementMatchSuggestion, setReimbursementMatchSuggestion] = useState(null);
  const [imageViewSrc, setImageViewSrc] = useState(null);
  const [refundSourceTxn, setRefundSourceTxn] = useState(null);
  const [budgetOverrideMonth, setBudgetOverrideMonth] = useState(null);
  const [budgetOverrideVal, setBudgetOverrideVal] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupViewMode, setGroupViewMode] = useState("overall");
  const [showGroupOwesBreakdown, setShowGroupOwesBreakdown] = useState(false);
  const [groupSpendFilter, setGroupSpendFilter] = useState(null);
  const [personViewMode, setPersonViewMode] = useState("overall");
  const [linkTxnModal, setLinkTxnModal] = useState(null);
  const [settleTxn, setSettleTxn] = useState(null);
  const [showTxnUpiPicker, setShowTxnUpiPicker] = useState(false);
  const [pendingTxnShare, setPendingTxnShare] = useState(null);
  const [expandedTxn, setExpandedTxn] = useState(null);
  const defaultTxnMonth = viewMonth || todayStr().slice(0,7);
  const [fType, setFType] = useState("All");
  const [txnSearch, setTxnSearch] = useState("");
  const [txnDetailId, setTxnDetailId] = useState(null);
  const [maskMode, setMaskMode] = useState(false);
  const [maskRevealActive, setMaskRevealActive] = useState(false);
  const [maskRevealTimer, setMaskRevealTimer] = useState(null);
  const [showMaskPin, setShowMaskPin] = useState(false);
  const [maskPinInput, setMaskPinInput] = useState("");
  const [maskPinError, setMaskPinError] = useState(false);
  const M = v => (maskMode && !maskRevealActive) ? "₹•••••" : v;
  const toggleMask = () => {
    if(!maskMode){ setMaskMode(true); setMaskRevealActive(false); }
    else if(maskRevealActive){ setMaskRevealActive(false); if(maskRevealTimer) clearTimeout(maskRevealTimer); }
    else { setShowMaskPin(true); setMaskPinInput(""); setMaskPinError(false); }
  };
  const onMaskReveal = () => {
    setShowMaskPin(false); setMaskRevealActive(true);
    if(maskRevealTimer) clearTimeout(maskRevealTimer);
    const t = setTimeout(()=>setMaskRevealActive(false), 60000);
    setMaskRevealTimer(t);
  };
  const [txnDatePreset, setTxnDatePreset] = useState("current_month");
  const [txnSort, setTxnSort] = useState("date_desc");
  const [txnDateFrom, setTxnDateFrom] = useState(()=>getMonthBounds(defaultTxnMonth).start);
  const [txnDateTo, setTxnDateTo] = useState(()=>getMonthBounds(defaultTxnMonth).end);
  const [txnAmountFrom, setTxnAmountFrom] = useState("");
  const [txnAmountTo, setTxnAmountTo] = useState("");
  const [txnCategoryFilter, setTxnCategoryFilter] = useState("all");
  const [txnPersonFilter, setTxnPersonFilter] = useState("all");
  const [expenseSourceFilter, setExpenseSourceFilter] = useState("all");
  const [expenseCardFilter, setExpenseCardFilter] = useState("all");
  const [incomeTypeFilter, setIncomeTypeFilter] = useState("all");
  const [incomeAccountFilter, setIncomeAccountFilter] = useState("all");
  const [investmentTypeFilter, setInvestmentTypeFilter] = useState("all");
  const [txnReimbursableOnly, setTxnReimbursableOnly] = useState(false);
  const [txnGroupFilter, setTxnGroupFilter] = useState("all");
  const [selectedInvestmentTypeView, setSelectedInvestmentTypeView] = useState("all");
  const [editingLiability, setEditingLiability] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingLoan, setEditingLoan] = useState(null);
  const [repaymentLoan, setRepaymentLoan] = useState(null);
  const [showReceivablesList, setShowReceivablesList] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const dataUrlToShareFile = async (dataUrl, fallbackName = "arth-bill") => {
    if(!dataUrl || typeof File === "undefined") return null;
    try{
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const ext = blob.type?.split("/")?.[1]?.split(";")?.[0] || "jpg";
      return new File([blob], `${fallbackName}.${ext}`, { type:blob.type || "image/jpeg" });
    }catch{
      return null;
    }
  };

  const doTxnShare = useCallback(async (shareRequest, upiHandle = "") => {
    if(!shareRequest) return;
    const { recipientName, amount, contextLabel, dueDate, imageBase64, shareTitle, billDate, billPeriodFrom, billPeriodTo, totalAmount } = shareRequest;
    const linkedLabel = upiHandle ? (() => {
      const acc = accounts.find(a=>a.type==="upi"&&a.handle===upiHandle);
      const linked = acc?.linkedAccount ? accounts.find(b=>b.id===acc.linkedAccount) : null;
      return linked ? ` (${linked.name})` : "";
    })() : "";
    const dueLabel = dueDate ? (formatShortDate(dueDate) || dueDate) : "";
    const hasBillDetails = billDate || billPeriodFrom || billPeriodTo;
    let lines;
    if(hasBillDetails){
      const billDateLabel = billDate ? (formatShortDate(billDate)||billDate) : "-";
      const fromLabel = billPeriodFrom ? (formatShortDate(billPeriodFrom)||billPeriodFrom) : "-";
      const toLabel = billPeriodTo ? (formatShortDate(billPeriodTo)||billPeriodTo) : "-";
      // Auto-calculate number of days spanned by the bill period, inclusive of both ends.
      const numDays = (billPeriodFrom && billPeriodTo) ? (Math.round((new Date(billPeriodTo)-new Date(billPeriodFrom))/(1000*60*60*24))+1) : null;
      lines = [
        `Hello ${recipientName},`,
        `Your share of ${contextLabel} is as below.`,
        "",
        `Bill Date - ${billDateLabel}`,
        `Due Date - ${dueLabel||"-"}`,
        `From Date - ${fromLabel}`,
        `To Date - ${toLabel}`,
        numDays!==null ? `No of days - ${numDays}` : "No of days - -",
        `Total Amount - ${sym}${fmt(totalAmount??amount)}`,
        `Your Share - ${sym}${fmt(amount)}`,
        "",
        dueLabel ? `Kindly pay before ${dueLabel}` : "Kindly pay when convenient.",
        upiHandle ? `Payment UPI: ${upiHandle}${linkedLabel}` : "",
        "- sent via Arth",
      ].filter(Boolean).join("\n");
    } else {
      lines = [
        `Hi ${recipientName},`,
        `Your share towards ${contextLabel} is ${sym}${fmt(amount)}.`,
        dueLabel ? `Kindly clear it before ${dueLabel}.` : "Kindly clear it when convenient.",
        upiHandle ? `Payment UPI: ${upiHandle}${linkedLabel}` : "",
        "- sent via Arth",
      ].filter(Boolean).join("\n");
    }
    try {
      const file = await dataUrlToShareFile(imageBase64, (shareTitle || contextLabel || "arth-bill").replace(/[^\w-]+/g, "-").slice(0, 48));
      const payload = { title:shareTitle || "Arth share request", text:lines };
      if(file && navigator.canShare?.({ files:[file] })) payload.files = [file];
      if(navigator.share){ await navigator.share(payload); }
      else { await navigator.clipboard.writeText(lines); alert("Payment request copied to clipboard!"); }
    } catch(e){
      if(e?.name!=="AbortError") navigator.clipboard?.writeText(lines).catch(()=>{});
    }
  }, [accounts]);

  const sharePaymentRequest = useCallback((recipientName, amount, contextLabel, details = {}) => {
    const safeAmount = Number(amount||0);
    if(!recipientName || !(safeAmount>0)) return;
    const request = { recipientName, amount:safeAmount, contextLabel:contextLabel || "shared expense", ...details };
    const upiAccs = accounts.filter(a=>a.type==="upi"&&a.handle);
    if(upiAccs.length<=1){
      doTxnShare(request, upiAccs[0]?.handle||"");
      return;
    }
    setPendingTxnShare(request);
    setShowTxnUpiPicker(true);
  }, [accounts, doTxnShare]);

  const openInvestmentComposer = () => {
    setShowInvestments(false);
    setShowAddInvestment(false);
    setEditingInvestment(null);
    setSelectedInvestmentTypeView("all");
    setDefaultAddType("investment");
    setShowAdd(true);
  };
  const applyTxnDatePreset = useCallback((preset, baseMonth = viewMonth || todayStr().slice(0,7)) => {
    if(preset === "all"){
      setTxnDatePreset("all");
      setTxnDateFrom("");
      setTxnDateTo("");
      return;
    }
    if(preset === "last_month"){
      const { start, end } = getMonthBounds(getPreviousMonthKey(baseMonth));
      setTxnDatePreset("last_month");
      setTxnDateFrom(start);
      setTxnDateTo(end);
      return;
    }
    if(preset === "custom"){
      setTxnDatePreset("custom");
      return;
    }
    const { start, end } = getMonthBounds(baseMonth);
    setTxnDatePreset("current_month");
    setTxnDateFrom(start);
    setTxnDateTo(end);
  }, [viewMonth]);
  const openLoanDraft = useCallback((overrides = {}) => {
    setEditingLoan({ _isDraft:true, direction:"given", startDate:todayStr(), ...overrides });
    setShowAddLoan(true);
  }, []);

  useEffect(()=>{
    if(txnDatePreset === "current_month"){
      const { start, end } = getMonthBounds(viewMonth || todayStr().slice(0,7));
      setTxnDateFrom(start);
      setTxnDateTo(end);
    } else if(txnDatePreset === "last_month"){
      const { start, end } = getMonthBounds(getPreviousMonthKey(viewMonth || todayStr().slice(0,7)));
      setTxnDateFrom(start);
      setTxnDateTo(end);
    }
  }, [txnDatePreset, viewMonth]);

  // ── LOOKUPS ────────────────────────────────────────────────────────────────
  const getCat = useCallback(id=>{
    if(!id) return {name:"?",color:"#888",icon:"❓",subs:[]};
    const matched = cats.find(c=>c.id===id || c.id.toLowerCase()===String(id).toLowerCase());
    return matched || {name:"?",color:"#888",icon:"❓",subs:[]};
  },[cats]);
  const getAcc = useCallback(id=>accounts.find(a=>a.id===id)||{name:"?",color:"#888",type:"cash"},[accounts]);
  const getPerson = useCallback(id=>people.find(p=>p.id===id)||{name:"?",emoji:"👤",color:"#888",relation:"",personType:"contact"},[people]);
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

  // ── CURRENT MONTH FILTER ───────────────────────────────────────────────────
  const cm = viewMonth;
  const thisMonthTxns = useMemo(()=>txns.filter(t=>t.date&&t.date.startsWith(cm)),[txns,cm]);
  const expenses = useMemo(()=>thisMonthTxns.filter(t=>t.type==="expense"),[thisMonthTxns]);
  const refundTotalsByBill = useMemo(()=>txns.reduce((map,txn)=>{
    if(txn.type!=="settlement_in" || !txn.isRefund || !txn.againstBillId) return map;
    const key = String(txn.againstBillId);
    map[key] = (map[key]||0) + Number(txn.amount||0);
    return map;
  },{}), [txns]);
  const getNetBillAmount = useCallback(bill=>Math.max(0, Number(bill?.amount||0) - Number(refundTotalsByBill[String(bill?.id)]||0)),[refundTotalsByBill]);
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
    // Handle both split and allocate (Txn breakup unified mode)
    if(trackingMode!=="split" && trackingMode!=="allocate") return 0;
    if(expense.groupCollectiveAmount !== undefined && expense.groupCollectiveAmount !== null){
      return Math.max(0, Number(expense.groupCollectiveAmount||0) - Number(expense.groupCollectiveSettledAmt||0));
    }
    return hasIndividualReceivable ? 0 : Math.max(0, Number(expense.amount||0));
  },[]);
  const getMyExpenseAmount = useCallback(expense=>{
    const netAmount = getNetExpenseAmount(expense);
    if(!(netAmount>0)) return 0;

    const trackingMode = expense?.trackingMode
      || (Object.keys(expense?.people||{}).some(pid=>pid!=="__me__") ? "split" : (expense?.forPerson || expense?.groupId ? "tag" : "none"));
    const meId = people.find(person=>person.isMe)?.id;
    let attributedAway = 0;

    Object.entries(expense?.people||{}).forEach(([pid,info])=>{
      if(pid==="__me__") return;
      const mode = info?.mode;
      const part = Number(info?.amount||0);
      if(!(part>0)) return;
      if(mode==="owes") attributedAway += part;
    });

    const groupAllocations = Array.isArray(expense?.groupAllocations) ? expense.groupAllocations : [];
    groupAllocations.forEach(groupPart=>{
      const mode = groupPart?.mode;
      const part = Number(groupPart?.amount||0);
      if(!(part>0)) return;
      if(mode==="owes") attributedAway += part;
    });

    if((trackingMode==="split" || trackingMode==="allocate") && groupAllocations.length===0){
      const collectivePart = Number(expense?.groupCollectiveAmount||0);
      if(collectivePart>0) attributedAway += collectivePart;
    }

    return Math.max(0, netAmount - attributedAway);
  },[getNetExpenseAmount]);

  // ── COMPUTED ───────────────────────────────────────────────────────────────
  const myActual = useMemo(()=>expenses.reduce((sum,expense)=>sum+getMyExpenseAmount(expense),0),[expenses,getMyExpenseAmount]);

  const totalIncome = useMemo(()=>thisMonthTxns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),[thisMonthTxns]);
  const monthlyInvestmentFlow = useMemo(()=>thisMonthTxns.reduce((sum,t)=>{
    if(t.type==="investment") return sum + Number(t.amount||0);
    if(t.type==="transfer" && t.toAccId && isInvestmentAccount(getAcc(t.toAccId))) return sum + Number(t.amount||0);
    return sum;
  },0),[thisMonthTxns,getAcc]);
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
        startDate:linkedTxn?.investStartDate || inv.startDate || linkedTxn?.date || todayStr(),
        paymentAccId:linkedTxn?.accId || inv.paymentAccId || "",
        lastNav:Number(linkedTxn?.investNav ?? inv.lastNav ?? 0),
        lastNavDate:linkedTxn?.date || inv.lastNavDate || inv.startDate || todayStr(),
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
        startDate:t.investStartDate || t.date || todayStr(),
        linkedTxnId:t.id,
        linkedInvestmentId:t.linkedInvestmentId || null,
        source:"transaction",
        paymentAccId:t.accId || "",
        lastNav:Number(t.investNav || 0),
        lastNavDate:t.date || todayStr(),
      }));

    return [...saved, ...derivedFromTxns];
  },[investments,txns]);
  const investmentFolioGroups = useMemo(()=>{
    const map = new Map();
    trackedInvestments.forEach(inv=>{
      const grouping = getInvestmentGroupMeta(inv);
      const key = grouping.key;
      if(!map.has(key)){
        map.set(key, {
          id:key,
          type:inv.type,
          folioNo:grouping.folioNo,
          primaryName:grouping.primaryName,
          latestNameDate:inv.lastNavDate || inv.startDate || "",
          items:[],
          total:0,
        });
      }
      const group = map.get(key);
      const latestNameDate = inv.lastNavDate || inv.startDate || "";
      if((inv.name||"") && String(group.latestNameDate||"") <= String(latestNameDate||"")){
        group.primaryName = inv.name || group.primaryName;
        group.latestNameDate = latestNameDate;
      }
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
  const investmentTemplateOptions = useMemo(()=>{
    const templates = new Map();
    trackedInvestments.forEach(inv=>{
      const linkedTxn = getInvestmentTxn(inv);
      const folioKey = String(inv.folioNo||"").trim().toLowerCase();
      const nameKey = String(inv.name||"").trim().toLowerCase();
      const primaryKey = folioKey || nameKey;
      if(!primaryKey) return;
      const key = `${inv.type||"mf"}|${primaryKey}`;
      const lastUsed = linkedTxn?.date || inv.lastNavDate || inv.startDate || "";
      const candidate = {
        key,
        type:inv.type || "mf",
        name:inv.name || "Investment",
        folioNo:String(inv.folioNo||"").trim(),
        amount:Number(linkedTxn?.amount ?? inv.amount ?? 0),
        freq:linkedTxn?.investFreq || inv.freq || "",
        accId:linkedTxn?.accId || inv.paymentAccId || "",
        nav:Number(linkedTxn?.investNav ?? inv.lastNav ?? 0),
        startDate:inv.startDate || linkedTxn?.date || "",
        lastUsed,
        label:String(inv.folioNo||"").trim()
          ? `Folio ${String(inv.folioNo).trim()} · ${inv.name || "Investment"}`
          : (inv.name || "Investment"),
      };
      const existing = templates.get(key);
      if(!existing || String(existing.lastUsed||"") < String(lastUsed||"")){
        templates.set(key, candidate);
      }
    });
    return Array.from(templates.values()).sort((a,b)=>String(b.lastUsed||"").localeCompare(String(a.lastUsed||"")));
  },[trackedInvestments,getInvestmentTxn]);

  const removeTxnAndLinkedInvestment = useCallback(txn=>{
    if(!txn) return;
    if(getAcc(txn.accId)?.type==="cc" && txn.type==="expense"){
      setAccounts(prev=>prev.map(a=>a.id===txn.accId?{...a,outstanding:Math.max(0,(a.outstanding||0)-Number(txn.amount||0))}:a));
    }
    // B1b: Delete refund on CC -> add amount back to outstanding
    if(txn.type==="settlement_in" && txn.isRefund && getAcc(txn.accId)?.type==="cc"){
      setAccounts(prev=>prev.map(a=>a.id===txn.accId?{...a,outstanding:(a.outstanding||0)+Number(txn.amount||0)}:a));
    }
    // If deleting a repayment/settlement, reverse the settled amounts on original txns + bills
    if(txn.type==="settlement_in" && !txn.isRefund && txn.settlementLinks?.length){
      const links = txn.settlementLinks;
      const personId = txn.fromPersonId;
      // Reverse person-level splits
      setTxns(prev=>prev.map(t=>{
        const link = links.find(l=>(l.kind==="txn"||l.kind==="group-txn")&&String(l.id)===String(t.id));
        if(!link) return t;
        const pid = link.personId || personId;
        const reversedAmt = Number(link.amount||0);
        // Reverse groupCollectiveSettledAmt
        const prevGrp = Number(t.groupCollectiveSettledAmt||0);
        const nextGrp = t.groupCollectiveAmount>0 ? Math.max(0, prevGrp - reversedAmt) : prevGrp;
        // Reverse person split if exists
        if(pid && t.people?.[pid]){
          const info = t.people[pid];
          const prevSettled = Number(info.settledAmt||0);
          const nextSettled = Math.max(0, prevSettled - reversedAmt);
          const origAmt = Number(info.amount||0);
          const nextRemaining = Math.min(origAmt, origAmt - nextSettled);
          return { ...t,
            people:{ ...t.people, [pid]:{ ...info, settled:false, settledAmt:nextSettled, remainingAmt:nextRemaining } },
            ...(t.groupCollectiveAmount>0 ? { groupCollectiveSettledAmt:nextGrp } : {})
          };
        }
        return { ...t, ...(t.groupCollectiveAmount>0 ? { groupCollectiveSettledAmt:nextGrp } : {}) };
      }));
      // Reverse bill-level splits
      setBills(prev=>prev.map(b=>{
        const link = links.find(l=>(l.kind==="bill"||l.kind==="group-bill")&&String(l.id)===String(b.id));
        if(!link) return b;
        const pid = link.personId || personId;
        const reversedAmt = Number(link.amount||0);
        const prevGrp = Number(b.groupCollectiveSettledAmt||0);
        const nextGrp = b.groupCollectiveAmount>0 ? Math.max(0, prevGrp - reversedAmt) : prevGrp;
        if(pid && b.splitPeople?.[pid]){
          const info = b.splitPeople[pid];
          const prevSettled = Number(info.settledAmt||0);
          const nextSettled = Math.max(0, prevSettled - reversedAmt);
          const origAmt = Number(info.amount||0);
          const nextRemaining = Math.min(origAmt, origAmt - nextSettled);
          return { ...b,
            status: "unpaid",
            paidDate: null,
            splitPeople:{ ...b.splitPeople, [pid]:{ ...info, settled:false, settledAmt:nextSettled, remainingAmt:nextRemaining } },
            ...(b.groupCollectiveAmount>0 ? { groupCollectiveSettledAmt:nextGrp } : {})
          };
        }
        return { ...b, status:"unpaid", paidDate:null, ...(b.groupCollectiveAmount>0 ? { groupCollectiveSettledAmt:nextGrp } : {}) };
      }));
    }
    setTxns(prev=>prev.filter(x=>String(x.id)!==String(txn.id)));
    if(txn.type==="investment"){
      setInvestments(prev=>prev.filter(x=>String(x.id)!==String(txn.linkedInvestmentId||"") && String(x.linkedTxnId)!==String(txn.id)));
    }
  },[getAcc, setBills]);

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

  const openInvestmentQuickAdd = useCallback(inv=>{
    const linkedTxn = getInvestmentTxn(inv);
    const sourceItem = linkedTxn ? {
      ...inv,
      paymentAccId: linkedTxn.accId || inv?.paymentAccId || accounts.find(a=>a.type!=="cc")?.id || accounts[0]?.id || "",
      startDate: inv?.startDate || linkedTxn?.date || todayStr(),
      lastNavDate: todayStr(),
    } : inv;
    setSelectedInvestmentDetail(null);
    setEditingInvestment({
      _prefillOnly:true,
      type:sourceItem?.type || "mf",
      name:sourceItem?.name || "Investment",
      folioNo:String(sourceItem?.folioNo || "").trim(),
      amount:Number(sourceItem?.amount || 0),
      freq:sourceItem?.freq || "",
      paymentAccId:sourceItem?.paymentAccId || accounts.find(a=>a.type!=="cc")?.id || accounts[0]?.id || "",
      lastNav:Number(sourceItem?.lastNav || linkedTxn?.investNav || 0),
      startDate:sourceItem?.startDate || todayStr(),
      lastNavDate:sourceItem?.lastNavDate || todayStr(),
      reminder:null,
    });
    setShowAddInvestment(true);
  },[accounts,getInvestmentTxn]);

  const byCat = useMemo(()=>cats.map(c=>({
    name:c.name,
    value:expenses.filter(expense=>getTxnCategoryIds(expense).includes(c.id)).reduce((sum,expense)=>{
      const txnCatIds = getTxnCategoryIds(expense);
      const catCount = txnCatIds.length || 1;
      return sum+(getMyExpenseAmount(expense)/catCount);
    },0),
    color:c.color,id:c.id,icon:c.icon,budget:c.budget
  })).filter(c=>c.value>0),[expenses,cats,getMyExpenseAmount]);

  const settlements = useMemo(()=>{
    const receivables = {};
    const payables = {};
    const meId = people.find(p=>p.isMe)?.id;

    txns.forEach(t=>{
      if(t.type==="expense"){
        // Check F8 style (t.people) and legacy (t.splitPeople)
        const peopleMap = {...(t.splitPeople||{}), ...(t.people||{})};
        Object.entries(peopleMap).forEach(([pid,info])=>{
          if(pid==="__me__" || pid===meId || info.mode!=="owes" || info.settled) return;
          receivables[pid] = (receivables[pid]||0) + remainingShare(info);
        });
      }

      if(t.type==="expense"){
        // forPerson attribution → counts as receivable (skip self)
        // Use tagPersonAmount if set, otherwise full amount (F8 "They owe me back")
        if(t.forPerson && t.forPerson!==meId){
          const pid=t.forPerson;
          const alreadyCounted = t.people?.[pid]?.mode==="owes"&&!t.people[pid]?.settled;
          if(!alreadyCounted){
            const amt = Number(t.tagPersonAmount||0)>0 ? Number(t.tagPersonAmount) : (t.tagMode==="person"?Number(t.amount||0):0);
            if(amt>0) receivables[pid]=(receivables[pid]||0)+amt;
          }
        }
        // tagItems person entries → count as receivable (skip self)
        (t.tagItems||[]).forEach(item=>{
          if(item.targetType!=="person"||!item.targetId||item.targetId===meId||!Number(item.amount||0)) return;
          const pid=item.targetId;
          if(t.people?.[pid]?.mode==="owes"&&!t.people[pid].settled) return;
          receivables[pid]=(receivables[pid]||0)+Number(item.amount);
        });
      }

      if(t.type==="settlement_in"&&t.fromPersonId&&Number(t.extraAmount||0)>0&&(t.settlementLinks||[]).length>0){
        payables[t.fromPersonId] = (payables[t.fromPersonId]||0) + Number(t.extraAmount||0);
      }

      if(t.type==="settlement_out"&&t.toPersonId){
        payables[t.toPersonId] = (payables[t.toPersonId]||0) + Number(t.amount||0);
      }
      // Txn breakup O mode (owes_by_me) — I owe this person
      if(t.type==="expense"&&t.people){
        Object.entries(t.people).forEach(([pid,info])=>{
          if(pid==="__me__" || info.mode!=="owes_by_me") return;
          payables[pid] = (payables[pid]||0) + Number(info.amount||0);
        });
      }
    });

    const txnById = new Map(txns.map(t=>[t.id,t]));
    bills.forEach(b=>{
      if(!b.splitPeople) return;
      // If this bill has a linked expense that also tracks the same person, skip —
      // the expense is the source of truth and is already counted above.
      const linkedTxn = b.paidByTxnId ? txnById.get(b.paidByTxnId) : null;
      const linkedTxnHasPeople = linkedTxn?.people && Object.keys(linkedTxn.people).length > 0;
      if(linkedTxnHasPeople) return;
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
  },[txns,bills,people]);

  const personSpend = useMemo(()=>{
    const map={};
    thisMonthTxns.forEach(t=>{
      if(t.type!=="expense") return;
      // forPerson tag (old-style)
      if(t.forPerson){
        if(!map[t.forPerson]) map[t.forPerson]=0;
        map[t.forPerson]+=(t.tagPersonAmount||t.amount);
      }
      // tagItems (itemized tag)
      if(t.tagItems?.length){
        t.tagItems.forEach(item=>{
          if(item.targetType==="person"&&item.targetId){
            if(!map[item.targetId]) map[item.targetId]=0;
            map[item.targetId]+=Number(item.amount||0);
          }
        });
      }
      // Txn breakup / allocate: mode="spent_on" (A=Attribute) counts as spend on person
      if(t.people){
        Object.entries(t.people).forEach(([pid,info])=>{
          if(pid==="__me__") return;
          if(info.mode==="spent_on"&&Number(info.amount||0)>0){
            if(!map[pid]) map[pid]=0;
            map[pid]+=Number(info.amount||0);
          }
        });
      }
      // allocations array (unified/allocate mode)
      if(t.allocations?.length){
        t.allocations.forEach(alloc=>{
          if(alloc.targetType==="person"&&alloc.targetId&&alloc.mode==="spent_on"&&Number(alloc.amount||0)>0){
            if(!map[alloc.targetId]) map[alloc.targetId]=0;
            map[alloc.targetId]+=Number(alloc.amount||0);
          }
        });
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

    // B10 fix: use ALL txns not just thisMonthTxns — unpaid debts carry forward
    const meId = people.find(p=>p.isMe)?.id;
    txns.forEach(t=>{
      if(t.type!=="expense") return;
      // Check both F8 (t.people) and legacy (t.splitPeople)
      const peopleMap = {...(t.splitPeople||{}), ...(t.people||{})};
      Object.entries(peopleMap).forEach(([pid,info])=>{
        if(pid==="__me__" || info.mode!=="owes" || info.settled) return;
        map[pid] = (map[pid]||0) + remainingShare(info);
      });
      // forPerson + tagMode=person — old txns before people map fix
      if(t.forPerson && t.forPerson!==meId && t.tagMode==="person"){
        const pid = t.forPerson;
        if(!peopleMap[pid]) { // not already counted above
          const amt = Number(t.tagPersonAmount||0)>0 ? Number(t.tagPersonAmount) : Number(t.amount||0);
          if(amt>0) map[pid] = (map[pid]||0) + amt;
        }
      }
    });

    bills
      .filter(b=>b.status==="unpaid" && b.splitPeople)
      .forEach(b=>{
        Object.entries(b.splitPeople||{}).forEach(([pid,info])=>{
          if(pid==="__me__" || info.mode!=="owes" || info.settled) return;
          map[pid] = (map[pid]||0) + remainingShare(info);
        });
      });

    return map;
  },[txns,bills,cm]);
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
  const monthlyCollectiveGroupReceivable = useMemo(()=>{
    const txnCollective = txns
      .filter(t=>t.type==="expense" && t.date && String(t.date).startsWith(cm))
      .reduce((sum,t)=>sum + getGroupCollectiveDue(t),0);
    const billCollective = bills
      .filter(b=>b.status==="unpaid")
      .filter(b=>(b.dueDate&&String(b.dueDate).startsWith(cm)) || (b.createdDate&&String(b.createdDate).startsWith(cm)))
      .reduce((sum,b)=>sum + Number(b.groupCollectiveAmount||0),0);
    return txnCollective + billCollective;
  },[txns,bills,cm,getGroupCollectiveDue]);
  const monthTotalOwedToMe = useMemo(()=>monthDirectOwedToMe + monthlyCollectiveGroupReceivable,[monthDirectOwedToMe,monthlyCollectiveGroupReceivable]);
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

    const txnAmount = Number(t.amount||0);
    if(txnAmountFrom && txnAmount < parseMoney(txnAmountFrom)) return false;
    if(txnAmountTo && txnAmount > parseMoney(txnAmountTo)) return false;

    if(txnCategoryFilter!=="all"){
      const txnCats = getTxnCategoryIds(t);
      if(!txnCats.some(id=>String(id)===String(txnCategoryFilter))) return false;
    }

    if(txnPersonFilter!=="all" && !txnHasPerson(t, txnPersonFilter)) return false;

    if(txnGroupFilter!=="all"){
      const inGroup = t.groupId===txnGroupFilter || (t.groupAllocations||[]).some(ga=>ga.groupId===txnGroupFilter);
      if(!inGroup) return false;
    }

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

    if(txnReimbursableOnly && !(t.reimbursable && !t.reimbursedByTxnId)) return false;

    // Text search
    if(txnSearch&&txnSearch.trim()){
      const q = txnSearch.trim().toLowerCase();
      const merchant = (t.merchant||t.who||t.desc||"").toLowerCase();
      const note = (t.note||"").toLowerCase();
      const amount = String(t.amount||"");
      const acc = accounts.find(a=>a.id===t.accId);
      const accName = (acc?.name||"").toLowerCase();
      if(!merchant.includes(q)&&!note.includes(q)&&!amount.includes(q)&&!accName.includes(q)) return false;
    }

    return true;
  }).sort((a,b)=>{
    const recordedA = getRecordedSortValue(a);
    const recordedB = getRecordedSortValue(b);
    const dateA = new Date(a.date||0).getTime();
    const dateB = new Date(b.date||0).getTime();
    const amountA = Number(a.amount||0);
    const amountB = Number(b.amount||0);
    const tieDesc = String(b.id||"").localeCompare(String(a.id||""), undefined, { numeric:true, sensitivity:"base" });
    const tieAsc = String(a.id||"").localeCompare(String(b.id||""), undefined, { numeric:true, sensitivity:"base" });

    if(txnSort==="date_desc"){
      if(dateB !== dateA) return dateB - dateA;
      if(recordedB !== recordedA) return recordedB - recordedA;
      return tieDesc;
    }
    if(txnSort==="date_asc"){
      if(dateA !== dateB) return dateA - dateB;
      if(recordedA !== recordedB) return recordedA - recordedB;
      return tieAsc;
    }
    if(txnSort==="amount_desc"){
      if(amountB !== amountA) return amountB - amountA;
      if(recordedB !== recordedA) return recordedB - recordedA;
      return tieDesc;
    }
    if(txnSort==="amount_asc"){
      if(amountA !== amountB) return amountA - amountB;
      if(recordedB !== recordedA) return recordedB - recordedA;
      return tieDesc;
    }

    if(recordedB !== recordedA) return recordedB - recordedA;
    if(dateB !== dateA) return dateB - dateA;
    return tieDesc;
  }),[txns,fType,txnDateFrom,txnDateTo,txnAmountFrom,txnAmountTo,txnCategoryFilter,txnPersonFilter,txnGroupFilter,accounts,expenseSourceFilter,expenseCardFilter,incomeTypeFilter,incomeAccountFilter,investmentTypeFilter,txnSort,txnReimbursableOnly,txnSearch]);

  const accountBalance = useCallback((accId, endDate=null)=>{
    const acc=accounts.find(a=>a.id===accId);
    if(!acc||acc.type==="cc") return 0;
    const openingDate = acc.openingBalanceDate || "";
    const linkedDebitIds = acc.type==="bank"
      ? accounts.filter(a=>(a.type==="debit" && a.linkedBank===accId) || (a.type==="upi" && a.linkedAccount===accId)).map(a=>a.id)
      : [];
    let bal=Number(acc.openingBalance||0);
    txns.forEach(t=>{
      if(!isDateInRange(t.date, openingDate, endDate)) return;
      if(t.type==="income"&&t.accId===accId) bal+=Number(t.amount||0);
      if(t.type==="settlement_in"&&t.accId===accId) bal+=Number(t.amount||0);
      if(t.type==="expense"){
        if(t.accId===accId || linkedDebitIds.includes(t.accId)) bal-=Number(t.amount||0);
      }
      if(t.type==="investment"){
        if(t.accId===accId || linkedDebitIds.includes(t.accId)) bal-=Number(t.amount||0);
      }
      if(t.type==="transfer"){
        if(t.fromAccId===accId || linkedDebitIds.includes(t.fromAccId)) bal-=Number(t.amount||0);
        if(t.toAccId===accId || linkedDebitIds.includes(t.toAccId)) bal+=Number(t.amount||0);
      }
      if(t.type==="cc_payment" && (t.fromAccId===accId || linkedDebitIds.includes(t.fromAccId))) bal-=Number(t.amount||0);
    });
    return bal;
  },[txns,accounts]);

  const bankBalance = useCallback(accId=>{
    const acc=accounts.find(a=>a.id===accId);
    if(!acc||acc.type!=="bank") return 0;
    return accountBalance(accId);
  },[accounts,accountBalance]);
  const accountReconciliationGap = useCallback(accId=>{
    const checkpoint = balanceCheckpoints[accId];
    if(!checkpoint?.date) return 0;
    const expectedAtDate = accountBalance(accId, checkpoint.date);
    return Number(checkpoint.amount||0) - Number(expectedAtDate||0);
  },[balanceCheckpoints,accountBalance]);
  const effectiveAccountBalance = useCallback(accId=>{
    const acc = accounts.find(a=>a.id===accId);
    if(!acc || acc.type==="cc") return 0;
    const computed = accountBalance(accId);
    return acc.type==="bank" ? computed + accountReconciliationGap(accId) : computed;
  },[accounts,accountBalance,accountReconciliationGap]);

  const investmentAccounts = useMemo(()=>accounts.filter(a=>isInvestmentAccount(a)),[accounts]);
  const cashBankTotal = useMemo(()=>accounts.filter(a=>a.type==="bank" && !isInvestmentAccount(a)).reduce((sum,a)=>sum+effectiveAccountBalance(a.id),0),[accounts,effectiveAccountBalance]);
  const cashWalletTotal = useMemo(()=>accounts.filter(a=>a.type==="cash" && !isInvestmentAccount(a)).reduce((sum,a)=>sum+accountBalance(a.id),0),[accounts,accountBalance]);
  const upiTotal = useMemo(()=>accounts.filter(a=>a.type==="upi" && !isInvestmentAccount(a) && !a.linkedAccount).reduce((sum,a)=>sum+accountBalance(a.id),0),[accounts,accountBalance]);
  const liquidAssetsTotal = useMemo(()=>accounts.filter(a=>a.type!=="cc" && !isInvestmentAccount(a) && !a.excludeFromWealth).reduce((sum,a)=>sum+(a.type==="bank" ? effectiveAccountBalance(a.id) : accountBalance(a.id)),0),[accounts,accountBalance,effectiveAccountBalance]);
  const reconciliationGapTotal = useMemo(()=>accounts.filter(a=>a.type==="bank" && !isInvestmentAccount(a)).reduce((sum,a)=>sum+accountReconciliationGap(a.id),0),[accounts,accountReconciliationGap]);
  const reconciledBankCount = useMemo(()=>accounts.filter(a=>a.type==="bank" && !isInvestmentAccount(a) && balanceCheckpoints[a.id]?.date).length,[accounts,balanceCheckpoints]);
  const investmentAccountTotal = useMemo(()=>investmentAccounts.reduce((sum,a)=>sum+accountBalance(a.id),0),[investmentAccounts,accountBalance]);
  const investmentDashboardGroups = useMemo(()=>{
    const map = new Map();
    trackedInvestments.forEach(inv=>{
      const grouping = getInvestmentGroupMeta(inv);
      const key = grouping.key;
      const typeMeta = INVEST_TYPES.find(type=>type.id===inv.type);
      if(!map.has(key)){
        map.set(key, {
          id:key,
          type:inv.type || "custom",
          folioNo:grouping.folioNo || "",
          primaryName:grouping.primaryName || inv.name || "Investment",
          firstStartDate:inv.startDate || inv.lastNavDate || "",
          title:grouping.folioNo ? `Folio ${grouping.folioNo}` : grouping.primaryName,
          trackedTotal:0,
          accountTotal:0,
          itemCount:0,
          accountCount:0,
          color:typeMeta?.color || T.info,
          accounts:[],
          items:[],
        });
      }
      const group = map.get(key);
      if(grouping.folioNo) group.folioNo = grouping.folioNo;
      if(grouping.primaryName) group.primaryName = grouping.primaryName;
      const itemStartDate = inv.startDate || inv.lastNavDate || "";
      if(itemStartDate && (!group.firstStartDate || String(itemStartDate) < String(group.firstStartDate))) group.firstStartDate = itemStartDate;
      group.title = grouping.folioNo ? `Folio ${grouping.folioNo}` : (grouping.primaryName || group.title);
      group.trackedTotal += Number(inv.currentValue ?? inv.amount ?? 0);
      group.itemCount += 1;
      group.items.push(inv);
    });
    investmentAccounts.forEach(account=>{
      const typeId = inferInvestmentTypeId(`${account.typeLabel||""} ${account.name||""}`);
      const grouping = getInvestmentGroupMeta({ type:typeId, name:account.name || account.typeLabel || "Investment", id:account.id, linkedInvestmentId:account.id });
      const key = grouping.key;
      const typeMeta = INVEST_TYPES.find(type=>type.id===typeId);
      if(!map.has(key)){
        map.set(key, {
          id:key,
          type:typeId,
          title:grouping.primaryName,
          trackedTotal:0,
          accountTotal:0,
          itemCount:0,
          accountCount:0,
          color:account.color || typeMeta?.color || T.info,
          accounts:[],
        });
      }
      const group = map.get(key);
      group.accountTotal += Number(accountBalance(account.id) || 0);
      group.accountCount += 1;
      group.accounts.push(account);
      if(!group.title || group.title === "Investment") group.title = account.name || grouping.primaryName;
      if(!group.color) group.color = account.color || typeMeta?.color || T.info;
    });
    return Array.from(map.values())
      .map(group=>({
        ...group,
        total:group.trackedTotal>0 && group.accountTotal>0 ? Math.max(group.trackedTotal, group.accountTotal) : (group.trackedTotal + group.accountTotal),
      }))
      .filter(group=>group.total>0)
      .sort((a,b)=>b.total-a.total);
  },[trackedInvestments,investmentAccounts,accountBalance]);
  const investmentAssetsTotal = useMemo(()=>investmentDashboardGroups.reduce((sum,group)=>sum+Number(group.total||0),0),[investmentDashboardGroups]);
  const investmentTypeSummaries = useMemo(()=>INVEST_TYPES.map(type=>{
    const groups = investmentDashboardGroups.filter(group=>group.type===type.id && Number(group.total||0)>0);
    if(!groups.length) return null;
    return {
      ...type,
      total:groups.reduce((sum,group)=>sum+Number(group.total||0),0),
      groupCount:groups.length,
    };
  }).filter(Boolean),[investmentDashboardGroups]);
  const trackedAssetsTotal = useMemo(()=>trackedAssets.reduce((sum,a)=>sum+Number(a.currentValue||0),0),[trackedAssets]);
  const cardOutstanding = useCallback((card)=>{
    if(!card) return 0;
    const cardId = typeof card === "string" ? card : card.id;
    const cardObj = typeof card === "string" ? accounts.find(a=>a.id===card) : card;
    const { prevStatementDate, lastStatementDate } = getCardCycleDates(cardObj||{}, new Date());
    const linkedUpiIds = accounts.filter(a=>a.type==="upi"&&a.linkedAccount===cardId).map(a=>a.id);
    const allIds = [cardId, ...linkedUpiIds];
    const today = todayStr();
    // Charges in the last billing cycle only (prevStatementDate < date ≤ lastStatementDate)
    const lastCycleCharges = txns.reduce((sum,t)=>{
      if((t.type!=="expense"&&t.type!=="investment"&&t.type!=="cc_emi")||!allIds.includes(t.accId)) return sum;
      if(!t.date||String(t.date)>today) return sum;
      const d=toDateOnly(t.date);
      if(!d||!lastStatementDate||d<=prevStatementDate||d>lastStatementDate) return sum;
      return sum+Number(t.amount||0);
    },0);
    // Refunds within cycle reduce charges
    const inCycleRefunds = txns.reduce((sum,t)=>{
      if(t.type!=="settlement_in"||!t.isRefund||!allIds.includes(t.accId)) return sum;
      const d=toDateOnly(t.date);
      if(!d||!lastStatementDate||d<=prevStatementDate||d>lastStatementDate) return sum;
      return sum+Number(t.amount||0);
    },0);
    // Payments AFTER statement date reduce outstanding
    const paymentsSinceStatement = txns.reduce((sum,t)=>{
      const isCcPayment = t.type==="cc_payment" && t.toAccId===cardId;
      const isCcRefund = t.type==="settlement_in" && t.isRefund && allIds.includes(t.accId);
      if(!isCcPayment && !isCcRefund) return sum;
      const d=toDateOnly(t.date);
      if(!d||!lastStatementDate||d<=lastStatementDate) return sum;
      return sum+Number(t.amount||0);
    },0);
    return Math.max(0, lastCycleCharges - inCycleRefunds - paymentsSinceStatement);
  },[txns,accounts]);
  const creditCardLiabilityTotal = useMemo(()=>accounts.reduce((sum,a)=>sum+(a.type==="cc"?cardOutstanding(a):0),0),[accounts,cardOutstanding]);
  const otherLiabilityTotal = useMemo(()=>liabilities.reduce((sum,l)=>sum+Number(l.outstanding||0),0),[liabilities]);
  const getCardSummary = useCallback((card)=>{
    const { prevStatementDate, lastStatementDate, nextStatementDate, dueOn } = getCardCycleDates(card, new Date());
    const linkedUpiIds = accounts.filter(a=>a.type==="upi"&&a.linkedAccount===card.id).map(a=>a.id);
    const allIds = [card.id, ...linkedUpiIds];
    const today = new Date();
    const todayMid = new Date(today.getFullYear(),today.getMonth(),today.getDate(),12,0,0,0);
    const todayS = todayStr();
    // Outstanding = last closed billing cycle charges (prevStatementDate < date ≤ lastStatementDate)
    const lastCycleCharges = txns.reduce((sum,t)=>{
      if((t.type!=="expense"&&t.type!=="investment"&&t.type!=="cc_emi")||!allIds.includes(t.accId)) return sum;
      if(!t.date||String(t.date)>todayS) return sum;
      const d=toDateOnly(t.date);
      if(!d||!lastStatementDate||d<=prevStatementDate||d>lastStatementDate) return sum;
      return sum+Number(t.amount||0);
    },0);
    // Refunds WITHIN the billing cycle reduce charges directly
    const inCycleRefunds = txns.reduce((sum,t)=>{
      if(t.type!=="settlement_in"||!t.isRefund||!allIds.includes(t.accId)) return sum;
      const d=toDateOnly(t.date);
      if(!d||!lastStatementDate||d<=prevStatementDate||d>lastStatementDate) return sum;
      return sum+Number(t.amount||0);
    },0);
    // Payments AND refunds AFTER statement date reduce outstanding
    const paymentsSinceStatement = txns.reduce((sum,t)=>{
      const isCcPayment = t.type==="cc_payment" && t.toAccId===card.id;
      const isCcRefund = t.type==="settlement_in" && t.isRefund && allIds.includes(t.accId);
      if(!isCcPayment && !isCcRefund) return sum;
      const d=toDateOnly(t.date);
      if(!d||!lastStatementDate||d<=lastStatementDate) return sum;
      return sum+Number(t.amount||0);
    },0);
    const totalOutstanding = Math.max(0, lastCycleCharges - inCycleRefunds - paymentsSinceStatement);
    // Unbilled = current open cycle charges (after lastStatementDate, up to today)
    const currentCycleSpend = Math.max(0, txns.reduce((sum,t)=>{
      if((t.type!=="expense"&&t.type!=="cc_emi")||!allIds.includes(t.accId)) return sum;
      const txnDate=toDateOnly(t.date);
      if(!txnDate||!lastStatementDate||txnDate<=lastStatementDate||txnDate>todayMid) return sum;
      return sum+Number(t.amount||0);
    },0));
    // Due Now = unpaid statement amount (already net of payments above)
    const currentDue = totalOutstanding;
    const alertPct=Number(card.alertPct??30);
    const thresholdAmount=card.limit?(Number(card.limit||0)*alertPct)/100:0;
    const isOverAlert=Boolean(card.limit)&&alertPct>0&&currentCycleSpend>=thresholdAmount&&currentCycleSpend>0;
    const daysToDue=Math.ceil((dueOn-todayMid)/(1000*60*60*24));
    return { prevStatementDate,lastStatementDate,nextStatementDate,dueOn,totalOutstanding,currentCycleSpend,currentDue,alertPct,thresholdAmount,isOverAlert,daysToDue };
  },[txns,accounts]);
  const groupReceivableTotal = useCallback(groupId=>{
    const txnOwed = txns.filter(t=>t.type==="expense" && (
      t.groupId===groupId ||
      // Also include Txn breakup allocations where this group has mode=owes
      t.groupAllocations?.some(g=>g.groupId===groupId&&g.mode==="owes"&&Number(g.amount||0)>0)
    )).reduce((sum,t)=>{
      // If this group is in groupAllocations with mode=owes, use its specific amount
      const groupAlloc = t.groupAllocations?.find(g=>g.groupId===groupId&&g.mode==="owes");
      if(groupAlloc) {
        // Use ratio of settled to calculate remaining
        const totalCollective = Number(t.groupCollectiveAmount||0);
        const totalSettled = Number(t.groupCollectiveSettledAmt||0);
        const groupAmt = Number(groupAlloc.amount||0);
        const settledRatio = totalCollective>0 ? Math.min(1, totalSettled/totalCollective) : 0;
        const remaining = Math.max(0, groupAmt - (groupAmt * settledRatio));
        return sum + remaining;
      }
      // Primary groupId case: use people splits + collective
      return sum + Object.entries(t.people||{}).reduce((inner,[pid,info])=>{
        if(pid==="__me__" || info.mode!=="owes" || info.settled) return inner;
        return inner + remainingShare(info);
      },0) + getGroupCollectiveDue(t);
    },0);
    const billOwed = bills.filter(b=>b.groupId===groupId&&b.status==="unpaid").reduce((sum,b)=>
      sum + Object.entries(b.splitPeople||{}).reduce((inner,[pid,info])=>{
        if(pid==="__me__" || info.mode!=="owes" || info.settled) return inner;
        return inner + remainingShare(info);
      },0) + Number(b.groupCollectiveAmount||0)
    ,0);
    // Add individual member outstanding (expenses tagged to group members individually)
    const group = groups.find(g=>g.id===groupId);
    const memberIndividualOwed = (group?.members||[]).reduce((sum,memberId)=>{
      const memberTxnOwed = txns.filter(t=>
        t.type==="expense" &&
        t.people?.[memberId]?.mode==="owes" &&
        !t.people?.[memberId]?.settled &&
        !t.groupId // not a group expense - avoid double counting
      ).reduce((s,t)=>s+remainingShare(t.people[memberId]),0);
      const memberLoanOwed = loans.filter(l=>
        l.direction!=="taken" &&
        l.status==="active" &&
        String(l.personId||l.linkedPersonId||"")===String(memberId)
      ).reduce((s,l)=>s+Number(l.outstanding||0),0);
      return sum + memberTxnOwed + memberLoanOwed;
    },0);
    return txnOwed + billOwed + memberIndividualOwed;
  },[txns,bills,loans,groups,getGroupCollectiveDue]);

  const getPersonReceivableItems = useCallback(personId=>{
    if(!personId) return [];
    const txnItems = txns
      .filter(t=>{
        if(t.type!=="expense") return false;
        // Check both F8 (t.people) and legacy (t.splitPeople)
        const info = t.people?.[personId] || t.splitPeople?.[personId];
        if(info?.mode==="owes" && !info?.settled && remainingShare(info)>0) return true;
        // Also catch forPerson + tagMode=person (old txns before people map fix)
        if(String(t.forPerson||"")===String(personId) && t.tagMode==="person" && !info) return true;
        return false;
      })
      .map(t=>{
        const info = t.people?.[personId] || t.splitPeople?.[personId];
        const amt = info ? remainingShare(info) : (Number(t.tagPersonAmount||0)||Number(t.amount||0));
        return ({
          key:`txn:${t.id}`,
          kind:"txn",
          id:t.id,
          date:t.date||"",
          title:t.desc||t.merchant||"Expense",
          subtitle:[formatShortDate(t.date)||t.date, t.groupId&&getGroup(t.groupId)?.name].filter(Boolean).join(" · "),
          amount:amt,
          originalAmount:Number(info?.amount||0)||amt,
        });
      });
    const txnItemIdSet = new Set(txnItems.map(i=>i.id));
    // Also collect bill IDs that are explicitly claimed by a txn in txnItems (via paidBillId)
    const txnClaimedBillIds = new Set(
      txnItems.map(i=>txns.find(t=>t.id===i.id)?.paidBillId).filter(Boolean)
    );
    const billItems = bills
      .filter(b=>{
        if(!b.splitPeople?.[personId] || b.splitPeople[personId]?.mode!=="owes") return false;
        if(b.splitPeople[personId]?.settled || remainingShare(b.splitPeople[personId])<=0) return false;
        // If this bill has a linked expense txn (paidByTxnId) that already tracks this person's split,
        // OR a txn in txnItems explicitly paid this bill (paidBillId), skip — the txn is source of truth.
        if(b.paidByTxnId && txnItemIdSet.has(b.paidByTxnId)) return false;
        if(txnClaimedBillIds.has(b.id)) return false;
        return true;
      })
      .map(b=>({
        key:`bill:${b.id}`,
        kind:"bill",
        id:b.id,
        date:b.dueDate||b.billDate||b.createdDate||"",
        title:b.name||b.merchant||"Bill",
        subtitle:[formatShortDate(b.dueDate)||b.dueDate, b.groupId&&getGroup(b.groupId)?.name, "bill"].filter(Boolean).join(" · "),
        amount:remainingShare(b.splitPeople[personId]),
        originalAmount:Number(b.splitPeople[personId]?.amount||0),
      }));
    const taggedItems = txns.filter(t=>{
      if(t.type!=="expense") return false;
      const viaFP = t.forPerson===personId && Number(t.tagPersonAmount||0)>0;
      const viaTI = t.tagItems?.some(i=>i.targetType==="person"&&i.targetId===personId&&Number(i.amount||0)>0);
      if(!viaFP&&!viaTI) return false;
      return !(t.people?.[personId]?.mode==="owes"&&!t.people?.[personId]?.settled);
    }).map(t=>{
      const amt = (t.forPerson===personId && Number(t.tagPersonAmount||0)>0)
        ? Number(t.tagPersonAmount)
        : Number(t.tagItems?.find(i=>i.targetType==="person"&&i.targetId===personId)?.amount||0);
      return { key:`tagged:${t.id}`, kind:"tagged", id:t.id, date:t.date||"",
        title:t.desc||t.merchant||"Expense",
        subtitle:[formatShortDate(t.date)||t.date,"attributed"].filter(Boolean).join(" · "),
        amount:amt, originalAmount:amt };
    });
    return [...txnItems,...billItems,...taggedItems].sort((a,b)=>
      (toDateOnly(a.date)?.getTime()||0) - (toDateOnly(b.date)?.getTime()||0) ||
      String(a.title||"").localeCompare(String(b.title||""), "en", { sensitivity:"base" })
    );
  },[txns,bills,getGroup]);

  const getGroupReceivableItems = useCallback(groupId=>{
    if(!groupId) return [];
    const txnItems = txns
      .filter(t=>{
        if(t.type!=="expense") return false;
        if(t.groupId===groupId) return true;
        // Also include txns where this group has an allocation (multi-group "Txn break up")
        return t.groupAllocations?.some(g=>g.groupId===groupId&&g.mode==="owes"&&Number(g.amount||0)>0);
      })
      .flatMap(t=>{
        // Use this group's specific allocation amount when available (multi-group case)
        const groupAlloc = t.groupAllocations?.find(g=>g.groupId===groupId&&g.mode==="owes");
        const groupAmt = groupAlloc ? Number(groupAlloc.amount||0) : Number(t.groupCollectiveAmount||0);
        // For settled tracking: if multiple groups, approximate by ratio; single group uses full settledAmt
        const totalCollective = Number(t.groupCollectiveAmount||0);
        const totalSettled = Number(t.groupCollectiveSettledAmt||0);
        const settledAmt = (groupAlloc && totalCollective>0) ? Math.min(groupAmt, totalSettled*(groupAmt/totalCollective)) : totalSettled;
        const remaining = Math.max(0, groupAmt - settledAmt);
        if(remaining<=0) return [];
        return [{ key:`group-txn:${t.id}`, kind:"group-txn", id:t.id, groupId, date:t.date||"", title:t.desc||t.merchant||"Expense", subtitle:[formatShortDate(t.date)||t.date, getGroup(groupId)?.name].filter(Boolean).join(" · "), amount:remaining }];
      });
    const txnItemIds = new Set(txnItems.map(i=>i.id));
    const billItems = bills
      .filter(b=>b.groupId===groupId&&b.status!=="paid"&&Number(b.groupCollectiveAmount||0)>0&&(!b.paidByTxnId||!txnItemIds.has(b.paidByTxnId)))
      .flatMap(b=>{
        const remaining = Math.max(0, Number(b.groupCollectiveAmount||0) - Number(b.groupCollectiveSettledAmt||0));
        if(remaining<=0) return [];
        return [{ key:`group-bill:${b.id}`, kind:"group-bill", id:b.id, groupId, date:b.dueDate||b.billDate||b.createdDate||"", title:b.name||b.merchant||"Bill", subtitle:[formatShortDate(b.dueDate)||b.dueDate, getGroup(groupId)?.name, "bill"].filter(Boolean).join(" · "), amount:remaining }];
      });
    return [...txnItems,...billItems].sort((a,b)=>(toDateOnly(a.date)?.getTime()||0)-(toDateOnly(b.date)?.getTime()||0));
  },[txns,bills,getGroup]);

  const applyRepaymentAllocations = useCallback((personId, settlementLinks)=>{
    const links = (settlementLinks||[])
      .map(link=>({ ...link, amount:Math.max(0, Number(link.amount||0)) }))
      .filter(link=>link.id&&link.amount>0);
    if(!links.length) return;

    const personLinks = links.filter(l=>l.kind==="txn"||l.kind==="bill");
    const groupTxnLinks = links.filter(l=>l.kind==="group-txn");
    const groupBillLinks = links.filter(l=>l.kind==="group-bill");

    if(personId && personLinks.length) {
      setTxns(prev=>prev.map(txn=>{
        if(txn.type!=="expense" || !txn.people?.[personId]) return txn;
        const link = personLinks.find(item=>item.kind==="txn"&&String(item.id)===String(txn.id));
        if(!link) return txn;
        const info = txn.people[personId];
        const originalAmt = Number(info.amount||0);
        const prevSettled = Number(info.settledAmt||0);
        const nextSettled = Math.min(originalAmt, prevSettled + Number(link.amount||0));
        const nextRemaining = Math.max(0, originalAmt-nextSettled);
        const addedAmt = nextSettled - prevSettled;
        // Also advance group collective tracking so the same txn can't be settled again via the group path
        const groupCap = Number(txn.groupCollectiveAmount||0);
        const nextGroupSettled = groupCap > 0
          ? Math.min(groupCap, Number(txn.groupCollectiveSettledAmt||0) + addedAmt)
          : txn.groupCollectiveSettledAmt;
        return { ...txn,
          people:{ ...txn.people, [personId]:{ ...info, settled:nextRemaining<=0, settledAmt:nextSettled, remainingAmt:nextRemaining } },
          ...(groupCap > 0 ? { groupCollectiveSettledAmt:nextGroupSettled } : {})
        };
      }));
      setBills(prev=>prev.map(bill=>{
        if(!bill.splitPeople?.[personId]) return bill;
        const link = personLinks.find(item=>item.kind==="bill"&&String(item.id)===String(bill.id));
        if(!link) return bill;
        const info = bill.splitPeople[personId];
        const originalAmt = Number(info.amount||0);
        const prevSettled = Number(info.settledAmt||0);
        const nextSettled = Math.min(originalAmt, prevSettled + Number(link.amount||0));
        const nextRemaining = Math.max(0, originalAmt-nextSettled);
        const addedAmt = nextSettled - prevSettled;
        // Also advance group collective tracking so the same bill can't be settled again via the group path
        const groupCap = Number(bill.groupCollectiveAmount||0);
        const nextGroupSettled = groupCap > 0
          ? Math.min(groupCap, Number(bill.groupCollectiveSettledAmt||0) + addedAmt)
          : bill.groupCollectiveSettledAmt;
        return { ...bill,
          splitPeople:{ ...bill.splitPeople, [personId]:{ ...info, settled:nextRemaining<=0, settledAmt:nextSettled, remainingAmt:nextRemaining } },
          ...(groupCap > 0 ? { groupCollectiveSettledAmt:nextGroupSettled } : {})
        };
      }));
    }

    if(groupTxnLinks.length) {
      setTxns(prev=>prev.map(txn=>{
        if(txn.type!=="expense") return txn;
        const link = groupTxnLinks.find(l=>String(l.id)===String(txn.id));
        if(!link) return txn;
        const prevSettled = Number(txn.groupCollectiveSettledAmt||0);
        const cap = Number(txn.groupCollectiveAmount||0);
        const nextGroupSettled = cap>0 ? Math.min(cap, prevSettled + Number(link.amount||0)) : prevSettled;
        const linkPersonId = link.personId || personId;
        let updatedPeople = txn.people;
        if(linkPersonId && txn.people?.[linkPersonId]) {
          const info = txn.people[linkPersonId];
          const origAmt = Number(info.amount||0);
          const prevPSettled = Number(info.settledAmt||0);
          const nextPSettled = Math.min(origAmt, prevPSettled + Number(link.amount||0));
          const nextPRemaining = Math.max(0, origAmt - nextPSettled);
          updatedPeople = { ...txn.people, [linkPersonId]:{ ...info, settled:nextPRemaining<=0, settledAmt:nextPSettled, remainingAmt:nextPRemaining } };
        }
        return { ...txn, ...(cap>0?{groupCollectiveSettledAmt:nextGroupSettled}:{}), people:updatedPeople };
      }));
    }

    if(groupBillLinks.length) {
      setBills(prev=>prev.map(bill=>{
        const link = groupBillLinks.find(l=>String(l.id)===String(bill.id));
        if(!link) return bill;
        const prevSettled = Number(bill.groupCollectiveSettledAmt||0);
        const cap = Number(bill.groupCollectiveAmount||0);
        const nextGroupSettled = cap>0 ? Math.min(cap, prevSettled + Number(link.amount||0)) : prevSettled;
        const linkPersonId = link.personId || personId;
        let updatedSplitPeople = bill.splitPeople;
        if(linkPersonId && bill.splitPeople?.[linkPersonId]) {
          const info = bill.splitPeople[linkPersonId];
          const origAmt = Number(info.amount||0);
          const prevPSettled = Number(info.settledAmt||0);
          const nextPSettled = Math.min(origAmt, prevPSettled + Number(link.amount||0));
          const nextPRemaining = Math.max(0, origAmt - nextPSettled);
          updatedSplitPeople = { ...bill.splitPeople, [linkPersonId]:{ ...info, settled:nextPRemaining<=0, settledAmt:nextPSettled, remainingAmt:nextPRemaining } };
        }
        const allOwedSettled = Object.entries(updatedSplitPeople||{}).filter(([p])=>p!=="__me__").every(([,i])=>i.settled||i.mode!=="owes");
        return { ...bill, ...(cap>0?{groupCollectiveSettledAmt:nextGroupSettled}:{}), splitPeople:updatedSplitPeople, ...(allOwedSettled?{status:"paid",paidDate:todayStr()}:{}) };
      }));
    }

    // tagged (attributed) items — convert attribution to a settled split entry
    const taggedLinks = links.filter(l=>l.kind==="tagged");
    if(personId && taggedLinks.length){
      setTxns(prev=>prev.map(t=>{
        const link=taggedLinks.find(l=>String(l.id)===String(t.id));
        if(!link) return t;
        if(t.people?.[personId]) return t; // already has a split entry
        return { ...t, people:{ ...(t.people||{}), [personId]:{ amount:link.amount, mode:"owes", settled:true, settledAmt:link.amount, remainingAmt:0 } } };
      }));
    }
  },[]);

  const _groupReceivableTotalAll = useMemo(()=>groups.reduce((sum,g)=>sum+groupReceivableTotal(g.id),0),[groups,groupReceivableTotal]);
  const activeLoans = useMemo(()=>loans.filter(loan=>loan.status==="active" && Number(loan.outstanding||0)>0),[loans]);
  const isCreditCardBackedLoan = useCallback(loan=>loan?.direction==="taken" && (loan?.sourceType==="cc" || loan?.ccLinked===true || (loan?.autoScheduled && loan?.scheduledInstallmentIds?.length>0)),[]);
  const loanGivenTotal = useMemo(()=>activeLoans.filter(loan=>loan.direction!=="taken").reduce((sum,loan)=>sum+Number(loan.outstanding||0),0),[activeLoans]);
  const activeGivenLoans = useMemo(()=>activeLoans.filter(loan=>loan.direction!=="taken" && !isCreditCardBackedLoan(loan)),[activeLoans,isCreditCardBackedLoan]);
  const loanTakenTotal = useMemo(()=>activeLoans.filter(loan=>loan.direction==="taken" && !isCreditCardBackedLoan(loan)).reduce((sum,loan)=>sum+Number(loan.outstanding||0),0),[activeLoans,isCreditCardBackedLoan]);
  const upcomingEmiLoans = useMemo(()=>activeLoans.filter(loan=>loan.direction==="taken" && !isCreditCardBackedLoan(loan) && Number(loan.emiAmount||0)>0),[activeLoans,isCreditCardBackedLoan]);
  const monthlyEmiCommitment = useMemo(()=>upcomingEmiLoans.reduce((sum,loan)=>sum+Number(loan.emiAmount||0),0),[upcomingEmiLoans]);
  const totalAssetsValue = liquidAssetsTotal + investmentAssetsTotal + trackedAssetsTotal + totalOwedToMe + loanGivenTotal;
  // CC-backed EMI loans are already reflected in creditCardLiabilityTotal (via cc_emi txns on the card).
  // loanTakenTotal excludes CC-backed loans via isCreditCardBackedLoan to prevent double-counting.
  const totalLiabilitiesValue = creditCardLiabilityTotal + otherLiabilityTotal + loanTakenTotal;
  const netWorthValue = totalAssetsValue - totalLiabilitiesValue;

  // ── STYLES ─────────────────────────────────────────────────────────────────
  const card = { background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:16, marginBottom:12 };
  const lbl = { color:T.sub, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1.2, display:"block", marginBottom:6 };
  const inp = { background:T.input, border:`1px solid ${T.border}`, borderRadius:10, padding:"11px 14px", color:T.text, fontSize:16, width:"100%", outline:"none", fontFamily:"Nunito,sans-serif", boxSizing:"border-box" };
  const inpSm = { background:T.input, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 10px", color:T.text, fontSize:16, outline:"none", fontFamily:"Nunito,sans-serif" };
  const btnP = { background:T.accent, color:"#000", border:"none", borderRadius:12, padding:13, cursor:"pointer", fontSize:14, fontWeight:800, width:"100%", fontFamily:"Nunito,sans-serif" };
  const btnG = { background:"none", border:`1px solid ${T.border}`, color:T.sub, borderRadius:12, padding:13, cursor:"pointer", fontSize:14, fontWeight:700, fontFamily:"Nunito,sans-serif" };
  const ttStyle = { background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px", fontSize:12, color:T.text };
  const lightSelect = { ...inp, background:"#fff", color:"#111" };

  const Chip = ({ color, children, onClick, active }) => (
    <button onClick={onClick} style={{ background:active?color+"22":"none", border:`1px solid ${active?color:T.border}`, borderRadius:20, padding:"5px 12px", cursor:"pointer", fontSize:11, fontWeight:700, color:active?color:T.sub, whiteSpace:"nowrap", fontFamily:"Nunito,sans-serif" }}>{children}</button>
  );
  const AccountChipGroup = ({ items, value, onChange }) => (
    <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
      {items.map(account=>(
        <button
          key={account.id}
          onClick={()=>onChange(account.id)}
          style={{
            background:value===account.id?account.color+"22":"none",
            border:`1px solid ${value===account.id?account.color:T.border}`,
            borderRadius:20,
            padding:"5px 12px",
            cursor:"pointer",
            fontSize:11,
            color:value===account.id?account.color:T.sub,
            fontWeight:700,
            fontFamily:"Nunito,sans-serif"
          }}
        >
          {accIcon(account.type)} {account.name}
        </button>
      ))}
    </div>
  );
  const IncomeTypeChips = ({ options, value, onChange }) => (
    <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
      {options.map(type=>(
        <button
          key={type}
          onClick={()=>onChange(type)}
          style={{
            background:value===type?T.accent+"22":"none",
            border:`1px solid ${value===type?T.accent:T.border}`,
            borderRadius:20,
            padding:"5px 12px",
            cursor:"pointer",
            fontSize:11,
            color:value===type?T.accent:T.sub,
            fontWeight:700,
            fontFamily:"Nunito,sans-serif"
          }}
        >
          {formatIncomeTypeLabel(type)}
        </button>
      ))}
    </div>
  );
  const InvestmentTypeChips = ({ value, onChange }) => (
    <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
      {INVEST_TYPES.map(it=><Chip key={it.id} color={it.color} active={value===it.id} onClick={()=>onChange(it.id)}>{it.icon} {it.name.split("/")[0]}</Chip>)}
    </div>
  );
  const InvestmentFrequencySelect = ({ value, onChange, emptyLabel="One-time / not fixed", styleOverride }) => (
    <select style={styleOverride || lightSelect} value={value} onChange={e=>onChange(e.target.value)}>
      <option value="" style={{ background:"#fff",color:"#111" }}>{emptyLabel}</option>
      {INVESTMENT_FREQUENCY_OPTIONS.map(option=>(
        <option key={option.value} value={option.value} style={{ background:"#fff",color:"#111" }}>{option.label}</option>
      ))}
    </select>
  );

  // ── TXN ROW ────────────────────────────────────────────────────────────────
  const TxnRow = ({ t, last, onEditTxn }) => {
    const txnCatIds = getTxnCategoryIds(t).filter(cid=>getCat(cid));
    const txnSubIds = getTxnSubIds(t).filter(sid=>cats.some(cat=>cat.subs?.some(sub=>sub.id===sid)));
    const cat = txnCatIds[0] ? getCat(txnCatIds[0]) : null;
    const txnTitle = getTxnDisplayTitle(t);
    const invTypeMeta = t.type==="investment" ? INVEST_TYPES.find(i=>i.id===t.investType) : null;
    const investmentMetricText = t.type==="investment" ? formatInvestmentMetric(t.investType||"mf", t.investNav) : "";
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
    const linkedRefunds = t.type==="expense" ? txns.filter(x=>x.type==="settlement_in" && x.againstTxnId && String(x.againstTxnId)===String(t.id) && (x.isRefund || !x.fromPersonId)) : [];
    const refundedAmount = linkedRefunds.reduce((sum,row)=>sum+Number(row.amount||0),0);
    const netAfterRefund = t.type==="expense" ? Math.max(0, Number(t.amount||0) - refundedAmount) : Number(t.amount||0);
    const refundStatus = refundedAmount<=0 ? "" : refundedAmount >= Number(t.amount||0) - 0.01 ? "Refunded" : "Partially Refunded";
    const repaymentLinkedTxns = t.type==="settlement_in" && !t.isRefund && t.settlementLinks?.length
      ? t.settlementLinks.filter(l=>l.kind==="txn"||l.kind==="group-txn").map(link=>({ link, txn:txns.find(x=>String(x.id)===String(link.id)) })).filter(x=>x.txn)
      : [];
    const repaymentLinkedBills = t.type==="settlement_in" && !t.isRefund && t.settlementLinks?.length
      ? t.settlementLinks.filter(l=>l.kind==="bill"||l.kind==="group-bill").map(link=>({ link, bill:bills.find(b=>String(b.id)===String(link.id)) })).filter(x=>x.bill)
      : [];
    const linkedRepayments = t.type==="expense"
      ? txns.filter(x=>x.type==="settlement_in"&&!x.isRefund&&x.settlementLinks?.some(l=>(l.kind==="txn"||l.kind==="group-txn")&&String(l.id)===String(t.id)))
      : [];
    const dateLabel = formatShortDate(t.date) || "--";

    const handleEditTxn = (txn, e) => {
      e?.stopPropagation?.();
      setExpandedTxn(null);
      if(typeof onEditTxn === "function") onEditTxn(txn);
      else setEditingTxn(txn);
    };

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
        <div onClick={()=>setTxnDetailId(t.id)} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 0", cursor:"pointer" }}>
          <div style={{ width:38,height:38,borderRadius:10,background:color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,position:"relative" }}>
            {t.type==="expense" && cat ? cat.icon : t.type==="investment" && invTypeMeta ? invTypeMeta.icon : txnEmoji(t)}
            {allSettled&&<div style={{position:"absolute",bottom:-3,right:-3,fontSize:9,background:T.card,borderRadius:"50%",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✅</div>}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:t.writtenOff?T.sub:T.text, fontSize:13, fontWeight:700, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textDecoration:t.writtenOff?"line-through":"none" }}>
              {txnTitle}
            </div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center", justifyContent:"flex-start" }}>
              {t.type==="expense"&&(
                <>
                  {txnCatIds.map(cid=>{
                    const c=getCat(cid);
                    if(!c) return null;
                    return <span key={cid} style={{ background:c.color+"20",color:c.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>{c.name.split(" ")[0]}</span>;
                  })}
                </>
              )}
              {t.type==="investment"&&invTypeMeta&&<span style={{ background:invTypeMeta.color+"20",color:invTypeMeta.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>{invTypeMeta.icon} {invTypeMeta.name.split("/")[0]}</span>}
              {t.type==="investment"&&t.investFolio&&<span style={{ background:T.pill,color:T.sub,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>Folio {t.investFolio}</span>}
              {investmentMetricText&&<span style={{ color:T.sub,fontSize:10 }}>{investmentMetricText}</span>}
              {t.catAllocations&&Object.keys(t.catAllocations).length>0&&<span style={{ color:T.sub,fontSize:10 }}>{Object.entries(t.catAllocations).map(([cid,val])=>`${getCat(cid).name.split(" ")[0]} ${sym}${fmt(val)}`).join(" · ")}</span>}
              {acc&&<span style={{ color:T.sub,fontSize:10 }}>{accIcon(acc.type)} {acc.name}</span>}
              {t.transactionRef&&<span style={{ color:T.sub,fontSize:10 }}># {t.transactionRef}</span>}
              {totalOwed>0&&!allSettled&&<span style={{ color:T.accent,fontSize:10,fontWeight:700 }}>↗ {sym}{fmt(totalOwed)}</span>}
              {t.type==="settlement_in"&&t.isRefund&&<span style={{ background:refundTone+"18",color:refundTone,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>↩ Refund</span>}
              {t.type==="settlement_in"&&!t.isRefund&&t.settlementLinks?.length>0&&<span style={{ background:T.info+"18",color:T.info,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>💰 Repayment</span>}
              {t.type==="expense"&&refundedAmount>0&&<span style={{ background:T.info+"20",color:T.info,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>↩ {refundStatus}</span>}
              {t.type==="expense"&&linkedRepayments.length>0&&<span style={{ background:T.success+"18",color:T.success,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>💰 Repaid</span>}
              {t.billerLinkId&&(()=>{ const ba=billerAccounts.find(b=>b.id===t.billerLinkId); if(!ba) return null; const mem=memberships.filter(m=>m.billerAccountId===ba.id&&m.txnId===t.id)[0]; return <span style={{ background:T.accent+"18",color:T.accent,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>{getBillerIcon(ba.type)} {ba.name}{mem?` · ${formatShortDate(mem.validFrom)||mem.validFrom}→${formatShortDate(mem.validUntil)||mem.validUntil}`:""}</span>; })()}
              {t.guestPerson&&<span style={{ background:T.warn+"18",color:T.warn,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>👤 {t.guestPerson} owes {sym}{fmt(t.guestPersonAmount||0)}</span>}
              {t.type==="expense"&&t.reimbursable&&!t.reimbursedByTxnId&&<span style={{ background:"#f0a50018",color:"#f0a500",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>💼 Reimb.{t.reimbursableAmount&&t.reimbursableAmount!==t.amount?` ${sym}${fmt(t.reimbursableAmount)}`:""}</span>}
              {t.type==="expense"&&t.reimbursedByTxnId&&<span style={{ background:T.success+"18",color:T.success,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>💼 Reimbursed{t.reimbursableAmount&&t.reimbursableAmount!==t.amount?` ${sym}${fmt(t.reimbursableAmount)}`:""}</span>}
              {t.isAutoEmiInstallment&&<span style={{ background:T.warn+"18",color:T.warn,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>💳 EMI {t.emiInstallmentNum}/{t.emiTotalInstallments}</span>}
              {t.type==="cc_emi"&&t.ccEmiPlanId&&<span style={{ background:T.purple+"18",color:T.purple,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>💳 EMI {t.installmentNo}/{t.ccEmiTenure||"?"}</span>}
              {t.vehicleId&&(()=>{ const v=vehicles.find(x=>x.id===t.vehicleId); if(!v) return null; const vIcon=v.type==="bike"?"🏍️":v.type==="truck"?"🚛":v.type==="auto"?"🛺":"🚗"; const last4=(v.number||"").replace(/\s/g,"").slice(-4)||v.number||""; return <span style={{ background:"#3b82f618",color:"#3b82f6",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700 }}>{vIcon} {last4}</span>; })()}
              {t.imageBase64&&<span style={{ fontSize:10 }}>📷</span>}
            </div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ color, fontSize:14, fontWeight:800, lineHeight:1.2 }}>{isPlus?"+":" "}{M(`${sym}${fmt(t.amount)}`)}</div>
            {t.type==="expense"&&refundedAmount>0&&<div style={{ color:T.info,fontSize:10,marginTop:1,fontWeight:500 }}>net {sym}{fmt(netAfterRefund)}</div>}
            {t.type==="expense"&&myShare>0&&myShare<t.amount&&<div style={{ color:T.sub,fontSize:10,marginTop:2,fontWeight:500 }}>mine {sym}{fmt(myShare)}</div>}
            <div style={{ color:T.sub,fontSize:10,marginTop:1 }}>{dateLabel}</div>
          </div>
          <div style={{ color:T.sub,fontSize:11,flexShrink:0 }}>{isExpanded?"▲":"▼"}</div>
        </div>

        {/* EXPANDED DETAIL */}
        {isExpanded&&(
          <div style={{ background:T.input,borderRadius:12,padding:14,marginBottom:12 }}>
            <div style={{ color:T.text,fontSize:13,fontWeight:700,marginBottom:10 }}>{txnTitle}</div>
            <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:10 }}>
              <span style={{ background:color+"20",color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{txnLabel(t)}</span>
              {t.type==="investment"&&invTypeMeta&&<span style={{ background:invTypeMeta.color+"20",color:invTypeMeta.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{invTypeMeta.icon} {invTypeMeta.name.split("/")[0]}</span>}
              {t.type==="investment"&&t.investFolio&&<span style={{ background:T.pill,color:T.sub,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>Folio {t.investFolio}</span>}
              {investmentMetricText&&<span style={{ background:T.info+"18",color:T.info,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{investmentMetricText}</span>}
              {cat&&t.type==="expense"&&<span style={{ background:cat.color+"20",color:cat.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{cat.icon} {cat.name}</span>}
              {t.type==="expense"&&txnSubIds.map(sid=>{
                const parentCat = cats.find(c=>c.subs?.some(s=>s.id===sid));
                const sub = parentCat?.subs?.find(s=>s.id===sid);
                if(!sub) return null;
                return <span key={sid} style={{ background:(parentCat?.color||"#888")+"20",color:(parentCat?.color||"#888"),borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{sub.name}</span>;
              })}
              {t.merchant&&t.type!=="cc_payment"&&t.type!=="transfer"&&<span style={{ background:T.pill,color:T.sub,borderRadius:20,padding:"2px 9px",fontSize:10 }}>@ {t.merchant}</span>}
              {acc&&<span style={{ background:acc.color+"20",color:acc.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{accIcon(acc.type)} {acc.name}</span>}
              {t.groupId&&getGroup(t.groupId)&&<span style={{ background:T.pill,color:T.sub,borderRadius:20,padding:"2px 9px",fontSize:10 }}>👥 {getGroup(t.groupId).name}</span>}
              {allSettled&&<span style={{ background:T.success+"20",color:T.success,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>✅ Settled</span>}
              {t.type==="settlement_in"&&t.isRefund&&<span style={{ background:refundTone+"18",color:refundTone,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>↩ Refund</span>}
              {t.type==="settlement_in"&&!t.isRefund&&t.settlementLinks?.length>0&&<span style={{ background:T.info+"18",color:T.info,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>💰 Repayment</span>}
              {t.type==="expense"&&refundedAmount>0&&<span style={{ background:T.info+"20",color:T.info,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>↩ {refundStatus}</span>}
              {t.type==="expense"&&linkedRepayments.length>0&&<span style={{ background:T.success+"18",color:T.success,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>💰 Repaid</span>}
              {t.writtenOff&&<span style={{ background:T.sub+"20",color:T.sub,borderRadius:20,padding:"2px 9px",fontSize:10 }}>Written off</span>}
              {t.smsRaw&&<span style={{ background:T.info+"20",color:T.info,borderRadius:20,padding:"2px 9px",fontSize:10 }}>📱 SMS</span>}
              {t.transactionRef&&<span style={{ background:T.pill,color:T.text,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>🔖 {t.transactionRef}</span>}
            {t.isBillPayment&&<span style={{ background:T.accent+"20",color:T.accent,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>🧾 Bill{t.billInvoiceNo?` #${t.billInvoiceNo}`:""}</span>}
            </div>
            {t.type==="expense"&&Object.keys(t.people||{}).filter(p=>p!=="__me__").length>0&&(
              <div style={{ marginBottom:10 }}>
                {Object.entries(t.people).filter(([p])=>p!=="__me__").map(([pid,info])=>{
                  const p=getPerson(pid);
                  const left = remainingShare(info);
                  const canShare = info.mode==="owes" && !info.settled && left>0;
                  return <div key={pid} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,fontSize:11,color:info.settled?T.sub:info.mode==="owes"?T.accent:T.sub,textDecoration:info.settled?"line-through":"none",marginBottom:4 }}>
                    {p.emoji} {p.name}: {sym}{fmt(info.settled ? info.amount : remainingShare(info))} {info.mode==="owes"?info.settled?"✅ paid":"owes you":"on me"}
                    {canShare&&<button onClick={e=>{ e.stopPropagation(); sharePaymentRequest(p.name,left,txnTitle,{ dueDate:t.dueDate||t.date, imageBase64:t.imageBase64||t.paymentImageBase64||null, shareTitle:txnTitle }); }} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:12,padding:"2px 8px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif",flexShrink:0 }}>Share</button>}
                  </div>;
                })}
              </div>
            )}
            {t.forPerson&&<div style={{ fontSize:11,color:"#ec4899",marginBottom:8 }}>👤 for {getPerson(t.forPerson).name}{t.tagPersonAmount&&t.tagPersonAmount!==t.amount?` · ${sym}${fmt(t.tagPersonAmount)} personal`:""}{ t.tagGroupAmount&&t.groupId?` · ${sym}${fmt(t.tagGroupAmount)} → ${getGroup(t.groupId)?.name||"group"}`:""}</div>}
            {t.tagItems?.length>0&&<div style={{ fontSize:11,marginBottom:8,display:"flex",flexWrap:"wrap",gap:4 }}>{t.tagItems.map(item=>{const isP=item.targetType==="person";const obj=isP?getPerson(item.targetId):getGroup(item.targetId);return <span key={item.id} style={{ background:T.pill,color:obj?.color||T.sub,borderRadius:20,padding:"2px 8px" }}>{isP?"👤":"👥"} {obj?.name||"?"} {sym}{fmt(item.amount)}</span>})}</div>}
            {t.type==="expense"&&groupCollectiveDue>0&&<div style={{ fontSize:11,color:T.info,marginBottom:8,fontWeight:700 }}>👥 {getGroup(t.groupId)?.name||"Group"} collectively owes {sym}{fmt(groupCollectiveDue)}</div>}
            {t.transactionRef&&<div style={{ fontSize:11,color:T.sub,marginBottom:8 }}>🔖 Transaction ID: {t.transactionRef}</div>}
            {t.note&&<div style={{ fontSize:11,color:T.sub,marginBottom:8 }}>📝 {t.note}</div>}
            {t.type==="expense"&&(t.priceMrp||t.priceInterestRate||t.priceInterest||t.priceProcessingFee)&&(
              <div style={{ background:T.card,borderRadius:8,padding:"8px 10px",fontSize:11,marginBottom:8,display:"flex",flexDirection:"column",gap:4 }}>
                <div style={{ color:T.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginBottom:2 }}>Price Breakdown</div>
                {t.priceMrp&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub }}>MRP</span><span style={{ color:T.text,fontWeight:700 }}>{sym}{fmt(t.priceMrp)}</span></div>}
                {t.priceDiscount&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub }}>Discount</span><span style={{ color:T.success,fontWeight:700 }}>−{sym}{fmt(t.priceDiscount)}</span></div>}
                {t.priceProcessingFee&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub }}>Processing Fee</span><span style={{ color:T.text,fontWeight:700 }}>{sym}{fmt(t.priceProcessingFee)}</span></div>}
                {t.priceInterestRate&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub }}>Interest Rate</span><span style={{ color:T.text,fontWeight:700 }}>{t.priceInterestRate}% p.a.</span></div>}
                {t.priceInterestAmt&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub }}>Monthly Interest</span><span style={{ color:T.text,fontWeight:700 }}>{sym}{fmt(t.priceInterestAmt)}</span></div>}
                {t.priceGstAmt&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub }}>GST on Interest</span><span style={{ color:T.text,fontWeight:700 }}>{sym}{fmt(t.priceGstAmt)}</span></div>}
                {!t.priceInterestRate&&t.priceInterest&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub }}>Interest</span><span style={{ color:T.text,fontWeight:700 }}>{sym}{fmt(t.priceInterest)}</span></div>}
                {!t.priceInterestRate&&t.priceTax&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub }}>GST / Tax</span><span style={{ color:T.text,fontWeight:700 }}>{sym}{fmt(t.priceTax)}</span></div>}
              </div>
            )}
            {refundTarget&&<div style={{ fontSize:11,color:T.info,marginBottom:8,fontWeight:700 }}>↩ Linked expense: {refundTarget.desc||refundTarget.merchant||"Original spend"} · {formatShortDate(refundTarget.date)}</div>}
            {t.type==="expense"&&linkedRefunds.length>0&&<>
              <div style={{ fontSize:11,color:T.info,marginBottom:6,fontWeight:700 }}>↩ Linked refund{linkedRefunds.length>1?"s":""}: {linkedRefunds.map(row=>`${sym}${fmt(row.amount)} on ${formatShortDate(row.date)}`).join(" · ")}</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                {linkedRefunds.map(row=><button key={row.id} onClick={e=>handleEditTxn(row, e)} style={{ background:T.info+"14",border:`1px solid ${T.info}33`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.info,fontFamily:"Nunito,sans-serif" }}>↩ Open refund {sym}{fmt(row.amount)}</button>)}
              </div>
              <div style={{ fontSize:11,color:T.text,marginBottom:8,fontWeight:700 }}>Net after refund: {sym}{fmt(netAfterRefund)}</div>
            </>}
            {t.type==="settlement_in"&&!t.isRefund&&repaymentLinkedTxns.length>0&&<>
              {repaymentLinkedTxns.map(({link,txn})=>(
                <div key={link.id+link.kind} style={{ fontSize:11,color:T.info,marginBottom:4,fontWeight:700 }}>💰 Linked expense: {txn.desc||txn.merchant||"Expense"} · {formatShortDate(txn.date)}</div>
              ))}
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                {repaymentLinkedTxns.map(({link,txn})=><button key={link.id+link.kind} onClick={e=>handleEditTxn(txn,e)} style={{ background:T.info+"14",border:`1px solid ${T.info}33`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.info,fontFamily:"Nunito,sans-serif" }}>💰 Open expense {sym}{fmt(link.amount)}</button>)}
              </div>
            </>}
            {t.type==="settlement_in"&&!t.isRefund&&repaymentLinkedBills.length>0&&<>
              {repaymentLinkedBills.map(({link,bill})=>(
                <div key={link.id+link.kind} style={{ fontSize:11,color:T.accent,marginBottom:4,fontWeight:700 }}>🧾 Linked bill: {bill.name||bill.vendor||"Bill"} · {sym}{fmt(link.amount)}</div>
              ))}
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                {repaymentLinkedBills.map(({link,bill})=><button key={link.id+link.kind} onClick={e=>{ e.stopPropagation(); setEditingBill(bill); }} style={{ background:T.accent+"14",border:`1px solid ${T.accent}33`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>🧾 Open bill {sym}{fmt(link.amount)}</button>)}
              </div>
            </>}
            {t.type==="settlement_in"&&!t.isRefund&&!t.settlementLinks?.length&&t.fromPersonId&&(
              <button onClick={e=>{ e.stopPropagation(); setLinkTxnModal({ settlement:t, mode:"pick_expense" }); }} style={{ background:T.info+"14",border:`1px solid ${T.info}33`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.info,fontFamily:"Nunito,sans-serif",marginBottom:8 }}>🔗 Link to expense</button>
            )}
            {t.type==="expense"&&linkedRepayments.length>0&&<>
              <div style={{ fontSize:11,color:T.success,marginBottom:6,fontWeight:700 }}>💰 Repaid: {linkedRepayments.map(x=>`${sym}${fmt(x.settlementLinks?.find(l=>String(l.id)===String(t.id))?.amount||0)} on ${formatShortDate(x.date)}`).join(" · ")}</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                {linkedRepayments.map(x=><button key={x.id} onClick={e=>handleEditTxn(x,e)} style={{ background:T.success+"14",border:`1px solid ${T.success}33`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.success,fontFamily:"Nunito,sans-serif" }}>💰 Open repayment {sym}{fmt(x.settlementLinks?.find(l=>String(l.id)===String(t.id))?.amount||0)}</button>)}
              </div>
            </>}
            {t.type==="expense"&&linkedRepayments.length===0&&Object.values(t.people||{}).some(i=>i.mode==="owes"&&i.settled)&&(
              <button onClick={e=>{ e.stopPropagation(); setLinkTxnModal({ expense:t, mode:"pick_settlement" }); }} style={{ background:T.success+"14",border:`1px solid ${T.success}33`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.success,fontFamily:"Nunito,sans-serif",marginBottom:8 }}>🔗 Link repayment</button>
            )}
            {t.paidBillName&&<div style={{ fontSize:11,color:T.accent,marginBottom:8,fontWeight:700 }}>🧾 Pays: {t.paidBillName}{t.billInvoiceNo?` · #${t.billInvoiceNo}`:""}</div>}
            {t.imageBase64&&<img src={t.imageBase64} alt="receipt" onClick={e=>{e.stopPropagation();setImageViewSrc(t.imageBase64);}} style={{ width:"100%",borderRadius:8,maxHeight:140,objectFit:"cover",marginBottom:10,cursor:"zoom-in" }} onError={e=>e.target.style.display="none"}/>}
            {t.paymentImageBase64&&<img src={t.paymentImageBase64} alt="payment" onClick={e=>{e.stopPropagation();setImageViewSrc(t.paymentImageBase64);}} style={{ width:"100%",borderRadius:8,maxHeight:140,objectFit:"cover",marginBottom:10,cursor:"zoom-in" }} onError={e=>e.target.style.display="none"}/>}

            {/* Settlement buttons */}
            {owedPeople.length>0&&!t.writtenOff&&(
              <div style={{ marginBottom:10 }}>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8 }}>Pending: {sym}{fmt(totalOwed)}</div>
                <button onClick={e=>{e.stopPropagation();setSettleTxn(t);setExpandedTxn(null);}} style={{ background:T.success+"20",border:`1px solid ${T.success}44`,borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.success,fontFamily:"Nunito,sans-serif",width:"100%" }}>
                  💰 Settle with {owedPeople.map(([pid])=>getPerson(pid).name).join(", ")}
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
              <button onClick={e=>handleEditTxn(t, e)} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>✏️ Edit</button>
              <button onClick={deleteTxn} style={{ background:T.danger+"18",border:`1px solid ${T.danger}33`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.danger,fontFamily:"Nunito,sans-serif",marginLeft:"auto" }}>🗑 Delete</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── UNIQUE VENDORS FOR AUTOCOMPLETE ────────────────────────────────────────
  const uniqueVendors = useMemo(() => {
    const vendors = new Set();
    txns.forEach(t => {
      if (t.merchant && t.merchant.trim()) {
        vendors.add(t.merchant.trim());
      }
    });
    return Array.from(vendors).sort();
  }, [txns]);
  const searchResults = useMemo(()=>{
    const q = searchQuery.trim().toLowerCase();
    if(q.length < 2) return [];
    const results = [];
    txns.filter(t=>(t.merchant||"").toLowerCase().includes(q)||(t.notes||"").toLowerCase().includes(q)||String(t.amount||"").includes(q))
      .slice(0,12).forEach(t=>results.push({kind:"txn",key:`txn-${t.id}`,id:t.id,title:t.merchant||(t.type==="settlement_in"?"Settlement":"Txn"),sub:`${t.type} · ${sym}${fmt(t.amount)}${t.date?" · "+t.date:""}`,item:t}));
    bills.filter(b=>(b.merchant||"").toLowerCase().includes(q)||(b.notes||"").toLowerCase().includes(q)||String(b.amount||"").includes(q))
      .slice(0,6).forEach(b=>results.push({kind:"bill",key:`bill-${b.id}`,id:b.id,title:b.merchant||"Bill",sub:`Bill · ${sym}${fmt(b.amount)}${b.dueDate?" · due "+b.dueDate:""}`,item:b}));
    people.filter(p=>(p.name||"").toLowerCase().includes(q))
      .forEach(p=>results.push({kind:"person",key:`person-${p.id}`,id:p.id,title:`${p.emoji||"👤"} ${p.name}`,sub:"Person",item:p}));
    groups.filter(g=>(g.name||"").toLowerCase().includes(g.id)||((g.name||"").toLowerCase().includes(q)))
      .forEach(g=>results.push({kind:"group",key:`group-${g.id}`,id:g.id,title:`${g.icon||"👥"} ${g.name}`,sub:"Group",item:g}));
    cats.filter(c=>(c.name||"").toLowerCase().includes(q))
      .forEach(c=>results.push({kind:"cat",key:`cat-${c.id}`,id:c.id,title:`${c.icon||""} ${c.name}`,sub:"Category",item:c}));
    return results.slice(0,30);
  },[searchQuery,txns,bills,people,groups,cats]);

  const accountTypeOptions = useMemo(
    () => normalizeAccountTypes(accountTypes, customBaseBehaviors),
    [accountTypes, customBaseBehaviors]
  );
  const incomeTypeOptions = useMemo(
    () => normalizeIncomeTypes([
      ...incomeTypes,
      ...txns.filter(t=>t.type==="income").map(t=>t.incomeType||"salary"),
    ]),
    [incomeTypes, txns]
  );
  const liabilityTypeOptions = useMemo(
    () => [...LIABILITY_TYPES, ...customLiabilityTypes],
    [customLiabilityTypes]
  );

  // ── ADD TRANSACTION MODAL (new flow) ───────────────────────────────────────
  const AddModal = ({ defaultType="expense", prefillTxn=null, prefill=null, editTxn=null, onClose=null }) => {
    const sourceTxn = editTxn || null;
    const linkedInvestment = sourceTxn?.linkedInvestmentId
      ? investments.find(inv=>String(inv.id)===String(sourceTxn.linkedInvestmentId) || String(inv.linkedTxnId||"")===String(sourceTxn.id||"")) || null
      : null;
    const isEditing = Boolean(sourceTxn);
    const refundPrefill = !isEditing && prefillTxn?.type==="expense" ? prefillTxn : null;
    const safePrefill = prefill || {};
    const initialRefundAmount = refundPrefill ? String(getNetExpenseAmount(refundPrefill) || Number(refundPrefill.amount||0) || "") : "";
    const initialTxnType = isEditing ? (sourceTxn.type || defaultType || "expense") : (refundPrefill ? "settlement_in" : (defaultType||"expense"));
    const recentTxnSort = (a,b)=>getRecordedSortValue(b)-getRecordedSortValue(a) || Number(b.updatedAt||0)-Number(a.updatedAt||0) || String(b.id||"").localeCompare(String(a.id||""), undefined, { numeric:true, sensitivity:"base" });
    const recentSpendAccId = [...txns]
      .filter(t=>(t.type==="expense" || t.type==="investment") && t.accId && accounts.some(a=>String(a.id)===String(t.accId)))
      .sort(recentTxnSort)[0]?.accId || "";
    const recentInflowAccId = [...txns]
      .filter(t=>(t.type==="income" || t.type==="settlement_in") && t.accId && accounts.some(a=>String(a.id)===String(t.accId) && a.type!=="cc"))
      .sort(recentTxnSort)[0]?.accId || "";
    const recentFromAccId = [...txns]
      .filter(t=>(t.type==="transfer" || t.type==="cc_payment") && t.fromAccId && accounts.some(a=>String(a.id)===String(t.fromAccId)))
      .sort(recentTxnSort)[0]?.fromAccId || "";
    const recentCardAccId = [...txns]
      .filter(t=>t.type==="cc_payment" && t.toAccId && accounts.some(a=>String(a.id)===String(t.toAccId)))
      .sort(recentTxnSort)[0]?.toAccId || "";
    const firstBankOrSafeAccId = (accounts.find(a=>a.type==="bank") || accounts.find(a=>a.type==="upi") || accounts.find(a=>a.type==="cash") || accounts.find(a=>a.type==="cc") || accounts[0])?.id || "";
    const defaultSpendAccId = recentSpendAccId || firstBankOrSafeAccId;
    const defaultInflowAccId = recentInflowAccId || firstBankOrSafeAccId;
    const defaultFromAccId = recentFromAccId || (accounts.find(a=>a.type==="bank") || accounts.find(a=>a.type==="cash") || accounts.find(a=>a.type==="upi") || accounts[0])?.id || "";
    const defaultToCardId = recentCardAccId || accounts.find(a=>a.type==="cc")?.id || "";
    const defaultAccId = (initialTxnType==="income" || initialTxnType==="settlement_in") ? defaultInflowAccId : defaultSpendAccId;
    const initialCatIds = (isEditing
      ? getTxnCategoryIds(sourceTxn)
      : (Array.isArray(safePrefill.catIds) ? safePrefill.catIds.filter(Boolean) : (safePrefill.catId ? [safePrefill.catId] : [])))
      .filter(cid=>cats.some(cat=>cat.id===cid));
    const initialSubIds = (isEditing
      ? getTxnSubIds(sourceTxn)
      : (Array.isArray(safePrefill.subIds) ? safePrefill.subIds.filter(Boolean) : (safePrefill.subId ? [safePrefill.subId] : [])))
      .filter(sid=>initialCatIds.some(cid=>getCat(cid)?.subs?.some(sub=>sub.id===sid)));
    const initialTrackingMode = isEditing && sourceTxn?.type==="expense"
      ? (sourceTxn.splitMode || sourceTxn.trackingMode ||
          (Object.keys(sourceTxn.people||{}).some(pid=>pid!=="__me__"&&sourceTxn.people[pid]?.mode==="owes") ? "split" :
          (sourceTxn.forPerson||sourceTxn.taggedPersonId||sourceTxn.groupId ? "tag" : "none")))
      : "unified";
    const initialSplitPeople = isEditing && sourceTxn?.type==="expense"
      ? Object.fromEntries(Object.entries(sourceTxn.people||{}).filter(([pid])=>pid!=="__me__").map(([pid])=>[pid, true]))
      : {};
    const initialSplitCustom = isEditing && sourceTxn?.type==="expense"
      ? Object.fromEntries(Object.entries(sourceTxn.people||{}).filter(([pid])=>pid!=="__me__").map(([pid,info])=>[pid, String(info?.amount ?? "")]))
      : {};
    const initialCollectMap = isEditing && sourceTxn?.type==="expense"
      ? Object.fromEntries(Object.entries(sourceTxn.people||{}).filter(([pid])=>pid!=="__me__").map(([pid,info])=>[pid, info?.mode !== "spent_on"]))
      : {};
    const initialSettlementKind = isEditing && sourceTxn?.type==="settlement_in"
      ? (sourceTxn.isRefund ? "refund" : (sourceTxn.fromPersonId||sourceTxn.settlementLinks?.length) ? "repayment" : "reimbursement")
      : (refundPrefill ? "refund" : "refund");

    const [txnType, setTxnType] = useState(initialTxnType);
    const [incomeType, setIncomeType] = useState(sourceTxn?.incomeType || safePrefill.incomeType || "salary");
    const incomeTypeChoices = normalizeIncomeTypes([...incomeTypeOptions, incomeType]);
    const [who, setWho] = useState(
      isEditing
        ? (sourceTxn.type==="cc_payment"||sourceTxn.type==="transfer"
            ? (sourceTxn.desc || sourceTxn.note || "")
            : (sourceTxn.merchant || sourceTxn.desc || ""))
        : (refundPrefill?.merchant || refundPrefill?.desc || safePrefill.who || "")
    );
    const [amount, setAmount] = useState(isEditing ? String(sourceTxn.amount ?? "") : (initialRefundAmount || String(safePrefill.amount || "")));
    const [date, setDate] = useState(isEditing ? (sourceTxn.date || todayStr()) : (safePrefill.date || todayStr()));
    const [catIds, setCatIds] = useState(initialCatIds);  // multiple categories
    const [subIds, setSubIds] = useState(initialSubIds);  // multiple subcats
    const [accId, setAccId] = useState(isEditing ? (sourceTxn.accId || sourceTxn.fromAccId || defaultAccId) : (refundPrefill?.accId || safePrefill.accId || defaultAccId));
    const [fromAccId, setFromAccId] = useState(isEditing ? (sourceTxn.fromAccId || defaultFromAccId) : (safePrefill.fromAccId || defaultFromAccId));
    const [toAccId, setToAccId] = useState(isEditing ? (sourceTxn.toAccId || defaultToCardId) : (safePrefill.toAccId || defaultToCardId));
    const [note, setNote] = useState(isEditing ? (sourceTxn.note || "") : (refundPrefill ? `Refund for ${refundPrefill.desc||refundPrefill.merchant||"expense"}` : (safePrefill.note || "")));
    const [billerLinkId, setBillerLinkId] = useState(isEditing ? (sourceTxn.billerLinkId||"") : "");
    const [settleSelectedIds, setSettleSelectedIds] = useState({});
    const [settleAmounts, setSettleAmounts] = useState({});
    const [guestPersonName, setGuestPersonName] = useState("");
    const [discount, setDiscount] = useState("");
    const [guestPersonAmount, setGuestPersonAmount] = useState("");
    const [showGuestPerson, setShowGuestPerson] = useState(false);
    const [showMembershipPanel, setShowMembershipPanel] = useState(false);
    const [linkValidFrom, setLinkValidFrom] = useState(todayStr());
    const [linkCycle, setLinkCycle] = useState("monthly");
    const [linkBulkMonths, setLinkBulkMonths] = useState("1");
    const [linkGraceDays, setLinkGraceDays] = useState("0");
    const [linkMemberPersonId, setLinkMemberPersonId] = useState("self");
    const linkedBA = billerLinkId ? billerAccounts.find(b=>b.id===billerLinkId) : null;
    const linkedBAType = linkedBA ? getBillerActionType(linkedBA.type) : null;
    const cycleMonthsMap = { monthly:1, quarterly:3, halfyearly:6, annual:12 };
    const linkValidUntil = linkValidFrom && linkBulkMonths ? (()=>{ const d=new Date(linkValidFrom); d.setMonth(d.getMonth()+Number(linkBulkMonths)*(cycleMonthsMap[linkCycle]||1)); d.setDate(d.getDate()+Number(linkGraceDays||0)-1); return d.toISOString().split("T")[0]; })() : "";
    const [imageBase64, setImageBase64] = useState(sourceTxn?.imageBase64 || null);
    const [paymentImageBase64, setPaymentImageBase64] = useState(sourceTxn?.paymentImageBase64 || null);
    const isNative = isNativeSmsAvailable();

    const [smsRaw, setSmsRaw] = useState(sourceTxn?.smsRaw || "");
    const [showSms, setShowSms] = useState(Boolean(sourceTxn?.smsRaw));
    const [smsTxt, setSmsTxt] = useState(sourceTxn?.smsRaw || "");
    const [userSetTxnType, setUserSetTxnType] = useState(isEditing);
    const [smsParseMeta, setSmsParseMeta] = useState(null);
    const [smsBusy, setSmsBusy] = useState(false);
    const [smsImportStatus, setSmsImportStatus] = useState("");
    const [showPriceBreakdown, setShowPriceBreakdown] = useState(isEditing && !!(sourceTxn?.priceMrp||sourceTxn?.priceDiscount||sourceTxn?.priceProcessingFee||sourceTxn?.priceInterestRate));
    const [priceMrp, setPriceMrp] = useState(isEditing ? String(sourceTxn?.priceMrp||"") : "");
    const [priceDiscount, setPriceDiscount] = useState(isEditing ? String(sourceTxn?.priceDiscount||"") : "");
    const [priceProcessingFee, setPriceProcessingFee] = useState(isEditing ? String(sourceTxn?.priceProcessingFee||"") : "");
    const [priceInterestRate, setPriceInterestRate] = useState(isEditing ? String(sourceTxn?.priceInterestRate||"") : "");
    const [splitMode, setSplitMode] = useState(initialTrackingMode); // none | split | tag | allocate | unified
    const [showAdvancedTracking, setShowAdvancedTracking] = useState(isEditing && ["split","tag","allocate"].includes(initialTrackingMode));
    const [splitGroup, setSplitGroup] = useState(isEditing && sourceTxn?.type==="expense" && initialTrackingMode==="split" ? (sourceTxn.groupId || "") : "");
    // Apply default group for new expenses
    useEffect(()=>{
      if(!isEditing && defaultGroupId && txnType==="expense" && !tagGroup && !splitGroup){
        const g = groups.find(x=>x.id===defaultGroupId);
        if(g){
          const di = g.defaultIntent||(g.typeId==="family"||g.typeId==="business"?"attributed":"split");
          if(di==="attributed"){ setTagGroup(defaultGroupId); setSplitMode("tag"); }
          else { setSplitGroup(defaultGroupId); setSplitMode("split"); }
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[]);
    const [tagGroup, setTagGroup] = useState(isEditing && sourceTxn?.type==="expense" && (initialTrackingMode==="tag"||initialTrackingMode==="split") ? (sourceTxn.groupId || "") : "");
    const initialAllocRows = isEditing && sourceTxn?.type==="expense" && initialTrackingMode==="allocate"
      ? (sourceTxn.allocations||[]).map(a=>({...a}))
      : [];
    const [allocRows, setAllocRows] = useState(initialAllocRows);
    const [allocTargetPicker, setAllocTargetPicker] = useState(null);
    const [tagMode, setTagMode] = useState(isEditing && sourceTxn?.type==="expense"
      ? (sourceTxn.tagMode ||
         (sourceTxn.tagItems?.length ? "itemize" :
         (sourceTxn.forPerson||sourceTxn.taggedPersonId) && sourceTxn.groupId ? "both" :
         (sourceTxn.forPerson||sourceTxn.taggedPersonId) ? (sourceTxn.splitMode==="tag"?"attribute":"person") :
         sourceTxn.groupId ? "group" : "person"))
      : "person");
    const [splitPeople, setSplitPeople] = useState(initialSplitPeople);
    const [splitCalc, setSplitCalc] = useState(isEditing && sourceTxn?.type==="expense" && Object.keys(initialSplitCustom).length ? "amount" : "equally"); // equally | amount | percent | share
    const [splitCustom, setSplitCustom] = useState(initialSplitCustom);
    const [tagPerson, setTagPerson] = useState(isEditing
      ? (sourceTxn.type==="settlement_in"
          ? sourceTxn.fromPersonId||""
          : sourceTxn.forPerson||sourceTxn.taggedPersonId||
            // F8: find person in people map with mode owes or spent_on
            Object.keys(sourceTxn.people||{}).find(pid=>pid!=="__me__")||"")
      : "");
    const [settlementTagGroup, setSettlementTagGroup] = useState(isEditing && sourceTxn?.type==="settlement_in" ? (sourceTxn.fromGroupId||"") : "");
    const [collectMap, setCollectMap] = useState(initialCollectMap);
    const [includeMeInSplit, setIncludeMeInSplit] = useState(isEditing ? Boolean(sourceTxn?.people?.__me__) : true);
    // Multi-person attribution with custom per-person amounts (e.g. 70/30), distinct from single-person
    // tag/owe flow and from group split/collect. Restored on edit from a people map with 2+ spent_on entries.
    const initialAttributeEntries = isEditing ? Object.entries(sourceTxn?.people||{}).filter(([pid,info])=>pid!=="__me__" && info?.mode==="spent_on") : [];
    const [attributePeople, setAttributePeople] = useState(()=> initialAttributeEntries.length>1 ? Object.fromEntries(initialAttributeEntries.map(([pid])=>[pid,true])) : {});
    const [attributeAmounts, setAttributeAmounts] = useState(()=> initialAttributeEntries.length>1 ? Object.fromEntries(initialAttributeEntries.map(([pid,info])=>[pid,String(info.amount||0)])) : {});
    const [catAllocations, setCatAllocations] = useState(isEditing ? (sourceTxn?.catAllocations || {}) : {});
    const [lastEditedCatId, setLastEditedCatId] = useState("");
    const [investType, setInvestType] = useState(isEditing ? (sourceTxn.investType || linkedInvestment?.type || "mf") : (safePrefill.investType||"mf"));
    const [investFreq, setInvestFreq] = useState(isEditing ? (sourceTxn.investFreq || linkedInvestment?.freq || "") : "");
    const [investFolio, setInvestFolio] = useState(isEditing ? (sourceTxn.investFolio || linkedInvestment?.folioNo || "") : (safePrefill.investFolio||""));
    const [investNav, setInvestNav] = useState(isEditing ? String(sourceTxn.investNav ?? linkedInvestment?.lastNav ?? "") : "");
    const [showFolioSuggestions, setShowFolioSuggestions] = useState(false);
    const [expensePaymentMode, setExpensePaymentMode] = useState("full");
    const [emiSourceType, setEmiSourceType] = useState("store");
    const [emiTenureMonths, setEmiTenureMonths] = useState("");
    const [emiAmount, setEmiAmount] = useState("");
    const [showEmiDownPayment, setShowEmiDownPayment] = useState(false);
    const [emiDownPayment, setEmiDownPayment] = useState("");
    const [reimbursable, setReimbursable] = useState(isEditing ? Boolean(sourceTxn?.reimbursable) : workTripMode);
    const [reimbursableAmount, setReimbursableAmount] = useState(isEditing && sourceTxn?.reimbursableAmount ? String(sourceTxn.reimbursableAmount) : "");
    const [emiDueDay, setEmiDueDay] = useState("");
    const [emiInterestRate, setEmiInterestRate] = useState("");
    const [emiInterestWaiver, setEmiInterestWaiver] = useState("");
    const [emiGstOnInterest, setEmiGstOnInterest] = useState("");
    const [isBillPayment, setIsBillPayment] = useState(isEditing ? Boolean(sourceTxn?.isBillPayment) : false);
    const [vehicleId, setVehicleId] = useState(isEditing ? (sourceTxn?.vehicleId||"") : "");
    const [tagPersonAmount, setTagPersonAmount] = useState(isEditing && sourceTxn?.tagPersonAmount ? String(sourceTxn.tagPersonAmount) : "");
    const [tagGroupAmount, setTagGroupAmount] = useState(isEditing && sourceTxn?.tagGroupAmount ? String(sourceTxn.tagGroupAmount) : "");
    const [tagItems, setTagItems] = useState(isEditing && sourceTxn?.tagItems?.length ? sourceTxn.tagItems.map(item=>({...item,amount:String(item.amount)})) : [{id:genId(),targetType:"person",targetId:"",amount:""}]);
    const [useItemizedLines, setUseItemizedLines] = useState(isEditing ? Boolean(sourceTxn?.lineItems?.length) : false);
    const [showItemSheet, setShowItemSheet] = useState(false);
    const [editingItemId, setEditingItemId] = useState(null);
    const [lineItems, setLineItems] = useState(
      isEditing && Array.isArray(sourceTxn?.lineItems) && sourceTxn.lineItems.length
        ? sourceTxn.lineItems.map(item=>({
            id:item.id||genId(),
            label:item.label||"",
            qty:String(item.qty ?? "1"),
            unit:item.unit||"nos",
            unitPrice:String(item.unitPrice ?? ""),
            catId:item.catId||"",
            subId:item.subId||"",
            splits:Array.isArray(item.splits)
              ? item.splits.map(split=>({
                  id:split.id||genId(),
                  targetType:split.targetType||"person",
                  targetId:split.targetId||"",
                  qty:String(split.qty ?? ""),
                }))
              : [],
          }))
        : [{ id:genId(), label:"", qty:"1", unit:"nos", unitPrice:"", catId:"", subId:"", splits:[] }]
    );
    const [billInvoiceNo, setBillInvoiceNo] = useState(isEditing ? (sourceTxn?.billInvoiceNo || "") : "");
    const [settlementKind, setSettlementKind] = useState(initialSettlementKind);
    const [refundPersonId, setRefundPersonId] = useState(null);
    const [refundLinkedExpenseId, setRefundLinkedExpenseId] = useState(
      isEditing && sourceTxn?.isRefund ? (sourceTxn.againstTxnId||null) : (refundPrefill?.id||null)
    );
    const [refundExpenseSearch, setRefundExpenseSearch] = useState("");
    const [transactionRef, setTransactionRef] = useState(isEditing ? (sourceTxn?.transactionRef || "") : "");
    const [refDupWarning, setRefDupWarning] = useState("");
    const [repaymentAllocations, setRepaymentAllocations] = useState(()=>Object.fromEntries((sourceTxn?.settlementLinks||[]).map(link=>[`${link.kind}:${link.id}`, String(link.amount||"")])));
    const [repaymentTouched, setRepaymentTouched] = useState(isEditing&&Boolean(sourceTxn?.settlementLinks?.length));
    const [repaymentPartialKey, setRepaymentPartialKey] = useState(null);
    // ── CC EMI state ──────────────────────────────────────────────────────────
    const firstCcAccId = accounts.find(a=>a.type==="cc")?.id || "";
    const [ccEmiCardId, setCcEmiCardId] = useState(isEditing && sourceTxn?.type==="cc_emi" ? (sourceTxn.accId||firstCcAccId) : firstCcAccId);
    const [ccEmiPlanId, setCcEmiPlanId] = useState(isEditing && sourceTxn?.type==="cc_emi" ? (sourceTxn.ccEmiPlanId||"") : "");
    const [ccEmiNewPlanMode, setCcEmiNewPlanMode] = useState(false);
    const [ccEmiNewName, setCcEmiNewName] = useState("");
    const [ccEmiNewTotal, setCcEmiNewTotal] = useState("");
    const [ccEmiNewTenure, setCcEmiNewTenure] = useState("");
    const [ccEmiNewMonthly, setCcEmiNewMonthly] = useState("");
    const [ccEmiNewRate, setCcEmiNewRate] = useState("");
    const activeCcEmiPlans = ccEmiPlans.filter(p=>p.cardId===ccEmiCardId && p.status!=="closed");
    const selectedEmiPlan = ccEmiPlans.find(p=>p.id===ccEmiPlanId) || null;
    const emiInstallmentNum = selectedEmiPlan ? txns.filter(t=>t.type==="cc_emi" && t.ccEmiPlanId===ccEmiPlanId).length + (isEditing ? 0 : 1) : 0;
    const addTagItem = () => {
      const remaining = Math.max(0, (parseFloat(amount)||0) - tagItemsTotal);
      setTagItems(prev=>[...prev,{id:genId(),targetType:"person",targetId:"",amount:remaining>0?String(parseFloat(remaining.toFixed(2))):""}]);
    };
    const removeTagItem = id => setTagItems(prev=>prev.filter(item=>item.id!==id));
    const updateTagItem = (id,field,value) => setTagItems(prev=>prev.map(item=>item.id===id?{...item,[field]:value}:item));
    const tagItemsTotal = tagItems.reduce((s,item)=>s+(parseFloat(item.amount)||0),0);
    const addLineItem = (preset=null) => setLineItems(prev=>[...prev,{ id:genId(), label:preset?.name||"", qty:"1", unit:preset?.unit||"nos", unitPrice:"", catId:preset?.catId||"", subId:preset?.subId||"", splits:[] }]);
    const removeLineItem = id => setLineItems(prev=>prev.length<=1 ? prev : prev.filter(item=>item.id!==id));
    const updateLineItem = (id, field, value) => setLineItems(prev=>prev.map(item=>{
      if(item.id!==id) return item;
      if(field==="qty" || field==="unitPrice"){
        if(value==="") return { ...item, [field]:"" };
        const n = parseFloat(value);
        return { ...item, [field]:String(Math.max(0, Number.isFinite(n)?n:0)) };
      }
      if(field==="catId") return { ...item, catId:value, subId:"" };
      return { ...item, [field]:value };
    }));
    const addLineSplit = itemId => setLineItems(prev=>prev.map(item=>item.id===itemId
      ? { ...item, splits:[...(item.splits||[]),{ id:genId(), targetType:"person", targetId:"", qty:"" }] }
      : item
    ));
    const removeLineSplit = (itemId, splitId) => setLineItems(prev=>prev.map(item=>item.id===itemId
      ? { ...item, splits:(item.splits||[]).filter(split=>split.id!==splitId) }
      : item
    ));
    const updateLineSplit = (itemId, splitId, field, value) => setLineItems(prev=>prev.map(item=>{
      if(item.id!==itemId) return item;
      return {
        ...item,
        splits:(item.splits||[]).map(split=>{
          if(split.id!==splitId) return split;
          if(field==="qty"){
            if(value==="") return { ...split, qty:"" };
            const n = parseFloat(value);
            return { ...split, qty:String(Math.max(0, Number.isFinite(n)?n:0)) };
          }
          if(field==="targetType") return { ...split, targetType:value, targetId:"" };
          return { ...split, [field]:value };
        })
      };
    }));
    const lineItemAmount = item => (parseFloat(item.qty)||0) * (parseFloat(item.unitPrice)||0);
    const lineItemsTotal = lineItems.reduce((sum,item)=>sum+lineItemAmount(item),0);
    const lineSplitQtyTotal = item => (item.splits||[]).reduce((sum,split)=>sum+(parseFloat(split.qty)||0),0);

    // ── auto-save draft ──
    const DRAFT_KEY = "arth_txn_draft";
    const [draftBanner, setDraftBanner] = useState(false);
    const [draftData, setDraftData] = useState(null);
    useEffect(()=>{
      if(isEditing) return;
      try{
        const raw=localStorage.getItem(DRAFT_KEY);
        if(!raw) return;
        const d=JSON.parse(raw);
        if(d?.who||d?.amount){ setDraftData(d); setDraftBanner(true); }
      }catch{}
    },[]);
    const restoreDraft = () => {
      if(!draftData) return;
      try{
        if(draftData.txnType) setTxnType(draftData.txnType);
        if(draftData.who) setWho(draftData.who);
        if(draftData.amount) setAmount(draftData.amount);
        if(draftData.date) setDate(draftData.date);
        if(draftData.note) setNote(draftData.note);
        if(draftData.accId) setAccId(draftData.accId);
        if(draftData.catIds) setCatIds(draftData.catIds);
        if(draftData.subIds) setSubIds(draftData.subIds);
        if(draftData.splitMode) setSplitMode(draftData.splitMode);
        if(typeof draftData.useItemizedLines === "boolean") setUseItemizedLines(draftData.useItemizedLines);
        if(draftData.lineItems?.length) setLineItems(draftData.lineItems);
        if(draftData.tagMode) setTagMode(draftData.tagMode);
        if(draftData.tagPerson) setTagPerson(draftData.tagPerson);
        if(draftData.tagGroup) setTagGroup(draftData.tagGroup);
        if(draftData.tagItems?.length) setTagItems(draftData.tagItems);
        if(draftData.splitPeople?.length) setSplitPeople(draftData.splitPeople);
        if(draftData.transactionRef) setTransactionRef(draftData.transactionRef);
      }catch{}
      setDraftBanner(false);
    };
    useEffect(()=>{
      if(isEditing) return;
      const t=setTimeout(()=>{
        try{ localStorage.setItem(DRAFT_KEY,JSON.stringify({txnType,who,amount,date,note,accId,catIds,subIds,splitMode,useItemizedLines,lineItems,tagMode,tagPerson,tagGroup,tagItems,splitPeople,transactionRef})); }catch{}
      },600);
      return ()=>clearTimeout(t);
    },[txnType,who,amount,date,note,accId,catIds,subIds,splitMode,useItemizedLines,lineItems,tagMode,tagPerson,tagGroup,tagItems,splitPeople,transactionRef,isEditing]);

    const closeModal = () => {
      try{ localStorage.removeItem(DRAFT_KEY); }catch{}
      setShowAdd(false);
      setRefundSourceTxn(null);
      setAddPrefill(null);
      setEditingTxn(null);
      onClose?.();
    };

    // Autocomplete state
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [categoryTouched, setCategoryTouched] = useState(isEditing);
    const [showQuickCategoryAdd, setShowQuickCategoryAdd] = useState(false);
    const [quickCatName, setQuickCatName] = useState("");
    const [quickSubName, setQuickSubName] = useState("");
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
    const addQuickCategory = useCallback(() => {
      const nextName = String(quickCatName || "").trim();
      if(!nextName) return;
      const starterSub = String(quickSubName || "").trim();
      const createdSubId = starterSub ? `sub_${genId()}` : null;
      const nextCat = {
        id:`cat_${genId()}`,
        name:nextName,
        icon:"🏷️",
        color:PALETTE[catsSnapshot.length % PALETTE.length] || T.accent,
        budget:0,
        subs:createdSubId ? [{ id:createdSubId, name:starterSub }] : [],
      };
      setCats(prev=>[...prev, nextCat]);
      setCategoryTouched(true);
      setCatIds(prev=>prev.includes(nextCat.id) ? prev : [...prev, nextCat.id]);
      if(createdSubId) setSubIds(prev=>prev.includes(createdSubId) ? prev : [...prev, createdSubId]);
      setQuickCatName("");
      setQuickSubName("");
    }, [quickCatName, quickSubName, catsSnapshot.length]);
    const addQuickSubcategory = useCallback(() => {
      const nextName = String(quickSubName || "").trim();
      const targetCatId = catIds[0] || "";
      if(!nextName || !targetCatId) return;
      const createdSubId = `sub_${genId()}`;
      setCats(prev=>prev.map(cat=>cat.id!==targetCatId ? cat : {
        ...cat,
        subs:[...(cat.subs||[]), { id:createdSubId, name:nextName }],
      }));
      setCategoryTouched(true);
      setSubIds(prev=>prev.includes(createdSubId) ? prev : [...prev, createdSubId]);
      setQuickSubName("");
    }, [quickSubName, catIds]);

    useEffect(() => {
      if(txnType !== "expense" || categoryTouched || !vendorCategorySuggestion) return;
      const sameCat = catIds.length===1 && catIds[0]===vendorCategorySuggestion.catId;
      const sameSub = (subIds[0]||null)===(vendorCategorySuggestion.subId||null);
      if(!sameCat || !sameSub) applySuggestedExpenseCategory(vendorCategorySuggestion);
    }, [vendorCategorySuggestion, txnType, categoryTouched, catIds, subIds, applySuggestedExpenseCategory]);

    useEffect(()=>{
      if(["split","tag","allocate"].includes(splitMode)) setShowAdvancedTracking(true);
    },[splitMode]);

    const validCatIds = catIds.filter(cid=>getCat(cid));
    const validSubIds = subIds.filter(sid=>validCatIds.some(cid=>getCat(cid)?.subs?.some(sub=>sub.id===sid)));
    const catId = validCatIds[0]||null;  // primary cat for backward compat
    const nonCCAccs = accounts.filter(a=>a.type!=="cc");
    const ccAccs = accounts.filter(a=>a.type==="cc");
    const investmentMetricConfig = getInvestmentMetricConfig(investType);
    const selectedPids = Object.entries(splitPeople).filter(([,v])=>v).map(([k])=>k).filter(p=>p!=="__me__");
    const priceNet = (parseFloat(priceMrp)||0) - (parseFloat(priceDiscount)||0);
    const priceRatePct = parseFloat(priceInterestRate)||0;
    const priceInterestAmt = priceNet > 0 && priceRatePct > 0 ? priceNet * priceRatePct / 1200 : 0;
    const priceGstAmt = priceInterestAmt > 0 ? priceInterestAmt * 0.18 : 0;
    const computedBreakdownTotal = showPriceBreakdown && priceMrp
      ? Math.max(0, priceNet + (parseFloat(priceProcessingFee)||0) + priceInterestAmt + priceGstAmt)
      : null;
    const amt = computedBreakdownTotal!==null ? computedBreakdownTotal : (parseFloat(amount)||0);
    const repaymentCandidates = useMemo(()=>{
      if(settlementKind!=="repayment") return [];
      const personItems = tagPerson ? getPersonReceivableItems(tagPerson) : [];
      const groupItems = settlementTagGroup ? getGroupReceivableItems(settlementTagGroup) : [];
      // Build a set of all IDs already covered by personItems, plus IDs of linked bill/txn counterparts
      const coveredIds = new Set(personItems.map(i=>i.id));
      personItems.forEach(item=>{
        if(item.kind==="bill"){
          const b = bills.find(x=>x.id===item.id);
          if(b?.paidByTxnId) coveredIds.add(b.paidByTxnId); // bill's linked txn is the same debt
        } else if(item.kind==="txn"){
          const t = txns.find(x=>x.id===item.id);
          if(t?.paidBillId) coveredIds.add(t.paidBillId); // txn's linked bill is the same debt
        }
      });
      const filteredGroupItems = groupItems.filter(i=>!coveredIds.has(i.id));
      const seen = new Set();
      return [...personItems, ...filteredGroupItems].filter(item=>{ if(seen.has(item.key)) return false; seen.add(item.key); return true; });
    },[settlementKind,tagPerson,settlementTagGroup,getPersonReceivableItems,getGroupReceivableItems,bills,txns]);
    const buildRepaymentAllocations = useCallback(total=>{
      let left = Math.max(0, Number(total||0));
      const next = {};
      repaymentCandidates.forEach(item=>{
        const applied = Math.min(left, Number(item.amount||0));
        if(applied>0){ next[item.key] = String(Math.round(applied*100)/100); left -= applied; }
      });
      return next;
    },[repaymentCandidates]);
    const repaymentAllocTotal = useMemo(()=>repaymentCandidates.reduce((sum,item)=>sum+Math.min(Number(repaymentAllocations[item.key]||0), Number(item.amount||0)),0),[repaymentCandidates,repaymentAllocations]);
    const repaymentExtra = Math.max(0, amt-repaymentAllocTotal);
    const updateRepaymentAllocation = (key,value,max)=>{
      setRepaymentTouched(true);
      const safe = value==="" ? "" : String(Math.min(Math.max(0, parseFloat(value)||0), Number(max||0)));
      setRepaymentAllocations(prev=>({...prev,[key]:safe}));
    };
    useEffect(()=>{
      if(isEditing) return;
      if(settlementKind!=="repayment"||(!tagPerson&&!settlementTagGroup)){ setRepaymentAllocations({}); setRepaymentTouched(false); return; }
      if(!repaymentTouched) setRepaymentAllocations(buildRepaymentAllocations(amt));
    },[isEditing,settlementKind,tagPerson,settlementTagGroup,amt,repaymentTouched,buildRepaymentAllocations]);
    const splitEvenAmounts = useCallback((total,count)=>{
      if(!(total>0) || !(count>0)) return Array.from({ length:Math.max(0,count) },()=>0);
      const totalCents = Math.round(total*100);
      const base = Math.floor(totalCents/count);
      let remainder = totalCents - (base*count);
      return Array.from({ length:count },()=>{
        const next = base + (remainder>0 ? 1 : 0);
        if(remainder>0) remainder -= 1;
        return next/100;
      });
    },[]);
    const buildEqualCategoryAllocations = useCallback((ids,total)=>{
      if(!Array.isArray(ids) || ids.length<=1) return {};
      const parts = splitEvenAmounts(Math.max(0,total||0), ids.length);
      return Object.fromEntries(ids.map((id,idx)=>[id, String(parts[idx]||0)]));
    },[splitEvenAmounts]);
    const updateCategoryAllocation = useCallback((ids, changedId, rawValue, total, current)=>{
      if(!Array.isArray(ids) || ids.length<=1) return current||{};
      const totalAmt = Math.max(0, Number(total||0));
      const next = { ...(current||{}) };
      ids.forEach(id=>{ if(next[id]===undefined) next[id] = "0"; });
      const othersTotal = ids.filter(id=>id!==changedId).reduce((sum,id)=>sum+(parseFloat(next[id])||0),0);
      const maxForChanged = Math.max(0, totalAmt-othersTotal);
      if(rawValue===""){
        next[changedId] = "";
        return next;
      }
      const parsed = parseFloat(rawValue);
      const safe = Number.isFinite(parsed) ? Math.max(0, Math.min(maxForChanged, parsed)) : 0;
      next[changedId] = String(Math.round(safe*100)/100);
      return next;
    },[]);
    useEffect(()=>{
      if(txnType!=="expense" || catIds.length<=1) return;
      // Only backfill categories that have never been given a value at all (key missing entirely).
      // Previously this checked for non-empty values too, so clearing one field to type a new number
      // (e.g. clearing "50" to type "70") looked identical to "never set" and reset the whole map back
      // to an equal split before the new digit could be typed.
      const hasAllKeys = catIds.every(cid=>catAllocations[cid]!==undefined);
      if(hasAllKeys) return;
      setCatAllocations(prev=>({ ...buildEqualCategoryAllocations(catIds, amt), ...prev }));
    },[txnType,catIds,amt,catAllocations,buildEqualCategoryAllocations]);
    const attributePersonIds = Object.keys(attributePeople).filter(pid=>attributePeople[pid]);
    useEffect(()=>{
      if(attributePersonIds.length<=1) return;
      const hasAllKeys = attributePersonIds.every(pid=>attributeAmounts[pid]!==undefined);
      if(hasAllKeys) return;
      setAttributeAmounts(prev=>({ ...buildEqualCategoryAllocations(attributePersonIds, amt), ...prev }));
    },[attributePersonIds.join(","),amt,attributeAmounts,buildEqualCategoryAllocations]);
    const emiDownPaymentValue = showEmiDownPayment ? Math.min(amt, Math.max(0, parseMoney(emiDownPayment)||0)) : 0;
    const financedAmount = Math.max(0, amt - emiDownPaymentValue);
    const investmentSuggestions = useMemo(()=>{
      if(txnType!=="investment") return [];
      const folioQuery = normalizeVendorText(investFolio);
      const nameQuery = normalizeVendorText(who);
      return investmentTemplateOptions
        .filter(template=>{
          if(!folioQuery && !nameQuery) return true;
          const templateFolio = normalizeVendorText(template.folioNo);
          const templateName = normalizeVendorText(template.name);
          return (folioQuery && (templateFolio.includes(folioQuery) || folioQuery.includes(templateFolio))) || (nameQuery && templateName.includes(nameQuery));
        })
        .slice(0,5);
    },[txnType,investFolio,who,investmentTemplateOptions]);
    const applyInvestmentTemplate = useCallback(template=>{
      if(!template) return;
      setInvestType(template.type || "mf");
      setInvestFolio(template.folioNo || "");
      if(template.name) setWho(template.name);
      if(Number(template.amount||0)>0) setAmount(String(template.amount));
      setInvestFreq(template.freq || "");
      if(template.accId) setAccId(template.accId);
      if(Number(template.nav||0)>0) setInvestNav(String(template.nav));
      // B12 FIX: Do not lock date to folio start date - user sets their own date
      // if(template.startDate) setDate(template.startDate);
      setShowFolioSuggestions(false);
    },[]);

    const lockedInvestFolioStartDate = useMemo(()=>{
      if(txnType!=="investment" || investType!=="mf") return "";
      const folioKey = normalizeVendorText(investFolio);
      if(!folioKey) return "";
      const matches = trackedInvestments
        .filter(inv=>String(inv.type||"mf")==="mf" && normalizeVendorText(inv.folioNo)===folioKey)
        .filter(inv=>!isEditing || String(inv.linkedTxnId||"")!==String(sourceTxn?.id||""))
        .map(inv=>inv.startDate)
        .filter(Boolean)
        .sort();
      return matches[0] || "";
    },[txnType,investType,investFolio,trackedInvestments,isEditing,sourceTxn]);

    useEffect(()=>{
      if(txnType!=="investment" || investType!=="mf") return;
      const folioQuery = normalizeVendorText(investFolio);
      if(!folioQuery) return;
      const exactMatch = investmentTemplateOptions.find(template=>template.folioNo && normalizeVendorText(template.folioNo)===folioQuery);
      if(exactMatch) applyInvestmentTemplate(exactMatch);
    },[txnType,investType,investFolio,investmentTemplateOptions,applyInvestmentTemplate]);

    // Don't override transaction date with folio start date
    // lockedInvestFolioStartDate is only for the investment record's startDate, not the txn date
    // useEffect(()=>{
    //   if(lockedInvestFolioStartDate && date !== lockedInvestFolioStartDate) setDate(lockedInvestFolioStartDate);
    // },[lockedInvestFolioStartDate,date]);

    useEffect(()=>{
      if(txnType!=="expense" || expensePaymentMode!=="emi") return;
      if(!emiDueDay){
        const defaultDay = toDateOnly(date)?.getDate() || new Date().getDate();
        setEmiDueDay(String(defaultDay));
      }
      const tenureNum = Math.max(0, parseInt(emiTenureMonths||0,10) || 0);
      if(tenureNum>0 && financedAmount>0){
        const suggestedEmi = Math.round((financedAmount/tenureNum) * 100) / 100;
        if(suggestedEmi>=0) setEmiAmount(String(suggestedEmi));
      } else {
        setEmiAmount("");
      }
    },[txnType,expensePaymentMode,emiTenureMonths,financedAmount,date,emiDueDay]);

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

    // EMI SMS auto-link helper
    const tryAutoLinkEmi = (parsedAmt, parsedMerchant) => {
      if(!parsedAmt) return;
      const emiLoans = loans.filter(l=>l.status==="active"&&l.sourceType&&l.emiAmount>0);
      const match = emiLoans.find(l=>{
        const amtMatch = Math.abs(Number(l.emiAmount||0)-parsedAmt)<2;
        const nameMatch = parsedMerchant ? (l.name||"").toLowerCase().includes(parsedMerchant.toLowerCase().slice(0,4)) : false;
        return amtMatch || nameMatch;
      });
      if(match && !billerLinkId){
        setSmsParseMeta(prev=>prev?{...prev,emiLoanId:match.id,emiLoanName:match.name}:prev);
      }
    };
    const parseSms = (txt, options={}) => {
      setSmsRaw(txt);
      if(!txt.trim()){
        setSmsParseMeta(null);
        return;
      }

      // Strip warning / fraud footer text before parsing.
      const safe = txt
        .replace(/not you[?.]?.*/i,"")
        .replace(/call.*\d{10}.*/i,"")
        .replace(/helpline.*/i,"")
        .replace(/block.*/i,"")
        .replace(/to dispute.*/i,"")
        .replace(/report.*/i,"")
        .replace(/\b\d{10,}\b/g,"");

      const amtM = safe.match(/(?:Rs\.?|INR|\u20b9)\s*([\d,]+(?:\.\d{1,2})?)/i);
      if(amtM) setAmount(amtM[1].replace(/,/g,""));

      const clean = safe;
      const skip = ["a/c","ac","account","bank","clearing","neft","imps","upi","ref","txn","card"];

      // 1. UPI VPA vendor extraction (most reliable): pick handle before @
      const vpaMatch =
        safe.match(/(?:VPA|UPI\s*(?:Id|ID|vpa)?)\s*[:=.]\s*([a-zA-Z][a-zA-Z0-9._-]{1,}?)@[a-zA-Z0-9.-]+/i) ||
        safe.match(/UPI\/[A-Z0-9]+\/[0-9]+\/([a-zA-Z][a-zA-Z0-9._-]{1,}?)@[a-zA-Z0-9.-]+/i) ||
        safe.match(/\bto\s+([a-zA-Z][a-zA-Z0-9._-]{2,}?)@[a-zA-Z]{3,}\b/i);
      let merchant = "";
      if(vpaMatch){
        const handle = vpaMatch[1].replace(/\d+$/,"").replace(/[._-]/g," ").replace(/\s+/g," ").trim();
        if(handle.length>=3 && !/^\d+$/.test(handle) && !skip.some(w=>handle.toLowerCase()===w))
          merchant = handle.charAt(0).toUpperCase()+handle.slice(1).toLowerCase();
      }
      // 2. Fallback: keyword-based merchant name
      if(!merchant){
        const mercM = clean.match(/(?:at|to|for|towards)\s+([A-Za-z0-9][A-Za-z0-9 ]{2,25}?)(?:\s+on|\s+via|\s+ref|\.|,|$)/i);
        const m = mercM?.[1]?.trim();
        if(m && !skip.some(w=>m.toLowerCase().includes(w))) merchant = m;
      }
      if(merchant) setWho(merchant);

      const parsedDate = extractDateFromText(safe);
      if(parsedDate) setDate(parsedDate);

      const lower = safe.toLowerCase();
      const direction = detectSmsDirection(safe);
      const isCcPayment = /(?:bill pay|billpay|credit card.*(?:bill|payment|pay)|payment towards(?: your)? credit card|cc.*payment)/i.test(lower);
      const isTransfer = !isCcPayment && /(?:self\s+transfer|transfer(?:red)?\s+to\s+(?:your|own)|from\s+a\/c.*to\s+a\/c|to\s+own\s+a\/c)/i.test(lower);
      const parsedType = isCcPayment ? "cc_payment" : isTransfer ? "transfer" : direction==="credit" ? "income" : direction==="debit" ? "expense" : txnType;

      // Only auto-switch type for cc_payment and transfer (unambiguous)
      // For income/expense: only switch if form is still on default expense with no data entered
      const formIsBlank = !amount || parseFloat(amount)===0;
      if(parsedType==="cc_payment"){
        setTxnType("cc_payment");
        setWho("");
      } else if(parsedType==="transfer"){
        setTxnType("transfer");
      } else if(!userSetTxnType){
        if(parsedType==="income" && formIsBlank && txnType==="expense"){
          setTxnType("income");
        } else if(parsedType==="expense" && formIsBlank && txnType!=="income"){
          setTxnType("expense");
        }
      }
      // Never switch away from a type the user has explicitly chosen

      const accountMatches = findSmsAccountMatches(safe, accounts);
      const last4s = extractSmsLast4s(safe);
      const matchedCard = accountMatches.find(item=>item.account?.type==="cc")?.account || null;
      const matchedNonCard = accountMatches.find(item=>item.account?.type!=="cc")?.account || null;
      const exactLast4Account = last4s.length
        ? accountMatches.find(item=>{
            const accLast4 = String(item.account?.last4 || "").trim();
            return accLast4 && last4s.includes(accLast4);
          })?.account || null
        : null;
      const primaryAccount = exactLast4Account || accountMatches[0]?.account || null;

      if(parsedType==="cc_payment"){
        if(matchedNonCard) setFromAccId(matchedNonCard.id);
        if(matchedCard) setToAccId(matchedCard.id);
      } else if(parsedType==="transfer"){
        if(accountMatches[0]?.account) setFromAccId(accountMatches[0].account.id);
        if(accountMatches[1]?.account) setToAccId(accountMatches[1].account.id);
        else if(primaryAccount) setAccId(primaryAccount.id);
      } else if(parsedType==="income"){
        if((matchedNonCard || primaryAccount)) setAccId((matchedNonCard || primaryAccount).id);
      } else if(primaryAccount){
        setAccId(primaryAccount.id);
      }

      const matchedLabel = parsedType==="cc_payment" && matchedNonCard && matchedCard
        ? `${accIcon(matchedNonCard.type)} ${matchedNonCard.name}${matchedNonCard.last4?` ···${matchedNonCard.last4}`:""} → ${accIcon(matchedCard.type)} ${matchedCard.name}${matchedCard.last4?` ···${matchedCard.last4}`:""}`
        : primaryAccount
          ? `${accIcon(primaryAccount.type)} ${primaryAccount.name}${primaryAccount.last4?` ···${primaryAccount.last4}`:""}`
          : "";
      const parsedTxnRef = extractTxnReference(txt);
      if(parsedTxnRef) setTransactionRef(parsedTxnRef);

      let balanceAdjusted = false;
      let smsBalance = null;
      let balanceDiff = 0;
      if(options.adjustBalance && primaryAccount && primaryAccount.type!=="cc"){
        smsBalance = extractSmsBalance(txt);
        if(smsBalance !== null){
          const appBal = accountBalance(primaryAccount.id);
          balanceDiff = smsBalance - appBal;
          // Don't auto-adjust balance during paste — it triggers full re-render
          // Only adjust when explicitly called from balance sync, not during SMS parse
          if(Math.abs(balanceDiff) > 0.01 && options.forceAdjust){
            setAccounts(prev=>prev.map(a=>a.id===primaryAccount.id?{...a,openingBalance:Number(a.openingBalance||0)+balanceDiff}:a));
            balanceAdjusted = true;
          }
        }
      }

      setSmsParseMeta({
        direction,
        parsedType,
        matchedLabel,
        last4: last4s[0] || "",
        smsBalance,
        balanceAdjusted,
        balanceDiff,
      });
      // Try auto-link EMI loan
      if(parsedAmt && parsedType==="expense") tryAutoLinkEmi(parsedAmt, merchant);
    };

    const importSms = async mode => {
      setSmsBusy(true);
      setSmsImportStatus("");
      try{
        const result = mode === "phone" ? await readLatestPhoneSms() : await readCopiedSms();
        const text = String(result?.text || "").trim();
        if(!text) throw new Error("No SMS text found.");
        setShowSms(true);
        setSmsTxt(text);
        parseSms(text, { adjustBalance: true });
        setSmsImportStatus(result?.source === "phone" ? "Imported from phone SMS." : "Imported from copied SMS.");
      }catch(err){
        setSmsImportStatus(err?.message || "Unable to import SMS.");
      }finally{
        setSmsBusy(false);
      }
    };

    const hasTxnSubject = Boolean(
      who.trim() ||
      note.trim() ||
      (isEditing && (sourceTxn?.merchant || sourceTxn?.desc || sourceTxn?.note)) ||
      txnType==="cc_payment" ||
      txnType==="transfer" ||
      txnType==="settlement_in" ||
      txnType==="cc_emi"
    );

    const submit = () => {
      if(!hasTxnSubject){ setRefDupWarning("Enter a vendor/note before saving."); return; }
      if(!amt){ setRefDupWarning("Enter an amount before saving."); return; }
      setRefDupWarning("");
      // Duplicate UPI/bank ref is only a warning now — never blocks the save (previously used alert(), which
      // could silently fail to render in some WebViews, making Save look like it did nothing).
      if(transactionRef.trim()){
        const refConflict = txns.find(x => x.transactionRef === transactionRef.trim() && String(x.id) !== String(sourceTxn?.id||""));
        if(refConflict) setRefDupWarning(`Note: UPI/bank ref "${transactionRef.trim()}" is already used on another transaction — saved anyway.`);
      }
      const resolvedTxnId = isEditing ? sourceTxn.id : Date.now();
      const baseLabel = who.trim() || sourceTxn?.desc || sourceTxn?.merchant || note.trim() || "";
      const base = {
        ...(sourceTxn || {}),
        id:resolvedTxnId,
        createdAt:sourceTxn?.createdAt || (Number.isFinite(Number(resolvedTxnId)) ? Number(resolvedTxnId) : Date.now()),
        updatedAt:Date.now(),
        type:txnType,
        desc:(txnType==="cc_payment"||txnType==="transfer") ? (baseLabel || txnLabel(txnType)) : baseLabel,
        merchant:(txnType==="cc_payment"||txnType==="transfer") ? "" : (baseLabel || sourceTxn?.merchant || ""),
        date,
        note:note.trim(),
        smsRaw,
        imageBase64,
        transactionRef:transactionRef.trim()||null,
        billerLinkId:billerLinkId||undefined,
        discount:discount?parseFloat(discount):undefined,
        guestPerson:guestPersonName.trim()||undefined,
        guestPersonAmount:guestPersonAmount?parseFloat(guestPersonAmount):undefined,
      };
      const upsertTxn = nextTxn => {
        setTxns(prev=>isEditing
          ? prev.map(txn=>String(txn.id)===String(resolvedTxnId) ? nextTxn : txn)
          : [nextTxn,...prev]
        );
      };

      // Duplicate transaction warning — non-blocking (window.confirm() has the same silent-failure risk as
      // alert() did: if it doesn't render in some WebViews, it auto-resolves to false and would silently
      // cancel the save). Warn inline instead, and let the save proceed.
      if(!isEditing && txnType==="expense" && amt>0){
        const dupWindow = 5*60*1000; // 5 minutes
        const dup = txns.find(t=>t.type==="expense" && Math.abs(t.amount-amt)<0.01 && String(t.accId)===String(accId) && Math.abs(Date.now()-(t.createdAt||0))<dupWindow);
        if(dup) setRefDupWarning(`Note: a matching ${sym}${fmt(amt)} expense from this account was recorded ${Math.round((Date.now()-(dup.createdAt||0))/60000)} minute(s) ago — saved anyway.`);
      }
      // Create membership record if linked biller is membership type
      if(billerLinkId && showMembershipPanel && linkedBAType==="membership" && linkValidFrom && !isEditing){
        const memRecord = {
          id: genId(),
          billerAccountId: billerLinkId,
          personId: linkMemberPersonId,
          amount: parseFloat(amount)||0,
          cycle: linkCycle,
          bulkMonths: Number(linkBulkMonths),
          graceDays: Number(linkGraceDays||0),
          validFrom: linkValidFrom,
          validUntil: linkValidUntil,
          txnId: resolvedTxnId,
          paidDate: date,
          createdAt: Date.now(),
          status: "active",
        };
        setMemberships(prev=>[memRecord,...prev]);
      }
      if(txnType==="expense"){
        if(expensePaymentMode==="emi"){
          const dueDayNum = Math.max(1, Math.min(31, parseInt(emiDueDay || (toDateOnly(date)?.getDate() || new Date().getDate()), 10) || new Date().getDate()));
          const upfrontPaid = emiDownPaymentValue;
          const remainingBalance = financedAmount;
          if(upfrontPaid>0){
            const downPaymentTxn = {
              ...base,
              id:resolvedTxnId,
              amount:upfrontPaid,
              catId,
              catIds:catIds.length ? catIds : (catId ? [catId] : []),
              subId:subIds[0]||null,
              subIds,
              accId,
              note:[note.trim(), `Down payment for ${who.trim() || "item"}`].filter(Boolean).join(" · "),
            };
            setTxns(prev=>[downPaymentTxn,...(isEditing ? prev.filter(txn=>String(txn.id)!==String(resolvedTxnId)) : prev)]);
            if(!isEditing && getAcc(accId).type==="cc") setAccounts(prev=>prev.map(a=>a.id===accId?{...a,outstanding:(a.outstanding||0)+upfrontPaid}:a));
          } else if(isEditing){
            setTxns(prev=>prev.filter(txn=>String(txn.id)!==String(resolvedTxnId)));
          }
          if(remainingBalance>0){
            const tenureNum = Math.max(0, parseInt(emiTenureMonths||0,10) || 0);
            const emiAmt = Math.max(0, parseMoney(emiAmount)||0);

            // Auto-schedule installment transactions for CC EMI
            const autoInstallments = [];
            if(emiSourceType==="cc" && tenureNum>0 && emiAmt>0){
              const ccAcc = getAcc(accId);
              const stmtDay = Number(ccAcc?.statementDate || dueDayNum || 15);
              const purchaseDate = new Date((date || todayStr()) + "T00:00:00");
              let cursor = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), stmtDay);
              if(cursor <= purchaseDate) cursor = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth()+1, stmtDay);
              const instCatIds = catIds.length ? catIds : (catId ? [catId] : ["financial"]);
              for(let i=0; i<tenureNum; i++){
                autoInstallments.push({
                  id:genId(),
                  type:"expense",
                  desc:`EMI ${i+1}/${tenureNum} – ${who.trim() || note.trim() || "EMI purchase"}`,
                  merchant:who.trim() || "EMI purchase",
                  date:cursor.toISOString().split("T")[0],
                  note:`CC EMI installment ${i+1} of ${tenureNum}`,
                  amount:emiAmt,
                  accId,
                  catId:instCatIds[0],
                  catIds:instCatIds,
                  subId:subIds[0]||null,
                  subIds,
                  isAutoEmiInstallment:true,
                  emiInstallmentNum:i+1,
                  emiTotalInstallments:tenureNum,
                  trackingMode:"none",
                  people:{},
                });
                cursor = new Date(cursor.getFullYear(), cursor.getMonth()+1, stmtDay);
              }
            }

            const nextLoan = {
              id:genId(),
              direction:"taken",
              name:who.trim() || note.trim() || "EMI purchase",
              principal:remainingBalance,
              outstanding:remainingBalance,
              startDate:date || todayStr(),
              dueDate:getNextDueDate(date || todayStr(), dueDayNum),
              dueDay:dueDayNum,
              tenureMonths:tenureNum,
              hasInterest:Number(emiInterestRate||0)>0,
              interestRate:Math.max(0, parseFloat(emiInterestRate)||0),
              emiInterestWaiver:emiInterestWaiver?parseFloat(emiInterestWaiver):undefined,
              emiGstOnInterest:emiGstOnInterest?parseFloat(emiGstOnInterest):undefined,
              emiAmount:emiAmt,
              paymentAccId:accId || nonCCAccs[0]?.id || "",
              sourceType:emiSourceType,
              paymentMode:"emi",
              isEmiPlan:true,
              autoScheduled:autoInstallments.length>0,
              scheduledInstallmentIds:autoInstallments.map(t=>t.id),
              expenseCatId:catId || "financial",
              expenseCatIds:catIds.length ? catIds : (catId ? [catId] : ["financial"]),
              expenseSubId:subIds[0]||null,
              expenseSubIds:subIds,
              note:[
                note.trim(),
                upfrontPaid>0 ? `Down payment ${sym}${fmt(upfrontPaid)} paid upfront.` : "",
                `Balance ${sym}${fmt(remainingBalance)} moved to ${emiSourceType.replace(/_/g," ")} EMI.`
              ].filter(Boolean).join(" · "),
              repayments:[],
              status:"active",
            };
            setLoans(prev=>[nextLoan,...prev]);
            if(autoInstallments.length>0) setTxns(prev=>[...autoInstallments,...prev]);
          }
          try{ localStorage.removeItem(DRAFT_KEY); }catch{}
          closeModal();
          return;
        }
        const shares = splitMode==="split"?calcShares():{};
        const psplit = {};
        Object.entries(shares).forEach(([pid,sh])=>{
          const collect = collectMap[pid]!==undefined ? collectMap[pid] : getPerson(pid).personType!=="dependant";
          psplit[pid] = { amount:sh, mode:collect?"owes":"spent_on" };
        });
        const lineItemUnitPriceById = Object.fromEntries(
          (lineItems||[]).map(item=>{
            const qty = Math.max(0, parseFloat(item.qty)||0);
            const unit = Math.max(0, parseFloat(item.unitPrice)||0);
            const fallbackAmount = Math.max(0, parseFloat(item.amount)||0);
            return [item.id, qty>0 ? unit : fallbackAmount];
          })
        );
        const allocItemAmount = item=>{
          if(item?.sourceItemId){
            const unit = Number(lineItemUnitPriceById[item.sourceItemId]||0);
            return Math.max(0, (parseFloat(item.qty)||0) * unit);
          }
          return Math.max(0, parseFloat(item?.amount)||0);
        };
        // Allocate mode: build psplit + groupAllocations from allocRows
        const groupAllocationsVal = [];
        if(splitMode==="allocate" || splitMode==="unified"){
          allocRows.forEach(row=>{
            if(!row.targetId) return;
            const rowAmt = row.items?.length
              ? row.items.reduce((s,i)=>s+allocItemAmount(i),0)
              : parseFloat(row.amount)||0;
            if(!(rowAmt>0)) return;
            if(row.targetType==="person"){
              psplit[row.targetId] = { amount:rowAmt, mode:row.mode==="i_owe"?"owes_by_me":row.mode };
            } else {
              groupAllocationsVal.push({ groupId:row.targetId, amount:rowAmt, mode:row.mode });
            }
          });
        }
        const splitTotal = Object.values(shares).reduce((sum,val)=>sum+Number(val||0),0);
        if(splitMode==="split"){
          const percentTotal = selectedPids.reduce((sum,pid)=>sum+(parseFloat(splitCustom[pid])||0),0);
          if(splitCalc==="percent" && percentTotal > 100.01){
            alert("Split percentages cannot exceed 100% of the bill.");
            return;
          }
          if(splitTotal > amt+0.01){
            alert("Split amount cannot exceed the total expense amount.");
            return;
          }
        }
        if(splitMode==="allocate" || splitMode==="unified"){
          const qtyBySource = {};
          allocRows.forEach(row=>{
            (row.items||[]).forEach(item=>{
              if(!item?.sourceItemId) return;
              qtyBySource[item.sourceItemId] = (qtyBySource[item.sourceItemId]||0) + Math.max(0, parseFloat(item.qty)||0);
            });
          });
          const qtyOver = Object.entries(qtyBySource).find(([sid,qty])=>qty > (Math.max(0, parseFloat((lineItems||[]).find(li=>li.id===sid)?.qty)||0) + 0.0001));
          if(qtyOver){
            const src = (lineItems||[]).find(li=>li.id===qtyOver[0]);
            alert(`Allocated qty for item \"${src?.label||"Unnamed item"}\" exceeds bought qty.`);
            return;
          }
          const allocTotal = allocRows.reduce((sum,row)=>{
            if(!row.targetId) return sum;
            const rowAmt = row.items?.length
              ? row.items.reduce((s,i)=>s+allocItemAmount(i),0)
              : parseFloat(row.amount)||0;
            return sum + Math.max(0,rowAmt);
          },0);
          if(allocTotal > amt+0.01){
            alert("Allocated total cannot exceed the total expense amount.");
            return;
          }
        }
        const tagAmt=(splitMode==="tag" && (tagMode==="person"||tagMode==="both") && tagPersonAmount && parseFloat(tagPersonAmount)>0) ? parseFloat(tagPersonAmount) : (splitMode==="tag" && (tagMode==="person"||tagMode==="both") ? amt : null);
        const tagGrpAmt=(splitMode==="tag" && tagMode==="both" && tagGroupAmount && parseFloat(tagGroupAmount)>0) ? parseFloat(tagGroupAmount) : null;
        const savedTagItems=splitMode==="tag" && tagMode==="itemize" ? tagItems.filter(item=>item.targetId&&parseFloat(item.amount)>0).map(item=>({id:item.id,targetType:item.targetType,targetId:item.targetId,amount:parseFloat(item.amount)})) : null;
        if(splitMode==="tag"){
          if(tagMode==="itemize"){
            const itemizedTotal = (savedTagItems||[]).reduce((sum,item)=>sum+Number(item.amount||0),0);
            if(itemizedTotal > amt+0.01){
              alert("Itemized total cannot exceed the total expense amount.");
              return;
            }
          } else {
            const taggedTotal = Number(tagAmt||0) + Number(tagGrpAmt||0);
            if(taggedTotal > amt+0.01){
              alert("Tagged amount cannot exceed the total expense amount.");
              return;
            }
          }
        }
        const forPersonVal = splitMode==="tag" && (tagMode==="person"||tagMode==="both"||tagMode==="attribute") ? tagPerson : "";
        const groupIdVal = splitMode==="split" ? (splitGroup||null)
          : (splitMode==="allocate" || splitMode==="unified") ? (groupAllocationsVal[0]?.groupId||null)
          : (splitMode==="tag" && (tagMode==="group"||tagMode==="both"||tagMode==="attribute") ? (tagGroup||null) : null);
        let catAllocNumeric = Object.fromEntries(Object.entries(catAllocations||{}).map(([cid,val])=>[cid,parseFloat(val)||0]));
        if(catIds.length>1){
          const baseMap = Object.fromEntries(catIds.map(cid=>[cid,Math.max(0,Number(catAllocNumeric[cid]||0))]));
          const currentTotal = Object.values(baseMap).reduce((s,v)=>s+v,0);
          const diff = Math.round((amt-currentTotal)*100)/100;
          if(Math.abs(diff)>=0.01){
            const targetId = (lastEditedCatId && catIds.includes(lastEditedCatId)) ? lastEditedCatId : catIds[catIds.length-1];
            baseMap[targetId] = Math.max(0, Math.round((Number(baseMap[targetId]||0)+diff)*100)/100);
          }
          const adjustedTotal = Object.values(baseMap).reduce((s,v)=>s+v,0);
          const finalDiff = Math.round((amt-adjustedTotal)*100)/100;
          if(Math.abs(finalDiff)>=0.01){
            const fallbackId = catIds[catIds.length-1];
            baseMap[fallbackId] = Math.max(0, Math.round((Number(baseMap[fallbackId]||0)+finalDiff)*100)/100);
          }
          catAllocNumeric = baseMap;
          setCatAllocations(prev=>{
            const next = { ...prev };
            catIds.forEach(cid=>{ next[cid] = String(catAllocNumeric[cid]||0); });
            return next;
          });
        }
        const categorySplitTotal = Object.values(catAllocNumeric).reduce((s,v)=>s+v,0);
        const hasCategorySplit = catIds.length>1 && Math.abs(categorySplitTotal - amt) < 0.01;
        const normalizedLineItems = useItemizedLines
          ? lineItems
              .map(item=>{
                const qty = Math.max(0, parseFloat(item.qty)||0);
                const unitPrice = Math.max(0, parseFloat(item.unitPrice)||0);
                const amountVal = qty * unitPrice;
                const normalizedSplits = (item.splits||[])
                  .map(split=>({
                    id:split.id||genId(),
                    targetType:split.targetType||"person",
                    targetId:split.targetId||null,
                    qty:Math.max(0, parseFloat(split.qty)||0),
                  }))
                  .filter(split=>split.targetId && split.qty>0);
                return {
                  id:item.id||genId(),
                  label:String(item.label||"").trim(),
                  qty,
                  unitPrice,
                  amount:Math.round(amountVal*100)/100,
                  catId:item.catId||null,
                  subId:item.subId||null,
                  splits:normalizedSplits.length ? normalizedSplits : null,
                };
              })
              .filter(item=>item.label || item.amount>0 || item.catId)
          : null;
        if(useItemizedLines && normalizedLineItems?.length){
          const itemsTotal = normalizedLineItems.reduce((sum,item)=>sum+Number(item.amount||0),0);
          // Mismatch is allowed - could be delivery/processing fees not in items
          // Just warn, never block
          const qtyOverAllocated = normalizedLineItems.find(item=>{
            const splitQty = (item.splits||[]).reduce((sum,split)=>sum+Number(split.qty||0),0);
            return splitQty > Number(item.qty||0) + 0.0001;
          });
          if(qtyOverAllocated){
            alert(`Item split qty cannot exceed item qty for "${qtyOverAllocated.label||"Unnamed item"}".`);
            return;
          }
        }
        const matchedBill = bills.find(b=>b.status==="unpaid"&&b.catId===catId&&b.amount>0&&b.amount===amt);
        const owedByOthers = (splitMode==="allocate" || splitMode==="unified")
          ? Object.values(psplit).reduce((s,info)=>s+(info.mode==="owes"?Number(info.amount||0):0),0)
          : Object.entries(psplit).reduce((sum,[,info])=>sum+(info.mode==="owes"?Number(info.amount||0):0),0);
        const myImplicitShare = splitMode==="split" && includeMeInSplit ? Math.max(0, amt-owedByOthers) : 0;
        const groupCollectiveAmount = (splitMode==="allocate" || splitMode==="unified")
          ? groupAllocationsVal.filter(g=>g.mode==="owes").reduce((s,g)=>s+g.amount,0)
          : (groupIdVal && splitMode==="split" ? Math.max(0, amt-owedByOthers-myImplicitShare) : 0);
        const normalizedTrackingMode = splitMode==="unified" ? "allocate" : splitMode;
        const linkedBillId = isBillPayment ? ((isEditing && sourceTxn?.paidBillId) || matchedBill?.id || genId()) : null;
        const linkedBillName = isBillPayment ? (matchedBill?.name || who.trim() || note.trim() || "Bill payment") : null;
        const newTxn = {
          ...base,
          amount:amt,
          catId,
          catIds:validCatIds.length ? validCatIds : (catId ? [catId] : []),
          subIds:validSubIds,
          subId:validSubIds[0]||null,
          accId,
          isBillPayment,
          billInvoiceNo:billInvoiceNo.trim()||null,
          paidBillId:linkedBillId,
          paidBillName:linkedBillName,
          tagPersonAmount:tagAmt,
          tagGroupAmount:tagGrpAmt,
          tagItems:savedTagItems,
          vehicleId:vehicleId||null,
          people:(()=>{
            // Multi-person attribution with custom per-person amounts — checked first since it's a
            // separate selection path from the single-person tag flow below.
            if(attributePersonIds.length>0){
              return Object.fromEntries(attributePersonIds.map(pid=>[pid,{ amount:Number(attributeAmounts[pid])||0, mode:"spent_on", settled:false }]));
            }
            if(splitMode==="split"||splitMode==="allocate"||splitMode==="unified") return psplit;
            // tagMode="person" = they owe me back — save as receivable in people map
            if(splitMode==="tag" && tagMode==="person" && tagPerson){
              return { [tagPerson]: { amount:amt, mode:"owes", settled:false, remainingAmt:amt } };
            }
            // tagMode="attribute" = for them, no collection — save in people as spent_on
            if(splitMode==="tag" && tagMode==="attribute" && tagPerson){
              return { [tagPerson]: { amount:amt, mode:"spent_on", settled:false } };
            }
            return {};
          })(),
          forPerson:forPersonVal,
          groupId:groupIdVal,
          trackingMode:normalizedTrackingMode,
          splitMode:normalizedTrackingMode,
          tagMode:tagMode||null,
          taggedPersonId:forPersonVal||null,
          groupCollectiveAmount,
          allocations:(splitMode==="allocate" || splitMode==="unified")?allocRows.filter(r=>r.targetId).map(r=>{
            const normalizedItems = (r.items||[])
              .map(i=>{
                const amtVal = allocItemAmount(i);
                const qtyVal = Math.max(0, parseFloat(i.qty)||0);
                return {
                  ...i,
                  qty:qtyVal,
                  amount:amtVal,
                  label:i.label||null,
                  sourceItemId:i.sourceItemId||null,
                };
              })
              .filter(i=>(i.sourceItemId && i.qty>0) || i.amount>0 || i.label);
            const effAmt = normalizedItems.length ? normalizedItems.reduce((s,i)=>s+Number(i.amount||0),0) : parseFloat(r.amount)||0;
            return { id:r.id, targetType:r.targetType, targetId:r.targetId, amount:effAmt, mode:r.mode, items:normalizedItems };
          }).filter(r=>r.amount>0):null,
          groupAllocations:(splitMode==="allocate" || splitMode==="unified")&&groupAllocationsVal.length?groupAllocationsVal:null,
          catAllocations:hasCategorySplit?catAllocNumeric:null,
          lineItems:normalizedLineItems?.length ? normalizedLineItems : null,
          reimbursable:reimbursable||false,
          reimbursableAmount:(reimbursable && reimbursableAmount && Number(reimbursableAmount)>0) ? Number(reimbursableAmount) : null,
          paymentImageBase64:paymentImageBase64||null,
          priceMrp:showPriceBreakdown&&priceMrp?parseFloat(priceMrp)||null:null,
          priceDiscount:showPriceBreakdown&&priceDiscount?parseFloat(priceDiscount)||null:null,
          priceProcessingFee:showPriceBreakdown&&priceProcessingFee?parseFloat(priceProcessingFee)||null:null,
          priceInterestRate:showPriceBreakdown&&priceInterestRate?parseFloat(priceInterestRate)||null:null,
          priceInterestAmt:showPriceBreakdown&&priceInterestAmt>0?priceInterestAmt:null,
          priceGstAmt:showPriceBreakdown&&priceGstAmt>0?priceGstAmt:null,
        };
        upsertTxn(newTxn);
        if(!isEditing && getAcc(accId).type==="cc") setAccounts(prev=>prev.map(a=>a.id===accId?{...a,outstanding:(a.outstanding||0)+amt}:a));

        if(isBillPayment){
          const billRecord = {
            id:linkedBillId,
            name:linkedBillName,
            merchant:who.trim()||"",
            invoiceNo:billInvoiceNo.trim(),
            amount:amt,
            dueDate:date,
            catId,
            catIds:validCatIds.length ? validCatIds : (catId ? [catId] : []),
            subId:validSubIds[0]||null,
            recurring:matchedBill?.recurring||false,
            frequency:matchedBill?.frequency||"monthly",
            status:"paid",
            paidDate:date,
            createdDate:matchedBill?.createdDate||sourceTxn?.date||todayStr(),
            splitPeople:splitMode==="split"?psplit:(matchedBill?.splitPeople||{}),
            groupId:groupIdVal||matchedBill?.groupId||null,
            groupCollectiveAmount:groupCollectiveAmount || Number(matchedBill?.groupCollectiveAmount||0),
            myShare:myImplicitShare,
            paidByTxnId:resolvedTxnId,
            imageBase64:imageBase64 || matchedBill?.imageBase64 || null,
            paymentImageBase64:paymentImageBase64 || matchedBill?.paymentImageBase64 || null,
          };
          setBills(prev=>prev.some(b=>b.id===linkedBillId)
            ? prev.map(b=>b.id===linkedBillId?{...b,...billRecord}:b)
            : [billRecord,...prev]
          );
        } else if(matchedBill && !isEditing){
          setBillMatchSuggestion({bill:matchedBill,txn:newTxn});
        }
      } else if(txnType==="income"){
        upsertTxn({ ...base, amount:amt, accId, catId:null, catIds:[], subId:null, subIds:[], incomeType:normalizeIncomeTypeValue(incomeType)||"salary" });
        if(!isEditing){
          const pending = txns.filter(t=>t.type==="expense" && t.reimbursable && !t.reimbursedByTxnId);
          if(pending.length>0) setReimbursementMatchSuggestion({ incomeTxnId:resolvedTxnId, pending });
          // Process settlements — per specific transaction/loan row, with the exact (possibly partial) amount entered
          const selectedKeys = Object.keys(settleSelectedIds).filter(k=>settleSelectedIds[k]);
          if(selectedKeys.length>0){
            const paidFor = (key)=>Math.max(0, parseFloat(settleAmounts[key])||0);
            const txnKeys = selectedKeys.filter(k=>k.startsWith("txn_"));
            const grpKeys = selectedKeys.filter(k=>k.startsWith("grp_"));
            const loanKeys = selectedKeys.filter(k=>k.startsWith("loan_"));
            if(txnKeys.length>0 || grpKeys.length>0){
              setTxns(prev=>prev.map(t=>{
                let updated = t; let changed = false;
                txnKeys.forEach(key=>{
                  // key = txn_{txnId}_{personId} — split on first two underscores only, personId may itself not contain underscores (genId doesn't produce them)
                  const rest = key.slice(4);
                  const sep = rest.indexOf("_");
                  const txnId = rest.slice(0,sep);
                  const pid = rest.slice(sep+1);
                  if(String(t.id)!==String(txnId)) return;
                  const info = updated.people?.[pid] || updated.splitPeople?.[pid];
                  if(!info || info.settled || info.mode!=="owes") return;
                  const paid = Math.min(paidFor(key), remainingShare(info));
                  const newRemaining = Math.max(0, remainingShare(info)-paid);
                  const s = {...info, settledAmt:Number(info.settledAmt||0)+paid, remainingAmt:newRemaining, settled:newRemaining<=0.01};
                  if(updated.people?.[pid]){ updated={...updated,people:{...updated.people,[pid]:s}}; changed=true; }
                  else if(updated.splitPeople?.[pid]){ updated={...updated,splitPeople:{...updated.splitPeople,[pid]:s}}; changed=true; }
                });
                grpKeys.forEach(key=>{
                  // key = grp_{txnId}_{groupId}
                  const rest = key.slice(4);
                  const sep = rest.indexOf("_");
                  const txnId = rest.slice(0,sep);
                  const gid = rest.slice(sep+1);
                  if(String(t.id)!==String(txnId) || String(updated.groupId)!==String(gid)) return;
                  const paid = Math.min(paidFor(key), Number(updated.groupCollectiveAmount||0)-Number(updated.groupCollectiveSettledAmt||0));
                  updated = {...updated, groupCollectiveSettledAmt:Number(updated.groupCollectiveSettledAmt||0)+paid};
                  changed = true;
                });
                return changed ? updated : t;
              }));
            }
            if(loanKeys.length>0){
              setLoans(prev=>prev.map(l=>{
                const key = `loan_${l.id}`;
                if(!loanKeys.includes(key)) return l;
                const paid = Math.min(paidFor(key), Number(l.outstanding||0));
                const newOutstanding = Math.max(0, Number(l.outstanding||0)-paid);
                return {...l, outstanding:newOutstanding, status:newOutstanding<=0.01?"closed":l.status};
              }));
            }
          }
        }
      } else if(txnType==="transfer"){
        upsertTxn({ ...base, amount:amt, fromAccId, toAccId, catId:null, catIds:[], subId:null, subIds:[] });
      } else if(txnType==="cc_payment"){
        upsertTxn({ ...base, amount:amt, fromAccId, toAccId, catId:null, catIds:[], subId:null, subIds:[] });
        if(!isEditing){
          setAccounts(prev=>prev.map(a=>a.id===toAccId?{...a,outstanding:Math.max(0,(a.outstanding||0)-amt)}:a));
          // Auto-reduce outstanding on CC-backed EMI loans linked to this card.
          // Each cc_emi installment posted to this card reduces that plan's loan outstanding.
          // When CC bill is paid, the installments are cleared — so we reduce loan outstanding accordingly.
          setLoans(prev=>prev.map(loan=>{
            if(loan.direction!=="taken") return loan;
            if(!(loan.sourceType==="cc" || loan.ccLinked===true)) return loan;
            if(loan.linkedCardId!==toAccId) return loan;
            if(loan.status==="closed") return loan;
            // Find cc_emi txns for this loan's plan that are dated on or before today and not yet accounted
            const planId = loan.ccEmiPlanId;
            if(!planId) return loan;
            const installmentsPosted = txns.filter(t=>
              t.type==="cc_emi" &&
              t.ccEmiPlanId===planId &&
              t.accId===toAccId &&
              (!t.paidInBill) // not yet cleared by a bill payment
            );
            const totalInstallmentAmt = installmentsPosted.reduce((s,t)=>s+Number(t.amount||0),0);
            if(totalInstallmentAmt<=0) return loan;
            const newOutstanding = Math.max(0, Number(loan.outstanding||0) - totalInstallmentAmt);
            return {
              ...loan,
              outstanding: newOutstanding,
              status: newOutstanding<=0 ? "closed" : "active",
              repayments: [
                ...(loan.repayments||[]),
                { id:genId(), date:date||todayStr(), amount:totalInstallmentAmt, note:`CC bill payment — ${installmentsPosted.length} EMI installment(s)` }
              ]
            };
          }));
          // Mark those cc_emi txns as cleared by this bill payment
          setTxns(prev=>prev.map(t=>{
            if(t.type!=="cc_emi" || t.accId!==toAccId || t.paidInBill) return t;
            return { ...t, paidInBill:true };
          }));
        }
      } else if(txnType==="investment"){
        const invId = (isEditing ? (sourceTxn?.linkedInvestmentId || linkedInvestment?.id) : null) || genId();
        const folioNo = investType==="mf" ? investFolio.trim() : "";
        const metricValue = investmentMetricConfig.show ? Math.max(0, parseMoney(investNav)||0) : 0;
        const commonStartDate = lockedInvestFolioStartDate || date || todayStr(); // folio's original start date
        const txnDate = date || todayStr(); // actual transaction date (today for monthly SIP)
        // Find matching recurring schedule for auto-link
        const matchingSchedule = recurringSchedules.find(r=>r.active!==false && (r.name===who.trim() || (folioNo && r.groupKey && r.groupKey.includes(folioNo))));
        const inv = { id:invId, type:investType, name:who.trim()||"Investment", amount:amt, currentValue:amt, freq:investFreq||"", folioNo, startDate:commonStartDate, linkedTxnId:resolvedTxnId, paymentAccId:accId, lastNav:metricValue, lastNavDate:date, transactionRef:transactionRef.trim()||null, recurringScheduleId:matchingSchedule?.id||null };
        setInvestments(prev=>{
          const exists = prev.some(item=>String(item.id)===String(invId) || String(item.linkedTxnId||"")===String(resolvedTxnId));
          return exists
            ? prev.map(item=>(String(item.id)===String(invId) || String(item.linkedTxnId||"")===String(resolvedTxnId)) ? { ...item, ...inv } : item)
            : [inv,...prev];
        });
        upsertTxn({
          ...base,
          amount:amt,
          date:txnDate,
          accId,
          investType,
          investFreq:investFreq||"",
          investFolio:folioNo,
          investStartDate:commonStartDate,
          investNav:metricValue,
          catId:null,
          catIds:[],
          subId:null,
          subIds:[],
          linkedInvestmentId:invId,
          recurringScheduleId:matchingSchedule?.id||null,
        });
      } else if(txnType==="settlement_in"){
        const isRepayment = settlementKind==="repayment" && Boolean(tagPerson||settlementTagGroup||sourceTxn?.fromPersonId||sourceTxn?.fromGroupId);
        const repaymentPersonId = tagPerson||sourceTxn?.fromPersonId||null;
        const repaymentGroupId = settlementTagGroup||sourceTxn?.fromGroupId||null;
        const rawSettlementLinks = isRepayment
          ? repaymentCandidates.map(item=>({
              kind:item.kind,
              id:item.id,
              // Always carry personId on every link so applyRepaymentAllocations
              // updates both the person's individual split AND the group collective
              personId:repaymentPersonId||undefined,
              groupId:item.groupId||repaymentGroupId||undefined,
              amount:Math.min(Number(repaymentAllocations[item.key]||0), Number(item.amount||0)),
              title:item.title,
            })).filter(link=>link.amount>0)
          : [];
        // When editing: if candidates are empty because items are already settled,
        // preserve the original links so a bill settlement edit doesn't corrupt the txn.
        const preserveOriginalLinks = isEditing
          && rawSettlementLinks.length === 0
          && (sourceTxn?.settlementLinks||[]).length > 0
          && (!tagPerson || tagPerson === (sourceTxn?.fromPersonId||""))
          && (!settlementTagGroup || settlementTagGroup === (sourceTxn?.fromGroupId||""));
        const settlementLinks = preserveOriginalLinks ? (sourceTxn?.settlementLinks||[]) : rawSettlementLinks;
        // After filtering, also run applyRepaymentAllocations with the group-level links
        // so that even when a repayment is linked to a group without a person,
        // the group collective dues are still reduced
        const appliedAmount = settlementLinks.reduce((sum,link)=>sum+Number(link.amount||0),0);
        const extraAmount = isRepayment ? Math.max(0, amt-appliedAmount) : 0;
        const firstTxnLink = settlementLinks.find(link=>link.kind==="txn");
        const linkedExpenseId = settlementKind==="refund" ? (refundLinkedExpenseId || sourceTxn?.againstTxnId || null) : (firstTxnLink?.id || null);
        const linkedRefundNote = linkedExpenseId && settlementKind==="refund"
          ? [note.trim(), `Linked refund for ${(refundPrefill?.desc||refundPrefill?.merchant||sourceTxn?.desc||sourceTxn?.merchant||"expense")}`].filter(Boolean).join(" · ")
          : note.trim();
        const linkedExpenseTxn = linkedExpenseId ? txns.find(t=>String(t.id)===String(linkedExpenseId)) : null;
        const linkedBillId = settlementKind==="refund" ? (linkedExpenseTxn?.paidBillId || null) : null;
        const newTxn = { ...base, amount:amt, appliedAmount, extraAmount, accId, fromPersonId:repaymentPersonId, fromGroupId:repaymentGroupId, catId:null, catIds:[], subId:null, subIds:[], note:linkedRefundNote, isRefund:settlementKind==="refund", againstTxnId:linkedExpenseId, againstBillId:linkedBillId, refundPersonId:settlementKind==="refund"?refundPersonId:null, settlementLinks };
        upsertTxn(newTxn);
        if(newTxn.isRefund && !isEditing){
          const refundAcc = getAcc(accId);
          if(refundAcc?.type==="cc"){
            setAccounts(prev=>prev.map(a=>a.id===accId?{...a,outstanding:Math.max(0,(a.outstanding||0)-amt)}:a));
          }
          // B1a: Reduce the refunded person share on original txn
          if(refundPersonId && linkedExpenseId){
            setTxns(prev=>prev.map(t=>{
              if(String(t.id)!==String(linkedExpenseId)) return t;
              const info = t.people?.[refundPersonId];
              if(!info) return t;
              const origAmt = Number(info.amount||0);
              const newAmt = Math.max(0, origAmt - amt);
              return { ...t, people:{ ...t.people, [refundPersonId]:{ ...info, amount:newAmt, remainingAmt:Math.max(0,(info.remainingAmt||origAmt)-amt), settled:newAmt<=0 } } };
            }));
          }
        }
        if(isRepayment && (!isEditing || !sourceTxn?.settlementLinks?.length)) applyRepaymentAllocations(repaymentPersonId, settlementLinks);
        if(newTxn.isRefund && !newTxn.againstTxnId){
          const matches = getRefundCandidates(newTxn, resolvedTxnId);
          if(matches.length) setRefundMatchSuggestion({ refundTxn:newTxn, matches });
        }
        if(settlementKind==="reimbursement" && !isEditing){
          const pending = txns.filter(t=>t.type==="expense" && t.reimbursable && !t.reimbursedByTxnId);
          if(pending.length>0) setReimbursementMatchSuggestion({ incomeTxnId:resolvedTxnId, pending });
        }
      } else if(txnType==="cc_emi"){
        if(!ccEmiCardId){ alert("Please select a credit card."); return; }
        let planId = ccEmiPlanId;
        if(ccEmiNewPlanMode){
          const monthlyAmt = parseMoney(ccEmiNewMonthly)||0;
          if(!ccEmiNewName.trim()){ alert("Enter a plan name."); return; }
          if(!monthlyAmt){ alert("Enter the monthly EMI amount."); return; }
          const newPlan = {
            id:genId(),
            name:ccEmiNewName.trim(),
            cardId:ccEmiCardId,
            totalAmount:parseMoney(ccEmiNewTotal)||0,
            tenure:Math.max(1,parseInt(ccEmiNewTenure,10)||1),
            monthlyAmount:monthlyAmt,
            interestRate:parseFloat(ccEmiNewRate)||0,
            startDate:date,
            catId:catIds[0]||null,
            catIds:catIds.length?catIds:[],
            subId:subIds[0]||null,
            subIds,
            status:"active",
            createdAt:Date.now(),
          };
          setCcEmiPlans(prev=>[newPlan,...prev]);
          planId = newPlan.id;
          // Auto-create a linked loan record for this CC EMI plan so outstanding is tracked
          const emiLoanId = genId();
          const totalEmiAmt = parseMoney(ccEmiNewTotal)||0;
          if(totalEmiAmt>0){
            setLoans(prev=>[{
              id:emiLoanId,
              direction:"taken",
              name:ccEmiNewName.trim(),
              sourceType:"cc",
              ccLinked:true,
              linkedCardId:ccEmiCardId,
              ccEmiPlanId:planId,
              principal:totalEmiAmt,
              outstanding:totalEmiAmt,
              emiAmount:monthlyAmt,
              interestRate:parseFloat(ccEmiNewRate)||0,
              tenureMonths:Math.max(1,parseInt(ccEmiNewTenure,10)||1),
              startDate:date||todayStr(),
              status:"active",
              repayments:[],
              note:`CC EMI on ${getAcc(ccEmiCardId)?.name||"card"}`,
            },...prev]);
          }
        }
        if(!planId){ alert("Please select or create an EMI plan."); return; }
        const plan = ccEmiNewPlanMode
          ? { id:planId, name:ccEmiNewName.trim(), tenure:Math.max(1,parseInt(ccEmiNewTenure,10)||1) }
          : ccEmiPlans.find(p=>p.id===planId);
        const installedSoFar = txns.filter(t=>t.type==="cc_emi" && t.ccEmiPlanId===planId).length;
        const thisNum = isEditing ? (sourceTxn?.installmentNo||installedSoFar) : installedSoFar+1;
        upsertTxn({
          ...base,
          amount:amt,
          accId:ccEmiCardId,
          merchant:plan?.name||"",
          desc:`${plan?.name||"EMI"} · ${thisNum}/${plan?.tenure||"?"}`,
          catId:catIds[0]||null,
          catIds:catIds.length?catIds:[],
          subId:subIds[0]||null,
          subIds,
          ccEmiPlanId:planId,
          installmentNo:thisNum,
          ccEmiTenure:plan?.tenure||null,
          trackingMode:"none",
          people:{},
        });
      }
      if(isEditing && sourceTxn?.type==="investment" && txnType!=="investment"){
        setInvestments(prev=>prev.filter(inv=>String(inv.id)!==String(sourceTxn.linkedInvestmentId||linkedInvestment?.id||"") && String(inv.linkedTxnId||"")!==String(sourceTxn.id)));
      }
      try{ localStorage.removeItem(DRAFT_KEY); }catch{}
      closeModal();
    };

    const canSubmit = hasTxnSubject && amt>0;

    return (
      <>
      <div onClick={e=>e.target===e.currentTarget&&closeModal()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"94vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{isEditing?"Edit Transaction":refundPrefill?"Add Refund":"Add Transaction"}</div>
            <button onClick={closeModal} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
          {draftBanner&&<div style={{ background:T.accent+"18",border:`1px solid ${T.accent}44`,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8 }}>
            <span style={{ color:T.text,fontSize:12,fontWeight:700 }}>📝 You have an unsaved draft</span>
            <div style={{ display:"flex",gap:6 }}>
              <button onClick={restoreDraft} style={{ background:T.accent,border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:800,color:"#000",fontFamily:"Nunito,sans-serif" }}>Restore</button>
              <button onClick={()=>{ setDraftBanner(false); try{localStorage.removeItem(DRAFT_KEY);}catch{} }} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>Dismiss</button>
            </div>
          </div>}

          {/* STEP 1 — TYPE */}
          {txnType==="cc_emi"
            ? <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16,background:T.purple+"18",border:`1px solid ${T.purple}33`,borderRadius:12,padding:"10px 14px" }}>
                <span style={{ fontSize:20 }}>💳</span>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.purple,fontSize:13,fontWeight:800 }}>CC EMI Installment</div>
                  <div style={{ color:T.sub,fontSize:10 }}>Recording an installment against an EMI plan on your credit card</div>
                </div>
                <button onClick={()=>setTxnType("expense")} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif",whiteSpace:"nowrap" }}>← Change type</button>
              </div>
            : <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" }}>
                {[["expense","💸","Expense",T.danger],["income","💚","Income",T.success],["investment","💹","Invest",T.info],["transfer","🔄","Transfer",T.info],["cc_payment","💳","CC Pay",T.purple],["settlement_in","💼","Settlement",T.info]].map(([v,ic,lb,col])=>(
                  <button key={v} onClick={()=>{ setTxnType(v); setUserSetTxnType(true); if(v==="cc_payment"||v==="transfer") setWho(""); }} style={{ flex:1,background:txnType===v?col+"22":"none",border:`1px solid ${txnType===v?col:T.border}`,borderRadius:10,padding:"8px 4px",cursor:"pointer",fontSize:9,fontWeight:700,color:txnType===v?col:T.sub,fontFamily:"Nunito,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
                    <span style={{ fontSize:16 }}>{ic}</span>{lb}
                  </button>
                ))}
              </div>
          }

          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            {/* STEP 2 — WHO + AMOUNT + DATE */}
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
                      <span>{isApplied?"✨ Auto-selected":"✨ Suggested"} {suggestedCat.icon} {suggestedCat.name}{suggestedSub?` → ${suggestedSub.name}`:""} based on {vendorCategorySuggestion.reason}.</span>
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
                <input style={{ ...inp,fontSize:22,fontWeight:800,textAlign:"center" }} type="text" inputMode="decimal" placeholder={`e.g. ${sym}5,500`} value={amount||""} onChange={e=>setAmount(cleanMoneyInput(e.target.value))}/>
              </div>
              <div>
                <span style={lbl}>Date</span>
                <input style={inp} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
              </div>
            </div>

            {txnType==="expense"&&getAcc(accId)?.type==="cc"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                <button onClick={()=>setShowPriceBreakdown(v=>!v)} style={{ background:"none",border:`1px dashed ${showPriceBreakdown?T.accent:T.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,color:showPriceBreakdown?T.accent:T.sub,fontFamily:"Nunito,sans-serif",fontWeight:700,textAlign:"left" }}>
                  {showPriceBreakdown?"▲ Hide price breakdown":"▼ Price breakdown (MRP · discount · fees · interest · GST)"}
                </button>
                {showPriceBreakdown&&(
                  <div style={{ background:T.input,borderRadius:12,padding:"12px",display:"flex",flexDirection:"column",gap:8 }}>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                      <div><span style={lbl}>MRP ({sym})</span><input style={inp} type="text" inputMode="decimal" placeholder="0" value={priceMrp} onChange={e=>setPriceMrp(cleanMoneyInput(e.target.value))}/></div>
                      <div><span style={lbl}>Discount ({sym})</span><input style={inp} type="text" inputMode="decimal" placeholder="0" value={priceDiscount} onChange={e=>setPriceDiscount(cleanMoneyInput(e.target.value))}/></div>
                      <div><span style={lbl}>Processing Fee ({sym})</span><input style={inp} type="text" inputMode="decimal" placeholder="0" value={priceProcessingFee} onChange={e=>setPriceProcessingFee(cleanMoneyInput(e.target.value))}/></div>
                      <div><span style={lbl}>Interest Rate (% p.a.)</span><input style={inp} type="text" inputMode="decimal" placeholder="e.g. 24" value={priceInterestRate} onChange={e=>setPriceInterestRate(cleanMoneyInput(e.target.value))}/></div>
                    </div>
                    {priceInterestAmt > 0 && (
                      <div style={{ display:"flex",flexDirection:"column",gap:4,borderTop:`1px dashed ${T.border}`,paddingTop:8,marginTop:4 }}>
                        <div style={{ display:"flex",justifyContent:"space-between",fontSize:11 }}>
                          <span style={{ color:T.sub }}>Monthly interest ({priceInterestRate}% ÷ 12 on {sym}{fmt(priceNet)})</span>
                          <span style={{ color:T.text,fontWeight:700 }}>{sym}{fmt(priceInterestAmt)}</span>
                        </div>
                        <div style={{ display:"flex",justifyContent:"space-between",fontSize:11 }}>
                          <span style={{ color:T.sub }}>GST on interest (18%)</span>
                          <span style={{ color:T.text,fontWeight:700 }}>{sym}{fmt(priceGstAmt)}</span>
                        </div>
                      </div>
                    )}
                    {computedBreakdownTotal!==null&&(
                      <div style={{ display:"flex",justifyContent:"space-between",borderTop:`1px solid ${T.border}`,paddingTop:8,marginTop:4 }}>
                        <span style={{ color:T.sub,fontSize:12,fontWeight:700 }}>Computed total</span>
                        <span style={{ color:T.accent,fontSize:14,fontWeight:800 }}>{sym}{fmt(computedBreakdownTotal)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(txnType!=="income")&&(
              <div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ ...lbl,marginBottom:0 }}>Transaction ID / Ref (optional)</span>
                  {txnType==="expense"&&<div style={{ display:"flex",gap:4 }}>
                    <Chip color={T.success} active={expensePaymentMode==="full"} onClick={()=>setExpensePaymentMode("full")}>✅ Full</Chip>
                    <Chip color={T.warn} active={expensePaymentMode==="emi"} onClick={()=>setExpensePaymentMode("emi")}>🧾 EMI</Chip>
                  </div>}
                </div>
                <input style={inp} type="text" placeholder="e.g. UPI / bank reference" value={transactionRef} onChange={e=>setTransactionRef(e.target.value.toUpperCase())}/>
              </div>
            )}

            {/* STEP 3 — PAYMENT METHOD */}
            {txnType==="expense"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                <div>
                  <span style={lbl}>Paid via</span>
                  <AccountChipGroup items={accounts} value={accId} onChange={setAccId} />
                </div>
                {expensePaymentMode==="emi"&&(
                  <div style={{ background:T.input,border:`1px solid ${T.warn}33`,borderRadius:12,padding:"12px" }}>
                    <div style={{ color:T.text,fontSize:12,fontWeight:800,marginBottom:8 }}>EMI plan details</div>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                      {[ ["bank","🏦 Bank loan"],["cc","💳 Credit card EMI"],["store","🛒 Store EMI"],["person","👤 Borrowed from person"],["other","📦 Other"] ].map(([value,label])=>(
                        <Chip key={value} color={value==="cc"?T.danger:T.warn} active={emiSourceType===value} onClick={()=>setEmiSourceType(value)}>{label}</Chip>
                      ))}
                    </div>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                      <Chip color={T.info} active={showEmiDownPayment} onClick={()=>setShowEmiDownPayment(v=>!v)}>💸 Down payment</Chip>
                    </div>
                    {showEmiDownPayment&&(
                      <div style={{ marginBottom:10 }}>
                        <span style={lbl}>Down payment ({sym})</span>
                        <input style={inp} type="text" inputMode="decimal" placeholder={`e.g. ${sym}20,000`} value={emiDownPayment||""} onChange={e=>setEmiDownPayment(cleanMoneyInput(e.target.value))}/>
                      </div>
                    )}
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
                      <div>
                        <span style={lbl}>Tenure (months)</span>
                        <input style={inp} type="number" min="1" placeholder="e.g. 12" value={emiTenureMonths} onChange={e=>setEmiTenureMonths(e.target.value)}/>
                      </div>
                      <div>
                        <span style={lbl}>EMI amount ({sym})</span>
                        <input style={inp} type="text" inputMode="decimal" placeholder={`e.g. ${sym}2,500`} value={emiAmount||""} onChange={e=>setEmiAmount(cleanMoneyInput(e.target.value))}/>
                      </div>
                    </div>
                    {/* No Cost EMI fields */}
                    <div style={{ background:T.input,borderRadius:12,padding:"10px 14px",marginBottom:10 }}>
                      <div style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5,marginBottom:8 }}>NO COST EMI / INTEREST (optional)</div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                        <div>
                          <span style={lbl}>Interest waiver discount ({sym})</span>
                          <input style={inp} type="text" inputMode="decimal" placeholder="e.g. 3,600" value={emiInterestWaiver||""} onChange={e=>setEmiInterestWaiver(cleanMoneyInput(e.target.value))}/>
                          <div style={{ color:T.sub,fontSize:9,marginTop:3 }}>Shown on e-comm as discount — true interest cost</div>
                        </div>
                        <div>
                          <span style={lbl}>GST on interest ({sym})</span>
                          <input style={inp} type="text" inputMode="decimal" placeholder="e.g. 648" value={emiGstOnInterest||""} onChange={e=>setEmiGstOnInterest(cleanMoneyInput(e.target.value))}/>
                          <div style={{ color:T.sub,fontSize:9,marginTop:3 }}>18% of interest waiver — your actual financing cost</div>
                        </div>
                      </div>
                      {(emiInterestWaiver||emiGstOnInterest)&&(
                        <div style={{ background:T.card,borderRadius:10,padding:"8px 10px",marginTop:8 }}>
                          <div style={{ color:T.sub,fontSize:10 }}>Item cost: {sym}{fmt(amt||0)}</div>
                          <div style={{ color:T.sub,fontSize:10 }}>Interest waiver: {sym}{fmt(parseFloat(emiInterestWaiver)||0)}</div>
                          <div style={{ color:T.danger,fontSize:10 }}>GST on interest: {sym}{fmt(parseFloat(emiGstOnInterest)||0)}</div>
                          <div style={{ color:T.text,fontSize:12,fontWeight:800,marginTop:4 }}>True cost of financing: {sym}{fmt(parseFloat(emiGstOnInterest)||0)}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",marginBottom:10 }}>
                      <div style={{ color:T.sub,fontSize:10 }}>Total item cost: {sym}{fmt(amt||0)}</div>
                      <div style={{ color:T.sub,fontSize:10 }}>Down payment: {sym}{fmt(emiDownPaymentValue||0)}</div>
                      <div style={{ color:T.text,fontSize:12,fontWeight:800,marginTop:4 }}>Balance for EMI: {sym}{fmt(financedAmount||0)}</div>
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
                      <div>
                        <span style={lbl}>Due day</span>
                        <input style={inp} type="number" min="1" max="31" placeholder="e.g. 5" value={emiDueDay} onChange={e=>setEmiDueDay(e.target.value)}/>
                      </div>
                      <div>
                        <span style={lbl}>Interest % (optional)</span>
                        <input style={inp} type="number" min="0" step="0.01" placeholder="e.g. 12" value={emiInterestRate} onChange={e=>setEmiInterestRate(e.target.value)}/>
                      </div>
                    </div>
                    <div>
                      <span style={lbl}>Repayment from</span>
                      <AccountChipGroup items={accounts} value={accId} onChange={setAccId} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {txnType==="income"&&(
              <div>
                <span style={lbl}>Income type</span>
                <IncomeTypeChips options={incomeTypeChoices} value={incomeType} onChange={setIncomeType} />
                <span style={lbl}>Into account</span>
                <AccountChipGroup items={nonCCAccs} value={accId} onChange={setAccId} />
                {/* Settlement multi-select — per-transaction rows with editable partial amounts */}
                {(()=>{
                  const outstandingRows = [];
                  txns.forEach(t=>{
                    if(t.type!=="expense") return;
                    const peopleMap = (t.people && Object.keys(t.people).length) ? t.people : (t.splitPeople||{});
                    Object.entries(peopleMap).forEach(([pid,info])=>{
                      if(pid==="__me__" || info?.mode!=="owes") return;
                      const rem = remainingShare(info);
                      if(rem<=0) return;
                      const p = getPerson(pid);
                      outstandingRows.push({ key:`txn_${t.id}_${pid}`, kind:"txn", txnId:t.id, personId:pid, label:`${p.emoji||"👤"} ${p.name}`, sub:`${t.merchant||t.who||t.desc||"Expense"} · ${formatShortDate(t.date)||t.date}`, remaining:rem, color:p.color });
                    });
                    if(t.groupId){
                      const due = getGroupCollectiveDue(t)||0;
                      if(due>0){
                        const g = groups.find(x=>x.id===t.groupId);
                        if(g) outstandingRows.push({ key:`grp_${t.id}_${g.id}`, kind:"group", txnId:t.id, groupId:g.id, label:`${g.icon||"👥"} ${g.name}`, sub:`${t.merchant||t.who||t.desc||"Expense"} · ${formatShortDate(t.date)||t.date}`, remaining:due, color:g.color });
                      }
                    }
                  });
                  activeLoans.filter(l=>l.direction!=="taken").forEach(l=>{
                    const pid = String(l.personId||l.linkedPersonId||"");
                    const p = pid ? getPerson(pid) : null;
                    if(!p) return;
                    outstandingRows.push({ key:`loan_${l.id}`, kind:"loan", loanId:l.id, personId:pid, label:`${p.emoji||"👤"} ${p.name}`, sub:`Loan given${l.note?` · ${l.note}`:""}`, remaining:Number(l.outstanding||0), color:p.color });
                  });
                  if(outstandingRows.length===0) return null;
                  // Only show settlement for receivable-type income, not salary/interest/passive
                  const NON_SETTLEMENT_TYPES = ["salary","interest","dividend","capital_gains","royalty"];
                  const currentIncomeType = normalizeIncomeTypeValue(incomeType||"salary")||"salary";
                  if(NON_SETTLEMENT_TYPES.includes(currentIncomeType)) return null;
                  const selectedCount = Object.keys(settleSelectedIds).filter(k=>settleSelectedIds[k]).length;
                  const selectedTotal = outstandingRows.filter(r=>settleSelectedIds[r.key]).reduce((s,r)=>s+(parseFloat(settleAmounts[r.key])||0),0);
                  return (
                    <div style={{ marginTop:12 }}>
                      <div style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5,marginBottom:8 }}>SETTLE OUTSTANDING (optional) — pick specific expenses, edit amount if it's a partial payment</div>
                      <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                        {outstandingRows.map(row=>{
                          const isSelected=!!settleSelectedIds[row.key];
                          return (
                            <div key={row.key} style={{ background:isSelected?row.color+"16":T.input,border:`1px solid ${isSelected?row.color:T.border}`,borderRadius:12,padding:"10px 14px" }}>
                              <div onClick={()=>{
                                setSettleSelectedIds(prev=>({...prev,[row.key]:!prev[row.key]}));
                                setSettleAmounts(prev=>prev[row.key]!==undefined?prev:{...prev,[row.key]:String(row.remaining)});
                              }} style={{ display:"flex",alignItems:"center",gap:10,cursor:"pointer" }}>
                                <div style={{ width:20,height:20,borderRadius:5,background:isSelected?row.color:"none",border:`2px solid ${isSelected?row.color:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                  {isSelected&&<span style={{ color:"#fff",fontSize:12,fontWeight:900 }}>✓</span>}
                                </div>
                                <div style={{ flex:1,minWidth:0 }}>
                                  <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{row.label}</div>
                                  <div style={{ color:T.sub,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{row.sub}</div>
                                </div>
                                <div style={{ color:row.color,fontSize:12,fontWeight:800 }}>{sym}{fmt(row.remaining)} owed</div>
                              </div>
                              {isSelected&&(
                                <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8,marginTop:8 }}>
                                  <span style={{ color:T.sub,fontSize:11 }}>Received</span>
                                  <input style={{ ...inpSm, width:90, textAlign:"right" }} type="number" min="0" max={row.remaining} value={settleAmounts[row.key]??""} placeholder="0" onChange={e=>{
                                    const raw=e.target.value;
                                    if(raw===""){ setSettleAmounts(prev=>({...prev,[row.key]:""})); return; }
                                    const parsed=parseFloat(raw);
                                    const safe=Number.isFinite(parsed)?Math.max(0,Math.min(row.remaining,parsed)):0;
                                    setSettleAmounts(prev=>({...prev,[row.key]:String(Math.round(safe*100)/100)}));
                                  }}/>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {selectedCount>0&&(
                        <div style={{ background:T.success+"16",borderRadius:10,padding:"8px 12px",marginTop:8,display:"flex",justifyContent:"space-between" }}>
                          <span style={{ color:T.sub,fontSize:11 }}>Settling {selectedCount} item{selectedCount>1?"s":""}</span>
                          <span style={{ color:T.success,fontSize:12,fontWeight:800 }}>{sym}{fmt(selectedTotal)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            {(txnType==="transfer"||txnType==="cc_payment")&&(
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                  <div><span style={lbl}>From</span><select style={inp} value={fromAccId} onChange={e=>setFromAccId(e.target.value)}>{(txnType==="cc_payment"?nonCCAccs:accounts).map(a=><option key={a.id} value={a.id}>{accIcon(a.type)} {a.name}</option>)}</select></div>
                  <div><span style={lbl}>To</span><select style={inp} value={toAccId} onChange={e=>setToAccId(e.target.value)}>{(txnType==="cc_payment"?ccAccs:accounts).map(a=><option key={a.id} value={a.id}>{accIcon(a.type)} {a.name}</option>)}</select></div>
                </div>
                {txnType==="transfer"&&<div style={{ color:T.sub,fontSize:10 }}>Use `Transfer` for moving money into PPF / FD / NPS accounts. It will not count as an expense, and investment-bucket accounts still show under `Wealth → Investments`.</div>}
              </div>
            )}
            {txnType==="investment"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                <div>
                  <span style={lbl}>Type</span>
                  <InvestmentTypeChips value={investType} onChange={setInvestType} />
                </div>
                <div style={{ display:"grid",gridTemplateColumns:investType==="mf"?"1fr 1fr":"1fr",gap:10 }}>
                  {investType==="mf"&&<div style={{ position:"relative" }}>
                    <span style={lbl}>Folio No.</span>
                    <input style={inp} placeholder="Type folio to reuse defaults" value={investFolio} onChange={e=>{ setInvestFolio(e.target.value); setShowFolioSuggestions(true); }} onFocus={()=>setShowFolioSuggestions(true)} onBlur={()=>setTimeout(()=>setShowFolioSuggestions(false),150)}/>
                    {showFolioSuggestions && investmentSuggestions.length>0 && (
                      <div style={{ position:"absolute",top:"100%",left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,zIndex:1000,boxShadow:"0 6px 14px rgba(0,0,0,0.18)",maxHeight:180,overflowY:"auto" }}>
                        {investmentSuggestions.map(template=>(
                          <button key={template.key} onMouseDown={e=>e.preventDefault()} onClick={()=>applyInvestmentTemplate(template)} style={{ width:"100%",padding:"9px 10px",background:"none",border:"none",borderBottom:`1px solid ${T.border}`,textAlign:"left",cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>
                            <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{template.label}</div>
                            <div style={{ color:T.sub,fontSize:10 }}>{template.amount?`${sym}${fmt(template.amount)}`:""}{template.freq?` · ${investmentFreqLabel(template.freq)}`:""}{template.accId?` · ${getAcc(template.accId).name}`:""}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ color:lockedInvestFolioStartDate?T.info:T.sub,fontSize:10,marginTop:6 }}>
                      {lockedInvestFolioStartDate
                        ? `🔒 Start date locked to ${formatShortDate(lockedInvestFolioStartDate) || lockedInvestFolioStartDate} for this folio.`
                        : "Existing folios auto-fill the fund name, amount, frequency, account, and common start date."}
                    </div>
                  </div>}
                  <div>
                    <span style={lbl}>Frequency</span>
                    <InvestmentFrequencySelect value={investFreq} onChange={setInvestFreq} />
                  </div>
                </div>
                <div>
                  {investmentMetricConfig.show ? <>
                    <span style={lbl}>{investmentMetricConfig.label} {investType==="mf"?"(NAV per unit)":investType==="stocks"?"(units held)":investType==="gold"?"(grams)":"(optional)"}</span>
                    <input style={inp} type="text" inputMode="decimal" placeholder={investmentMetricConfig.placeholder} value={investNav||""} onChange={e=>setInvestNav(cleanMoneyInput(e.target.value))}/>
                  </> : null}
                </div>
                <div>
                  <span style={lbl}>Paid from</span>
                  <AccountChipGroup items={accounts} value={accId} onChange={setAccId} />
                </div>
              </div>
            )}
            {txnType==="settlement_in"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {/* Refund: show linked expense if set via prefill or manual picker */}
                {settlementKind==="refund"&&(()=>{
                  const linkedExp = refundLinkedExpenseId ? txns.find(t=>String(t.id)===String(refundLinkedExpenseId)) : null;
                  const searchLower = refundExpenseSearch.toLowerCase().trim();
                  const recentExpenses = txns
                    .filter(t=>t.type==="expense")
                    .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")))
                    .slice(0, 200);
                  const filtered = searchLower
                    ? recentExpenses.filter(t=>
                        (t.desc||"").toLowerCase().includes(searchLower) ||
                        (t.merchant||"").toLowerCase().includes(searchLower) ||
                        String(t.amount||"").includes(searchLower)
                      ).slice(0,20)
                    : recentExpenses.slice(0,15);
                  return (
                    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                      {linkedExp ? (
                        <div style={{ background:T.input,border:`1px solid ${T.info}44`,borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"center",gap:10 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ color:T.text,fontSize:12,fontWeight:800,marginBottom:2 }}>↩ Linked to original expense</div>
                            <div style={{ color:T.sub,fontSize:11 }}>{linkedExp.desc||linkedExp.merchant||"Expense"} · {sym}{fmt(linkedExp.amount||0)} · {linkedExp.date?.slice(5)||""}</div>
                          </div>
                          {!refundPrefill&&<button onClick={()=>{ setRefundLinkedExpenseId(null); setRefundExpenseSearch(""); }} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:20,padding:"3px 10px",cursor:"pointer",fontSize:11,color:T.sub,fontFamily:"Nunito,sans-serif",flexShrink:0 }}>✕ Unlink</button>}
                        </div>
                      ) : !refundPrefill ? (
                        <div>
                          <span style={lbl}>Link to original expense (optional)</span>
                          <input
                            style={{ ...inp,marginBottom:8 }}
                            placeholder="Search by name, merchant or amount..."
                            value={refundExpenseSearch}
                            onChange={e=>setRefundExpenseSearch(e.target.value)}
                          />
                          {filtered.length>0&&(
                            <div style={{ background:T.input,borderRadius:10,overflow:"hidden",maxHeight:220,overflowY:"auto" }}>
                              {filtered.map((t,idx)=>(
                                <div key={t.id} onClick={()=>{ setRefundLinkedExpenseId(t.id); setRefundExpenseSearch(""); }} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderBottom:idx<filtered.length-1?`1px solid ${T.border}`:"none",cursor:"pointer" }}>
                                  <div style={{ width:32,height:32,borderRadius:8,background:(getCat(t.catId||"")?.color||T.accent)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0 }}>{getCat(t.catId||"")?.icon||"💸"}</div>
                                  <div style={{ flex:1,minWidth:0 }}>
                                    <div style={{ color:T.text,fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{t.desc||t.merchant||"Expense"}</div>
                                    <div style={{ color:T.sub,fontSize:10,marginTop:1 }}>{t.date?.slice(5)||""}{t.merchant&&t.desc&&t.merchant!==t.desc?` · ${t.merchant}`:""}</div>
                                  </div>
                                  <div style={{ color:T.danger,fontSize:13,fontWeight:800,flexShrink:0 }}>{sym}{fmt(t.amount||0)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ background:T.input,border:`1px solid ${T.info}33`,borderRadius:12,padding:"10px 12px" }}>
                          <div style={{ color:T.text,fontSize:12,fontWeight:800,marginBottom:4 }}>↩ Refund linked to original expense</div>
                          <div style={{ color:T.sub,fontSize:11 }}>{refundPrefill.desc||refundPrefill.merchant||"Expense"} · {sym}{fmt(refundPrefill.amount||0)}{refundPrefill.accId?` · ${getAcc(refundPrefill.accId).name}`:""}</div>
                        </div>
                      )}
                    {/* B1a: Whose refund selector - shown when linked expense has split people */}
                    {linkedExp && Object.keys(linkedExp.people||{}).length>0 && (() => {
                      const splitPids = Object.entries(linkedExp.people||{}).filter(([,info])=>info.mode==="owes"||info.mode==="split");
                      if(!splitPids.length) return null;
                      return (
                        <div style={{ background:T.input,borderRadius:12,padding:"10px 12px" }}>
                          <div style={{ color:T.sub,fontSize:11,fontWeight:700,marginBottom:8 }}>WHOSE PORTION IS REFUNDED?</div>
                          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                            <button onClick={()=>setRefundPersonId(null)} style={{ background:!refundPersonId?T.accent+"22":"none",border:`1px solid ${!refundPersonId?T.accent:T.border}`,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:!refundPersonId?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>My portion</button>
                            {splitPids.map(([pid,info])=>{
                              const per = getPerson(pid);
                              return <button key={pid} onClick={()=>setRefundPersonId(pid)} style={{ background:refundPersonId===pid?T.info+"22":"none",border:`1px solid ${refundPersonId===pid?T.info:T.border}`,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:refundPersonId===pid?T.info:T.sub,fontFamily:"Nunito,sans-serif" }}>{per?.name||"Person"} ({sym}{fmt(info.amount||0)})</button>;
                            })}
                          </div>
                          {refundPersonId&&<div style={{ color:T.sub,fontSize:10,marginTop:6 }}>Their owed amount will reduce by the refund value</div>}
                        </div>
                      );
                    })()}
                    </div>
                  );
                })()}
                <div>
                  <span style={lbl}>Tag this inflow as</span>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                    {[{id:"refund",label:"↩ Refund",color:T.text},{id:"repayment",label:"💰 Repayment",color:T.info},{id:"reimbursement",label:"💼 Reimbursement",color:T.success}].map(opt=>(
                      <button key={opt.id} onClick={()=>{ setSettlementKind(opt.id); if(opt.id==="reimbursement"){ setTagPerson(""); setSettlementTagGroup(""); } }} style={{ background:settlementKind===opt.id?opt.color+"22":"none",border:`1px solid ${settlementKind===opt.id?opt.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:settlementKind===opt.id?opt.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                {settlementKind!=="reimbursement"&&<div>
                  <span style={lbl}>Person (optional)</span>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    <button onClick={()=>{ setTagPerson(""); setSettlementTagGroup(""); setSettlementKind("refund"); }} style={{ background:(!tagPerson&&!settlementTagGroup)?"#88888822":"none",border:`1px solid ${(!tagPerson&&!settlementTagGroup)?"#888":T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>No contact</button>
                    {people.filter(p=>!p.isMe).map(p=><button key={p.id} onClick={()=>{ setTagPerson(tagPerson===p.id?"":p.id); setSettlementKind("repayment"); setRepaymentTouched(false); if(!who.trim()) setWho(p.name); }} style={{ background:tagPerson===p.id?p.color+"22":"none",border:`1px solid ${tagPerson===p.id?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:tagPerson===p.id?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>)}
                  </div>
                </div>}
                {settlementKind!=="reimbursement"&&<div>
                  <span style={lbl}>Group (optional)</span>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {groups.length===0&&<span style={{ color:T.sub,fontSize:11 }}>No groups created yet.</span>}
                    {groups.map(g=><button key={g.id} onClick={()=>{ setSettlementTagGroup(settlementTagGroup===g.id?"":g.id); setSettlementKind("repayment"); setRepaymentTouched(false); if(!who.trim()) setWho(g.name); }} style={{ background:settlementTagGroup===g.id?g.color+"22":"none",border:`1px solid ${settlementTagGroup===g.id?g.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:settlementTagGroup===g.id?g.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{g.icon||"👥"} {g.name}</button>)}
                  </div>
                </div>}
                {settlementKind==="repayment"&&(tagPerson||settlementTagGroup)&&(
                  <div style={{ background:T.input,border:`1px solid ${T.info}33`,borderRadius:12,padding:"12px 14px" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8 }}>
                      <div>
                        <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>Apply to original dues</div>
                        <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{(tagPerson&&settlementTagGroup)?"Personal and group collective dues for this payment.":settlementTagGroup?"Group collective dues this payment clears.":"Choose the dues this payment clears."}</div>
                      </div>
                      <button onClick={()=>{ setRepaymentTouched(false); setRepaymentAllocations(buildRepaymentAllocations(amt)); }} style={{ background:T.info+"18",border:`1px solid ${T.info}33`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:800,color:T.info,fontFamily:"Nunito,sans-serif",whiteSpace:"nowrap" }}>Auto</button>
                    </div>
                    {repaymentCandidates.length===0&&(
                      <div style={{ color:T.sub,fontSize:11,padding:"8px 0",borderTop:`1px solid ${T.border}` }}>
                        {settlementTagGroup && !tagPerson ? "No unsettled collective dues for this group." : "No tracked dues found. Select a person or group to see their pending dues."}
                      </div>
                    )}
                    {repaymentCandidates.map(item=>{
                        const val = repaymentAllocations[item.key]||"";
                        const applied = Math.min(Number(val||0), Number(item.amount||0));
                        const isSelected = applied > 0;
                        const isPartial = repaymentPartialKey === item.key;
                        const status = !isSelected ? "Not applied" : applied>=Number(item.amount||0)-0.01 ? "Will settle" : "Partly settle";
                        const icon = item.kind==="group-bill"||item.kind==="bill" ? "🧾" : item.kind==="group-txn" ? "👥" : "💸";
                        return (
                          <div key={item.key} onClick={()=>{
                            if(repaymentPartialKey===item.key) return;
                            const next = isSelected ? "0" : String(item.amount);
                            updateRepaymentAllocation(item.key, next, item.amount);
                            setRepaymentPartialKey(null);
                          }} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:`1px solid ${T.border}`,cursor:"pointer",opacity:isSelected?1:0.6 }}>
                            <div style={{ width:18,height:18,borderRadius:9,border:`2px solid ${isSelected?T.info:T.border}`,background:isSelected?T.info:"none",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
                              {isSelected&&<span style={{ color:"#fff",fontSize:10,fontWeight:900 }}>✓</span>}
                            </div>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ color:T.text,fontSize:12,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{icon} {item.title}</div>
                              <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{item.subtitle||"pending"} · due {sym}{fmt(item.amount)} · {status}</div>
                            </div>
                            {isSelected && isPartial ? (
                              <input autoFocus type="number" min="0" max={item.amount} value={val}
                                onChange={e=>updateRepaymentAllocation(item.key,e.target.value,item.amount)}
                                onBlur={()=>setRepaymentPartialKey(null)}
                                onClick={e=>e.stopPropagation()}
                                style={{ ...inp,width:72,padding:"5px 7px",fontSize:12,textAlign:"right" }}/>
                            ) : (
                              <div onClick={e=>{ if(isSelected){ e.stopPropagation(); setRepaymentPartialKey(item.key); } }}
                                style={{ background:isSelected?T.info+"22":T.border+"44",borderRadius:20,padding:"4px 10px",fontSize:12,fontWeight:800,color:isSelected?T.info:T.sub,whiteSpace:"nowrap",cursor:isSelected?"text":"default" }}>
                                {sym}{fmt(isSelected?applied:item.amount)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    <div style={{ color:repaymentExtra>0?T.warn:T.success,fontSize:11,fontWeight:700,marginTop:8 }}>Applied {sym}{fmt(repaymentAllocTotal)} of {sym}{fmt(amt)}{repaymentExtra>0?` · ${sym}${fmt(repaymentExtra)} extra kept as advance`:""}</div>
                  </div>
                )}
                <div>
                  <span style={lbl}>Received into</span>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {accounts.map(a=><button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
                  </div>
                </div>
              </div>
            )}

            {/* CC EMI SECTION */}
            {txnType==="cc_emi"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                {ccAccs.length===0&&(
                  <div style={{ background:T.warn+"18",border:`1px solid ${T.warn}44`,borderRadius:10,padding:"10px 14px",color:T.text,fontSize:12 }}>⚠ No credit card accounts found. Add a CC account first.</div>
                )}
                {ccAccs.length>0&&(
                  <>
                    <div>
                      <span style={lbl}>Credit card</span>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                        {ccAccs.map(a=>(
                          <button key={a.id} onClick={()=>{ setCcEmiCardId(a.id); setCcEmiPlanId(""); setCcEmiNewPlanMode(false); }} style={{ background:ccEmiCardId===a.id?a.color+"22":"none",border:`1px solid ${ccEmiCardId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:ccEmiCardId===a.id?a.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{accIcon("cc")} {a.name}</button>
                        ))}
                      </div>
                    </div>

                    {!ccEmiNewPlanMode&&(
                      <div>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                          <span style={{ ...lbl,marginBottom:0 }}>EMI Plan</span>
                          <button onClick={()=>{ setCcEmiNewPlanMode(true); setCcEmiPlanId(""); }} style={{ background:"none",border:`1px solid ${T.accent}`,borderRadius:20,padding:"3px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>+ New Plan</button>
                        </div>
                        {activeCcEmiPlans.length===0&&(
                          <div style={{ color:T.sub,fontSize:11,marginBottom:6 }}>No active plans for this card. Create a new plan to get started.</div>
                        )}
                        <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                          {activeCcEmiPlans.map(plan=>{
                            const installedCount = txns.filter(t=>t.type==="cc_emi" && t.ccEmiPlanId===plan.id).length;
                            const remaining = plan.tenure - installedCount;
                            return (
                              <button key={plan.id} onClick={()=>{ setCcEmiPlanId(plan.id); setAmount(String(plan.monthlyAmount||"")); }} style={{ background:ccEmiPlanId===plan.id?T.purple+"22":"none",border:`1px solid ${ccEmiPlanId===plan.id?T.purple:T.border}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",textAlign:"left",fontFamily:"Nunito,sans-serif" }}>
                                <div style={{ color:T.text,fontSize:13,fontWeight:800,marginBottom:2 }}>{plan.name}</div>
                                <div style={{ color:T.sub,fontSize:10 }}>
                                  {sym}{fmt(plan.monthlyAmount)}/mo · {plan.tenure} months · {installedCount}/{plan.tenure} recorded
                                  {remaining>0?` · ${remaining} left`:" · ✅ complete"}
                                  {plan.interestRate?` · ${plan.interestRate}% p.a.`:""}
                                </div>
                                {ccEmiPlanId===plan.id&&installedCount<plan.tenure&&(
                                  <div style={{ marginTop:6,background:T.purple+"22",borderRadius:8,padding:"4px 8px",display:"inline-block",color:T.purple,fontSize:11,fontWeight:800 }}>
                                    Recording installment {installedCount+1} of {plan.tenure}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {ccEmiNewPlanMode&&(
                      <div style={{ background:T.input,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                          <div style={{ color:T.text,fontSize:12,fontWeight:800 }}>New EMI Plan</div>
                          <button onClick={()=>setCcEmiNewPlanMode(false)} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:13,fontFamily:"Nunito,sans-serif" }}>✕ Cancel</button>
                        </div>
                        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                          <div>
                            <span style={lbl}>Item name (e.g. Samsung TV)</span>
                            <input style={inp} placeholder="e.g. Samsung TV" value={ccEmiNewName} onChange={e=>setCcEmiNewName(e.target.value)}/>
                          </div>
                          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                            <div>
                              <span style={lbl}>Total amount</span>
                              <input style={inp} type="text" inputMode="decimal" placeholder="e.g. 60000" value={ccEmiNewTotal} onChange={e=>{ const v=cleanMoneyInput(e.target.value); setCcEmiNewTotal(v); if(ccEmiNewTenure){ const t=parseInt(ccEmiNewTenure,10); if(t>0) setCcEmiNewMonthly(String(Math.round((parseMoney(v)||0)/t))); } }}/>
                            </div>
                            <div>
                              <span style={lbl}>Tenure (months)</span>
                              <input style={inp} type="number" min="1" placeholder="e.g. 6" value={ccEmiNewTenure} onChange={e=>{ setCcEmiNewTenure(e.target.value); const t=parseInt(e.target.value,10); if(t>0&&ccEmiNewTotal) setCcEmiNewMonthly(String(Math.round((parseMoney(ccEmiNewTotal)||0)/t))); }}/>
                            </div>
                          </div>
                          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                            <div>
                              <span style={lbl}>Monthly EMI amount</span>
                              <input style={inp} type="text" inputMode="decimal" placeholder="auto-calculated" value={ccEmiNewMonthly} onChange={e=>setCcEmiNewMonthly(cleanMoneyInput(e.target.value))}/>
                            </div>
                            <div>
                              <span style={lbl}>Interest rate % (optional)</span>
                              <input style={inp} type="number" min="0" step="0.01" placeholder="e.g. 14" value={ccEmiNewRate} onChange={e=>setCcEmiNewRate(e.target.value)}/>
                            </div>
                          </div>
                          {ccEmiNewMonthly&&<div style={{ color:T.sub,fontSize:10 }}>First installment amount: {sym}{fmt(parseMoney(ccEmiNewMonthly)||0)}</div>}
                        </div>
                      </div>
                    )}

                    {(ccEmiPlanId||ccEmiNewPlanMode)&&(
                      <div>
                        <span style={lbl}>Category (optional)</span>
                        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                          <button onClick={()=>{ setCatIds([]); setSubIds([]); }} style={{ background:!catIds.length?"#88888822":"none",border:`1px solid ${!catIds.length?"#888":T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>❓ None</button>
                          {cats.map(c=>(
                            <button key={c.id} onClick={()=>{ const newIds=catIds.includes(c.id)?catIds.filter(x=>x!==c.id):[c.id]; setCatIds(newIds); setSubIds([]); }} style={{ background:catIds.includes(c.id)?c.color+"22":"none",border:`1px solid ${catIds.includes(c.id)?c.color:T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:catIds.includes(c.id)?c.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{c.icon} {c.name.split(" ")[0]}</button>
                          ))}
                        </div>
                        {catIds.length>0&&cats.filter(c=>catIds.includes(c.id)&&c.subs?.length).map(c=>(
                          <div key={c.id} style={{ marginTop:8 }}>
                            <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                              {c.subs.map(s=><Chip key={s.id} color={c.color} active={subIds.includes(s.id)} onClick={()=>setSubIds(prev=>prev.includes(s.id)?prev.filter(x=>x!==s.id):[...prev,s.id])}>{s.name}</Chip>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* STEP 4 — CATEGORY (expense only) */}
            {txnType==="expense"&&(
              <div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:6 }}>
                  <span style={{ ...lbl,marginBottom:0 }}>Categories (select one or more)</span>
                  <button
                    onClick={()=>setShowQuickCategoryAdd(v=>!v)}
                    title="Add category or subcategory"
                    style={{
                      width:28,
                      height:28,
                      borderRadius:"50%",
                      border:`1px solid ${T.accent}55`,
                      background:showQuickCategoryAdd?T.accentSoft:"none",
                      color:T.accent,
                      cursor:"pointer",
                      fontSize:18,
                      fontWeight:800,
                      lineHeight:1,
                      fontFamily:"Nunito,sans-serif"
                    }}
                  >
                    +
                  </button>
                </div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  <button onClick={()=>{ setCategoryTouched(true); setCatIds([]); setSubIds([]); setCatAllocations({}); }} style={{ background:!catId?"#88888822":"none",border:`1px solid ${!catId?"#888888":T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:!catId?"#888888":T.sub,fontFamily:"Nunito,sans-serif" }}>❓ None</button>
                  {cats.map(c=>(
                    <button key={c.id} onClick={()=>{ setCategoryTouched(true); const existingValidIds=catIds.filter(id=>getCat(id)); const newIds=existingValidIds.includes(c.id)?existingValidIds.filter(x=>x!==c.id):[...existingValidIds,c.id]; setCatIds(newIds); setSubIds(prev=>prev.filter(sid=>newIds.some(cid=>getCat(cid)?.subs?.find(s=>s.id===sid)))); setCatAllocations(()=>buildEqualCategoryAllocations(newIds, amt)); }} style={{ background:catIds.includes(c.id)?c.color+"22":"none",border:`1px solid ${catIds.includes(c.id)?c.color:T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:catIds.includes(c.id)?c.color:T.sub,fontFamily:"Nunito,sans-serif",display:"flex",alignItems:"center",gap:4 }}>{c.icon} {c.name.split(" ")[0]}</button>
                  ))}
                </div>
                {showQuickCategoryAdd && (
                  <div style={{ marginTop:10,background:T.input,border:`1px dashed ${T.border}`,borderRadius:10,padding:10 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8 }}>
                      <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Quick add category / subcategory</div>
                      <button onClick={()=>setShowQuickCategoryAdd(false)} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:12,fontFamily:"Nunito,sans-serif" }}>✕</button>
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr auto",gap:8 }}>
                      <input
                        style={{ ...inpSm,minWidth:0 }}
                        placeholder="New category name"
                        value={quickCatName}
                        onChange={e=>setQuickCatName(e.target.value)}
                        onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addQuickCategory(); } }}
                      />
                      <button onClick={addQuickCategory} style={{ ...btnG,padding:"8px 10px",fontSize:11 }}>+ Category</button>
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginTop:8 }}>
                      <input
                        style={{ ...inpSm,minWidth:0 }}
                        placeholder={catIds.length>0 ? `Subcategory for ${getCat(catId || catIds[0])?.name || "selected category"}` : "Optional starter subcategory"}
                        value={quickSubName}
                        onChange={e=>setQuickSubName(e.target.value)}
                        onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); catIds.length>0 ? addQuickSubcategory() : addQuickCategory(); } }}
                      />
                      <button onClick={catIds.length>0 ? addQuickSubcategory : addQuickCategory} style={{ ...btnG,padding:"8px 10px",fontSize:11 }}>
                        {catIds.length>0 ? "+ Sub" : "+ Add"}
                      </button>
                    </div>
                  </div>
                )}

                {catIds.length>0&&(
                  <div style={{ marginTop:8 }}>
                    {catIds.map(cid=>{ const c=getCat(cid); if(!c.subs?.length) return null; return (
                      <div key={cid} style={{ marginBottom:6 }}>
                        <div style={{ color:c.color,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>{c.icon} {c.name}</div>
                        <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                          {c.subs.map(s=><Chip key={s.id} color={c.color} active={subIds.includes(s.id)} onClick={()=>{ setCategoryTouched(true); setSubIds(prev=>prev.includes(s.id)?prev.filter(x=>x!==s.id):[...prev,s.id]); }}>{s.name}</Chip>)}
                        </div>
                      </div>
                    ); })}
                  </div>
                )}

                {txnType==="expense"&&catIds.includes("transport")&&vehicles.length>0&&(
                  <div style={{ marginTop:10,background:T.input,borderRadius:10,padding:"10px 12px" }}>
                    <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8 }}>Vehicle</div>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                      <button onClick={()=>setVehicleId("")} style={{ background:!vehicleId?"#88888822":"none",border:`1px solid ${!vehicleId?"#888":T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>None</button>
                      {vehicles.map(v=>{
                        const vIcon=v.type==="bike"?"🏍️":v.type==="truck"?"🚛":v.type==="auto"?"🛺":"🚗";
                        const last4=(v.number||"").replace(/\s/g,"").slice(-4)||v.number||"";
                        return (
                          <button key={v.id} onClick={()=>setVehicleId(vehicleId===v.id?"":v.id)} style={{ background:vehicleId===v.id?"#3b82f622":"none",border:`1px solid ${vehicleId===v.id?"#3b82f6":T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:vehicleId===v.id?"#3b82f6":T.sub,fontFamily:"Nunito,sans-serif" }}>
                            {vIcon} {last4}{v.name?` · ${v.name}`:""}
                          </button>
                        );
                      })}
                    </div>
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
                          <input style={{ ...inpSm, width:90, textAlign:"right" }} type="number" min="0" value={catAllocations[cid]||""} placeholder="0" onChange={e=>{ setLastEditedCatId(cid); setCatAllocations(prev=>updateCategoryAllocation(catIds,cid,e.target.value,amt,prev)); }}/>
                        </div>
                      );
                    })}
                    <div style={{ color:T.sub, fontSize:10 }}>Total must equal transaction amount to enforce exact split.</div>
                  </div>
                )}

                <div style={{ marginTop:10, background:T.input, borderRadius:10, padding:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:1 }}>Items (beta)</div>
                      {useItemizedLines&&lineItems.length>0&&<span style={{ background:T.accent+"22",color:T.accent,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:800 }}>{lineItems.length} item{lineItems.length>1?"s":""}</span>}
                    </div>
                    <div style={{ display:"flex",gap:6 }}>
                      {useItemizedLines&&<button onClick={()=>{setEditingItemId(null);setShowItemSheet(true);}} style={{ background:T.accent+"22",border:`1px solid ${T.accent}44`,borderRadius:20,padding:"3px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>+ Add item</button>}
                      <button onClick={()=>{setUseItemizedLines(v=>!v);setShowItemSheet(false);}} style={{ background:useItemizedLines?T.accent+"22":"none",border:`1px solid ${useItemizedLines?T.accent:T.border}`,borderRadius:20,padding:"3px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:useItemizedLines?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{useItemizedLines?"ON":"OFF"}</button>
                    </div>
                  </div>
                  {!useItemizedLines&&<div style={{ color:T.sub,fontSize:10,marginTop:6 }}>Turn on to itemise this purchase by name, qty, unit and price.</div>}
                  {useItemizedLines&&lineItems.length===0&&<div style={{ color:T.sub,fontSize:10,marginTop:6 }}>No items yet. Tap + Add item to start.</div>}
                  {useItemizedLines&&lineItems.length>0&&(
                    <div style={{ marginTop:8,display:"flex",flexDirection:"column",gap:6 }}>
                      {lineItems.map(item=>{
                        const itemTotal = lineItemAmount(item);
                        return (
                          <div key={item.id} style={{ display:"flex",alignItems:"center",gap:8,background:T.card||T.bg,borderRadius:10,padding:"8px 10px",border:`1px solid ${T.border}` }}>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{item.label||"Unnamed item"}</div>
                              <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{item.qty||1} {item.unit||"nos"} @ {sym}{fmt(item.unitPrice||0)} each</div>
                            </div>
                            <div style={{ color:T.accent,fontSize:13,fontWeight:800 }}>{sym}{fmt(itemTotal)}</div>
                            <button onClick={()=>{setEditingItemId(item.id);setShowItemSheet(true);}} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:8,padding:"3px 8px",cursor:"pointer",fontSize:11,color:T.sub,fontFamily:"Nunito,sans-serif" }}>Edit</button>
                            <button onClick={()=>removeLineItem(item.id)} style={{ background:"none",border:`1px solid ${T.danger}44`,borderRadius:8,padding:"3px 8px",cursor:"pointer",fontSize:11,color:T.danger,fontFamily:"Nunito,sans-serif" }}>x</button>
                          </div>
                        );
                      })}
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4 }}>
                        <span style={{ color:T.sub,fontSize:10 }}>Items total</span>
                        <span style={{ color:Math.abs(lineItemsTotal-amt)<0.01?T.success:T.warn,fontSize:13,fontWeight:800 }}>{sym}{fmt(lineItemsTotal)}{Math.abs(lineItemsTotal-amt)>=0.01?` (\u2260 ${sym}${fmt(amt)} txn total)`:""}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 5 - WHO IS THIS FOR? */}
            {txnType==="expense"&&(
              <div>
                <span style={lbl}>Who is this for? (optional)</span>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:10 }}>
                  <button onClick={()=>{ setSplitMode("none"); setTagPerson(""); setTagGroup(""); setSplitPeople({}); setSplitGroup(""); setAttributePeople({}); setAttributeAmounts({}); }} style={{ background:splitMode==="none"?T.accent+"22":"none",border:`1px solid ${splitMode==="none"?T.accent:T.border}`,borderRadius:20,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:splitMode==="none"?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>😎 Me only</button>
                  {people.filter(p=>!p.isMe).map(p=>{ const isSelected=tagPerson===String(p.id); return (
                    <button key={p.id} onClick={()=>{ setAttributePeople({}); setAttributeAmounts({}); if(tagPerson===String(p.id)){ setTagPerson(""); setSplitMode("none"); } else { setTagPerson(String(p.id)); setSplitMode("tag"); setTagGroup(""); setSplitGroup(""); } }} style={{ background:isSelected?p.color+"22":"none",border:`1px solid ${isSelected?p.color:T.border}`,borderRadius:20,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:isSelected?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>
                  ); })}
                  {groups.map(g=>{ const isSelected=tagGroup===g.id||splitGroup===g.id; return (
                    <button key={g.id} onClick={()=>{
                      setAttributePeople({}); setAttributeAmounts({});
                      if(isSelected){ setTagGroup(""); setSplitGroup(""); setSplitMode("none"); }
                      else {
                        const di=g.defaultIntent||(g.typeId==="family"||g.typeId==="business"?"attributed":"split");
                        if(di==="attributed"){ setTagGroup(g.id); setSplitMode("tag"); setTagMode("attribute"); setTagPerson(""); setSplitGroup(""); }
                        else { setSplitGroup(g.id); setSplitMode("split"); setTagGroup(""); setTagPerson(""); }
                      }
                    }} style={{ background:isSelected?g.color+"22":"none",border:`1px solid ${isSelected?g.color:T.border}`,borderRadius:20,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:isSelected?g.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{g.icon||"👥"} {g.name}</button>
                  ); })}
                  <button onClick={()=>setShowGuestPerson(v=>!v)} style={{ background:showGuestPerson?T.warn+"22":"none",border:`1px solid ${showGuestPerson?T.warn:T.border}`,borderRadius:20,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:showGuestPerson?T.warn:T.sub,fontFamily:"Nunito,sans-serif" }}>👤 One-time</button>
                  <button onClick={()=>{
                    if(attributePersonIds.length>0){ setAttributePeople({}); setAttributeAmounts({}); }
                    else { setSplitMode("none"); setTagPerson(""); setTagGroup(""); setSplitPeople({}); setSplitGroup(""); setAttributePeople({__pending__:true}); }
                  }} style={{ background:(attributePersonIds.length>0||attributePeople.__pending__)?T.purple+"22":"none",border:`1px solid ${(attributePersonIds.length>0||attributePeople.__pending__)?T.purple:T.border}`,borderRadius:20,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:(attributePersonIds.length>0||attributePeople.__pending__)?T.purple:T.sub,fontFamily:"Nunito,sans-serif" }}>👥 Multiple people</button>
                </div>
                {/* Multi-person attribution with custom per-person amounts */}
                {(attributePersonIds.length>0||attributePeople.__pending__)&&(
                  <div style={{ background:T.input,borderRadius:12,padding:"10px 14px",marginBottom:8 }}>
                    <div style={{ color:T.sub,fontSize:11,marginBottom:8 }}>Select everyone this expense is for — no collection, budget attributed to each</div>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                      {people.filter(p=>!p.isMe).map(p=>{ const isOn=Boolean(attributePeople[p.id]); return (
                        <button key={p.id} onClick={()=>{ setAttributePeople(prev=>{ const next={...prev}; delete next.__pending__; if(next[p.id]) delete next[p.id]; else next[p.id]=true; return next; }); setAttributeAmounts(prev=>{ const next={...prev}; delete next[p.id]; return next; }); }} style={{ background:isOn?p.color+"22":"none",border:`1px solid ${isOn?p.color:T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:isOn?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>
                      ); })}
                    </div>
                    {attributePersonIds.length>0&&(
                      <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                        {attributePersonIds.map(pid=>{ const p=getPerson(pid); return (
                          <div key={pid} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8 }}>
                            <span style={{ color:T.text,fontSize:12,fontWeight:700 }}>{p.emoji} {p.name}</span>
                            <input style={{ ...inpSm, width:90, textAlign:"right" }} type="number" min="0" value={attributeAmounts[pid]||""} placeholder="0" onChange={e=>setAttributeAmounts(prev=>updateCategoryAllocation(attributePersonIds,pid,e.target.value,amt,prev))}/>
                          </div>
                        ); })}
                        <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>Total: {sym}{fmt(attributePersonIds.reduce((s,pid)=>s+(parseFloat(attributeAmounts[pid])||0),0))} of {sym}{fmt(amt)}</div>
                      </div>
                    )}
                  </div>
                )}
                {showGuestPerson&&(
                  <div style={{ background:T.warn+"16",border:`1px solid ${T.warn}33`,borderRadius:12,padding:"10px 14px",marginBottom:8 }}>
                    <div style={{ color:T.warn,fontSize:11,fontWeight:700,marginBottom:8 }}>👤 One-time person — not saved to your contacts</div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                      <div><span style={lbl}>Name</span><input style={inp} placeholder="e.g. Office colleague" value={guestPersonName} onChange={e=>setGuestPersonName(e.target.value)}/></div>
                      <div><span style={lbl}>They owe ({sym})</span><input style={inp} type="text" inputMode="decimal" placeholder="0" value={guestPersonAmount} onChange={e=>setGuestPersonAmount(cleanMoneyInput(e.target.value))}/></div>
                    </div>
                    <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>When they pay back → go to TXNS → find this expense → mark their share settled</div>
                  </div>
                )}
                {splitMode==="tag"&&tagPerson&&(()=>{
                  const p=people.find(x=>String(x.id)===tagPerson); if(!p) return null;
                  return (<div style={{ background:T.input,borderRadius:12,padding:"10px 14px",marginBottom:8 }}>
                    <div style={{ color:T.sub,fontSize:11,marginBottom:8 }}>This expense on {p.name} —</div>
                    <div style={{ display:"flex",gap:8 }}>
                      <button onClick={()=>{ setTagMode("person"); setSplitMode("tag"); setSplitPeople({[tagPerson]:true}); setSplitCalc("equally"); setSplitGroup(""); }} style={{ flex:1,background:tagMode==="person"?T.success+"22":"none",border:`1px solid ${tagMode==="person"?T.success:T.border}`,borderRadius:10,padding:"8px",cursor:"pointer",fontFamily:"Nunito,sans-serif",textAlign:"left" }}>
                        <div style={{ fontSize:11,fontWeight:700,color:tagMode==="person"?T.success:T.text }}>💸 They owe me back</div>
                        <div style={{ fontSize:9,color:T.sub,marginTop:2 }}>Tracked in receivables</div>
                      </button>
                      <button onClick={()=>{ setTagMode("attribute"); setSplitMode("tag"); setSplitPeople({}); setSplitGroup(""); }} style={{ flex:1,background:tagMode==="attribute"?T.info+"22":"none",border:`1px solid ${tagMode==="attribute"?T.info:T.border}`,borderRadius:10,padding:"8px",cursor:"pointer",fontFamily:"Nunito,sans-serif",textAlign:"left" }}>
                        <div style={{ fontSize:11,fontWeight:700,color:tagMode==="attribute"?T.info:T.text }}>❤️ For them (no collection)</div>
                        <div style={{ fontSize:9,color:T.sub,marginTop:2 }}>Budget attributed</div>
                      </button>
                    </div>
                  </div>);
                })()}
                {/* Group intent */}
                {(tagGroup||splitGroup)&&(()=>{
                  const g=groups.find(x=>x.id===(tagGroup||splitGroup)); if(!g) return null;
                  const currentIntent=tagGroup?"attributed":"split";
                  return (<div style={{ background:T.input,borderRadius:12,padding:"10px 14px",marginBottom:8 }}>
                    <div style={{ color:T.sub,fontSize:11,marginBottom:8 }}>{g.icon} {g.name}</div>
                    <div style={{ display:"flex",gap:8,marginBottom:10 }}>
                      <button onClick={()=>{ setSplitGroup(g.id); setTagGroup(""); setSplitMode("split"); }} style={{ flex:1,background:currentIntent==="split"?T.accent+"22":"none",border:`1px solid ${currentIntent==="split"?T.accent:T.border}`,borderRadius:10,padding:"8px",cursor:"pointer",fontFamily:"Nunito,sans-serif",textAlign:"left" }}>
                        <div style={{ fontSize:11,fontWeight:700,color:currentIntent==="split"?T.accent:T.text }}>⚖️ Split (collect)</div>
                        <div style={{ fontSize:9,color:T.sub,marginTop:2 }}>Group owes their share</div>
                      </button>
                      <button onClick={()=>{ setTagGroup(g.id); setSplitGroup(""); setSplitMode("tag"); setTagMode("attribute"); }} style={{ flex:1,background:currentIntent==="attributed"?T.info+"22":"none",border:`1px solid ${currentIntent==="attributed"?T.info:T.border}`,borderRadius:10,padding:"8px",cursor:"pointer",fontFamily:"Nunito,sans-serif",textAlign:"left" }}>
                        <div style={{ fontSize:11,fontWeight:700,color:currentIntent==="attributed"?T.info:T.text }}>🏠 Attributed</div>
                        <div style={{ fontSize:9,color:T.sub,marginTop:2 }}>No collection</div>
                      </button>
                    </div>
                    {currentIntent==="split"&&(<>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                        {(g.members||[]).map(pid=>{ const p=people.find(x=>String(x.id)===String(pid)); if(!p) return null; return (
                          <button key={pid} onClick={()=>setSplitPeople(prev=>({...prev,[pid]:!prev[pid]}))} style={{ background:splitPeople[pid]?p.color+"22":"none",border:`1px solid ${splitPeople[pid]?p.color:T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:splitPeople[pid]?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>
                        ); })}
                      </div>
                      {Object.keys(splitPeople).filter(k=>splitPeople[k]).length>0&&(
                        <div style={{ display:"flex",gap:6,marginBottom:8 }}>
                          {[["equally","= Equal"],["amount","₹ Amount"],["percent","% Pct"]].map(([v,lb])=>(
                            <button key={v} onClick={()=>setSplitCalc(v)} style={{ flex:1,background:splitCalc===v?T.accent+"22":"none",border:`1px solid ${splitCalc===v?T.accent:T.border}`,borderRadius:20,padding:"4px",cursor:"pointer",fontSize:10,fontWeight:700,color:splitCalc===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{lb}</button>
                          ))}
                        </div>
                      )}
                      {splitCalc==="amount"&&Object.keys(splitPeople).filter(k=>splitPeople[k]).map(pid=>{ const p=people.find(x=>String(x.id)===String(pid)); if(!p) return null; return (
                        <div key={pid} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                          <span style={{ color:T.text,fontSize:12,flex:1 }}>{p.emoji} {p.name}</span>
                          <input type="text" inputMode="decimal" placeholder="0" value={splitCustom[pid]||""} onChange={e=>{ try{ setSplitCustom(prev=>({...prev,[pid]:cleanMoneyInput(e.target.value)})); }catch(err){} }} style={{ ...inpSm,width:80,textAlign:"right" }}/>
                        </div>
                      ); })}
                    </>)}
                  </div>);
                })()}
              </div>
            )}

            {/* LINK TO BILL / SUBSCRIPTION */}
            {txnType==="expense"&&(
              <div style={{ background:T.input,borderRadius:12,padding:"12px 14px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:billerLinkId?10:0 }}>
                  <span style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5 }}>📎 Link to Bill / Subscription (optional)</span>
                  {billerLinkId&&<button onClick={()=>{ setBillerLinkId(""); setShowMembershipPanel(false); }} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>Remove</button>}
                </div>
                {!billerLinkId&&(
                  <select style={inp} value="" onChange={e=>{
                    const id=e.target.value;
                    if(!id) return;
                    setBillerLinkId(id);
                    const ba=billerAccounts.find(b=>b.id===id);
                    if(ba && getBillerActionType(ba.type)==="membership") setShowMembershipPanel(true);
                    // Auto-attribute from the biller account's own "Attributed To" setting — but only if
                    // nothing has been manually chosen yet in "Who is this for?", so this never overwrites
                    // a deliberate choice the person already made.
                    if(ba && ba.attributedTo && splitMode==="none" && attributePersonIds.length===0){
                      if(ba.attributeType==="person"){ setTagPerson(String(ba.attributedTo)); setSplitMode("tag"); setTagMode("attribute"); setTagGroup(""); setSplitGroup(""); }
                      else if(ba.attributeType==="group"){ setTagGroup(String(ba.attributedTo)); setSplitMode("tag"); setTagMode("attribute"); setTagPerson(""); setSplitGroup(""); }
                    }
                  }}>
                    <option value="">Select biller account...</option>
                    {billerAccounts.map(ba=>(<option key={ba.id} value={ba.id}>{getBillerIcon(ba.type)} {ba.name} — {ba.type}</option>))}
                  </select>
                )}
                {linkedBA&&(
                  <div>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:showMembershipPanel?10:0 }}>
                      <span style={{ fontSize:20 }}>{getBillerIcon(linkedBA.type)}</span>
                      <div>
                        <div style={{ color:T.text,fontSize:12,fontWeight:800 }}>{linkedBA.name}</div>
                        <div style={{ color:T.sub,fontSize:10 }}>{linkedBA.type}{linkedBA.consumerNo?` · #${linkedBA.consumerNo}`:""}</div>
                      </div>
                      {linkedBAType==="membership"&&(
                        <button onClick={()=>setShowMembershipPanel(v=>!v)} style={{ marginLeft:"auto",background:showMembershipPanel?T.accent+"22":"none",border:`1px solid ${T.accent}44`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>{showMembershipPanel?"Hide dates":"+ Add dates"}</button>
                      )}
                    </div>
                    {/* Membership panel */}
                    {showMembershipPanel&&linkedBAType==="membership"&&(
                      <div style={{ display:"flex",flexDirection:"column",gap:10,background:T.card,borderRadius:10,padding:"10px",marginTop:8 }}>
                        <div>
                          <span style={lbl}>Member</span>
                          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                            <button onClick={()=>setLinkMemberPersonId("self")} style={{ background:linkMemberPersonId==="self"?T.accent+"22":"none",border:`1px solid ${linkMemberPersonId==="self"?T.accent:T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:linkMemberPersonId==="self"?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>Me</button>
                            {people.map(p=>(<button key={p.id} onClick={()=>setLinkMemberPersonId(String(p.id))} style={{ background:linkMemberPersonId===String(p.id)?T.accent+"22":"none",border:`1px solid ${linkMemberPersonId===String(p.id)?T.accent:T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:linkMemberPersonId===String(p.id)?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>))}
                          </div>
                        </div>
                        <div style={{ display:"flex",gap:6 }}>
                          {["monthly","quarterly","halfyearly","annual"].map(c=>(<button key={c} onClick={()=>setLinkCycle(c)} style={{ flex:1,background:linkCycle===c?T.accent+"22":"none",border:`1px solid ${linkCycle===c?T.accent:T.border}`,borderRadius:10,padding:"5px 2px",cursor:"pointer",fontSize:9,fontWeight:700,color:linkCycle===c?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>))}
                        </div>
                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
                          <div><span style={lbl}>Valid From</span><input style={inp} type="date" value={linkValidFrom} onChange={e=>setLinkValidFrom(e.target.value)}/></div>
                          <div><span style={lbl}>No. of cycles</span><input style={inp} type="number" min="1" value={linkBulkMonths} onChange={e=>setLinkBulkMonths(e.target.value)}/></div>
                          <div><span style={lbl}>Grace days</span><input style={inp} type="number" min="0" value={linkGraceDays} onChange={e=>setLinkGraceDays(e.target.value)}/></div>
                        </div>
                        {linkValidUntil&&<div style={{ background:T.success+"16",borderRadius:10,padding:"8px 12px",display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:11 }}>Valid Until</span><span style={{ color:T.success,fontSize:12,fontWeight:800 }}>{formatShortDate(linkValidUntil)||linkValidUntil}</span></div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* QUICK FLAGS */}
            {txnType==="expense"&&(
              <div style={{ background:T.input,borderRadius:12,padding:"12px 14px" }}>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:isBillPayment?10:0 }}>
                  <button onClick={()=>{ setReimbursable(r=>!r); if(reimbursable) setReimbursableAmount(""); }} title={reimbursable?"Reimbursable — tap to remove":"Mark as reimbursable work expense"} style={{ background:reimbursable?"#f0a50018":"none",border:`1px solid ${reimbursable?"#f0a500":T.border}`,borderRadius:20,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:800,color:reimbursable?"#f0a500":T.sub,fontFamily:"Nunito,sans-serif",display:"inline-flex",alignItems:"center",gap:4 }}>
                    <span>💼</span>
                    <span>{reimbursable?"Reimbursable ✓":"Work expense"}</span>
                  </button>
                  <button onClick={()=>setIsBillPayment(v=>!v)} style={{ background:isBillPayment?T.accent+"20":"none",border:`1px solid ${isBillPayment?T.accent:T.border}`,borderRadius:20,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:800,color:isBillPayment?T.accent:T.sub,fontFamily:"Nunito,sans-serif",display:"inline-flex",alignItems:"center",gap:6 }}>
                    <span>🧾</span>
                    <span>Bill payment</span>
                    {isBillPayment&&<span style={{ fontSize:10 }}>✓</span>}
                  </button>
                </div>
                {reimbursable&&(
                  <div style={{ marginTop:8 }}>
                    <span style={lbl}>Reimbursable amount{amt>0?` (blank = full ${sym}${fmt(amt)})`:""}</span>
                    <input style={inp} type="number" inputMode="decimal" placeholder={amt>0?`${fmt(amt)} (full)`:"e.g. 7000"} value={reimbursableAmount} onChange={e=>setReimbursableAmount(e.target.value)}/>
                  </div>
                )}
                {isBillPayment&&<input style={{ ...inp,marginTop:4 }} placeholder="Invoice / Bill Number (optional) e.g. MSEB/2026/04/001" value={billInvoiceNo} onChange={e=>setBillInvoiceNo(e.target.value)}/>}
              </div>
            )}

            {/* SMS PASTE */}
            <div style={{ background:T.input,borderRadius:12,overflow:"hidden" }}>
              <button onClick={()=>setShowSms(p=>!p)} style={{ width:"100%",background:"none",border:"none",padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:"Nunito,sans-serif" }}>
                <span>📱</span>
                <span style={{ color:T.sub,fontSize:13,fontWeight:700,flex:1,textAlign:"left" }}>Bank SMS import</span>
                <span style={{ color:T.sub,fontSize:12 }}>{showSms?"▲":"▼"}</span>
              </button>
              {showSms&&<div style={{ padding:"0 14px 14px" }}>
                {smsImportStatus&&/unable|empty|not available|error/i.test(smsImportStatus)&&<div style={{ color:T.warn,fontSize:11,fontWeight:700,marginBottom:6 }}>{smsImportStatus}</div>}
                <div style={{ display:"flex",gap:6,marginBottom:6 }}>
                  <textarea
                    style={{ ...inp,height:80,resize:"none",flex:1,marginBottom:0,cursor:smsBusy?"wait":"text" }}
                    placeholder="Paste bank SMS here..."
                    value={smsTxt}
                    onChange={e=>{ setSmsTxt(e.target.value); parseSms(e.target.value, { adjustBalance: true }); }}
                    onPaste={e=>{ const txt=e.clipboardData?.getData("text")||""; if(txt){ e.preventDefault(); setSmsTxt(txt); parseSms(txt, { adjustBalance:true }); } }}
                  />
                  <button onClick={async()=>{
                    try{
                      const txt = await navigator.clipboard.readText();
                      if(txt){ setSmsTxt(txt); parseSms(txt,{ adjustBalance:true }); }
                    }catch(e){ /* permission denied, user must paste manually */ }
                  }} style={{ background:T.accent+"22",border:`1px solid ${T.accent}44`,borderRadius:10,padding:"8px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif",flexShrink:0,alignSelf:"stretch" }}>📋<br/>Paste</button>
                </div>
                {smsParseMeta?.balanceAdjusted&&<div style={{ color:T.success,fontSize:11,fontWeight:700 }}>✅ Balance synced ({smsParseMeta.balanceDiff>0?"+":""}{sym}{fmt(smsParseMeta.balanceDiff)})</div>}
                {smsParseMeta?.emiLoanId&&<div style={{ background:T.warn+"16",border:`1px solid ${T.warn}33`,borderRadius:10,padding:"6px 10px",display:"flex",justifyContent:"space-between",alignItems:"center" }}><span style={{ color:T.warn,fontSize:11,fontWeight:700 }}>🔗 EMI match: {smsParseMeta.emiLoanName}</span><button onClick={()=>{ setExpensePaymentMode("emi"); }} style={{ background:T.warn+"22",border:`1px solid ${T.warn}`,borderRadius:20,padding:"2px 8px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.warn,fontFamily:"Nunito,sans-serif" }}>Link</button></div>}
              </div>}
            </div>

            {/* ATTACHMENTS */}
            <div style={{ background:T.input,borderRadius:12,padding:"11px 14px" }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,minWidth:0 }}>
                  <span>📷</span>
                  <span style={{ color:T.sub,fontSize:13,fontWeight:700 }}>Attachments</span>
                </div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end" }}>
                  <label style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>
                    {imageBase64 ? (isBillPayment ? "Change bill" : "Change receipt") : (isBillPayment ? "Add bill" : "Add receipt")}
                    <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setImageBase64(ev.target.result); r.readAsDataURL(f); }}/>
                  </label>
                  {isBillPayment&&<label style={{ background:T.success+"18",border:`1px solid ${T.success}33`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.success,fontFamily:"Nunito,sans-serif" }}>
                    {paymentImageBase64?"Change proof":"Add proof"}
                    <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setPaymentImageBase64(ev.target.result); r.readAsDataURL(f); }}/>
                  </label>}
                  {imageBase64&&<button onClick={()=>setImageBase64(null)} style={{ background:"none",border:`1px solid ${T.danger}33`,borderRadius:8,color:T.danger,cursor:"pointer",fontSize:11,fontWeight:700,padding:"5px 10px",fontFamily:"Nunito,sans-serif" }}>Clear bill</button>}
                  {isBillPayment&&paymentImageBase64&&<button onClick={()=>setPaymentImageBase64(null)} style={{ background:"none",border:`1px solid ${T.danger}33`,borderRadius:8,color:T.danger,cursor:"pointer",fontSize:11,fontWeight:700,padding:"5px 10px",fontFamily:"Nunito,sans-serif" }}>Clear proof</button>}
                </div>
              </div>
              {(imageBase64 || (isBillPayment && paymentImageBase64))&&(
                <div style={{ display:"grid",gridTemplateColumns:imageBase64&&isBillPayment&&paymentImageBase64?"1fr 1fr":"1fr",gap:10,marginTop:10 }}>
                  {imageBase64&&<div>
                    <div style={{ color:T.sub,fontSize:10,fontWeight:700,marginBottom:6 }}>{isBillPayment?"🧾 Bill / receipt":"🧾 Receipt"} · tap to view</div>
                    <img src={imageBase64} alt="receipt" onClick={()=>setImageViewSrc(imageBase64)} style={{ width:"100%",borderRadius:10,maxHeight:160,objectFit:"cover",cursor:"zoom-in" }} onError={e=>{ e.target.style.display="none"; setImageBase64(null); }}/>
                  </div>}
                  {isBillPayment&&paymentImageBase64&&<div>
                    <div style={{ color:T.sub,fontSize:10,fontWeight:700,marginBottom:6 }}>💳 Payment proof · tap to view</div>
                    <img src={paymentImageBase64} alt="payment proof" onClick={()=>setImageViewSrc(paymentImageBase64)} style={{ width:"100%",borderRadius:10,maxHeight:160,objectFit:"cover",cursor:"zoom-in" }} onError={e=>{ e.target.style.display="none"; setPaymentImageBase64(null); }}/>
                  </div>}
                </div>
              )}
            </div>

            {refDupWarning&&(
              <div style={{ background:T.warn+"18",border:`1px solid ${T.warn}44`,borderRadius:10,padding:"8px 12px",color:T.warn,fontSize:11,fontWeight:700 }}>{refDupWarning}</div>
            )}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={closeModal} style={btnG}>Cancel</button>
              <button onClick={submit} style={{ ...btnP,opacity:canSubmit?1:0.5 }}>{canSubmit?(isEditing?"Save Changes ✓":"Add ✓"):txnType==="investment"?"Fill name & amount":"Fill vendor & amount"}</button>
            </div>
          </div>
        </div>
      </div>
      {showItemSheet&&useItemizedLines&&(
        <ItemSheetModal
          editingItemId={editingItemId}
          lineItems={lineItems}
          onClose={()=>{ setShowItemSheet(false); setEditingItemId(null); }}
          onSave={item=>{
            if(editingItemId){
              setLineItems(prev=>prev.map(x=>x.id===editingItemId?{...x,...item}:x));
            } else {
              setLineItems(prev=>[...prev,{...item,id:genId()}]);
            }
          }}
          cats={cats} getCat={getCat}
          measureUnits={measureUnits||["nos","kg","g","l","ml","pkt","pcs","box","pair","set"]}
          formatMeasureUnitLabel={u=>u}
          sym={sym} fmt={fmt} T={T} inp={inp} lbl={lbl}
        />
      )}
      </>
    );
  };

  // ── ITEM SHEET MODAL (B3) ───────────────────────────────────────────────────────
  const ItemSheetModal = ({ editingItemId, lineItems, onClose, onSave, cats, getCat, measureUnits, formatMeasureUnitLabel, sym, fmt, T, inp, lbl }) => {
    const editItem = editingItemId ? lineItems.find(x=>x.id===editingItemId) : null;
    const [iName, setIName] = useState(editItem?.label||"");
    const [iQty, setIQty] = useState(String(editItem?.qty||"1"));
    const [iUnit, setIUnit] = useState(editItem?.unit||"nos");
    const [iPrice, setIPrice] = useState(String(editItem?.unitPrice||""));
    const [iCatId, setICatId] = useState(editItem?.catId||"");
    const [iSubId, setISubId] = useState(editItem?.subId||"");
    const iTotal = (parseFloat(iQty)||0) * (parseFloat(iPrice)||0);
    const iCat = iCatId ? getCat(iCatId) : null;
    // Item memory: look up a previously-used item by name (case-insensitive) and auto-fill its
    // remembered category/sub-category/unit — but only into fields still empty, so it never
    // overwrites something the user already chose (same fight-the-user pitfall as the category-split bug).
    const applyItemMemory = () => {
      if(editingItemId || !iName.trim()) return;
      const match = itemCatalog.find(it=>it.name.toLowerCase()===iName.trim().toLowerCase());
      if(!match) return;
      if(!iCatId && match.catId) setICatId(match.catId);
      if(!iSubId && match.subId) setISubId(match.subId);
      if(iUnit==="nos" && match.unit) setIUnit(match.unit);
    };
    const handleSave = () => {
      if(!iName.trim()) return;
      onSave({ id: editingItemId||genId(), label:iName.trim(), qty:iQty, unit:iUnit, unitPrice:iPrice, catId:iCatId||null, subId:iSubId||null });
      // Remember this item's category/sub-category/unit for next time, keyed by name (case-insensitive).
      const nameKey = iName.trim();
      setItemCatalog(prev=>{
        const idx = prev.findIndex(it=>it.name.toLowerCase()===nameKey.toLowerCase());
        const entry = { id: idx>=0?prev[idx].id:genId(), name:nameKey, unit:iUnit||"nos", catId:iCatId||"", subId:iSubId||"" };
        if(idx>=0){ const next=[...prev]; next[idx]=entry; return next; }
        return [...prev, entry];
      });
      onClose();
    };
    return (
      <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:350,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"82vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
            <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{editingItemId?"Edit Item":"Add Item"}</div>
            <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div>
              <span style={lbl}>Item Name *</span>
              <input style={{ ...inp,fontSize:15,fontWeight:700 }} placeholder="e.g. Milk, Petrol, Shampoo" value={iName} onChange={e=>setIName(e.target.value)} onBlur={applyItemMemory} autoFocus/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
              <div><span style={lbl}>Qty</span><input style={{ ...inp,textAlign:"center" }} type="number" min="0" placeholder="1" value={iQty} onChange={e=>setIQty(e.target.value)}/></div>
              <div><span style={lbl}>Unit</span><select style={inp} value={iUnit} onChange={e=>setIUnit(e.target.value)}>{(measureUnits||[]).map(u=><option key={u} value={u}>{formatMeasureUnitLabel?formatMeasureUnitLabel(u):u}</option>)}</select></div>
              <div><span style={lbl}>Price/unit</span><input style={{ ...inp,textAlign:"right" }} type="number" min="0" placeholder="0" value={iPrice} onChange={e=>setIPrice(e.target.value)}/></div>
            </div>
            {iQty&&iPrice&&<div style={{ background:T.input,borderRadius:10,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span style={{ color:T.sub,fontSize:12 }}>Item total</span>
              <span style={{ color:T.accent,fontSize:14,fontWeight:800 }}>{sym}{fmt(iTotal)}</span>
            </div>}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <div><span style={lbl}>Category</span><select style={inp} value={iCatId} onChange={e=>{setICatId(e.target.value);setISubId("");}}><option value="">Select</option>{(cats||[]).map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
              <div><span style={lbl}>Sub-category</span><select style={inp} value={iSubId} onChange={e=>setISubId(e.target.value)}><option value="">Select</option>{(iCat?.subs||[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            </div>
            <button onClick={handleSave} disabled={!iName.trim()} style={{ background:iName.trim()?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:iName.trim()?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>{editingItemId?"Save Changes ✓":"Add Item ✓"}</button>
          </div>
        </div>
      </div>
    );
  };

  // ── SETTLE MODAL ───────────────────────────────────────────────────────────
  const SettleModal = () => {
    const t = settleTxn;
    const owedPeople = Object.entries(t?.people||{}).filter(([pid,info])=>info.mode==="owes"&&!info.settled&&pid!=="__me__"&&remainingShare(info)>0);
    const [partials, setPartials] = useState(Object.fromEntries(owedPeople.map(([pid,info])=>[pid,String(remainingShare(info))])));
    const [receiptImg, setReceiptImg] = useState(null);
    const [accId, setAccId] = useState(accounts.find(a=>a.type!=="cc")?.id||"");
    const [settleRef, setSettleRef] = useState("");
    const [settleSms, setSettleSms] = useState("");
    const [showSettleSms, setShowSettleSms] = useState(false);
    const [settleDate, setSettleDate] = useState(todayStr());
    if(!t) return null;

    const settle = pid => {
      // Calculate total due across all sources (bills + txns)
      const billsDue = (t._billIds||[]).reduce((sum,billId)=>{
        const bill = bills.find(b=>b.id===billId);
        return sum + (bill?.splitPeople?.[pid] ? remainingShare(bill.splitPeople[pid]) : 0);
      },0);
      const txnsDue = (t._txnIds||[]).reduce((sum,txnId)=>{
        const txn = txns.find(x=>x.id===txnId);
        return sum + (txn?.people?.[pid] ? remainingShare(txn.people[pid]) : 0);
      },0);
      const dueAmt = t._isBillSettle
        ? billsDue + txnsDue
        : remainingShare(t.people?.[pid]);
      const requestedAmt = parseFloat(partials[pid])||0;
      if(!requestedAmt) return;
      const appliedAmt = Math.min(requestedAmt, dueAmt);
      const extraAmt = Math.max(0, requestedAmt - dueAmt);
      const p = getPerson(pid);
      const settleId = Date.now()+Math.random();
      const settleDesc = `${p.name} settled${t.desc?` against '${t.desc}'`:''}${extraAmt>0?` + ${sym}${fmt(extraAmt)} advance`:''}`;

      // Build settlementLinks so the txn properly references what it settled
      const settlementLinks = [];
      if(t._isBillSettle) {
        // Bill links: allocate appliedAmt across bills first, then txns
        let linkRem = appliedAmt;
        (t._billIds||[]).forEach(billId=>{
          const bill = bills.find(b=>b.id===billId);
          if(!bill?.splitPeople?.[pid]||linkRem<=0) return;
          const ba = remainingShare(bill.splitPeople[pid]);
          if(ba<=0) return;
          const paidNow = Math.min(linkRem, ba);
          linkRem -= paidNow;
          settlementLinks.push({ kind:"bill", id:billId, personId:pid, amount:paidNow, title:bill.name||bill.merchant||"Bill" });
        });
        // Txn links: remaining amount goes to explicit txnIds (mixed settle)
        (t._txnIds||[]).forEach(txnId=>{
          const txn = txns.find(x=>x.id===txnId);
          if(!txn?.people?.[pid]||linkRem<=0) return;
          const ta = remainingShare(txn.people[pid]);
          if(ta<=0) return;
          const paidNow = Math.min(linkRem, ta);
          linkRem -= paidNow;
          settlementLinks.push({ kind:"txn", id:txnId, personId:pid, amount:paidNow, title:txn.desc||txn.merchant||"Expense" });
        });
      } else if(!t._isFallbackSettle && t.id) {
        // Regular expense txn settle
        settlementLinks.push({ kind:"txn", id:t.id, personId:pid, amount:appliedAmt, title:t.desc||t.merchant||"Expense" });
      }

      const newSettleTxn = { id:settleId, type:"settlement_in", desc:settleDesc, merchant:"", date:settleDate||todayStr(), note:`Against: ${t.desc||"unknown"} · Account: ${getAcc(accId)?.name||"unnamed"}${extraAmt>0?` · Extra ${sym}${fmt(extraAmt)} kept as advance`:""}`, amount:requestedAmt, appliedAmount:appliedAmt, extraAmount:extraAmt, accId, fromPersonId:pid, groupId:t.groupId||null, againstTxnId:(t._isBillSettle||t._isFallbackSettle)?null:t.id, settlementLinks, imageBase64:receiptImg, transactionRef:settleRef.trim()||null };
      const upsertSettlement = prev => {
        const newKey = linkedSettlementKey(newSettleTxn);
        if(newKey && prev.some(x=>linkedSettlementKey(x)===newKey)) return prev;
        return [newSettleTxn,...prev];
      };
      if(t._isBillSettle){
        // Settle against bills (and any explicit _txnIds from mixed settle)
        let remaining=appliedAmt;
        setTxns(prev=>{
          const withSettlement = upsertSettlement(prev);
          return withSettlement.map(x=>{
            // Settle explicit _txnIds (mixed txn+bill settle)
            if(t._txnIds?.includes(x.id) && x.people?.[pid]) {
              const origAmt = Number(x.people[pid]?.amount||0);
              const prevP = Number(x.people[pid]?.settledAmt||0);
              const txnAmt = remainingShare(x.people[pid]);
              const paidNow = Math.min(remaining, txnAmt);
              const nextP = Math.min(origAmt, prevP + paidNow);
              const nextPRem = Math.max(0, origAmt - nextP);
              const groupCap = Number(x.groupCollectiveAmount||0);
              const nextGrp = groupCap > 0 ? Math.min(groupCap, Number(x.groupCollectiveSettledAmt||0) + paidNow) : x.groupCollectiveSettledAmt;
              remaining -= paidNow;
              return { ...x, people:{ ...x.people, [pid]:{ ...x.people[pid], settled:nextPRem<=0, settledAmt:nextP, remainingAmt:nextPRem } }, ...(groupCap > 0 ? { groupCollectiveSettledAmt:nextGrp } : {}) };
            }
            // If this txn is the paidByTxnId for one of the bills, also clear its people split
            const billForTxn = (t._billIds||[]).map(id=>bills.find(b=>b.id===id)).find(b=>b?.paidByTxnId && String(b.paidByTxnId)===String(x.id));
            if(!billForTxn || !x.people?.[pid]) return x;
            const origAmt = Number(x.people[pid]?.amount||0);
            const prevP = Number(x.people[pid]?.settledAmt||0);
            const nextP = Math.min(origAmt, prevP + appliedAmt);
            const nextPRem = Math.max(0, origAmt - nextP);
            const addedP = nextP - prevP;
            const groupCap = Number(x.groupCollectiveAmount||0);
            const nextGrp = groupCap > 0 ? Math.min(groupCap, Number(x.groupCollectiveSettledAmt||0) + addedP) : x.groupCollectiveSettledAmt;
            return { ...x, people:{ ...x.people, [pid]:{ ...x.people[pid], settled:nextPRem<=0, settledAmt:nextP, remainingAmt:nextPRem } }, ...(groupCap > 0 ? { groupCollectiveSettledAmt:nextGrp } : {}) };
          });
        });
        if(t._billIds){
          // Use settlementLinks (not shared `remaining`) to avoid React batching race where
          // setTxns updater may mutate `remaining` before setBills updater runs.
          setBills(prev=>prev.map(b=>{
            const link = settlementLinks.find(l=>l.kind==="bill"&&String(l.id)===String(b.id));
            if(!link||!b.splitPeople?.[pid]) return b;
            const paidNow = link.amount;
            if(paidNow<=0) return b;
            const prevSettled = Number(b.splitPeople[pid].settledAmt||0);
            const nextSettled = prevSettled + paidNow;
            const originalAmt = Number(b.splitPeople[pid].amount||0);
            const nextRemaining = Math.max(0, originalAmt-nextSettled);
            const groupCap = Number(b.groupCollectiveAmount||0);
            const nextGroupSettled = groupCap > 0 ? Math.min(groupCap, Number(b.groupCollectiveSettledAmt||0) + paidNow) : b.groupCollectiveSettledAmt;
            const updatedSplit = {...b.splitPeople,[pid]:{...b.splitPeople[pid],settled:nextRemaining<=0,settledAmt:nextSettled,remainingAmt:nextRemaining}};
            // Auto-mark bill as paid when all owed parties have settled
            const allOwedSettled = Object.values(updatedSplit).filter(i=>i.mode==="owes").every(i=>i.settled);
            return { ...b, splitPeople:updatedSplit, ...(groupCap > 0 ? { groupCollectiveSettledAmt:nextGroupSettled } : {}), ...(allOwedSettled ? { status:"paid", paidDate:todayStr() } : {}) };
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
            const addedAmt = nextSettled - prevSettled;
            const groupCap = Number(x.groupCollectiveAmount||0);
            const nextGroupSettled = groupCap > 0 ? Math.min(groupCap, Number(x.groupCollectiveSettledAmt||0) + addedAmt) : x.groupCollectiveSettledAmt;
            return { ...x, people:{ ...x.people, [pid]:{ ...x.people[pid], settled:nextRemaining<=0, settledAmt:nextSettled, remainingAmt:nextRemaining } }, ...(groupCap > 0 ? { groupCollectiveSettledAmt:nextGroupSettled } : {}) };
          })
        ]);
        // Update any bill that mirrors this person's split
        // Covers: (a) bills linked via paidBillId, (b) bills whose splitPeople mirrors the txn split
        setBills(prev=>prev.map(b=>{
          const isPaidBillLink = t.paidBillId && String(b.id)===String(t.paidBillId);
          const isMirroredSplit = !t.paidBillId && b.splitPeople?.[pid] && b.splitPeople[pid].mode==="owes" && !b.splitPeople[pid].settled && remainingShare(b.splitPeople[pid])>0;
          if(!isPaidBillLink && !isMirroredSplit) return b;
          if(!b.splitPeople?.[pid]) return b;
          const origAmt = Number(b.splitPeople[pid].amount||0);
          const prevP = Number(b.splitPeople[pid].settledAmt||0);
          const nextP = Math.min(origAmt, prevP + appliedAmt);
          const nextPRem = Math.max(0, origAmt - nextP);
          const addedP = nextP - prevP;
          const groupCap = Number(b.groupCollectiveAmount||0);
          const nextGrp = groupCap > 0 ? Math.min(groupCap, Number(b.groupCollectiveSettledAmt||0) + addedP) : b.groupCollectiveSettledAmt;
          const updatedSplit = { ...b.splitPeople, [pid]:{ ...b.splitPeople[pid], settled:nextPRem<=0, settledAmt:nextP, remainingAmt:nextPRem } };
          const allOwedSettled = Object.values(updatedSplit).filter(i=>i.mode==="owes").every(i=>i.settled);
          return { ...b, splitPeople:updatedSplit, ...(groupCap > 0 ? { groupCollectiveSettledAmt:nextGrp } : {}), ...(allOwedSettled ? { status:"paid", paidDate:todayStr() } : {}) };
        }));
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
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>💰 Settle Payment</div>
            <button onClick={()=>setSettleTxn(null)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
          <div style={{ color:T.sub,fontSize:12,marginBottom:16 }}>Against: {t.desc} · {sym}{fmt(t.amount)}</div>

          {owedPeople.map(([pid,info])=>{
            const p=getPerson(pid);
            const dueAmt = t._isBillSettle
              ? (t._billIds||[]).reduce((sum,billId)=>{ const bill=bills.find(b=>b.id===billId); return sum+(bill?.splitPeople?.[pid]?remainingShare(bill.splitPeople[pid]):0); },0)
                + (t._txnIds||[]).reduce((sum,txnId)=>{ const txn=txns.find(x=>x.id===txnId); return sum+(txn?.people?.[pid]?remainingShare(txn.people[pid]):0); },0)
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
                <button onClick={()=>{ settle(pid); setTimeout(()=>setSettleTxn(null),50); }} style={{ ...btnP,background:T.success }}>✅ {p.name} paid {sym}{fmt(parseFloat(partials[pid])||0)}</button>
              </div>
            );
          })}

          <div style={{ marginBottom:12 }}>
            <span style={lbl}>Payment mode / received into</span>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {accounts.filter(a=>a.type!=="cc").map(a=><button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <button onClick={()=>setShowSettleSms(v=>!v)} style={{ background:"none",border:"none",color:T.info,fontSize:11,fontWeight:700,cursor:"pointer",padding:"0 0 6px",fontFamily:"Nunito,sans-serif",display:"block" }}>📱 {showSettleSms?"Hide SMS":"Paste bank SMS to auto-fill"}</button>
            {showSettleSms&&(()=>{
              const parseSettleSms = txt => {
                const safe = txt.replace(/not you[?.]?.*/i,"").replace(/call.*\d{10}.*/i,"").replace(/helpline.*/i,"").replace(/block.*/i,"").replace(/\b\d{10,}\b/g,"");
                // Amount
                const amtM = safe.match(/(?:Rs\.?|INR|\u20b9)\s*([\d,]+(?:\.\d{1,2})?)/i);
                if(amtM){ const parsed=parseFloat(amtM[1].replace(/,/g,"")); if(parsed>0) setPartials(Object.fromEntries(owedPeople.map(([pid])=>[pid,String(parsed)]))); }
                // Date
                const parsedDate=extractDateFromText(safe); if(parsedDate) setSettleDate(parsedDate);
                // Ref
                const ref=extractTxnReference(txt); if(ref) setSettleRef(ref);
                // Account — match by last4 or name
                const matches=findSmsAccountMatches(safe,accounts);
                const last4s=extractSmsLast4s(safe);
                const acc=last4s.length?matches.find(m=>String(m.account?.last4||"").trim()&&last4s.includes(String(m.account?.last4||"").trim()))?.account:matches[0]?.account;
                if(acc&&acc.type!=="cc") setAccId(acc.id);
              };
              return <textarea style={{ ...inp,height:64,resize:"none",fontSize:11 }} placeholder="Paste bank SMS here…" value={settleSms} onChange={e=>{ setSettleSms(e.target.value); parseSettleSms(e.target.value); }}/>;
            })()}
            <span style={lbl}>UPI / bank reference (optional)</span>
            <input style={inp} type="text" placeholder="e.g. 123456789012 or UPI ref" value={settleRef} onChange={e=>setSettleRef(e.target.value.toUpperCase())}/>
          </div>
          <div style={{ marginBottom:12 }}>
            <span style={lbl}>Payment date</span>
            <input style={inp} type="date" value={settleDate} onChange={e=>setSettleDate(e.target.value)}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <span style={lbl}>Payment proof (optional)</span>
            <label style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif",display:"inline-block" }}>
              📷 {receiptImg?"Change photo":"Attach screenshot"}
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setReceiptImg(ev.target.result); r.readAsDataURL(f); }}/>
            </label>
            {receiptImg&&<img src={receiptImg} alt="proof" style={{ width:"100%",borderRadius:8,maxHeight:120,objectFit:"cover",marginTop:8 }} onError={e=>e.target.style.display="none"}/>}
          </div>

          {owedPeople.length>1&&<button onClick={settleAll} style={btnP}>✅ Settle All</button>}
        </div>
      </div>
    );
  };

  // ── EDIT MODAL ─────────────────────────────────────────────────────────────
  const EditModal = ({ t, onClose }) => {
    if(!t) return null;
    if(t.type==="investment"){
      const linkedInvestment = investments.find(inv=>String(inv.id)===String(t.linkedInvestmentId||"") || String(inv.linkedTxnId||"")===String(t.id||"")) || {
        id:t.linkedInvestmentId || `txn_${t.id}`,
        type:t.investType || "mf",
        name:t.desc || t.merchant || "Investment",
        folioNo:String(t.investFolio||"").trim(),
        amount:Number(t.amount||0),
        currentValue:Number(t.amount||0),
        freq:t.investFreq || "",
        paymentAccId:t.accId || "",
        lastNav:Number(t.investNav||0),
        lastNavDate:t.date || todayStr(),
        startDate:t.date || todayStr(),
        linkedTxnId:t.id,
        transactionRef:t.transactionRef || null,
      };
      return <AddInvestmentModal item={linkedInvestment} onClose={onClose} />;
    }
    return <AddModal defaultType={t.type||"expense"} editTxn={t} onClose={onClose} />;
  };


  // ── ADD ACCOUNT MODAL ──────────────────────────────────────────────────────
  const AddAccountModal = () => {
    const [aType,setAType]=useState(accountTypeOptions[0]?.id||"bank");
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
    const [linkedUpiAccount,setLinkedUpiAccount]=useState("");
    const [openingBalance,setOpeningBalance]=useState("");
    const [openingBalanceDate,setOpeningBalanceDate]=useState(todayStr());
    const [error,setError]=useState("");
    const [accAttributedTo,setAccAttributedTo]=useState("");
    const [accAttributeType,setAccAttributeType]=useState("person");
    const selectedAccountType = accountTypeOptions.find(item=>item.id===aType) || ACC_TYPES.find(item=>item.id===aType) || ACC_TYPES[0];
    const selectedAccountBaseType = selectedAccountType.baseType || selectedAccountType.id || "bank";
    const selectedAccountBucket = selectedAccountType.bucket || defaultAccountTypeBucket(selectedAccountBaseType);
    const banks=accounts.filter(a=>a.type==="bank");
    const submit=()=>{
      if(!name.trim()){setError("Name required");return;}
      if(selectedAccountBaseType==="debit"&&!linkedBank){setError("Please link a bank account — required for debit cards");return;}
      const base={
        id:genId(),
        type:selectedAccountBaseType,
        accountTypeId:selectedAccountType.id,
        typeLabel:selectedAccountType.label,
        typeIcon:selectedAccountType.icon,
        typeBucket:selectedAccountBucket,
        name:name.trim(),
        color,
        attributedTo:accAttributedTo||null,
        attributeType:accAttributedTo?accAttributeType:null,
      };
      if(selectedAccountBaseType==="bank"||selectedAccountBaseType==="cash") setAccounts(p=>[...p,{...base,last4,openingBalance:parseMoney(openingBalance)||0,openingBalanceDate:openingBalanceDate||todayStr()}]);
      else if(selectedAccountBaseType==="cc") setAccounts(p=>[...p,{...base,last4,limit:parseFloat(limit)||0,outstanding:0,statementDate:parseInt(statementDate)||15,dueDate:parseInt(dueDate)||5,alertPct:Math.max(0,parseFloat(alertPct)||0),billingCycle:billingCycle||`${statementDate}th`}]);
      else if(selectedAccountBaseType==="debit") setAccounts(p=>[...p,{...base,last4,linkedBank}]);
      else if(selectedAccountBaseType==="upi") setAccounts(p=>[...p,{...base,handle,linkedAccount:linkedUpiAccount||""}]);
      else setAccounts(p=>[...p,base]);
      setShowAddAccount(false);
    };
    return (
      <div onClick={e=>e.target===e.currentTarget&&setShowAddAccount(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>Add Account</div>
            <button onClick={()=>setShowAddAccount(false)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {accountTypeOptions.map(at=><button key={at.id} onClick={()=>setAType(at.id)} style={{ background:aType===at.id?color+"22":"none",border:`1px solid ${aType===at.id?color:T.border}`,borderRadius:10,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700,color:aType===at.id?color:T.sub,fontFamily:"Nunito,sans-serif" }}>{at.icon} {at.label}</button>)}
            </div>
            {selectedAccountBucket==="investment"&&<div style={{ color:T.sub,fontSize:10 }}>This account will show under Investments in Wealth. Fund it using `Transfer` from your bank, and record annual PF interest as `Income` into this same account.</div>}
            <input style={inp} placeholder="Name" value={name} onChange={e=>setName(e.target.value)}/>
            {(selectedAccountBaseType==="bank"||selectedAccountBaseType==="cc"||selectedAccountBaseType==="debit")&&<input style={inp} placeholder="Last 4 digits" maxLength={4} value={last4} onChange={e=>setLast4(e.target.value)}/>}
            {(selectedAccountBaseType==="bank"||selectedAccountBaseType==="cash")&&<div style={{ display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:10 }}>
              <input style={inp} type="text" inputMode="decimal" placeholder={selectedAccountBaseType==="cash"?`Cash in hand (${sym})`:`Opening balance (${sym})`} value={openingBalance||""} onChange={e=>setOpeningBalance(cleanMoneyInput(e.target.value))}/>
              <div>
                <span style={lbl}>As on date</span>
                <input style={inp} type="date" value={openingBalanceDate} onChange={e=>setOpeningBalanceDate(e.target.value)}/>
              </div>
            </div>}
            {selectedAccountBaseType==="cc"&&<>
              <input style={inp} type="number" placeholder={`Credit limit (${sym})`} value={limit} onChange={e=>setLimit(e.target.value)}/>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div><span style={lbl}>Statement Date</span><input style={inp} type="number" min="1" max="31" value={statementDate} onChange={e=>setStatementDate(e.target.value)}/></div>
                <div><span style={lbl}>Due Date</span><input style={inp} type="number" min="1" max="31" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
              </div>
              <div><span style={lbl}>Spend alert (% of limit)</span><input style={inp} type="number" min="0" max="100" value={alertPct} onChange={e=>setAlertPct(e.target.value)}/></div>
              <input style={inp} placeholder="Billing cycle e.g. 15th–14th" value={billingCycle} onChange={e=>setBillingCycle(e.target.value)}/>
            </>}
            {selectedAccountBaseType==="debit"&&<div>
              <span style={lbl}>Linked Bank Account *</span>
              {banks.length===0?<div style={{ color:T.danger,fontSize:12 }}>Add a bank account first</div>:
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {banks.map(b=><button key={b.id} onClick={()=>setLinkedBank(b.id)} style={{ background:linkedBank===b.id?b.color+"22":"none",border:`1px solid ${linkedBank===b.id?b.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:linkedBank===b.id?b.color:T.sub,fontFamily:"Nunito,sans-serif" }}>🏦 {b.name}</button>)}
              </div>}
            </div>}
            {selectedAccountBaseType==="upi"&&<>
              <input style={inp} placeholder="UPI handle e.g. you@okicici" value={handle} onChange={e=>setHandle(e.target.value)}/>
              <div>
                <span style={lbl}>Linked Account <span style={{ color:T.sub,fontWeight:400 }}>(optional — bank or card this UPI draws from)</span></span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:4 }}>
                  <button onClick={()=>setLinkedUpiAccount("")} style={{ background:!linkedUpiAccount?T.pill:"none",border:`1px solid ${!linkedUpiAccount?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:!linkedUpiAccount?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>None</button>
                  {[...accounts.filter(a=>a.type==="bank"), ...accounts.filter(a=>a.type==="cc")].map(a=>(
                    <button key={a.id} onClick={()=>setLinkedUpiAccount(a.id)} style={{ background:linkedUpiAccount===a.id?a.color+"22":"none",border:`1px solid ${linkedUpiAccount===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:linkedUpiAccount===a.id?a.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{a.type==="bank"?"🏦":"💳"} {a.name}</button>
                  ))}
                </div>
              </div>
            </>}
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {PALETTE.map(c=><div key={c} onClick={()=>setColor(c)} style={{ width:28,height:28,borderRadius:7,background:c,cursor:"pointer",border:color===c?"3px solid #fff":"3px solid transparent" }}/>)}
            </div>
            {error&&<div style={{ color:T.danger,fontSize:12,fontWeight:700 }}>⚠️ {error}</div>}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={()=>setShowAddAccount(false)} style={btnG}>Cancel</button>
              {/* Account attribution */}
              <div style={{ background:T.input,borderRadius:12,padding:"12px 14px" }}>
                <div style={{ color:T.text,fontSize:12,fontWeight:700,marginBottom:8 }}>Tag to Person or Group (optional)</div>
                <div style={{ color:T.sub,fontSize:10,marginBottom:10 }}>For wealth view — shows this account balance in their profile</div>
                <div style={{ display:"flex",gap:6,marginBottom:8 }}>
                  <button onClick={()=>setAccAttributeType("person")} style={{ flex:1,background:accAttributeType==="person"?T.accent+"22":"none",border:`1px solid ${accAttributeType==="person"?T.accent:T.border}`,borderRadius:10,padding:"6px",cursor:"pointer",fontSize:11,fontWeight:700,color:accAttributeType==="person"?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>👤 Person</button>
                  <button onClick={()=>setAccAttributeType("group")} style={{ flex:1,background:accAttributeType==="group"?T.accent+"22":"none",border:`1px solid ${accAttributeType==="group"?T.accent:T.border}`,borderRadius:10,padding:"6px",cursor:"pointer",fontSize:11,fontWeight:700,color:accAttributeType==="group"?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>👥 Group</button>
                </div>
                <select style={inp} value={accAttributedTo} onChange={e=>setAccAttributedTo(e.target.value)}>
                  <option value="">None (personal account)</option>
                  {accAttributeType==="person" && people.filter(p=>!p.isMe).map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                  {accAttributeType==="group" && groups.map(g=><option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                </select>
              </div>
              <button onClick={submit} style={btnP}>Save Account</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── ADD INVESTMENT MODAL ───────────────────────────────────────────────────
  const AddInvestmentModal = ({ item, onClose = null }) => {
    const isEditing = Boolean(item && !item?._prefillOnly);
    const allowStartDateEdit = Boolean(item?._allowStartDateEdit);
    const closeModal = () => {
      setShowAddInvestment(false);
      setEditingInvestment(null);
      setEditingTxn(null);
      onClose?.();
    };
    const [iType,setIType]=useState(item?.type||"mf");
    const [name,setName]=useState(item?.name||"");
    const [folioNo,setFolioNo]=useState(item?.folioNo||"");
    const [amount,setAmount]=useState(String(item?.amount||""));
    const [freq,setFreq]=useState(item?.freq||"");
    const linkedTxn = item?.linkedTxnId
      ? txns.find(txn=>String(txn.id)===String(item.linkedTxnId)) || txns.find(txn=>String(txn.linkedInvestmentId||"")===String(item.id||"")) || null
      : txns.find(txn=>String(txn.linkedInvestmentId||"")===String(item?.id||"")) || null;
    const [paymentAccId,setPaymentAccId]=useState(item?.paymentAccId || linkedTxn?.accId || accounts.find(a=>a.type!=="cc")?.id || accounts[0]?.id || "");
    const [lastNav,setLastNav]=useState(String(item?.lastNav||linkedTxn?.investNav||""));
    const [showFolioSuggestions,setShowFolioSuggestions]=useState(false);
    const [startDate,setStartDate]=useState(item?.startDate||todayStr());
    const [investmentDate,setInvestmentDate]=useState(item?.lastNavDate||item?.startDate||todayStr());
    const [reminderEnabled,setReminderEnabled]=useState(Boolean(item?.reminder));
    const [reminderDate,setReminderDate]=useState(item?.reminder||todayStr());
    const [transactionRef,setTransactionRef]=useState(item?.transactionRef||linkedTxn?.transactionRef||"");
    const [tagPersonId,setTagPersonId]=useState(item?.forPerson||linkedTxn?.forPerson||"");
    const [tagGroupId,setTagGroupId]=useState(item?.groupId||linkedTxn?.groupId||"");
    const metricConfig = getInvestmentMetricConfig(iType);
    const budgetMeta = getInvestmentBudgetMeta(iType);
    const folioStartLock = useMemo(()=>{
      if(iType!=="mf") return "";
      const folioKey = normalizeVendorText(folioNo);
      if(!folioKey) return "";
      const matchingDates = trackedInvestments
        .filter(inv=>String(inv.type||"mf")==="mf" && normalizeVendorText(inv.folioNo)===folioKey)
        .filter(inv=>!isEditing || String(inv.id)!==String(item?.id||""))
        .map(inv=>inv.startDate)
        .filter(Boolean)
        .sort();
      return matchingDates[0] || "";
    },[iType,folioNo,trackedInvestments,isEditing,item]);
    const investmentSuggestions = useMemo(()=>{
      if(iType!=="mf") return [];
      const query = normalizeVendorText(folioNo || name);
      return investmentTemplateOptions
        .filter(template=>template.type==="mf")
        .filter(template=>{
          if(!query) return true;
          return normalizeVendorText(template.folioNo).includes(query) || normalizeVendorText(template.name).includes(query);
        })
        .slice(0,5);
    },[iType,folioNo,name,investmentTemplateOptions]);
    const applyInvestmentTemplate = useCallback(template=>{
      if(!template) return;
      setIType(template.type || "mf");
      setName(template.name || "Investment");
      setFolioNo(template.folioNo || "");
      if(Number(template.amount||0)>0) setAmount(String(template.amount));
      setFreq(template.freq || "");
      if(template.accId) setPaymentAccId(template.accId);
      if(Number(template.nav||0)>0) setLastNav(String(template.nav));
      if(template.startDate) setStartDate(template.startDate);
      setShowFolioSuggestions(false);
    },[]);
    useEffect(()=>{
      if(allowStartDateEdit) return;
      if(folioStartLock && startDate !== folioStartLock) setStartDate(folioStartLock);
    },[folioStartLock,startDate,allowStartDateEdit]);

    const submit=()=>{
      const amt = parseMoney(amount);
      if(!name.trim()||!amt) return;
      const resolvedTxnId = item?.linkedTxnId || linkedTxn?.id || Date.now();
      const metricValue = metricConfig.show ? Math.max(0, parseMoney(lastNav)||0) : 0;
      const resolvedStartDate = allowStartDateEdit ? (startDate || folioStartLock || todayStr()) : (folioStartLock || startDate || todayStr());
      const nextItem = {
        ...(isEditing ? item : {}),
        id:isEditing ? item?.id : genId(),
        type:iType,
        name:name.trim(),
        folioNo:iType==="mf"?folioNo.trim():"",
        amount:amt,
        currentValue:amt,
        freq:freq||"",
        paymentAccId,
        lastNav:metricValue,
        lastNavDate:investmentDate,
        startDate:resolvedStartDate,
        reminder:reminderEnabled?reminderDate:null,
        linkedTxnId:resolvedTxnId,
        transactionRef:transactionRef.trim()||null,
      };
      const folioKey = normalizeVendorText(folioNo);
      const shouldUpdateWholeFolio = allowStartDateEdit && iType==="mf" && folioKey;
      setInvestments(p=>{
        if(!isEditing) return [nextItem,...p];
        return p.map(inv=>{
          const sameItem = String(inv.id)===String(nextItem.id);
          const sameFolio = shouldUpdateWholeFolio && String(inv.type||"mf")==="mf" && normalizeVendorText(inv.folioNo)===folioKey;
          if(sameItem) return nextItem;
          if(sameFolio) return { ...inv, startDate:resolvedStartDate };
          return inv;
        });
      });
      const nextTxn = {
        ...(linkedTxn||{}),
        id:resolvedTxnId,
        type:"investment",
        desc:name.trim(),
        merchant:name.trim(),
        amount:amt,
        date:investmentDate || startDate || todayStr(),
        accId:paymentAccId,
        investType:iType,
        investFreq:freq||"",
        investFolio:iType==="mf"?folioNo.trim():"",
        investStartDate:resolvedStartDate,
        investNav:metricValue,
        catId:null,
        catIds:[],
        subId:null,
        subIds:[],
        linkedInvestmentId:nextItem.id,
        transactionRef:transactionRef.trim()||null,
        forPerson:tagPersonId||null,
        groupId:tagGroupId||null,
        note:linkedTxn?.note || item?.note || "",
      };
      setTxns(prev=>{
        const exists = prev.some(txn=>String(txn.id)===String(resolvedTxnId));
        return exists
          ? prev.map(txn=>{
              const sameTxn = String(txn.id)===String(resolvedTxnId);
              const sameFolioTxn = shouldUpdateWholeFolio && String(txn.type)==="investment" && normalizeVendorText(txn.investFolio)===folioKey;
              if(sameTxn) return { ...txn, ...nextTxn };
              if(sameFolioTxn) return { ...txn, investStartDate:resolvedStartDate };
              return txn;
            })
          : [nextTxn,...prev];
      });
      closeModal();
    };
    return (
      <div onClick={e=>e.target===e.currentTarget&&closeModal()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{isEditing?"Edit Investment":"Add Investment"}</div>
            <button onClick={closeModal} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <InvestmentTypeChips value={iType} onChange={setIType} />
            <input style={inp} placeholder="Name e.g. Axis Bluechip SIP" value={name} onChange={e=>setName(e.target.value)}/>
            {iType==="mf"&&<>
              <div style={{ position:"relative" }}>
                <input style={inp} placeholder="Type folio to reuse fund defaults" value={folioNo} onChange={e=>{ setFolioNo(e.target.value); setShowFolioSuggestions(true); }} onFocus={()=>setShowFolioSuggestions(true)} onBlur={()=>setTimeout(()=>setShowFolioSuggestions(false),150)}/>
                {showFolioSuggestions && investmentSuggestions.length>0 && (
                  <div style={{ position:"absolute",top:"100%",left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,zIndex:1000,boxShadow:"0 6px 14px rgba(0,0,0,0.18)",maxHeight:180,overflowY:"auto" }}>
                    {investmentSuggestions.map(template=>(
                      <button key={template.key} onMouseDown={e=>e.preventDefault()} onClick={()=>applyInvestmentTemplate(template)} style={{ width:"100%",padding:"9px 10px",background:"none",border:"none",borderBottom:`1px solid ${T.border}`,textAlign:"left",cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>
                        <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{template.label}</div>
                        <div style={{ color:T.sub,fontSize:10 }}>{template.amount?`${sym}${fmt(template.amount)}`:""}{template.freq?` · ${investmentFreqLabel(template.freq)}`:""}{template.accId?` · ${getAcc(template.accId).name}`:""}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ color:T.sub,fontSize:10 }}>If the same fund uses the same folio number, Arth can group those SIPs together and auto-fill its defaults.</div>
            </>}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div>
                <span style={lbl}>Amount ({sym})</span>
                <input style={inp} type="text" inputMode="decimal" placeholder={`e.g. ${sym}5,500`} value={amount||""} onChange={e=>setAmount(cleanMoneyInput(e.target.value))}/>
              </div>
              <div>
                <span style={lbl}>Frequency</span>
                <InvestmentFrequencySelect value={freq} onChange={setFreq} emptyLabel="Select frequency (optional)" />
              </div>
            </div>
            <div>
              {metricConfig.show ? <>
                <span style={lbl}>{metricConfig.label} {iType==="mf"?"(NAV per unit)":iType==="stocks"?"(units held)":iType==="gold"?"(grams)":"(optional)"}</span>
                <input style={inp} type="text" inputMode="decimal" placeholder={metricConfig.placeholder} value={lastNav||""} onChange={e=>setLastNav(cleanMoneyInput(e.target.value))}/>
              </> : <div style={{ color:T.sub,fontSize:10,padding:"4px 0" }}>{metricConfig.hint}</div>}
              {metricConfig.show && metricConfig.hint && <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>{metricConfig.hint}</div>}
            </div>
            <div>
              <span style={lbl}>Payment account</span>
              <AccountChipGroup items={accounts} value={paymentAccId} onChange={setPaymentAccId} />
            </div>
            <div>
              <span style={lbl}>Transaction ID / Ref (optional)</span>
              <input style={inp} type="text" placeholder="e.g. UPI / bank reference" value={transactionRef} onChange={e=>setTransactionRef(e.target.value.toUpperCase())}/>
            </div>
            <div>
              <span style={lbl}>Attribute to (optional)</span>
              <div style={{ marginBottom:6 }}>
                <div style={{ color:T.sub,fontSize:10,marginBottom:4 }}>Person</div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {people.filter(p=>!p.isMe).map(p=>(
                    <button key={p.id} onClick={()=>setTagPersonId(tagPersonId===p.id?"":p.id)} style={{ background:tagPersonId===p.id?p.color+"22":"none",border:`1px solid ${tagPersonId===p.id?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:tagPersonId===p.id?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ color:T.sub,fontSize:10,marginBottom:4 }}>Group</div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {groups.map(g=>(
                    <button key={g.id} onClick={()=>setTagGroupId(tagGroupId===g.id?"":g.id)} style={{ background:tagGroupId===g.id?g.color+"22":"none",border:`1px solid ${tagGroupId===g.id?g.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:tagGroupId===g.id?g.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{g.icon} {g.name}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div>
                <span style={lbl}>Start Date</span>
                <input style={inp} type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} disabled={!allowStartDateEdit && (isEditing || Boolean(folioStartLock))} />
                <div style={{ color:(allowStartDateEdit || folioStartLock)?T.info:T.sub,fontSize:10,marginTop:6 }}>
                  {allowStartDateEdit
                    ? "🗓 Updating this will apply the common start date across the folio."
                    : (isEditing
                      ? "Read-only here — use the folio header to edit the common start date."
                      : (folioStartLock
                        ? `🔒 Common start date locked to ${formatShortDate(folioStartLock) || folioStartLock} for this folio.`
                        : "This becomes the folio's common start date."))}
                </div>
              </div>
              <div><span style={lbl}>Investment Date</span><input style={inp} type="date" value={investmentDate} onChange={e=>setInvestmentDate(e.target.value)}/></div>
            </div>
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

  // ── CONFIRM DELETE CAT / ACCOUNT ──────────────────────────────────────────
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
    const linkedUpiCount = accounts.filter(other=>other.id!==account.id && String(other.linkedAccount||"")===String(account.id)).length;
    const hasCheckpoint = Boolean(balanceCheckpoints[account.id]);
    const handleDelete = () => {
      setAccounts(prev=>prev
        .filter(item=>item.id!==account.id)
        .map(item=>{
          if(String(item.linkedBank||"")===String(account.id)) return { ...item, linkedBank:"" };
          if(String(item.linkedAccount||"")===String(account.id)) return { ...item, linkedAccount:"" };
          return item;
        })
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
            {linkedTxnCount || linkedDebitCount || linkedUpiCount || hasCheckpoint
              ? `Warning: this account is linked to ${linkedTxnCount} transaction${linkedTxnCount===1?"":"s"}${linkedDebitCount?`, ${linkedDebitCount} debit card${linkedDebitCount===1?"":"s"}`:""}${linkedUpiCount?`, ${linkedUpiCount} UPI account${linkedUpiCount===1?"":"s"}`:""}${hasCheckpoint?", and saved balance checks":""}. Linked records will need reassignment later.`
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

  // ── ACCOUNT DETAIL MODAL ───────────────────────────────────────────────────
  const AccDetailModal = () => {
    const a=showAccDetail;
    if(!a) return null;

    const linkedBankAcc = a.type==="debit" ? accounts.find(b=>b.id===a.linkedBank) : null;
    const linkedUpiAcc = a.type==="upi" && a.linkedAccount ? accounts.find(b=>b.id===a.linkedAccount) : null;
    const linkedDebitIds = a.type==="bank"
      ? accounts.filter(x=>(x.type==="debit"&&x.linkedBank===a.id)||(x.type==="upi"&&x.linkedAccount===a.id)).map(x=>x.id)
      : [];
    const cardSummary = a.type==="cc" ? getCardSummary(a) : null;
    const util = a.type==="cc" && a.limit ? Math.round((((cardSummary?.currentCycleSpend)||0)/a.limit)*100) : 0;
    const utilLimit = cardSummary?.alertPct || 30;
    const currentBalance = a.type==="cc"
      ? Number(cardSummary?.totalOutstanding||0)
      : a.type==="debit"
        ? Number(linkedBankAcc ? effectiveAccountBalance(linkedBankAcc.id) : 0)
        : a.type==="upi" && linkedUpiAcc && linkedUpiAcc.type==="bank"
          ? Number(effectiveAccountBalance(linkedUpiAcc.id)||0)
          : Number(a.type==="bank" ? effectiveAccountBalance(a.id) : accountBalance(a.id));
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

      const ccLinkedUpiIds = a.type==="cc" ? accounts.filter(x=>x.type==="upi"&&x.linkedAccount===a.id).map(x=>x.id) : [];
      if(a.type==="cc"){
        if(t.type==="expense" && t.accId===a.id){ signed -= Number(t.amount||0); secondary = t.note || "Card spend"; }
        else if(t.type==="expense" && ccLinkedUpiIds.includes(t.accId)){ signed -= Number(t.amount||0); secondary = `Via ${getAcc(t.accId)?.name||"UPI"}`; }
        else if(t.type==="cc_payment" && t.toAccId===a.id){ signed += Number(t.amount||0); secondary = `Payment from ${getAcc(t.fromAccId)?.name||"account"}`; }
        else if(t.type==="settlement_in" && t.accId===a.id){ signed += Number(t.amount||0); secondary = t.fromPersonId ? `Settlement from ${getPerson(t.fromPersonId)?.name||"contact"}` : (t.isRefund ? "Merchant refund" : "Credit adjustment"); }
        else if(t.type==="settlement_in" && ccLinkedUpiIds.includes(t.accId)){ signed += Number(t.amount||0); secondary = `Refund via ${getAcc(t.accId)?.name||"UPI"}`; }
        else if(t.type==="cc_emi" && t.accId===a.id){ signed -= Number(t.amount||0); secondary = `EMI ${t.installmentNo||""}${t.ccEmiTenure?"/"+t.ccEmiTenure:""} · ${t.merchant||"CC EMI"}`; }
        else return null;
      } else {
        if(t.type==="income" && t.accId===a.id){ signed += Number(t.amount||0); secondary = t.incomeType ? `Income · ${formatIncomeTypeLabel(t.incomeType)}` : "Income"; }
        else if(t.type==="settlement_in" && t.accId===a.id){ signed += Number(t.amount||0); secondary = t.fromPersonId ? `Settlement from ${getPerson(t.fromPersonId)?.name||"contact"}` : (t.isRefund ? "Merchant refund" : "Refund / settlement"); }
        else if(t.type==="transfer" && (t.fromAccId===a.id || (a.type==="bank" && linkedDebitIds.includes(t.fromAccId)))){ signed -= Number(t.amount||0); secondary = `Transfer to ${getAcc(t.toAccId)?.name||"account"}${a.type==="bank" && linkedDebitIds.includes(t.fromAccId)?` via ${getAcc(t.fromAccId)?.name||"debit"}`:""}`; }
        else if(t.type==="transfer" && (t.toAccId===a.id || (a.type==="bank" && linkedDebitIds.includes(t.toAccId)))){ signed += Number(t.amount||0); secondary = `Transfer from ${getAcc(t.fromAccId)?.name||"account"}${a.type==="bank" && linkedDebitIds.includes(t.toAccId)?` via ${getAcc(t.toAccId)?.name||"debit"}`:""}`; }
        else if(t.type==="cc_payment" && (t.fromAccId===a.id || (a.type==="bank" && linkedDebitIds.includes(t.fromAccId)))){ signed -= Number(t.amount||0); secondary = `CC payment to ${getAcc(t.toAccId)?.name||"card"}${a.type==="bank" && linkedDebitIds.includes(t.fromAccId)?` via ${getAcc(t.fromAccId)?.name||"debit"}`:""}`; }
        else if((t.type==="expense"||t.type==="investment") && t.accId===a.id){ signed -= Number(t.amount||0); secondary = t.type==="investment" ? "Investment outflow" : (t.note || "Expense"); }
        else if(a.type==="bank" && linkedDebitIds.includes(t.accId) && (t.type==="expense"||t.type==="investment")){
          signed -= Number(t.amount||0);
          const via = getAcc(t.accId); secondary = `Via ${via?.name||(via?.type==="upi"?"UPI":"debit card")}`;
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
    const accountTxns = ledgerRows.map(row=>row.t);
    const summaryCards = a.type==="cc"
      ? [
          { l:"Limit", v:`${sym}${fmt(a.limit)}`, c:T.text },
          { l:"Due Now", v:`${sym}${fmt(cardSummary?.currentDue||0)}`, c:(cardSummary?.currentDue||0)>0?T.danger:T.success },
          { l:"Unbilled", v:`${sym}${fmt(cardSummary?.currentCycleSpend||0)}`, c:T.warn },
          { l:"Outstanding", v:`${sym}${fmt(cardSummary?.totalOutstanding||0)}`, c:(cardSummary?.totalOutstanding||0)>0?T.danger:T.success },
        ]
      : [
          { l:a.type==="debit"?"Linked Bank":a.type==="upi"&&linkedUpiAcc?"Linked Account":"Live Balance",
            v:a.type==="debit"?(linkedBankAcc?.name||"Not linked"):a.type==="upi"&&linkedUpiAcc?(linkedUpiAcc.name||"Not linked"):`${sym}${fmt(currentBalance)}`,
            c:a.type==="debit"||a.type==="upi"?T.text:currentBalance>=0?T.success:T.danger },
          { l:"Credits", v:`${sym}${fmt(totalCredits)}`, c:T.success },
          { l:"Debits", v:`${sym}${fmt(totalDebits)}`, c:T.danger },
        ];

    return (
      <div onClick={e=>e.target===e.currentTarget&&setShowAccDetail(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"stretch",justifyContent:"center",zIndex:220 }}>
        <div style={{ background:T.card,borderRadius:0,padding:"22px 18px 40px",width:"100%",maxWidth:"100vw",height:"100vh",maxHeight:"100vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
            <div>
              <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{accIcon(a.type)} {a.name}</div>
              <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{accLabel(a.type)}{a.last4?` · ···${a.last4}`:""}</div>
            </div>
            <button onClick={()=>setShowAccDetail(null)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
            {summaryCards.map(s=>(
              <div key={s.l} style={{ background:T.input,borderRadius:10,padding:"10px 12px" }}>
                <div style={{ color:s.c,fontSize:16,fontWeight:800 }}>{s.v}</div>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginTop:2 }}>{s.l}</div>
              </div>
            ))}
          </div>


          {a.type==="cc"&&<>
            <div style={{ color:T.sub,fontSize:11,marginBottom:10 }}>
              {(cardSummary?.totalOutstanding||0)===0 && (cardSummary?.currentCycleSpend||0)===0
                ? `No billed or unbilled spend right now · Alert above ${utilLimit}% of limit`
                : `Cycle ${formatShortDate(cardSummary?.prevStatementDate)} – ${formatShortDate(cardSummary?.lastStatementDate)} · Due ${formatShortDate(cardSummary?.dueOn)} · Alert above ${utilLimit}% of limit`}
            </div>
            <div style={{ height:6,background:T.border,borderRadius:3,marginBottom:10 }}>
              <div style={{ height:"100%",width:`${Math.min(100,util)}%`,background:util>utilLimit?T.danger:T.success,borderRadius:3 }}/>
            </div>
            {util>utilLimit&&<div style={{ background:T.danger+"22",border:`1px solid ${T.danger}44`,borderRadius:10,padding:10,marginBottom:14 }}>⚠️ <span style={{ color:T.danger,fontSize:12,fontWeight:700 }}>Current-cycle spend is above your {utilLimit}% alert limit</span></div>}
          </>}

          {isInvestmentAccount(a) && a.type!=="cc" && (
            <div style={{ background:T.info+"10",border:`1px solid ${T.info}22`,borderRadius:12,padding:"10px 12px",marginBottom:12 }}>
              <div style={{ color:T.text,fontSize:12,fontWeight:800 }}>PF / investment account flow</div>
              <div style={{ color:T.sub,fontSize:10,marginTop:4 }}>Use `Transfer` for new contributions and `Income` for credited interest — similar to the smooth MF flow.</div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginTop:8 }}>
                <button onClick={()=>{
                  const sourceAcc = accounts.find(x=>x.id!==a.id && x.type==="bank") || accounts.find(x=>x.id!==a.id && x.type!=="cc") || null;
                  setShowAccDetail(null);
                  setAddPrefill({
                    fromAccId:sourceAcc?.id || "",
                    toAccId:a.id,
                    who:`${a.name} contribution`,
                  });
                  setDefaultAddType("transfer");
                  setShowAdd(true);
                }} style={{ background:T.info+"18",border:`1px solid ${T.info}33`,color:T.info,borderRadius:10,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>↔ Add contribution</button>
                <button onClick={()=>{
                  setShowAccDetail(null);
                  setAddPrefill({
                    accId:a.id,
                    incomeType:"interest",
                    who:`${a.name} interest`,
                  });
                  setDefaultAddType("income");
                  setShowAdd(true);
                }} style={{ background:T.success+"18",border:`1px solid ${T.success}33`,color:T.success,borderRadius:10,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>💚 Add interest</button>
              </div>
            </div>
          )}

          {a.type==="cc"&&(()=>{
            const cardEmiPlans = ccEmiPlans.filter(p=>p.cardId===a.id);
            if(!cardEmiPlans.length) return null;
            return (
              <div style={{ marginBottom:16 }}>
                <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:8 }}>CC EMI Plans</div>
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {cardEmiPlans.map(plan=>{
                    const installed = txns.filter(t=>t.type==="cc_emi"&&t.ccEmiPlanId===plan.id).length;
                    const pct = plan.tenure>0 ? Math.round((installed/plan.tenure)*100) : 0;
                    const done = installed>=plan.tenure;
                    return (
                      <div key={plan.id} style={{ background:T.input,border:`1px solid ${done?T.success:T.purple}33`,borderRadius:12,padding:"10px 14px" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8 }}>
                          <div>
                            <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{plan.name}</div>
                            <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>
                              {sym}{fmt(plan.monthlyAmount)}/mo · {installed}/{plan.tenure} paid
                              {plan.interestRate?` · ${plan.interestRate}% p.a.`:""}
                              {plan.totalAmount?` · Total: ${sym}${fmt(plan.totalAmount)}`:""}
                            </div>
                          </div>
                          <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4 }}>
                            {done
                              ? <span style={{ background:T.success+"22",color:T.success,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700 }}>✅ Done</span>
                              : <span style={{ background:T.purple+"22",color:T.purple,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700 }}>Active</span>
                            }
                            {!done&&<button onClick={()=>{
                              setCcEmiPlans(prev=>prev.map(p=>p.id===plan.id?{...p,status:"closed"}:p));
                            }} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:10,padding:"3px 8px",cursor:"pointer",fontSize:10,color:T.sub,fontFamily:"Nunito,sans-serif" }}>Close</button>}
                          </div>
                        </div>
                        <div style={{ height:5,background:T.border,borderRadius:3,marginTop:8 }}>
                          <div style={{ height:"100%",width:`${Math.min(100,pct)}%`,background:done?T.success:T.purple,borderRadius:3,transition:"width 0.3s" }}/>
                        </div>
                        {!done&&<div style={{ display:"flex",justifyContent:"flex-end",marginTop:6 }}>
                          <button onClick={()=>{ setShowAccDetail(null); setDefaultAddType("cc_emi"); setShowAdd(true); }} style={{ background:T.purple+"22",border:`1px solid ${T.purple}33`,color:T.purple,borderRadius:10,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>+ Record EMI</button>
                        </div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:10 }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800 }}>Transactions</div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end" }}>
              <button onClick={()=>{ setShowAccDetail(null); setEditingAccount(a); }} style={{ background:T.info+"18",border:`1px solid ${T.info}33`,color:T.info,borderRadius:10,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>✏️ Edit account</button>
              {!(isInvestmentAccount(a) && a.type!=="cc") && <button onClick={()=>{ setShowAccDetail(null); setAddPrefill(a.type==="cc" ? { toAccId:a.id } : { accId:a.id }); setDefaultAddType(a.type==="cc"?"cc_payment":"expense"); setShowAdd(true); }} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,color:T.accent,borderRadius:10,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>+ Add</button>}
            </div>
          </div>

          {accountTxns.length===0 ? (
            <div style={{ ...card,textAlign:"center",padding:20,marginBottom:0 }}>
              <div style={{ color:T.sub,fontSize:12 }}>No transactions yet for this account.</div>
            </div>
          ) : (
            <div style={{ ...card,padding:"8px 12px",marginBottom:0 }}>
              {accountTxns.map((txn,idx)=><TxnRow key={`${a.id}_${txn.id}`} t={txn} last={idx===accountTxns.length-1} onEditTxn={nextTxn=>{ setShowAccDetail(null); setEditingTxn(nextTxn); }}/>) }
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
    const displayFolio = String(group.folioNo || group.items.find(item=>String(item?.folioNo || "").trim())?.folioNo || "").trim();
    const displayTitle = displayFolio ? `Folio ${displayFolio}` : (group.primaryName || group.title || type.name);
    const groupStartDate = group.firstStartDate || group.items
      .map(item=>normalizeToIsoDate(item?.startDate) || item?.startDate || "")
      .filter(Boolean)
      .sort((a,b)=>String(a).localeCompare(String(b)))[0] || "";
    const primaryGroupItem = group.items
      .slice()
      .sort((a,b)=>String(normalizeToIsoDate(a?.startDate) || a?.startDate || "").localeCompare(String(normalizeToIsoDate(b?.startDate) || b?.startDate || "")))[0] || group.items[0] || null;
    const openFolioStartDateEditor = () => {
      if(!primaryGroupItem) return;
      setSelectedInvestmentDetail(null);
      setEditingInvestment({ ...primaryGroupItem, _allowStartDateEdit:true });
      setShowAddInvestment(true);
    };
    return (
      <div onClick={e=>e.target===e.currentTarget&&setSelectedInvestmentDetail(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:220 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"22px 18px 40px",width:"100%",maxWidth:430,maxHeight:"88vh",overflowY:"auto",textAlign:"left" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:16 }}>
            <div style={{ flex:1,minWidth:0,textAlign:"left" }}>
              <div style={{ color:T.text,fontSize:18,fontWeight:900,wordBreak:"break-word" }}>{type.icon} {displayTitle}</div>
              <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{type.name} · {group.items.length} entr{group.items.length===1?"y":"ies"}</div>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",justifyContent:"flex-end" }}>
              {type.id==="mf" && primaryGroupItem && <button onClick={()=>{ setSelectedInvestmentDetail(null); openInvestmentQuickAdd(primaryGroupItem); }} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,color:T.accent,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>+ Add</button>}
              {type.id==="mf" && primaryGroupItem && <button onClick={openFolioStartDateEditor} style={{ background:T.info+"18",border:`1px solid ${T.info}33`,color:T.info,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>Start date</button>}
              <button onClick={()=>setSelectedInvestmentDetail(null)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
            </div>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
            {[
              { l:"Worth", v:`${sym}${fmt(group.total)}`, c:type.color },
              { l:"Start date", v:groupStartDate ? (formatShortDate(groupStartDate) || groupStartDate) : "—", c:T.purple },
              { l:type.id==="mf" ? "Folio" : "Section", v:type.id==="mf" ? (displayFolio || "—") : type.name, c:T.text },
              { l:"Entries", v:String(group.items.length), c:T.success }
            ].map(s=>(
              <div key={s.l} style={{ background:T.input,borderRadius:10,padding:"10px 12px",textAlign:"left" }}>
                <div style={{ color:s.c,fontSize:15,fontWeight:800,wordBreak:"break-word" }}>{s.v}</div>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginTop:2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Recurring schedule */}
          {(()=>{
            const groupKey = group.key || displayTitle;
            const existing = recurringSchedules.find(r=>r.groupKey===groupKey);
            return (
              <div style={{ background:T.input,borderRadius:14,padding:"12px 14px",marginBottom:12 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>🔄 Recurring Schedule</div>
                    {existing?<div style={{ color:T.success,fontSize:11,marginTop:2 }}>Active · {existing.day}th every month · {sym}{fmt(existing.amount)}</div>:<div style={{ color:T.sub,fontSize:11,marginTop:2 }}>Not set</div>}
                  </div>
                  <button onClick={()=>setEditingRecurring(editingRecurring===groupKey?null:groupKey)} style={{ background:T.accent+"22",border:`1px solid ${T.accent}44`,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>{editingRecurring===groupKey?"Cancel":existing?"Edit":"Set up"}</button>
                </div>
                {editingRecurring===groupKey&&(
                  <div style={{ marginTop:10,display:"flex",flexDirection:"column",gap:8 }}>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                      <div><div style={{ color:T.sub,fontSize:10,fontWeight:700,marginBottom:4 }}>DAY OF MONTH</div><input style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 10px",color:T.text,fontSize:14,fontWeight:800,width:"100%",outline:"none",fontFamily:"Nunito,sans-serif" }} type="number" min="1" max="31" placeholder="e.g. 3" defaultValue={existing?.day||""} id={`rec-day-${groupKey}`}/></div>
                      <div><div style={{ color:T.sub,fontSize:10,fontWeight:700,marginBottom:4 }}>AMOUNT ({sym})</div><input style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 10px",color:T.text,fontSize:14,fontWeight:800,width:"100%",outline:"none",fontFamily:"Nunito,sans-serif" }} type="text" inputMode="decimal" placeholder="0" defaultValue={existing?.amount||""} id={`rec-amt-${groupKey}`}/></div>
                    </div>
                    <div><div style={{ color:T.sub,fontSize:10,fontWeight:700,marginBottom:4 }}>DEBIT ACCOUNT</div><select style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 10px",color:T.text,fontSize:13,width:"100%",outline:"none",fontFamily:"Nunito,sans-serif" }} defaultValue={existing?.accId||(accounts.find(a=>a.type!=="cc")?.id||"")} id={`rec-acc-${groupKey}`}>{accounts.filter(a=>a.type!=="cc").map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                    <div style={{ display:"flex",gap:8 }}>
                      <button onClick={()=>{
                        const day = Number(document.getElementById(`rec-day-${groupKey}`)?.value||0);
                        const amount = parseFloat(cleanMoneyInput(document.getElementById(`rec-amt-${groupKey}`)?.value||"0"))||0;
                        const accId = document.getElementById(`rec-acc-${groupKey}`)?.value||"";
                        if(!day||!amount) return;
                        const record = { id:existing?.id||genId(), groupKey, investType:group.type, name:displayTitle, day, amount, accId, active:true, createdAt:existing?.createdAt||Date.now() };
                        setRecurringSchedules(prev=>existing?prev.map(r=>r.groupKey===groupKey?record:r):[...prev,record]);
                        setEditingRecurring(null);
                      }} style={{ flex:1,background:T.accent,border:"none",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:800,color:"#000",fontFamily:"Nunito,sans-serif" }}>Save Schedule</button>
                      {existing&&<button onClick={()=>{ setRecurringSchedules(prev=>prev.filter(r=>r.groupKey!==groupKey)); setEditingRecurring(null); }} style={{ background:"none",border:`1px solid ${T.danger}44`,borderRadius:10,padding:"10px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.danger,fontFamily:"Nunito,sans-serif" }}>Remove</button>}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <div style={{ ...card,marginBottom:0,textAlign:"left" }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:10 }}>{type.id==="mf"?"Entries in this folio":"Holdings in this section"}</div>
            {group.items.map((inv,idx)=>{
              const linkedTxn = getInvestmentTxn(inv);
              const metricText = formatInvestmentMetric(inv.type, linkedTxn?.investNav ?? inv.lastNav);
              return (
                <div key={inv.id} style={{ display:"flex",justifyContent:"space-between",gap:10,padding:"10px 0",borderBottom:idx<group.items.length-1?`1px solid ${T.border}`:"none" }}>
                  <div style={{ minWidth:0,flex:1,textAlign:"left" }}>
                    <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{inv.name}</div>
                    <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>
                      {type.id==="stocks"
                        ? `1 stock entry`
                        : (investmentFreqLabel(inv.freq) || "One-time / no frequency")}
                      {metricText?` · ${metricText}`:""}
                      {inv.startDate?` · ${formatShortDate(inv.startDate) || inv.startDate}`:""}
                      {inv.reminder?` · Reminder ${inv.reminder}`:""}
                    </div>
                    {(inv.transactionRef || linkedTxn?.transactionRef)&&<div style={{ color:T.sub,fontSize:10,marginTop:3 }}>Ref ID: {inv.transactionRef || linkedTxn?.transactionRef}</div>}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:type.color,fontSize:12,fontWeight:800 }}>{sym}{fmt(inv.currentValue ?? inv.amount)}</div>
                    <div style={{ display:"flex",gap:4,justifyContent:"flex-end",marginTop:2,flexWrap:"wrap" }}>
                      <button onClick={()=>openInvestmentEditor(inv)} style={{ background:"none",border:"none",color:T.info,cursor:"pointer",fontSize:10,fontFamily:"Nunito,sans-serif" }}>Edit</button>
                      <button onClick={()=>removeInvestmentEntry(inv)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:10,fontFamily:"Nunito,sans-serif" }}>Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Transaction instalment history */}
          {(()=>{
            const groupKey = group.key || displayTitle;
            const linkedTxns = txns.filter(t=>
              t.type==="investment" &&
              (t.linkedInvestmentId && group.items.some(inv=>String(inv.id)===String(t.linkedInvestmentId)) ||
               t.recurringScheduleId && recurringSchedules.some(r=>r.groupKey===groupKey&&r.id===t.recurringScheduleId))
            ).sort((a,b)=>b.date?.localeCompare(a.date||"")||0);
            if(!linkedTxns.length) return null;
            const totalInvested = linkedTxns.reduce((s,t)=>s+Number(t.amount||0),0);
            return (
              <div style={{ background:T.input,borderRadius:14,padding:"12px 14px",marginTop:12 }}>
                <div style={{ color:T.text,fontSize:13,fontWeight:800,marginBottom:8 }}>📋 Payment History ({linkedTxns.length} instalments)</div>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10,padding:"6px 0",borderBottom:`1px solid ${T.border}` }}>
                  <span style={{ color:T.sub,fontSize:11 }}>Total invested</span>
                  <span style={{ color:T.success,fontSize:13,fontWeight:900 }}>{sym}{fmt(totalInvested)}</span>
                </div>
                {linkedTxns.slice(0,12).map(t=>(
                  <div key={t.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}` }}>
                    <div>
                      <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{formatShortDate(t.date)||t.date}</div>
                      <div style={{ color:T.sub,fontSize:10 }}>{accounts.find(a=>a.id===t.accId)?.name||"Account"}{t.investNav?` · NAV ₹${t.investNav}`:""}</div>
                    </div>
                    <div style={{ color:type.color,fontSize:12,fontWeight:800 }}>{sym}{fmt(t.amount)}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  // ── HOME ───────────────────────────────────────────────────────────────────

  const DEFAULT_CARD_ORDER = ["household","health","stats","categories","cc","bills","recent"];
  const KNOWN_CARD_KEYS = new Set(DEFAULT_CARD_ORDER);
  const [cardOrder, setCardOrder] = useState(()=>{
    const saved = JSON.parse(localStorage.getItem("arth_card_order")||"null");
    const filtered = Array.isArray(saved) ? saved.filter(k=>KNOWN_CARD_KEYS.has(k)) : [];
    // Backfill any card keys added to the app after this user's order was last saved,
    // instead of silently dropping them forever (previous bug: new cards never appeared
    // for existing users/accounts since the filter only removed invalid keys, never added new ones).
    const missing = DEFAULT_CARD_ORDER.filter(k=>!filtered.includes(k));
    const merged = [...filtered, ...missing];
    return merged.length ? merged : DEFAULT_CARD_ORDER;
  });
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
  const [backupStatus, setBackupStatus] = useState("");
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(()=>JSON.parse(localStorage.getItem("arth_auto_backup_enabled") ?? "true"));
  const [autoBackupFrequency, setAutoBackupFrequency] = useState(()=>localStorage.getItem("arth_auto_backup_frequency") || "daily");
  const [autoBackups, setAutoBackups] = useState(()=>JSON.parse(localStorage.getItem("arth_auto_backups") || "[]"));
  const backupFileInputRef = useRef(null);
  const applyingCloudSnapshotRef = useRef(false);
  const cloudSnapshotRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("arth_card_order", JSON.stringify(cardOrder));
  }, [cardOrder]);
  useEffect(() => {
    localStorage.setItem("arth_auto_backup_enabled", JSON.stringify(autoBackupEnabled));
  }, [autoBackupEnabled]);
  useEffect(() => {
    localStorage.setItem("arth_auto_backup_frequency", autoBackupFrequency);
  }, [autoBackupFrequency]);
  useEffect(() => {
    try{
      localStorage.setItem("arth_auto_backups", JSON.stringify((Array.isArray(autoBackups) ? autoBackups : []).slice(0, 3)));
    }catch(err){
      console.warn("Unable to persist auto backups", err);
      if(autoBackupEnabled) setBackupStatus("Auto backups are limited by device storage. Please download a manual backup too.");
    }
  }, [autoBackups, autoBackupEnabled]);

  const cloudSnapshot = useMemo(() => ({
    version: CLOUD_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    dark,
    autoDetectExpenseCategory,
    workTripMode,
    autoBackupEnabled,
    autoBackupFrequency,
    cats,
    accountTypes,
    customBaseBehaviors,
    incomeTypes,
    liabilityTypes:customLiabilityTypes,
    accounts,
    balanceCheckpoints,
    people,
    groups,
    measureUnits,
    itemCatalog,
    txns,
    investments,
    bills,
    billerAccounts,
    memberships,
    feePayments,
    perPersonBudgets,
    gifts,
    liabilities,
    trackedAssets,
    loans,
    annualBudget,
    lastFYTarget,
    monthOverrides,
    cardOrder,
  }), [dark, autoDetectExpenseCategory, workTripMode, autoBackupEnabled, autoBackupFrequency, cats, accountTypes, incomeTypes, customLiabilityTypes, accounts, balanceCheckpoints, people, groups, measureUnits, itemCatalog, txns, investments, bills, billerAccounts, liabilities, trackedAssets, loans, annualBudget, lastFYTarget, monthOverrides, cardOrder]);

  useEffect(() => {
    cloudSnapshotRef.current = cloudSnapshot;
  }, [cloudSnapshot]);

  const applyCloudSnapshot = useCallback((snapshot) => {
    if(!snapshot || typeof snapshot !== "object") return;
    applyingCloudSnapshotRef.current = true;
    setDark(Boolean(snapshot.dark ?? true));
    setAutoDetectExpenseCategory(Boolean(snapshot.autoDetectExpenseCategory ?? true));
    setWorkTripMode(Boolean(snapshot.workTripMode ?? false));
    setAutoBackupEnabled(Boolean(snapshot.autoBackupEnabled ?? true));
    setAutoBackupFrequency(String(snapshot.autoBackupFrequency || "daily"));
    setCats(normalizeCats(snapshot.cats));
    setAccountTypes(normalizeAccountTypes(snapshot.accountTypes, snapshot.customBaseBehaviors||[]));
    if(Array.isArray(snapshot.customBaseBehaviors)) setCustomBaseBehaviors(snapshot.customBaseBehaviors);
    setIncomeTypes(normalizeIncomeTypes(snapshot.incomeTypes));
    setCustomLiabilityTypes(normalizeLiabilityTypes(snapshot.liabilityTypes));
    setAccounts(normalizeAccounts(snapshot.accounts));
    setBalanceCheckpoints(snapshot.balanceCheckpoints && typeof snapshot.balanceCheckpoints === "object" ? snapshot.balanceCheckpoints : {});
    setPeople(normalizePeople(snapshot.people));
    setGroups(Array.isArray(snapshot.groups) ? snapshot.groups : []);
    setMeasureUnits(normalizeMeasureUnits(snapshot.measureUnits));
    setItemCatalog(normalizeItemCatalog(snapshot.itemCatalog));
    setTxns(normalizeTxns(snapshot.txns));
    setInvestments(Array.isArray(snapshot.investments) ? snapshot.investments : []);
    setBills(Array.isArray(snapshot.bills) ? snapshot.bills : []);
    setBillerAccounts(Array.isArray(snapshot.billerAccounts) ? snapshot.billerAccounts : []);
    setMemberships(Array.isArray(snapshot.memberships) ? snapshot.memberships : []);
    setFeePayments(Array.isArray(snapshot.feePayments) ? snapshot.feePayments : []);
    if(snapshot.perPersonBudgets) setPerPersonBudgets(snapshot.perPersonBudgets);
    if(Array.isArray(snapshot.gifts)) setGifts(snapshot.gifts);
    if(Array.isArray(snapshot.gifts)) setGifts(snapshot.gifts);
    setLiabilities(Array.isArray(snapshot.liabilities) ? snapshot.liabilities : []);
    setTrackedAssets(Array.isArray(snapshot.trackedAssets) ? snapshot.trackedAssets : []);
    setLoans(normalizeLoans(snapshot.loans));
    setAnnualBudget(Number(snapshot.annualBudget || 600000));
    setLastFYTarget(Number(snapshot.lastFYTarget || 0));
    setMonthOverrides(snapshot.monthOverrides && typeof snapshot.monthOverrides === "object" ? snapshot.monthOverrides : {});
    if(Array.isArray(snapshot.cardOrder) && snapshot.cardOrder.length) setCardOrder(snapshot.cardOrder);
    window.setTimeout(() => { applyingCloudSnapshotRef.current = false; }, 0);
  }, [setCardOrder]);

  const formatBackupStamp = useCallback((value) => {
    if(!value) return "";
    const parsed = new Date(value);
    if(Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString("en-IN", { dateStyle:"medium", timeStyle:"short" });
  }, []);

  const buildBackupPayload = useCallback((snapshot = cloudSnapshotRef.current || {}, backupType = "manual", exportedAt = new Date().toISOString()) => ({
    app:"Arth",
    backupType,
    exportedAt,
    snapshot:{ ...snapshot, savedAt:snapshot?.savedAt || exportedAt },
  }), []);

  const downloadBackupPayload = useCallback((payload, prefix = "arth-backup") => {
    const exportedAt = payload?.exportedAt || payload?.snapshot?.savedAt || new Date().toISOString();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${prefix}-${String(exportedAt).replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const restoreBackupSnapshot = useCallback((snapshot, label = "selected backup") => {
    const looksValid = snapshot && typeof snapshot === "object" && (
      Array.isArray(snapshot.txns) ||
      Array.isArray(snapshot.accounts) ||
      Array.isArray(snapshot.cats) ||
      Array.isArray(snapshot.people) ||
      Array.isArray(snapshot.investments)
    );
    if(!looksValid) throw new Error("Please choose a valid Arth backup JSON file.");
    const stamp = formatBackupStamp(snapshot?.savedAt || "");
    const summary = `${Array.isArray(snapshot.txns) ? snapshot.txns.length : 0} txns · ${Array.isArray(snapshot.accounts) ? snapshot.accounts.length : 0} accounts`;
    const proceed = window.confirm(`Restore ${label}${stamp ? ` (${stamp})` : ""}? This will replace current data on this device.\n\n${summary}`);
    if(!proceed) return false;
    applyCloudSnapshot(snapshot);
    if(cloudUser?.id && isCloudSyncConfigured) setCloudStatus("Backup restored locally. Syncing your updated data...");
    setBackupStatus(`Backup restored${stamp ? ` · ${stamp}` : ""}`);
    return true;
  }, [applyCloudSnapshot, cloudUser?.id, formatBackupStamp]);

  const downloadBackupFile = useCallback(() => {
    try{
      const exportedAt = new Date().toISOString();
      const payload = buildBackupPayload(cloudSnapshotRef.current || {}, "manual", exportedAt);
      downloadBackupPayload(payload, "arth-backup");
      setBackupStatus(`Backup downloaded · ${formatBackupStamp(exportedAt)}`);
    }catch(err){
      setBackupStatus(`Backup failed: ${err.message}`);
    }
  }, [buildBackupPayload, downloadBackupPayload, formatBackupStamp]);

  const shareBackupToDrive = useCallback(async () => {
    const exportedAt = new Date().toISOString();
    const payload = buildBackupPayload(cloudSnapshotRef.current || {}, "drive-export", exportedAt);
    const fileName = `arth-backup-${exportedAt.replace(/[:.]/g, "-")}.json`;
    const file = new File([JSON.stringify(payload, null, 2)], fileName, { type:"application/json" });
    try{
      if(navigator.share && navigator.canShare?.({ files:[file] })) {
        await navigator.share({
          title:"Arth backup",
          text:"Save this backup to Google Drive.",
          files:[file],
        });
        setBackupStatus("Backup shared. Choose Google Drive in the share sheet to save it.");
        return;
      }
      downloadBackupPayload(payload, "arth-drive-export");
      window.open("https://drive.google.com/drive/my-drive", "_blank", "noopener,noreferrer");
      setBackupStatus("Backup downloaded. Upload it to Google Drive in the tab that just opened.");
    }catch(err){
      if(err?.name === "AbortError"){
        setBackupStatus("Drive export cancelled.");
        return;
      }
      const permissionDenied = /permission denied|notallowed|permission/i.test(String(err?.message || "")) || err?.name === "NotAllowedError";
      if(permissionDenied){
        try{
          downloadBackupPayload(payload, "arth-drive-export");
          window.open("https://drive.google.com/drive/my-drive", "_blank", "noopener,noreferrer");
          setBackupStatus("Direct Drive sharing was blocked on this phone, so the backup was downloaded instead. Upload that file to Google Drive.");
          return;
        }catch(fallbackErr){
          setBackupStatus(`Drive export fallback failed: ${fallbackErr.message}`);
          return;
        }
      }
      setBackupStatus(`Drive export failed: ${err.message}`);
    }
  }, [buildBackupPayload, downloadBackupPayload]);

  const restoreBackupFile = useCallback(async (file) => {
    if(!file) return;
    try{
      const text = await file.text();
      const parsed = JSON.parse(text);
      const snapshot = parsed?.snapshot && typeof parsed.snapshot === "object" ? parsed.snapshot : parsed;
      const backupTime = parsed?.exportedAt || snapshot?.savedAt || (file.lastModified ? new Date(file.lastModified).toISOString() : "");
      const stamp = formatBackupStamp(backupTime);
      restoreBackupSnapshot(snapshot, stamp ? `backup from ${stamp}` : (file.name || "backup file"));
    }catch(err){
      setBackupStatus(`Restore failed: ${err.message}`);
    }finally{
      if(backupFileInputRef.current) backupFileInputRef.current.value = "";
    }
  }, [formatBackupStamp, restoreBackupSnapshot]);

  useEffect(() => {
    if(!autoBackupEnabled) return;
    const snapshot = cloudSnapshotRef.current || cloudSnapshot;
    const intervalMap = { hourly:60*60*1000, daily:24*60*60*1000, weekly:7*24*60*60*1000 };
    const minGap = intervalMap[autoBackupFrequency] || intervalMap.daily;
    const now = Date.now();
    setAutoBackups(prev => {
      const list = Array.isArray(prev) ? prev : [];
      const latestTime = list[0]?.exportedAt ? new Date(list[0].exportedAt).getTime() : 0;
      if(latestTime && (now - latestTime) < minGap) return list;
      const exportedAt = new Date(now).toISOString();
      const nextItem = {
        id:`auto_${now}`,
        backupType:"auto",
        exportedAt,
        snapshot:{ ...snapshot, savedAt:snapshot?.savedAt || exportedAt },
      };
      return [nextItem, ...list].slice(0, 3);
    });
  }, [cloudSnapshot, autoBackupEnabled, autoBackupFrequency]);

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
  }, [cloudUser?.id, cloudHydrated, dark, autoDetectExpenseCategory, cats, accountTypes, incomeTypes, customLiabilityTypes, accounts, balanceCheckpoints, people, groups, measureUnits, itemCatalog, txns, investments, bills, billerAccounts, liabilities, trackedAssets, loans, annualBudget, lastFYTarget, monthOverrides, cardOrder, pushCloudSnapshot]);

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
    const baseMonthly = monthOverrides[viewMonth] || Math.round(annualBudget/12);
    const monthly = (() => {
      if(!budgetCarryForward) return baseMonthly;
      const [y,m] = viewMonth.split("-").map(Number);
      const prevMonth = m===1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,"0")}`;
      const prevBudget = monthOverrides[prevMonth] || Math.round(annualBudget/12);
      const prevSpend = txns.filter(t=>t.type==="expense"&&(t.date||"").startsWith(prevMonth)&&!t.groupId).reduce((s,t)=>s+Number(t.amount||0),0);
      const carry = prevBudget - prevSpend;
      return Math.max(0, baseMonthly + carry);
    })();
    const budgetPct = Math.min(100,Math.round(myActual/Math.max(1,monthly)*100));
    const diff = monthly - myActual;
    const isOver = diff < 0;

    // Financial Health calculations
    const essentialCatIds = cats.filter(c=>c.fixed===true).map(c=>c.id);
    const essentialSpend = thisMonthTxns.filter(t=>t.type==="expense").reduce((s,t)=>{
      const tCats = (t.catIds||[t.catId]).filter(Boolean);
      return tCats.some(cid=>essentialCatIds.includes(String(cid))) ? s+t.amount : s;
    },0);
    const discretionarySpend = myActual - essentialSpend;
    const liquidSavings = liquidAssetsTotal;
    const runwayMonths = essentialSpend > 0 ? Math.floor(liquidSavings / essentialSpend) : 0;
    const runwayColor = runwayMonths >= 6 ? T.success : runwayMonths >= 3 ? T.warn : T.danger;

    const groupSpent = byCat.find(c=>c.id==="family")?.value || 0;
    const householdGroups = groups.filter(g=>g.typeId==="family"||g.defaultIntent==="attributed");
    const householdTotal = householdGroups.reduce((s,g)=>s+thisMonthTxns.filter(t=>t.type==="expense"&&(t.groupId===g.id||t.tagGroup===g.id||t.taggedGroupId===g.id)).reduce((ss,t)=>ss+t.amount,0),0);
    // Amortized bills - spread multi-month fees across billing period
    const amortizedBillsThisMonth = bills.filter(b=>b.billPeriodFrom&&b.billPeriodTo&&b.amount>0).map(b=>{
      const from = new Date(b.billPeriodFrom);
      const to = new Date(b.billPeriodTo);
      const totalMonths = Math.max(1, Math.round((to-from)/(1000*60*60*24*30)));
      const monthlyShare = Math.round(b.amount/totalMonths);
      const currDate = new Date(viewMonth+"-01");
      return (currDate >= from && currDate <= to) ? {...b, amortizedAmount:monthlyShare, totalMonths} : null;
    }).filter(Boolean);
    const leftDays = daysLeft(viewMonth);
    // Recurring investment reminders
    const todayDate = new Date();
    const todayDay = todayDate.getDate();
    const todayStr2 = new Date().toISOString().split("T")[0];
    const dueRecurring = recurringSchedules.filter(r=>r.active!==false && r.day===todayDay && (!r.snoozedUntil || r.snoozedUntil < todayStr2));
    // All investment folios for dashboard recording
    const investmentGroups = Object.values(investments.reduce((acc,inv)=>{
      const key = inv.folioNo||inv.name||inv.id;
      if(!acc[key]) acc[key] = {key,name:inv.name||key,type:inv.type||"mf",amount:inv.amount||0,accId:inv.paymentAccId||"",items:[]};
      acc[key].items.push(inv);
      return acc;
    },{})).sort((a,b)=>{
      // Sort by most recent transaction date desc
      const latestA = txns.filter(t=>t.type==="investment"&&t.investFolio===a.key).sort((x,y)=>(y.date||"").localeCompare(x.date||""))[0]?.date||"";
      const latestB = txns.filter(t=>t.type==="investment"&&t.investFolio===b.key).sort((x,y)=>(y.date||"").localeCompare(x.date||""))[0]?.date||"";
      return latestB.localeCompare(latestA);
    });
    // Check which folios already have a txn this month
    const recordedFoliosThisMonth = new Set(thisMonthTxns.filter(t=>t.type==="investment"&&t.investFolio).map(t=>t.investFolio));
    const thisMonthKey = todayStr().slice(0,7);
    const allFoliosDue = investmentGroups
      .filter(g=>!recordedFoliosThisMonth.has(g.key) && !dueRecurring.some(r=>r.name===g.name) && !skippedInvestmentMonths.includes(`${g.key}_${thisMonthKey}`))
      .sort((a,b)=>a.name.localeCompare(b.name));
    const CARDS = {
      household: (
        <div key="household" style={{ ...card,padding:"16px 14px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ color:T.text,fontSize:15,fontWeight:900 }}>🏠 Household Cost</div>
            <div style={{ color:T.accent,fontSize:13,fontWeight:800 }}>{sym}{fmtK(householdTotal)}</div>
          </div>
          {(()=>{
            const householdGroups = groups.filter(g=>g.typeId==="family"||g.defaultIntent==="attributed");
            if(!householdGroups.length) return <div style={{ color:T.sub,fontSize:11 }}>Tag expenses to a Family group to see household costs</div>;
            return (<>
              {householdGroups.map(g=>{
                const items = thisMonthTxns.filter(t=>t.type==="expense"&&(t.groupId===g.id||t.tagGroup===g.id||t.taggedGroupId===g.id));
                const gSpend = items.reduce((s,t)=>s+t.amount,0);
                if(!items.length) return null;
                return (<div key={g.id} style={{ marginBottom:10 }}>
                  <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,marginBottom:6 }}>{g.icon||"👥"} {g.name.toUpperCase()}</div>
                  {items.map(t=>(
                    <div key={t.id} style={{ display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}` }}>
                      <span style={{ color:T.text,fontSize:12 }}>{t.merchant||t.who||t.desc||"Expense"}</span>
                      <span style={{ color:T.text,fontSize:12,fontWeight:700 }}>{sym}{fmt(t.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display:"flex",justifyContent:"space-between",paddingTop:4 }}>
                    <span style={{ color:T.sub,fontSize:10 }}>Total</span>
                    <span style={{ color:T.accent,fontSize:12,fontWeight:800 }}>{sym}{fmt(gSpend)}</span>
                  </div>
                </div>);
              })}
              {amortizedBillsThisMonth.length>0&&(
                <div style={{ marginTop:8,paddingTop:8,borderTop:`1px solid ${T.border}` }}>
                  <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,marginBottom:6 }}>AMORTIZED FEES</div>
                  {amortizedBillsThisMonth.map(b=>(
                    <div key={b.id} style={{ display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}` }}>
                      <div><span style={{ color:T.text,fontSize:12 }}>{b.name}</span><span style={{ color:T.sub,fontSize:9,marginLeft:6 }}>({b.totalMonths}mo)</span></div>
                      <span style={{ color:T.text,fontSize:12,fontWeight:700 }}>{sym}{fmt(b.amortizedAmount)}/mo</span>
                    </div>
                  ))}
                  <div style={{ display:"flex",justifyContent:"space-between",paddingTop:4 }}>
                    <span style={{ color:T.sub,fontSize:10 }}>Amortized total</span>
                    <span style={{ color:T.accent,fontSize:12,fontWeight:800 }}>{sym}{fmt(amortizedBillsThisMonth.reduce((s,b)=>s+b.amortizedAmount,0))}</span>
                  </div>
                </div>
              )}
            </>);
          })()}
        </div>
      ),
      health: (
        <div key="health" style={{ ...card,padding:"16px 14px",background:`linear-gradient(135deg,${runwayColor}10,${T.card})`,border:`1px solid ${runwayColor}33` }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ color:T.text,fontSize:15,fontWeight:900 }}>💊 Financial Health</div>
            <div style={{ background:runwayColor+"22",border:`1px solid ${runwayColor}44`,borderRadius:20,padding:"3px 10px" }}>
              <span style={{ color:runwayColor,fontSize:11,fontWeight:800 }}>{runwayMonths >= 6 ? "Healthy" : runwayMonths >= 3 ? "Caution" : "At Risk"}</span>
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ color:runwayColor,fontSize:22,fontWeight:900 }}>{runwayMonths}</div>
              <div style={{ color:T.sub,fontSize:9,fontWeight:700,letterSpacing:0.5 }}>MONTHS RUNWAY</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ color:T.danger,fontSize:16,fontWeight:800 }}>{sym}{fmtK(essentialSpend)}</div>
              <div style={{ color:T.sub,fontSize:9,fontWeight:700,letterSpacing:0.5 }}>ESSENTIAL</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ color:T.warn,fontSize:16,fontWeight:800 }}>{sym}{fmtK(discretionarySpend)}</div>
              <div style={{ color:T.sub,fontSize:9,fontWeight:700,letterSpacing:0.5 }}>DISCRETIONARY</div>
            </div>
          </div>
          <div style={{ height:6,background:T.border,borderRadius:3,marginBottom:6 }}>
            <div style={{ height:"100%",width:`${Math.min(100,Math.round(essentialSpend/Math.max(1,myActual)*100))}%`,background:T.danger,borderRadius:3 }}/>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between" }}>
            <span style={{ color:T.sub,fontSize:9 }}>Essential {Math.round(essentialSpend/Math.max(1,myActual)*100)}%</span>
            <span style={{ color:T.sub,fontSize:9 }}>Discretionary {Math.round(discretionarySpend/Math.max(1,myActual)*100)}%</span>
          </div>
          <div style={{ marginTop:10,background:T.input,borderRadius:10,padding:"8px 12px" }}>
            <div style={{ color:T.sub,fontSize:10 }}>Liquid savings: <span style={{ color:T.text,fontWeight:800 }}>{sym}{fmtK(liquidSavings)}</span> ÷ monthly essential <span style={{ color:T.text,fontWeight:800 }}>{sym}{fmtK(essentialSpend)}</span> = <span style={{ color:runwayColor,fontWeight:900 }}>{runwayMonths} months runway</span></div>
          </div>
        </div>
      ),
      stats: (
        <div key="stats" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          {[
            {label:"Income",value:M(`${sym}${fmt(totalIncome)}`),color:T.success,icon:"💚",action:()=>{ setTab("transactions"); setFType("income"); }},
            {label:"Investments",value:`${sym}${fmt(monthlyInvestmentFlow)}`,color:T.info,icon:"💹",action:()=>{ setSelectedInvestmentTypeView("all"); setShowInvestments(true); }},
            {label:"People & Groups",value:"",color:T.info,icon:"👥",action:()=>setTab("people")},
            {label:"Budget",value:`${sym}${fmt(monthly)}`,color:T.warn,icon:"🎯",action:()=>{ setShowSettings(true); setSettingsSection("budget"); }},
            {label:"To Receive",value:`${sym}${fmt(monthTotalOwedToMe + loanGivenTotal)}`,color:T.accent,icon:"🔄",action:()=>setShowReceivablesList(true),sub:(loanGivenTotal>0&&monthTotalOwedToMe>0)?`incl. ${sym}${fmtK(loanGivenTotal)} loans`:loanGivenTotal>0?`${sym}${fmtK(loanGivenTotal)} loans outstanding`:undefined},
            {label:"Net Savings",value:M(`${sym}${fmtK(Math.max(0,totalIncome-myActual-monthlyInvestmentFlow))}`),color:T.success,icon:"💰",action:()=>setTab("home")},
          ].map(s=>(
            <div key={s.label} onClick={s.action} style={{ ...card,marginBottom:0,padding:"12px",cursor:"pointer" }}>
              <div style={{ fontSize:20,marginBottom:4 }}>{s.icon}</div>
              <div style={{ color:s.color,fontSize:16,fontWeight:800 }}>{s.value}</div>
              <div style={{ color:T.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginTop:2 }}>{s.label}</div>
              {s.sub&&<div style={{ color:T.sub,fontSize:9,marginTop:3,whiteSpace:"normal" }}>{s.sub}</div>}
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
          <div style={{ width:36,height:36,borderRadius:10,background:T.danger+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>💳</div>
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
                  ? `Due ${formatShortDate(nextDueCard.dueOn)}`
                  : "No current due"}
            </div>
          </div>
          <div style={{ color:T.sub,fontSize:16 }}>›</div>
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
              <span style={{ color:T.text,fontSize:15,fontWeight:800 }}>📅 Bills Due</span>
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
                    {b.amount>0&&<div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{sym}{fmt(getNetBillAmount(b))}</div>}
                    <button onClick={e=>{ e.stopPropagation();
                      const accId=b.accId||accounts.find(a=>a.type!=="cc")?.id||"";
                      setTxns(p=>[{id:Date.now(),type:"expense",desc:b.name,merchant:b.merchant||"",date:todayStr(),note:"Bill payment",catId:b.catId,catIds:b.catIds||[b.catId],subId:b.subId||null,accId,people:b.splitPeople||{},forPerson:"",groupId:b.groupId||null,groupCollectiveAmount:Number(b.groupCollectiveAmount||0),amount:b.amount||0,isBillPayment:true,billInvoiceNo:b.invoiceNo||null,paidBillId:b.id,paidBillName:b.name,imageBase64:b.imageBase64||null,paymentImageBase64:b.paymentImageBase64||null},...p]);
                      const _pd=todayStr();
                      setBills(p=>p.map(x=>x.id===b.id?{...x,status:"paid",paidDate:_pd,lastPaidAmount:b.amount,lastPaidDate:_pd}:x));
                      if(b.recurring && b.autoGenerate!==false){ const _nd=computeNextDueDate(b,_pd); const _np=computeNextPeriod(b,_pd); setBills(p=>[{...b,id:genId(),status:"unpaid",dueDate:_nd,billDate:null,billPeriodFrom:null,billPeriodTo:null,paidDate:null,paidByTxnId:null,lastPaidAmount:b.amount,lastPaidDate:_pd,isPaused:false,pausedDate:null,resumeDate:null,pausedDays:0,createdDate:todayStr(),createdAt:Date.now(),...(_np||{})},...p]); }
                    }} style={{ background:T.success+"22",border:`1px solid ${T.success}44`,borderRadius:8,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.success,fontFamily:"Nunito,sans-serif" }}>Pay</button>
                  </div>
                </div>
              );
            })}
            <button onClick={()=>setTab("bills")} style={{ background:"none",border:"none",color:T.accent,fontSize:12,fontWeight:800,cursor:"pointer",marginTop:8,width:"100%",textAlign:"right" }}>Manage bills →</button>
          </div>
        );
      })(),

      recent: txns.length>0 ? (
        <div key="recent" style={card}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <span style={{ color:T.text,fontSize:15,fontWeight:800 }}>Recent</span>
            <button onClick={()=>{ setFType("All"); applyTxnDatePreset("current_month", viewMonth); setTxnAmountFrom(""); setTxnAmountTo(""); setTxnCategoryFilter("all"); setTxnPersonFilter("all"); setExpenseSourceFilter("all"); setExpenseCardFilter("all"); setIncomeTypeFilter("all"); setIncomeAccountFilter("all"); setInvestmentTypeFilter("all"); setTab("transactions"); }} style={{ background:"none",border:"none",color:T.accent,fontSize:12,fontWeight:800,cursor:"pointer" }}>See all →</button>
          </div>
          {[...txns]
            .sort((a,b)=>{
              const sortA = getRecordedSortValue(a);
              const sortB = getRecordedSortValue(b);
              if(sortB !== sortA) return sortB - sortA;
              return String(b.id||"").localeCompare(String(a.id||""), undefined, { numeric:true, sensitivity:"base" });
            })
            .slice(0,5)
            .map((t,i,arr)=><TxnRow key={t.id} t={t} last={i===arr.length-1}/>)}
        </div>
      ) : (
        <div key="recent" style={{ ...card,textAlign:"center",padding:40 }}>
          <div style={{ fontSize:48,marginBottom:12 }}>💸</div>
          <div style={{ color:T.text,fontSize:16,fontWeight:800,marginBottom:8 }}>No transactions yet</div>
          <div style={{ color:T.sub,fontSize:13,marginBottom:20 }}>Tap + Add to get started</div>
          <button onClick={()=>setShowAdd(true)} style={btnP}>+ Add First Expense</button>
        </div>
      ),
    };

    return (
      <div>
        {/* Hero — sticky spend+budget+month nav */}
        <div style={{ position:"sticky",top:56,zIndex:40,background:dark?"#0d0a05":"#fffbf0",borderBottom:`1px solid ${T.border}`,padding:"14px 18px 16px" }}>
          {/* Month nav */}
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
            <button onClick={()=>setViewMonth(m=>{ const [y,mo]=m.split("-").map(Number); const d=new Date(y,mo-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })} style={{ background:"none",border:"none",color:T.accent,fontSize:22,cursor:"pointer",padding:0,lineHeight:1 }}>‹</button>
            <div style={{ color:T.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,flex:1,textAlign:"center" }}>{new Date(viewMonth+"-01").toLocaleString("en-IN",{month:"long",year:"numeric"})}</div>
            <button onClick={()=>setViewMonth(m=>{ const [y,mo]=m.split("-").map(Number); const d=new Date(y,mo,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })} style={{ background:"none",border:"none",color:T.accent,fontSize:22,cursor:"pointer",padding:0,lineHeight:1 }}>›</button>
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
            <span style={{ color:isOver?T.danger:T.success,fontSize:12,fontWeight:800 }}>{isOver?"−":"+"}{sym}{fmt(Math.abs(diff))} {isOver?"over":"left"} · {leftDays}d</span>
            {safePerDay!==null&&<span style={{ color:T.success,fontSize:12,fontWeight:800 }}>Safe/day: {sym}{fmt(safePerDay)}</span>}
          </div>
        </div>

        <div style={{ padding:"14px 16px 0" }}>
          {/* Recurring investment reminders */}
          {dueRecurring.length>0&&(
            <div style={{ background:T.info+"16",border:`1px solid ${T.info}33`,borderRadius:14,padding:"12px 14px",marginBottom:12 }}>
              <div style={{ color:T.info,fontSize:13,fontWeight:800,marginBottom:8 }}>💹 {dueRecurring.length} Investment{dueRecurring.length>1?"s":"" } due today</div>
              {dueRecurring.map(r=>(
                <div key={r.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                  <div>
                    <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{r.name}</div>
                    <div style={{ color:T.sub,fontSize:10 }}>{sym}{fmt(r.amount)} · {accounts.find(a=>a.id===r.accId)?.name||"Account"}</div>
                  </div>
                  <div style={{ display:"flex",gap:6 }}>
                    <button onClick={()=>{
                      setAddPrefill({
                        amount: String(r.amount||""),
                        accId: r.accId||"",
                        who: r.name||"",
                        investFolio: r.name||"",
                        investType: r.investType||"mf",
                        date: todayStr(),
                        recurringScheduleId: r.id,
                      });
                      setDefaultAddType("investment");
                      setShowAdd(true);
                    }} style={{ background:T.accent,border:"none",borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:800,color:"#000",fontFamily:"Nunito,sans-serif" }}>Record</button>
                    <button onClick={()=>setRecurringSchedules(prev=>prev.map(x=>x.id===r.id?{...x,snoozedUntil:new Date(Date.now()+24*60*60*1000).toISOString().split("T")[0]}:x))} style={{ background:T.warn+"22",border:`1px solid ${T.warn}44`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.warn,fontFamily:"Nunito,sans-serif" }}>Snooze 1d</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* All investment folios not yet recorded this month */}
          {allFoliosDue.length>0&&(
            <div style={{ background:T.accent+"10",border:`1px solid ${T.accent}22`,borderRadius:14,padding:"12px 14px",marginBottom:12 }}>
              <div style={{ color:T.accent,fontSize:13,fontWeight:800,marginBottom:8 }}>💹 {allFoliosDue.length} investment{allFoliosDue.length>1?"s":""} not recorded this month</div>
              {allFoliosDue.slice(0,5).map(g=>(
                <div key={g.key} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                  <div>
                    <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{g.name}</div>
                    <div style={{ color:T.sub,fontSize:10 }}>{g.type?.toUpperCase()||"INVESTMENT"}{g.amount?` · ${sym}${fmt(g.amount)}`:""}</div>
                  </div>
                  <div style={{ display:"flex",gap:6 }}>
                    <button onClick={()=>{
                      setAddPrefill({ amount:String(g.amount||""), accId:g.accId||"", who:g.name||"", investFolio:g.key||"", investType:g.type||"mf", date:todayStr() });
                      setDefaultAddType("investment"); setShowAdd(true);
                    }} style={{ background:T.accent,border:"none",borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:800,color:"#000",fontFamily:"Nunito,sans-serif" }}>Record</button>
                    <button onClick={()=>{ const key=g.key; setSkippedInvestmentMonths(prev=>prev.includes(`${key}_${thisMonthKey}`)?prev:[...prev,`${key}_${thisMonthKey}`]); }} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>Skip</button>
                  </div>
                </div>
              ))}
              {allFoliosDue.length>5&&<div style={{ color:T.sub,fontSize:10,marginTop:4 }}>+{allFoliosDue.length-5} more</div>}
            </div>
          )}
          {/* Membership expiry alerts */}
          {(()=>{
            const today = new Date().toISOString().split("T")[0];
            const in7 = new Date(Date.now()+7*24*60*60*1000).toISOString().split("T")[0];
            const expiring = memberships.filter(m=>m.validUntil && m.validUntil >= today && m.validUntil <= in7);
            const lapsed = memberships.filter(m=>m.validUntil && m.validUntil < today && (() => { const diffDays = Math.round((new Date()-new Date(m.validUntil))/(1000*60*60*24)); return diffDays <= 3; })());
            if(!expiring.length && !lapsed.length) return null;
            return (<div style={{ marginBottom:12 }}>
              {expiring.map(m=>{ const ba=billerAccounts.find(b=>b.id===m.billerAccountId); return (
                <div key={m.id} style={{ background:T.warn+"16",border:`1px solid ${T.warn}33`,borderRadius:14,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div><div style={{ color:T.warn,fontSize:12,fontWeight:800 }}>⚠️ {ba?.name||"Membership"} expiring</div><div style={{ color:T.sub,fontSize:10 }}>Until {formatShortDate(m.validUntil)||m.validUntil}</div></div>
                  <button onClick={()=>{ setActiveBillerForAction(ba); }} style={{ background:T.warn+"22",border:`1px solid ${T.warn}44`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.warn,fontFamily:"Nunito,sans-serif" }}>Renew</button>
                </div>
              ); })}
              {lapsed.map(m=>{ const ba=billerAccounts.find(b=>b.id===m.billerAccountId); return (
                <div key={m.id} style={{ background:T.danger+"16",border:`1px solid ${T.danger}33`,borderRadius:14,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div><div style={{ color:T.danger,fontSize:12,fontWeight:800 }}>🔴 {ba?.name||"Membership"} lapsed</div><div style={{ color:T.sub,fontSize:10 }}>Expired {formatShortDate(m.validUntil)||m.validUntil}</div></div>
                  <button onClick={()=>{ setActiveBillerForAction(ba); }} style={{ background:T.accent+"22",border:`1px solid ${T.accent}44`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>Renew</button>
                </div>
              ); })}
            </div>);
          })()}
          {/* Edit cards toggle */}
          <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:8 }}>
            <button onClick={()=>setEditingCards(e=>!e)} style={{ background:editingCards?T.accent+"22":"none",border:`1px solid ${editingCards?T.accent:T.border}`,borderRadius:20,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700,color:editingCards?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{editingCards?"✓ Done":"⠿ Arrange"}</button>
          </div>

          {(()=>{ const validCards=cardOrder.filter(id=>CARDS[id]!=null); return validCards.map((cardId, idx) => {
            const cardEl = CARDS[cardId];
            if(!cardEl) return null;
            return (
              <div key={cardId} style={{ position:"relative",marginBottom:12 }}>
                {editingCards&&(
                  <div style={{ position:"absolute",right:-8,top:"50%",transform:"translateY(-50%)",display:"flex",flexDirection:"column",gap:4,zIndex:10 }}>
                    <button onClick={()=>moveCard(idx,-1)} disabled={idx===0} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:8,width:28,height:28,cursor:idx===0?"not-allowed":"pointer",fontSize:14,color:idx===0?T.border:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Nunito,sans-serif" }}>↑</button>
                    <button onClick={()=>moveCard(idx,1)} disabled={idx===validCards.length-1} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:8,width:28,height:28,cursor:idx===validCards.length-1?"not-allowed":"pointer",fontSize:14,color:idx===validCards.length-1?T.border:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Nunito,sans-serif" }}>↓</button>
                  </div>
                )}
                <div style={{ marginRight:editingCards?36:0, transition:"margin 0.2s" }}>
                  {cardEl}
                </div>
              </div>
            );
          }); })()}
        </div>
      </div>
    );
  };

  // ── TRANSACTIONS ───────────────────────────────────────────────────────────
  const Transactions = () => {
    const [showTxnFilters, setShowTxnFilters] = useState(false);
    const [showTxnSort, setShowTxnSort] = useState(false);
    const txnSortOptions = [
      { id:"recorded_desc", label:"Latest", title:"Latest" },
      { id:"date_desc", label:"By date ↓", title:"By date ↓" },
      { id:"date_asc", label:"By date ↑", title:"By date ↑" },
      { id:"amount_desc", label:"High ₹", title:"High ₹" },
      { id:"amount_asc", label:"Low ₹", title:"Low ₹" },
    ];
    const txnSortMeta = txnSortOptions.find(opt=>opt.id===txnSort) || txnSortOptions[0];
    const expenseAccountTypes = ACC_TYPES.filter(opt=>accounts.some(a=>a.type===opt.id));
    const personFilterOptions = people.filter(p=>!p.isMe).filter(p=>txns.some(txn=>txnHasPerson(txn, p.id)));
    const activeFilterCount = [
      fType !== "All",
      txnDateFrom || txnDateTo,
      txnAmountFrom || txnAmountTo,
      txnCategoryFilter !== "all",
      txnPersonFilter !== "all",
      txnGroupFilter !== "all",
      expenseSourceFilter !== "all" || expenseCardFilter !== "all",
      incomeTypeFilter !== "all" || incomeAccountFilter !== "all",
      investmentTypeFilter !== "all",
      txnReimbursableOnly
    ].filter(Boolean).length;
    const hasActiveFilters = activeFilterCount > 0;

    const clearTxnFilters = () => {
      setFType("All");
      setTxnDatePreset("all");
      setTxnDateFrom("");
      setTxnDateTo("");
      setTxnAmountFrom("");
      setTxnAmountTo("");
      setTxnCategoryFilter("all");
      setTxnPersonFilter("all");
      setTxnGroupFilter("all");
      setExpenseSourceFilter("all");
      setExpenseCardFilter("all");
      setIncomeTypeFilter("all");
      setIncomeAccountFilter("all");
      setInvestmentTypeFilter("all");
      setTxnReimbursableOnly(false);
    };

    return (
      <div style={{ padding:"14px 16px 0" }}>
        {/* Search bar */}
        <div style={{ background:T.input,borderRadius:24,padding:"10px 16px",display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
          <span style={{ fontSize:15,color:T.sub }}>🔍</span>
          <input
            style={{ background:"none",border:"none",outline:"none",color:T.text,fontSize:13,fontFamily:"Nunito,sans-serif",flex:1 }}
            placeholder="Search vendor, amount, account..."
            value={txnSearch}
            onChange={e=>setTxnSearch(e.target.value)}
          />
          {txnSearch&&<button onClick={()=>setTxnSearch("")} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:14,fontFamily:"Nunito,sans-serif" }}>✕</button>}
        </div>
        {txnReimbursableOnly&&(
          <div style={{ background:"#f0a50012",border:"1px solid #f0a50044",borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ color:"#f0a500",fontSize:12,fontWeight:700 }}>💼 Showing pending reimbursements only</span>
            <button onClick={()=>setTxnReimbursableOnly(false)} style={{ background:"none",border:"none",color:"#f0a500",cursor:"pointer",fontSize:14,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
        )}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ color:T.text,fontSize:20,fontWeight:900 }}>Transactions</div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ color:T.sub,fontSize:11,fontWeight:700 }}>{filteredTxns.length} shown</div>
            <button
              onClick={()=>setShowTxnSort(true)}
              aria-label="Open transaction sort options"
              title={`Sort transactions: ${txnSortMeta.title}`}
              style={{
                height:38,
                borderRadius:12,
                border:`1px solid ${T.border}`,
                background:T.card,
                color:T.text,
                cursor:"pointer",
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                gap:6,
                padding:"0 10px",
                boxShadow:"none",
                fontFamily:"Nunito,sans-serif"
              }}
            >
              <span style={{ fontSize:14 }}>↕</span>
              <span style={{ fontSize:11,fontWeight:800,whiteSpace:"nowrap" }}>{txnSortMeta.label}</span>
            </button>
            <button
              onClick={()=>setShowTxnFilters(true)}
              aria-label="Open transaction filters"
              title="Filter transactions"
              style={{
                position:"relative",
                width:38,
                height:38,
                borderRadius:12,
                border:`1px solid ${hasActiveFilters?T.accent:T.border}`,
                background:hasActiveFilters?T.accentSoft:T.card,
                color:hasActiveFilters?T.accent:T.sub,
                cursor:"pointer",
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                boxShadow:"none"
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 5H21L14 13V19L10 17V13L3 5Z" fill="currentColor" />
              </svg>
              {hasActiveFilters&&<span style={{ position:"absolute",top:-5,right:-5,minWidth:18,height:18,borderRadius:999,background:T.accent,color:"#000",fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px" }}>{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {showTxnSort&&(
          <div onClick={e=>e.target===e.currentTarget&&setShowTxnSort(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:210 }}>
            <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 28px",width:"100%",maxWidth:430 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <div>
                  <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>Sort Transactions</div>
                  <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>Current: {txnSortMeta.title}</div>
                </div>
                <button onClick={()=>setShowTxnSort(false)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
              </div>

              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {txnSortOptions.map(opt=>(
                  <button
                    key={opt.id}
                    onClick={()=>{ setTxnSort(opt.id); setShowTxnSort(false); }}
                    style={{
                      textAlign:"left",
                      borderRadius:12,
                      padding:"11px 12px",
                      border:`1px solid ${txnSort===opt.id?T.accent:T.border}`,
                      background:txnSort===opt.id?T.accentSoft:T.input,
                      color:T.text,
                      cursor:"pointer",
                      fontFamily:"Nunito,sans-serif"
                    }}
                  >
                    <div style={{ fontSize:13,fontWeight:800,color:txnSort===opt.id?T.accent:T.text }}>{opt.title}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showTxnFilters&&(
          <div onClick={e=>e.target===e.currentTarget&&setShowTxnFilters(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:210 }}>
            <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 28px",width:"100%",maxWidth:430,maxHeight:"92vh",overflowY:"auto" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <div>
                  <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>Filter Transactions</div>
                  <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{filteredTxns.length} result{filteredTxns.length!==1?"s":""}</div>
                </div>
                <button onClick={()=>setShowTxnFilters(false)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
              </div>

              <div style={{ display:"flex",flexWrap:"wrap",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:10 }}>
                {["All","expense","income","investment","transfer","cc_payment","settlement_in"].map(type=>(
                  <Chip key={type} color={type==="All"?T.accent:txnColor(type,T)} active={fType===type} onClick={()=>setFType(type)}>
                    {type==="All" ? "All" : txnLabel(type)}
                  </Chip>
                ))}
              </div>

              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                <div>
                  <span style={lbl}>Quick date filters</span>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    <Chip color={T.accent} active={txnDatePreset==="current_month"} onClick={()=>applyTxnDatePreset("current_month", viewMonth)}>This Month</Chip>
                    <Chip color={T.info} active={txnDatePreset==="last_month"} onClick={()=>applyTxnDatePreset("last_month", viewMonth)}>Last Month</Chip>
                    <Chip color={T.warn} active={txnDatePreset==="custom"} onClick={()=>applyTxnDatePreset("custom", viewMonth)}>Calendar</Chip>
                    <Chip color={T.sub} active={txnDatePreset==="all" && !txnDateFrom && !txnDateTo} onClick={()=>applyTxnDatePreset("all", viewMonth)}>All Time</Chip>
                  </div>
                </div>

                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                  <div>
                    <span style={lbl}>TXN from</span>
                    <input style={inp} type="date" value={txnDateFrom} onChange={e=>{ setTxnDatePreset("custom"); setTxnDateFrom(e.target.value); }}/>
                  </div>
                  <div>
                    <span style={lbl}>TXN to</span>
                    <input style={inp} type="date" value={txnDateTo} onChange={e=>{ setTxnDatePreset("custom"); setTxnDateTo(e.target.value); }}/>
                  </div>
                </div>

                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                  <div>
                    <span style={lbl}>Amount from</span>
                    <input style={inp} type="text" inputMode="decimal" placeholder={`e.g. ${sym}500`} value={txnAmountFrom||""} onChange={e=>setTxnAmountFrom(cleanMoneyInput(e.target.value))}/>
                  </div>
                  <div>
                    <span style={lbl}>Amount to</span>
                    <input style={inp} type="text" inputMode="decimal" placeholder={`e.g. ${sym}10,000`} value={txnAmountTo||""} onChange={e=>setTxnAmountTo(cleanMoneyInput(e.target.value))}/>
                  </div>
                </div>

                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  <div>
                    <span style={lbl}>Category</span>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                      <Chip color={T.accent} active={txnCategoryFilter==="all"} onClick={()=>setTxnCategoryFilter("all")}>
                        All Categories ({expenseBaseTxns.length})
                      </Chip>
                      {cats
                        .filter(cat=>txnCategoryFilter===cat.id || expenseBaseTxns.some(txn=>{
                          const ids = getTxnCategoryIds(txn);
                          return ids.some(id=>String(id)===String(cat.id));
                        }))
                        .map(cat=>{
                          const count = expenseBaseTxns.filter(txn=>{
                            const ids = getTxnCategoryIds(txn);
                            return ids.some(id=>String(id)===String(cat.id));
                          }).length;
                          return (
                            <Chip key={cat.id} color={cat.color} active={txnCategoryFilter===cat.id} onClick={()=>setTxnCategoryFilter(cat.id)}>
                              {cat.icon} {cat.name} ({count})
                            </Chip>
                          );
                        })}
                    </div>
                  </div>
                  <div>
                    <span style={lbl}>Person / contact</span>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                      <Chip color={T.accent} active={txnPersonFilter==="all"} onClick={()=>setTxnPersonFilter("all")}>All People</Chip>
                      {personFilterOptions.map(person=>{
                        const count = txns.filter(txn=>isDateInRange(txn.date, txnDateFrom, txnDateTo) && txnHasPerson(txn, person.id)).length;
                        return (
                          <Chip key={person.id} color={person.color} active={txnPersonFilter===person.id} onClick={()=>setTxnPersonFilter(person.id)}>
                            {person.emoji} {person.name} ({count})
                          </Chip>
                        );
                      })}
                    </div>
                  </div>
                  {groups.length>0&&(
                    <div>
                      <span style={lbl}>Group</span>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                        <Chip color={T.accent} active={txnGroupFilter==="all"} onClick={()=>setTxnGroupFilter("all")}>All Groups</Chip>
                        {groups.map(g=>{
                          const count = txns.filter(txn=>isDateInRange(txn.date,txnDateFrom,txnDateTo)&&(txn.groupId===g.id||(txn.groupAllocations||[]).some(ga=>ga.groupId===g.id))).length;
                          return count>0?(
                            <Chip key={g.id} color={g.color} active={txnGroupFilter===g.id} onClick={()=>setTxnGroupFilter(g.id)}>
                              {g.icon} {g.name} ({count})
                            </Chip>
                          ):null;
                        })}
                      </div>
                    </div>
                  )}
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
                                💳 {cardAcc.name} ({count})
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
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"1fr 1.4fr",gap:10,marginTop:16,paddingTop:12,borderTop:`1px solid ${T.border}` }}>
                <button onClick={clearTxnFilters} style={{ ...btnG,opacity:hasActiveFilters?1:0.65 }}>
                  Clear
                </button>
                <button onClick={()=>setShowTxnFilters(false)} style={btnP}>OK</button>
              </div>
            </div>
          </div>
        )}

        <div style={card}>
          {filteredTxns.length===0?<div style={{ textAlign:"center",padding:40,color:T.sub }}>No transactions match the selected filters</div>
            :filteredTxns.map((t,i)=><TxnRow key={t.id} t={t} last={i===filteredTxns.length-1}/>)}
        </div>
      </div>
    );
  };

  // ── PEOPLE ─────────────────────────────────────────────────────────────────
  const People = () => {
    const [newName,setNewName]=useState("");
    const [newEmoji,setNewEmoji]=useState("👤");
    const [newRelation,setNewRelation]=useState("");
    const [editingGroupName,setEditingGroupName]=useState("");
    const [editingGroupBudget,setEditingGroupBudget]=useState("");
    const [editingGroupMembers,setEditingGroupMembers]=useState([]);
    const [editingGroupIncludeMe,setEditingGroupIncludeMe]=useState(true);
    const [isEditingGroup,setIsEditingGroup]=useState(false);
  const [editingGroupTypeId,setEditingGroupTypeId]=useState("");
    const [newColor,setNewColor]=useState(PALETTE[1]);
    const [newPersonType,setNewPersonType]=useState("contact");
    const [newCreditLimit,setNewCreditLimit]=useState("");
    const [newSpendBudget,setNewSpendBudget]=useState("");
    const [newGroupName,setNewGroupName]=useState("");
    const [newGroupType,setNewGroupType]=useState("");
    const [newGroupTypeId,setNewGroupTypeId]=useState("");
    const [newGroupColor,setNewGroupColor]=useState(PALETTE[5]);
    const [newGroupMembers,setNewGroupMembers]=useState([]);
    const [newGroupIncludeMe,setNewGroupIncludeMe]=useState(true);
    const [newGroupManualLimit,setNewGroupManualLimit]=useState("");
    const [subView,setSubView]=useState("people");
    const [shareMonth,setShareMonth]=useState(()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
    const [showUpiPicker,setShowUpiPicker]=useState(false);
    const [pendingShareBase,setPendingShareBase]=useState("");
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

    const doTxnShare = async (recipientName, amount, contextLabel, upiHandle) => {
      const linkedLabel = upiHandle ? (() => {
        const acc = accounts.find(a=>a.type==="upi"&&a.handle===upiHandle);
        const linked = acc?.linkedAccount ? accounts.find(b=>b.id===acc.linkedAccount) : null;
        return linked ? ` (${linked.name})` : "";
      })() : "";
      const lines = [
        `Hi ${recipientName}, your share towards ${contextLabel} is ${sym}${fmt(amount)}.`,
        upiHandle ? `Payment UPI: ${upiHandle}${linkedLabel}` : "",
        "Kindly clear it when convenient.",
        "– sent via Arth",
      ].filter(Boolean).join("\n");
      try {
        if(navigator.share){ await navigator.share({ text: lines }); }
        else { await navigator.clipboard.writeText(lines); alert("Payment request copied to clipboard!"); }
      } catch(e){
        if(e?.name!=="AbortError") navigator.clipboard?.writeText(lines).catch(()=>{});
      }
    };
    const sharePaymentRequest = (recipientName, amount, contextLabel) => {
      const upiAccs = accounts.filter(a=>a.type==="upi"&&a.handle);
      if(upiAccs.length<=1){ doTxnShare(recipientName, amount, contextLabel, upiAccs[0]?.handle||""); return; }
      setPendingTxnShare({ recipientName, amount, contextLabel });
      setShowTxnUpiPicker(true);
    };

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
      const gicon=gtlow.includes("house")||gtlow.includes("flat")||gtlow.includes("property")?"🏠":gtlow.includes("trip")||gtlow.includes("travel")?"✈️":gtlow.includes("office")||gtlow.includes("work")?"💼":gtlow.includes("family")?"👨‍👩‍👧":gtlow.includes("friend")?"👫":gtlow.includes("society")||gtlow.includes("building")?"🏢":"👥";
      const gtMeta = GROUP_TYPES.find(t=>t.id===newGroupTypeId);
      setGroups(p=>[...p,{ id:genId(), type:gtMeta?.label||newGroupType||"Group", typeId:newGroupTypeId||"other", name:newGroupName.trim(), icon:gtMeta?.icon||gicon, color:newGroupColor, members:newGroupMembers, includeMe:newGroupIncludeMe, manualLimit:parseFloat(newGroupManualLimit)||0, defaultIntent:gtMeta?.default||"split" }]);
      setNewGroupName(""); setNewGroupMembers([]); setNewGroupManualLimit(""); setNewGroupIncludeMe(true); setNewGroupTypeId("");
      setNewGroupName(""); setNewGroupMembers([]); setNewGroupManualLimit(""); setNewGroupIncludeMe(true);
    };

    if(selectedPerson){
      const p=selectedPerson;
      const s=settlements[p.id]||{owesMe:0,iOwe:0};
      const personLoanOutstanding = !p.isMe ? loans.filter(l=>l.direction!=="taken"&&l.personId===p.id&&l.status==="active").reduce((s,l)=>s+Number(l.outstanding||0),0) : 0;
      const totalOwesMe = s.owesMe + personLoanOutstanding;
      const selfTrackedSpend = Number(personSpend["__me__"]||0);
      const overallSpentByMe = myActual;
      const spent=p.isMe ? selfTrackedSpend : (personSpend[p.id]||0);
      const creditLimit=p.creditLimit||0;
      const creditPct=creditLimit>0?Math.min(100,Math.round(s.owesMe/creditLimit*100)):0;
      const spendBudget=p.spendBudget||0;
      const spentPct=spendBudget>0?Math.min(100,Math.round(spent/spendBudget*100)):0;
      const nowYMp=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
      const [pmYr,pmMo]=shareMonth.split("-").map(Number);
      const pmLabel=new Date(pmYr,pmMo-1,1).toLocaleString("en-IN",{month:"short",year:"numeric"});
      const goPrevP=()=>{ const d=new Date(pmYr,pmMo-2,1); setShareMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); };
      const goNextP=()=>{ if(shareMonth>=nowYMp) return; const d=new Date(pmYr,pmMo,1); setShareMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); };
      const personMonthFilter = t => personViewMode==="monthly" ? (t.date||"").startsWith(shareMonth) : true;
      const relTxns=txns
        .filter(t=>t.type==="expense"&&t.people&&t.people[p.id]&&!p.isMe&&personMonthFilter(t))
        .sort((a,b)=>getRecordedSortValue(b)-getRecordedSortValue(a) || new Date(b.date||0)-new Date(a.date||0));
      const taggedTxns=(p.isMe
        ? txns.filter(t=>{
            if(t.type!=="expense") return false;
            const isAllocRemainder = t.trackingMode==="allocate" &&
              (Number(t.amount||0) - (t.allocations||[]).reduce((s,a)=>s+Number(a.amount||0),0)) > 0.005;
            return (t.forPerson===p.id || Boolean(t.people?.__me__) || isAllocRemainder) && personMonthFilter(t);
          })
        : txns.filter(t=>t.type==="expense"&&t.forPerson===p.id&&personMonthFilter(t))
      ).sort((a,b)=>getRecordedSortValue(b)-getRecordedSortValue(a) || new Date(b.date||0)-new Date(a.date||0));
      const settlementTxns=txns.filter(t=>t.type==="settlement_in"&&t.fromPersonId===p.id&&personMonthFilter(t)).sort((a,b)=>getRecordedSortValue(b)-getRecordedSortValue(a) || new Date(b.date||0)-new Date(a.date||0));
      return (
        <div style={{ padding:"14px 16px 0" }}>
          <button onClick={()=>setSelectedPerson(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:13,fontWeight:700,marginBottom:16,fontFamily:"Nunito,sans-serif" }}>← People</button>
          {/* Debt Transfer */}
          {totalOwesMe>0&&(
            <div style={{ background:T.input,borderRadius:12,padding:"10px 14px",marginBottom:12 }}>
              <div style={{ color:T.text,fontSize:12,fontWeight:800,marginBottom:8 }}>🔀 Transfer debt to someone else</div>
              <div style={{ color:T.sub,fontSize:10,marginBottom:8 }}>If {p.name} says another person will pay on their behalf</div>
              <select style={{ ...inp,marginBottom:8 }} onChange={e=>{
                const targetId = e.target.value;
                if(!targetId) return;
                const isGroup = targetId.startsWith("g_");
                const realId = isGroup ? targetId.slice(2) : targetId;
                const targetName = isGroup ? groups.find(g=>g.id===realId)?.name : people.find(x=>String(x.id)===realId)?.name;
                e.target.value="";
                askConfirm(`Transfer ${p.name}'s debt of ${sym}${fmt(totalOwesMe)} to ${targetName}?`, ()=>{
                // Mark all of person's splits as settled
                setTxns(prev=>prev.map(t=>{
                  if(t.type!=="expense") return t;
                  const info = t.people?.[p.id] || t.splitPeople?.[p.id];
                  if(!info||info.settled||info.mode!=="owes") return t;
                  const updated = {...info,settled:true,settledAmt:Number(info.amount||0),remainingAmt:0,transferredTo:realId};
                  if(t.people?.[p.id]) return {...t,people:{...t.people,[p.id]:updated}};
                  return {...t,splitPeople:{...t.splitPeople,[p.id]:updated}};
                }));
                // Add debt to target person
                if(!isGroup){
                  const newTxn = { id:genId(), type:"expense", amount:totalOwesMe, who:`Transferred from ${p.name}`, date:todayStr(), catIds:[], subIds:[], people:{[realId]:{amount:totalOwesMe,mode:"owes",settled:false,remainingAmt:totalOwesMe}}, createdAt:Date.now(), note:`Debt transferred from ${p.name}` };
                  setTxns(prev=>[newTxn,...prev]);
                }
                });
              }}>
                <option value="">Select who will pay instead...</option>
                {people.filter(x=>!x.isMe&&String(x.id)!==String(p.id)).map(x=>(<option key={x.id} value={x.id}>{x.emoji} {x.name}</option>))}
                {groups.map(g=>(<option key={g.id} value={`g_${g.id}`}>{g.icon||"👥"} {g.name} (group)</option>))}
              </select>
            </div>
          )}
          {/* Gift button */}
          <button onClick={()=>{ setGiftForPersonId(p.id); setShowAddGift(true); }} style={{ background:T.accent+"22",border:`1px solid ${T.accent}44`,borderRadius:12,padding:"10px 14px",cursor:"pointer",fontSize:13,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif",marginBottom:12,width:"100%",textAlign:"left" }}>🎁 Record Gift for {p.name}</button>
          {/* Gift history */}
          {(()=>{
            const personGifts = gifts.filter(g=>String(g.personId)===String(p.id)).sort((a,b)=>b.createdAt-a.createdAt);
            if(!personGifts.length) return null;
            const totalGifts = personGifts.reduce((s,g)=>s+Number(g.amount||0),0);
            return (
              <div style={{ ...card,marginBottom:12 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>🎁 Gifts Received</div>
                  <div style={{ color:T.success,fontSize:13,fontWeight:900 }}>{sym}{fmt(totalGifts)} total</div>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {personGifts.slice(0,10).map(g=>(
                    <div key={g.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}` }}>
                      <div>
                        <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{g.fromWhom} · {g.occasion}</div>
                        <div style={{ color:T.sub,fontSize:10 }}>{formatShortDate(g.date)||g.date}{g.note?` · ${g.note}`:""}</div>
                      </div>
                      <div style={{ color:T.accent,fontSize:13,fontWeight:800 }}>{sym}{fmt(g.amount)}</div>
                    </div>
                  ))}
                  {personGifts.length>10&&<div style={{ color:T.sub,fontSize:10,textAlign:"center" }}>+{personGifts.length-10} more</div>}
                </div>
              </div>
            );
          })()}
          {/* Tagged accounts */}
          {(()=>{ const tagged=accounts.filter(a=>String(a.attributedTo)===String(p.id)); if(!tagged.length) return null; return (
            <div style={{ ...card,marginBottom:12 }}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,marginBottom:8 }}>TAGGED ACCOUNTS</div>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {tagged.map(a=>{ const bal=accountBalance(a.id); return (
                  <div key={a.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{a.name}</div>
                    <div style={{ color:T.accent,fontSize:13,fontWeight:800 }}>{sym}{fmt(bal)}</div>
                  </div>
                ); })}
                <div style={{ borderTop:`1px solid ${T.border}`,paddingTop:6,display:"flex",justifyContent:"space-between" }}>
                  <div style={{ color:T.sub,fontSize:11 }}>Total tagged wealth</div>
                  <div style={{ color:T.success,fontSize:13,fontWeight:900 }}>{sym}{fmt(tagged.reduce((s,a)=>s+accountBalance(a.id),0))}</div>
                </div>
              </div>
            </div>
          ); })()}
          {/* Gifts section */}
          {(()=>{
            const personGifts = gifts.filter(g=>String(g.personId)===String(p.id)).sort((a,b)=>b.date?.localeCompare(a.date||"")||0);
            const totalGifts = personGifts.reduce((s,g)=>s+Number(g.amount||0),0);
            const [showGiftFilter, setShowGiftFilter] = [giftFilter, setGiftFilter];
            const filtered = showGiftFilter ? personGifts.filter(g=>g.occasion===showGiftFilter||g.fromWhom===showGiftFilter) : personGifts;
            return (
              <div style={{ ...card,marginBottom:12 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                  <div>
                    <div style={{ color:T.text,fontSize:14,fontWeight:900 }}>🎁 Gifts</div>
                    {totalGifts>0&&<div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{personGifts.length} gift{personGifts.length!==1?"s":""} · {sym}{fmt(totalGifts)} total received</div>}
                  </div>
                  <button onClick={()=>{ setGiftForPersonId(p.id); setShowAddGift(true); }} style={{ background:T.accent+"22",border:`1px solid ${T.accent}33`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>+ Gift</button>
                </div>
                {personGifts.length>0&&(
                  <>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                      {[...new Set(personGifts.map(g=>g.occasion))].map(o=>(
                        <button key={o} onClick={()=>setShowGiftFilter(showGiftFilter===o?null:o)} style={{ background:showGiftFilter===o?T.accent+"22":"none",border:`1px solid ${showGiftFilter===o?T.accent:T.border}`,borderRadius:20,padding:"2px 8px",cursor:"pointer",fontSize:9,fontWeight:700,color:showGiftFilter===o?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{o}</button>
                      ))}
                    </div>
                    {filtered.slice(0,10).map(g=>(
                      <div key={g.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:`1px solid ${T.border}` }}>
                        <div>
                          <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>From {g.fromWhom}</div>
                          <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{g.occasion} · {formatShortDate(g.date)||g.date}</div>
                          {g.note&&<div style={{ color:T.sub,fontSize:10 }}>{g.note}</div>}
                        </div>
                        <div style={{ color:T.success,fontSize:13,fontWeight:800 }}>{sym}{fmt(g.amount)}</div>
                      </div>
                    ))}
                    {personGifts.length>10&&<div style={{ color:T.sub,fontSize:10,textAlign:"center",marginTop:6 }}>+{personGifts.length-10} more</div>}
                  </>
                )}
                {personGifts.length===0&&<div style={{ color:T.sub,fontSize:11,textAlign:"center",padding:"10px 0" }}>No gifts recorded yet</div>}
              </div>
            );
          })()}
          <div style={{ ...card,background:`linear-gradient(135deg,${p.color}14,${T.card})` }}>
            <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:16 }}>
              <div style={{ width:52,height:52,borderRadius:"50%",background:p.color+"30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26 }}>{p.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ color:T.text,fontSize:20,fontWeight:900 }}>{p.name}{p.favorite?<span style={{ color:T.accent,fontSize:15,marginLeft:6 }}>★</span>:""}</div>
                <div style={{ color:T.sub,fontSize:12,marginTop:1 }}>{p.relation} · <span style={{ color:p.personType==="dependant"?T.info:T.accent,fontWeight:700 }}>{p.personType==="dependant"?"Dependant":"Contact"}</span></div>
              </div>
              {!p.isMe&&<button onClick={e=>{ e.stopPropagation(); toggleFavorite(p); }} style={{ background:p.favorite?T.accentSoft:"none",border:`1px solid ${p.favorite?T.accent:T.border}`,borderRadius:10,padding:"7px 10px",cursor:"pointer",fontSize:13,fontWeight:800,color:p.favorite?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.favorite?"★ Fav":"☆ Fav"}</button>}
            </div>

            {!p.isMe&&(
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
                <div onClick={()=>{ if(totalOwesMe>0) setExpandedSection(expandedSection==="unsettled_"+p.id?null:"unsettled_"+p.id); }} style={{ background:T.input,borderRadius:10,padding:"10px 12px",textAlign:"center",cursor:totalOwesMe>0?"pointer":"default" }}>
                  <div style={{ color:T.success,fontSize:18,fontWeight:800 }}>{sym}{fmt(totalOwesMe)}</div>
                  <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Owes You{personLoanOutstanding>0?` (incl. loan)`:""}{totalOwesMe>0?" ▾":""}</div>
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
            {/* Unsettled txn drill-down */}
            {expandedSection==="unsettled_"+p.id&&(()=>{
              const unsettled = txns.filter(t=>{
                if(t.type!=="expense") return false;
                const info = t.people?.[p.id] || t.splitPeople?.[p.id];
                return info?.mode==="owes" && !info?.settled && remainingShare(info)>0;
              }).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
              if(!unsettled.length) return null;
              return (
                <div style={{ background:T.input,borderRadius:12,padding:"12px 14px",marginBottom:12 }}>
                  <div style={{ color:T.text,fontSize:12,fontWeight:800,marginBottom:8 }}>Unsettled transactions ({unsettled.length})</div>
                  {unsettled.map(t=>{
                    const info = t.people?.[p.id] || t.splitPeople?.[p.id];
                    const remaining = remainingShare(info);
                    return (
                      <div key={t.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:`1px solid ${T.border}` }}>
                        <div style={{ flex:1 }}>
                          <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{t.merchant||t.who||t.desc||"Expense"}</div>
                          <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{formatShortDate(t.date)||t.date}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ color:T.success,fontSize:13,fontWeight:800 }}>{sym}{fmt(remaining)}</div>
                          <button onClick={()=>{
                            setTxns(prev=>prev.map(x=>{
                              if(x.id!==t.id) return x;
                              const info2 = x.people?.[p.id] || x.splitPeople?.[p.id];
                              if(!info2) return x;
                              const settled = {...info2,settled:true,settledAmt:Number(info2.amount||0),remainingAmt:0};
                              if(x.people?.[p.id]) return {...x,people:{...x.people,[p.id]:settled}};
                              return {...x,splitPeople:{...x.splitPeople,[p.id]:settled}};
                            }));
                          }} style={{ background:T.success+"22",border:`1px solid ${T.success}44`,borderRadius:20,padding:"2px 8px",cursor:"pointer",fontSize:9,fontWeight:700,color:T.success,fontFamily:"Nunito,sans-serif",marginTop:2 }}>✓ Settle</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

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
              const pendingTxns=txns.filter(x=>{
                if(x.type!=="expense") return false;
                const info = x.people?.[p.id] || x.splitPeople?.[p.id];
                return info?.mode==="owes" && !info?.settled && remainingShare(info)>0;
              });
              const pendingBills=bills.filter(x=>x.status==="unpaid"&&x.splitPeople?.[p.id]?.mode==="owes"&&remainingShare(x.splitPeople[p.id])>0);
              if(!pendingTxns.length&&!pendingBills.length){
                // No specific txns found but balance shows — force clear
                setTxns(prev=>prev.map(t=>{
                  if(t.type!=="expense") return t;
                  const info = t.people?.[p.id] || t.splitPeople?.[p.id];
                  if(!info||info.settled||info.mode!=="owes") return t;
                  const settled = {...info,settled:true,settledAmt:Number(info.amount||0),remainingAmt:0};
                  if(t.people?.[p.id]) return {...t,people:{...t.people,[p.id]:settled}};
                  return {...t,splitPeople:{...t.splitPeople,[p.id]:settled}};
                }));
                return;
              }
              if(pendingTxns.length===1&&!pendingBills.length){
                // Simple single expense txn case
                setSettleTxn(pendingTxns[0]);
                return;
              }
              // Mixed or multiple items — build one comprehensive synthetic txn
              const txnTotal=pendingTxns.reduce((s,x)=>s+remainingShare(x.people[p.id]),0);
              const billTotal=pendingBills.reduce((s,b)=>s+remainingShare(b.splitPeople[p.id]),0);
              const totalAmt=txnTotal+billTotal;
              const itemCount=pendingTxns.length+pendingBills.length;
              const desc=itemCount===1?(pendingBills[0]?.name||pendingTxns[0]?.desc||"Expense"):`${itemCount} pending items`;
              setSettleTxn({
                id:"mixed_settle_"+p.id,
                type:"expense",
                desc,
                amount:totalAmt,
                people:{ [p.id]:{ amount:totalAmt, mode:"owes", settled:false } },
                _billIds:pendingBills.map(b=>b.id),
                _txnIds:pendingTxns.map(x=>x.id),
                _isBillSettle:true,
                groupId:pendingTxns[0]?.groupId||pendingBills[0]?.groupId||null,
              });
            }} style={{ ...btnP,marginBottom:10 }}>💰 Settle with {p.name}</button>}
            {!p.isMe&&s.owesMe>0&&<button onClick={()=>sharePaymentRequest(p.name,s.owesMe,"pending expenses")} style={{ ...btnP,marginBottom:10,background:T.accentSoft,border:`1px solid ${T.accent}55`,color:T.accent }}>📤 Request ₹{fmt(s.owesMe)} from {p.name}</button>}
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={()=>setEditingPerson(p)} style={{ ...btnP,background:T.accentSoft,border:`1px solid ${T.accent}33`,color:T.accent,flex:1 }}>{p.isMe?"🎯 Edit My Budget":"✏️ Edit Profile"}</button>
              {!p.isMe&&<button onClick={()=>{ setPeople(prev=>prev.filter(x=>x.id!==p.id)); setSelectedPerson(null); }} style={{ ...btnP,background:"transparent",border:`1px solid ${T.danger}`,color:T.danger,flex:1 }}>🗑️ Remove</button>}
            </div>
            {p.isMe&&<div style={{ color:T.sub,fontSize:11,textAlign:"center",padding:"8px 0" }}>This is you — you can edit your monthly self budget here</div>}
          </div>

          {(()=>{
            const personBills=[...bills]
              .filter(b=>{
                if(!b.splitPeople?.[p.id]||b.splitPeople[p.id].mode!=="owes") return false;
                // If this bill has a linked expense that tracks the person, don't show here —
                // it will appear in Shared Expenses instead (expense is source of truth).
                const linkedTxn = b.paidByTxnId ? txns.find(t=>t.id===b.paidByTxnId) : null;
                if(linkedTxn?.people?.[p.id]) return false;
                return true;
              })
              .sort((a,b)=>(toDateOnly(a.dueDate)?.getTime()||0) - (toDateOnly(b.dueDate)?.getTime()||0) || (toDateOnly(b.billDate || b.createdDate)?.getTime()||0) - (toDateOnly(a.billDate || a.createdDate)?.getTime()||0));
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
                      {(()=>{ const info=b.splitPeople[p.id]; const owed=Number(info.amount||0); const left=remainingShare(info); const paid=Number(info.settledAmt||0); const color=left<=0?T.success:paid>0?T.warn:T.accent; const label=info.mode!=="owes"?"on you":left<=0?"Settled":paid>0?`Partly settled ${sym}${fmt(paid)} · Bal. ${sym}${fmt(left)}`:"owes you"; return <><div style={{ color,fontSize:13,fontWeight:700 }}>{sym}{fmt(owed)}</div><div style={{ color,fontSize:10 }}>{label}</div></>; })()}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={{ display:"flex",gap:4,marginBottom:8,background:T.input,borderRadius:10,padding:"4px 6px" }}>
            {[["overall","📊 Overall"],["monthly","📅 Monthly"]].map(([mode,label])=>(
              <button key={mode} onClick={()=>setPersonViewMode(mode)} style={{ flex:1,background:personViewMode===mode?T.accent:"none",border:"none",borderRadius:7,padding:"5px",cursor:"pointer",fontSize:11,fontWeight:700,color:personViewMode===mode?"#000":T.sub,fontFamily:"Nunito,sans-serif" }}>{label}</button>
            ))}
          </div>
          {personViewMode==="monthly"&&(
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,background:T.input,borderRadius:10,padding:"6px 10px" }}>
              <button onClick={goPrevP} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:18,padding:"0 6px",fontFamily:"Nunito,sans-serif" }}>‹</button>
              <span style={{ color:T.text,fontSize:13,fontWeight:700 }}>{pmLabel}</span>
              <button onClick={goNextP} style={{ background:"none",border:"none",color:shareMonth>=nowYMp?T.border:T.sub,cursor:shareMonth>=nowYMp?"default":"pointer",fontSize:18,padding:"0 6px",fontFamily:"Nunito,sans-serif" }}>›</button>
            </div>
          )}
          {(relTxns.length>0||taggedTxns.length>0||settlementTxns.length>0)&&(
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:10 }}>Transactions</div>
          )}
          {relTxns.length>0&&(
            <div style={card}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10 }}>Shared expenses</div>
              {relTxns.map((t,idx,arr)=>{ const info=t.people[p.id]; return (
                <div key={t.id} onClick={()=>{ setTab("transactions"); setTimeout(()=>setExpandedTxn(t.id),80); }} style={{ display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:idx<arr.length-1?`1px solid ${T.border}`:"none",cursor:"pointer" }}>
                  <div>
                    <div style={{ color:T.text,fontSize:13,fontWeight:600 }}>{t.desc}</div>
                    <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{formatShortDate(t.date) || t.date} · tap to open</div>
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
                const allocRemainderAmt = t.trackingMode==="allocate" ? Math.max(0, Number(t.amount||0) - (t.allocations||[]).reduce((s,a)=>s+Number(a.amount||0),0)) : 0;
                const displayAmt = p.isMe ? (t.forPerson===p.id ? Number(t.amount||0) : (explicitMeAmt>0 ? explicitMeAmt : allocRemainderAmt)) : Number(t.amount||0);
                return (
                  <div key={t.id} onClick={()=>{ setTab("transactions"); setTimeout(()=>setExpandedTxn(t.id),80); }} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:idx<arr.length-1?`1px solid ${T.border}`:"none",cursor:"pointer" }}>
                    <div>
                      <div style={{ color:T.text,fontSize:13,fontWeight:600 }}>{t.desc}</div>
                      <div style={{ color:T.sub,fontSize:10 }}>{formatShortDate(t.date) || t.date} · tap to open</div>
                    </div>
                    <div style={{ color:p.color,fontSize:13,fontWeight:700 }}>{sym}{fmt(displayAmt)}</div>
                  </div>
                );
              })}
            </div>
          )}
          {(()=>{
            const personLoans = loans.filter(l=>l.direction!=="taken"&&l.personId===p.id&&l.status==="active"&&Number(l.outstanding||0)>0);
            if(!personLoans.length||p.isMe) return null;
            return (
              <div style={card}>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10 }}>Loans Given</div>
                {personLoans.map((loan,idx,arr)=>(
                  <div key={loan.id} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:idx<arr.length-1?`1px solid ${T.border}`:"none" }}>
                    <div>
                      <div style={{ color:T.text,fontSize:13,fontWeight:600 }}>{loan.name||"Loan"}</div>
                      <div style={{ color:T.sub,fontSize:10 }}>{formatShortDate(loan.startDate)||loan.startDate}{loan.dueDate?` · due ${formatShortDate(loan.dueDate)||loan.dueDate}`:""}{loan.hasInterest?` · ${loan.interestRate}% p.a.`:""}</div>
                    </div>
                    <div style={{ color:T.success,fontSize:13,fontWeight:700 }}>{sym}{fmt(Number(loan.outstanding||0))}</div>
                  </div>
                ))}
                {personLoans.length>1&&(
                  <div style={{ display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:`1px solid ${T.border}`,marginTop:4 }}>
                    <div style={{ color:T.sub,fontSize:11,fontWeight:700 }}>Total outstanding</div>
                    <div style={{ color:T.success,fontSize:13,fontWeight:800 }}>{sym}{fmt(personLoans.reduce((s,l)=>s+Number(l.outstanding||0),0))}</div>
                  </div>
                )}
              </div>
            );
          })()}
          {settlementTxns.length>0&&(
            <div style={card}>
              <div style={{ color:T.success,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10 }}>Settlements received</div>
              {settlementTxns.map((st,idx,arr)=>(
                <div key={st.id} onClick={()=>{ setTab("transactions"); setTimeout(()=>setExpandedTxn(st.id),80); }} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:idx<arr.length-1?`1px solid ${T.border}`:"none",cursor:"pointer" }}>
                  <div>
                    <div style={{ color:T.text,fontSize:13,fontWeight:600 }}>{st.desc||`Settlement from ${p.name}`}</div>
                    <div style={{ color:T.sub,fontSize:10 }}>{formatShortDate(st.date) || st.date} · tap to open</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:T.success,fontSize:13,fontWeight:700 }}>+{sym}{fmt(st.amount)}</div>
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
      // gTxns: include transactions directly tagged to this group OR
      // where this group appears in Txn breakup allocations (any mode)
      const gTxns=txns.filter(t=>
        t.groupId===g.id ||
        t.groupAllocations?.some(ga=>ga.groupId===g.id&&Number(ga.amount||0)>0)
      );
      const gBills=bills.filter(b=>b.groupId===g.id&&b.status==="unpaid");
      const total=groupReceivableTotal(g.id);
      const currentMembers=isEditingGroup ? editingGroupMembers : (g.members||[]);
      const groupIncludeMe = isEditingGroup ? editingGroupIncludeMe : (g.includeMe !== false);
      const displayedMemberCount = currentMembers.length + (groupIncludeMe ? 1 : 0);
      const nonMembers=people.filter(p=>!p.isMe&&!currentMembers.includes(p.id));

      // ── month navigation ──
      const nowYM=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
      const [smYr,smMo]=shareMonth.split("-").map(Number);
      const smLabel=new Date(smYr,smMo-1,1).toLocaleString("en-IN",{month:"short",year:"numeric"});
      const goPrev=()=>{ const d=new Date(smYr,smMo-2,1); setShareMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); };
      const goNext=()=>{ if(shareMonth>=nowYM) return; const d=new Date(smYr,smMo,1); setShareMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); };
      const mTxns=gTxns.filter(t=>(t.date||"").startsWith(shareMonth));

      // For multi-group Txn breakup: get this group's allocated portion of a txn
      // MUST be declared before first use below
      const getGroupTxnAmt = (t, groupId) => {
        const alloc = t.groupAllocations?.find(ga=>ga.groupId===groupId);
        if(alloc) return Number(alloc.amount||0);
        return Number(t.amount||0); // primary groupId case
      };

      // month-filtered stats
      const groupTotalSpend = mTxns.filter(t=>t.type==="expense").reduce((sum,t)=>sum+getGroupTxnAmt(t,g.id),0) + gBills.reduce((sum,b)=>sum+Number(b.amount||0),0);
      const groupBudget = Number(g.manualLimit||0);
      const groupOver = groupBudget>0 && groupTotalSpend>groupBudget;
      const groupPaidByMe = mTxns.filter(t=>t.type==="expense").reduce((sum,t)=>sum+getGroupTxnAmt(t,g.id),0);
      const groupMySpend = mTxns.reduce((sum,t)=>{
        if(t.type!=="expense") return sum;
        const txnAmt = getGroupTxnAmt(t, g.id);
        // Only subtract owes/collective from person splits if this is the primary group
        if(t.groupAllocations?.find(ga=>ga.groupId===g.id)) {
          // Multi-group alloc: the allocated amount IS the group's share — no further deduction
          return sum + txnAmt;
        }
        const otherOwed = Object.entries(t.people||{}).filter(([pid])=>pid!=="__me__").reduce((s,[,info])=>s+(Number(info.amount||0)),0);
        return sum + Math.max(0, txnAmt - otherOwed - getGroupCollectiveDue(t));
      },0);

      // Financial Year stats (for "overall" mode — April to March)
      const fyStart = `${currentFYStartYear}-04-01`;
      const fyEnd   = `${currentFYStartYear + 1}-03-31`;
      const fyTxns  = gTxns.filter(t=>(t.date||"")>=fyStart&&(t.date||"")<=fyEnd);
      const overallPaidByMe = fyTxns.filter(t=>t.type==="expense").reduce((sum,t)=>sum+getGroupTxnAmt(t,g.id),0);
      const overallMySpend = fyTxns.reduce((sum,t)=>{
        if(t.type!=="expense") return sum;
        const txnAmt = getGroupTxnAmt(t, g.id);
        if(t.groupAllocations?.find(ga=>ga.groupId===g.id)) return sum + txnAmt;
        const otherOwed=Object.entries(t.people||{}).filter(([pid])=>pid!=="__me__").reduce((s,[,info])=>s+Number(info.amount||0),0);
        return sum+Math.max(0,txnAmt-otherOwed-getGroupCollectiveDue(t));
      },0);
      const overallTotalSpend = overallPaidByMe + gBills.filter(b=>(b.dueDate||b.billDate||"")>=fyStart&&(b.dueDate||b.billDate||"")<=fyEnd).reduce((sum,b)=>sum+Number(b.amount||0),0);
      const displayPaidByMe = groupViewMode==="overall" ? overallPaidByMe : groupPaidByMe;
      const displayMySpend  = groupViewMode==="overall" ? overallMySpend  : groupMySpend;
      // owe/owes-me are all-time outstanding balances, not month-filtered
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
        setEditingGroupTypeId(g.typeId||"other");
        setIsEditingGroup(true);
      };

      const cancelEditingGroup = () => {
        setEditingGroupName(g.name||"");
        setEditingGroupBudget(String(g.manualLimit||""));
        setEditingGroupMembers([...(g.members||[])]);
        setEditingGroupIncludeMe(g.includeMe !== false);
        setEditingGroupTypeId(g.typeId||"other");
        setIsEditingGroup(false);
      };

      const saveGroupEdits = () => {
        const name = editingGroupName.trim();
        if(!name) return;
        const gtMeta = GROUP_TYPES.find(t=>t.id===editingGroupTypeId);
        const updated = {
          ...g,
          name,
          manualLimit:parseMoney(editingGroupBudget),
          members:editingGroupMembers,
          includeMe:editingGroupIncludeMe,
          typeId:editingGroupTypeId||g.typeId||"other",
          type:gtMeta?.label||g.type,
          icon:gtMeta?.icon||g.icon,
          defaultIntent:gtMeta?.default||g.defaultIntent||"split",
        };
        setGroups(prev=>prev.map(x=>x.id===g.id?updated:x));
        setSelectedGroup(updated);
        setIsEditingGroup(false);
      };

      return (
        <div style={{ padding:"14px 16px 0" }}>
          <button onClick={()=>setSelectedGroup(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:13,fontWeight:700,marginBottom:16,fontFamily:"Nunito,sans-serif" }}>← Groups</button>
          {/* Group tagged accounts */}
          {(()=>{ const tagged=accounts.filter(a=>String(a.attributedTo)===String(g.id)); if(!tagged.length) return null; return (
            <div style={{ ...card,marginBottom:12 }}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,marginBottom:8 }}>TAGGED ACCOUNTS</div>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {tagged.map(a=>{ const bal=accountBalance(a.id); return (
                  <div key={a.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{a.name}</div>
                    <div style={{ color:T.accent,fontSize:13,fontWeight:800 }}>{sym}{fmt(bal)}</div>
                  </div>
                ); })}
                <div style={{ borderTop:`1px solid ${T.border}`,paddingTop:6,display:"flex",justifyContent:"space-between" }}>
                  <div style={{ color:T.sub,fontSize:11 }}>Total group wealth</div>
                  <div style={{ color:T.success,fontSize:13,fontWeight:900 }}>{sym}{fmt(tagged.reduce((s,a)=>s+accountBalance(a.id),0))}</div>
                </div>
              </div>
            </div>
          ); })()}
          <div style={card}>
            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
              <div style={{ width:46,height:46,borderRadius:14,background:g.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>{g.icon}</div>
              <div style={{ flex:1 }}>
                {isEditingGroup ? (
                  <div style={{ display:"flex",flexDirection:"column",gap:8,marginTop:2 }}>
                    <input value={editingGroupName} onChange={e=>setEditingGroupName(e.target.value)} style={{ ...inp, padding:"8px 10px", fontSize:16, fontWeight:700, width:"100%" }} placeholder="Group name" />
                    <input value={editingGroupBudget} onChange={e=>setEditingGroupBudget(e.target.value)} style={{ ...inp, padding:"8px 10px", fontSize:14, width:"100%" }} type="text" inputMode="decimal" placeholder="Group budget (0 = no budget)" />
                    <div style={{ color:T.sub,fontSize:11,fontWeight:700,marginBottom:4 }}>Group Type</div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                      {GROUP_TYPES.map(gt=>(
                        <button key={gt.id} onClick={()=>setEditingGroupTypeId(gt.id)} style={{ background:editingGroupTypeId===gt.id?T.accent+"22":"none",border:`1px solid ${editingGroupTypeId===gt.id?T.accent:T.border}`,borderRadius:10,padding:"6px 8px",cursor:"pointer",textAlign:"left",fontFamily:"Nunito,sans-serif" }}>
                          <div style={{ fontSize:11,fontWeight:700,color:editingGroupTypeId===gt.id?T.accent:T.text }}>{gt.icon} {gt.label}</div>
                          <div style={{ fontSize:9,color:T.sub }}>{gt.desc}</div>
                        </button>
                      ))}
                    </div>
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
                {/* Overall / Monthly toggle */}
                <div style={{ display:"flex",gap:4,marginTop:10,background:T.input,borderRadius:10,padding:"4px 6px" }}>
                  {[["overall",`📊 FY ${currentFYStartYear}-${String(currentFYStartYear+1).slice(-2)}`],["monthly","📅 Monthly"]].map(([mode,label])=>(
                    <button key={mode} onClick={()=>setGroupViewMode(mode)} style={{ flex:1,background:groupViewMode===mode?T.accent:"none",border:"none",borderRadius:7,padding:"5px",cursor:"pointer",fontSize:11,fontWeight:700,color:groupViewMode===mode?"#000":T.sub,fontFamily:"Nunito,sans-serif" }}>{label}</button>
                  ))}
                </div>
                {groupViewMode==="monthly"&&(
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,background:T.input,borderRadius:10,padding:"6px 10px" }}>
                    <button onClick={goPrev} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:18,padding:"0 6px",fontFamily:"Nunito,sans-serif" }}>‹</button>
                    <span style={{ color:T.text,fontSize:13,fontWeight:700 }}>{smLabel}</span>
                    <button onClick={goNext} style={{ background:"none",border:"none",color:shareMonth>=nowYM?T.border:T.sub,cursor:shareMonth>=nowYM?"default":"pointer",fontSize:18,padding:"0 6px",fontFamily:"Nunito,sans-serif" }}>›</button>
                  </div>
                )}
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8 }}>
                  <div style={{ background:T.input,borderRadius:10,padding:8,textAlign:"center" }}>
                    <div style={{ color:T.sub,fontSize:10,fontWeight:700 }}>YOU PAID</div>
                    <div style={{ color:T.info,fontSize:16,fontWeight:800 }}>{sym}{fmt(displayPaidByMe)}</div>
                  </div>
                  <div style={{ background:T.input,borderRadius:10,padding:8,textAlign:"center" }}>
                    <div style={{ color:T.sub,fontSize:10,fontWeight:700 }}>YOUR SHARE</div>
                    <div style={{ color:T.accent,fontSize:16,fontWeight:800 }}>{sym}{fmt(displayMySpend)}</div>
                  </div>
                  <div style={{ background:T.input,borderRadius:10,padding:8,textAlign:"center" }}>
                    <div style={{ color:T.sub,fontSize:10,fontWeight:700 }}>YOU OWE</div>
                    <div style={{ color:T.danger,fontSize:16,fontWeight:800 }}>{sym}{fmt(groupIOwe)}</div>
                  </div>
                  <div onClick={groupOwesMe>0?()=>setShowGroupOwesBreakdown(true):undefined} style={{ background:T.input,borderRadius:10,padding:8,textAlign:"center",cursor:groupOwesMe>0?"pointer":"default",position:"relative" }}>
                    <div style={{ color:T.sub,fontSize:10,fontWeight:700 }}>GROUP OWES{groupOwesMe>0&&<span style={{ marginLeft:4 }}>›</span>}</div>
                    <div style={{ color:T.success,fontSize:16,fontWeight:800 }}>{sym}{fmt(groupOwesMe)}</div>
                  </div>
                </div>
                {showGroupOwesBreakdown&&(()=>{
                  const items = getGroupReceivableItems(g.id);
                  return (
                    <div onClick={e=>e.target===e.currentTarget&&setShowGroupOwesBreakdown(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:220 }}>
                      <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"80vh",overflowY:"auto" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                          <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>👥 Group Owes You</div>
                          <button onClick={()=>setShowGroupOwesBreakdown(false)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
                        </div>
                        <div style={{ color:T.sub,fontSize:11,marginBottom:14 }}>Outstanding transactions & bills from {g.name}</div>
                        {items.length===0
                          ?<div style={{ color:T.sub,fontSize:13,textAlign:"center",padding:20 }}>No outstanding items.</div>
                          :items.map(item=>(
                            <div key={item.key} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:T.input,borderRadius:10,padding:"10px 12px",marginBottom:8 }}>
                              <div style={{ flex:1,minWidth:0 }}>
                                <div style={{ color:T.text,fontSize:12,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.title}</div>
                                <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{item.subtitle}</div>
                              </div>
                              <div style={{ color:T.success,fontSize:13,fontWeight:800,flexShrink:0 }}>{sym}{fmt(item.amount)}</div>
                              <button onClick={()=>{ setShowGroupOwesBreakdown(false); if(item.kind==="group-txn"){ const t=txns.find(x=>String(x.id)===String(item.id)); if(t) handleEditTxn(t); } else if(item.kind==="group-bill"){ const b=bills.find(x=>String(x.id)===String(item.id)); if(b) setEditingBill(b); } }} style={{ background:T.accent+"22",border:`1px solid ${T.accent}44`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif",flexShrink:0 }}>Edit ›</button>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  );
                })()}
                {(()=>{
                  // Per-member individual balances
                  const memberIds = g.members||[];
                  // Build spend tiles for all members + me
                  const meP = people.find(p=>p.isMe) || ME;
                  const allTileIds = groupIncludeMe ? [meP.id, ...memberIds.filter(pid=>pid!==meP.id)] : memberIds.filter(pid=>pid!==meP.id);
                  const periodTxns = groupViewMode==="overall" ? fyTxns : mTxns;
                  const memberBalances = allTileIds.map(pid=>{
                    const p = pid===meP.id ? meP : getPerson(pid);
                    if(!p) return null;
                    const isMe = pid===meP.id || p.isMe;
                    const totalSpend = periodTxns
                      .filter(t=>t.type==="expense"&&t.people?.[pid]&&Number(t.people[pid]?.amount||0)>0)
                      .reduce((s,t)=>s+Number(t.people[pid]?.amount||0),0);
                    return { p, totalSpend, isMe };
                  }).filter(m=>m&&m.totalSpend>0);
                  const spendPeriodLabel = groupViewMode==="overall"?` · FY ${currentFYStartYear}-${String(currentFYStartYear+1).slice(-2)}`:`· ${smLabel}`;
                  const anyData = memberBalances.length>0 || periodTxns.filter(t=>t.type==="expense").some(t=>Number(t.groupCollectiveAmount||0)>0);
                  if(!anyData) return null;
                  return (
                    <div style={{ marginTop:10 }}>
                      <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>Individual Spend {spendPeriodLabel}</div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                        {memberBalances.map(({p,totalSpend,isMe})=>{
                          const isFiltered = groupSpendFilter===p.id;
                          return (
                          <div key={p.id} onClick={()=>setGroupSpendFilter(isFiltered?null:p.id)} style={{ background:T.input,borderRadius:10,padding:"10px 10px",position:"relative",cursor:"pointer",boxShadow:isFiltered?`0 0 0 2px ${p.color||T.accent}`:"none",transition:"box-shadow 0.15s" }}>
                            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
                              <div style={{ width:24,height:24,borderRadius:7,background:p.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0 }}>{p.emoji}</div>
                              <div style={{ color:T.text,fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{isMe?"You":p.name}</div>
                            </div>
                            <div style={{ color:isMe?T.info:T.accent,fontSize:14,fontWeight:800 }}>{sym}{fmt(totalSpend)}</div>
                          </div>
                          );
                        })}
                        {(()=>{
                          const groupCollectiveTotal = periodTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.groupCollectiveAmount||0),0);
                          if(groupCollectiveTotal<=0) return null;
                          return (
                            <div onClick={()=>setGroupSpendFilter(groupSpendFilter==="__group__"?null:"__group__")} style={{ background:T.input,borderRadius:10,padding:"10px 10px",position:"relative",cursor:"pointer",boxShadow:groupSpendFilter==="__group__"?`0 0 0 2px ${g.color||T.accent}`:"none",transition:"box-shadow 0.15s" }}>
                              <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
                                <div style={{ width:24,height:24,borderRadius:7,background:g.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0 }}>{g.icon||"🏠"}</div>
                                <div style={{ color:T.text,fontSize:11,fontWeight:700 }}>Group</div>
                              </div>
                              <div style={{ color:g.color||T.accent,fontSize:14,fontWeight:800 }}>{sym}{fmt(groupCollectiveTotal)}</div>
                              <div style={{ color:T.sub,fontSize:9,fontWeight:700,marginTop:2 }}>collective</div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
                {groupOwesMe>0&&(()=>{
                  const buildMsg=(upiHandle)=>{
                    const msgBills=bills.filter(b=>b.groupId===g.id&&b.status==="unpaid"&&((b.dueDate||b.billDate||"").startsWith(shareMonth)));
                    const commonItems=[]; const personItems={};
                    mTxns.forEach(t=>{
                      const ca=Number(t.groupCollectiveAmount||0);
                      const hasPS=Object.entries(t.people||{}).some(([pid,info])=>pid!=="__me__"&&info?.mode==="owes"&&Number(info?.amount||0)>0&&!info?.settled);
                      if(ca>0) commonItems.push({desc:t.desc||t.merchant||"Expense",amount:ca});
                      Object.entries(t.people||{}).forEach(([pid,info])=>{
                        if(pid==="__me__"||info?.mode!=="owes"||info?.settled) return;
                        const sh=remainingShare(info); if(!sh) return;
                        if(!personItems[pid]) personItems[pid]=[];
                        personItems[pid].push({desc:t.desc||t.merchant||"Expense",amount:sh});
                      });
                      if(!hasPS&&!ca) commonItems.push({desc:t.desc||t.merchant||"Expense",amount:Number(t.amount||0)});
                    });
                    msgBills.forEach(b=>{
                      const ca=Number(b.groupCollectiveAmount||0);
                      const hasPS=Object.entries(b.splitPeople||{}).some(([pid,info])=>pid!=="__me__"&&info?.mode==="owes"&&!info?.settled);
                      if(ca>0) commonItems.push({desc:b.name||"Bill",amount:ca});
                      Object.entries(b.splitPeople||{}).forEach(([pid,info])=>{
                        if(pid==="__me__"||info?.mode!=="owes"||info?.settled) return;
                        const sh=remainingShare(info); if(!sh) return;
                        if(!personItems[pid]) personItems[pid]=[];
                        personItems[pid].push({desc:b.name||"Bill",amount:sh});
                      });
                      if(!hasPS&&!ca) commonItems.push({desc:b.name||"Bill",amount:Number(b.amount||0)});
                    });
                    const cTotal=commonItems.reduce((s,i)=>s+i.amount,0);
                    const pTotal=Object.values(personItems).flat().reduce((s,i)=>s+i.amount,0);
                    const grand=cTotal+pTotal;
                    if(!grand) return null;
                    const ls=[`📋 ${smLabel} — ${g.name} | Total: ${sym}${fmt(grand)}`,""];
                    if(commonItems.length){ ls.push(`Common: ${sym}${fmt(cTotal)}`); commonItems.forEach(i=>ls.push(`  · ${i.desc} ${sym}${fmt(i.amount)}`)); ls.push(""); }
                    (g.members||[]).forEach(pid=>{ const items=personItems[pid]; if(!items?.length) return; const pm=getPerson(pid); const tot=items.reduce((s,i)=>s+i.amount,0); ls.push(`${pm.emoji} ${pm.name}: ${sym}${fmt(tot)}`); items.forEach(i=>ls.push(`  · ${i.desc} ${sym}${fmt(i.amount)}`)); ls.push(""); });
                    if(upiHandle) ls.push(`Pay to: ${upiHandle}`);
                    ls.push("– sent via Arth");
                    return ls.join("\n").trim();
                  };
                  const doShare=async(upiHandle)=>{
                    const text=buildMsg(upiHandle);
                    if(!text){ alert("No expenses found for "+smLabel); return; }
                    try{
                      if(navigator.share){ await navigator.share({text}); }
                      else{ await navigator.clipboard.writeText(text); alert("Payment request copied to clipboard!"); }
                    }catch(e){ if(e?.name!=="AbortError") navigator.clipboard?.writeText(text||"").catch(()=>{}); }
                  };
                  const handleShareClick=()=>{
                    const upiAccs=accounts.filter(a=>a.type==="upi"&&a.handle);
                    if(upiAccs.length<=1){ doShare(upiAccs[0]?.handle||""); return; }
                    setPendingShareBase(()=>doShare);
                    setShowUpiPicker(true);
                  };
                  return (<>
                    <button onClick={handleShareClick} style={{ ...btnP,marginTop:8,background:T.accentSoft,border:`1px solid ${T.accent}55`,color:T.accent,width:"100%" }}>📤 Request {sym}{fmt(groupOwesMe)} from group</button>
                    {showUpiPicker&&<div style={{ position:"fixed",inset:0,background:"#0009",zIndex:900,display:"flex",alignItems:"flex-end",justifyContent:"center" }} onClick={()=>setShowUpiPicker(false)}>
                      <div style={{ background:T.card,borderRadius:"18px 18px 0 0",padding:24,width:"100%",maxWidth:480 }} onClick={e=>e.stopPropagation()}>
                        <div style={{ color:T.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:12 }}>Pay via which UPI?</div>
                        {accounts.filter(a=>a.type==="upi"&&a.handle).map(a=>{
                          const linked=a.linkedAccount?accounts.find(b=>b.id===a.linkedAccount):null;
                          return (
                            <button key={a.id} onClick={()=>{ setShowUpiPicker(false); doShare(a.handle); }} style={{ display:"block",width:"100%",textAlign:"left",background:T.input,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:8,color:T.text,fontFamily:"Nunito,sans-serif",fontSize:14,fontWeight:700,cursor:"pointer" }}>
                              📱 {a.name} <span style={{ color:T.sub,fontWeight:400 }}>{a.handle}{linked?` · ${linked.name}`:""}</span>
                            </button>
                          );
                        })}
                        <button onClick={()=>{ setShowUpiPicker(false); doShare(""); }} style={{ display:"block",width:"100%",textAlign:"center",background:"none",border:"none",color:T.sub,fontFamily:"Nunito,sans-serif",fontSize:13,cursor:"pointer",marginTop:4 }}>Share without UPI</button>
                      </div>
                    </div>}
                  </>);
                })()}
              </div>
              <button onClick={()=>setGroups(prev=>prev.filter(x=>x.id!==g.id))&&setSelectedGroup(null)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:20 }}>🗑</button>
            </div>

            <div style={{ marginBottom:12 }}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8 }}>{isEditingGroup ? "Add / Remove / Replace Members" : "Members"}</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                {isEditingGroup ? (
                  <button onClick={()=>setEditingGroupIncludeMe(prev=>!prev)} style={{ background:editingGroupIncludeMe?T.accentSoft:"none",border:`1px solid ${editingGroupIncludeMe?T.accent:T.border}`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,color:editingGroupIncludeMe?T.accent:T.sub,cursor:"pointer",fontFamily:"Nunito,sans-serif",display:"flex",alignItems:"center",gap:4 }}>
                    🧑 Me {editingGroupIncludeMe ? "✓" : "+"}
                  </button>
                ) : groupIncludeMe ? (
                  <div style={{ background:T.accentSoft,border:`1px solid ${T.accent}44`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif",display:"flex",alignItems:"center",gap:4 }}>
                    🧑 Me
                  </div>
                ) : null}
                {currentMembers.map(pid=>{ const p=getPerson(pid); return isEditingGroup ? (
                  <button key={pid} onClick={()=>toggleMember(pid)} style={{ background:p.color+"22",border:`1px solid ${p.color}66`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,color:p.color,cursor:"pointer",fontFamily:"Nunito,sans-serif",display:"flex",alignItems:"center",gap:4 }}>
                    {p.emoji} {p.name} <span style={{ fontSize:10,opacity:0.7 }}>✕</span>
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
                    <div style={{ color:T.danger,fontSize:13,fontWeight:700 }}>{sym}{fmt(getNetBillAmount(b))}</div>
                  </div>
                ))}
                <div style={{ marginBottom:12 }}/>
              </>}
              {(()=>{
                const baseTxns = groupSpendFilter!==null
                  ? (groupViewMode==="overall" ? fyTxns : mTxns)
                  : (groupViewMode==="overall" ? gTxns : mTxns);
                const spendFilteredTxns = groupSpendFilter===null
                  ? baseTxns
                  : groupSpendFilter==="__group__"
                    ? baseTxns.filter(t=>Number(t.groupCollectiveAmount||0)>0)
                    : baseTxns.filter(t=>t.people?.[groupSpendFilter]&&Number(t.people[groupSpendFilter]?.amount||0)>0);
                const displayTxns = spendFilteredTxns.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                const spendFilterLabel = groupSpendFilter==="__group__"?" · Group":groupSpendFilter?` · ${getPerson(groupSpendFilter)?.name||""}`:"";
                return <>
                  <div style={{ color:T.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10 }}>Expenses — {groupViewMode==="overall"?"All time":smLabel}{spendFilterLabel}</div>
                  {displayTxns.length===0
                    ?<div style={{ color:T.sub,fontSize:12,textAlign:"center",padding:20 }}>No expenses{groupViewMode==="monthly"?` for ${smLabel}`:""}{spendFilterLabel?` for${spendFilterLabel}`:""}</div>
                    :displayTxns.map((t,idx,arr)=><TxnRow key={t.id} t={t} last={idx===arr.length-1}/>)}
                </>;
              })()}
              {/* Settlements related to group members */}
              {(()=>{
                const memberIds=g.members||[];
                const groupSettlements=txns.filter(t=>t.type==="settlement_in"&&memberIds.includes(t.fromPersonId)&&(groupViewMode==="overall"||(t.date||"").startsWith(shareMonth)));
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
        <div style={{ display:"flex",gap:0,marginBottom:12,background:T.pill,borderRadius:12,padding:4 }}>
          {[["people","👥 People"],["groups","🏘️ Groups"]].map(([v,l])=>(
            <button key={v} onClick={()=>setSubView(v)} style={{ flex:1,background:subView===v?T.card:"transparent",border:subView===v?`1px solid ${T.border}`:"none",borderRadius:9,padding:"8px 0",cursor:"pointer",fontSize:13,fontWeight:700,color:subView===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
          ))}
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:16,alignItems:"center" }}>
          <button onClick={()=>setSubView(subView==="people"?"list":"people")} style={{ background:T.accent,border:"none",borderRadius:10,padding:"9px 18px",cursor:"pointer",fontSize:13,fontWeight:800,color:"#000",fontFamily:"Nunito,sans-serif" }}>+ Add</button>
          <div style={{ display:"flex",gap:6,flex:1 }}>
            {subView==="people"&&<div style={{ color:T.accent,fontSize:12,fontWeight:700 }}>Adding Person</div>}
            {subView==="groups"&&<div style={{ color:T.accent,fontSize:12,fontWeight:700 }}>Adding Group</div>}
          </div>
          {(subView==="people"||subView==="groups")&&(
            <div style={{ display:"flex",gap:6 }}>
              <button onClick={()=>setSubView("people")} style={{ background:subView==="people"?T.accentSoft:"none",border:`1px solid ${subView==="people"?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:subView==="people"?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>👤 Person</button>
              <button onClick={()=>setSubView("groups")} style={{ background:subView==="groups"?T.accentSoft:"none",border:`1px solid ${subView==="groups"?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:subView==="groups"?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>👥 Group</button>
            </div>
          )}
        </div>

        {subView==="people"&&<>
          {totalOwedToMe>0&&<div style={{ ...card,background:`linear-gradient(135deg,${T.success}10,${T.card})`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Total to Recover</div>
              <div style={{ color:T.success,fontSize:22,fontWeight:900,marginTop:4 }}>{sym}{fmt(totalOwedToMe)}</div>
            </div>
            <div style={{ fontSize:32 }}>💰</div>
          </div>}

          <div style={{ ...card,border:`1px dashed ${T.border}` }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:12 }}>➕ Add Person</div>
            <div style={{ display:"flex",gap:8,marginBottom:10 }}>
              {[["contact","🤝 Contact","They may owe you"],["dependant","♥ Dependant","Family, you cover them"]].map(([v,l,sub])=>(
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
              {["👤","👨","👩","👶","👴","👵","🐕"].map(em=><button key={em} onClick={()=>setNewEmoji(em)} style={{ background:newEmoji===em?T.accentSoft:"none",border:`1px solid ${newEmoji===em?T.accent:T.border}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:18 }}>{em}</button>)}
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
              {PALETTE.map(c=><div key={c} onClick={()=>setNewColor(c)} style={{ width:24,height:24,borderRadius:6,background:c,cursor:"pointer",border:newColor===c?"3px solid #fff":"3px solid transparent" }}/>) }
            </div>
            <button onClick={addPerson} style={btnP}>Add Person</button>
          </div>

          {listedPeople.map(p=>{
            const s=settlements[p.id];
            const personalSpent = Number(personSpend["__me__"]||0);
            const spent=p.isMe ? personalSpent : (personSpend[p.id]||0);
            // For contacts: show expense split net balance
            // For dependants: only show if they have a loan (not expense splits — family spend is yours)
            const splitNet = (s?.owesMe||0)-(s?.iOwe||0);
            const personLoanOwed = !p.isMe ? activeLoans.filter(l=>
              l.direction!=="taken" &&
              l.status==="active" &&
              String(l.personId||l.linkedPersonId||"")===String(p.id) &&
              Number(l.outstanding||0)>0
            ).reduce((sum,l)=>sum+Number(l.outstanding||0),0) : 0;
            // Show combined splits + loans for all persons
            const net = splitNet + personLoanOwed;
            const netLabel = net>0
              ? (personLoanOwed>0 && Math.abs(splitNet)<=0 ? "loan owed" : "owes you")
              : net<0 ? "you owe" : "";
            const creditLimit=p.creditLimit||0;
            const atLimit=!p.isMe&&creditLimit>0&&(s?.owesMe||0)>=creditLimit*0.9;
            return (
              <div key={p.id} onClick={()=>setSelectedPerson(p)} style={{ ...card,cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ width:42,height:42,borderRadius:"50%",background:p.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,position:"relative" }}>
                  {p.emoji}
                  {p.personType==="dependant"&&<div style={{ position:"absolute",bottom:-2,right:-2,fontSize:9,background:T.info,borderRadius:"50%",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center" }}>♥</div>}
                  {p.favorite&&<div style={{ position:"absolute",top:-2,right:-2,fontSize:9,background:T.accent,color:"#000",borderRadius:"50%",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900 }}>★</div>}
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
                {!p.isMe&&<button onClick={e=>{ e.stopPropagation(); toggleFavorite(p); }} style={{ background:p.favorite?T.accentSoft:"none",border:`1px solid ${p.favorite?T.accent:T.border}`,borderRadius:8,padding:"5px 8px",cursor:"pointer",fontSize:12,fontWeight:800,color:p.favorite?T.accent:T.sub,fontFamily:"Nunito,sans-serif",flexShrink:0 }}>{p.favorite?"★":"☆"}</button>}
                {!p.isMe&&net!==0&&(
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:net>0?T.success:T.danger,fontSize:13,fontWeight:800 }}>{net>0?"+":""}{sym}{fmt(Math.abs(net))}</div>
                    <div style={{ color:net>0?T.success:T.danger,fontSize:10 }}>{netLabel}</div>
                  </div>
                )}
                <div style={{ color:T.sub,fontSize:12 }}>→</div>
              </div>
            );
          })}

        </>}

        {subView==="groups"&&<>
          <div style={{ ...card,border:`1px dashed ${T.border}` }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:12 }}>➕ New Group</div>
            <input style={{ ...inp,marginBottom:10 }} placeholder="Group name *" value={newGroupName} onChange={e=>setNewGroupName(e.target.value)}/>
            <div style={{ marginBottom:10 }}>
              <span style={lbl}>Group type</span>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6 }}>
                {GROUP_TYPES.map(gt=>(
                  <button key={gt.id} onClick={()=>setNewGroupTypeId(newGroupTypeId===gt.id?"":gt.id)} style={{ background:newGroupTypeId===gt.id?T.accent+"22":"none",border:`1px solid ${newGroupTypeId===gt.id?T.accent:T.border}`,borderRadius:10,padding:"8px 10px",cursor:"pointer",textAlign:"left",fontFamily:"Nunito,sans-serif" }}>
                    <div style={{ fontSize:12,fontWeight:700,color:newGroupTypeId===gt.id?T.accent:T.text }}>{gt.icon} {gt.label}</div>
                    <div style={{ fontSize:9,color:T.sub,marginTop:2 }}>{gt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <span style={lbl}>Members</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:6 }}>
                <button onClick={()=>setNewGroupIncludeMe(v=>!v)} style={{ background:newGroupIncludeMe?T.accentSoft:"none",border:`1px solid ${newGroupIncludeMe?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:newGroupIncludeMe?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>🧑 Me {newGroupIncludeMe?"✓":"+"}</button>
                {people.filter(p=>!p.isMe).map(p=><button key={p.id} onClick={()=>setNewGroupMembers(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])} style={{ background:newGroupMembers.includes(p.id)?p.color+"22":"none",border:`1px solid ${newGroupMembers.includes(p.id)?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:newGroupMembers.includes(p.id)?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>)}
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <span style={lbl}>Optional group budget</span>
              <input style={inp} type="number" placeholder={`e.g. 10000`} value={newGroupManualLimit} onChange={e=>setNewGroupManualLimit(e.target.value)}/>
            </div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:2,marginBottom:12 }}>
              {PALETTE.map(c=><div key={c} onClick={()=>setNewGroupColor(c)} style={{ width:24,height:24,borderRadius:6,background:c,cursor:"pointer",border:newGroupColor===c?"3px solid #fff":"3px solid transparent" }}/>) }
            </div>
            <button onClick={addGroup} style={btnP}>Create Group</button>
          </div>

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
                    <div key={g.id} onClick={()=>{ setSelectedGroup(g); setEditingGroupName(g.name||""); setEditingGroupBudget(String(g.manualLimit||"")); setEditingGroupMembers([...(g.members||[])]); setIsEditingGroup(false); setGroupSpendFilter(null); }} style={{ ...card,cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}>
                      <div style={{ width:42,height:42,borderRadius:12,background:g.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{g.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ color:T.text,fontSize:14,fontWeight:800 }}>{g.name}</div>
                        <div style={{ color:T.sub,fontSize:11,marginTop:1 }}>{(g.members?.length||0) + (g.includeMe===false?0:1)} members{g.includeMe===false?" · you not included":" · you included"}</div>
                        <div style={{ color:gOver?T.danger:T.sub,fontSize:10,marginTop:2 }}>{gBudget>0?`Budget ${sym}${fmt(gBudget)} · `:""}Spent {sym}{fmt(gTotalSpend)}{gOver?` · ⚠️ Over ${sym}${fmt(gTotalSpend-gBudget)}`:""}</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ color:g.color,fontSize:14,fontWeight:800 }}>{sym}{fmt(groupReceivableTotal(g.id))}</div>
                        <div style={{ color:T.sub,fontSize:10 }}>→</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}






        </>}

      {showTxnUpiPicker&&pendingTxnShare?._peoplePicker&&<div style={{ position:"fixed",inset:0,background:"#0009",zIndex:900,display:"flex",alignItems:"flex-end",justifyContent:"center" }} onClick={()=>setShowTxnUpiPicker(false)}>
        <div style={{ background:T.card,borderRadius:"18px 18px 0 0",padding:24,width:"100%",maxWidth:480 }} onClick={e=>e.stopPropagation()}>
          <div style={{ color:T.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:12 }}>Pay via which UPI?</div>
          {accounts.filter(a=>a.type==="upi"&&a.handle).map(a=>{
            const linked = a.linkedAccount ? accounts.find(b=>b.id===a.linkedAccount) : null;
            return (
              <button key={a.id} onClick={()=>{ setShowTxnUpiPicker(false); doTxnShare(pendingTxnShare.recipientName, pendingTxnShare.amount, pendingTxnShare.contextLabel, a.handle); setPendingTxnShare(null); }} style={{ display:"block",width:"100%",textAlign:"left",background:T.input,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:8,color:T.text,fontFamily:"Nunito,sans-serif",fontSize:14,fontWeight:700,cursor:"pointer" }}>
                📱 {a.name} <span style={{ color:T.sub,fontWeight:400 }}>{a.handle}{linked?` · ${linked.name}`:""}</span>
              </button>
            );
          })}
          <button onClick={()=>{ setShowTxnUpiPicker(false); doTxnShare(pendingTxnShare.recipientName, pendingTxnShare.amount, pendingTxnShare.contextLabel, ""); setPendingTxnShare(null); }} style={{ display:"block",width:"100%",textAlign:"center",background:"none",border:"none",color:T.sub,fontFamily:"Nunito,sans-serif",fontSize:13,cursor:"pointer",marginTop:4 }}>Share without UPI</button>
        </div>
      </div>}

      </div>
    );
  };

  // ── INVESTMENTS ────────────────────────────────────────────────────────────
  const Investments = ({ onClose = null }) => {
    const byType=investmentTypeSummaries.map(it=>({
      ...it,
      folios:investmentDashboardGroups.filter(group=>group.type===it.id).sort((a,b)=>b.total-a.total),
    })).filter(it=>it.folios.length>0);
    const activeType = selectedInvestmentTypeView==="all" ? null : (byType.find(it=>it.id===selectedInvestmentTypeView) || null);
    const grandTotal=investmentAssetsTotal;
    const pieData=byType.map(it=>({ name:it.name,value:it.total,color:it.color,icon:it.icon }));
    const folioCount = investmentDashboardGroups.length;
    return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ color:T.text,fontSize:20,fontWeight:900 }}>💹 Investments</div>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <button onClick={openInvestmentComposer} style={{ background:T.accent,border:"none",color:"#000",borderRadius:10,padding:"7px 16px",cursor:"pointer",fontSize:13,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>+ Add</button>
            {onClose && <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>}
          </div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
          {[{label:"Total",value:`${sym}${fmt(grandTotal)}`,color:T.info,icon:"💹"},{label:"Monthly",value:`${sym}${fmt(monthlyInvestmentCommitment)}`,color:T.purple,icon:"🔁"},{label:"Holdings",value:folioCount,color:T.success,icon:"🗂️"},{label:"This Month",value:`${sym}${fmt(monthlyInvestmentFlow)}`,color:T.accent,icon:"📅"}].map(s=>(
            <div key={s.label} style={{ ...card,marginBottom:0,padding:"12px" }}>
              <div style={{ fontSize:20,marginBottom:4 }}>{s.icon}</div>
              <div style={{ color:s.color,fontSize:16,fontWeight:800 }}>{s.value}</div>
              <div style={{ color:T.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        {byType.length===0?(
          <div style={{ ...card,textAlign:"center",padding:40 }}>
            <div style={{ fontSize:48,marginBottom:12 }}>💹</div>
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
          {!activeType ? byType.map(it=>(
            <div key={it.id} onClick={()=>setSelectedInvestmentTypeView(it.id)} style={{ ...card,cursor:"pointer" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:34,height:34,borderRadius:10,background:it.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>{it.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{it.name}</div>
                  <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{it.groupCount} {it.groupCount===1?"holding":"holdings"}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ color:it.color,fontSize:14,fontWeight:800 }}>{sym}{fmt(it.total)}</div>
                  <div style={{ color:T.sub,fontSize:10 }}>Open</div>
                </div>
              </div>
            </div>
          )) : (
            <div style={card}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                <button onClick={()=>setSelectedInvestmentTypeView("all")} style={{ background:T.pill,border:"none",color:T.accent,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>← Types</button>
                <div style={{ width:34,height:34,borderRadius:10,background:(activeType.color||T.info)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>{activeType.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{activeType.name}</div>
                  <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{activeType.folios.length} {activeType.folios.length===1?"holding":"holdings"}</div>
                </div>
                <div style={{ color:activeType.color||T.info,fontSize:14,fontWeight:800 }}>{sym}{fmt(activeType.total)}</div>
              </div>
              {activeType.folios.map((folio,idx,arr)=>(
                <div key={folio.id} onClick={()=>{
                  if(!folio.itemCount && folio.accountCount===1 && folio.accounts?.[0]){
                    setShowInvestments(false);
                    setSelectedInvestmentTypeView("all");
                    setShowAccDetail(folio.accounts[0]);
                    return;
                  }
                  setSelectedInvestmentDetail({...folio,typeMeta:activeType});
                }} style={{ padding:"8px 0",borderBottom:idx<arr.length-1?`1px solid ${T.border}`:"none",cursor:"pointer" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",gap:10 }}>
                    <div style={{ minWidth:0,flex:1 }}>
                      <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{folio.folioNo?`Folio ${folio.folioNo}`:(folio.title || folio.primaryName)}</div>
                      <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>
                        {folio.itemCount>0
                          ? (activeType.id==="stocks"
                            ? `${folio.itemCount} stock${folio.itemCount===1?"":"s"}`
                            : (folio.folioNo
                              ? `Folio ${folio.folioNo} · ${folio.itemCount} entr${folio.itemCount===1?"y":"ies"}`
                              : (investmentFreqLabel(folio.items?.[0]?.freq) || `${folio.itemCount} holding${folio.itemCount===1?"":"s"}`)))
                          : `${folio.accountCount} account${folio.accountCount===1?"":"s"} · tracked in Wealth`}
                      </div>
                      {(folio.items||[]).slice(0,2).map(item=>{
                        const metricText = formatInvestmentMetric(item.type, item.lastNav);
                        return <div key={item.id} style={{ color:T.sub,fontSize:10,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.name} · {sym}{fmt(item.amount)}{metricText?` · ${metricText}`:""}</div>;
                      })}
                      {!folio.itemCount && (folio.accounts||[]).slice(0,2).map(account=><div key={account.id} style={{ color:T.sub,fontSize:10,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{account.name} · balance {sym}{fmt(accountBalance(account.id))}</div>)}
                      {folio.itemCount>2&&<div style={{ color:T.sub,fontSize:10,marginTop:3 }}>+{folio.itemCount-2} more</div>}
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ color:activeType.color||T.info,fontSize:12,fontWeight:800 }}>{sym}{fmt(folio.total)}</div>
                      <div style={{ color:T.sub,fontSize:10 }}>Tap to view</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>}
      </div>
    );
  };

  // ── SETTINGS ───────────────────────────────────────────────────────────────
  const LoanModal = ({ item, onClose }) => {
    const isDraft = Boolean(item?._isDraft);
    const isEditing = Boolean(item && !isDraft);
    const [direction,setDirection]=useState(item?.direction||"given");
    const [sourceType,setSourceType]=useState(item?.sourceType || (item?.direction==="taken" ? "bank" : "person"));
    const [name,setName]=useState(item?.name||"");
    const [principal,setPrincipal]=useState(String(item?.principal ?? item?.amount ?? ""));
    const [outstanding,setOutstanding]=useState(String(item?.outstanding ?? item?.principal ?? item?.amount ?? ""));
    const [tenureMonths,setTenureMonths]=useState(String(item?.tenureMonths||""));
    const [emiAmount,setEmiAmount]=useState(String(item?.emiAmount||""));
    const [startDate,setStartDate]=useState(item?.startDate||todayStr());
    const [dueDate,setDueDate]=useState(item?.dueDate||"");
    const [dueDay,setDueDay]=useState(String(item?.dueDay||""));
    const [paymentAccId,setPaymentAccId]=useState(item?.paymentAccId || accounts.find(a=>a.type!=="cc")?.id || accounts[0]?.id || "");
    const [hasInterest,setHasInterest]=useState(item?.hasInterest ?? (Number(item?.interestRate||0)>0));
    const [interestRate,setInterestRate]=useState(String(item?.interestRate||""));
    const [note,setNote]=useState(item?.note||"");
    const [loanPersonId,setLoanPersonId]=useState(item?.personId||"");

    useEffect(()=>{
      if(!dueDay && startDate){
        const defaultDay = toDateOnly(startDate)?.getDate() || new Date().getDate();
        setDueDay(String(defaultDay));
      }
    },[dueDay,startDate]);

    useEffect(()=>{
      const principalNum = parseMoney(principal);
      const months = Math.max(0, parseInt(tenureMonths||0,10) || 0);
      if(direction==="taken" && principalNum>0 && months>0 && !parseMoney(emiAmount)){
        setEmiAmount(String(Math.round((principalNum / months) * 100) / 100));
      }
    },[direction,principal,tenureMonths,emiAmount]);

    const save=()=>{
      const effectiveName = name.trim() || (loanPersonId ? (people.find(p=>p.id===loanPersonId)?.name||"") : "");
      if(!effectiveName) return;
      if(!name.trim() && effectiveName) setName(effectiveName);
      const principalNum = Math.max(0, parseMoney(principal));
      const outstandingNum = Math.max(0, parseMoney(outstanding));
      const nextStatus = item?.status==="written_off"
        ? "written_off"
        : item?.status==="converted_to_expense"
          ? "converted_to_expense"
          : outstandingNum<=0
            ? "closed"
            : "active";
      const nextItem={
        ...(item||{}),
        id:isEditing ? item.id : (item?.id || genId()),
        direction,
        sourceType,
        name:effectiveName,
        principal:principalNum,
        outstanding:outstandingNum,
        startDate:startDate||todayStr(),
        dueDate:dueDate || (dueDay ? getNextDueDate(startDate||todayStr(), dueDay) : ""),
        dueDay:dueDay ? Math.max(1, Math.min(31, parseInt(dueDay,10)||1)) : "",
        tenureMonths:Math.max(0, parseInt(tenureMonths||0,10) || 0),
        emiAmount:Math.max(0, parseMoney(emiAmount)||0),
        paymentAccId:paymentAccId || accounts[0]?.id || "",
        hasInterest,
        interestRate:hasInterest?Math.max(0,parseFloat(interestRate)||0):0,
        note:note.trim(),
        personId:direction==="given"&&sourceType==="person"&&loanPersonId ? loanPersonId : null,
        paymentMode:(Number(parseMoney(emiAmount)||0)>0 || Number(tenureMonths||0)>0) ? "emi" : (item?.paymentMode || "manual"),
        isEmiPlan:Boolean(Number(parseMoney(emiAmount)||0)>0 || Number(tenureMonths||0)>0 || item?.isEmiPlan),
        repayments:Array.isArray(item?.repayments)?item.repayments:[],
        status:nextStatus,
        closedDate:nextStatus==="closed"?(item?.closedDate||todayStr()):item?.closedDate||"",
        writtenOffDate:item?.writtenOffDate||"",
        convertedDate:item?.convertedDate||"",
      };
      setLoans(prev=>isEditing?prev.map(x=>x.id===item.id?{...x,...nextItem}:x):[nextItem,...prev]);
      setEditingLoan(null);
      setShowAddLoan(false);
      onClose();
    };

    return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{isEditing?"Edit Loan":"Add Loan"}</div>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              {isEditing && item?.status==="active" && Number(item?.outstanding||0)>0 && (
                <button onClick={()=>{ onClose(); setRepaymentLoan(item); }} style={{ background:T.success+"22",border:`1px solid ${T.success}44`,borderRadius:10,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:800,color:T.success,fontFamily:"Nunito,sans-serif" }}>{direction==="taken"?"Pay EMI / Repay":"Record Receipt"}</button>
              )}
              <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
            </div>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              <Chip color={T.accent} active={direction==="given"} onClick={()=>setDirection("given")}>🫴 Loan Given</Chip>
              <Chip color={T.danger} active={direction==="taken"} onClick={()=>setDirection("taken")}>🤲 Loan Taken</Chip>
            </div>
            {direction==="given"&&sourceType==="person"&&(
              <div>
                <span style={lbl}>Select Person</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:6 }}>
                  {people.filter(p=>!p.isMe).map(p=>(
                    <button key={p.id} onClick={()=>{ setLoanPersonId(p.id); setName(p.name); }} style={{ background:loanPersonId===p.id?p.color+"22":"none",border:`1px solid ${loanPersonId===p.id?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:loanPersonId===p.id?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>
                      {p.emoji} {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <input style={inp} placeholder={direction==="given"?"Loan label / description":"Loan / lender name"} value={name} onChange={e=>setName(e.target.value)}/>
            <div>
              <span style={lbl}>Source type</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {[ ["person","👤 Person"],["bank","🏦 Bank"],["store","🛒 Store"],["cc","💳 Credit Card"],["other","📦 Other"] ].map(([value,label])=>(
                  <Chip key={value} color={value==="cc"?T.danger:(direction==="taken"?T.warn:T.accent)} active={sourceType===value} onClick={()=>setSourceType(value)}>{label}</Chip>
                ))}
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div>
                <span style={lbl}>Principal ({sym})</span>
                <input style={inp} type="text" inputMode="decimal" value={principal||""} onChange={e=>setPrincipal(cleanMoneyInput(e.target.value))}/>
              </div>
              <div>
                <span style={lbl}>Outstanding ({sym})</span>
                <input style={inp} type="text" inputMode="decimal" value={outstanding||""} onChange={e=>setOutstanding(cleanMoneyInput(e.target.value))}/>
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
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div>
                <span style={lbl}>Tenure (months)</span>
                <input style={inp} type="number" min="0" value={tenureMonths} onChange={e=>setTenureMonths(e.target.value)} placeholder="Optional"/>
              </div>
              <div>
                <span style={lbl}>EMI ({sym})</span>
                <input style={inp} type="text" inputMode="decimal" value={emiAmount||""} onChange={e=>setEmiAmount(cleanMoneyInput(e.target.value))} placeholder="Optional"/>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div>
                <span style={lbl}>Due day</span>
                <input style={inp} type="number" min="1" max="31" value={dueDay} onChange={e=>setDueDay(e.target.value)} placeholder="e.g. 5"/>
              </div>
              <div>
                <span style={lbl}>{direction==="taken"?"Repayment from":"Receive into"}</span>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {accounts.map(a=><button key={a.id} onClick={()=>setPaymentAccId(a.id)} style={{ background:paymentAccId===a.id?a.color+"22":"none",border:`1px solid ${paymentAccId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:paymentAccId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
                </div>
              </div>
            </div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,background:T.input,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px" }}>
              <div>
                <div style={{ color:T.text,fontSize:12,fontWeight:800 }}>Interest</div>
                <div style={{ color:T.sub,fontSize:10 }}>{hasInterest?"Track APR / rate":"No-interest loan"}</div>
              </div>
              <button onClick={()=>setHasInterest(v=>!v)} style={{ background:hasInterest?T.accent:T.pill,border:`1px solid ${hasInterest?T.accent:T.border}`,borderRadius:18,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:800,color:hasInterest?"#000":T.sub,fontFamily:"Nunito,sans-serif" }}>{hasInterest?"Interest ON":"No Interest"}</button>
            </div>
            {hasInterest&&<div>
              <span style={lbl}>Interest Rate (% p.a.)</span>
              <input style={inp} type="number" value={interestRate} onChange={e=>setInterestRate(e.target.value)} placeholder="e.g. 12"/>
            </div>}
            <input style={inp} placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)}/>
            <div style={{ color:T.sub,fontSize:10 }}>If EMI is set, each repayment can automatically create the monthly cash-flow entry so the loan and spending stay in sync.</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={onClose} style={btnG}>Cancel</button>
              <button onClick={save} style={btnP}>{isEditing?"Save Loan":"Save Loan"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const LoanRepaymentModal = ({ item, onClose }) => {
    const isEmiFlow = item?.direction==="taken" && (Number(item?.emiAmount||0)>0 || item?.paymentMode==="emi" || item?.isEmiPlan);
    const [amount,setAmount]=useState(String(item?.direction==="taken" ? (item?.emiAmount || item?.outstanding || "") : (item?.outstanding || "")));
    const [date,setDate]=useState(todayStr());
    const [accId,setAccId]=useState(item?.paymentAccId || accounts.find(a=>a.type!=="cc")?.id || accounts[0]?.id || "");
    const [note,setNote]=useState("");
    const label = item?.direction==="given" ? "Record money received" : (isEmiFlow ? "Pay EMI" : "Record repayment made");

    const save=()=>{
      const outstandingNow = Number(item?.outstanding||0);
      const repaymentAmount = Math.min(outstandingNow, Math.max(0, parseMoney(amount)||0));
      if(!item || repaymentAmount<=0) return;
      setLoans(prev=>prev.map(loan=>{
        if(loan.id!==item.id) return loan;
        const nextOutstanding = Math.max(0, Number(loan.outstanding||0) - repaymentAmount);
        return {
          ...loan,
          paymentAccId:accId || loan.paymentAccId || accounts[0]?.id || "",
          outstanding:nextOutstanding,
          status:nextOutstanding<=0?"closed":"active",
          closedDate:nextOutstanding<=0?(date||todayStr()):loan.closedDate||"",
          repayments:[...(Array.isArray(loan.repayments)?loan.repayments:[]),{ id:genId(), date:date||todayStr(), amount:repaymentAmount, note:note.trim() }],
        };
      }));

      if(item.direction==="taken"){
        // CC EMI with autoScheduled: installment transactions already pre-created upfront — skip adding a new one
        if(!item.autoScheduled){
          const expenseCatIds = Array.isArray(item.expenseCatIds) && item.expenseCatIds.length ? item.expenseCatIds : (item.expenseCatId ? [item.expenseCatId] : ["financial"]);
          const expenseSubId = item.expenseSubId || (expenseCatIds[0]==="financial" ? "fi7" : null);
          setTxns(prev=>[{
            id:Date.now(),
            type:"expense",
            desc:isEmiFlow ? `EMI - ${item.name || "Loan"}` : `Repayment - ${item.name || "Loan"}`,
            merchant:item.name || (isEmiFlow ? "Loan EMI" : "Loan repayment"),
            date:date||todayStr(),
            note:[isEmiFlow?"EMI payment":"Loan repayment", note.trim()].filter(Boolean).join(" · "),
            amount:repaymentAmount,
            accId:accId || item.paymentAccId || accounts[0]?.id || "",
            catId:expenseCatIds[0] || "financial",
            catIds:expenseCatIds,
            subId:expenseSubId || null,
            subIds:Array.isArray(item.expenseSubIds) && item.expenseSubIds.length ? item.expenseSubIds : (expenseSubId ? [expenseSubId] : []),
            linkedLoanId:item.id,
            trackingMode:"none",
            people:{},
          },...prev]);
        }
      } else {
        const matchedPerson = people.find(p=>!p.isMe && normalizeVendorText(p.name)===normalizeVendorText(item?.name||""));
        setTxns(prev=>[{
          id:Date.now(),
          type:"settlement_in",
          desc:`Loan receipt - ${item?.name || "Loan"}`,
          merchant:item?.name || "Loan receipt",
          date:date||todayStr(),
          note:["Money received against loan", note.trim()].filter(Boolean).join(" · "),
          amount:repaymentAmount,
          accId:accId || accounts[0]?.id || "",
          fromPersonId:matchedPerson?.id || null,
          catId:null,
          isRefund:false,
          againstTxnId:null,
          linkedLoanId:item?.id || null,
        },...prev]);
      }

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
              <input style={inp} type="text" inputMode="decimal" value={amount||""} onChange={e=>setAmount(cleanMoneyInput(e.target.value))} autoFocus/>
            </div>
            <div>
              <span style={lbl}>Date</span>
              <input style={inp} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
            <div>
              <span style={lbl}>{item?.direction==="taken"?"Paid from":"Received into"}</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {accounts.map(a=><button key={a.id} onClick={()=>setAccId(a.id)} style={{ background:accId===a.id?a.color+"22":"none",border:`1px solid ${accId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:accId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
              </div>
            </div>
            <input style={inp} placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)}/>
            <div style={{ color:T.sub,fontSize:10 }}>{item?.direction==="taken" ? "This also adds the month’s actual cash outflow to Transactions." : "This also records the money received in Transactions."}</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <button onClick={onClose} style={btnG}>Cancel</button>
              <button onClick={save} style={btnP}>{isEmiFlow?"Pay EMI":"Save Entry"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const LiabilityModal = ({ item, onClose }) => {
    const [name,setName]=useState(item?.name||"");
    const [type,setType]=useState(item?.type||liabilityTypeOptions[0]?.id||LIABILITY_TYPES[0].id);
    const [principal,setPrincipal]=useState(String(item?.principal ?? item?.outstanding ?? ""));
    const [outstanding,setOutstanding]=useState(String(item?.outstanding ?? item?.principal ?? ""));
    const [tenureMonths,setTenureMonths]=useState(String(item?.tenureMonths||""));
    const [emiAmount,setEmiAmount]=useState(String(item?.emiAmount||""));
    const [interestRate,setInterestRate]=useState(String(item?.interestRate||""));
    const [nextDue,setNextDue]=useState(item?.nextDue||todayStr());
    const [paymentAccId,setPaymentAccId]=useState(item?.paymentAccId || accounts.find(a=>a.type!=="cc")?.id || accounts[0]?.id || "");
    const [note,setNote]=useState(item?.note||"");
    const save=()=>{
      if(!name.trim()) return;
      const nextItem={
        ...(item||{}),
        id:item?.id||genId(),
        name:name.trim(),
        type,
        principal:Math.max(0, parseMoney(principal)||0),
        outstanding:Math.max(0, parseMoney(outstanding)||0),
        tenureMonths:Math.max(0, parseInt(tenureMonths||0,10) || 0),
        emiAmount:Math.max(0, parseMoney(emiAmount)||0),
        interestRate:Math.max(0, parseFloat(interestRate)||0),
        nextDue,
        paymentAccId,
        note:note.trim(),
      };
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
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <input style={inp} placeholder="Liability name" value={name} onChange={e=>setName(e.target.value)}/>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {liabilityTypeOptions.map(l=><Chip key={l.id} color={l.color} active={type===l.id} onClick={()=>setType(l.id)}>{l.icon} {l.name}</Chip>)}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div><span style={lbl}>Principal ({sym})</span><input style={inp} type="text" inputMode="decimal" value={principal||""} onChange={e=>setPrincipal(cleanMoneyInput(e.target.value))}/></div>
              <div><span style={lbl}>Outstanding ({sym})</span><input style={inp} type="text" inputMode="decimal" value={outstanding||""} onChange={e=>setOutstanding(cleanMoneyInput(e.target.value))}/></div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div><span style={lbl}>Tenure (months)</span><input style={inp} type="number" min="0" value={tenureMonths} onChange={e=>setTenureMonths(e.target.value)} placeholder="Optional"/></div>
              <div><span style={lbl}>EMI ({sym})</span><input style={inp} type="text" inputMode="decimal" value={emiAmount||""} onChange={e=>setEmiAmount(cleanMoneyInput(e.target.value))} placeholder="Optional"/></div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div><span style={lbl}>Interest %</span><input style={inp} type="number" min="0" step="0.01" value={interestRate} onChange={e=>setInterestRate(e.target.value)} placeholder="Optional"/></div>
              <div><span style={lbl}>Next Due</span><input style={inp} type="date" value={nextDue} onChange={e=>setNextDue(e.target.value)}/></div>
            </div>
            <div>
              <span style={lbl}>Repayment from</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {accounts.map(a=><button key={a.id} onClick={()=>setPaymentAccId(a.id)} style={{ background:paymentAccId===a.id?a.color+"22":"none",border:`1px solid ${paymentAccId===a.id?a.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,color:paymentAccId===a.id?a.color:T.sub,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>{accIcon(a.type)} {a.name}</button>)}
              </div>
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
      const nextItem={ id:item?.id||genId(), name:name.trim(), type, currentValue:parseMoney(currentValue)||0, note:note.trim() };
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
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <input style={inp} placeholder="Asset name" value={name} onChange={e=>setName(e.target.value)}/>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {ASSET_TYPES.map(a=><Chip key={a.id} color={a.color} active={type===a.id} onClick={()=>setType(a.id)}>{a.icon} {a.name}</Chip>)}
            </div>
            <div><span style={lbl}>Current Value ({sym})</span><input style={inp} type="text" inputMode="decimal" value={currentValue||""} onChange={e=>setCurrentValue(cleanMoneyInput(e.target.value))}/></div>
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

    const visibleLoans = loans.filter(loan=>!isCreditCardBackedLoan(loan));
    const activeGivenLoans = visibleLoans.filter(loan=>loan.direction!=="taken" && loan.status==="active" && Number(loan.outstanding||0)>0);
    const activeTakenLoans = visibleLoans.filter(loan=>loan.direction==="taken" && loan.status==="active" && Number(loan.outstanding||0)>0);

    const inlineSections = {
      banks: accounts.filter(a=>a.type==="bank" && !isInvestmentAccount(a)).map(a=>({
        id:a.id,
        title:a.name,
        meta:`Live ${sym}${fmt(effectiveAccountBalance(a.id))}${balanceCheckpoints[a.id]?.date?` · Gap ${accountReconciliationGap(a.id)>=0?"+":"−"}${sym}${fmt(Math.abs(accountReconciliationGap(a.id)))}`:""}`,
        value:`${sym}${fmt(effectiveAccountBalance(a.id))}`,
        color:effectiveAccountBalance(a.id)>=0?T.success:T.danger,
        onClick:()=>setShowAccDetail(a),
      })),
      cash: accounts.filter(a=>a.type==="cash" && !isInvestmentAccount(a)).map(a=>({
        id:a.id,
        title:a.name,
        meta:`Cash in hand ${sym}${fmt(accountBalance(a.id))}`,
        value:`${sym}${fmt(accountBalance(a.id))}`,
        color:accountBalance(a.id)>=0?T.success:T.danger,
        onClick:()=>setShowAccDetail(a),
      })),
      upi: accounts.filter(a=>a.type==="upi" && !isInvestmentAccount(a)).map(a=>({
        id:a.id,
        title:a.name,
        meta:`${a.handle||"UPI"} · ${sym}${fmt(accountBalance(a.id))}`,
        value:`${sym}${fmt(accountBalance(a.id))}`,
        color:accountBalance(a.id)>=0?T.success:T.danger,
        onClick:()=>setShowAccDetail(a),
      })),
      investments: investmentTypeSummaries.map(type=>({
        id:type.id,
        title:type.name.split("/")[0].trim(),
        meta:`${type.groupCount} ${type.groupCount===1?"holding":"holdings"}`,
        value:`${sym}${fmt(type.total)}`,
        color:type.color || T.info,
        onClick:()=>{ setSelectedInvestmentTypeView(type.id); setShowInvestments(true); },
      })),
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
        onClick:()=>setRepaymentLoan(loan),
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
                {item.onClick&&<div style={{ color:T.sub,fontSize:12 }}>›</div>}
              </div>
            </div>
          ))}
        </div>
      );
    };

    const assetBreakdownItems = [
      { label:"Cash in bank", value:cashBankTotal, color:T.success, icon:"🏦", mode:"banks" },
      { label:"Cash at hand", value:cashWalletTotal, color:T.success, icon:"🪙", mode:"cash" },
      { label:"UPI balance", value:upiTotal, color:T.success, icon:"📱", mode:"upi" },
      { label:"Investments", value:investmentAssetsTotal, color:T.info, icon:"📈", mode:"investments" },
      { label:"People owe you (dues)", value:directOwedToMe, color:T.accent, icon:"🤝", mode:"owed" },
      { label:"Loans given (tracked)", value:loanGivenTotal, color:T.accent, icon:"🫴", mode:"loanGiven" },
      { label:"Tracked assets", value:trackedAssetsTotal, color:T.purple, icon:"🏠", mode:"trackedAssets" },
    ];

    return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ ...card,background:`linear-gradient(135deg,${T.success}10,${T.card})` }}>
          <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>Net Worth</div>
          <div style={{ color:netWorthValue>=0?T.success:T.danger,fontSize:30,fontWeight:900,marginBottom:14 }}>{sym}{fmt(netWorthValue)}</div>
          {reconciledBankCount>0&&(
            <div style={{ background:Math.abs(reconciliationGapTotal)<0.01?T.success+"14":T.warn+"14",border:`1px solid ${Math.abs(reconciliationGapTotal)<0.01?T.success:T.warn}33`,borderRadius:10,padding:"8px 10px",marginBottom:12 }}>
              <div style={{ color:T.text,fontSize:11,fontWeight:800 }}>Bank reconciliation gap</div>
              <div style={{ color:Math.abs(reconciliationGapTotal)<0.01?T.success:T.warn,fontSize:11,marginTop:2 }}>
                {Math.abs(reconciliationGapTotal)<0.01
                  ? `All ${reconciledBankCount} reconciled bank account${reconciledBankCount===1?"":"s"} are matched.`
                  : `Live bank balances are ${reconciliationGapTotal>=0?"ahead of":"behind"} entered transactions by ${sym}${fmt(Math.abs(reconciliationGapTotal))}. Add missing txns to close this gap.`}
              </div>
            </div>
          )}
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
          <div style={{ color:T.text,fontSize:15,fontWeight:800,marginBottom:10 }}>Assets Breakdown</div>
          {assetBreakdownItems.map((item,idx)=>{
            const isOpen = showWealthBreakdown===item.mode;
            return (
              <div key={item.label} style={{ borderBottom:idx===assetBreakdownItems.length-1?"none":`1px solid ${T.border}` }}>
                <div onClick={()=>setShowWealthBreakdown(isOpen?null:item.mode)} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",cursor:"pointer" }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{item.icon} {item.label}</div>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <div style={{ color:item.value>=0?item.color:T.danger,fontSize:13,fontWeight:800 }}>{sym}{fmt(item.value)}</div>
                    <div style={{ color:T.sub,fontSize:12 }}>{isOpen?"▲":"▼"}</div>
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
            <div style={{ color:T.text,fontSize:15,fontWeight:800 }}>Manage Liabilities</div>
            <button onClick={()=>setShowAddLiability(true)} style={{ background:T.danger+"22",border:`1px solid ${T.danger}33`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.danger,fontFamily:"Nunito,sans-serif" }}>+ Add</button>
          </div>
          <div style={{ borderBottom:`1px solid ${T.border}` }}>
            <div onClick={()=>setShowWealthBreakdown(showWealthBreakdown==="cc"?null:"cc")} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",cursor:"pointer" }}>
              <div>
                <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>💳 Credit Card Debt</div>
                <div style={{ color:T.sub,fontSize:10 }}>{accounts.filter(a=>a.type==="cc").length} card(s)</div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ color:T.danger,fontSize:13,fontWeight:800 }}>{sym}{fmt(creditCardLiabilityTotal)}</div>
                <div style={{ color:T.sub,fontSize:12 }}>{showWealthBreakdown==="cc"?"▲":"▼"}</div>
              </div>
            </div>
            {showWealthBreakdown==="cc" && renderInlineBreakdown("cc")}
          </div>
          <div style={{ borderBottom:liabilities.length===0?"none":`1px solid ${T.border}` }}>
            <div onClick={()=>setShowWealthBreakdown(showWealthBreakdown==="loanTaken"?null:"loanTaken")} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",cursor:"pointer" }}>
              <div>
                <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>🤲 Loans Taken</div>
                <div style={{ color:T.sub,fontSize:10 }}>{activeTakenLoans.length} active loan(s)</div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ color:T.danger,fontSize:13,fontWeight:800 }}>{sym}{fmt(loanTakenTotal)}</div>
                <div style={{ color:T.sub,fontSize:12 }}>{showWealthBreakdown==="loanTaken"?"▲":"▼"}</div>
              </div>
            </div>
            {showWealthBreakdown==="loanTaken" && renderInlineBreakdown("loanTaken")}
          </div>
          {liabilities.length===0?<div style={{ color:T.sub,fontSize:12,paddingTop:10 }}>Add mortgages, student loans, car loans, tax dues, or any other debt here.</div>
            :liabilities.map((liability,idx)=>{
              const type=liabilityTypeOptions.find(x=>x.id===liability.type)||liabilityTypeOptions[liabilityTypeOptions.length-1]||LIABILITY_TYPES[LIABILITY_TYPES.length-1];
              const paymentAccount = liability.paymentAccId ? getAcc(liability.paymentAccId) : null;
              const liabilityMeta = [
                type.name,
                Number(liability.principal||0)>0 ? `principal ${sym}${fmt(liability.principal||0)}` : "",
                Number(liability.emiAmount||0)>0 ? `EMI ${sym}${fmt(liability.emiAmount||0)}` : "",
                Number(liability.interestRate||0)>0 ? `${fmt(liability.interestRate)}%` : "",
                liability.tenureMonths ? `${liability.tenureMonths} mo` : "",
                liability.nextDue ? `due ${liability.nextDue}` : "",
                paymentAccount?.name ? `from ${paymentAccount.name}` : "",
                liability.note || "",
              ].filter(Boolean).join(" · ");
              return <div key={liability.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:idx===liabilities.length-1?"none":`1px solid ${T.border}` }}>
                <div style={{ width:36,height:36,borderRadius:10,background:type.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>{type.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text,fontSize:13,fontWeight:700 }}>{liability.name}</div>
                  <div style={{ color:T.sub,fontSize:10 }}>{liabilityMeta}</div>
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
          meta:`Live ${sym}${fmt(effectiveAccountBalance(a.id))}${balanceCheckpoints[a.id]?.date?` · Gap ${accountReconciliationGap(a.id)>=0?"+":"−"}${sym}${fmt(Math.abs(accountReconciliationGap(a.id)))}`:""}`,
          value:`${sym}${fmt(effectiveAccountBalance(a.id))}`,
          color:effectiveAccountBalance(a.id)>=0?T.success:T.danger,
          onClick:()=>openAccount(a),
        }))
      },
      cash: {
        title:"🪙 Cash at hand",
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
        title:"📱 UPI balance",
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
        title:"📈 Investments",
        subtitle:"Type-wise breakup",
        items: investmentTypeSummaries.map(type=>({
          id:type.id,
          title:type.name.split("/")[0].trim(),
          meta:`${type.groupCount} ${type.groupCount===1?"holding":"holdings"}`,
          value:`${sym}${fmt(type.total)}`,
          color:type.color || T.info,
          onClick:()=>{ close(); setSelectedInvestmentTypeView(type.id); setShowInvestments(true); }
        }))
      },
      owed: {
        title:"🤝 People owe you (dues)",
        subtitle:"Simple receivables by person",
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
        title:"💳 Credit card breakup",
        subtitle:"Current due vs total outstanding",
        items: accounts.filter(a=>a.type==="cc").map(a=>{
          const summary = getCardSummary(a);
          return {
            id:a.id,
            title:a.name,
            meta:`Due now ${sym}${fmt(summary.currentDue)} · Unbilled ${sym}${fmt(summary.currentCycleSpend)} · Outstanding ${sym}${fmt(summary.totalOutstanding||0)}`,
            value:`${sym}${fmt(summary.totalOutstanding||0)}`,
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
            <button onClick={close} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
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
                    {item.onClick&&<div style={{ color:T.sub,fontSize:14 }}>›</div>}
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
    const [typeAddMode,setTypeAddMode]=useState("income");
    const [newAccountBaseType,setNewAccountBaseType]=useState("bank");
    const [newAccountBucket,setNewAccountBucket]=useState("cash");
    const [newBehaviorLabel,setNewBehaviorLabel]=useState("");
    const [newBehaviorIcon,setNewBehaviorIcon]=useState("");
    const allBaseBehaviors = [...ACC_TYPES, ...customBaseBehaviors];
    const [openGuide,setOpenGuide]=useState(null);

    const lockAppNow = () => {
      setSettingsSection(null);
      setShowSettings(false);
      setShowWealthPin(false);
      setWealthUnlocked(false);
      onLock();
    };

    const filteredIcons=iconSearch?CAT_ICONS.filter(ic=>ic.includes(iconSearch)):CAT_ICONS;
    const parseAccountTypeNames = value => Array.from(new Set(
      String(value ?? "")
        .split(/[\n,]+/)
        .map(item=>String(item || "").trim())
        .filter(Boolean)
    ));
    const addAccountTypes = () => {
      const names = parseAccountTypeNames(newIncomeTypeInput);
      if(!names.length) return;
      const baseMeta = allBaseBehaviors.find(item=>item.id===newAccountBaseType) || ACC_TYPES[0];
      const bucket = baseMeta.id==="cc" ? "liability" : newAccountBucket;
      setAccountTypes(prev=>normalizeAccountTypes([
        ...prev,
        ...names.map(label=>({
          id:normalizeIncomeTypeValue(label),
          label,
          icon:baseMeta.icon,
          baseType:baseMeta.id,
          bucket,
          custom:true,
        }))
      ]));
      setNewIncomeTypeInput("");
    };
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
    const parseLiabilityTypeNames = value => Array.from(new Set(
      String(value ?? "")
        .split(/[\n,]+/)
        .map(item=>String(item || "").trim())
        .filter(Boolean)
    ));
    const addLiabilityTypes = () => {
      const names = parseLiabilityTypeNames(newIncomeTypeInput);
      if(!names.length) return;
      setCustomLiabilityTypes(prev=>normalizeLiabilityTypes([
        ...prev,
        ...names.map(name=>({ name, icon:"🧾", color:"#ef4444", custom:true }))
      ]));
      setNewIncomeTypeInput("");
    };
    const handleTypeAdd = () => {
      if(typeAddMode === "account"){
        addAccountTypes();
        return;
      }
      if(typeAddMode === "liability"){
        addLiabilityTypes();
        return;
      }
      addIncomeTypes();
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
    const startCategoryRename = cat => {
      setEditingCategoryId(cat.id);
      setEditingCategoryName(cat.name||"");
    };
    const saveCategoryRename = categoryId => {
      const nextName = String(editingCategoryName||"").trim();
      if(!nextName) return;
      setCats(prev=>prev.map(cat=>cat.id===categoryId ? { ...cat, name:nextName } : cat));
      setEditingCategoryId(null);
      setEditingCategoryName("");
    };

    const Row=({ icon,title,subtitle,onClick,right })=>(
      <div onClick={onClick} style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:`1px solid ${T.border}`,cursor:onClick?"pointer":"default" }}>
        <div style={{ width:36,height:36,borderRadius:10,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{icon}</div>
        <div style={{ flex:1 }}>
          <div style={{ color:T.text,fontSize:14,fontWeight:600 }}>{title}</div>
          {subtitle&&<div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{subtitle}</div>}
        </div>
        {right||(onClick&&<div style={{ color:T.sub,fontSize:16 }}>›</div>)}
      </div>
    );

    const Toggle=({ val,fn })=>(
      <div onClick={fn} style={{ width:44,height:24,borderRadius:12,background:val?T.accent:T.border,position:"relative",cursor:"pointer",flexShrink:0,transition:"background 0.2s" }}>
        <div style={{ position:"absolute",top:2,left:val?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s" }}/>
      </div>
    );

    if(["types","income_types","liabilities"].includes(settingsSection)) return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>←</button>
          <div style={{ color:T.text,fontSize:18,fontWeight:900,flex:1 }}>Account, Income & Liability Types</div>
          <button onClick={handleTypeAdd} style={{ ...btnP,width:"auto",padding:"8px 14px" }}>+ Add</button>
        </div>
        <div style={{ ...card,marginBottom:12 }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 160px",gap:8,marginBottom:12 }}>
            <input
              style={inp}
              placeholder={typeAddMode==="account" ? "Name e.g. Salary Account, Wallet" : typeAddMode==="income" ? "Name e.g. Bonus, Freelance" : "Name e.g. Home Loan, Shop Credit"}
              value={newIncomeTypeInput}
              onChange={e=>setNewIncomeTypeInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); handleTypeAdd(); } }}
            />
            <select style={lightSelect} value={typeAddMode} onChange={e=>setTypeAddMode(e.target.value)}>
              <option value="account">Account type</option>
              <option value="income">Income type</option>
              <option value="liability">Liability type</option>
            </select>
          </div>
          <div style={{ color:T.sub,fontSize:10,marginBottom:12 }}>
            {typeAddMode==="account"
              ? "Add an account type here, choose its base behavior and whether it should sit under cash or investments, then it will appear in Manage Accounts → Add Account."
              : "Enter the name, choose whether it is an income type or liability type, then tap + Add."}
          </div>
          {typeAddMode==="account"&&<div style={{ marginBottom:14 }}>
            <div style={{ color:T.text,fontSize:12,fontWeight:800,marginBottom:8 }}>Base behavior</div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:6 }}>
              {allBaseBehaviors.map(type=>(
                <span key={type.id} style={{ display:"inline-flex",alignItems:"center",gap:4 }}>
                  <Chip color={T.info} active={newAccountBaseType===type.id} onClick={()=>setNewAccountBaseType(type.id)}>{type.icon} {type.label}</Chip>
                  {type.isCustom&&<button onClick={()=>{setCustomBaseBehaviors(prev=>prev.filter(b=>b.id!==type.id));if(newAccountBaseType===type.id)setNewAccountBaseType("bank");}} style={{ background:"none",border:"none",cursor:"pointer",color:T.sub,fontSize:10,padding:"0 2px" }} title="Remove">✕</button>}
                </span>
              ))}
            </div>
            <div style={{ display:"flex",gap:6,marginBottom:10,alignItems:"center" }}>
              <input style={{ ...inp,flex:0.5,marginBottom:0,padding:"5px 8px",fontSize:12 }} placeholder="emoji" maxLength={2} value={newBehaviorIcon} onChange={e=>setNewBehaviorIcon(e.target.value)}/>
              <input style={{ ...inp,flex:1,marginBottom:0,padding:"5px 8px",fontSize:12 }} placeholder="New behavior name e.g. Crypto, BNPL" value={newBehaviorLabel} onChange={e=>setNewBehaviorLabel(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&newBehaviorLabel.trim()){ e.preventDefault(); const id=normalizeIncomeTypeValue(newBehaviorLabel); setCustomBaseBehaviors(prev=>[...prev,{id,label:newBehaviorLabel.trim(),icon:newBehaviorIcon.trim()||"💰",isCustom:true}]); setNewBehaviorLabel(""); setNewBehaviorIcon(""); } }}/>
              <button onClick={()=>{ if(!newBehaviorLabel.trim()) return; const id=normalizeIncomeTypeValue(newBehaviorLabel); setCustomBaseBehaviors(prev=>[...prev,{id,label:newBehaviorLabel.trim(),icon:newBehaviorIcon.trim()||"💰",isCustom:true}]); setNewBehaviorLabel(""); setNewBehaviorIcon(""); }} style={{ background:T.accent,border:"none",color:"#000",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:800,fontFamily:"Nunito,sans-serif",whiteSpace:"nowrap" }}>+ Behavior</button>
            </div>
            {newAccountBaseType!=="cc"&&<>
              <div style={{ color:T.text,fontSize:12,fontWeight:800,marginBottom:8 }}>Show this under</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                <Chip color={T.success} active={newAccountBucket==="cash"} onClick={()=>setNewAccountBucket("cash")}>💵 Cash / Spending</Chip>
                <Chip color={T.purple} active={newAccountBucket==="investment"} onClick={()=>setNewAccountBucket("investment")}>📈 Investment / Wealth</Chip>
              </div>
            </>}
          </div>}

          <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:10 }}>Account types</div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:14 }}>
            {accountTypeOptions.map(type=>{
              const count = accounts.filter(account=>String(account.accountTypeId||account.type)===String(type.id)).length;
              return (
                <span key={type.id} style={{ background:T.info+"18",color:T.info,borderRadius:20,padding:"5px 10px",fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:6 }}>
                  <span>{type.icon}</span>
                  <span>{type.label}</span>
                  <span style={{ color:T.sub,fontSize:10 }}>({count})</span>
                  <span style={{ color:T.sub,fontSize:10 }}>{type.custom ? accLabel(type.baseType) : "default"}</span>
                  <span style={{ color:T.sub,fontSize:10 }}>{accountBucketLabel(type.bucket)}</span>
                  {type.custom&&<button onClick={()=>setAccountTypes(prev=>prev.filter(item=>item.id!==type.id))} style={{ background:"none",border:"none",cursor:"pointer",color:T.sub,fontSize:10,padding:0 }}>✕</button>}
                </span>
              );
            })}
          </div>

          <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:10 }}>Income types</div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:14 }}>
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
                    <button onClick={()=>setIncomeTypes(prev=>prev.filter(item=>item!==type))} style={{ background:"none",border:"none",cursor:"pointer",color:T.sub,fontSize:10,padding:0 }}>✕</button>
                  )}
                </span>
              );
            })}
          </div>

          <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:10 }}>Liability types</div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {liabilityTypeOptions.map(type=>(
              <span key={type.id} style={{ background:type.color+"18",color:type.color,borderRadius:20,padding:"5px 10px",fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:6 }}>
                <span>{type.icon}</span>
                <span>{type.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    );

    if(settingsSection==="investments") return (
      <div style={{ padding:"14px 0 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"0 16px 16px" }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>←</button>
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

    if(settingsSection==="vehicles") return (()=>{
      const VEHICLE_TYPES=[{id:"car",label:"Car",icon:"🚗"},{id:"bike",label:"Bike",icon:"🏍️"},{id:"truck",label:"Truck",icon:"🚛"},{id:"auto",label:"Auto",icon:"🛺"},{id:"other",label:"Other",icon:"🚘"}];
      const openNew=()=>{ setEditingVehicle("new"); setVType("car"); setVNumber(""); setVName(""); setVColor(PALETTE[2]); };
      const openEdit=v=>{ setEditingVehicle(v.id); setVType(v.type||"car"); setVNumber(v.number||""); setVName(v.name||""); setVColor(v.color||PALETTE[2]); };
      const saveVehicle=()=>{
        if(!vNumber.trim()) return;
        if(editingVehicle==="new"){
          setVehicles(prev=>[...prev,{id:genId(),type:vType,number:vNumber.trim().toUpperCase(),name:vName.trim(),color:vColor}]);
        } else {
          setVehicles(prev=>prev.map(v=>v.id===editingVehicle?{...v,type:vType,number:vNumber.trim().toUpperCase(),name:vName.trim(),color:vColor}:v));
        }
        setEditingVehicle(null);
      };
      return (
        <div style={{ padding:"14px 16px 0" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
            <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>←</button>
            <div style={{ color:T.text,fontSize:18,fontWeight:900,flex:1 }}>Vehicles</div>
            <button onClick={openNew} style={{ background:T.accent,border:"none",color:"#000",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>+ Add</button>
          </div>
          {editingVehicle&&(
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:14,marginBottom:16 }}>
              <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:12 }}>{editingVehicle==="new"?"New Vehicle":"Edit Vehicle"}</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
                {VEHICLE_TYPES.map(vt=>(
                  <button key={vt.id} onClick={()=>setVType(vt.id)} style={{ background:vType===vt.id?T.accent+"22":"none",border:`1px solid ${vType===vt.id?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,color:vType===vt.id?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{vt.icon} {vt.label}</button>
                ))}
              </div>
              <input style={inp} placeholder="Registration number e.g. KA 05 AB 1234" value={vNumber} onChange={e=>setVNumber(e.target.value.toUpperCase())}/>
              <input style={inp} placeholder="Nickname (optional)" value={vName} onChange={e=>setVName(e.target.value)}/>
              <div style={{ color:T.sub,fontSize:11,marginBottom:8 }}>Colour</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>
                {PALETTE.map(c=><button key={c} onClick={()=>setVColor(c)} style={{ width:24,height:24,borderRadius:"50%",background:c,border:`2px solid ${vColor===c?T.text:"transparent"}`,cursor:"pointer" }}/>)}
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={saveVehicle} style={{ background:T.accent,border:"none",color:"#000",borderRadius:8,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:800,fontFamily:"Nunito,sans-serif",flex:1 }}>Save</button>
                <button onClick={()=>setEditingVehicle(null)} style={{ background:"none",border:`1px solid ${T.border}`,color:T.sub,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13,fontFamily:"Nunito,sans-serif" }}>Cancel</button>
              </div>
            </div>
          )}
          {vehicles.length===0&&!editingVehicle&&(
            <div style={{ textAlign:"center",color:T.sub,fontSize:13,padding:"40px 0" }}>
              <div style={{ fontSize:36,marginBottom:8 }}>🚗</div>
              <div>No vehicles yet.</div>
              <div style={{ fontSize:11,marginTop:4 }}>Add a vehicle to tag fuel, PUC and insurance expenses.</div>
            </div>
          )}
          {vehicles.map(v=>{
            const vt=VEHICLE_TYPES.find(x=>x.id===v.type)||VEHICLE_TYPES[0];
            const txnCount=txns.filter(t=>t.vehicleId===v.id).length;
            return (
              <div key={v.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ width:40,height:40,borderRadius:10,background:v.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{vt.icon}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ color:T.text,fontSize:14,fontWeight:800 }}>{v.number}</div>
                  {v.name&&<div style={{ color:T.sub,fontSize:11 }}>{v.name}</div>}
                  <div style={{ color:T.sub,fontSize:10 }}>{vt.label} · {txnCount} txn{txnCount===1?"":"s"}</div>
                </div>
                <button onClick={()=>openEdit(v)} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,color:T.sub,fontFamily:"Nunito,sans-serif" }}>Edit</button>
                <button onClick={()=>setVehicles(prev=>prev.filter(x=>x.id!==v.id))} style={{ background:"none",border:`1px solid ${T.danger}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:12,color:T.danger,fontFamily:"Nunito,sans-serif" }}>✕</button>
              </div>
            );
          })}
        </div>
      );
    })();

    if(settingsSection==="accounts") return (
      <div style={{ padding:"14px 0 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"0 16px 16px" }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>←</button>
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
                  const bal=a.type==="cc"?null:(a.type==="bank" ? effectiveAccountBalance(a.id) : accountBalance(a.id));
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
                                const gap = accountReconciliationGap(a.id);
                                return <div style={{ color:Math.abs(gap)<0.01?T.success:T.warn,fontSize:10,marginTop:2 }}>Actual {formatShortDate(balanceCheckpoints[a.id].date)} · {Math.abs(gap)<0.01?"Matched":`Gap ${gap>=0?"+":"−"}${sym}${fmt(Math.abs(gap))}`}</div>;
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
                          }} style={{ background:T.info+"22",border:`1px solid ${T.info}33`,borderRadius:8,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.info,fontFamily:"Nunito,sans-serif" }}>📍 Balance</button>}
                          <button onClick={e=>{e.stopPropagation();setEditingAccount(a);}} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>✏️ Edit</button>
                          <button onClick={e=>{e.stopPropagation();setConfirmDeleteAccount(a.id);}} style={{ background:"none",border:"none",color:T.danger,fontSize:14,cursor:"pointer" }}>🗑</button>
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

    if(settingsSection==="releasenotes") return (
      <div style={{ padding:"0 0 80px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18 }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:18,fontFamily:"Nunito,sans-serif" }}>←</button>
          <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>🚀 Release Notes</div>
        </div>
        <div style={{ background:T.accent+"16",border:`1px solid ${T.accent}33`,borderRadius:12,padding:"10px 14px",marginBottom:16 }}>
          <div style={{ color:T.accent,fontSize:12,fontWeight:800 }}>Current: {APP_VERSION}</div>
          <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>Auto-deployed from GitHub → Vercel</div>
        </div>
        {[
          { month:"July 2026 - Sprint 3", items:[
            "Lock mode (lock button) - tap to lock app, PIN to unlock, 5-attempt lockout",
            "Masking (eye button) - hide all amounts, PIN to reveal for 60 seconds",
            "Budget carry forward - surplus/deficit from last month rolls over",
            "Per-person budgets - set monthly budget per person with progress bar",
            "Financial Health Dashboard - runway months, essential vs discretionary",
            "B10 fixed - To Receive now carries forward all unsettled debts from all time",
            "Settlement fixed - person balance updates correctly after income settlement",
            "TXN type jumping fixed - SMS parse no longer overrides manual type",
            "SMS Paste button - one tap clipboard paste, no more 3-tap dance",
            "Transaction detail view - tap any transaction to see full details",
            "Debt transfer - move a persons debt to another person or group",
            "Duplicate transaction warning - same amount + account within 5 minutes",
            "SIP recurring schedule on folio - set day, amount, account per investment",
            "SIP snooze - snooze reminders by 1 day",
            "Membership expiry alerts on Home - 7 day warning + lapsed notification",
            "Guest person - one-time person with amount badge on transaction card",
            "Idle timer - 5 min before warning, 2 min to respond (was 60s)",
            "PIN lockout - 5 wrong attempts locks for 30 minutes",
            "Group type editing on existing groups",
            "Transaction search in TXNS tab",
          ]},
          { month:"June 2026 - Sprint 2", items:[
            "Bills tab redesigned with PhonePe-style grid and 35 biller types with icons",
            "Membership system: recharge model per person, grace days, active/lapsed status",
            "Fee payments: multi-month school/education fee distribution",
            "Transaction link to biller: optional, non-intrusive",
            "Privacy mode: income/savings hidden with PIN to reveal for 60 seconds",
            "Exclude from Net Worth: per account toggle (e.g. Vyom Wallet)",
            "Bill period dates: From/To for utility bills",
            "Split fixes: 0 and decimal now work, clearing first amount no longer resets others",
            "Auto-generate next bill no longer resets bill date to payment date",
            "Cloud sync: GitHub + Vercel auto-deploy, Supabase auth working",
            "Bugs fixed: B6 B8 B9 B11 B12 B13 B14 B15 B16",
          ]},
          { month:"April/May 2026", items:[
            "Cloud sync infrastructure: Supabase auto-sync on every change",
            "Biller Accounts: consumer number, type, attribution",
            "Bills tab: My Bills + Bill History tabs",
            "Auto-generate next bill on payment with pause/resume",
            "Items UI: bottom-sheet redesign",
            "CC refund reduces outstanding (B1 B1a B1b)",
            "To Receive merged per person: splits + loans",
          ]},
        ].map(section=>(
          <div key={section.month} style={{ marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:8 }}>{section.month}</div>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {section.items.map((item,i)=>(
                <div key={i} style={{ display:"flex",gap:8,alignItems:"flex-start" }}>
                  <span style={{ color:T.success,fontSize:12 }}>✅</span>
                  <span style={{ color:T.sub,fontSize:12,lineHeight:1.4 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );

    if(settingsSection==="cloudsync") return (
      <div style={{ padding:"0 0 80px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18 }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:18,fontFamily:"Nunito,sans-serif" }}>←</button>
          <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>Cloud Sync & Account</div>
        </div>
        {cloudUser ? (
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ background:T.success+"16",border:`1px solid ${T.success}33`,borderRadius:14,padding:"14px 16px" }}>
              <div style={{ color:T.success,fontSize:13,fontWeight:800 }}>✅ Signed in</div>
              <div style={{ color:T.sub,fontSize:12,marginTop:4 }}>{cloudUser.email}</div>
              {lastSyncedAt&&<div style={{ color:T.sub,fontSize:10,marginTop:4 }}>Last synced: {formatBackupStamp(lastSyncedAt)}</div>}
            </div>
            <div style={{ background:T.card,borderRadius:14,padding:"14px 16px" }}>
              <div style={{ color:T.text,fontSize:13,fontWeight:700,marginBottom:6 }}>Auto-syncing across devices</div>
              <div style={{ color:T.sub,fontSize:11 }}>Every change saves to cloud automatically. Sign in on any device to access your data.</div>
            </div>
            <button onClick={()=>pullCloudSnapshot()} disabled={cloudBusy} style={{ background:T.accent+"22",border:`1px solid ${T.accent}44`,borderRadius:14,padding:"13px",cursor:"pointer",fontSize:13,fontWeight:800,color:T.accent,fontFamily:"Nunito,sans-serif" }}>{cloudBusy?"🔄 Syncing...":"🔄 Sync Now"}</button>
            <button onClick={handleCloudSignOut} disabled={cloudBusy} style={{ background:"none",border:`1px solid ${T.danger}44`,borderRadius:14,padding:"13px",cursor:"pointer",fontSize:13,fontWeight:800,color:T.danger,fontFamily:"Nunito,sans-serif" }}>Sign Out</button>
            {cloudStatus&&<div style={{ color:T.sub,fontSize:11,textAlign:"center",marginTop:4 }}>{cloudStatus}</div>}
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ background:T.card,borderRadius:14,padding:"14px 16px" }}>
              <div style={{ color:T.text,fontSize:13,fontWeight:700,marginBottom:6 }}>Sign in to sync across devices</div>
              <div style={{ color:T.sub,fontSize:11 }}>Data stored safely in cloud. Sign in on any device to restore everything instantly.</div>
            </div>
            <input style={{ background:T.input,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",color:T.text,fontSize:14,fontFamily:"Nunito,sans-serif",outline:"none" }} type="email" placeholder="Email address" autoComplete="email" autoCapitalize="none" value={syncEmail} onChange={e=>setSyncEmail(e.target.value)}/>
            <input style={{ background:T.input,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",color:T.text,fontSize:14,fontFamily:"Nunito,sans-serif",outline:"none" }} type="password" placeholder="Password" autoComplete="new-password" value={syncPassword} onChange={e=>setSyncPassword(e.target.value)}/>
            <button onClick={()=>handleCloudAuth("signin")} disabled={cloudBusy||!syncEmail||!syncPassword} style={{ background:T.accent,border:"none",borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:"#000",fontFamily:"Nunito,sans-serif" }}>{cloudBusy?"Please wait...":"Sign In"}</button>
            <button onClick={()=>handleCloudAuth("signup")} disabled={cloudBusy||!syncEmail||!syncPassword} style={{ background:"none",border:`1px solid ${T.accent}44`,borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:T.accent,fontFamily:"Nunito,sans-serif" }}>{cloudBusy?"Please wait...":"Create Account"}</button>
            {cloudStatus&&<div style={{ color:cloudStatus.includes("failed")||cloudStatus.includes("error")?T.danger:T.sub,fontSize:11,textAlign:"center" }}>{cloudStatus}</div>}
          </div>
        )}
      </div>
    );

    if(settingsSection==="backup") return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>←</button>
          <div style={{ color:T.text,fontSize:18,fontWeight:900,flex:1 }}>Backup & Restore</div>
        </div>
        <div style={{ ...card,marginBottom:12 }}>
          <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:8 }}>Manual backup file</div>
          <div style={{ color:T.sub,fontSize:11,marginBottom:12 }}>Download a JSON copy before major changes or when moving devices, then restore it anytime on web or desktop.</div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            <button onClick={downloadBackupFile} style={{ ...btnP,width:"auto",padding:"8px 14px" }}>⬇ Download backup</button>
            <label style={{ background:T.info+"18",border:`1px solid ${T.info}33`,color:T.info,borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>
              ⬆ Restore backup
              <input ref={backupFileInputRef} type="file" accept=".json,application/json" style={{ display:"none" }} onChange={e=>restoreBackupFile(e.target.files?.[0] || null)}/>
            </label>
            <button onClick={shareBackupToDrive} style={{ background:T.success+"18",border:`1px solid ${T.success}33`,color:T.success,borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>☁ Google Drive export</button>
          </div>
          {backupStatus&&<div style={{ background:T.input,border:`1px solid ${backupStatus.toLowerCase().includes("failed") ? T.danger+"33" : T.border}`,borderRadius:10,padding:"10px 12px",marginTop:12,color:backupStatus.toLowerCase().includes("failed") ? T.danger : T.success,fontSize:11,fontWeight:700 }}>{backupStatus}</div>}
        </div>
        <div style={{ ...card,marginBottom:12 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8 }}>
            <div>
              <div style={{ color:T.text,fontSize:14,fontWeight:800 }}>Automatic scheduled backup</div>
              <div style={{ color:T.sub,fontSize:11,marginTop:4 }}>Keep recent rolling backups on this device without exporting manually every time.</div>
            </div>
            <Toggle val={autoBackupEnabled} fn={()=>setAutoBackupEnabled(v=>!v)}/>
          </div>
          {autoBackupEnabled ? <>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
              {[ ["hourly","Hourly"], ["daily","Daily"], ["weekly","Weekly"] ].map(([value,label])=><Chip key={value} color={T.purple} active={autoBackupFrequency===value} onClick={()=>setAutoBackupFrequency(value)}>{label}</Chip>)}
            </div>
            <div style={{ color:T.sub,fontSize:10,marginBottom:10 }}>
              Latest auto backup: {autoBackups[0]?.exportedAt ? formatBackupStamp(autoBackups[0].exportedAt) : "Will be created after your next change"}
            </div>
            {autoBackups.length===0 ? (
              <div style={{ color:T.sub,fontSize:10 }}>No auto backups yet.</div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {autoBackups.slice(0,3).map(item=><div key={item.id} style={{ background:T.input,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                  <div>
                    <div style={{ color:T.text,fontSize:11,fontWeight:800 }}>{formatBackupStamp(item.exportedAt || item.snapshot?.savedAt || "") || "Recent backup"}</div>
                    <div style={{ color:T.sub,fontSize:10 }}>{Array.isArray(item.snapshot?.txns) ? item.snapshot.txns.length : 0} txns · {Array.isArray(item.snapshot?.accounts) ? item.snapshot.accounts.length : 0} accounts</div>
                  </div>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    <button onClick={()=>{ try{ restoreBackupSnapshot(item.snapshot, `auto backup from ${formatBackupStamp(item.exportedAt || item.snapshot?.savedAt || "") || "recent backup"}`); } catch(err){ setBackupStatus(`Restore failed: ${err.message}`); } }} style={{ background:T.info+"18",border:`1px solid ${T.info}33`,color:T.info,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>Restore</button>
                    <button onClick={()=>{ try{ downloadBackupPayload(buildBackupPayload(item.snapshot, "auto", item.exportedAt || item.snapshot?.savedAt || new Date().toISOString()), "arth-auto-backup"); setBackupStatus(`Backup downloaded · ${formatBackupStamp(item.exportedAt || item.snapshot?.savedAt || "")}`); } catch(err){ setBackupStatus(`Backup failed: ${err.message}`); } }} style={{ background:"none",border:`1px solid ${T.border}`,color:T.sub,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>Download</button>
                  </div>
                </div>)}
              </div>
            )}
          </> : <div style={{ color:T.sub,fontSize:10 }}>Turn this on to keep a rolling history of automatic backups on this device.</div>}
        </div>
        <div style={{ ...card,marginBottom:12 }}>
          <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:8 }}>What gets included</div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
            {[
              `${txns.length} txns`,
              `${accounts.length} accounts`,
              `${cats.length} categories`,
              `${people.filter(p=>!p.isMe).length} people`,
              `${bills.length} bills`,
              `${investments.length} investments`
            ].map(label=><span key={label} style={{ background:T.accentSoft,border:`1px solid ${T.accent}22`,borderRadius:999,padding:"4px 10px",fontSize:10,fontWeight:700,color:T.accent }}>{label}</span>)}
          </div>
          <div style={{ color:T.sub,fontSize:10 }}>Also includes liabilities, loans, wealth assets, budgets, layout preferences, and backup settings. Your PIN stays only on this device and is not included in the backup file.</div>
        </div>
      </div>
    );

    if(settingsSection==="security") return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>←</button>
          <div style={{ color:T.text,fontSize:18,fontWeight:900,flex:1 }}>Security</div>
        </div>
        <div style={{ ...card,marginBottom:12 }}>
          <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:8 }}>App PIN</div>
          <div style={{ color:T.sub,fontSize:11,marginBottom:12 }}>Your app is protected by a 4-digit PIN. Change it here or lock Arth immediately.</div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            <button onClick={()=>setSettingsSection("security_pin_change")} style={{ ...btnP,width:"auto",padding:"8px 14px" }}>Change PIN</button>
            <button onClick={lockAppNow} style={{ background:T.danger+"18",border:`1px solid ${T.danger}33`,color:T.danger,borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:800,fontFamily:"Nunito,sans-serif" }}>Lock now</button>
          </div>
        </div>
        <div style={{ ...card }}>
          <div style={{ color:T.text,fontSize:13,fontWeight:800,marginBottom:6 }}>Auto-lock behavior</div>
          <div style={{ color:T.sub,fontSize:11,lineHeight:1.6 }}>Arth warns after 60s of inactivity and locks 90s later. Switching apps won't lock immediately — tap "Stay active" when the warning appears to reset the timer.</div>
        </div>
      </div>
    );

    if(settingsSection==="security_pin_change") return (
      <PinScreen
        isSetup
        onCancel={()=>setSettingsSection("security")}
        onUnlock={async pin=>{
          const hash = await hashPin(pin);
          localStorage.setItem("arth_pin",hash);
          setAppPin(hash);
          setSettingsSection("security");
        }}
      />
    );

    if(settingsSection==="guides"){
      const GUIDES = [
        { section:"Adding Transactions", items:[
          { title:"SMS Import", body:"Web: copy the bank SMS first, then tap the SMS box — it auto-reads from clipboard. Android app: just tap the box to pull the latest SMS directly. You can also paste manually. Tapping again when SMS is already filled lets you edit without overriding." },
          { title:"Transaction Reference / UTR", body:"Arth auto-extracts UTR, RRN, Txn ID, UPI Ref, IMPS/NEFT reference numbers from an imported SMS and fills the Ref field automatically." },
          { title:"EMI & Credit Card", body:"You can pick a credit card as the repayment account for an EMI. Arth shifts that payment into card outstanding and excludes it from double-counting when you later pay the card bill." },
          { title:"Income Types", body:"To add a custom income type go to Settings → Account, Income & Liability Types. Categories and subcategories are managed separately under Manage Categories." },
          { title:"SMS Balance Sync", body:"When you import an SMS that contains an available balance, Arth compares it to the computed account balance and auto-adjusts the opening balance so the two match." },
        ]},
        { section:"Tagging & Splitting", items:[
          { title:"Tag → Person (Me)", body:"Choose 'Me' for personal spends like grooming or gym. Choose a group alone when the full amount is owed collectively by the group." },
          { title:"Tag → Person — spend tracking", body:"Tagging to a person does NOT mean they owe you money. It only tracks what you spent on them. Use Split mode if you want to track a debt." },
          { title:"Tag → Both (personal + group)", body:"Use Both when a single bill covers your personal share and a group's share. Enter each portion — the two should add up to the total." },
          { title:"Tag → Itemize", body:"Use Itemize when one purchase has multiple destinations (e.g. an Amazon order with items for different people or groups). Tap 👤/👥 on each row to switch between person and group." },
          { title:"Split — Amount mode", body:"In Amount mode each person's field has a cap equal to the bill minus what others have already been assigned. The split total and your implicit share both turn red if the entries exceed the bill." },
        ]},
        { section:"Settlements", items:[
          { title:"Refund vs Repayment", body:"Refund: use when a merchant returns money against a previous expense — Arth will try to link it to the original transaction. Repayment: use when a person pays you back for money you lent or split." },
          { title:"Overpayment / Advance", body:"If the amount received is more than what was due, the extra is moved to 'You Owe' as an advance that offsets the person's future dues." },
          { title:"Refund back to card", body:"If a merchant refund came back to a credit card, select that same credit card as the destination so the card liability reduces correctly." },
        ]},
        { section:"Investments", items:[
          { title:"Mutual Funds / SIP — NAV", body:"Record the latest NAV (Net Asset Value) per unit. Arth uses this to compute your current portfolio value alongside the number of units held." },
          { title:"Stocks", body:"Track how many shares or units were purchased. Update the current price periodically to keep portfolio value accurate." },
          { title:"PPF / NPS", body:"Tracked by contribution amount — no NAV required. Record contributions as a Transfer into your PPF/NPS account." },
          { title:"Fixed Deposit", body:"Tracked by deposit value — no NAV required. Record the deposit as a Transfer into your FD account." },
        ]},
        { section:"Transactions List", items:[
          { title:"Sort — Latest", body:"Orders by the time the transaction was recorded in Arth, newest first. Useful when you add past transactions and want the most recently added ones at the top." },
          { title:"Sort — By date", body:"Orders strictly by the transaction date, ignoring when it was entered into Arth." },
          { title:"Sort — High ₹ / Low ₹", body:"Orders by transaction amount. Useful for quickly spotting your biggest or smallest spends." },
        ]},
      ];
      return (
        <div style={{ padding:"14px 16px 40px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}>
            <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>←</button>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>User Guides</div>
          </div>
          {GUIDES.map(group=>(
            <div key={group.section} style={{ marginBottom:20 }}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,marginBottom:8 }}>{group.section}</div>
              <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }}>
                {group.items.map((item,idx)=>{
                  const key=group.section+item.title;
                  const open=openGuide===key;
                  return (
                    <div key={item.title} style={{ borderTop:idx>0?`1px solid ${T.border}`:"none" }}>
                      <button onClick={()=>setOpenGuide(open?null:key)} style={{ width:"100%",background:"none",border:"none",padding:"13px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"Nunito,sans-serif",textAlign:"left" }}>
                        <span style={{ color:T.text,fontSize:13,fontWeight:700 }}>{item.title}</span>
                        <span style={{ color:T.sub,fontSize:12,marginLeft:8,flexShrink:0 }}>{open?"▲":"▼"}</span>
                      </button>
                      {open&&<div style={{ color:T.sub,fontSize:12,lineHeight:1.6,padding:"0 16px 14px" }}>{item.body}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if(settingsSection==="budget") return <BudgetPage embedded onBack={()=>setSettingsSection(null)} />;

    if(settingsSection==="categories") return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
          <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>←</button>
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
                  {editingCategoryId===cat.id ? (
                    <div style={{ display:"flex",gap:6,alignItems:"center",marginBottom:6 }}>
                      <input
                        style={{ ...inpSm,flex:1 }}
                        value={editingCategoryName}
                        onChange={e=>setEditingCategoryName(e.target.value)}
                        onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); saveCategoryRename(cat.id); } }}
                        autoFocus
                      />
                      <button onClick={()=>saveCategoryRename(cat.id)} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:10,color:T.accent,fontFamily:"Nunito,sans-serif",fontWeight:700 }}>Save</button>
                    </div>
                  ) : (
                    <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{cat.name} {cat.fixed?"🔒":"🔓"}</div>
                  )}
                  <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
                    <span style={{ color:T.sub,fontSize:11 }}>{cat.subs?.length||0} subs</span>
                    <button onClick={()=>{ const el=document.getElementById("catbudget_"+cat.id); if(el) el.style.display=el.style.display==="none"?"flex":"none"; }} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:10,color:T.accent,fontFamily:"Nunito,sans-serif" }}>₹ {cat.budget>0?fmt(cat.budget):"Set budget"}</button>
                    <button onClick={()=>setCats(p=>p.map(c=>c.id===cat.id?{...c,fixed:!c.fixed}:c))} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:10,color:T.sub,fontFamily:"Nunito,sans-serif" }}>{cat.fixed?"Fixed":"Flexible"}</button>
                    {editingCategoryId===cat.id ? (
                      <button onClick={()=>{ setEditingCategoryId(null); setEditingCategoryName(""); }} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:10,color:T.sub,fontFamily:"Nunito,sans-serif" }}>Cancel</button>
                    ) : (
                      <button onClick={()=>startCategoryRename(cat)} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:10,color:T.sub,fontFamily:"Nunito,sans-serif" }}>✏️ Name</button>
                    )}
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
                    <button onClick={()=>setCats(p=>p.map(c=>c.id===cat.id?{...c,subs:c.subs.filter(x=>x.id!==s.id)}:c))} style={{ background:"none",border:"none",cursor:"pointer",color:T.sub,fontSize:10,padding:0 }}>✕</button>
                  </span>
                ))}
              </div>
              {addSubTo===cat.id?(
                <div>
                  <div style={{ display:"flex",gap:6 }}>
                    <input style={{ ...inpSm,flex:1 }} placeholder="Subcategory name(s) — e.g. Milk, Eggs, Bread" value={subInput} onChange={e=>setSubInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addSubcategories(cat.id); } }} autoFocus/>
                    <button onClick={()=>addSubcategories(cat.id)} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,color:T.accent,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>Add</button>
                    <button onClick={()=>{setAddSubTo(null);setSubInput("");}} style={{ background:"none",border:`1px solid ${T.border}`,color:T.sub,borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:12,fontFamily:"Nunito,sans-serif" }}>✕</button>
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
          <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:14 }}>➕ New Category</div>
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
          <input style={{ ...inp,marginBottom:12 }} type="number" placeholder={`Monthly budget (${sym}) — optional`} value={newCatBudget} onChange={e=>setNewCatBudget(e.target.value)}/>
          <button onClick={()=>{ if(!newCatName.trim()) return; setCats(p=>[...p,{id:genId(),name:newCatName.trim(),icon:newCatIcon,color:newCatColor,budget:parseFloat(newCatBudget)||0,subs:[]}]); setNewCatName(""); setNewCatBudget(""); }} style={btnP}>Create Category</button>
        </div>
      </div>
    );

    return (
      <div style={{ padding:"14px 0 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"0 16px 16px" }}>
          <button onClick={()=>setShowSettings(false)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>←</button>
          <div style={{ color:T.text,fontSize:20,fontWeight:900 }}>Settings</div>
        </div>

        <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,padding:"0 16px 8px" }}>Appearance</div>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,margin:"0 16px 16px",overflow:"hidden" }}>
          <Row icon="🌙" title="Dark Mode" subtitle={dark?"On — dark theme active":"Off — light theme active"} right={<Toggle val={dark} fn={()=>setDark(v=>!v)}/>}/>
          <Row icon="🏷️" title="Auto-suggest Category" subtitle={autoDetectExpenseCategory?"On — category suggested from store name":"Off — manual category selection"} right={<Toggle val={autoDetectExpenseCategory} fn={()=>setAutoDetectExpenseCategory(v=>!v)}/>}/>
        </div>

        <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,padding:"0 16px 8px" }}>Security</div>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,margin:"0 16px 16px",overflow:"hidden" }}>
          <Row icon="🔐" title="PIN & Lock" subtitle="Change your app PIN or lock Arth now" onClick={()=>setSettingsSection("security")}/>
        </div>

        <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,padding:"0 16px 8px" }}>Data</div>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,margin:"0 16px 16px",overflow:"hidden" }}>
          <Row icon="🏦" title="Manage Accounts" subtitle={`${accounts.length} account${accounts.length===1?"":"s"}`} onClick={()=>setSettingsSection("accounts")}/>
          <Row icon="🚗" title="Vehicles" subtitle={vehicles.length>0?`${vehicles.length} vehicle${vehicles.length===1?"":"s"}`:"Track fuel, PUC, insurance by vehicle"} onClick={()=>setSettingsSection("vehicles")}/>
          <Row icon="🗂️" title="Manage Categories" subtitle={`${cats.length} categories`} onClick={()=>setSettingsSection("categories")}/>
          <Row icon="🏷️" title="Account, Income & Liability Types" subtitle="Add custom types" onClick={()=>setSettingsSection("types")}/>
        </div>

        <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,padding:"0 16px 8px" }}>Backup & Sync</div>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,margin:"0 16px 16px",overflow:"hidden" }}>
          <Row icon="🔑" title="Cloud Sync & Account" subtitle={cloudUser?.email ? `Signed in as ${cloudUser.email}${lastSyncedAt ? " · synced" : ""}` : "Sign in to sync across devices"} onClick={()=>setSettingsSection("cloudsync")}/>
          <Row icon="☁️" title="Backup & Restore" subtitle={autoBackupEnabled?`Auto backup ${autoBackupFrequency} · ${autoBackups.length} saved`:"Auto backup off"} onClick={()=>setSettingsSection("backup")}/>
        </div>

        <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,padding:"0 16px 8px" }}>Help</div>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,margin:"0 16px 24px",overflow:"hidden" }}>
          <Row icon="📖" title="User Guides" subtitle="How-to guides for features" onClick={()=>setSettingsSection("guides")}/>
          <Row icon="🚀" title="Release Notes" subtitle={`v${APP_VERSION} · What's new`} onClick={()=>setSettingsSection("releasenotes")}/>
        </div>

        <div style={{ color:T.sub,fontSize:10,textAlign:"center",padding:"0 16px 8px" }}>
          {txns.length} txns · {accounts.length} accounts · {people.filter(p=>!p.isMe).length} people · {bills.length} bills
        </div>
        <div style={{ color:T.sub,fontSize:11,textAlign:"center",padding:"0 16px 32px" }}>
          {APP_VERSION}
        </div>
      </div>
    );
  };

  // ── EDIT ACCOUNT MODAL ───────────────────────────────────────────────────────
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
    const [excludeFromWealth, setExcludeFromWealth] = useState(a.excludeFromWealth||false);
    const [accAttributedTo, setAccAttributedTo] = useState(a.attributedTo||"");
    const [accAttributeType, setAccAttributeType] = useState(a.attributeType||"person");
    const banks = accounts.filter(x=>x.type==="bank"&&x.id!==a.id);

    const save = () => {
      if(!name.trim()) return;
      setAccounts(prev=>prev.map(x=>x.id===a.id?{
        ...x, name:name.trim(), last4, color, excludeFromWealth, attributedTo:accAttributedTo||null, attributeType:accAttributedTo?accAttributeType:null,
        ...(a.type==="cc"&&{ limit:parseFloat(limit)||0, statementDate:parseInt(statementDate)||15, dueDate:parseInt(dueDate)||5, alertPct:Math.max(0,parseFloat(alertPct)||0), billingCycle:billingCycle||`${statementDate}th–${dueDate}th` }),
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
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ background:T.input,borderRadius:10,padding:"8px 14px" }}>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1 }}>Type: {a.typeLabel || accLabel(a)}</div>
            </div>
            <input style={inp} placeholder="Account name *" value={name} onChange={e=>setName(e.target.value)}/>
            {(a.type==="bank"||a.type==="cc"||a.type==="debit")&&<input style={inp} placeholder="Last 4 digits" maxLength={4} value={last4} onChange={e=>setLast4(e.target.value)}/>}
            {(a.type==="bank"||a.type==="cash")&&<div style={{ display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:10 }}>
              <div>
                <span style={lbl}>{a.type==="cash"?`Cash in hand (${sym})`:`Opening balance (${sym})`}</span>
                <input style={inp} type="text" inputMode="decimal" value={openingBalance||""} onChange={e=>setOpeningBalance(cleanMoneyInput(e.target.value))}/>
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
              <div><span style={lbl}>Billing Cycle (e.g. 15th–14th)</span><input style={inp} placeholder="e.g. 15th–14th" value={billingCycle} onChange={e=>setBillingCycle(e.target.value)}/></div>
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
              <button onClick={save} style={btnP}>Save Changes ✓</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── BUDGET PAGE ──────────────────────────────────────────────────────────────
  const BudgetPage = ({ embedded = false, onBack }) => {
    const fy = selectedBudgetFY;
    const fyLabel = `FY ${fy}–${fy+1}`;
    const now = new Date();
    const isPreviousFY = fy === currentFYStartYear - 1;
    const isCurrentFY = fy === currentFYStartYear;
    const activeAnnualBudget = isPreviousFY ? Number(lastFYTarget || 0) : Number(annualBudget || 0);
    const setActiveAnnualBudget = value => {
      if(isPreviousFY) setLastFYTarget(value);
      else setAnnualBudget(value);
    };
    const [budgetDraft, setBudgetDraft] = useState(activeAnnualBudget ? fmt(activeAnnualBudget) : "");
    useEffect(()=>{
      setBudgetDraft(activeAnnualBudget ? fmt(activeAnnualBudget) : "");
    },[activeAnnualBudget, fy]);
    const commitBudgetDraft = () => {
      setActiveAnnualBudget(parseMoney(budgetDraft));
    };
    const months = Array.from({length:12},(_,i)=>{ const d=new Date(fy,3+i,1); return { key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, label:d.toLocaleString("en-IN",{month:"short",year:"2-digit"}) }; });
    const monthlySlice = Math.round(activeAnnualBudget/12);
    const fySpend = months.reduce((s,m)=>s+txns.filter(t=>t.type==="expense"&&t.date?.startsWith(m.key)).reduce((a,t)=>a+getNetExpenseAmount(t),0),0);
    const monthsElapsed = isCurrentFY ? Math.max(1, Math.min(12, ((now.getFullYear()-fy) * 12) + (now.getMonth()-3) + 1)) : 12;
    const monthsRemaining = isCurrentFY ? Math.max(1, 12 - monthsElapsed) : 0;
    const safeToSpend = activeAnnualBudget - fySpend;
    const avgSpendPerMonth = monthsElapsed>0 ? fySpend / monthsElapsed : 0;
    const safeMonthlyPace = isCurrentFY ? (monthsRemaining>0 ? safeToSpend / monthsRemaining : safeToSpend) : 0;
    const fyPct = activeAnnualBudget>0 ? Math.min(100,Math.round(fySpend/Math.max(1,activeAnnualBudget)*100)) : (fySpend>0 ? 100 : 0);

    return (
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
          {embedded&&<button onClick={onBack} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:22,padding:0 }}>←</button>}
          <div style={{ color:T.text,fontSize:20,fontWeight:900,flex:1 }}>💰 Budget</div>
        </div>

        <div style={{ ...card,padding:"10px 12px",marginBottom:12 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:8 }}>
            <button onClick={()=>setSelectedBudgetFY(prev=>Math.max(currentFYStartYear-1, prev-1))} disabled={fy<=currentFYStartYear-1} style={{ background:T.pill,border:`1px solid ${T.border}`,color:fy<=currentFYStartYear-1?T.sub:T.text,borderRadius:8,padding:"6px 10px",cursor:fy<=currentFYStartYear-1?"not-allowed":"pointer",fontSize:11,fontWeight:800,fontFamily:"Nunito,sans-serif",opacity:fy<=currentFYStartYear-1?0.6:1 }}>← Last FY</button>
            <div style={{ color:T.text,fontSize:13,fontWeight:900,textAlign:"center" }}>{fyLabel}</div>
            <button onClick={()=>setSelectedBudgetFY(prev=>Math.min(currentFYStartYear, prev+1))} disabled={fy>=currentFYStartYear} style={{ background:T.pill,border:`1px solid ${T.border}`,color:fy>=currentFYStartYear?T.sub:T.text,borderRadius:8,padding:"6px 10px",cursor:fy>=currentFYStartYear?"not-allowed":"pointer",fontSize:11,fontWeight:800,fontFamily:"Nunito,sans-serif",opacity:fy>=currentFYStartYear?0.6:1 }}>Current FY →</button>
          </div>
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12 }}>
          <div style={{ ...card,marginBottom:0 }}>
            <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1 }}>Annual budget</div>
            <input
              style={{ ...inp,marginTop:8,fontSize:18,fontWeight:800,textAlign:"left" }}
              type="text"
              inputMode="decimal"
              value={budgetDraft}
              onChange={e=>setBudgetDraft(cleanMoneyInput(e.target.value))}
              onBlur={commitBudgetDraft}
              onKeyDown={e=>{
                if(e.key==="Enter"){
                  e.preventDefault();
                  commitBudgetDraft();
                  e.currentTarget.blur();
                }
              }}
              placeholder={isPreviousFY?`Set ${fyLabel} budget`:`e.g. ${sym}6,00,000`}
            />
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:8,flexWrap:"wrap" }}>
              <span style={{ color:T.sub,fontSize:10 }}>{fyLabel}</span>
              <span style={{ color:T.accent,fontSize:10,fontWeight:800 }}>{sym}{fmt(monthlySlice)}/month</span>
            </div>
          </div>
          <div style={{ ...card,marginBottom:0,display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
            <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1 }}>Carry Forward</div>
            <div style={{ color:T.sub,fontSize:10,marginTop:6,lineHeight:1.4 }}>Surplus/deficit from last month adjusts this month's budget</div>
            <button onClick={()=>setBudgetCarryForward(v=>!v)} style={{ marginTop:10,background:budgetCarryForward?T.success+"22":"none",border:`1px solid ${budgetCarryForward?T.success:T.border}`,borderRadius:20,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:budgetCarryForward?T.success:T.sub,fontFamily:"Nunito,sans-serif" }}>{budgetCarryForward?"ON ✅":"OFF"}</button>
          </div>
          <div style={{ ...card,marginBottom:0 }}>
            <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1 }}>Spent so far</div>
            <div style={{ color:T.danger,fontSize:22,fontWeight:900,marginTop:8 }}>{sym}{fmt(fySpend)}</div>
            <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>{fyPct}% of annual budget used</div>
          </div>
          <div style={{ ...card,marginBottom:0 }}>
            <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1 }}>Remaining budget</div>
            <div style={{ color:safeToSpend>=0?T.success:T.danger,fontSize:22,fontWeight:900,marginTop:8 }}>{safeToSpend>=0?"":"−"}{sym}{fmt(Math.abs(safeToSpend))}</div>
            <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>{isCurrentFY ? (safeMonthlyPace>=0?`${sym}${fmt(safeMonthlyPace)}/month left`:`Over pace by ${sym}${fmt(Math.abs(safeMonthlyPace))}/month`) : (safeToSpend>=0?"Saved against budget":"Overspent in this FY")}</div>
          </div>
          <div style={{ ...card,marginBottom:0 }}>
            <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1 }}>Avg spend / month</div>
            <div style={{ color:T.info,fontSize:22,fontWeight:900,marginTop:8 }}>{sym}{fmt(avgSpendPerMonth)}</div>
            <div style={{ color:T.sub,fontSize:10,marginTop:6 }}>{monthsElapsed} month{monthsElapsed===1?"":"s"} tracked</div>
          </div>
        </div>

        {/* Default group for expenses */}
        <div style={{ ...card,marginBottom:16 }}>
          <div style={{ color:T.text,fontSize:13,fontWeight:800,marginBottom:4 }}>🏠 Default Group for Expenses</div>
          <div style={{ color:T.sub,fontSize:10,marginBottom:10 }}>Auto-tag all new expenses to this group (e.g. UG-2 for household costs). You can still override per transaction.</div>
          <select style={inp} value={defaultGroupId} onChange={e=>setDefaultGroupId(e.target.value)}>
            <option value="">None — tag manually each time</option>
            {groups.map(g=><option key={g.id} value={g.id}>{g.icon||"👥"} {g.name}</option>)}
          </select>
          {defaultGroupId&&<div style={{ color:T.success,fontSize:10,marginTop:6 }}>✅ New expenses auto-tagged to {groups.find(g=>g.id===defaultGroupId)?.name}</div>}
        </div>

        <div style={{ color:T.text,fontSize:15,fontWeight:800,marginBottom:10 }}>Month by Month</div>
        {months.map(m=>{
          const mSpend = txns.filter(t=>t.type==="expense"&&t.date?.startsWith(m.key)).reduce((s,t)=>s+getNetExpenseAmount(t),0);
          const mBudget = monthOverrides[m.key]||monthlySlice;
          const diff = mBudget - mSpend;
          const isOver = diff < 0;
          const pct = mBudget>0 ? Math.min(100,Math.round(mSpend/mBudget*100)) : (mSpend>0 ? 100 : 0);
          const isCurrent = m.key===viewMonth;
          const isFuture = m.key > viewMonth;
          return (
            <div key={m.key} onClick={()=>{ setViewMonth(m.key); setTab("home"); setShowSettings(false); }} style={{ ...card,cursor:"pointer",border:`1px solid ${isCurrent?T.accent:T.border}`,background:isCurrent?T.accentSoft:T.card,opacity:isFuture?0.6:1,marginBottom:8 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6 }}>
                <div style={{ color:isCurrent?T.accent:T.text,fontSize:13,fontWeight:isCurrent?800:600,minWidth:62 }}>{m.label}{isCurrent?<span style={{ color:T.accent,fontSize:9,marginLeft:4 }}>NOW</span>:""}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,fontSize:10,color:T.sub,marginBottom:4,flexWrap:"wrap" }}>
                    <span>Spent {sym}{fmtK(mSpend)}</span>
                    <span>Budget {sym}{fmtK(mBudget)}</span>
                  </div>
                  <div style={{ height:5,background:T.border,borderRadius:3 }}>
                    <div style={{ height:"100%",width:`${pct}%`,background:isOver?T.danger:pct>70?T.warn:T.success,borderRadius:3 }}/>
                  </div>
                </div>
                <div style={{ fontSize:11,fontWeight:800,color:isOver?T.danger:T.success,minWidth:72,textAlign:"right" }}>
                  {isOver?"Over":"Left"}
                  <div>{sym}{fmtK(Math.abs(diff))}</div>
                </div>
              </div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                <span style={{ color:T.sub,fontSize:10 }}>{pct}% of monthly budget used</span>
                <span style={{ color:T.sub,fontSize:10 }}>{isOver?"Over budget":"Within budget"}</span>
              </div>
            </div>
          );
        })}

        {/* Per-person budgets */}
        <div style={{ marginTop:20,paddingBottom:80 }}>
          <div style={{ color:T.text,fontSize:15,fontWeight:900,marginBottom:12 }}>👤 Per-Person Budgets</div>
          {people.filter(p=>!p.isMe).map(p=>{
            const monthBudget = perPersonBudgets[p.id] || 0;
            const monthSpend = thisMonthTxns.filter(t=>{
              if(t.type!=="expense") return false;
              return String(t.taggedPersonId||t.forPersonId||"")===String(p.id) || t.people?.[p.id];
            }).reduce((s,t)=>s+t.amount,0);
            const pct = monthBudget>0 ? Math.min(100,Math.round(monthSpend/monthBudget*100)) : 0;
            const isOver = monthSpend > monthBudget && monthBudget > 0;
            return (
              <div key={p.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,marginBottom:10,padding:"12px 14px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:18 }}>{p.emoji}</span>
                    <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{p.name}</div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <span style={{ color:T.sub,fontSize:11 }}>₹</span>
                    <input
                      style={{ background:T.input,border:`1px solid ${T.border}`,borderRadius:8,padding:"4px 8px",color:T.text,fontSize:13,fontWeight:800,width:90,textAlign:"right",outline:"none",fontFamily:"Nunito,sans-serif" }}
                      type="text" inputMode="decimal" placeholder="Budget"
                      value={perPersonBudgets[p.id]?String(perPersonBudgets[p.id]):""}
                      onChange={e=>setPerPersonBudgets(prev=>({...prev,[p.id]:parseMoney(e.target.value)||0}))}
                    />
                    <span style={{ color:T.sub,fontSize:10 }}>/mo</span>
                  </div>
                </div>
                {monthBudget>0&&(
                  <>
                    <div style={{ height:5,background:T.border,borderRadius:3,marginBottom:4 }}>
                      <div style={{ height:"100%",width:`${pct}%`,background:isOver?T.danger:pct>80?T.warn:p.color||T.success,borderRadius:3 }}/>
                    </div>
                    <div style={{ display:"flex",justifyContent:"space-between" }}>
                      <span style={{ color:T.sub,fontSize:10 }}>Spent: {sym}{fmtK(monthSpend)}</span>
                      <span style={{ color:isOver?T.danger:T.success,fontSize:10,fontWeight:700 }}>{isOver?`Over ${sym}${fmtK(monthSpend-monthBudget)}`:`Left ${sym}${fmtK(monthBudget-monthSpend)}`}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── EDIT BILL MODAL ──────────────────────────────────────────────────────────
  const EditBillModal = ({ b, onClose }) => {
    const [name,setName]=useState(b.name||"");
    const [amount,setAmount]=useState(String(b.amount||""));
    const [billDate,setBillDate]=useState(b.billDate||b.createdDate||todayStr());
    const [dueDate,setDueDate]=useState(b.dueDate||"");
    const [catId,setCatId]=useState(b.catId||cats[0]?.id||"");
    const [subId,setSubId]=useState(b.subId||"");
    const [recurring,setRecurring]=useState(b.recurring||false);
    const [frequency,setFrequency]=useState(b.frequency||"monthly");
    const [merchant,setMerchant]=useState(b.merchant||"");
    const [invoiceNo,setInvoiceNo]=useState(b.invoiceNo||"");
    const [billerAccountId,setBillerAccountId]=useState(b.billerAccountId||"");
    const selectedBA = billerAccountId ? billerAccounts.find(x=>x.id===billerAccountId) : null;
    const [autoGenerate,setAutoGenerate]=useState(b.autoGenerate!==false);
    const [billPeriodFrom,setBillPeriodFrom]=useState(b.billPeriodFrom||"");
    const [billPeriodTo,setBillPeriodTo]=useState(b.billPeriodTo||"");
    const [editPhoto,setEditPhoto]=useState(b.imageBase64||null);
    const [editSplitPeople,setEditSplitPeople]=useState(()=>{ const m={}; Object.entries(b.splitPeople||{}).forEach(([pid])=>m[pid]=true); return m; });
    const [editSplitCalc,setEditSplitCalc]=useState("equally");
    const [editSplitCustom,setEditSplitCustom]=useState({});
    const [editGroup,setEditGroup]=useState(b.groupId||"");
    const curCat=getCat(catId||"");
    const billDateText = b.billDate || b.createdDate || b.dueDate || "";
    const paymentDateText = txns.find(txn=>String(txn.id)===String(b.paidByTxnId || ""))?.date || b.paidDate || "";
    const editSelectedPids=Object.entries(editSplitPeople).filter(([,v])=>v).map(([k])=>k);
    const editAmt=parseFloat(amount)||0;
    const normalizedInvoiceNo = String(invoiceNo||"").trim().toLowerCase();
    const duplicateInvoiceBill = normalizedInvoiceNo
      ? bills.find(row=>String(row.id)!==String(b.id) && String(row.invoiceNo||"").trim().toLowerCase()===normalizedInvoiceNo)
      : null;

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
      if(duplicateInvoiceBill) return;
      const shares=calcEditShares();
      const peopleSplit={};
      Object.entries(shares).forEach(([pid,sh])=>{ const p=getPerson(pid); peopleSplit[pid]={amount:sh,mode:p.personType!=="dependant"?"owes":"spent_on"}; });
      const owedByOthers = Object.entries(peopleSplit).reduce((sum,[,info])=>sum+(info.mode==="owes"?Number(info.amount||0):0),0);
      const myShare=editIncludeMe ? Math.max(0, editAmt-owedByOthers) : 0;
      const groupCollectiveAmount = editGroup ? Math.max(0, editAmt-owedByOthers-myShare) : 0;
      setBills(prev=>prev.map(x=>x.id===b.id?{...x,name:name.trim(),amount:parseFloat(amount)||0,billDate:billDate||x.billDate||todayStr(),dueDate,catId,subId:subId||null,recurring,frequency,merchant:merchant.trim()||name.trim(),invoiceNo:invoiceNo.trim(),imageBase64:editPhoto,splitPeople:peopleSplit,groupId:editGroup||null,groupCollectiveAmount,myShare,billerAccountId:billerAccountId||null,autoGenerate,billPeriodFrom:billPeriodFrom||null,billPeriodTo:billPeriodTo||null}:x));
      onClose();
    };

    return (
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>✏️ Edit Bill</div>
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ background:T.input,borderRadius:12,padding:"10px 12px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                <span style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5 }}>BILLER ACCOUNT</span>
                <button onClick={()=>setShowAddBillerAccount(true)} style={{ background:"none",border:`1px solid ${T.accent}44`,borderRadius:16,padding:"2px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>+ New Account</button>
              </div>
              {billerAccounts.length===0
                ? <div style={{ color:T.sub,fontSize:11 }}>No biller accounts yet. Add one first, or fill manually below.</div>
                : <select style={inp} value={billerAccountId} onChange={e=>{ const id=e.target.value; setBillerAccountId(id); if(id){ const ba=billerAccounts.find(x=>x.id===id); if(ba){ setName(ba.name); setMerchant(ba.provider||ba.name); } } }}>
                    <option value="">Select biller account (or fill manually)</option>
                    {billerAccounts.map(ba=>(<option key={ba.id} value={ba.id}>{ba.name} {ba.consumerNo?`(${ba.consumerNo})`:""} - {ba.type}</option>))}
                  </select>
              }
              {selectedBA&&<div style={{ marginTop:8,display:"flex",gap:6,flexWrap:"wrap" }}><span style={{ background:T.success+"16",border:`1px solid ${T.success}33`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:T.success }}>{selectedBA.type}</span>{selectedBA.consumerNo&&<span style={{ background:T.pill,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:T.sub }}>#{selectedBA.consumerNo}</span>}{selectedBA.provider&&<span style={{ background:T.pill,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:T.sub }}>{selectedBA.provider}</span>}</div>}
            </div>
            <input style={inp} placeholder="Bill name * e.g. April Electricity Bill" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
            <input style={inp} placeholder="Biller / issuer (optional) e.g. Goa Electricity Dept" value={merchant} onChange={e=>setMerchant(e.target.value)}/>
            <input style={{ ...inp,border:`1px solid ${duplicateInvoiceBill?T.danger+"66":T.border}` }} placeholder="Bill number / invoice no. (unique) e.g. MSojo123" value={invoiceNo} onChange={e=>setInvoiceNo(e.target.value)}/>
            {duplicateInvoiceBill && <div style={{ color:T.danger,fontSize:10,fontWeight:700,marginTop:-4 }}>This invoice number already exists for {duplicateInvoiceBill.name}.</div>}
            <div>
              <span style={lbl}>Amount ({sym})</span>
              <input style={{ ...inp,fontSize:20,fontWeight:800,textAlign:"center" }} type="number" value={amount} onChange={e=>setAmount(e.target.value)}/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div><span style={lbl}>Bill Date (generated on)</span><input style={inp} type="date" value={billDate} onChange={e=>setBillDate(e.target.value)}/></div>
              <div><span style={lbl}>Due Date (pay by)</span><input style={inp} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
              <div><span style={lbl}>Period From (optional)</span><input style={inp} type="date" value={billPeriodFrom} onChange={e=>setBillPeriodFrom(e.target.value)}/></div>
              <div><span style={lbl}>Period To (optional)</span><input style={inp} type="date" value={billPeriodTo} onChange={e=>setBillPeriodTo(e.target.value)}/></div>
            </div>
            <div style={{ background:T.input,borderRadius:10,padding:"10px 12px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
              <div>
                <div style={{ color:T.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Bill date</div>
                <div style={{ color:T.text,fontSize:11,fontWeight:700,marginTop:3 }}>{formatShortDate(billDateText) || billDateText || "—"}</div>
              </div>
              <div>
                <div style={{ color:T.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Due date</div>
                <div style={{ color:T.text,fontSize:11,fontWeight:700,marginTop:3 }}>{formatShortDate(dueDate) || dueDate || "—"}</div>
              </div>
              <div>
                <div style={{ color:T.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Payment date</div>
                <div style={{ color:T.text,fontSize:11,fontWeight:700,marginTop:3 }}>{paymentDateText ? (formatShortDate(paymentDateText) || paymentDateText) : "—"}</div>
              </div>
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
                {(editGroup ? people.filter(p=>!p.isMe && (getGroup(editGroup)?.members||[]).includes(p.id)) : people.filter(p=>!p.isMe)).map(p=><button key={p.id} onClick={()=>setEditSplitPeople(prev=>({...prev,[p.id]:!prev[p.id]}))} style={{ background:editSplitPeople[p.id]?p.color+"22":"none",border:`1px solid ${editSplitPeople[p.id]?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:editSplitPeople[p.id]?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>)}
              </div>
              {editSelectedPids.length>0&&<>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                  {[["equally","= Equal"],["amount","₹ Amount"],["percent","% Percent"],["share","⚖️ Share"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setEditSplitCalc(v)} style={{ background:editSplitCalc===v?T.accent+"22":"none",border:`1px solid ${editSplitCalc===v?T.accent:T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:editSplitCalc===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
                  ))}
                </div>
                <div style={{ background:T.input,borderRadius:10,padding:"10px 12px" }}>
                  {(()=>{ const shares=calcEditShares(); const myS=editAmt-Object.values(shares).reduce((s,v)=>s+v,0); return <div style={{ display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}`,marginBottom:6 }}><span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>🧑 My share</span><span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>{sym}{fmt(Math.max(0,myS))}</span></div>; })()}
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
                <label htmlFor="edit_recurring" style={{ color:T.text,fontSize:14,fontWeight:700,cursor:"pointer" }}>🔁 Recurring bill</label>
              </div>
              {recurring&&<div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {[["monthly","Monthly"],["quarterly","Quarterly"],["halfyearly","Half-yearly"],["yearly","Yearly"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setFrequency(v)} style={{ background:frequency===v?T.accent+"22":"none",border:`1px solid ${frequency===v?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:frequency===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
                ))}
              </div>}
            </div>
            {/* Bill photo */}
            <div style={{ background:T.input,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10 }}>
              <span>📷</span>
              <span style={{ color:T.sub,fontSize:13,fontWeight:700,flex:1 }}>Bill Photo (optional)</span>
              <label style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>
                {editPhoto?"Change":"Upload"}
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setEditPhoto(ev.target.result); r.readAsDataURL(f); }}/>
              </label>
              {editPhoto&&<button onClick={()=>setEditPhoto(null)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:16 }}>✕</button>}
            </div>
            {editPhoto&&<img src={editPhoto} alt="bill" style={{ width:"100%",borderRadius:10,maxHeight:160,objectFit:"cover" }} onError={e=>e.target.style.display="none"}/>}

            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:10 }}>
              <button onClick={onClose} style={btnG}>Cancel</button>
              <button onClick={save} style={btnP}>Save Changes ✓</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── TABS ───────────────────────────────────────────────────────────────────
  // ── BILLS PAGE ──────────────────────────────────────────────────────────────
  // Biller type icon map
  const BILLER_ICON = {
    "Electricity": "⚡",
    "Water": "💧",
    "LPG Gas": "🛢️",
    "Piped Gas": "🔥",
    "Broadband": "📶",
    "Landline": "📞",
    "Cable TV": "📺",
    "Mobile Postpaid": "📱",
    "Mobile Prepaid": "📱",
    "DTH": "📡",
    "Fastag": "🚗",
    "Metro Recharge": "🚇",
    "NCMC Recharge": "💳",
    "EV Recharge": "⚡",
    "OTT / Streaming": "🎬",
    "Insurance": "🛡️",
    "Loan EMI": "🏦",
    "Credit Card": "💳",
    "Recurring Deposit": "📅",
    "NPS": "🏦",
    "School Fees": "🏫",
    "Education Fees": "🎓",
    "Municipal Tax": "🏛️",
    "Municipal Services": "🏛️",
    "Society Maintenance": "🏢",
    "Gym / Fitness": "🏋️",
    "Club Membership": "👥",
    "Hospital": "🏥",
    "Rental": "🏠",
    "Prepaid Meter": "🔌",
    "eChallan": "🚦",
    "Fleet Card": "🚛",
    "Donation": "❤️",
    "B2B": "💼",
    "Other Subscription": "🔔",
    "Other": "📄",
  };
  const getBillerIcon = type => BILLER_ICON[type] || "📄";
  const GROUP_TYPES = [
    { id:"family",     label:"Family / Dependants", icon:"🏠", default:"attributed", desc:"Expenses attributed, no collection" },
    { id:"friends",    label:"Friends / Social",    icon:"👥", default:"split",      desc:"Split and collect" },
    { id:"relatives",  label:"Relatives",           icon:"👨‍👩‍👧", default:"split", desc:"Split, can override per expense" },
    { id:"trip",       label:"Trip / Event",        icon:"✈️", default:"split",  desc:"Split and collect" },
    { id:"office",     label:"Office / Work",       icon:"💼", default:"split",      desc:"Split and collect" },
    { id:"building",   label:"Office Building",     icon:"🏢", default:"split",      desc:"Split and collect" },
    { id:"society",    label:"Society",             icon:"🏛️", default:"split", desc:"Split and collect" },
    { id:"business",   label:"Business",            icon:"🍳", default:"attributed", desc:"Tagged expenses, no collection" },
    { id:"other",      label:"Other",               icon:"📄", default:"manual",     desc:"Choose per expense" },
  ];
  const getGroupTypeMeta = id => GROUP_TYPES.find(t=>t.id===id) || GROUP_TYPES[GROUP_TYPES.length-1];

  // -- BILLING TYPE HELPERS --------------------------------------------------
  const MEMBERSHIP_TYPES = ["Gym / Fitness","Club Membership","School Fees","Education Fees","Other Subscription","Insurance","Society Maintenance","Rental"];
  const BILL_TYPES = ["Electricity","Water","LPG Gas","Piped Gas","Broadband","Landline","Cable TV","DTH","Fastag","Metro Recharge","NCMC Recharge","EV Recharge","Prepaid Meter","eChallan","Fleet Card","Donation","B2B","Hospital","Other","Mobile Prepaid","Mobile Postpaid","Credit Card","Recurring Deposit","NPS","Municipal Tax","Municipal Services","OTT / Streaming"];
  const BILLER_TYPES = ["Electricity","Water","LPG Gas","Piped Gas","Broadband","Landline","Cable TV","Mobile Postpaid","Mobile Prepaid","DTH","Fastag","Metro Recharge","NCMC Recharge","EV Recharge","OTT / Streaming","Insurance","Credit Card","Recurring Deposit","NPS","School Fees","Education Fees","Municipal Tax","Municipal Services","Society Maintenance","Gym / Fitness","Club Membership","Hospital","Rental","Prepaid Meter","eChallan","Fleet Card","Donation","B2B","Other Subscription","Other"];
  const HYBRID_TYPES = ["Mobile Postpaid","Mobile Prepaid","OTT / Streaming","NPS","Recurring Deposit","Loan EMI","Credit Card","Municipal Tax","Municipal Services"];
  const getBillerActionType = type => {
    if(MEMBERSHIP_TYPES.includes(type)) return "membership";
    if(BILL_TYPES.includes(type)) return "bill";
    return "hybrid";
  };

  const BillsPage = () => {
    const [billsTab, setBillsTab] = useState("mybills");
    const [bFilter, setBFilter] = useState("unpaid");
    const [expandedBillId, setExpandedBillId] = useState(null);
    const getBillDate = bill => bill?.billDate || bill?.createdDate || bill?.dueDate || "";
    const getBillPaymentDate = bill => txns.find(txn=>String(txn.id)===String(bill?.paidByTxnId || ""))?.date || bill?.paidDate || "";
    const filtered = [...bills]
      .filter(b=>bFilter==="all"||b.status===bFilter)
      .sort((a,b)=>{
        const dueA = toDateOnly(a.dueDate)?.getTime() || 0;
        const dueB = toDateOnly(b.dueDate)?.getTime() || 0;
        const billA = toDateOnly(getBillDate(a))?.getTime() || 0;
        const billB = toDateOnly(getBillDate(b))?.getTime() || 0;
        const paidA = toDateOnly(getBillPaymentDate(a))?.getTime() || 0;
        const paidB = toDateOnly(getBillPaymentDate(b))?.getTime() || 0;
        if(bFilter==="paid") return paidB - paidA || dueA - dueB || billB - billA;
        return dueA - dueB || billB - billA;
      });
    const totalUnpaid = bills.filter(b=>b.status==="unpaid").reduce((s,b)=>s+getNetBillAmount(b),0);
    const ccBillsDue = accounts.filter(a=>a.type==="cc").map(a=>{
      const summary = getCardSummary(a);
      if(!summary?.currentDue||summary.currentDue<=0) return null;
      return { _isCC:true,id:`cc_due_${a.id}`,name:`${a.name} CC Bill`,type:"Credit Card",amount:summary.currentDue,dueDate:a.dueDate||"",accId:a.id,status:"unpaid" };
    }).filter(Boolean);
    const allUnpaid = [...ccBillsDue,...bills.filter(b=>b.status==="unpaid")];
    return (
      <div style={{ padding:"0 0 120px" }}>
        {/* Tab bar */}
        <div style={{ display:"flex",background:T.card,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:10 }}>
          {[["mybills","📋 My Bills"],["history","🕐 Bill History"]].map(([t,l])=>(
            <button key={t} onClick={()=>setBillsTab(t)} style={{ flex:1,padding:"14px 8px",background:"none",border:"none",borderBottom:`2px solid ${billsTab===t?T.accent:"transparent"}`,cursor:"pointer",fontSize:13,fontWeight:800,color:billsTab===t?T.accent:T.sub,fontFamily:"Nunito,sans-serif",transition:"all 0.2s" }}>{l}</button>
          ))}
        </div>

        {/* MY BILLS TAB - PhonePe style */}
        {billsTab==="mybills"&&(
          <div style={{ paddingBottom:20 }}>
            {/* Search bar */}
            <div style={{ padding:"12px 16px 8px" }}>
              <div style={{ background:T.input,borderRadius:24,padding:"10px 16px",display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:16 }}>🔍</span>
                <input
                  style={{ background:"none",border:"none",outline:"none",color:T.text,fontSize:13,fontFamily:"Nunito,sans-serif",flex:1 }}
                  placeholder="Search billers, categories..."
                  value={billSearch||""}
                  onChange={e=>setBillSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Active biller accounts - compact horizontal scroll */}
            {billerAccounts.length>0&&(
              <div style={{ padding:"8px 16px" }}>
                <div style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5,marginBottom:8 }}>MY ACCOUNTS</div>
                <div style={{ display:"flex",gap:10,overflowX:"auto",paddingBottom:8 }}>
                  {billerAccounts.filter(ba=>!billSearch||(ba.name+ba.type+ba.consumerNo).toLowerCase().includes(billSearch.toLowerCase())).map(ba=>{
                    const billsForAcc = bills.filter(b=>String(b.billerAccountId)===String(ba.id));
                    const unpaidCount = billsForAcc.filter(b=>b.status==="unpaid").length;
                    const lastBill = [...billsForAcc].sort((a,b2)=>(b2.createdAt||0)-(a.createdAt||0))[0];
                    const isExpiringSoon = ba.membershipEndDate && (new Date(ba.membershipEndDate)-new Date())/(1000*60*60*24) <= 30;
                    return (
                      <div key={ba.id} onClick={()=>{
                        if(ba.billerId){ const shell=billers.find(b=>b.id===ba.billerId); if(shell){ setActiveBillerShell(shell); return; } }
                        setActiveBillerForAction(ba);
                      }} style={{ minWidth:120,background:T.card,borderRadius:16,padding:"12px",cursor:"pointer",border:`1px solid ${unpaidCount>0?T.danger+"44":T.border}`,position:"relative",flexShrink:0 }}>
                        {unpaidCount>0&&<div style={{ position:"absolute",top:8,right:8,background:T.danger,color:"#fff",borderRadius:20,padding:"1px 6px",fontSize:9,fontWeight:800 }}>{unpaidCount}</div>}
                        {isExpiringSoon&&<div style={{ position:"absolute",top:8,right:8,background:T.warn,color:"#fff",borderRadius:20,padding:"1px 6px",fontSize:9,fontWeight:800 }}>!</div>}
                        <div style={{ fontSize:28,marginBottom:6 }}>{getBillerIcon(ba.type)}</div>
                        <div style={{ color:T.text,fontSize:11,fontWeight:800,lineHeight:1.2 }}>{ba.name}</div>
                        <div style={{ color:T.sub,fontSize:9,marginTop:3 }}>{lastBill?`${sym}${fmt(lastBill.amount)}`:"No bills"}</div>
                      </div>
                    );
                  })}
                  <div onClick={()=>setShowAddBillerModal(true)} style={{ minWidth:80,background:"none",borderRadius:16,padding:"12px",cursor:"pointer",border:`2px dashed ${T.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <div style={{ fontSize:24,color:T.sub }}>+</div>
                    <div style={{ color:T.sub,fontSize:9,marginTop:4 }}>Add Biller</div>
                  </div>
                </div>
              </div>
            )}

            {/* ALL SERVICES divider */}
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"12px 16px 8px" }}>
              <div style={{ flex:1,height:1,background:T.border }}/>
              <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:1 }}>ALL SERVICES</div>
              <div style={{ flex:1,height:1,background:T.border }}/>
            </div>

            {/* Service categories grid */}
            {[
              { label:"Recharge", types:["Fastag","Mobile Postpaid","Mobile Prepaid","DTH","Broadband","Landline","Cable TV","Metro Recharge","NCMC Recharge","EV Recharge"] },
              { label:"Utility Bills", types:["Electricity","LPG Gas","Piped Gas","Water"] },
              { label:"Finances", types:["Credit Card","Recurring Deposit","NPS","Insurance","Forex"] },
              { label:"Education & Fitness", types:["School Fees","Education Fees","Gym / Fitness","Club Membership","Hospital"] },
              { label:"Others", types:["Donation","Municipal Services","Municipal Tax","Society Maintenance","Rental","Prepaid Meter","eChallan","Fleet Card","B2B","Other Subscription","Other"] },
            ].map(cat=>{
              const filtered2 = billSearch ? cat.types.filter(t=>t.toLowerCase().includes(billSearch.toLowerCase())) : cat.types;
              if(filtered2.length===0) return null;
              return (
                <div key={cat.label} style={{ padding:"8px 16px 4px" }}>
                  <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:12 }}>{cat.label}</div>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
                    {filtered2.map(type=>{
                      const billersOfType = billers.filter(b=>b.type===type);
                      const accsOfType = billerAccounts.filter(ba=>ba.type===type);
                      const unpaid = accsOfType.reduce((sum,ba)=>sum+bills.filter(b=>String(b.billerAccountId)===String(ba.id)&&b.status==="unpaid").length,0);
                      const actionType = getBillerActionType(type);
                      return (
                        <div key={type} onClick={()=>{
                          if(billersOfType.length===0){
                            setAddBillerPresetType(type);
                            setShowAddBillerModal(true);
                          } else {
                            setCategoryAccountsView(type);
                          }
                        }} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer",position:"relative" }}>
                          {unpaid>0&&<div style={{ position:"absolute",top:-4,right:4,background:T.danger,color:"#fff",borderRadius:20,padding:"1px 5px",fontSize:8,fontWeight:800 }}>{unpaid}</div>}
                          <div style={{ width:56,height:56,background:T.card,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,border:`1px solid ${T.border}` }}>{getBillerIcon(type)}</div>
                          <div style={{ color:T.sub,fontSize:9,fontWeight:600,textAlign:"center",lineHeight:1.2 }}>{type}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BILL HISTORY TAB */}
        {billsTab==="history"&&(
          <div style={{ padding:"14px 16px" }}>
            {totalUnpaid>0&&<div style={{ ...card,background:`linear-gradient(135deg,${T.danger}10,${T.card})`,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div>
            <div style={{ color:T.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 }}>Total Unpaid</div>
            <div style={{ color:T.danger,fontSize:22,fontWeight:900,marginTop:4 }}>{sym}{fmt(totalUnpaid)}</div>
          </div>
          <div style={{ fontSize:32 }}>📋</div>
        </div>}
        <div style={{ display:"flex",gap:6,marginBottom:14 }}>
          {[["unpaid","🔴 Unpaid"],["paid","✅ Paid"],["all","All"]].map(([v,l])=>(
            <button key={v} onClick={()=>setBFilter(v)} style={{ background:bFilter===v?T.accent+"22":"none",border:`1px solid ${bFilter===v?T.accent:T.border}`,borderRadius:20,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:700,color:bFilter===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
          ))}
        </div>
        {filtered.length===0?<div style={{ ...card,textAlign:"center",padding:40 }}>
          <div style={{ fontSize:40,marginBottom:12 }}>📭</div>
          <div style={{ color:T.sub,fontSize:13 }}>No bills here</div>
        </div>:filtered.map(b=>{
          const today=new Date();
          const daysUntil=Math.ceil((new Date(b.dueDate)-today)/(1000*60*60*24));
          const isOverdue=b.status==="unpaid"&&daysUntil<0;
          const cat=getCat(b.catId||b.catIds?.[0]) || { icon:"📋", color:T.sub, name:"—" };
          const group=getGroup(b.groupId||"");
          const billDateText = getBillDate(b);
          const paymentDateText = getBillPaymentDate(b);
          const linkedPaymentTxn = txns.find(txn=>String(txn.id)===String(b.paidByTxnId || "")) || null;
          const billImageSrc = b.imageBase64 || linkedPaymentTxn?.imageBase64 || null;
          const paymentImageSrc = b.paymentImageBase64 || linkedPaymentTxn?.paymentImageBase64 || null;
          const isExpanded = expandedBillId===b.id;
          return (
            <div key={b.id} style={{ ...card,border:`1px solid ${isOverdue?T.danger+"44":T.border}` }}>
              <div onClick={()=>setExpandedBillId(prev=>prev===b.id?null:b.id)} style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,cursor:"pointer" }}>
                <div style={{ flex:1,minWidth:0,textAlign:"justify" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10 }}>
                    <div style={{ color:T.text,fontSize:14,fontWeight:800,flex:1,wordBreak:"break-word" }}>{b.name}</div>
                    <div style={{ color:T.text,fontSize:15,fontWeight:800,whiteSpace:"nowrap",textAlign:"right" }}>{sym}{fmt(getNetBillAmount(b))}</div>
                  </div>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:5 }}>
                    <span style={{ color:group?.color || T.sub,fontSize:10,fontWeight:700 }}>{group ? `${group.icon||"👥"} ${group.name}` : "Group: —"}</span>
                    <span style={{ color:T.sub,fontSize:10,fontWeight:700 }}>{isExpanded?"Tap to close":"Tap to expand"}</span>
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginTop:7 }}>
                    <div style={{ textAlign:"left" }}>
                      <div style={{ color:T.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.7 }}>Bill</div>
                      <div style={{ color:T.text,fontSize:10,fontWeight:700,marginTop:2 }}>{formatShortDate(billDateText) || billDateText || "—"}</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ color:T.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.7 }}>Due</div>
                      <div style={{ color:isOverdue?T.danger:T.text,fontSize:10,fontWeight:700,marginTop:2 }}>{formatShortDate(b.dueDate) || b.dueDate || "—"}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ color:T.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:0.7 }}>Paid</div>
                      <div style={{ color:b.status==="paid"?T.success:T.text,fontSize:10,fontWeight:700,marginTop:2 }}>{paymentDateText ? (formatShortDate(paymentDateText) || paymentDateText) : "—"}</div>
                    </div>
                  </div>
                </div>
                <div style={{ color:T.sub,fontSize:14,paddingTop:2 }}>{isExpanded?"▴":"▾"}</div>
              </div>

              {isExpanded && (
                <div style={{ marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:8 }}>
                    <div style={{ color:T.sub,fontSize:11 }}>{cat.icon} {cat.name}{b.recurring?` · 🔁 ${b.frequency}`:""}{b.invoiceNo?` · #${b.invoiceNo}`:""}</div>
                    <div style={{ color:isOverdue?T.danger:daysUntil<=3&&b.status==="unpaid"?T.warn:T.sub,fontSize:11 }}>
                      {b.status==="paid"?`✅ Paid ${formatShortDate(paymentDateText) || paymentDateText || ""}`:isOverdue?`⚠️ ${Math.abs(daysUntil)}d overdue`:daysUntil===0?"Due today":`Due ${formatShortDate(b.dueDate) || b.dueDate}`}
                    </div>
                  </div>
                  {b.splitPeople&&Object.keys(b.splitPeople).length>0&&(
                    <div style={{ marginBottom:8 }}>
                      {Object.entries(b.splitPeople).map(([pid,info])=>{ const p=getPerson(pid); return (
                        <div key={pid} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,fontSize:11,color:info.mode==="owes"?(info.settled?T.success:Number(info.settledAmt||0)>0?T.warn:T.accent):T.sub,marginBottom:2 }}>
                          <span>{p.emoji} {p.name}</span>
                          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                            {(()=>{ const alreadySettledViaTxn=txns.some(x=>x.type==="settlement_in"&&x.settlementLinks?.some(l=>l.kind==="bill"&&String(l.id)===String(b.id)&&String(l.personId)===String(pid))); const left=remainingShare(info); const canShare=info.mode==="owes"&&!info.settled&&!alreadySettledViaTxn&&left>0; return canShare&&<button onClick={e=>{ e.stopPropagation(); sharePaymentRequest(p.name,left,b.name||"Bill",{ dueDate:b.dueDate||b.billDate, billDate:b.billDate, billPeriodFrom:b.billPeriodFrom, billPeriodTo:b.billPeriodTo, totalAmount:b.amount, imageBase64:b.imageBase64||paymentImageSrc||billImageSrc||null, shareTitle:b.name||"Bill" }); }} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:12,padding:"2px 8px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif",flexShrink:0 }}>Share</button>; })()}
                            {(()=>{ const owed=Number(info.amount||0); const left=remainingShare(info); const paid=Number(info.settledAmt||0); if(info.mode!=="owes") return <span>Owes {sym}{fmt(owed)} | on you</span>; if(left<=0) return <span>Settled {sym}{fmt(owed)}</span>; if(paid>0) return <span>Owes {sym}{fmt(owed)} | Partly settled {sym}{fmt(paid)} | Bal. {sym}{fmt(left)}</span>; return <span>Owes {sym}{fmt(owed)} | Bal. {sym}{fmt(left)}</span>; })()}
                            {(()=>{ const alreadySettledViaTxn=txns.some(x=>x.type==="settlement_in"&&x.settlementLinks?.some(l=>l.kind==="bill"&&String(l.id)===String(b.id)&&String(l.personId)===String(pid))); const left=remainingShare(info); const canSettle=info.mode==="owes"&&!info.settled&&!alreadySettledViaTxn&&left>0; return canSettle&&<button onClick={e=>{ e.stopPropagation(); setSettleTxn({ id:"bill_person_settle_"+b.id+"_"+pid, type:"expense", desc:b.name, amount:left, people:{ [pid]:{ amount:left, mode:"owes", settled:false } }, _billIds:[b.id], _isBillSettle:true }); }} style={{ background:T.success+"18",border:`1px solid ${T.success}33`,borderRadius:12,padding:"2px 8px",cursor:"pointer",fontSize:10,fontWeight:700,color:T.success,fontFamily:"Nunito,sans-serif",flexShrink:0 }}>💰 Settle</button>; })()}
                          </div>
                        </div>
                      ); })}
                      {(()=>{ const owedTotal=Object.values(b.splitPeople||{}).reduce((sum,info)=>sum+(info.mode==="owes"?Number(info.amount||0):0),0); const fallbackShare=Math.max(0,Number(b.amount||0)-owedTotal-Number(b.groupCollectiveAmount||0)); const storedShare=Number(b.myShare); const group=b.groupId?getGroup(b.groupId):null; const meExcluded=group?.includeMe===false; const myBillShare=Number.isFinite(storedShare)&&(storedShare>0||fallbackShare<=0||meExcluded)?storedShare:fallbackShare; return (
                        <div style={{ display:"flex",justifyContent:"space-between",gap:8,fontSize:11,color:myBillShare>0?T.success:T.sub,fontWeight:700,marginTop:4 }}>
                          <span>Your share{meExcluded?" (not included)":""}</span>
                          <span>{sym}{fmt(myBillShare)}</span>
                        </div>
                      ); })()}
                    </div>
                  )}
                  {(billImageSrc || paymentImageSrc)&&(
                    <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:8 }}>
                      {billImageSrc&&<button onClick={(e)=>{ e.stopPropagation(); setImageViewSrc(billImageSrc); }} style={{ background:T.info+"14",border:`1px solid ${T.info}33`,borderRadius:16,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:800,color:T.info,fontFamily:"Nunito,sans-serif" }}>🧾 View bill</button>}
                      {paymentImageSrc&&<button onClick={(e)=>{ e.stopPropagation(); setImageViewSrc(paymentImageSrc); }} style={{ background:T.success+"14",border:`1px solid ${T.success}33`,borderRadius:16,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:800,color:T.success,fontFamily:"Nunito,sans-serif" }}>💳 View payment</button>}
                    </div>
                  )}
                  {/* Bill period */}
                  {(b.billPeriodFrom||b.billPeriodTo)&&(
                    <div style={{ display:"flex",gap:6,marginBottom:4 }}>
                      <span style={{ background:T.info+"16",border:`1px solid ${T.info}33`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:T.info }}>📅 {formatShortDate(b.billPeriodFrom)||b.billPeriodFrom||"?"} → {formatShortDate(b.billPeriodTo)||b.billPeriodTo||"?"}</span>
                    </div>
                  )}
                  {/* Plan / recharge details */}
                  {(b.planType||b.planDesc)&&(
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:4 }}>
                      {b.planType&&<span style={{ background:T.accent+"16",border:`1px solid ${T.accent}33`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:T.accent }}>{b.planType}</span>}
                      {b.planDesc&&<span style={{ background:T.pill,borderRadius:20,padding:"2px 8px",fontSize:10,color:T.sub }}>{b.planDesc}</span>}
                    </div>
                  )}
              {/* Validity / period display */}
                  {(b.validFrom||b.validUntil||b.periodStart||b.periodEnd)&&(
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:6 }}>
                      {(b.periodStart||b.validFrom)&&<span style={{ background:T.info+"16",border:`1px solid ${T.info}33`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:T.info }}>From {formatShortDate(b.periodStart||b.validFrom)}</span>}
                      {(b.periodEnd||b.validUntil)&&<span style={{ background:T.info+"16",border:`1px solid ${T.info}33`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:T.info }}>Until {formatShortDate(b.periodEnd||b.validUntil)}</span>}
                      {b.membershipEndDate&&<span style={{ background:T.warn+"16",border:`1px solid ${T.warn}33`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:T.warn }}>Ends {formatShortDate(b.membershipEndDate)}</span>}
                      {b.freeTrialEndDate&&<span style={{ background:T.danger+"16",border:`1px solid ${T.danger}33`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:T.danger }}>Trial ends {formatShortDate(b.freeTrialEndDate)}</span>}
                      {b.isPaused&&<span style={{ background:T.warn+"22",border:`1px solid ${T.warn}44`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:T.warn }}>⏸️ Paused {b.pausedDays>0?`${b.pausedDays}d`:""}</span>}
                    </div>
                  )}
                  <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                    {b.status==="unpaid"&&<button onClick={(e)=>{
                      e.stopPropagation();
                      const payAccId=accounts.find(a=>a.type!=="cc")?.id||"";
                      const paymentTxnId = Date.now();
                      const paymentDate = todayStr();
                      setTxns(p=>[{id:paymentTxnId,type:"expense",desc:b.name,merchant:b.merchant||"",date:paymentDate,note:"Bill payment",catId:b.catId,catIds:b.catIds||[b.catId],subId:b.subId||null,accId:payAccId,people:b.splitPeople||{},forPerson:"",groupId:b.groupId||null,groupCollectiveAmount:Number(b.groupCollectiveAmount||0),amount:b.amount||0,isBillPayment:true,billInvoiceNo:b.invoiceNo||null,paidBillId:b.id,paidBillName:b.name,imageBase64:b.imageBase64||null,paymentImageBase64:b.paymentImageBase64||null},...p]);
                      setBills(p=>p.map(x=>x.id===b.id?{...x,status:"paid",paidDate:paymentDate,paidByTxnId:paymentTxnId,lastPaidAmount:b.amount,lastPaidDate:paymentDate}:x));
                      if(b.recurring && b.autoGenerate!==false){
                        const nextDue = computeNextDueDate(b, paymentDate);
                        const nextPeriod = computeNextPeriod(b, paymentDate);
                        const nextValidFrom = b.billingModel==="prorata" ? nextDue : null;
                        const nextValidUntil = b.billingModel==="prorata" && b.validityDays
                          ? (() => { const d=new Date(nextDue); d.setDate(d.getDate()+Number(b.validityDays)-1); return d.toISOString().split("T")[0]; })()
                          : null;
                        setBills(p=>[{...b,
                          id:genId(),status:"unpaid",
                          dueDate:nextDue,
                          billDate:paymentDate,
                          paidDate:null,paidByTxnId:null,
                          lastPaidAmount:b.amount,
                          lastPaidDate:paymentDate,
                          amount:b.isUsageBased?b.amount:b.amount,
                          createdDate:todayStr(),createdAt:Date.now(),
                          isPaused:false,pausedDate:null,resumeDate:null,pauseReason:null,pausedDays:0,
                          ...(nextPeriod||{}),
                          ...(nextValidFrom?{validFrom:nextValidFrom}:{}),
                          ...(nextValidUntil?{validUntil:nextValidUntil}:{}),
                        },...p]);
                      }
                    }} style={{ ...btnP,flex:1,padding:"9px" }}>✅ Mark as Paid</button>}
                    <button onClick={(e)=>{ e.stopPropagation(); setEditingBill(b); }} style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:12,padding:"9px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>✏️ Edit</button>
                    {b.recurring&&b.status==="unpaid"&&<button onClick={(e)=>{
                      e.stopPropagation();
                      if(b.isPaused){
                        // Resume: calculate days paused, extend validUntil if applicable
                        const pausedSince = b.pausedDate ? new Date(b.pausedDate) : new Date();
                        const today = new Date();
                        const daysPaused = Math.max(0, Math.round((today - pausedSince) / 86400000));
                        const totalPausedDays = (b.pausedDays||0) + daysPaused;
                        let newValidUntil = b.validUntil;
                        if(b.validUntil){
                          const vu = new Date(b.validUntil);
                          vu.setDate(vu.getDate() + daysPaused);
                          newValidUntil = vu.toISOString().split("T")[0];
                        }
                        let newPeriodEnd = b.periodEnd;
                        if(b.periodEnd){
                          const pe = new Date(b.periodEnd);
                          pe.setDate(pe.getDate() + daysPaused);
                          newPeriodEnd = pe.toISOString().split("T")[0];
                        }
                        setBills(p=>p.map(x=>x.id===b.id?{...x,isPaused:false,resumeDate:todayStr(),pausedDays:totalPausedDays,validUntil:newValidUntil,periodEnd:newPeriodEnd}:x));
                      } else {
                        // Pause
                        const reason = window.prompt("Pause reason (optional):");
                        setBills(p=>p.map(x=>x.id===b.id?{...x,isPaused:true,pausedDate:todayStr(),resumeDate:null,pauseReason:reason||null}:x));
                      }
                    }} style={{ background:b.isPaused?T.success+"22":T.warn+"22",border:`1px solid ${b.isPaused?T.success:T.warn}44`,borderRadius:12,padding:"9px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:b.isPaused?T.success:T.warn,fontFamily:"Nunito,sans-serif" }}>{b.isPaused?"▶️ Resume":"⏸️ Pause"}</button>}
                    <button onClick={(e)=>{ e.stopPropagation(); setBills(p=>p.filter(x=>x.id!==b.id)); }} style={{ background:"none",border:`1px solid ${T.danger}44`,borderRadius:12,padding:"9px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.danger,fontFamily:"Nunito,sans-serif" }}>🗑 Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
          </div>
        )}
      </div>
    );
  };

  // ── ADD BILL MODAL ───────────────────────────────────────────────────────────
  // -- ATTACH PAST EXPENSES MODAL ---------------------------------------------
  const AttachExpensesModal = ({ ba, onClose }) => {
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState({});
    const candidates = txns
      .filter(t=>t.type==="expense" && !t.billerLinkId)
      .filter(t=>{
        if(!search.trim()) return true;
        const q = search.trim().toLowerCase();
        const cat = (t.catIds||[t.catId]).filter(Boolean).map(cid=>getCat(cid)?.name||"").join(" ");
        return `${t.merchant||""} ${t.who||""} ${t.desc||""} ${t.note||""} ${cat}`.toLowerCase().includes(q);
      })
      .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))
      .slice(0,100);
    const selectedCount = Object.keys(selectedIds).filter(k=>selectedIds[k]).length;
    const handleAttach = () => {
      const ids = Object.keys(selectedIds).filter(k=>selectedIds[k]);
      if(ids.length===0){ onClose(); return; }
      setTxns(prev=>prev.map(t=>ids.includes(String(t.id))?{...t,billerLinkId:ba.id}:t));
      onClose();
    };
    return (
      <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:320,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"85vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>Attach past expenses to {ba.name}</div>
            <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
          </div>
          <div style={{ color:T.sub,fontSize:11,marginBottom:12 }}>Only expenses not already linked to any biller account are shown. Search helps narrow down old entries.</div>
          <input style={{ ...inp,marginBottom:12 }} placeholder="Search by vendor, note, or category..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:14 }}>
            {candidates.length===0&&<div style={{ color:T.sub,fontSize:12,textAlign:"center",padding:"20px 0" }}>No matching unlinked expenses found.</div>}
            {candidates.map(t=>{
              const isSelected = !!selectedIds[t.id];
              return (
                <div key={t.id} onClick={()=>setSelectedIds(prev=>({...prev,[t.id]:!prev[t.id]}))} style={{ display:"flex",alignItems:"center",gap:10,background:isSelected?T.purple+"16":T.input,border:`1px solid ${isSelected?T.purple:T.border}`,borderRadius:12,padding:"10px 14px",cursor:"pointer" }}>
                  <div style={{ width:20,height:20,borderRadius:5,background:isSelected?T.purple:"none",border:`2px solid ${isSelected?T.purple:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    {isSelected&&<span style={{ color:"#fff",fontSize:12,fontWeight:900 }}>✓</span>}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ color:T.text,fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{t.merchant||t.who||t.desc||"Expense"}</div>
                    <div style={{ color:T.sub,fontSize:10 }}>{formatShortDate(t.date)||t.date}</div>
                  </div>
                  <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{sym}{fmt(t.amount)}</div>
                </div>
              );
            })}
          </div>
          <button onClick={handleAttach} disabled={selectedCount===0} style={{ width:"100%",background:selectedCount>0?T.purple:T.border,border:"none",borderRadius:14,padding:"13px",cursor:selectedCount>0?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif" }}>{selectedCount>0?`Attach ${selectedCount} expense${selectedCount>1?"s":""}`:"Select expenses to attach"}</button>
        </div>
      </div>
    );
  };

  // -- ADD BILLER MODAL (parent shell — just name + type, details added per person later) ----
  const AddBillerModal = ({ presetType, onClose, onCreated }) => {
    const [name, setName] = useState("");
    const [type, setType] = useState(presetType||"");
    const [showTypePicker, setShowTypePicker] = useState(!presetType);
    const canSave = name.trim() && type;
    const handleSave = () => {
      if(!canSave) return;
      const record = { id:genId(), name:name.trim(), type, provider:name.trim(), createdAt:Date.now() };
      setBillers(prev=>[...prev, record]);
      onCreated?.(record);
      onClose();
    };
    return (
      <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:310,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"85vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
            <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>Add Biller</div>
            <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
          </div>
          <div style={{ color:T.sub,fontSize:11,marginBottom:14 }}>Create the biller first — you can add Self, family members, or anyone else under it one at a time, whenever you're ready.</div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div>
              <span style={lbl}>Biller Name *</span>
              <input style={{ ...inp,fontSize:15,fontWeight:700 }} placeholder="e.g. Jio, Gym XYZ, Goa Electricity Dept" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
            </div>
            <div>
              <span style={lbl}>Biller Type *</span>
              {!showTypePicker ? (
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",background:T.accent+"18",border:`1px solid ${T.accent}44`,borderRadius:20,padding:"8px 14px" }}>
                  <span style={{ fontSize:13,fontWeight:700,color:T.accent }}>{getBillerIcon(type)} {type}</span>
                  <button onClick={()=>setShowTypePicker(true)} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>Change</button>
                </div>
              ) : (
                <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                  {BILLER_TYPES.map(t=>{
                    const isSelected = type===t;
                    return (
                      <button key={t} onClick={()=>{ setType(t); setShowTypePicker(false); }} style={{ display:"flex",alignItems:"center",gap:5,background:isSelected?T.accent+"22":T.input,border:`1px solid ${isSelected?T.accent:T.border}`,borderRadius:20,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700,color:isSelected?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>
                        <span>{getBillerIcon(t)}</span>{t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button onClick={handleSave} disabled={!canSave} style={{ background:canSave?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:canSave?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>Add Biller</button>
          </div>
        </div>
      </div>
    );
  };

  // -- BILLER ACCOUNT MODAL --------------------------------------------------
  const BillerAccountModal = ({ existing, onClose }) => {
    const isEdit = !!existing;
    const [baName, setBaName] = useState(existing?.name||"");
    const [baType, setBaType] = useState(existing?.type||preselectedBillerType||"");
    // If arriving from a specific category tap (not editing), the type is already decided —
    // don't make the person re-pick from all 35 chips. Show a locked badge with a Change option instead.
    // If a provider was also preselected (adding another account under an existing provider group,
    // e.g. another number under "Jio"), lock that in too so it's not re-typed either.
    const [showTypePicker, setShowTypePicker] = useState(!(!existing && preselectedBillerType));
    const [baConsumerNo, setBaConsumerNo] = useState(existing?.consumerNo||"");
    const [baProvider, setBaProvider] = useState(existing?.provider||preselectedBillerProvider||"");
    const providerIsLocked = !existing && !!preselectedBillerProvider;
    const [baAttributedTo, setBaAttributedTo] = useState(existing?.attributedTo||"");
    const [baAttributeType, setBaAttributeType] = useState(existing?.attributeType||"house");
    const [baNote, setBaNote] = useState(existing?.note||"");
    const SUB_TYPES = ["Gym / Fitness","Club Membership","School Fees","Education Fees","Other Subscription","Insurance","Society Maintenance","Hospital","Rental"];
    const isSubType = SUB_TYPES.includes(baType);
    const [baSubStart, setBaSubStart] = useState(existing?.subStart||"");
    const [baSubEnd, setBaSubEnd] = useState(existing?.subEnd||"");
    const [baAutoRenew, setBaAutoRenew] = useState(existing?.autoRenew||false);
    const [baBillingCycle, setBaBillingCycle] = useState(existing?.billingCycle||"monthly");
    const daysToExpiry = baSubEnd ? Math.round((new Date(baSubEnd)-new Date())/(1000*60*60*24)) : null;
    const canSave = baName.trim() && baType;
    const [duplicateError, setDuplicateError] = useState("");
    const handleSave = () => {
      if(!canSave) return;
      const trimmedConsumerNo = baConsumerNo.trim();
      if(trimmedConsumerNo){
        // Unique within the same type+provider (e.g. two Jio Prepaid accounts can't share a number),
        // but the same number is fine across different biller types/providers (e.g. Jio Prepaid vs Jio Fiber).
        const dup = billerAccounts.find(ba=>
          ba.id!==(existing?.id||"") &&
          ba.type===baType &&
          (ba.provider||"").trim().toLowerCase()===baProvider.trim().toLowerCase() &&
          (ba.consumerNo||"").trim()===trimmedConsumerNo
        );
        if(dup){ setDuplicateError(`"${trimmedConsumerNo}" is already used by "${dup.name}" under ${baType}${baProvider?` (${baProvider})`:""}. Use a different number, or edit that account instead.`); return; }
      }
      setDuplicateError("");
      const record = { id:existing?.id||genId(), billerId:existing?.billerId||preselectedBillerId||null, name:baName.trim(), type:baType, consumerNo:trimmedConsumerNo, provider:baProvider.trim(), attributedTo:baAttributedTo, attributeType:baAttributeType, note:baNote.trim(), createdAt:existing?.createdAt||Date.now(), subStart:baSubStart||null, subEnd:baSubEnd||null, autoRenew:baAutoRenew, billingCycle:baBillingCycle||null };
      setBillerAccounts(prev=>isEdit?prev.map(x=>x.id===existing.id?record:x):[...prev,record]);
      onClose();
    };
    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"88vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
            <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{isEdit?"Edit Biller Account":"Add Biller Account"}</div>
            <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div>
              <span style={lbl}>Biller Name *</span>
              <input style={inp} placeholder="e.g. Home Electricity, Nidhi Jio, Netflix" value={baName} onChange={e=>setBaName(e.target.value)} autoFocus/>
            </div>
            <div>
              <span style={lbl}>Biller Type *</span>
              {!showTypePicker ? (
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",background:T.accent+"18",border:`1px solid ${T.accent}44`,borderRadius:20,padding:"8px 14px" }}>
                  <span style={{ fontSize:13,fontWeight:700,color:T.accent }}>{getBillerIcon(baType)} {baType}</span>
                  <button onClick={()=>setShowTypePicker(true)} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Nunito,sans-serif" }}>Change</button>
                </div>
              ) : (
                <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                  {BILLER_TYPES.map(t=>{
                    const isSelected = baType===t;
                    return (
                      <button key={t} onClick={()=>setBaType(t)} style={{ display:"flex",alignItems:"center",gap:5,background:isSelected?T.accent+"22":T.input,border:`1px solid ${isSelected?T.accent:T.border}`,borderRadius:20,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700,color:isSelected?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>
                        <span>{getBillerIcon(t)}</span>{t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <span style={lbl}>Consumer / Account Number</span>
              <input style={inp} placeholder="e.g. 60007895307" value={baConsumerNo} onChange={e=>setBaConsumerNo(e.target.value)}/>
            </div>
            <div>
              <span style={lbl}>Provider / Issuer</span>
              {providerIsLocked ? (
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",background:T.accent+"18",border:`1px solid ${T.accent}44`,borderRadius:20,padding:"8px 14px" }}>
                  <span style={{ fontSize:13,fontWeight:700,color:T.accent }}>{baProvider}</span>
                  <span style={{ fontSize:10,color:T.sub }}>Adding another account here</span>
                </div>
              ) : (
                <input style={inp} placeholder="e.g. Goa Electricity Dept, Jio, Adani" value={baProvider} onChange={e=>setBaProvider(e.target.value)}/>
              )}
            </div>
            <div>
              <span style={lbl}>Attributed To</span>
              <div style={{ display:"flex",gap:6,marginBottom:8,flexWrap:"wrap" }}>
                {[["house","House"],["person","Person"],["group","Group"],...(vehicles.length>0?[["vehicle","Vehicle"]]:[])].map(([v,l])=>(
                  <button key={v} onClick={()=>{ setBaAttributeType(v); setBaAttributedTo(""); }} style={{ flex:1,minWidth:70,background:baAttributeType===v?T.accent+"22":"none",border:`1px solid ${baAttributeType===v?T.accent:T.border}`,borderRadius:10,padding:"6px 4px",cursor:"pointer",fontSize:11,fontWeight:700,color:baAttributeType===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
                ))}
              </div>
              {baAttributeType==="person"&&(
                <select style={inp} value={baAttributedTo} onChange={e=>{
                  const pid=e.target.value;
                  setBaAttributedTo(pid);
                  if(!baName.trim()){ const p=people.find(x=>String(x.id)===pid); if(p) setBaName(p.name); }
                }}>
                  <option value="">Select person</option>
                  {people.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                </select>
              )}
              {baAttributeType==="group"&&(
                <select style={inp} value={baAttributedTo} onChange={e=>{
                  const gid=e.target.value;
                  setBaAttributedTo(gid);
                  if(!baName.trim()){ const g=groups.find(x=>x.id===gid); if(g) setBaName(g.name); }
                }}>
                  <option value="">Select group</option>
                  {groups.map(g=><option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                </select>
              )}
              {baAttributeType==="vehicle"&&(
                <select style={inp} value={baAttributedTo} onChange={e=>{
                  const vid=e.target.value;
                  setBaAttributedTo(vid);
                  if(!baName.trim()){ const v=vehicles.find(x=>x.id===vid); if(v) setBaName(v.name||v.number||"Vehicle"); }
                }}>
                  <option value="">Select vehicle</option>
                  {vehicles.map(v=><option key={v.id} value={v.id}>{v.name||v.number||"Vehicle"}{v.number?` · ${v.number}`:""}</option>)}
                </select>
              )}
              {baAttributeType==="house"&&<div style={{ color:T.sub,fontSize:10,marginTop:4 }}>Shared household expense.</div>}
            </div>
            <div>
              <span style={lbl}>Note (optional)</span>
              <input style={inp} placeholder="Any notes about this biller" value={baNote} onChange={e=>setBaNote(e.target.value)}/>
            </div>
            {/* Subscription fields */}
            {isSubType&&(
              <div style={{ background:T.input,borderRadius:12,padding:"12px" }}>
                <div style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5,marginBottom:10 }}>SUBSCRIPTION / MEMBERSHIP</div>
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                    <div><span style={lbl}>Start Date</span><input style={inp} type="date" value={baSubStart} onChange={e=>setBaSubStart(e.target.value)}/></div>
                    <div><span style={lbl}>End / Renewal Date</span><input style={inp} type="date" value={baSubEnd} onChange={e=>setBaSubEnd(e.target.value)}/></div>
                  </div>
                  {daysToExpiry!==null&&(
                    <div style={{ background:daysToExpiry<=7?T.danger+"16":daysToExpiry<=30?T.warn+"16":T.success+"16",border:`1px solid ${daysToExpiry<=7?T.danger:daysToExpiry<=30?T.warn:T.success}33`,borderRadius:10,padding:"8px 12px",display:"flex",justifyContent:"space-between" }}>
                      <span style={{ color:T.sub,fontSize:11 }}>{daysToExpiry<0?"Expired":"Expires in"}</span>
                      <span style={{ color:daysToExpiry<=7?T.danger:daysToExpiry<=30?T.warn:T.success,fontSize:12,fontWeight:800 }}>{daysToExpiry<0?`${Math.abs(daysToExpiry)} days ago`:`${daysToExpiry} days`}</span>
                    </div>
                  )}
                  <div>
                    <span style={lbl}>Billing Cycle</span>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                      {["monthly","quarterly","halfyearly","annual"].map(c=>(
                        <button key={c} onClick={()=>setBaBillingCycle(c)} style={{ background:baBillingCycle===c?T.accent+"22":"none",border:`1px solid ${baBillingCycle===c?T.accent:T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:baBillingCycle===c?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                    <span style={{ color:T.sub,fontSize:12 }}>Auto-renewal</span>
                    <button onClick={()=>setBaAutoRenew(v=>!v)} style={{ background:baAutoRenew?T.success+"22":"none",border:`1px solid ${baAutoRenew?T.success:T.border}`,borderRadius:20,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700,color:baAutoRenew?T.success:T.sub,fontFamily:"Nunito,sans-serif" }}>{baAutoRenew?"ON":"OFF"}</button>
                  </div>
                </div>
              </div>
            )}
            {duplicateError&&<div style={{ background:T.danger+"18",border:`1px solid ${T.danger}44`,borderRadius:10,padding:"8px 12px",color:T.danger,fontSize:11,fontWeight:700 }}>{duplicateError}</div>}
            <button onClick={handleSave} disabled={!canSave} style={{ background:canSave?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:canSave?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>{isEdit?"Save Changes":"Add Biller Account"}</button>
          </div>
        </div>
      </div>
    );
  };


  // -- ADD MEMBERSHIP MODAL --------------------------------------------------
  const AddMembershipModal = ({ billerAccount, existing, onClose }) => {
    const isEdit = !!existing;
    const [memberPersonId, setMemberPersonId] = useState(existing?.personId||"self");
    const [amount, setAmount] = useState(existing?.amount?String(existing.amount):"");
    const [cycle, setCycle] = useState(existing?.cycle||"monthly");
    const [validFrom, setValidFrom] = useState(existing?.validFrom||todayStr());
    const [graceDays, setGraceDays] = useState(existing?.graceDays?String(existing.graceDays):"0");
    const [bulkMonths, setBulkMonths] = useState("1");
    const [accId, setAccId] = useState(existing?.accId||accounts.find(a=>a.type!=="cc")?.id||"");

    const cycleMonths = { monthly:1, quarterly:3, halfyearly:6, annual:12 };
    const totalMonths = Number(bulkMonths) * (cycleMonths[cycle]||1);
    const validUntil = (() => {
      if(!validFrom) return "";
      const d = new Date(validFrom);
      d.setMonth(d.getMonth() + totalMonths);
      d.setDate(d.getDate() + Number(graceDays||0));
      d.setDate(d.getDate()-1);
      return d.toISOString().split("T")[0];
    })();
    const daysLeft = validUntil ? Math.round((new Date(validUntil)-new Date())/(1000*60*60*24)) : null;

    const handleSave = () => {
      if(!amount||!validFrom) return;
      const record = {
        id: existing?.id||genId(),
        billerAccountId: billerAccount.id,
        personId: memberPersonId,
        amount: parseFloat(amount),
        cycle,
        bulkMonths: Number(bulkMonths),
        graceDays: Number(graceDays||0),
        validFrom,
        validUntil,
        accId,
        paidDate: todayStr(),
        createdAt: existing?.createdAt||Date.now(),
        status: "active",
      };
      setMemberships(prev=>isEdit?prev.map(x=>x.id===existing.id?record:x):[...prev,record]);
      onClose();
    };

    const memberPerson = memberPersonId==="self" ? null : people.find(p=>String(p.id)===String(memberPersonId));
    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"88vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
            <div>
              <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{isEdit?"Edit Membership":"Add Membership"}</div>
              <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{getBillerIcon(billerAccount.type)} {billerAccount.name}</div>
            </div>
            <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div>
              <span style={lbl}>Member</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                <button onClick={()=>setMemberPersonId("self")} style={{ background:memberPersonId==="self"?T.accent+"22":"none",border:`1px solid ${memberPersonId==="self"?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,color:memberPersonId==="self"?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>Me</button>
                {people.map(p=>(
                  <button key={p.id} onClick={()=>setMemberPersonId(String(p.id))} style={{ background:memberPersonId===String(p.id)?T.accent+"22":"none",border:`1px solid ${memberPersonId===String(p.id)?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,color:memberPersonId===String(p.id)?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>
                ))}
              </div>
            </div>
            <div>
              <span style={lbl}>Billing Cycle</span>
              <div style={{ display:"flex",gap:6 }}>
                {["monthly","quarterly","halfyearly","annual"].map(c=>(
                  <button key={c} onClick={()=>setCycle(c)} style={{ flex:1,background:cycle===c?T.accent+"22":"none",border:`1px solid ${cycle===c?T.accent:T.border}`,borderRadius:10,padding:"6px 4px",cursor:"pointer",fontSize:10,fontWeight:700,color:cycle===c?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div><span style={lbl}>Amount (per cycle)</span><input style={inp} type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
              <div><span style={lbl}>No. of cycles paying</span><input style={inp} type="number" min="1" placeholder="1" value={bulkMonths} onChange={e=>setBulkMonths(e.target.value)}/></div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div><span style={lbl}>Valid From</span><input style={inp} type="date" value={validFrom} onChange={e=>setValidFrom(e.target.value)}/></div>
              <div><span style={lbl}>Grace Days</span><input style={inp} type="number" min="0" placeholder="0" value={graceDays} onChange={e=>setGraceDays(e.target.value)}/></div>
            </div>
            {validUntil&&(
              <div style={{ background:daysLeft>=0?T.success+"16":T.danger+"16",border:`1px solid ${daysLeft>=0?T.success:T.danger}33`,borderRadius:12,padding:"10px 14px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <span style={{ color:T.sub,fontSize:11 }}>Valid Until</span>
                  <span style={{ color:daysLeft>=0?T.success:T.danger,fontSize:13,fontWeight:800 }}>{formatShortDate(validUntil)||validUntil}</span>
                </div>
                <div style={{ color:T.sub,fontSize:10,marginTop:4 }}>
                  {Number(bulkMonths)>1?`${bulkMonths} cycles paid`:""}{Number(graceDays)>0?` + ${graceDays} grace days`:""}
                  {daysLeft!==null&&` — ${daysLeft>=0?`${daysLeft} days remaining`:"Expired"}`}
                </div>
              </div>
            )}
            <div>
              <span style={lbl}>Paid From Account</span>
              <select style={inp} value={accId} onChange={e=>setAccId(e.target.value)}>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <button onClick={handleSave} disabled={!amount||!validFrom} style={{ background:amount&&validFrom?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:amount&&validFrom?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>{isEdit?"Save Changes":"Add Membership"}</button>
          </div>
        </div>
      </div>
    );
  };

  // -- ADD FEE PAYMENT MODAL -------------------------------------------------
  // -- ADD GIFT MODAL --------------------------------------------------
  const GIFT_OCCASIONS = ["Birthday","Diwali","Eid","Christmas","Wedding","Anniversary","Navratri","Holi","Baby Shower","Graduation","New Year","Just Because","Other"];

  const AddGiftModal = ({ personId, onClose }) => {
    const person = people.find(p=>String(p.id)===String(personId));
    const [amount, setAmount] = useState("");
    const [fromWhom, setFromWhom] = useState("");
    const [occasion, setOccasion] = useState("");
    const [date, setDate] = useState(todayStr());
    const [note, setNote] = useState("");

    const handleSave = () => {
      if(!amount||!fromWhom) return;
      const record = {
        id: genId(),
        personId: String(personId),
        amount: parseFloat(amount),
        fromWhom: fromWhom.trim(),
        occasion: occasion||"Other",
        date,
        note: note.trim(),
        createdAt: Date.now(),
      };
      setGifts(prev=>[record,...prev]);
      onClose();
    };

    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
            <div>
              <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>🎁 Add Gift</div>
              {person&&<div style={{ color:T.sub,fontSize:11,marginTop:2 }}>for {person.emoji} {person.name}</div>}
            </div>
            <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>×</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div>
              <span style={lbl}>Amount ({sym}) *</span>
              <input style={{ ...inp,fontSize:20,fontWeight:800,textAlign:"center" }} type="text" inputMode="decimal" placeholder="0" value={amount} onChange={e=>setAmount(cleanMoneyInput(e.target.value))}/>
            </div>
            <div>
              <span style={lbl}>From *</span>
              <input style={inp} placeholder="e.g. Nana, Dadi, Sachin Masa" value={fromWhom} onChange={e=>setFromWhom(e.target.value)}/>
            </div>
            <div>
              <span style={lbl}>Date</span>
              <input style={inp} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
            <div>
              <span style={lbl}>Occasion</span>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {GIFT_OCCASIONS.map(o=>(
                  <button key={o} onClick={()=>setOccasion(occasion===o?"":o)} style={{ background:occasion===o?T.accent+"22":"none",border:`1px solid ${occasion===o?T.accent:T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:occasion===o?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{o}</button>
                ))}
              </div>
            </div>
            <div>
              <span style={lbl}>Note (optional)</span>
              <input style={inp} placeholder="e.g. Cash in envelope" value={note} onChange={e=>setNote(e.target.value)}/>
            </div>
            <button onClick={handleSave} disabled={!amount||!fromWhom} style={{ background:amount&&fromWhom?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:amount&&fromWhom?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>Save Gift</button>
          </div>
        </div>
      </div>
    );
  };

  const AddFeePaymentModal = ({ billerAccount, onClose }) => {
    const [amount, setAmount] = useState("");
    const [payDate, setPayDate] = useState(todayStr());
    const [monthsFrom, setMonthsFrom] = useState(todayStr().slice(0,7));
    const [monthCount, setMonthCount] = useState("1");
    const [accId, setAccId] = useState(accounts.find(a=>a.type!=="cc")?.id||"");
    const [note, setNote] = useState("");

    const monthsArr = (() => {
      const arr = [];
      const start = new Date(monthsFrom+"-01");
      for(let i=0;i<Number(monthCount);i++){
        const d = new Date(start);
        d.setMonth(d.getMonth()+i);
        arr.push(d.toISOString().slice(0,7));
      }
      return arr;
    })();
    const perMonth = amount && monthCount ? Math.round(parseFloat(amount)/Number(monthCount)) : 0;

    const handleSave = () => {
      if(!amount||!payDate) return;
      const record = {
        id: genId(),
        billerAccountId: billerAccount.id,
        amount: parseFloat(amount),
        payDate,
        monthsFrom,
        monthCount: Number(monthCount),
        monthsArr,
        perMonth,
        accId,
        note: note.trim(),
        createdAt: Date.now(),
      };
      setFeePayments(prev=>[record,...prev]);
      onClose();
    };

    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"88vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
            <div>
              <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>Add Fee Payment</div>
              <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{getBillerIcon(billerAccount.type)} {billerAccount.name}</div>
            </div>
            <button onClick={onClose} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div>
              <span style={lbl}>Total Amount Paid</span>
              <input style={{ ...inp,fontSize:20,fontWeight:800,textAlign:"center" }} type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <div><span style={lbl}>Payment Date</span><input style={inp} type="date" value={payDate} onChange={e=>setPayDate(e.target.value)}/></div>
              <div><span style={lbl}>No. of Months</span><input style={inp} type="number" min="1" max="12" placeholder="1" value={monthCount} onChange={e=>setMonthCount(e.target.value)}/></div>
            </div>
            <div>
              <span style={lbl}>Covers From (Month)</span>
              <input style={inp} type="month" value={monthsFrom} onChange={e=>setMonthsFrom(e.target.value)}/>
            </div>
            {monthsArr.length>0&&(
              <div style={{ background:T.input,borderRadius:12,padding:"10px 14px" }}>
                <div style={{ color:T.sub,fontSize:11,fontWeight:700,marginBottom:8 }}>MONTHLY DISTRIBUTION</div>
                {monthsArr.map(m=>(
                  <div key={m} style={{ display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}` }}>
                    <span style={{ color:T.sub,fontSize:12 }}>{m}</span>
                    <span style={{ color:T.accent,fontSize:12,fontWeight:800 }}>{sym}{fmt(perMonth)}</span>
                  </div>
                ))}
                <div style={{ display:"flex",justifyContent:"space-between",marginTop:6 }}>
                  <span style={{ color:T.sub,fontSize:11 }}>Total</span>
                  <span style={{ color:T.text,fontSize:13,fontWeight:900 }}>{sym}{fmt(parseFloat(amount)||0)}</span>
                </div>
              </div>
            )}
            <div>
              <span style={lbl}>Paid From</span>
              <select style={inp} value={accId} onChange={e=>setAccId(e.target.value)}>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Note (optional)</span>
              <input style={inp} placeholder="e.g. Term 2 fees" value={note} onChange={e=>setNote(e.target.value)}/>
            </div>
            <button onClick={handleSave} disabled={!amount||!payDate} style={{ background:amount&&payDate?T.accent:T.border,border:"none",borderRadius:14,padding:"13px",cursor:amount&&payDate?"pointer":"not-allowed",fontSize:14,fontWeight:800,color:"#fff",fontFamily:"Nunito,sans-serif",marginTop:4 }}>Add Fee Payment</button>
          </div>
        </div>
      </div>
    );
  };

  const AddBillModal = () => {
    const [billerAccountId,setBillerAccountId]=useState(defaultBillerAccountId||"");
    const selectedBA = billerAccountId ? billerAccounts.find(b=>b.id===billerAccountId) : null;
    const _preBA = defaultBillerAccountId ? billerAccounts.find(b=>b.id===defaultBillerAccountId) : null;
    const [name,setName]=useState(_preBA?.name||"");
    const [amount,setAmount]=useState("");
    const [billDate,setBillDate]=useState(todayStr());
    const [dueDate,setDueDate]=useState("");
    const [billCatIds,setBillCatIds]=useState([cats[0]?.id||""]);
    const [subId,setSubId]=useState("");
    const [recurring,setRecurring]=useState(false);
    const [frequency,setFrequency]=useState("monthly");
    const [merchant,setMerchant]=useState(_preBA?.provider||_preBA?.name||"");
    const [billPhoto,setBillPhoto]=useState(null);
    const [invoiceNo,setInvoiceNo]=useState("");
    const [billerCategory,setBillerCategory]=useState(_preBA?.type||"");
    const [consumerNumber,setConsumerNumber]=useState(_preBA?.consumerNo||"");
    const [lastPaidAmount,setLastPaidAmount]=useState("");
    const [autoGenerate,setAutoGenerate]=useState(true);
    const [billPeriodFrom,setBillPeriodFrom]=useState("");
    const [billPeriodTo,setBillPeriodTo]=useState("");
    // Prepaid recharge fields
    const isRecharge = ["Mobile Prepaid","Fastag","Metro Recharge","NCMC Recharge","EV Recharge","Prepaid Meter","DTH"].includes(billerCategory);
    const [validityDays,setValidityDays]=useState("");
    const [planType,setPlanType]=useState("");
    const [planDesc,setPlanDesc]=useState("");
    const [validFrom2,setValidFrom2]=useState(todayStr());
    const validUntilCalc = validityDays && validFrom2 ? (()=>{ const d=new Date(validFrom2); d.setDate(d.getDate()+Number(validityDays)); return d.toISOString().split("T")[0]; })() : "";
    // Split state
    const [billSplitPeople,setBillSplitPeople]=useState({});
    const [billGroup,setBillGroup]=useState("");
    const [splitCalc,setSplitCalc]=useState("equally");
    const [splitCustom,setSplitCustom]=useState({});

    const selectedPids=Object.entries(billSplitPeople).filter(([,v])=>v).map(([k])=>k);
    const amt=parseFloat(amount)||0;
    const normalizedInvoiceNo = String(invoiceNo||"").trim().toLowerCase();
    const duplicateInvoiceBill = normalizedInvoiceNo
      ? bills.find(row=>String(row.invoiceNo||"").trim().toLowerCase()===normalizedInvoiceNo)
      : null;

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
      if(!name.trim()||!parseFloat(amount) || duplicateInvoiceBill) return;
      const shares=calcShares();
      const peopleSplit={};
      Object.entries(shares).forEach(([pid,sh])=>{ const p=getPerson(pid); peopleSplit[pid]={amount:sh,mode:p.personType!=="dependant"?"owes":"spent_on"}; });
      const owedByOthers = Object.entries(peopleSplit).reduce((sum,[,info])=>sum+(info.mode==="owes"?Number(info.amount||0):0),0);
      const myShare = billIncludeMe ? Math.max(0, amt-owedByOthers) : 0;
      const groupCollectiveAmount = billGroup ? Math.max(0, amt-owedByOthers-myShare) : 0;
      const newBill={id:genId(),name:name.trim(),merchant:merchant.trim()||name.trim(),invoiceNo:invoiceNo.trim(),amount:amt,dueDate,catId:billCatIds[0]||null,catIds:billCatIds,subId:subId||null,recurring,frequency,status:"unpaid",paidDate:null,billDate:billDate||todayStr(),createdDate:todayStr(),createdAt:Date.now(),splitPeople:peopleSplit,groupId:billGroup||null,groupCollectiveAmount,myShare,imageBase64:billPhoto,billerAccountId:billerAccountId||null,billerCategory:billerCategory||null,consumerNumber:consumerNumber.trim()||null,lastPaidAmount:lastPaidAmount?parseFloat(lastPaidAmount):null,autoGenerate,isPaused:false,pausedDate:null,resumeDate:null,pauseReason:null,pausedDays:0,validityDays:validityDays?Number(validityDays):null,planType:planType||null,planDesc:planDesc.trim()||null,validFrom:validFrom2||null,validUntil:validUntilCalc||null,billPeriodFrom:billPeriodFrom||null,billPeriodTo:billPeriodTo||null};
      setBills(p=>[newBill,...p]);

      const matchingTxn = txns.find(t=>t.type==="expense" && !t.isBillPayment && !t.paidBillId && Number(t.amount)===amt && (billCatIds[0]? t.catId===billCatIds[0] : true));
      if(matchingTxn){
        setBillMatchSuggestion({bill:newBill,txn:matchingTxn});
      }

      setShowAddBill(false);
      setDefaultBillerAccountId("");
    };

    return (
      <div onClick={e=>e.target===e.currentTarget&&setShowAddBill(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
        <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"92vh",overflowY:"auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>📅 Add Bill</div>
            <button onClick={()=>setShowAddBill(false)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>

            <input style={{ ...inp,fontSize:17,fontWeight:700,border:`1px solid ${!name.trim()?T.danger+"66":T.border}` }} placeholder="Bill name * e.g. Common Meter Electric" value={name} onChange={e=>setName(e.target.value)}/>
            <input style={inp} placeholder="Biller / issuer (optional) e.g. Goa Electricity Dept" value={merchant} onChange={e=>setMerchant(e.target.value)}/>
            <input style={{ ...inp,border:`1px solid ${duplicateInvoiceBill?T.danger+"66":T.border}` }} placeholder="Bill number / invoice no. (unique) e.g. MSojo123" value={invoiceNo} onChange={e=>setInvoiceNo(e.target.value)}/>
            {duplicateInvoiceBill && <div style={{ color:T.danger,fontSize:10,fontWeight:700,marginTop:-4 }}>This invoice number already exists for {duplicateInvoiceBill.name}.</div>}



            <div>
              <span style={lbl}>Amount ({sym}) *</span>
              <input style={{ ...inp,fontSize:20,fontWeight:800,textAlign:"center",border:`1px solid ${amount&&parseFloat(amount)>0?T.border:T.danger+"66"}` }} type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              {/* Prepaid recharge fields */}
              {isRecharge&&(
                <div style={{ gridColumn:"1/-1",background:T.input,borderRadius:12,padding:"12px",display:"flex",flexDirection:"column",gap:8 }}>
                  <div style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5 }}>RECHARGE DETAILS</div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                    <div><span style={lbl}>Recharge Date</span><input style={inp} type="date" value={validFrom2} onChange={e=>setValidFrom2(e.target.value)}/></div>
                    <div><span style={lbl}>Validity (days)</span><input style={inp} type="number" placeholder="28, 84, 365" value={validityDays} onChange={e=>setValidityDays(e.target.value)}/></div>
                  </div>
                  {validUntilCalc&&<div style={{ background:T.success+"16",borderRadius:10,padding:"8px 12px",display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:11 }}>Valid Until</span><span style={{ color:T.success,fontSize:12,fontWeight:800 }}>{formatShortDate(validUntilCalc)||validUntilCalc}</span></div>}
                  <div><span style={lbl}>Plan Type</span><div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>{["Voice+Data","Data Only","Unlimited Calls","SMS+Voice"].map(pt=>(<button key={pt} onClick={()=>setPlanType(p=>p===pt?"":pt)} style={{ background:planType===pt?T.accent+"22":"none",border:`1px solid ${planType===pt?T.accent:T.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:planType===pt?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{pt}</button>))}</div></div>
                  <div><span style={lbl}>Plan Details</span><input style={inp} placeholder="e.g. 1.5GB/day + unlimited calls" value={planDesc} onChange={e=>setPlanDesc(e.target.value)}/></div>
                </div>
              )}
              <div><span style={lbl}>Bill Date (generated on)</span><input style={inp} type="date" value={billDate} onChange={e=>setBillDate(e.target.value)}/></div>
              <div><span style={lbl}>Due Date (pay by)</span><input style={inp} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
              <div><span style={lbl}>Period From (optional)</span><input style={inp} type="date" value={billPeriodFrom} onChange={e=>setBillPeriodFrom(e.target.value)}/></div>
              <div><span style={lbl}>Period To (optional)</span><input style={inp} type="date" value={billPeriodTo} onChange={e=>setBillPeriodTo(e.target.value)}/></div>
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
                <button onClick={()=>{setBillSplitPeople({});setBillGroup("");}} style={{ background:selectedPids.length===0&&!billGroup?"#88888822":"none",border:`1px solid ${selectedPids.length===0&&!billGroup?"#888888":T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>None — just me</button>
                {groups.map(g=><button key={g.id} onClick={()=>handleGroupSelect(billGroup===g.id?"":g.id)} style={{ background:billGroup===g.id?g.color+"22":"none",border:`1px solid ${billGroup===g.id?g.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:billGroup===g.id?g.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{g.icon} {g.name}</button>)}
              </div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:selectedPids.length>0?10:0 }}>
                {(billGroup ? people.filter(p=>!p.isMe && (getGroup(billGroup)?.members||[]).includes(p.id)) : people.filter(p=>!p.isMe)).map(p=><button key={p.id} onClick={()=>setBillSplitPeople(prev=>({...prev,[p.id]:!prev[p.id]}))} style={{ background:billSplitPeople[p.id]?p.color+"22":"none",border:`1px solid ${billSplitPeople[p.id]?p.color:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:billSplitPeople[p.id]?p.color:T.sub,fontFamily:"Nunito,sans-serif" }}>{p.emoji} {p.name}</button>)}
              </div>

              {selectedPids.length>0&&<>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
                  {[["equally","= Equal"],["amount","₹ Amount"],["percent","% Percent"],["share","⚖️ Share"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setSplitCalc(v)} style={{ background:splitCalc===v?T.accent+"22":"none",border:`1px solid ${splitCalc===v?T.accent:T.border}`,borderRadius:20,padding:"5px 10px",cursor:"pointer",fontSize:10,fontWeight:700,color:splitCalc===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
                  ))}
                </div>
                <div style={{ background:T.input,borderRadius:10,padding:"10px 12px" }}>
                  {/* My share row */}
                  {(()=>{ const shares=calcShares(); const myS=amt-Object.values(shares).reduce((s,v)=>s+v,0); return <div style={{ display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}`,marginBottom:6 }}><span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>🧑 My share</span><span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>{sym}{fmt(Math.max(0,myS))}</span></div>; })()}
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
                <label htmlFor="recurring" style={{ color:T.text,fontSize:14,fontWeight:700,cursor:"pointer" }}>🔁 Recurring bill</label>
              </div>
              {recurring&&<div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {[["monthly","Monthly"],["quarterly","Quarterly"],["halfyearly","Half-yearly"],["yearly","Yearly"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setFrequency(v)} style={{ background:frequency===v?T.accent+"22":"none",border:`1px solid ${frequency===v?T.accent:T.border}`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:frequency===v?T.accent:T.sub,fontFamily:"Nunito,sans-serif" }}>{l}</button>
                ))}
              </div>}
            </div>

            {/* Bill photo — optional */}
            <div style={{ background:T.input,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10 }}>
              <span>📷</span>
              <span style={{ color:T.sub,fontSize:13,fontWeight:700,flex:1 }}>Attach Bill Photo (optional)</span>
              <label style={{ background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>
                {billPhoto?"Change":"Upload"}
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setBillPhoto(ev.target.result); r.readAsDataURL(f); }}/>
              </label>
              {billPhoto&&<button onClick={()=>setBillPhoto(null)} style={{ background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:16 }}>✕</button>}
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

    // ── EDIT PERSON MODAL ────────────────────────────────────────────────────────
  const EditPersonModal = ({ p, onClose }) => {
    const [name,setName]=useState(p.name||"");
    const [emoji,setEmoji]=useState(p.emoji||"👤");
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
            <button onClick={onClose} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
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
              {["👤","👨","👩","👶","👴","👵","🐕"].map(em=><button key={em} onClick={()=>setEmoji(em)} style={{ background:emoji===em?T.accentSoft:"none",border:`1px solid ${emoji===em?T.accent:T.border}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:18 }}>{em}</button>)}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              {[["contact","🤝 Contact","They may owe you"],["dependant","♥ Dependant","Family, you cover them"]].map(([v,l,sub])=>(
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
              <button onClick={save} style={btnP}>Save Changes ✓</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TABS=[
    {id:"home",icon:"🏠",label:"Home"},
    {id:"transactions",icon:"📋",label:"Txns"},
    {id:"bills",icon:"📅",label:"Bills"},
    {id:"wealth",icon:"📈",label:"Wealth"},
    {id:"settings_tab",icon:"⚙️",label:"Settings"}
  ];

  const [wealthUnlocked, setWealthUnlocked] = useState(false);
  const [showWealthPin, setShowWealthPin] = useState(false);
  const hasAppPin = Boolean(localStorage.getItem("arth_pin")||"");

  const handleTab=t=>{
    if(t==="settings_tab"){ setShowWealthPin(false); setShowSettings(true); setSettingsSection(null); return; }
    if(t==="wealth"){
      if(!hasAppPin){ setShowWealthPin(false); setShowSettings(true); setSettingsSection("security_pin_change"); return; }
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
            <div style={{ width:32,height:32,borderRadius:9,background:T.accentSoft,border:`1px solid ${T.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:900,color:T.accent,fontFamily:"Nunito,sans-serif" }}>₹</div>
            <div>
              <div style={{ color:T.text,fontSize:16,fontWeight:900,lineHeight:1 }}>Arth</div>
              <div style={{ color:T.sub,fontSize:9,marginTop:1,textTransform:"uppercase",letterSpacing:1 }}>Personal Finance</div>
            </div>
          </div>
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <button onClick={()=>setWorkTripMode(m=>!m)} title={workTripMode?"Work Trip Mode ON — tap to turn off":"Work Trip Mode OFF — tap to auto-mark expenses as reimbursable"} style={{ background:workTripMode?"#f0a50022":"none",border:`1px solid ${workTripMode?"#f0a500":T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:12,fontWeight:700,color:workTripMode?"#f0a500":T.sub,fontFamily:"Nunito,sans-serif" }}>💼{workTripMode?" ON":""}</button>
            <button onClick={()=>{ setShowSearch(true); setSearchQuery(""); }} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:15,color:T.sub }} title="Search">🔍</button>
            <button onClick={toggleMask} style={{ background:maskMode?T.warn+"22":"none",border:`1px solid ${maskMode?T.warn:T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:15,color:maskMode?T.warn:T.sub }} title={maskMode?"Tap to reveal (PIN) or disable":"Tap to hide amounts"}>{maskMode?"🙈":"👁️"}</button>
            <button onClick={onLock} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:15,color:T.sub }} title="Lock app">🔒</button>

            <button onClick={()=>{ if(tab==="bills") setShowAddBill(true); else { const typeMap={"expense":"expense","income":"income","transfer":"transfer","cc_payment":"cc_payment","investment":"investment","settlement_in":"settlement_in"}; setDefaultAddType(typeMap[fType]||"expense"); setShowAdd(true); } }} style={{ background:T.accent,border:"none",color:"#000",borderRadius:10,padding:"6px 16px",cursor:"pointer",fontSize:13,fontWeight:900,fontFamily:"Nunito,sans-serif" }}>{tab==="bills"?"+ Add Bill":"+ Add"}</button>
          </div>
        </div>}

        {/* Pages */}
        {!showSettings&&tab==="home"&&<Home/>}
        {!showSettings&&tab==="transactions"&&<Transactions/>}
        {!showSettings&&tab==="people"&&<People/>}
        {!showSettings&&tab==="budget"&&<BudgetPage/>}
        {!showSettings&&tab==="bills"&&<BillsPage/>}
        {!showSettings&&tab==="wealth"&&wealthUnlocked&&<WealthPage/>}
        {showSettings&&<Settings/>}

      {/* Universal Search Overlay */}
      {showSearch&&(
        <div style={{ position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.97)",display:"flex",flexDirection:"column",padding:"16px 16px 0" }}>
          <div style={{ display:"flex",gap:10,alignItems:"center",marginBottom:14 }}>
            <input
              autoFocus
              placeholder="Search transactions, bills, people, groups…"
              value={searchQuery}
              onChange={e=>setSearchQuery(e.target.value)}
              style={{ flex:1,background:"#1e1e28",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 14px",color:"#fff",fontSize:15,fontFamily:"Nunito,sans-serif",outline:"none" }}
            />
            <button onClick={()=>{ setShowSearch(false); setSearchQuery(""); }} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:14,color:T.sub,fontFamily:"Nunito,sans-serif",flexShrink:0 }}>✕</button>
          </div>
          {searchQuery.length>=2&&searchResults.length===0&&(
            <div style={{ color:T.sub,fontSize:13,textAlign:"center",marginTop:40 }}>No results for "{searchQuery}"</div>
          )}
          {searchQuery.length<2&&(
            <div style={{ color:T.sub,fontSize:12,textAlign:"center",marginTop:40 }}>Type at least 2 characters to search</div>
          )}
          <div style={{ overflowY:"auto",flex:1,paddingBottom:80 }}>
            {searchResults.map(r=>{
              const kindColor = r.kind==="txn"?T.accent:r.kind==="bill"?T.warn:r.kind==="person"?"#a855f7":r.kind==="group"?"#22c55e":T.sub;
              const kindLabel = {txn:"TXN",bill:"BILL",person:"PERSON",group:"GROUP",cat:"CAT"}[r.kind]||r.kind.toUpperCase();
              const handleResultTap = ()=>{
                setShowSearch(false); setSearchQuery("");
                if(r.kind==="person"){ setSelectedPerson(r.item); setTab("people"); setShowSettings(false); }
                else if(r.kind==="group"){ setSelectedGroup(r.item); setTab("people"); setShowSettings(false); }
                else if(r.kind==="txn"||r.kind==="bill"){ setTab("transactions"); setShowSettings(false); }
              };
              return (
                <div key={r.key} onClick={handleResultTap} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,marginBottom:8,background:"#1e1e28",cursor:"pointer",border:`1px solid ${T.border}` }}>
                  <div style={{ width:34,height:34,borderRadius:9,background:kindColor+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:kindColor,flexShrink:0,letterSpacing:0.3 }}>{kindLabel}</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ color:"#fff",fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{r.title}</div>
                    <div style={{ color:T.sub,fontSize:11,marginTop:2 }}>{r.sub}</div>
                  </div>
                  <span style={{ color:T.sub,fontSize:16 }}>›</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showWealthPin&&hasAppPin&&(
          <div style={{ position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.92)" }}>
            <PinScreen isSetup={false} onUnlock={async pin=>{ const stored=localStorage.getItem("arth_pin")||""; const match=stored.length<=6?String(pin)===stored:(await hashPin(pin))===stored; if(match){ if(stored.length<=6){ const h=await hashPin(pin); localStorage.setItem("arth_pin",h); } setWealthUnlocked(true); setShowWealthPin(false); setTab("wealth"); } }}/>
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
        {showTxnUpiPicker&&pendingTxnShare&&(
          <div style={{ position:"fixed",inset:0,background:"#0009",zIndex:900,display:"flex",alignItems:"flex-end",justifyContent:"center" }} onClick={()=>setShowTxnUpiPicker(false)}>
            <div style={{ background:T.card,borderRadius:"18px 18px 0 0",padding:24,width:"100%",maxWidth:480 }} onClick={e=>e.stopPropagation()}>
              <div style={{ color:T.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:12 }}>Pay via which UPI?</div>
              {accounts.filter(a=>a.type==="upi"&&a.handle).map(a=>{
                const linked = a.linkedAccount ? accounts.find(b=>b.id===a.linkedAccount) : null;
                return (
                  <button key={a.id} onClick={()=>{ setShowTxnUpiPicker(false); doTxnShare(pendingTxnShare, a.handle); setPendingTxnShare(null); }} style={{ display:"block",width:"100%",textAlign:"left",background:T.input,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:8,color:T.text,fontFamily:"Nunito,sans-serif",fontSize:14,fontWeight:700,cursor:"pointer" }}>
                    {a.name} <span style={{ color:T.sub,fontWeight:400 }}>{a.handle}{linked?` - ${linked.name}`:""}</span>
                  </button>
                );
              })}
              <button onClick={()=>{ setShowTxnUpiPicker(false); doTxnShare(pendingTxnShare, ""); setPendingTxnShare(null); }} style={{ display:"block",width:"100%",textAlign:"center",background:"none",border:"none",color:T.sub,fontFamily:"Nunito,sans-serif",fontSize:13,cursor:"pointer",marginTop:4 }}>Share without UPI</button>
            </div>
          </div>
        )}
        {showAdd&&<AddModal defaultType={editTxn?editTxn.type||"expense":defaultAddType} prefillTxn={refundSourceTxn} prefill={addPrefill} editTxn={editTxn} onClose={()=>{ setShowAdd(false); setEditTxn(null); setAddPrefill(null); setRefundSourceTxn(null); }}/>}
        {showInvestments&&(
          <div onClick={e=>{ if(e.target===e.currentTarget){ setShowInvestments(false); setSelectedInvestmentTypeView("all"); } }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200 }}>
            <div style={{ background:T.card,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto",paddingBottom:40 }}>
              <Investments onClose={()=>{ setShowInvestments(false); setSelectedInvestmentTypeView("all"); }} />
            </div>
          </div>
        )}
        {showAddBill&&<AddBillModal/>}
        {showAddGift&&giftForPersonId&&<AddGiftModal personId={giftForPersonId} onClose={()=>{ setShowAddGift(false); setGiftForPersonId(null); }}/>}
        {editingBillerAccount&&<BillerAccountModal existing={editingBillerAccount} onClose={()=>setEditingBillerAccount(null)}/>}
        {attachExpensesFor&&<AttachExpensesModal ba={attachExpensesFor} onClose={()=>setAttachExpensesFor(null)}/>}
        {confirmDialog&&(
          <div onClick={e=>{ if(e.target===e.currentTarget) setConfirmDialog(null); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
            <div style={{ background:T.card,borderRadius:18,padding:"20px 18px",width:"100%",maxWidth:360 }}>
              <div style={{ color:T.text,fontSize:14,fontWeight:700,lineHeight:1.5,marginBottom:18,whiteSpace:"pre-line" }}>{confirmDialog.message}</div>
              <div style={{ display:"grid",gridTemplateColumns:confirmDialog.onConfirm?"1fr 1fr":"1fr",gap:10 }}>
                {confirmDialog.onConfirm&&<button onClick={()=>setConfirmDialog(null)} style={{ background:"none",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>Cancel</button>}
                <button onClick={()=>{ const fn=confirmDialog.onConfirm; setConfirmDialog(null); fn?.(); }} style={{ background:confirmDialog.onConfirm?T.danger:T.accent,border:"none",borderRadius:12,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:800,color:confirmDialog.onConfirm?"#fff":"#000",fontFamily:"Nunito,sans-serif" }}>{confirmDialog.onConfirm?"Confirm":"OK"}</button>
              </div>
            </div>
          </div>
        )}
        {showAddBillerAccount&&<BillerAccountModal existing={null} onClose={()=>{ setShowAddBillerAccount(false); setPreselectedBillerType(""); setPreselectedBillerProvider(""); setPreselectedBillerId(""); }}/>}
        {categoryAccountsView&&(()=>{
          const type = categoryAccountsView;
          const billersOfType = billers.filter(b=>b.type===type);
          return (
            <div onClick={e=>{ if(e.target===e.currentTarget) setCategoryAccountsView(null); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
              <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"80vh",overflowY:"auto" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <span style={{ fontSize:24 }}>{getBillerIcon(type)}</span>
                    <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{type}</div>
                  </div>
                  <button onClick={()=>setCategoryAccountsView(null)} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
                </div>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,marginBottom:10 }}>BILLERS ({billersOfType.length})</div>
                <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
                  {billersOfType.map(b=>{
                    const accs = billerAccounts.filter(ba=>ba.billerId===b.id);
                    const unpaidCount = accs.reduce((sum,ba)=>sum+bills.filter(bl=>String(bl.billerAccountId)===String(ba.id)&&bl.status==="unpaid").length,0);
                    return (
                      <div key={b.id} onClick={()=>{ setActiveBillerShell(b); setCategoryAccountsView(null); }} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",background:T.input,borderRadius:14,padding:"12px 14px",cursor:"pointer",border:`1px solid ${unpaidCount>0?T.danger+"44":T.border}` }}>
                        <div>
                          <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{b.name}</div>
                          <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{accs.length} account{accs.length!==1?"s":""}</div>
                        </div>
                        {unpaidCount>0&&<div style={{ background:T.danger,color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:800 }}>{unpaidCount} unpaid</div>}
                      </div>
                    );
                  })}
                </div>
                <button onClick={()=>{ setAddBillerPresetType(type); setShowAddBillerModal(true); setCategoryAccountsView(null); }} style={{ width:"100%",background:"none",border:`1px dashed ${T.border}`,borderRadius:14,padding:"12px",cursor:"pointer",fontSize:13,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>+ Add another {type} biller</button>
              </div>
            </div>
          );
        })()}
        {showAddBillerModal&&<AddBillerModal presetType={addBillerPresetType} onClose={()=>{ setShowAddBillerModal(false); setAddBillerPresetType(""); }} onCreated={shell=>setActiveBillerShell(shell)}/>}
        {activeBillerShell&&(()=>{
          const shell = activeBillerShell;
          const accs = billerAccounts.filter(ba=>ba.billerId===shell.id);
          return (
            <div onClick={e=>{ if(e.target===e.currentTarget) setActiveBillerShell(null); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
              <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"85vh",overflowY:"auto" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <span style={{ fontSize:24 }}>{getBillerIcon(shell.type)}</span>
                    <div>
                      <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>{shell.name}</div>
                      <div style={{ color:T.sub,fontSize:11 }}>{shell.type}</div>
                    </div>
                  </div>
                  <button onClick={()=>setActiveBillerShell(null)} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
                </div>
                <div style={{ color:T.sub,fontSize:10,fontWeight:700,letterSpacing:0.5,marginBottom:10 }}>ACCOUNTS ({accs.length})</div>
                <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
                  {accs.length===0&&<div style={{ color:T.sub,fontSize:12,textAlign:"center",padding:"16px 0" }}>No one added yet. Tap below to add Self, family, or anyone else.</div>}
                  {accs.map(ba=>{
                    const baBills = bills.filter(b=>String(b.billerAccountId)===String(ba.id));
                    const unpaidCount = baBills.filter(b=>b.status==="unpaid").length;
                    const lastBill = [...baBills].sort((a,b2)=>(b2.createdAt||0)-(a.createdAt||0))[0];
                    return (
                      <div key={ba.id} onClick={()=>{ setActiveBillerForAction(ba); setActiveBillerShell(null); }} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",background:T.input,borderRadius:14,padding:"12px 14px",cursor:"pointer",border:`1px solid ${unpaidCount>0?T.danger+"44":T.border}` }}>
                        <div>
                          <div style={{ color:T.text,fontSize:13,fontWeight:800 }}>{ba.name}</div>
                          <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{ba.consumerNo?`#${ba.consumerNo}`:"No account number yet"}</div>
                          {lastBill&&<div style={{ color:T.sub,fontSize:10,marginTop:2 }}>Last: {sym}{fmt(lastBill.amount)} · {formatShortDate(lastBill.date)||lastBill.date}</div>}
                        </div>
                        {unpaidCount>0&&<div style={{ background:T.danger,color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:800 }}>{unpaidCount} unpaid</div>}
                      </div>
                    );
                  })}
                </div>
                <button onClick={()=>{ setShowAddBillerAccount(true); setPreselectedBillerType(shell.type); setPreselectedBillerProvider(shell.provider||shell.name); setPreselectedBillerId(shell.id); setActiveBillerShell(null); }} style={{ width:"100%",background:"none",border:`1px dashed ${T.border}`,borderRadius:14,padding:"12px",cursor:"pointer",fontSize:13,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>+ Add Person / Account</button>
              </div>
            </div>
          );
        })()}
        {showAddMembership&&activeBillerForAction&&<AddMembershipModal billerAccount={activeBillerForAction} existing={editingMembership} onClose={()=>{ setShowAddMembership(false); setEditingMembership(null); }}/>}
        {showAddFeePayment&&activeBillerForAction&&<AddFeePaymentModal billerAccount={activeBillerForAction} onClose={()=>{ setShowAddFeePayment(false); setActiveBillerForAction(null); }}/>}
        {/* Biller Action Sheet */}
        {activeBillerForAction&&!showAddMembership&&!showAddFeePayment&&!showAddBill&&(()=>{
          const ba = activeBillerForAction;
          const actionType = getBillerActionType(ba.type);
          const baMemberships = memberships.filter(m=>m.billerAccountId===ba.id);
          const baFees = feePayments.filter(f=>f.billerAccountId===ba.id);
          const baBills = bills.filter(b=>String(b.billerAccountId)===String(ba.id));
          const activeMembership = baMemberships.filter(m=>m.validUntil>=todayStr()).sort((a,b2)=>b2.validUntil.localeCompare(a.validUntil))[0];
          return (
            <div onClick={e=>{ if(e.target===e.currentTarget) setActiveBillerForAction(null); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
              <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 16px 48px",width:"100%",maxWidth:430,maxHeight:"88vh",overflowY:"auto" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <span style={{ fontSize:28 }}>{getBillerIcon(ba.type)}</span>
                    <div>
                      <div style={{ color:T.text,fontSize:15,fontWeight:900 }}>{ba.name}</div>
                      <div style={{ color:T.sub,fontSize:11 }}>{ba.type}{ba.consumerNo?` · #${ba.consumerNo}`:""}</div>
                    </div>
                  </div>
                  <button onClick={()=>setActiveBillerForAction(null)} style={{ background:T.input,border:"none",color:T.sub,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>x</button>
                </div>
                {/* Per-person membership status */}
                {(()=>{
                  const allPersonIds = ["self",...people.map(p=>String(p.id))];
                  const personsWithMem = allPersonIds.filter(pid=>baMemberships.some(m=>String(m.personId)===pid));
                  if(personsWithMem.length===0) return null;
                  return (<div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
                    {personsWithMem.map(pid=>{
                      const personName = pid==="self"?"Me":(people.find(p=>String(p.id)===pid)?.name||"Unknown");
                      const personMems = baMemberships.filter(m=>String(m.personId)===pid).sort((a,b2)=>b2.validUntil.localeCompare(a.validUntil));
                      const latest = personMems[0];
                      const isActive = latest && latest.validUntil >= todayStr();
                      const daysLeft = latest ? Math.round((new Date(latest.validUntil)-new Date())/(1000*60*60*24)) : 0;
                      return (
                        <div key={pid} style={{ background:isActive?T.success+"16":T.danger+"16",border:`1px solid ${isActive?T.success:T.danger}33`,borderRadius:12,padding:"10px 14px" }}>
                          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                            <span style={{ color:isActive?T.success:T.danger,fontSize:12,fontWeight:800 }}>{isActive?"✅":"⚠️"} {personName}</span>
                            <span style={{ color:T.sub,fontSize:11 }}>{isActive?`Until ${formatShortDate(latest.validUntil)||latest.validUntil} (${daysLeft}d)`:"Lapsed"}</span>
                          </div>
                          {!isActive&&latest&&(
                            <div style={{ marginTop:8 }}>
                              <div style={{ color:T.sub,fontSize:10,marginBottom:6 }}>Last: {formatShortDate(latest.validUntil)||latest.validUntil}</div>
                              <button onClick={()=>{ setActiveBillerForAction(null); setDefaultAddType("expense"); setShowAdd(true); }} style={{ background:T.accent+"22",border:`1px solid ${T.accent}44`,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>🔄 Renew {personName}</button>
                            </div>
                          )}
                          <div style={{ marginTop:4,display:"flex",flexWrap:"wrap",gap:4 }}>
                            {personMems.slice(0,3).map(m=>(<span key={m.id} style={{ background:T.pill,borderRadius:20,padding:"1px 8px",fontSize:9,color:T.sub }}>{formatShortDate(m.validFrom)||m.validFrom} → {formatShortDate(m.validUntil)||m.validUntil}</span>))}
                          </div>
                        </div>
                      );
                    })}
                  </div>);
                })()}
                {/* Actions */}
                <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
                  {(actionType==="membership"||actionType==="hybrid")&&(
                    <button onClick={()=>setShowAddMembership(true)} style={{ background:T.accent+"22",border:`1px solid ${T.accent}33`,borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:T.accent,fontFamily:"Nunito,sans-serif" }}>💪 Add Membership / Renew</button>
                  )}
                  {(actionType==="bill"||actionType==="hybrid")&&(
                    <button onClick={()=>{ setDefaultBillerAccountId(ba.id); setShowAddBill(true); setActiveBillerForAction(null); }} style={{ background:T.info+"22",border:`1px solid ${T.info}33`,borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:T.info,fontFamily:"Nunito,sans-serif" }}>📄 Add Bill</button>
                  )}
                  {actionType==="membership"&&(
                    <button onClick={()=>setShowAddFeePayment(true)} style={{ background:T.warn+"22",border:`1px solid ${T.warn}33`,borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:T.warn,fontFamily:"Nunito,sans-serif" }}>🏫 Add Fee Payment (multi-month)</button>
                  )}
                  <button onClick={()=>{ setAttachExpensesFor(ba); }} style={{ background:T.purple+"22",border:`1px solid ${T.purple}33`,borderRadius:14,padding:"13px",cursor:"pointer",fontSize:14,fontWeight:800,color:T.purple,fontFamily:"Nunito,sans-serif" }}>🔗 Attach Past Expenses</button>
                </div>
                {/* History */}
                {baMemberships.length>0&&(
                  <div style={{ marginBottom:12 }}>
                    <div style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5,marginBottom:8 }}>MEMBERSHIP HISTORY</div>
                    {baMemberships.sort((a,b2)=>b2.createdAt-a.createdAt).slice(0,5).map(m=>(
                      <div key={m.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}` }}>
                        <div>
                          <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{people.find(p=>String(p.id)===String(m.personId))?.name||"Me"} · {m.cycle}</div>
                          <div style={{ color:T.sub,fontSize:10 }}>{formatShortDate(m.validFrom)||m.validFrom} to {formatShortDate(m.validUntil)||m.validUntil}{m.graceDays>0?` (+${m.graceDays}d grace)`:""}</div>
                        </div>
                        <div style={{ color:T.accent,fontSize:13,fontWeight:800 }}>{sym}{fmt(m.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {baFees.length>0&&(
                  <div style={{ marginBottom:12 }}>
                    <div style={{ color:T.sub,fontSize:11,fontWeight:700,letterSpacing:0.5,marginBottom:8 }}>FEE PAYMENTS</div>
                    {baFees.sort((a,b2)=>b2.createdAt-a.createdAt).slice(0,5).map(f=>(
                      <div key={f.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}` }}>
                        <div>
                          <div style={{ color:T.text,fontSize:12,fontWeight:700 }}>{f.monthCount} months · {sym}{fmt(f.perMonth)}/mo</div>
                          <div style={{ color:T.sub,fontSize:10 }}>{f.monthsArr?.[0]} to {f.monthsArr?.[f.monthsArr.length-1]}</div>
                        </div>
                        <div style={{ color:T.accent,fontSize:13,fontWeight:800 }}>{sym}{fmt(f.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Edit / Delete biller account */}
                <div style={{ display:"flex",gap:8,marginTop:8 }}>
                  <button onClick={()=>{ setEditingBillerAccount(ba); setActiveBillerForAction(null); }} style={{ flex:1,background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:12,padding:"10px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>✏️ Edit Account</button>
                  <button onClick={()=>{
                    const linkedBills = bills.filter(b=>String(b.billerAccountId)===String(ba.id));
                    const linkedMem = memberships.filter(m=>m.billerAccountId===ba.id);
                    const linkedFee = feePayments.filter(f=>f.billerAccountId===ba.id);
                    const total = linkedBills.length+linkedMem.length+linkedFee.length;
                    if(total>0){
                      askConfirm(`Cannot delete: ${ba.name} has ${total} linked record${total>1?"s":""}. Delete the bills, memberships and fee payments first.`,null);
                      return;
                    }
                    askConfirm(`Delete ${ba.name}?`,()=>{
                      setBillerAccounts(prev=>prev.filter(x=>x.id!==ba.id));
                      setActiveBillerForAction(null);
                    });
                  }} style={{ flex:1,background:"none",border:`1px solid ${T.danger}44`,borderRadius:12,padding:"10px",cursor:"pointer",fontSize:12,fontWeight:700,color:T.danger,fontFamily:"Nunito,sans-serif" }}>🗑 Delete Account</button>
                </div>
              </div>
            </div>
          );
        })()}
        {editingBill&&<EditBillModal b={editingBill} onClose={()=>setEditingBill(null)}/>}
        {billMatchSuggestion&&(
          <div style={{ position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",width:"calc(100% - 32px)",maxWidth:398,background:T.card,border:`1px solid ${T.success}66`,borderRadius:16,padding:"14px 16px",zIndex:300,boxShadow:`0 4px 24px ${T.sh}` }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:6 }}>🎯 Bill matched!</div>
            <div style={{ color:T.sub,fontSize:12,marginBottom:12 }}>&#34;{billMatchSuggestion.bill.name}&#34; ({sym}{fmt(billMatchSuggestion.bill.amount)}) — mark as paid?</div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>setBillMatchSuggestion(null)} style={{ ...btnG,flex:1,padding:"8px" }}>Skip</button>
              <button onClick={()=>{
                const b=billMatchSuggestion.bill;
                setBills(p=>p.map(x=>x.id===b.id?{...x,status:"paid",paidDate:billMatchSuggestion.txn.date || todayStr(),paidByTxnId:billMatchSuggestion.txn.id}:x));
                setTxns(p=>p.map(x=>x.id===billMatchSuggestion.txn.id?{...x,isBillPayment:true,billInvoiceNo:b.invoiceNo||"",paidBillId:b.id,paidBillName:b.name}:x));
                if(b.recurring){ const next=new Date(b.dueDate); if(b.frequency==="monthly") next.setMonth(next.getMonth()+1); else if(b.frequency==="quarterly") next.setMonth(next.getMonth()+3); else if(b.frequency==="halfyearly") next.setMonth(next.getMonth()+6); else if(b.frequency==="yearly") next.setFullYear(next.getFullYear()+1); setBills(p=>[{...b,id:genId(),status:"unpaid",dueDate:next.toISOString().split("T")[0],paidDate:null,createdDate:todayStr(),createdAt:Date.now()},...p]); }
                setBillMatchSuggestion(null);
              }} style={{ ...btnP,flex:2,padding:"8px",background:T.success }}>✅ Yes, mark paid</button>
            </div>
          </div>
        )}
        {refundMatchSuggestion&&(
          <div style={{ position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",width:"calc(100% - 32px)",maxWidth:398,background:T.card,border:`1px solid ${T.info}66`,borderRadius:16,padding:"14px 16px",zIndex:300,boxShadow:`0 4px 24px ${T.sh}` }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:6 }}>↩ Refund match found</div>
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
        {reimbursementMatchSuggestion&&(
          <div style={{ position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",width:"calc(100% - 32px)",maxWidth:398,background:T.card,border:"1px solid #f0a50066",borderRadius:16,padding:"14px 16px",zIndex:300,boxShadow:`0 4px 24px ${T.sh}` }}>
            <div style={{ color:T.text,fontSize:14,fontWeight:800,marginBottom:6 }}>💼 Work expenses pending reimbursement</div>
            <div style={{ color:T.sub,fontSize:12,marginBottom:12 }}>
              {reimbursementMatchSuggestion.pending.length} expense{reimbursementMatchSuggestion.pending.length>1?"s":""} totalling {sym}{fmt(reimbursementMatchSuggestion.pending.reduce((s,t)=>s+Number(t.reimbursableAmount||t.amount||0),0))}. Mark all as reimbursed by this income?
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>setReimbursementMatchSuggestion(null)} style={{ ...btnG,flex:1,padding:"8px" }}>Skip</button>
              <button onClick={()=>{
                const id=reimbursementMatchSuggestion.incomeTxnId;
                setTxns(p=>p.map(x=>reimbursementMatchSuggestion.pending.some(pt=>String(pt.id)===String(x.id))?{...x,reimbursedByTxnId:id}:x));
                setReimbursementMatchSuggestion(null);
              }} style={{ ...btnP,flex:2,padding:"8px",background:"#f0a500",color:"#000" }}>✓ Mark all reimbursed</button>
            </div>
          </div>
        )}
        {budgetOverrideMonth&&(
          <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20 }}>
            <div style={{ background:T.card,borderRadius:20,padding:24,width:"100%",maxWidth:360 }}>
              <div style={{ color:T.text,fontSize:16,fontWeight:900,marginBottom:12 }}>Edit Budget — {budgetOverrideMonth.label}</div>
              <input style={{ ...inp,marginBottom:16 }} type="text" inputMode="decimal" value={budgetOverrideVal} onChange={e=>setBudgetOverrideVal(cleanMoneyInput(e.target.value))} placeholder={`e.g. ${sym}65,000`} autoFocus/>
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
              <div style={{ color:T.text,fontSize:16,fontWeight:900,marginBottom:16 }}>Edit Budget — {new Date(editingMonthBudget+"-01").toLocaleString("en-IN",{month:"long",year:"2-digit"})}</div>
              <input style={{ ...inp,marginBottom:16 }} type="text" inputMode="decimal" placeholder={`Enter budget amount (${sym})`} value={editingMonthVal} onChange={e=>setEditingMonthVal(cleanMoneyInput(e.target.value))} autoFocus/>
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
                    <input style={inp} type="text" inputMode="decimal" placeholder="e.g. 5,600" value={editingOpeningBalanceVal||""} onChange={e=>setEditingOpeningBalanceVal(cleanMoneyInput(e.target.value))}/>
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
                    <input style={inp} type="text" inputMode="decimal" placeholder="e.g. 2,300" value={editingCheckpointVal||""} onChange={e=>setEditingCheckpointVal(cleanMoneyInput(e.target.value))} autoFocus/>
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
        {linkTxnModal&&(()=>{
          const lm=linkTxnModal;
          const isPickExpense=lm.mode==="pick_expense";
          const settlement=lm.settlement;
          const expense=lm.expense;
          const personId=isPickExpense?settlement?.fromPersonId:Object.entries(expense?.people||{}).find(([pid,i])=>pid!=="__me__"&&i.mode==="owes"&&i.settled)?.[0];
          const candidates=isPickExpense
            ? txns.filter(t=>t.type==="expense"&&t.people?.[personId]?.mode==="owes"&&!t.people[personId]?.settled&&remainingShare(t.people[personId])>0).sort((a,b)=>(b.date||"").localeCompare(a.date||""))
            : txns.filter(t=>t.type==="settlement_in"&&!t.isRefund&&!t.settlementLinks?.length&&t.fromPersonId===personId).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
          const link=(pickedTxn)=>{
            if(isPickExpense){
              const amt=Math.min(Number(settlement.amount||0),remainingShare(pickedTxn.people[personId]));
              setTxns(prev=>prev.map(t=>{
                if(String(t.id)===String(settlement.id)) return {...t,settlementLinks:[...(t.settlementLinks||[]),{kind:"txn",id:pickedTxn.id,personId,amount:amt}]};
                if(String(t.id)===String(pickedTxn.id)){
                  const orig=Number(t.people[personId].amount||0);
                  const prev2=Number(t.people[personId].settledAmt||0);
                  const next=Math.min(orig,prev2+amt);
                  return {...t,people:{...t.people,[personId]:{...t.people[personId],settled:next>=orig,settledAmt:next,remainingAmt:Math.max(0,orig-next)}}};
                }
                return t;
              }));
            } else {
              const amt=Math.min(Number(pickedTxn.amount||0),remainingShare(expense.people[personId]));
              setTxns(prev=>prev.map(t=>{
                if(String(t.id)===String(pickedTxn.id)) return {...t,settlementLinks:[...(t.settlementLinks||[]),{kind:"txn",id:expense.id,personId,amount:amt}]};
                if(String(t.id)===String(expense.id)){
                  const orig=Number(t.people[personId].amount||0);
                  const prev2=Number(t.people[personId].settledAmt||0);
                  const next=Math.min(orig,prev2+amt);
                  return {...t,people:{...t.people,[personId]:{...t.people[personId],settled:next>=orig,settledAmt:next,remainingAmt:Math.max(0,orig-next)}}};
                }
                return t;
              }));
            }
            setLinkTxnModal(null);
          };
          return (
            <div onClick={e=>e.target===e.currentTarget&&setLinkTxnModal(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:250 }}>
              <div style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 40px",width:"100%",maxWidth:430,maxHeight:"80vh",overflowY:"auto" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                  <div style={{ color:T.text,fontSize:16,fontWeight:900 }}>🔗 {isPickExpense?"Link to expense":"Link repayment"}</div>
                  <button onClick={()=>setLinkTxnModal(null)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
                </div>
                <div style={{ color:T.sub,fontSize:12,marginBottom:14 }}>{isPickExpense?`Pick an expense that "${getPerson(personId)?.name}" owed you — the settlement will be linked to it.`:`Pick a settlement from "${getPerson(personId)?.name}" to link to this expense.`}</div>
                {candidates.length===0
                  ?<div style={{ color:T.sub,fontSize:13,textAlign:"center",padding:20 }}>No matching {isPickExpense?"expenses":"settlements"} found.</div>
                  :candidates.map((c,idx,arr)=>(
                    <div key={c.id} onClick={()=>link(c)} style={{ display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:idx<arr.length-1?`1px solid ${T.border}`:"none",cursor:"pointer" }}>
                      <div>
                        <div style={{ color:T.text,fontSize:13,fontWeight:600 }}>{c.desc||c.merchant||"Transaction"}</div>
                        <div style={{ color:T.sub,fontSize:10 }}>{formatShortDate(c.date)||c.date}</div>
                      </div>
                      <div style={{ color:isPickExpense?T.accent:T.success,fontSize:13,fontWeight:700 }}>{sym}{fmt(isPickExpense?remainingShare(c.people[personId]):c.amount)}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          );
        })()}
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
                <button onClick={()=>setShowReceivablesList(false)} style={{ background:T.pill,border:"none",color:T.sub,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:16,fontFamily:"Nunito,sans-serif" }}>✕</button>
              </div>
              <div style={{ color:T.sub,fontSize:11,marginBottom:14 }}>Splits, bills and loans you are owed</div>
              {(()=>{
                // Merge splits and loans per person into one row
                const splitMap = {};
                monthlyReceivablePeopleList.forEach(item=>{ splitMap[String(item.id)] = { person:item.person, splitAmt:item.amount }; });
                const loanMap = {};
                activeGivenLoans.forEach(loan=>{
                  const pid = String(loan.personId||loan.linkedPersonId||"");
                  if(!pid) return;
                  loanMap[pid] = (loanMap[pid]||0) + Number(loan.outstanding||0);
                });
                const allPids = [...new Set([...Object.keys(splitMap), ...Object.keys(loanMap)])];
                const hasAny = allPids.length>0 || monthlyCollectiveGroupReceivable>0;
                if(!hasAny) return <div style={{ color:T.sub,fontSize:12 }}>No pending amount to receive.</div>;
                return (
                  <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                    {allPids.map(pid=>{
                      const entry = splitMap[pid];
                      const loanAmt = loanMap[pid]||0;
                      const splitAmt = entry?.splitAmt||0;
                      const person = entry?.person || people.find(p=>String(p.id)===pid);
                      const total = splitAmt + loanAmt;
                      const sub = splitAmt>0 && loanAmt>0
                        ? `${sym}${fmt(splitAmt)} splits + ${sym}${fmt(loanAmt)} loan`
                        : splitAmt>0 ? "from splits / bills"
                        : `${sym}${fmt(loanAmt)} loan outstanding`;
                      return (
                        <div key={pid} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,background:T.input,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px" }}>
                          <div style={{ minWidth:0,flex:1 }}>
                            <div style={{ color:T.text,fontSize:12,fontWeight:800 }}>{person?.emoji||"👤"} {person?.name||"Unknown"}</div>
                            <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{sub}</div>
                          </div>
                          <div style={{ color:T.accent,fontSize:13,fontWeight:900 }}>{sym}{fmt(total)}</div>
                        </div>
                      );
                    })}
                    {monthlyCollectiveGroupReceivable>0 && (
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:12,padding:"10px 12px" }}>
                        <div style={{ minWidth:0,flex:1 }}>
                          <div style={{ color:T.text,fontSize:12,fontWeight:800 }}>👥 Group balances</div>
                          <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>Collective amount due</div>
                        </div>
                        <div style={{ color:T.accent,fontSize:13,fontWeight:900 }}>{sym}{fmt(monthlyCollectiveGroupReceivable)}</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {(showAddLoan||editingLoan)&&<LoanModal item={editingLoan} onClose={()=>{ setShowAddLoan(false); setEditingLoan(null); }}/>}        
        {repaymentLoan&&<LoanRepaymentModal item={repaymentLoan} onClose={()=>setRepaymentLoan(null)}/>}
        {/* Transaction Detail */}
        {txnDetailId&&(()=>{
          const t = txns.find(x=>x.id===txnDetailId);
          if(!t) return null;
          const acc = accounts.find(a=>a.id===t.accId);
          const tCats = (t.catIds||[t.catId]).filter(Boolean).map(cid=>cats.find(c=>String(c.id)===String(cid))?.name).filter(Boolean);
          const billerBA = t.billerLinkId ? billerAccounts.find(b=>b.id===t.billerLinkId) : null;
          const color = txnColor(t.type,T);
          // Who this transaction is attributed to — group and/or person, restored from t.groupId / t.people / t.forPerson.
          const attrGroup = t.groupId ? groups.find(g=>g.id===t.groupId) : null;
          const attrGroupLabel = attrGroup ? (t.splitMode==="split" ? "Split (collect)" : "Attributed") : null;
          const attrPersonId = t.forPerson || t.taggedPersonId || Object.keys(t.people||{}).find(pid=>pid!=="__me__") || null;
          const attrPerson = attrPersonId ? getPerson(attrPersonId) : null;
          const attrPersonInfo = attrPersonId ? (t.people?.[attrPersonId] || t.splitPeople?.[attrPersonId]) : null;
          const attrPersonLabel = attrPersonInfo?.mode==="owes" ? "Owes you" : attrPersonInfo?.mode==="spent_on" ? "Attributed to" : null;
          return (
            <div onClick={()=>setTxnDetailId(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
              <div onClick={e=>e.stopPropagation()} style={{ background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 18px 48px",width:"100%",maxWidth:430,maxHeight:"85vh",overflowY:"auto" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16 }}>
                  <div>
                    <div style={{ color:T.text,fontSize:18,fontWeight:900 }}>{t.merchant||t.who||t.desc||"Transaction"}</div>
                    <div style={{ color:T.sub,fontSize:12,marginTop:2 }}>{formatShortDate(t.date)||t.date} · {acc?.name||"Account"}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color,fontSize:22,fontWeight:900 }}>{t.type==="income"?"+":t.type==="expense"?"-":""}{sym}{fmt(t.amount)}</div>
                    <div style={{ color:T.sub,fontSize:10,marginTop:2 }}>{t.type?.toUpperCase()}</div>
                  </div>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {tCats.length>0&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>Category</span><span style={{ color:T.text,fontSize:12,fontWeight:700 }}>{tCats.join(", ")}</span></div>}
                  {attrGroup&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>{attrGroupLabel}</span><span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>{attrGroup.icon||"👥"} {attrGroup.name}</span></div>}
                  {attrPerson&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>{attrPersonLabel||"Who is this for"}</span><span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>{attrPerson.emoji||"👤"} {attrPerson.name}</span></div>}
                  {t.note&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>Note</span><span style={{ color:T.text,fontSize:12 }}>{t.note}</span></div>}
                  {t.transactionRef&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>Ref</span><span style={{ color:T.text,fontSize:12 }}>{t.transactionRef}</span></div>}
                  {t.priceMrp&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>MRP</span><span style={{ color:T.text,fontSize:12 }}>{sym}{fmt(t.priceMrp)}</span></div>}
                  {t.priceDiscount&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>Discount</span><span style={{ color:T.success,fontSize:12,fontWeight:700 }}>-{sym}{fmt(t.priceDiscount)}</span></div>}
                  {t.emiInterestWaiver&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>Interest waiver</span><span style={{ color:T.success,fontSize:12,fontWeight:700 }}>{sym}{fmt(t.emiInterestWaiver)}</span></div>}
                  {t.emiGstOnInterest&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>GST on interest</span><span style={{ color:T.danger,fontSize:12,fontWeight:700 }}>{sym}{fmt(t.emiGstOnInterest)}</span></div>}
                  {billerBA&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>Linked biller</span><span style={{ color:T.accent,fontSize:12,fontWeight:700 }}>{getBillerIcon(billerBA.type)} {billerBA.name}</span></div>}
                  {t.guestPerson&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>Guest person owes</span><span style={{ color:T.warn,fontSize:12,fontWeight:700 }}>{t.guestPerson} · {sym}{fmt(t.guestPersonAmount||0)}</span></div>}
                  {t.reimbursable&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>Reimbursable</span><span style={{ color:T.warn,fontSize:12,fontWeight:700 }}>{sym}{fmt(t.reimbursableAmount||t.amount)}</span></div>}
                  {t.discount&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>Discount applied</span><span style={{ color:T.success,fontSize:12,fontWeight:700 }}>-{sym}{fmt(t.discount)}</span></div>}
                  {t.investFolio&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>Folio</span><span style={{ color:T.text,fontSize:12 }}>{t.investFolio}</span></div>}
                  {t.investNav&&<div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:T.sub,fontSize:12 }}>NAV</span><span style={{ color:T.text,fontSize:12 }}>{sym}{fmt(t.investNav)}</span></div>}
                </div>
                <div style={{ display:"flex",gap:8,marginTop:16 }}>
                  <button onClick={()=>{ setTxnDetailId(null); setEditTxn(t); setShowAdd(true); }} style={{ flex:1,background:T.accent+"22",border:`1px solid ${T.accent}44`,borderRadius:12,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:700,color:T.accent,fontFamily:"Nunito,sans-serif" }}>✏️ Edit</button>
                  <button onClick={()=>askConfirm("Delete this transaction?",()=>{ removeTxnAndLinkedInvestment(t); setTxnDetailId(null); })} style={{ background:T.danger+"18",border:`1px solid ${T.danger}33`,borderRadius:12,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:700,color:T.danger,fontFamily:"Nunito,sans-serif" }}>🗑 Delete</button>
                  <button onClick={()=>setTxnDetailId(null)} style={{ flex:1,background:"none",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:700,color:T.sub,fontFamily:"Nunito,sans-serif" }}>Close</button>
                </div>
              </div>
            </div>
          );
        })()}
        {/* Mask PIN reveal overlay */}
        {showMaskPin&&(
          <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:500,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24 }}>
            <div style={{ color:"#f0a500",fontSize:20,fontWeight:900,marginBottom:6 }}>👁️ Reveal Amounts</div>
            <div style={{ color:"rgba(255,255,255,0.5)",fontSize:12,marginBottom:28 }}>Enter PIN to view for 60 seconds</div>
            <div style={{ display:"flex",gap:12,marginBottom:24 }}>
              {[0,1,2,3].map(i=>(<div key={i} style={{ width:14,height:14,borderRadius:"50%",background:maskPinInput.length>i?"#f0a500":"transparent",border:"2px solid #f0a500" }}/>))}
            </div>
            {maskPinError&&<div style={{ color:"#ef4444",fontSize:12,marginBottom:12,fontWeight:700 }}>Wrong PIN</div>}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,68px)",gap:10,marginBottom:20 }}>
              {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map(k=>(
                <button key={k} onClick={async()=>{
                  if(k==="") return;
                  if(k==="⌫"){ setMaskPinInput(p=>p.slice(0,-1)); return; }
                  const np=maskPinInput+String(k); setMaskPinInput(np);
                  if(np.length===4){
                    const h=await hashPin(np);
                    if(h===appPin||np===appPin){ onMaskReveal(); setMaskPinInput(""); }
                    else { setMaskPinInput(""); setMaskPinError(true); setTimeout(()=>setMaskPinError(false),800); }
                  }
                }} style={{ width:68,height:68,borderRadius:34,background:k===""?"transparent":"rgba(255,255,255,0.1)",border:k===""?"none":"1px solid rgba(255,255,255,0.2)",color:"#fff",fontSize:k==="⌫"?16:20,fontWeight:700,cursor:k===""?"default":"pointer",fontFamily:"Nunito,sans-serif" }}>{k}</button>
              ))}
            </div>
            <button onClick={()=>{ setShowMaskPin(false); setMaskMode(false); setMaskPinInput(""); }} style={{ background:"none",border:"1px solid rgba(255,255,255,0.3)",borderRadius:20,padding:"8px 20px",color:"rgba(255,255,255,0.6)",fontSize:12,cursor:"pointer",fontFamily:"Nunito,sans-serif" }}>Cancel &amp; Disable Masking</button>
          </div>
        )}
        
        {(showAddLiability||editingLiability)&&<LiabilityModal item={editingLiability} onClose={()=>{ setShowAddLiability(false); setEditingLiability(null); }}/>}
        {(showAddAsset||editingAsset)&&<AssetModal item={editingAsset} onClose={()=>{ setShowAddAsset(false); setEditingAsset(null); }}/>}
        {showAccDetail&&<AccDetailModal/>}
        {confirmDeleteCat&&<ConfirmDelete/>}
        {confirmDeleteAccount&&<ConfirmDeleteAccount/>}
        {confirmDeleteTxn&&(()=>{
          const delHasSettledPeople = Object.entries(confirmDeleteTxn.people||{}).some(([pid,info])=>pid!=="__me__"&&info.settled);
          const delLinkedRepayments = txns.filter(x=>x.type==="settlement_in"&&x.settlementLinks?.some(l=>String(l.id)===String(confirmDeleteTxn.id)));
          const delHasSettlementLinks = (confirmDeleteTxn.settlementLinks?.length||0)>0;
          const showDelWarn = delHasSettledPeople||delLinkedRepayments.length>0||delHasSettlementLinks;
          return (
          <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20 }}>
            <div style={{ background:T.card,borderRadius:20,padding:24,width:"100%",maxWidth:360 }}>
              <div style={{ color:T.text,fontSize:17,fontWeight:900,marginBottom:8 }}>Delete transaction?</div>
              <div style={{ color:T.sub,fontSize:13,marginBottom:showDelWarn?12:20 }}>{confirmDeleteTxn.desc} · {sym}{fmt(confirmDeleteTxn.amount)}</div>
              {showDelWarn&&(
                <div style={{ background:T.danger+"15",border:`1px solid ${T.danger}33`,borderRadius:10,padding:"10px 12px",marginBottom:16 }}>
                  <div style={{ color:T.danger,fontSize:12,fontWeight:800,marginBottom:4 }}>⚠️ Settlement data attached</div>
                  {delHasSettledPeople&&<div style={{ color:T.sub,fontSize:11 }}>• People's dues were settled against this</div>}
                  {delLinkedRepayments.length>0&&<div style={{ color:T.sub,fontSize:11 }}>• {delLinkedRepayments.length} repayment{delLinkedRepayments.length>1?"s":""} linked</div>}
                  {delHasSettlementLinks&&<div style={{ color:T.sub,fontSize:11 }}>• Clears dues on other expenses</div>}
                  <div style={{ color:T.danger,fontSize:11,marginTop:4,fontWeight:700 }}>Deleting may cause incorrect balances.</div>
                </div>
              )}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <button onClick={()=>setConfirmDeleteTxn(null)} style={btnG}>Cancel</button>
                <button onClick={()=>{ removeTxnAndLinkedInvestment(confirmDeleteTxn); setExpandedTxn(null); setConfirmDeleteTxn(null); }} style={{ ...btnP,background:T.danger }}>Delete</button>
              </div>
            </div>
          </div>
          );
        })()}
        {imageViewSrc&&(
          <div onClick={()=>setImageViewSrc(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16 }}>
            <img src={imageViewSrc} alt="full view" style={{ maxWidth:"100%",maxHeight:"90vh",borderRadius:12,objectFit:"contain" }} onError={()=>setImageViewSrc(null)}/>
            <button onClick={()=>setImageViewSrc(null)} style={{ position:"absolute",top:20,right:20,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:"50%",width:36,height:36,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Nunito,sans-serif" }}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
}