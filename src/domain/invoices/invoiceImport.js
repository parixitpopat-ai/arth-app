// src/domain/invoices/invoiceImport.js — PHASE 2: turns a REVIEWED, CONFIRMED invoice preview into the data to write. Pure: it returns a plan; the app applies it.
//
// Rules (INVOICE-IMPORT-003): one invoice makes ONE itemised expense through the existing transaction boundary (same record shape as Quick Add), or adds its
// items to ONE existing same-amount expense (amount, date and account never change). The lines must add up to the invoice total by the app's own rule
// (reconcileLines). The payment account is always the user's choice. Nothing is created for a document that is not a supported, reconciling tax invoice.
// A small record (invoiceImports) remembers the invoice key so the same invoice cannot be added twice; it holds no customer data and no PDF.
import { reconcileLines } from "../transactions/itemLineMath.js";
import { computeLineItemCategoryRollup } from "../transactions/lineItemCategoryRollup.js";
import { validatePaymentDate } from "./invoicePreview.js";
import { localIsoDate } from "../vehicles/fuelFills.js";
import { splitBrand, cleanProduct, sizeOf } from "./brands.js";

export const PARSER_VERSION = "blinkit-gst-1";

/**
 * What each item is called on the expense, and which brand it is. The expense shows the plain product ("Magic Masala Chips"); the brand, size and barcode are kept in the
 * background record for comparing brands later. Order of authority: what the person typed here, then what they told Arth about this barcode last time, then the starter brand list,
 * else no brand is assumed and the full printed name is kept. Returns { srNo: { label, brand, full, size, upc, source } }.
 */
export function resolveItemNames(view, records = [], { itemNames = {}, itemBrands = {}, stripBrands = true } = {}) {
  const remembered = [];
  for (const r of records || []) for (const l of (r && r.lines) || []) if (l && l.upc) remembered.push({ upc: l.upc, brand: l.brand || null, product: l.product });   // newest record first
  const out = {};
  for (const i of view.items) {
    const base = splitBrand(i.name, { upc: i.upc, remembered });
    const brand = itemBrands[i.srNo] !== undefined ? (String(itemBrands[i.srNo] || "").trim() || null) : base.brand;
    let label = base.product;
    if (!stripBrands || (itemBrands[i.srNo] !== undefined && !brand && base.brand)) label = cleanProduct(base.full);       // brand not removed / the person says there is no brand: full name
    if (itemNames[i.srNo] !== undefined && String(itemNames[i.srNo]).trim()) label = String(itemNames[i.srNo]).trim();
    out[i.srNo] = { label, brand, full: base.full, size: sizeOf(base.full), upc: i.upc || null, source: base.source };
  }
  return out;
}
const r2 = n => Math.round(n * 100) / 100;
const lineAmount = li => (parseFloat(li.qty) || 0) * (parseFloat(li.unitPrice) || 0);
const err = (code, message) => ({ code, message });

