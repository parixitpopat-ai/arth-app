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
