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

export const PARSER_VERSION = "blinkit-gst-1";
const r2 = n => Math.round(n * 100) / 100;
const lineAmount = li => (parseFloat(li.qty) || 0) * (parseFloat(li.unitPrice) || 0);
const err = (code, message) => ({ code, message });

/** Items (+ handling / delivery rows) as expense lines. Discounts stay inside the printed line total; no negative line is ever produced. */
export function buildLineItems(view, { orderCatId = null, lineCats = {}, genId }) {
  const lines = [];
  const push = (label, qty, total, catId) => {
    const unit = r2(total / qty), exact = Math.abs(qty * unit - total) < 0.005;
    // If the printed total cannot be split into whole-paise units, keep it as ONE line so the sum stays exact.
    lines.push(exact ? { id: genId(), label, qty, unitPrice: unit, amount: total, catId, subId: null, splits: null }
                     : { id: genId(), label: `${label} (×${qty})`, qty: 1, unitPrice: total, amount: total, catId, subId: null, splits: null });
  };
  for (const i of view.items) push(i.name, i.qty || 1, i.lineTotal, lineCats[i.srNo] !== undefined ? lineCats[i.srNo] : orderCatId);
  const h = view.handling;
  if (h) {
    if (h.consolidated) push(h.label || "Handling charge", 1, h.total, orderCatId);
    else for (const r of h.sourceRows) push(`Delivery and other charges (after item ${r.afterItem})`, 1, r.total, orderCatId);   // not verified as one charge: kept as printed
  }
  return lines;
}

/**
 * @param {{view:object, status:string, mode:"create"|"link", accountId?:string, paymentDate:string, orderCatId?:string|null, lineCats?:object, linkTxnId?:string, fileHash?:string}} input
 * @param {{accounts:Array, txns:Array, records:Array, genId:()=>string, now?:number, today?:string, acknowledgeNoKey?:boolean, importAgain?:boolean}} ctx
 * @returns {{ok:boolean, errors:Array<{code,message}>, create?:object, patch?:{txnId:string, lineItems:Array, previousLineItems:any}, record?:object, lines?:Array, sentence?:string}}
 */
export function planConfirm(input, ctx) {
  const { view, status, mode, accountId, paymentDate, orderCatId = null, lineCats = {}, linkTxnId, fileHash = null } = input;
  const { accounts = [], txns = [], records = [], genId, now = Date.now(), today = localIsoDate(), acknowledgeNoKey = false, importAgain = false } = ctx;
  const errors = [];
  if (!view || !view.totals) return { ok: false, errors: [err("no-total", "This invoice has no readable total.")] };
  if (status !== "supported") errors.push(err("not-supported", "This invoice needs review first, so it cannot be added."));
  if (view.reconciliation.level === "does-not-add-up") errors.push(err("does-not-add-up", "The invoice figures do not add up, so it cannot be added."));
  const total = r2(view.totals.invoiceTotal);
  if (!(total > 0)) errors.push(err("bad-total", "The invoice total must be more than zero."));

  const lines = buildLineItems(view, { orderCatId, lineCats, genId: genId || (() => "x") });
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
    totalPaise: Math.round(total * 100), txnId, mode: create ? "created" : "linked", importedAt: now, importedAtDate: today, fileHash, parserVersion: PARSER_VERSION };
  const n = lines.length, accName = create ? (accounts.find(a => String(a.id) === String(accountId)) || {}).name : null;
  const sentence = create ? `Add 1 expense of ₹${total} to ${accName} on ${paymentDate}, with ${n} item line${n === 1 ? "" : "s"}.`
                          : `Add ${n} item line${n === 1 ? "" : "s"} to your ₹${total} expense. Its amount, date and account stay as they are.`;
  return { ok: true, errors: [], create, patch, record, lines, sentence };
}

/** Can this import be undone safely? Only if the expense is exactly as the import left it. */
export function planUndo(record, plan, txns) {
  const t = txns.find(x => String(x.id) === String(record.txnId));
  if (!t) return { ok: false, reason: "The expense no longer exists, so there is nothing to undo." };
  if (record.mode === "created") {
    const same = ["id", "amount", "date", "accId", "merchant", "catId"].every(k => String(t[k]) === String(plan.create[k])) && JSON.stringify(t.lineItems) === JSON.stringify(plan.create.lineItems);   // the boundary may add its own fields
    if (!same) return { ok: false, reason: "The expense was changed after it was added, so it was left alone." };
    return { ok: true, action: "remove-expense" };
  }
  if (JSON.stringify(t.lineItems) !== JSON.stringify(plan.patch.lineItems) || Math.abs(Number(t.amount) - record.totalPaise / 100) >= 0.005) return { ok: false, reason: "The expense was changed after the items were added, so it was left alone." };
  return { ok: true, action: "restore-items", previousLineItems: plan.patch.previousLineItems };
}