/** Items (+ handling / delivery rows) as expense lines. Discounts stay inside the printed line total; no negative line is ever produced. */
export function buildLineItems(view, { orderCatId = null, lineCats = {}, suggestedCats = {}, names = null, genId }) {
  const lines = [], catOf = {};
  const nameOf = i => (names && names[i.srNo] && names[i.srNo].label) || i.name;
  const push = (label, qty, total, catId, extra = null) => {
    const unit = r2(total / qty), exact = Math.abs(qty * unit - total) < 0.005;
    // If the printed total cannot be split into whole-paise units, keep it as ONE line so the sum stays exact.
    lines.push(exact ? { id: genId(), label, qty, unitPrice: unit, amount: total, catId, subId: null, splits: null, ...extra }
                     : { id: genId(), label: `${label} (×${qty})`, qty: 1, unitPrice: total, amount: total, catId, subId: null, splits: null, ...extra });
  };
  // A delivery / handling line is a CHARGE (not an item): the expense shares it equally between the splits instead of by item. Its GST (inside the printed total) is kept for the breakup.
  const charge = (type, row) => ({ kind: "charge", chargeType: type, ...(row && (row.cgst || row.sgst) ? { taxIncluded: { cgst: row.cgst || 0, sgst: row.sgst || 0 } } : {}) });
  // An item's category: what the person chose for it, else what Arth remembers for that item name (the item catalogue), else the order's category.
  for (const i of view.items) {
    const c = lineCats[i.srNo] !== undefined ? lineCats[i.srNo] : (suggestedCats[i.srNo] || orderCatId || null);
    catOf[i.srNo] = c; push(nameOf(i), i.qty || 1, i.lineTotal, c);
  }
  const h = view.handling;
  if (h) {
    // A delivery / handling charge is a FEE, not an item. The invoice prints one "Delivery and other charges" row under each item (its share of the charge), so each
    // row carries the category of the item it belongs to: the delivery of the atta counts as groceries, of the nachos as snacks. One combined handling charge takes the
    // order category, else the category of the biggest categorised item. A fee line is never left needing a category when an item has one.
    const biggest = view.items.slice().sort((a, b) => b.lineTotal - a.lineTotal).map(i => catOf[i.srNo]).find(Boolean) || null;
    if (h.consolidated) push(h.label || "Handling charge", 1, h.total, orderCatId || biggest, charge("handling", h));
    else for (const r of h.sourceRows) {
      const parent = view.items.find(i => i.srNo === r.afterItem);
      push(`Delivery and other charges · ${parent ? String(nameOf(parent)).slice(0, 30) : `after item ${r.afterItem}`}`, 1, r.total, catOf[r.afterItem] || orderCatId || biggest, charge("delivery", r));   // not verified as one charge: kept as printed rows
    }
  }
  return lines;
}

/** What Arth already remembers for each item NAME (the app's item catalogue: exact name, case-insensitive). Returns { srNo: catId } only for items it knows. */
export function suggestLineCats(view, catalog = [], validCatIds = null, names = null) {
  const out = {}, valid = validCatIds ? new Set(validCatIds.map(String)) : null;
  const same = (c, n) => String(c.name || "").trim().toLowerCase() === String(n || "").trim().toLowerCase();
  for (const i of view.items) {
    // the plain product name first (so "Chips" is remembered across brands), then the full printed name (what earlier imports remembered)
    const m = (catalog || []).find(c => c && c.catId && names && names[i.srNo] && same(c, names[i.srNo].label)) || (catalog || []).find(c => c && c.catId && same(c, i.name));
    if (m && (!valid || valid.has(String(m.catId)))) out[i.srNo] = m.catId;          // a remembered category that no longer exists is not suggested
  }
  return out;
}

/**
 * @param {{view:object, status:string, mode:"create"|"link", accountId?:string, paymentDate:string, orderCatId?:string|null, lineCats?:object, linkTxnId?:string, fileHash?:string}} input
 * @param {{accounts:Array, txns:Array, records:Array, genId:()=>string, now?:number, today?:string, acknowledgeNoKey?:boolean, importAgain?:boolean}} ctx
 * @returns {{ok:boolean, errors:Array<{code,message}>, create?:object, patch?:{txnId:string, lineItems:Array, previousLineItems:any}, record?:object, lines?:Array, sentence?:string}}
 */
