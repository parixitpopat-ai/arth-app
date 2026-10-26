// Order summary, entered by hand (INVOICE-IMPORT-009 steps 2 and 3). No OCR, no file is read here. Nothing is saved; figures live in this screen's memory.
// The person types five amounts; Total is calculated and the two equations are shown. The summary is then attached to an order: exact number, or chosen by the person.
import { useState } from "react";
import { evaluateManualEntry, newSummary, acknowledge, chooseOrder, ORDER_NUMBER_FORMAT, SOURCE_LABEL } from "../domain/invoices/orderSummary.js";

const inr = (paise, sym) => `${sym}${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FIELDS = [["subtotal", "Item(s) Subtotal"], ["shipping", "Shipping (blank = 0)"], ["fee", "Processing fee (blank = 0)"], ["discount", "Discount (blank = 0)"], ["grandTotal", "Grand Total (what you paid)"]];
const EMPTY = { subtotal: "", shipping: "", fee: "", discount: "", grandTotal: "" };

export default function OrderSummaryPanel({ T, sym = "₹", card, label, orders, summaries, onAdd, onChoose, onRemove }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState(EMPTY);
  const [orderNo, setOrderNo] = useState("");
  const r = evaluateManualEntry(vals);
  const numberBad = orderNo.trim() !== "" && !ORDER_NUMBER_FORMAT.test(orderNo.trim());
  const input = { width: "100%", boxSizing: "border-box", padding: 10, minHeight: 44, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 14 };
  const btn = (primary, disabled) => ({ minHeight: 44, padding: "10px 14px", borderRadius: 12, border: primary ? "0" : `1px solid ${T.border}`, background: primary ? T.accent : "none", color: primary ? "#fff" : T.text, fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 });
  const eqRow = (id, text, e) => (
    <div data-testid={id} data-status={e.status} style={{ fontSize: 12, color: e.status === "fails" ? "#f0a500" : T.text, padding: "3px 0" }}>
      {e.status === "holds" ? "✔ " : e.status === "fails" ? "⚠ " : "… "}{text}{e.status === "fails" ? ` — it should be ${inr(e.expectedPaise, sym)}, you have ${inr(e.actualPaise, sym)}` : ""}
    </div>
  );
  const submit = () => {
    const s = newSummary({ source: "typed", figures: r.figures, orderNumber: orderNo.trim() || null, orders });
    const a = acknowledge(s);
    if (!a.ok) return;
    onAdd(a.summary); setVals(EMPTY); setOrderNo(""); setOpen(false);
  };
  const optionLabel = o => `${o.invoiceDate} · ${[...new Set(o.sellers.map(s => s.sellerName))].join(", ") || "fees only"} · ${inr(o.invoicedPaise, sym)}`;

  return (
    <div data-testid="summary-panel">
      <div style={card}>
        <div style={label}>Order summary</div>
        <div style={{ color: T.sub, fontSize: 12, marginBottom: 8 }}>Type the five amounts from the Amazon Order Summary. Nothing is read from a picture, and nothing is saved.</div>
        {!open && <button data-testid="summary-enter" onClick={() => setOpen(true)} style={btn(false)}>Enter the order summary</button>}
        {open && (
          <div data-testid="summary-form">
            {FIELDS.map(([k, name]) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <div style={{ color: T.sub, fontSize: 11, fontWeight: 700 }}>{name}</div>
                <input data-testid={`summary-${k}`} inputMode="decimal" autoComplete="off" value={vals[k]} onChange={e => setVals({ ...vals, [k]: e.target.value })} style={input} placeholder="0.00" />
                {r.errors[k] && vals[k] !== "" && <div style={{ color: "#f0a500", fontSize: 11 }}>{r.errors[k]}</div>}
              </div>
            ))}
            <div data-testid="summary-total" style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, color: T.text, padding: "6px 0" }}><span>Total (calculated)</span><span>{r.figures.total == null ? "—" : inr(r.figures.total, sym)}</span></div>
            {eqRow("summary-e1", "Subtotal + shipping + fee = Total", r.equations.e1)}
            {eqRow("summary-e2", "Total − discount = Grand Total", r.equations.e2)}
            {r.suggestion && <div data-testid="summary-suggestion" style={{ fontSize: 12, color: T.sub, padding: "4px 0" }}>Check the {r.suggestion.figure === "grandTotal" ? "Grand Total" : r.suggestion.figure}: the figures would add up if it were {inr(r.suggestion.valuePaise, sym)}. Nothing is changed for you.</div>}
            <div style={{ marginTop: 8 }}>
              <div style={{ color: T.sub, fontSize: 11, fontWeight: 700 }}>Order number (optional)</div>
              <input data-testid="summary-ordernumber" value={orderNo} onChange={e => setOrderNo(e.target.value)} style={input} placeholder="405-1234567-1234567" />
              {numberBad && <div data-testid="summary-ordernumber-bad" style={{ color: "#f0a500", fontSize: 11 }}>That is not in the form 123-1234567-1234567; you can choose the order instead.</div>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button data-testid="summary-ack" disabled={!r.ready} onClick={submit} style={btn(true, !r.ready)}>These figures are right</button>
              <button data-testid="summary-cancel" onClick={() => { setOpen(false); setVals(EMPTY); setOrderNo(""); }} style={btn(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      {summaries.map(s => (
        <div key={s.id} style={card} data-testid="summary-card" data-state={s.match.state} data-acknowledged={String(s.acknowledged)}>
          <div style={label}>Order summary · {SOURCE_LABEL[s.source]}</div>
          {[["Item(s) Subtotal", s.figures.subtotal], ["Shipping", s.figures.shipping], ["Processing fee", s.figures.fee], ["Total", s.figures.total], ["Discount", s.figures.discount], ["Grand Total", s.figures.grandTotal]].map(([n, v]) => (
            <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.text, padding: "2px 0", fontWeight: n === "Grand Total" ? 800 : 500 }}><span>{n}</span><span>{v == null ? "—" : inr(v, sym)}</span></div>
          ))}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }} data-testid="summary-attachment">
            {(s.match.state === "matched" || s.match.state === "chosen") && (() => { const o = orders.find(x => x.orderNumber === s.match.orderNumber); return (
              <div style={{ fontSize: 12, color: T.text }}>Belongs to: <b>{o ? optionLabel(o) : "an order"}</b> — {s.match.how === "exact" ? "matched exactly" : "chosen by you"}
                {s.match.state === "chosen" && <button data-testid="summary-rechoose" onClick={() => onChoose(s.id, undefined)} style={{ ...btn(false), marginLeft: 8, minHeight: 36, padding: "4px 10px" }}>Change</button>}
              </div>); })()}
            {s.match.state === "unattached" && s.match.reason === "no-orders-read" && <div data-testid="summary-blocked" style={{ fontSize: 12, color: "#f0a500" }}>No invoices have been read yet, so this summary is not attached to an order. Confirmation is blocked. Add the invoices from this order.</div>}
            {s.match.state === "unattached" && s.match.reason === "not-sure" && (
              <div data-testid="summary-blocked" style={{ fontSize: 12, color: "#f0a500" }}>Not attached to any order. Confirmation is blocked.
                <button data-testid="summary-rechoose" onClick={() => onChoose(s.id, undefined)} style={{ ...btn(false), marginLeft: 8, minHeight: 36, padding: "4px 10px" }}>Choose an order</button></div>)}
            {s.match.state === "choose" && (
              <div data-testid="summary-picker">
                <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 4 }}>Which order is this for?</div>
                {s.match.reason === "no-exact-match" && <div style={{ fontSize: 11, color: T.sub, marginBottom: 4 }}>The order number you typed matches none of the orders read.</div>}
                {s.match.reason === "bad-format" && <div style={{ fontSize: 11, color: T.sub, marginBottom: 4 }}>The order number was not in the expected form.</div>}
                {orders.map(o => (
                  <button key={o.orderNumber} data-testid="summary-order-option" data-hint={String(s.match.hints.includes(o.orderNumber))} onClick={() => onChoose(s.id, o.orderNumber)} style={{ ...btn(false), display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}>
                    {optionLabel(o)}{s.match.hints.includes(o.orderNumber) ? "  ·  looks like the number you typed (one digit differs)" : ""}
                  </button>
                ))}
                <button data-testid="summary-not-sure" onClick={() => onChoose(s.id, null)} style={btn(false)}>I am not sure</button>
                <div data-testid="summary-blocked" style={{ fontSize: 12, color: "#f0a500", marginTop: 6 }}>Not attached yet: confirmation is blocked until you choose.</div>
              </div>)}
          </div>
          <button data-testid="summary-remove" onClick={() => onRemove(s.id)} style={{ ...btn(false), marginTop: 8 }}>Remove this summary</button>
        </div>
      ))}
    </div>
  );
}
