// domain/person/personOverview.js
//
// Pure, testable adapters for the Rich Person Profile's Person Overview
// screen (ARTH-003 Phase B, WP-B1). No React, no App.jsx dependency, no
// state — same discipline as domain/schoolFees/service.js and
// domain/school/relationship.js. Every existing authority (Transactions,
// Budget's category data, Groups, Membership) is consumed by injection,
// never reimplemented here.
//
// This file introduces NO new financial authority. It composes existing
// data into the shapes the Person Overview screen needs — RPP-002 §27's
// own rule: "Person Profile is an aggregation/context layer... it should
// not recreate their ledgers."

/**
 * WP-B4's adapter — confirmed absent by WP-A4's direct trace (App.jsx
 * L1781's budgetAlerts is a total-spend-vs-allocation ALERT mechanism, not
 * a category breakdown; nothing in the app currently produces "Education
 * ₹8,000 / Food ₹5,400" for a given person). This is genuinely new
 * composition, not a reuse — flagged as such rather than implied to
 * already exist.
 *
 * Reuses the app's real attribution function by injection
 * (getPersonAttributedAmount, already correct per PPL-000's trace) —
 * never reimplements how a transaction's amount is attributed to a person.
 *
 * @param {string} personId
 * @param {Array} monthTxns - the caller's own already-computed
 *   this-month transaction list (e.g. thisMonthTxns from App.jsx) —
 *   this function does not filter by month itself, to avoid a second,
 *   possibly-diverging date-range definition from the one Home/Budget
 *   already use.
 * @param {Function} getPersonAttributedAmount - injected, the real
 *   existing function (App.jsx ~L1703), never reimplemented here
 * @param {Function} getTxnCategoryIds - injected, the real existing
 *   function used elsewhere for category filtering (App.jsx's own
 *   txnCategoryFilter logic uses an equivalent) — injected so this
 *   adapter can't drift from however the app actually derives a
 *   transaction's category
 * @param {Function} getCat - injected, the real existing function
 *   (App.jsx ~L1216) that resolves a category id to its display record —
 *   `getCat(id) => {name, color, icon, subs}`, with its own graceful
 *   `{name:"?",...}` fallback for an unknown id. Deliberately a function,
 *   matching the app's real shape — there is no categoriesById map
 *   anywhere in the live app; every category lookup goes through this
 *   function, and this adapter does the same rather than assuming a map
 *   that doesn't exist.
 * @returns {{ total: number, byCategory: Array<{catId, name, icon, amount}> }}
 *   byCategory sorted descending by amount; categories with zero
 *   attributed spend are omitted, never shown as a zero row
 */
export function getPersonSpendingSummary(personId, monthTxns, getPersonAttributedAmount, getTxnCategoryIds, getCat) {
  const byCategory = new Map();
  let total = 0;

  for (const t of (monthTxns || [])) {
    if (!t || t.type !== "expense") continue;
    const amount = getPersonAttributedAmount(t, personId);
    if (!(amount > 0)) continue;
    total += amount;
    const catIds = getTxnCategoryIds(t) || [];
    // A transaction with multiple categories (itemized) attributes its
    // full person-share to EACH category it touches, matching how the
    // existing txnCategoryFilter already treats multi-category
    // transactions elsewhere in the app (inclusion, not division) — this
    // adapter does not invent a different convention.
    const targets = catIds.length > 0 ? catIds : ["uncategorized"];
    for (const catId of targets) {
      byCategory.set(catId, (byCategory.get(catId) || 0) + amount);
    }
  }

  const rows = [...byCategory.entries()]
    .map(([catId, amount]) => {
      if (catId === "uncategorized") {
        // Sentinel value this function itself introduces (see targets
        // above) — never a real category id, so it must not be run
        // through getCat(), which would return getCat's own "?" fallback
        // instead of a genuinely meaningful "Uncategorized" label.
        return { catId, name: "Uncategorized", icon: "📦", amount };
      }
      const cat = getCat(catId);
      return { catId, name: cat.name, icon: cat.icon, amount };
    })
    .sort((a, b) => b.amount - a.amount);

  return { total, byCategory: rows };
}

/**
 * WP-B3's Active section — presence-based, per RPP-002 §2/§5/§6 (locked):
 * School/Gym/Membership are NOT PERSON_MODULES toggles. A connection
 * appears here if and only if a real relationship record exists — never
 * because a feature was "enabled," and a hospital/one-off expense never
 * produces an entry here regardless of amount or recency.
 *
 * School is included via an empty-default parameter deliberately — Phase
 * E hasn't wired any App.jsx state for schoolRelationships[] yet (WP-C2/C3
 * only built the pure domain layer, never touched App.jsx). Calling this
 * function today with schoolRelationships omitted correctly produces zero
 * School entries; the day Phase E adds that state, passing the real array
 * in requires ZERO changes to this function or the screen that renders it.
 *
 * @param {string} personId
 * @param {Object} sources
 * @param {Array} sources.groups - the real groups[] the person belongs to
 *   (caller pre-filters to this person's memberships — this function does
 *   not re-derive group membership, Groups remains the authority)
 * @param {Array} [sources.membershipRelationships] - real
 *   membershipRelationships[] (domain/membership/relationship.js's shape)
 * @param {Array} [sources.schoolRelationships] - real schoolRelationships[]
 *   (domain/school/relationship.js's shape) — empty array until Phase E
 *   wires real state; this parameter exists now so no adapter change is
 *   needed later
 * @param {Function} isDateActiveMembershipCoverage - injected from
 *   lifecycle.js (WP-C1's now-generic function), used for the Membership
 *   check specifically.
 * @param {Function} isSchoolRelationshipCurrent - injected from
 *   domain/school/relationship.js (WP-C2), used for the School check —
 *   each domain's own established wrapper is used for its own entries
 *   rather than cross-borrowing Membership's function for School, even
 *   though both ultimately call the same generic
 *   getRelationshipStatusAsOfDate underneath.
 * @param {string} today - date string, injected for determinism
 * @returns {Array<{type:"group"|"membership"|"school", id, label, ...}>}
 *   Groups first, then Membership, then School — matching RPP-002 §1's
 *   wireframe order (🏫 School, 🏋️ Gym, 👨‍👩‍👦 Groups is the doc's own
 *   illustrative order, but the actual product decision was presence, not
 *   a fixed sort — callers/screens are free to reorder for display;
 *   this function's own return order is stable and documented, not
 *   asserted as the final UI order)
 */
export function getPersonActiveConnections(personId, sources, isDateActiveMembershipCoverage, isSchoolRelationshipCurrent, today) {
  const { groups = [], membershipRelationships = [], schoolRelationships = [] } = sources || {};
  const connections = [];

  for (const g of groups) {
    if (!g || !Array.isArray(g.members) || !g.members.includes(personId)) continue;
    connections.push({ type: "group", id: g.id, label: g.name, icon: g.icon || "👨‍👩‍👦" });
  }

  for (const rel of membershipRelationships) {
    if (!rel || rel.personId !== personId) continue;
    if (!isDateActiveMembershipCoverage(today, rel.statusHistory)) continue; // ended/paused — not Active
    connections.push({ type: "membership", id: rel.id, billerAccountId: rel.billerAccountId });
  }

  for (const rel of schoolRelationships) {
    if (!rel || rel.personId !== personId) continue;
    if (!isSchoolRelationshipCurrent(rel.statusHistory, today)) continue; // ended — not Active, shows under history instead
    connections.push({ type: "school", id: rel.id, schoolId: rel.schoolId });
  }

  return connections;
}
