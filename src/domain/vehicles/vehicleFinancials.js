// Vehicle financial derivation — pure functions only.
//
// Architecture rule (Vehicle Experience brief, section 1): Vehicle is a master-data entity,
// Transaction is financial truth. There is no separate vehicle expense ledger. Every number
// here is a sum or list over existing transactions whose vehicleId matches, split by their
// Transport subcategory (DEFAULT_CATS "transport": t1..t9). Nothing in this file writes
// anything or invents data — a bucket with no matching transactions is simply absent from the
// result, never synthesized as a zero-amount entry (see "Not set is a state", rule 3 of the
// design package).
//
// Subcategory → bucket mapping, per the design package's rule 2:
//   Fuel = t1, Service & repairs = t6, Insurance = t5, PUC = t8,
//   Parking & tolls = t7, EMI = t4, Challan = t9. Anything else (t2 Uber/Ola, t3 Public
//   Transport, no subcategory, or a non-Transport category txn linked to the vehicle) is Other.
export const FINE_BUCKETS = {
  t1: "fuel",
  t6: "service",
  t5: "insurance",
  t8: "puc",
  t7: "tolls",
  t4: "emi",
  t9: "challan",
};

export const getFineBucketKey = subId => FINE_BUCKETS[subId] || "other";

// The Overview tab's 5-way rollup (V-6's `buckets` array). Deliberately coarser than
// FINE_BUCKETS: PUC, EMI, Challan and unclassified spend all collapse into "Other" for the
// summary chart, while the Fuel/Maintenance/Insurance tabs use the fine-grained buckets above.
export const OVERVIEW_BUCKET_GROUPS = [
  { key: "fuel", label: "Fuel", color: "#f97316", fine: ["fuel"] },
  { key: "service", label: "Service & repairs", color: "#22c55e", fine: ["service"] },
  { key: "insurance", label: "Insurance", color: "#3b82f6", fine: ["insurance"] },
  { key: "tolls", label: "Parking & tolls", color: "#a855f7", fine: ["tolls"] },
  { key: "other", label: "Other", color: "#8b8bab", fine: ["puc", "emi", "challan", "other"] },
];

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const getVehicleLinkedTxns = (vehicle, txns) => {
  if (!vehicle?.id) return [];
  return (txns || []).filter(t => t && String(t.vehicleId) === String(vehicle.id));
};

// Splits one linked transaction's amount into {bucketKey, amount} parts. Itemised
// transactions split per line item's own subId (each item may fall in a different bucket);
// a standard transaction uses its own subIds[0]/subId as a single part.
export const splitTxnByFineBucket = txn => {
  if (Array.isArray(txn?.lineItems) && txn.lineItems.length) {
    return txn.lineItems.map(item => ({
      bucketKey: getFineBucketKey(item.subId),
      amount: num(item.qty) * num(item.unitPrice),
    }));
  }
  const subId = (Array.isArray(txn?.subIds) && txn.subIds[0]) || txn?.subId || null;
  return [{ bucketKey: getFineBucketKey(subId), amount: num(txn?.amount) }];
};

const inWindow = (dateStr, sinceDate) => {
  if (!sinceDate) return true;
  if (!dateStr) return false;
  return String(dateStr) >= String(sinceDate);
};

// Overview "Running cost" — total + 5-way bucket rollup, sorted by amount descending, empty
// buckets omitted entirely (never shown as ₹0).
export const getVehicleRunningCostBuckets = (vehicle, txns, { sinceDate = null } = {}) => {
  const linked = getVehicleLinkedTxns(vehicle, txns).filter(t => inWindow(t.date, sinceDate));
  const fineTotals = {};
  let total = 0;
  linked.forEach(t => {
    splitTxnByFineBucket(t).forEach(({ bucketKey, amount }) => {
      fineTotals[bucketKey] = (fineTotals[bucketKey] || 0) + amount;
      total += amount;
    });
  });
  const buckets = OVERVIEW_BUCKET_GROUPS
    .map(g => {
      const amt = g.fine.reduce((s, k) => s + (fineTotals[k] || 0), 0);
      return { key: g.key, label: g.label, color: g.color, amt, n: linked.filter(t => splitTxnByFineBucket(t).some(p => g.fine.includes(p.bucketKey) && p.amount > 0)).length };
    })
    .filter(b => b.amt > 0)
    .sort((a, b) => b.amt - a.amt);
  return { total, count: linked.length, buckets };
};