export function planConfirm(input, ctx) {
  const { view, status, mode, accountId, paymentDate, orderCatId = null, lineCats = {}, suggestedCats = {}, linkTxnId, fileHash = null, rememberCats = true, itemNames = {}, itemBrands = {}, stripBrands = true } = input;
  const { accounts = [], txns = [], records = [], catalog = [], genId, now = Date.now(), today = localIsoDate(), acknowledgeNoKey = false, importAgain = false } = ctx;
  const errors = [];
  if (!view || !view.totals) return { ok: false, errors: [err("no-total", "This invoice has no readable total.")] };
  if (status !== "supported") errors.push(err("not-supported", "This invoice needs review first, so it cannot be added."));
  if (view.reconciliation.level === "does-not-add-up") errors.push(err("does-not-add-up", "The invoice figures do not add up, so it cannot be added."));
  const total = r2(view.totals.invoiceTotal);
  if (!(total > 0)) errors.push(err("bad-total", "The invoice total must be more than zero."));

  const names = resolveItemNames(view, records, { itemNames, itemBrands, stripBrands });
  const lines = buildLineItems(view, { orderCatId, lineCats, suggestedCats, names, genId: genId || (() => "x") });
  const recon = reconcileLines(lines.map(lineAmount), total);
  if (!recon.matches) errors.push(err("lines-dont-add-up", `The items add up to ${recon.linesTotal} but the invoice total is ${total}.`));

  // duplicate: the same invoice key may be added once. A record whose expense no longer exists can be added again only on purpose.
  const key = view.importKey, prior = key ? records.find(r => r.key === key) : null;
  if (!key && !acknowledgeNoKey) errors.push(err("no-key", "This invoice has no seller registration or invoice number, so duplicates cannot be checked. Confirm that you understand."));
  if (prior) {
    const alive = txns.some(t => String(t.id) === String(prior.txnId));
    if (alive) errors.push(err("already-imported", `This invoice was already added on ${String(prior.importedAtDate || "").slice(0, 10) || "an earlier date"}.`));
    else if (!importAgain) errors.push(err("orphan", "This invoice was added before, but that expense no longer exists. Tick 'Add it again' to add it on purpose."));
  }
  const dc = validatePaymentDate(paymentDate, today); if (!dc.ok) errors.push(err("bad-date", dc.error));

  let create, patch;
  const rollup = computeLineItemCategoryRollup(lines);
  if (mode === "link") {
    const t = txns.find(x => String(x.id) === String(linkTxnId));
    if (!t || t.type !== "expense") errors.push(err("link-missing", "Choose an existing expense to add these items to."));
    else {
      if (Array.isArray(t.lineItems) && t.lineItems.length) errors.push(err("link-has-items", "That expense already has items. Arth will not overwrite them."));
      if (Math.abs(Number(t.amount) - total) >= 0.005) errors.push(err("link-amount", "Only an expense with exactly the same amount can be linked. Add it as a new expense instead."));
      if (!errors.length) patch = { txnId: String(t.id), lineItems: lines, previousLineItems: t.lineItems === undefined ? null : t.lineItems };
    }
  } else {
    const acc = accounts.find(a => String(a.id) === String(accountId));
    if (!acc) errors.push(err("no-account", "Choose the account you paid from. The invoice does not say how it was paid."));
    else if (!errors.length) {
      const id = genId();
      create = {
        id, type: "expense", amount: total, date: paymentDate, merchant: "Blinkit", desc: "Blinkit",
        catId: rollup.catId, catIds: rollup.catId ? [rollup.catId] : [], subId: null, subIds: [],
        accId: acc.id, people: {}, forPerson: "", groupId: null, vehicleId: null, paymentMethod: null, excludeFromSpend: false,
        splitMode: "none", trackingMode: "none", tagMode: null, note: view.invoiceNumber ? `Blinkit invoice ${view.invoiceNumber}` : "Blinkit invoice",
        lineItems: lines, createdAt: now, createdDate: today,
      };
    }
  }
  if (errors.length) return { ok: false, errors, lines };
  const txnId = create ? create.id : patch.txnId;
  const record = { id: genId(), key: key || null, sellerGstin: view.sellerGstin || null, invoiceNumber: view.invoiceNumber || null, orderId: view.orderId || null, invoiceDate: view.invoiceDate || null,
    totalPaise: Math.round(total * 100), txnId, mode: create ? "created" : "linked", importedAt: now, importedAtDate: today, fileHash, parserVersion: PARSER_VERSION,
    // Background memory for brand comparison (not shown on the expense): the full printed name, the brand and plain product, the size in the name, the barcode, and what it cost.
    // The barcode also lets Arth reuse a brand correction the next time the same product comes up.
    lines: view.items.map((i, idx) => ({ upc: i.upc || null, full: names[i.srNo].full, brand: names[i.srNo].brand, product: names[i.srNo].label, size: names[i.srNo].size, qty: i.qty || 1, amount: i.lineTotal, unitPrice: lines[idx] ? lines[idx].unitPrice : null })) };
  const n = lines.length, accName = create ? (accounts.find(a => String(a.id) === String(accountId)) || {}).name : null;
  const sentence = create ? `Add 1 expense of ₹${total} to ${accName} on ${paymentDate}, with ${n} item line${n === 1 ? "" : "s"}.`
                          : `Add ${n} item line${n === 1 ? "" : "s"} to your ₹${total} expense. Its amount, date and account stay as they are.`;
  // Learning (the app's item catalogue, same rule as the item sheet): an item name Arth has never seen is remembered with the category it ended up with; a known name changes
  // only when the person explicitly chose a different category for it here and left "remember" on. Applied by the app only AFTER the save is verified.
  const learn = [];
  const sameName = (c, n) => String(c.name || "").trim().toLowerCase() === String(n || "").trim().toLowerCase();
  if (rememberCats) view.items.forEach((i, idx) => {
    const catId = lines[idx] && lines[idx].catId, plain = names[i.srNo].label;                       // remembered under the plain product name, so it carries across brands
    if (!catId) return;
    const known = (catalog || []).find(c => c && sameName(c, plain)) || (catalog || []).find(c => c && sameName(c, i.name));
    if (!known) learn.push({ op: "add", name: plain, catId });
    else if (lineCats[i.srNo] !== undefined && lineCats[i.srNo] && known.catId !== lineCats[i.srNo]) learn.push({ op: "update", id: known.id, name: plain, catId: lineCats[i.srNo] });
  });
  const uncategorised = lines.filter(l => !l.catId).length;
  return { ok: true, errors: [], create, patch, record, lines, sentence, learn, uncategorised };
}

