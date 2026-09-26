// domain/relationships/attributedAccounts.js
//
// UI-2C QW-6 — read-only: the financial relationships (billerAccounts)
// attributed to one person or group, each with the state of its Bills, for
// Person detail (P-4) and Group detail (G-12). It never writes.
//
// Bill badge rules follow Claude Design's D-16 vocabulary:
//   Overdue — past its due date with a balance left
//   Due     — balance left and due within 14 days
//   Unpaid  — balance left, due later or no due date
//   Paid    — the newest Bill is paid and nothing is open
// "Partially paid" needs Bill balances from Contributions (WP-4 / M2) and
// is not derived here yet. Cancelled Bills are ignored.

const DUE_WINDOW_DAYS = 14;
const DAY_MS = 86400000;

const localYMD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ymdToNoon = ymd => {
  const [y, m, dd] = String(ymd).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, dd, 12);
};
const daysBetween = (fromYMD, toYMD) => Math.round((ymdToNoon(toYMD) - ymdToNoon(fromYMD)) / DAY_MS);

const isOpen = b => b && b.status !== "paid" && b.status !== "cancelled";
const isValidYMD = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || ""));

/** D-16 badge for one open Bill: { kind, days } with kind overdue | due | unpaid. */
export function getOpenBillBadge(bill, refDate = new Date()) {
  if (!isValidYMD(bill?.dueDate)) return { kind: "unpaid", days: null };
  const days = daysBetween(localYMD(refDate), bill.dueDate);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days <= DUE_WINDOW_DAYS) return { kind: "due", days };
  return { kind: "unpaid", days };
}

const URGENCY = { overdue: 0, due: 1, unpaid: 2 };

/**
 * The one Bill to show for a relationship: the most urgent open Bill
 * (overdue first, then the earliest due date), else the newest paid Bill.
 * Returns { kind: overdue|due|unpaid|paid|none, bill, days }.
 */
export function getRelationshipBillState(billerAccountId, bills, refDate = new Date()) {
  const id = String(billerAccountId);
  const own = (bills || []).filter(b => b && String(b.billerAccountId) === id);
  const open = own.filter(isOpen).map(b => ({ bill: b, ...getOpenBillBadge(b, refDate) }));
  if (open.length) {
    open.sort((a, b) =>
      URGENCY[a.kind] - URGENCY[b.kind]
      || String(a.bill.dueDate || "9999").localeCompare(String(b.bill.dueDate || "9999")));
    return open[0];
  }
  const paid = own.filter(b => b.status === "paid")
    .sort((a, b) => String(b.paidDate || b.dueDate || "").localeCompare(String(a.paidDate || a.dueDate || "")));
  if (paid.length) return { kind: "paid", bill: paid[0], days: null };
  return { kind: "none", bill: null, days: null };
}

/**
 * Relationships attributed to a person ("person") or group ("group"), in a
 * stable order: anything needing attention first, then by name.
 */
export function getAttributedRelationships({ targetType, targetId, billerAccounts = [], bills = [], refDate = new Date() }) {
  const id = String(targetId);
  const rows = billerAccounts
    .filter(ba => ba && ba.attributeType === targetType && String(ba.attributedTo) === id)
    .map(ba => ({ billerAccount: ba, state: getRelationshipBillState(ba.id, bills, refDate) }));
  const rank = { overdue: 0, due: 1, unpaid: 2, paid: 3, none: 4 };
  return rows.sort((a, b) =>
    rank[a.state.kind] - rank[b.state.kind]
    || String(a.billerAccount.name || "").localeCompare(String(b.billerAccount.name || ""), "en", { sensitivity: "base" }));
}

/**
 * UI-2C P-1 / G-10 list rows: how many relationships, and the one Bill
 * that needs attention (the first row after getAttributedRelationships'
 * ordering), if any open Bill exists.
 */
export function summarizeRelationships(rows) {
  const list = rows || [];
  const first = list[0]?.state;
  const attention = first && (first.kind === "overdue" || first.kind === "due" || first.kind === "unpaid") ? first : null;
  return { count: list.length, attention };
}
