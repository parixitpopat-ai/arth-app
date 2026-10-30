// src/domain/invoices/orderSummary.js — the Amazon ORDER SUMMARY as data (INVOICE-IMPORT-009, steps 1-3). PURE. No OCR, no I/O, nothing saved.
//
// What it does: parses labelled summary lines (text only), checks the two equations, offers (never applies) a correction, matches a summary to an order,
// compares it with the invoices of that order, and records whether the person accepted the FIGURES. What it never does: create an expense, enable Confirm,
// read the Ship-to / payment lines, or let the person's acknowledgement change a reconciliation result.
//
// Money is whole paise (integers). Discounts are stored as positive amounts and subtracted; the label gives the direction.

export const FIGURE_KEYS = ["subtotal", "shipping", "fee", "total", "discount", "grandTotal"];
export const FIGURE_LABEL = { subtotal: "Item(s) Subtotal", shipping: "Shipping", fee: "Processing fee", total: "Total", discount: "Discount", grandTotal: "Grand Total" };

/** "₹1,234.50" | "1234.5" | "329" -> paise, or null when it is not a plain non-negative amount. A leading minus is ignored (discounts are positive here). */
export function toPaise(text) {
  const t = String(text == null ? "" : text).replace(/[₹\s]/g, "").replace(/^-/, "");
  if (!/^(\d{1,3}(,\d{2})*,\d{3}|\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(t)) return null;
  const [w, f = ""] = t.replace(/,/g, "").split(".");
  return parseInt(w, 10) * 100 + parseInt((f + "00").slice(0, 2), 10);
}

const AMOUNT = "[₹]?\\s*-?\\s*[₹]?\\s*([\\d,]+(?:\\.\\d{1,2})?)";
const LABELS = [
  ["subtotal", new RegExp(`item\\(s\\)\\s*sub\\s*total\\s*:?\\s*${AMOUNT}`, "i")],
  ["shipping", new RegExp(`\\bshipping\\s*(?:&\\s*handling)?\\s*:?\\s*${AMOUNT}`, "i")],
  ["fee", new RegExp(`(?:offer\\s*)?processing\\s*fee\\s*:?\\s*${AMOUNT}`, "i")],
  ["grandTotal", new RegExp(`grand\\s*total\\s*:?\\s*${AMOUNT}`, "i")],
  ["discount", new RegExp(`instant\\s*bank\\s*discount\\s*:?\\s*${AMOUNT}`, "i")],
  ["total", new RegExp(`(?<![a-z])(?<!grand\\s)total\\s*:\\s*${AMOUNT}`, "i")],
];
/** The allow-listed LABELS alone (no amount), used to find a row's label in a picture. Only these rows are ever read; nothing else is kept. */
export const LABEL_ONLY = {
  subtotal: /item\(s\)\s*sub\s*total/i, shipping: /\bshipping\s*(?:&\s*handling)?/i, fee: /(?:offer\s*)?processing\s*fee/i,
  grandTotal: /grand\s*total/i, discount: /instant\s*bank\s*discount/i, total: /(?<![a-z])(?<!grand\s)total\b/i,
};
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

/**
 * Parse labelled summary lines (text PDF lines, or later OCR lines). Only allow-listed labels are read. A line may hold several columns; the label
 * is searched inside it. Any OTHER row that ends in an amount is reported only as "an unrecognised row" with its amount: its label text is never kept
 * (it could be a name or an address).
 * @param {string[]} lines
 */
export function parseOrderSummaryLines(lines) {
  const figures = Object.fromEntries(FIGURE_KEYS.map(k => [k, null]));
  const duplicates = [], unrecognised = [];
  let orderNumber = null, orderDate = null;
  for (const raw of Array.isArray(lines) ? lines : []) {
    const line = String(raw || "");
    const on = /\b(\d{3}-\d{7}-\d{7})\b/.exec(line); if (on && !orderNumber) orderNumber = on[1];
    const d = /order\s*placed\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i.exec(line);
    if (d && MONTHS[d[2].toLowerCase()] && !orderDate) orderDate = `${d[3]}-${String(MONTHS[d[2].toLowerCase()]).padStart(2, "0")}-${d[1].padStart(2, "0")}`;
    let known = false;
    for (const [key, re] of LABELS) {
      const m = re.exec(line);
      if (!m) continue;
      known = true;
      const p = toPaise(m[1]);
      if (p == null) continue;
      if (figures[key] != null && figures[key] !== p) duplicates.push(key); else figures[key] = p;
    }
    if (!known && /^\s*[A-Za-z][A-Za-z()' &/-]{1,40}:\s*[₹-]?\s*[\d,]+\.\d{2}\s*$/.test(line) && !/ship|order|placed|arriv|sold/i.test(line)) {
      const p = toPaise(line.slice(line.lastIndexOf(":") + 1));
      if (p != null) unrecognised.push({ amountPaise: p });
    }
  }
  return { figures, unrecognised, conflictingFigures: [...new Set(duplicates)], orderNumber, orderDate };
}

const eq = (expected, actual) => ({ status: expected == null || actual == null ? "incomplete" : expected === actual ? "holds" : "fails", expectedPaise: expected, actualPaise: actual, differencePaise: expected == null || actual == null ? null : actual - expected });
const sum = (...v) => (v.some(x => x == null) ? null : v.reduce((a, b) => a + b, 0));

/** E1: subtotal + shipping + fee = Total.   E2: Total - discount = Grand Total.  Exact to the paisa; a failure never changes a figure. */
export function checkEquations(f) {
  const e1 = eq(sum(f.subtotal, f.shipping, f.fee), f.total);
  const e2 = eq(f.total == null || f.discount == null ? null : f.total - f.discount, f.grandTotal);
  return { e1, e2, allHold: e1.status === "holds" && e2.status === "holds", failing: [["e1", e1], ["e2", e2]].filter(([, e]) => e.status === "fails").map(([k]) => k) };
}

/**
 * A SUGGESTION, never applied. If exactly one figure could be changed (or filled in, when one is missing) to a single value that makes BOTH equations
 * hold, return it. Two or more candidates, or none, return null. Several missing figures return null.
 * @returns {{figure:string, valuePaise:number, kind:"missing"|"misread"}|null}
 */
export function suggestCorrection(f) {
  const missing = FIGURE_KEYS.filter(k => f[k] == null);
  if (missing.length > 1) return null;
  const { subtotal: s, shipping: sh, fee: fe, total: t, discount: d, grandTotal: g } = f;
  const needed = {
    subtotal: () => (sum(t, sh, fe, d, g) == null ? null : t - sh - fe), shipping: () => (sum(t, s, fe, d, g) == null ? null : t - s - fe), fee: () => (sum(t, s, sh, d, g) == null ? null : t - s - sh),
    total: () => (sum(s, sh, fe, d, g) == null ? null : (s + sh + fe === g + d ? s + sh + fe : null)),
    discount: () => (sum(s, sh, fe, t, g) == null ? null : t - g), grandTotal: () => (sum(s, sh, fe, t, d) == null ? null : t - d),
  };
  const holdsWith = (k, v) => checkEquations({ ...f, [k]: v }).allHold;
  const pool = missing.length === 1 ? missing : FIGURE_KEYS;
  const found = [];
  for (const k of pool) {
    const v = needed[k]();
    if (v == null || v < 0 || v === f[k] || !holdsWith(k, v)) continue;
    found.push({ figure: k, valuePaise: v, kind: f[k] == null ? "missing" : "misread" });
  }
  return found.length === 1 ? found[0] : null;
}

/**
 * Manual entry of the five figures (strings from the form). Total is CALCULATED (subtotal + shipping + fee), never typed, so E1 holds by construction;
 * the person cannot override the equations. A blank shipping, fee or discount means 0; subtotal and Grand Total are required.
 */
export function evaluateManualEntry(input) {
  const errors = {}, p = {};
  for (const [k, required] of [["subtotal", true], ["shipping", false], ["fee", false], ["discount", false], ["grandTotal", true]]) {
    const raw = String(input && input[k] != null ? input[k] : "").trim();
    if (!raw) { if (required) errors[k] = "Enter this amount"; else p[k] = 0; continue; }
    const v = toPaise(raw);
    if (v == null) errors[k] = "Enter a plain amount like 329.00"; else p[k] = v;
  }
  const total = p.subtotal != null && p.shipping != null && p.fee != null ? p.subtotal + p.shipping + p.fee : null;
  const figures = { subtotal: p.subtotal ?? null, shipping: p.shipping ?? null, fee: p.fee ?? null, total, discount: p.discount ?? null, grandTotal: p.grandTotal ?? null };
  const equations = checkEquations(figures);
  return { figures, errors, equations, ready: Object.keys(errors).length === 0 && equations.allHold, suggestion: Object.keys(errors).length ? null : suggestCorrection(figures) };
}

// ---------------- order matching ----------------
export const ORDER_NUMBER_FORMAT = /^\d{3}-\d{7}-\d{7}$/;
const digitsOf = n => String(n).replace(/\D/g, "");
const oneDigitOff = (a, b) => { const x = digitsOf(a), y = digitsOf(b); if (x.length !== y.length || !x.length) return false; let d = 0; for (let i = 0; i < x.length; i++) if (x[i] !== y[i] && ++d > 1) return false; return d === 1; };

/**
 * Which order does this summary belong to? Only an EXACT match attaches by itself. Otherwise the person must choose; a one-digit-off number is only a hint.
 * @param {{orderNumber?:string|null, orders:Array<{orderNumber:string}>}} p
 */
export function matchSummaryToOrder({ orderNumber = null, orders = [] }) {
  if (!orders.length) return { state: "unattached", reason: "no-orders-read", blocks: true };
  const n = orderNumber && ORDER_NUMBER_FORMAT.test(orderNumber) ? orderNumber : null;
  if (n) {
    const exact = orders.filter(o => o.orderNumber === n);
    if (exact.length === 1) return { state: "matched", how: "exact", orderNumber: n, blocks: false };
  }
  const reason = !orderNumber ? "no-number" : !n ? "bad-format" : "no-exact-match";
  return { state: "choose", reason, hints: n ? orders.filter(o => oneDigitOff(n, o.orderNumber)).map(o => o.orderNumber) : [], blocks: true };
}

/** The person's choice: an order number from the orders read, or null for "not sure" (the summary then stays unattached and blocks). */
export function chooseOrder(match, choice, orders) {
  if (choice == null) return { state: "unattached", reason: "not-sure", blocks: true };
  if (!orders.some(o => o.orderNumber === choice)) return match;
  return { state: "chosen", how: "chosen-by-you", orderNumber: choice, blocks: false };
}

/** Re-evaluate after more invoices were added: only unresolved matches change; a chosen or matched order is kept while that order still exists. */
export function rematch(match, typedOrderNumber, orders) {
  if ((match.state === "matched" || match.state === "chosen") && orders.some(o => o.orderNumber === match.orderNumber)) return match;
  if (match.state === "unattached" && match.reason === "not-sure") return match;
  return matchSummaryToOrder({ orderNumber: typedOrderNumber, orders });
}

// ---------------- summaries, acknowledgement ----------------
let seq = 0;
export const SOURCE_LABEL = { typed: "entered by you", "read-from-picture": "read from a picture, checked by you", text: "read from the document, checked by you" };

export function newSummary({ source, figures, unrecognised = [], orderNumber = null, orderDate = null, orders = [] }) {
  return { id: `sum-${++seq}`, source, figures: { ...figures }, unrecognised: unrecognised.slice(), orderNumber, orderDate, acknowledged: false, match: matchSummaryToOrder({ orderNumber, orders }) };
}

/** "These figures are right". Allowed only when both equations hold and nothing is missing or unrecognised. It records acceptance of the FIGURES only. */
export function acknowledge(summary) {
  const eqs = checkEquations(summary.figures);
  if (summary.unrecognised.length) return { ok: false, reason: "unrecognised-row", summary };
  if (!eqs.allHold) return { ok: false, reason: eqs.failing.length ? "equations-fail" : "incomplete", summary };
  return { ok: true, summary: { ...summary, acknowledged: true } };
}

/** Editing any figure withdraws the acknowledgement. */
export function editFigure(summary, key, text) {
  const v = toPaise(text);
  if (!FIGURE_KEYS.includes(key) || v == null) return summary;
  return { ...summary, figures: { ...summary.figures, [key]: v }, acknowledged: false };
}

// ---------------- reconciliation with the invoices (independent of acknowledgement) ----------------
const diffState = (summaryPaise, invoicePaise) => (invoicePaise === summaryPaise ? "matches" : invoicePaise < summaryPaise ? "missing-coverage" : "invoices-exceed");

/**
 * Compare a summary's FIGURES with one order from summariseOrders(). This function takes no acknowledgement and no other state, so acknowledging
 * cannot change its result. Shipping is compared only when the invoices carry a delivery/handling line; discounts are summary-only.
 */
export function reconcileSummaryWithOrder(figures, order) {
  const components = [];
  const add = (name, summaryPaise, invoicePaise) => components.push(invoicePaise == null
    ? { name, summaryPaise, invoicePaise: null, state: "summary-only", differencePaise: 0 }
    : { name, summaryPaise, invoicePaise, state: diffState(summaryPaise, invoicePaise), differencePaise: invoicePaise - summaryPaise });
  add("Items", figures.subtotal, order.itemsPaise);
  add("Fees", figures.fee, order.fees && order.fees.count ? order.fees.totalPaise : 0);
  const ship = sumShipping(order);
  add("Shipping", figures.shipping, ship > 0 ? ship : null);
  add("Discount", figures.discount, null);
  const hasInvoiceMismatch = components.some(c => c.state === "missing-coverage" || c.state === "invoices-exceed");
  return { components, orderTotalPaise: figures.grandTotal, hasInvoiceMismatch };
}
const sumShipping = order => (order.otherCharges || []).filter(r => r.chargeType === "delivery" || r.chargeType === "handling").reduce((s, r) => s + r.totalPaise, 0);

/** Two summaries attached to the same order are a conflict (neither can be trusted); both stay blocked. */
export function attachmentConflicts(summaries) {
  const byOrder = new Map();
  for (const s of summaries) if (s.match && s.match.orderNumber) (byOrder.get(s.match.orderNumber) || byOrder.set(s.match.orderNumber, []).get(s.match.orderNumber)).push(s.id);
  return [...byOrder.entries()].filter(([, ids]) => ids.length > 1).map(([orderNumber, ids]) => ({ orderNumber, ids }));
}

export const GATE_MESSAGE = {
  "amazon-confirm-not-available": "Adding an Amazon order as an expense is not available yet.",
  "summary-not-attached": "The summary is not attached to an order.",
  "figures-not-acknowledged": "The figures have not been accepted yet.",
  "equations-fail": "The figures do not add up.",
  "invoice-mismatch": "The summary and the invoices disagree.",
  "discount-present": "This order has a discount, which Arth cannot record accurately yet.",
  "emi-paid": "This order was paid in EMI, which Arth does not create from an invoice.",
  "duplicate-summary": "More than one summary is attached to this order.",
};

/**
 * The gate for an order. `confirmable` is ALWAYS false in this build (there is no Amazon Confirm); the reasons say why more than that. The acknowledgement
 * only adds or removes the "figures-not-acknowledged" reason: it can never remove "invoice-mismatch", "discount-present", "emi-paid" or any other.
 */
export function orderGate({ summary, order, conflicts = [], emiPaid = false }) {
  const reasons = ["amazon-confirm-not-available"];
  if (emiPaid) reasons.push("emi-paid");
  if (!summary) return { confirmable: false, blocked: true, reasons: [...reasons, "summary-not-attached"], reconciliation: null };
  if (!summary.match || summary.match.blocks) reasons.push("summary-not-attached");
  if (!summary.acknowledged) reasons.push("figures-not-acknowledged");
  if (!checkEquations(summary.figures).allHold) reasons.push("equations-fail");
  if ((summary.figures.discount || 0) > 0) reasons.push("discount-present");
  if (summary.match && summary.match.orderNumber && conflicts.some(c => c.orderNumber === summary.match.orderNumber)) reasons.push("duplicate-summary");
  const reconciliation = order && summary.match && !summary.match.blocks ? reconcileSummaryWithOrder(summary.figures, order) : null;
  if (reconciliation && reconciliation.hasInvoiceMismatch) reasons.push("invoice-mismatch");
  return { confirmable: false, blocked: true, reasons: [...new Set(reasons)], reconciliation };
}