// Total cost of ownership — every linked transaction, ever, plus purchase value only when it
// exists. Never estimates or defaults purchase value; says explicitly whether it was included.
export const getVehicleTCO = (vehicle, txns) => {
  const linked = getVehicleLinkedTxns(vehicle, txns);
  const txnTotal = linked.reduce((s, t) => s + num(t.amount), 0);
  const purchaseValue = vehicle?.purchaseValue != null && vehicle.purchaseValue !== "" ? num(vehicle.purchaseValue) : null;
  return {
    total: txnTotal + (purchaseValue || 0),
    txnTotal,
    purchaseValueIncluded: purchaseValue != null,
    purchaseValue,
  };
};

const latestByFineBucket = (linked, bucketKey) => {
  let best = null;
  linked.forEach(t => {
    const parts = splitTxnByFineBucket(t).filter(p => p.bucketKey === bucketKey && p.amount > 0);
    if (!parts.length) return;
    const amt = parts.reduce((s, p) => s + p.amount, 0);
    if (!best || String(t.date || "") > String(best.date || "")) best = { date: t.date, amount: amt, txn: t };
  });
  return best;
};

// Status tiles — Insurance / Service / PUC / Loan-EMI, derived purely from the most recent
// linked transaction in each bucket (or the linked InsurancePolicy's own renewal, if given).
// "Next due" needs a reminder capability this codebase doesn't have — never fabricated here.
export const getVehicleStatusTiles = (vehicle, txns, { insurancePolicy = null } = {}) => {
  const linked = getVehicleLinkedTxns(vehicle, txns);
  const insurance = latestByFineBucket(linked, "insurance");
  const service = latestByFineBucket(linked, "service");
  const puc = latestByFineBucket(linked, "puc");
  const emiLinked = linked.filter(t => splitTxnByFineBucket(t).some(p => p.bucketKey === "emi" && p.amount > 0));
  const emiTotal = emiLinked.reduce((s, t) => s + splitTxnByFineBucket(t).filter(p => p.bucketKey === "emi").reduce((s2, p) => s2 + p.amount, 0), 0);
  return [
    {
      key: "insurance", label: "Insurance",
      val: insurance ? { kind: "paid", date: insurance.date, amount: insurance.amount } : { kind: "none" },
      sub: insurancePolicy ? "policy linked" : (insurance ? "policy not linked" : null),
    },
    {
      key: "service", label: "Service",
      val: service ? { kind: "paid", date: service.date, amount: service.amount } : { kind: "none" },
      sub: service ? "next due not tracked" : null,
    },
    {
      key: "puc", label: "PUC",
      val: puc ? { kind: "paid", date: puc.date, amount: puc.amount } : { kind: "none" },
      sub: puc ? "expiry not tracked" : null,
    },
    {
      key: "loan", label: "Loan / EMI",
      val: emiLinked.length ? { kind: "sum", amount: emiTotal, count: emiLinked.length } : { kind: "none" },
      sub: emiLinked.length ? null : "EMI payments appear here",
    },
  ];
};

export const getVehicleRecentTxns = (vehicle, txns, n = 3) =>
  getVehicleLinkedTxns(vehicle, txns)
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || num(b.createdAt) - num(a.createdAt))
    .slice(0, n);

// Transactions tab — every linked transaction, grouped by calendar month (YYYY-MM), newest
// month first, each group carrying its own subtotal.
export const getVehicleTxnsByMonth = (vehicle, txns) => {
  const linked = getVehicleLinkedTxns(vehicle, txns)
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const groups = [];
  const byKey = {};
  linked.forEach(t => {
    const key = String(t.date || "").slice(0, 7) || "unknown";
    if (!byKey[key]) { byKey[key] = { key, rows: [], total: 0 }; groups.push(byKey[key]); }
    byKey[key].rows.push(t);
    byKey[key].total += num(t.amount);
  });
  return groups;
};

