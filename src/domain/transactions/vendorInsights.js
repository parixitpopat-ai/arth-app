// domain/transactions/vendorInsights.js
//
// WP-B-1 — pure, read-only derivation functions for vendor/item intelligence. No persistence,
// no side effects, no React. Everything here is computed from txns[] (specifically each
// transaction's merchant + lineItems[]) — confirmed by repo-wide grep this session that no
// vendor-aggregation mechanism exists anywhere else. Nothing here creates a new stored model;
// it derives from data that already exists.
//
// Merchant matching is case-insensitive, matching itemCatalog's own established convention
// (name.toLowerCase() comparison) for the same reason: "Amazon" and "amazon" should be treated
// as the same vendor, not two.

export function getTxnsForVendor(txns, merchant) {
  const needle = String(merchant || "").trim().toLowerCase();
  if (!needle) return [];
  return (txns || [])
    .filter(t => String(t.merchant || "").trim().toLowerCase() === needle)
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export function getVendorAggregate(txns, merchant) {
  const vendorTxns = getTxnsForVendor(txns, merchant);
  const categorySpend = {};
  const itemsByLabel = new Map();
  let totalSpend = 0;

  vendorTxns.forEach(t => {
    if (t.type === "expense") totalSpend += Number(t.amount || 0);

    const items = Array.isArray(t.lineItems) ? t.lineItems : null;
    if (items && items.length) {
      items.forEach(item => {
        const catKey = item.catId || null;
        if (catKey) categorySpend[catKey] = (categorySpend[catKey] || 0) + Number(item.amount || 0);
        const labelKey = String(item.label || "").trim().toLowerCase();
        if (!labelKey) return;
        const existing = itemsByLabel.get(labelKey) || { label: item.label.trim(), count: 0, totalQty: 0, totalSpend: 0 };
        existing.count += 1;
        existing.totalQty += Number(item.qty || 0);
        existing.totalSpend += Number(item.amount || 0);
        itemsByLabel.set(labelKey, existing);
      });
    } else if (t.type === "expense" && (t.catId || (t.catIds || []).length)) {
      const cats = (t.catIds && t.catIds.length) ? t.catIds : [t.catId];
      cats.filter(Boolean).forEach(catId => {
        categorySpend[catId] = (categorySpend[catId] || 0) + Number(t.amount || 0);
      });
    }
  });

  return {
    merchant: String(merchant || "").trim(),
    transactionCount: vendorTxns.length,
    totalSpend,
    categorySpend,
    items: Array.from(itemsByLabel.values()).sort((a, b) => b.count - a.count),
  };
}

export function getFrequentVendors(txns, limit = 10) {
  const byMerchant = new Map();
  (txns || []).forEach(t => {
    const name = String(t.merchant || "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    const existing = byMerchant.get(key) || { merchant: name, count: 0, totalSpend: 0, lastDate: "" };
    existing.count += 1;
    if (t.type === "expense") existing.totalSpend += Number(t.amount || 0);
    if (String(t.date || "") > existing.lastDate) existing.lastDate = String(t.date || "");
    byMerchant.set(key, existing);
  });
  return Array.from(byMerchant.values())
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit);
}

export function getFrequentItemsForVendor(txns, merchant, limit = 8) {
  const vendorTxns = getTxnsForVendor(txns, merchant);
  const byLabel = new Map();
  vendorTxns.forEach(t => {
    (t.lineItems || []).forEach(item => {
      const labelKey = String(item.label || "").trim().toLowerCase();
      if (!labelKey) return;
      const existing = byLabel.get(labelKey);
      if (existing) {
        existing.count += 1;
      } else {
        byLabel.set(labelKey, {
          label: item.label.trim(),
          catId: item.catId || null,
          subId: item.subId || null,
          count: 1,
          lastUnitPrice: Number(item.unitPrice || 0),
          lastQty: Number(item.qty || 0),
          lastDate: String(t.date || ""),
        });
      }
    });
  });
  return Array.from(byLabel.values())
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit);
}