/** True when the expense carries something the import did not put there. For a created expense: any person/group split, allocation, note change or settlement. For a linked one (created == null): item-level allocations that would dangle if the items were taken off again. */
function touchedSince(t, created) {
  const hasAlloc = Array.isArray(t.allocations) && t.allocations.length > 0;
  if (!created) return hasAlloc;
  const people = t.people && typeof t.people === "object" ? Object.keys(t.people).length > 0 : false;
  const splitPeople = t.splitPeople && typeof t.splitPeople === "object" ? Object.keys(t.splitPeople).length > 0 : false;
  const groups = Array.isArray(t.groupAllocations) && t.groupAllocations.length > 0;
  const links = Array.isArray(t.settlementLinks) && t.settlementLinks.length > 0;
  return hasAlloc || people || splitPeople || groups || links || Boolean(t.groupId) || Boolean(t.forPerson) || String(t.note || "") !== String(created.note || "");
}

/** Can this import be undone safely? Only if the expense is exactly as the import left it. */
export function planUndo(record, plan, txns) {
  const t = txns.find(x => String(x.id) === String(record.txnId));
  if (!t) return { ok: false, reason: "The expense no longer exists, so there is nothing to undo." };
  if (record.mode === "created") {
    const same = ["id", "amount", "date", "accId", "merchant", "catId"].every(k => String(t[k]) === String(plan.create[k])) && JSON.stringify(t.lineItems) === JSON.stringify(plan.create.lineItems);   // the boundary may add its own fields
    if (!same) return { ok: false, reason: "The expense was changed after it was added, so it was left alone." };
    // Anything added since (people or groups it is split with, a note, a settlement) would be thrown away with the expense, so Undo refuses.
    if (touchedSince(t, plan.create)) return { ok: false, reason: "The expense was changed after it was added (people, notes or payments), so it was left alone." };
    return { ok: true, action: "remove-expense" };
  }
  if (touchedSince(t, null)) return { ok: false, reason: "The expense was changed after the items were added to it (people or groups were tagged to the items), so it was left alone." };
  if (JSON.stringify(t.lineItems) !== JSON.stringify(plan.patch.lineItems) || Math.abs(Number(t.amount) - record.totalPaise / 100) >= 0.005) return { ok: false, reason: "The expense was changed after the items were added, so it was left alone." };
  return { ok: true, action: "restore-items", previousLineItems: plan.patch.previousLineItems };
}