// Fuel tab summary — this-month total, 6-month average (divided only by months that had any
// fuel spend), 12-month total, and a by-month series for the last 6 months.
export const getVehicleFuelSummary = (vehicle, txns, { today = new Date() } = {}) => {
  const linked = getVehicleLinkedTxns(vehicle, txns);
  const fuelParts = linked.flatMap(t => splitTxnByFineBucket(t).filter(p => p.bucketKey === "fuel" && p.amount > 0).map(p => ({ ...p, date: t.date, txn: t })));
  const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthKey = monthKey(today);
  const byMonth = {};
  fuelParts.forEach(p => {
    const d = p.date ? new Date(p.date) : null;
    if (!d || Number.isNaN(d.getTime())) return;
    const k = monthKey(d);
    byMonth[k] = (byMonth[k] || 0) + p.amount;
  });
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const k = monthKey(d);
    months.push({ key: k, label: d.toLocaleString("en-US", { month: "short" }), amt: byMonth[k] || 0 });
  }
  const monthsWithSpend = months.filter(m => m.amt > 0);
  const sixMoTotal = months.reduce((s, m) => s + m.amt, 0);
  const twelveMoTotal = fuelParts.reduce((s, p) => {
    const d = p.date ? new Date(p.date) : null;
    if (!d || Number.isNaN(d.getTime())) return s;
    const monthsAgo = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
    return monthsAgo >= 0 && monthsAgo < 12 ? s + p.amount : s;
  }, 0);
  const thisMonthRows = fuelParts.filter(p => p.date && monthKey(new Date(p.date)) === thisMonthKey);
  return {
    thisMonth: { amt: byMonth[thisMonthKey] || 0, count: thisMonthRows.length },
    sixMonthAvg: monthsWithSpend.length ? sixMoTotal / monthsWithSpend.length : 0,
    twelveMonth: { amt: twelveMoTotal, count: fuelParts.filter(p => { const d = p.date ? new Date(p.date) : null; if (!d || Number.isNaN(d.getTime())) return false; const monthsAgo = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth()); return monthsAgo >= 0 && monthsAgo < 12; }).length },
    byMonth: months,
    thisMonthTxns: thisMonthRows.map(p => p.txn),
  };
};

// Maintenance tab — Service & repairs / PUC / Challan history, plus the single most recent
// service payment as the headline.
export const getVehicleMaintenanceSummary = (vehicle, txns) => {
  const linked = getVehicleLinkedTxns(vehicle, txns);
  const rows = linked
    .flatMap(t => splitTxnByFineBucket(t)
      .filter(p => ["service", "puc", "challan"].includes(p.bucketKey) && p.amount > 0)
      .map(p => ({ ...p, txn: t })))
    .sort((a, b) => String(b.txn.date || "").localeCompare(String(a.txn.date || "")));
  const lastService = latestByFineBucket(linked, "service");
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return { lastService, rows, total };
};

// Insurance tab — every payment tagged Insurance (t5), regardless of whether an
// InsurancePolicy record is linked yet.
export const getVehicleInsuranceSummary = (vehicle, txns) => {
  const linked = getVehicleLinkedTxns(vehicle, txns);
  const rows = linked
    .flatMap(t => splitTxnByFineBucket(t).filter(p => p.bucketKey === "insurance" && p.amount > 0).map(p => ({ ...p, txn: t })))
    .sort((a, b) => String(b.txn.date || "").localeCompare(String(a.txn.date || "")));
  return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
};

// Documents tab, "Receipts on linked transactions" — reads existing per-transaction
// attachments (imageBase64 / paymentImageBase64), never a Vehicle.documents array (that needs
// the shared Attachment service the design package marks Future/blocked).
export const getVehicleReceipts = (vehicle, txns) => {
  const linked = getVehicleLinkedTxns(vehicle, txns);
  const out = [];
  linked.forEach(t => {
    if (t.imageBase64) out.push({ txnId: t.id, kind: "receipt", date: t.date, amount: t.amount, src: t.imageBase64 });
    if (t.paymentImageBase64) out.push({ txnId: t.id, kind: "payment proof", date: t.date, amount: t.amount, src: t.paymentImageBase64 });
  });
  return out.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
};

// "Link past expenses" candidates — Transport-category transactions with no vehicleId,
// within the last N days. Passing `subId` narrows to one subcategory (used by the Fuel tab's
// "No fuel linked" prompt); omitting it covers every Transport subcategory (used by V-4's
// generic "Link past expenses" and the profile's own bulk-link action).
export const getUntaggedVehicleCandidates = (txns, { subId = null, days = 90, today = new Date() } = {}) => {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return (txns || []).filter(t => {
    if (!t || t.type !== "expense") return false;
    if (t.vehicleId) return false;
    if (!String(t.date || "") || String(t.date) < cutoffStr) return false;
    const isTransportCat = (t.catIds || (t.catId ? [t.catId] : [])).includes("transport");
    if (!isTransportCat) return false;
    if (subId) {
      const txnSubIds = Array.isArray(t.subIds) ? t.subIds : (t.subId ? [t.subId] : []);
      if (!txnSubIds.includes(subId)) return false;
    }
    return true;
  }).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
};
