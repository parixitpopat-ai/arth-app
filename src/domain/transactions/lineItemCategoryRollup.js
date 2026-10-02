// domain/transactions/lineItemCategoryRollup.js
//
// WP18c-fix (Pay Fees mixed-category) — extracted from App.jsx's AddTransactionModal
// `itemCategoryRollup` useMemo (T3-9b), unchanged in behavior, so a SECOND real creation path
// (School Fees' PayFeesModal, via App.jsx's createRealTxn for the School Fees mount) can derive
// a Transaction's top-level category attribution from its lineItems[] the exact same
// deterministic way, instead of inventing a second rule. Per T3-9b's own locked design
// principle: "no new fields -- existing catId/catIds/lineItems[].catId are the only
// representations used." This module only moves that one rule somewhere two callers can share
// it; App.jsx's own itemCategoryRollup now calls this directly (see App.jsx, search
// "computeLineItemCategoryRollup").
//
// catIds ordered by summed item amount descending; catId = the largest share. An item with no
// catId (uncategorized) contributes to neither catIds nor catAmounts -- same as the original.

/**
 * @param {Array<{label?:string, qty?:number|string, unitPrice?:number|string, catId?:string|null, subId?:string|null}>} lineItems
 * @returns {{
 *   catId: string|null,
 *   catIds: string[],
 *   subIds: string[],
 *   catAmounts: Object<string, number>,
 *   uncategorizedCount: number,
 *   uncategorizedLabels: string[],
 * }}
 */
export function computeLineItemCategoryRollup(lineItems) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const sums = {};
  const subSums = {};
  for (const item of items) {
    if (!item || !item.catId) continue;
    const itemAmt = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
    sums[item.catId] = (sums[item.catId] || 0) + itemAmt;
    if (item.subId) subSums[item.subId] = (subSums[item.subId] || 0) + itemAmt;
  }
  const orderedCatIds = Object.keys(sums).sort((a, b) => sums[b] - sums[a]);
  const orderedSubIds = Object.keys(subSums).sort((a, b) => subSums[b] - subSums[a]);
  const uncategorized = items.filter(item => item && !item.catId);
  return {
    catId: orderedCatIds[0] || null,
    catIds: orderedCatIds,
    subIds: orderedSubIds,
    catAmounts: sums,
    uncategorizedCount: uncategorized.length,
    uncategorizedLabels: uncategorized.map(i => i.label || "Unnamed item"),
  };
}

/**
 * The exact-dollar `catAllocations` shape `getCategoryAttributedTotal` (domain/allocations/
 * adapter.js, Path 1) reads -- one entry per categorized catId, its real summed item amount,
 * rounded to paise. Returns null when nothing in `lineItems` carries a catId at all (nothing to
 * allocate), so callers can write it straight onto a Transaction unconditionally.
 *
 * WHY this is needed even for a SINGLE category (not just 2+, unlike the itemized-switch-to-
 * standard code this mirrors): `getCategoryAttributedTotal`'s fallback path (no catAllocations)
 * evenly splits a transaction's whole net amount across `catIds` -- correct only when every rupee
 * on the transaction is attributed to a category. A Pay Fees transaction routinely mixes
 * uncategorized fee-linked lines (no categoryId exists anywhere on a fee schedule/School
 * Relationship to inherit from -- see this WP's own investigation notes) with one categorized
 * "not listed" line; without an explicit catAllocations, that fallback would mis-attribute the
 * ENTIRE transaction (fee amounts included) to the one real category present. Setting
 * catAllocations whenever any line is categorized makes Path 1 the one true source: a category
 * not present as a key gets exactly $0 from this transaction, and a category that IS a key gets
 * exactly its own lines' amounts -- never the uncategorized remainder.
 *
 * @param {ReturnType<typeof computeLineItemCategoryRollup>} rollup
 * @returns {Object<string, number>|null}
 */
export function rollupToCatAllocations(rollup) {
  if (!rollup || !rollup.catIds || rollup.catIds.length === 0) return null;
  return Object.fromEntries(
    rollup.catIds.map(cid => [cid, Math.round((rollup.catAmounts[cid] || 0) * 100) / 100])
  );
}
