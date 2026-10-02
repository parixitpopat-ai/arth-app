// domain/payments/homeCategories.js
//
// Payments v2 (WP18b) — A1/A2 "Payments home". Pure, read-only composition: given a flat list of
// connection summaries (each already carrying its own category label, display name, status line
// and whether it currently has an Overdue/Due bill), groups them into the categories Home shows,
// in the exact order and expand-state the spec's Home rule requires:
//
//   "Only categories with >=1 active connection appear, ordered by attention then name. A
//    category is expanded on load if any connection in it has an Overdue or Due bill; otherwise
//    collapsed with a one-line summary."
//
// This file does none of the per-connection business logic itself (reading bills[], memberships,
// insurance policies, fee schedules, etc. to decide a connection's own status line and attention
// flag stays in App.jsx, which already owns every one of those read models) — it only does the
// grouping/ordering/expand-default, which is the part worth isolating and testing on its own.

/**
 * @param {Array<{id:string, categoryLabel:string, name:string, hasOverdueOrDueBill:boolean}>} connections
 *   Already-filtered to "active" connections only (the caller decides what "active" means per
 *   connection type — this function never looks at status fields itself).
 * @returns {Array<{label:string, count:number, needsAttention:boolean, expanded:boolean, connections:Array}>}
 *   Categories ordered by attention (any connection Overdue/Due) first, then label, A-Z.
 *   Within a category, connections are ordered the same way: attention first, then name, A-Z.
 */
export function groupConnectionsByCategory(connections) {
  const byCategory = new Map();
  (connections || []).filter(Boolean).forEach(c => {
    const label = c.categoryLabel || "Other";
    if (!byCategory.has(label)) byCategory.set(label, []);
    byCategory.get(label).push(c);
  });

  const categories = [...byCategory.entries()].map(([label, conns]) => {
    const sorted = [...conns].sort((a, b) => {
      if (a.hasOverdueOrDueBill !== b.hasOverdueOrDueBill) return a.hasOverdueOrDueBill ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base" });
    });
    const needsAttention = conns.some(c => c.hasOverdueOrDueBill);
    return { label, count: conns.length, needsAttention, expanded: needsAttention, connections: sorted };
  });

  categories.sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    return a.label.localeCompare(b.label, "en", { sensitivity: "base" });
  });

  return categories;
}

// Home-screen category grouping for a Biller Account's type — distinct from the + Add / Activate
// catalogue's own grouping (constants/appConstants or the inline catalogue list in App.jsx), which
// WP18 already built and which this WP leaves untouched. The two groupings serve different jobs:
// Activate's groups the full, unfiltered type catalogue for browsing; this one groups only what's
// already connected, matching the mockup's narrower, more specific labels (A1: "Electricity",
// "Water", "Broadband & Recharges", "Health & Fitness", "Education", "Insurance" — not "Utility
// Bills" / "Finances" / "Others").
const CATEGORY_MAP = {
  "Electricity": "Electricity",
  "Water": "Water",
  "LPG Gas": "Gas",
  "Piped Gas": "Gas",
  "Broadband": "Broadband & Recharges",
  "Landline": "Broadband & Recharges",
  "Cable TV": "Broadband & Recharges",
  "Mobile Postpaid": "Broadband & Recharges",
  "Mobile Prepaid": "Broadband & Recharges",
  "DTH": "Broadband & Recharges",
  "Fastag": "Broadband & Recharges",
  "Metro Recharge": "Broadband & Recharges",
  "NCMC Recharge": "Broadband & Recharges",
  "EV Recharge": "Broadband & Recharges",
  "OTT / Streaming": "Broadband & Recharges",
  "Gym / Fitness": "Health & Fitness",
  "Club Membership": "Health & Fitness",
  "Hospital": "Health & Fitness",
  "School Fees": "Education",
  "Education Fees": "Education",
  "Insurance": "Insurance",
  "Credit Card": "Credit Cards",
  "Recurring Deposit": "Savings & Investments",
  "NPS": "Savings & Investments",
  "Municipal Tax": "Municipal",
  "Municipal Services": "Municipal",
  "Society Maintenance": "Society & Rental",
  "Rental": "Society & Rental",
  "Prepaid Meter": "Other bills",
  "eChallan": "Other bills",
  "Fleet Card": "Other bills",
  "Donation": "Other bills",
  "B2B": "Other bills",
  "Other Subscription": "Other bills",
  "Other": "Other bills",
};

/** The Home-screen category label for a Biller Account type. Never "" — falls back to "Other bills". */
export function categoryForBillerType(type) {
  return CATEGORY_MAP[type] || "Other bills";
}
