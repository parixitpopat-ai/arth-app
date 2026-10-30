// A SHOP RECEIPT read from a PHOTO (trial). Off until the person switches it on; the photo is read on this device only and is not kept.
// The shop, date, item rows and amount paid appear in an editable panel marked "read from a photo, please check". They go to the expense form only
// after every row multiplies, the items add up to the amount paid (and to the printed total and quantity when the receipt prints them) and the person
// taps "These figures are right". Nothing is saved here: the expense form opens pre-filled and the person still picks the account and category.
import { useState } from "react";
import { checkReceipt, suggestReceiptFix, toPaise } from "../domain/receipts/receiptParse.js";

const inr = (paise, sym) => `${sym}${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const two = p => (p == null ? "" : (p / 100).toFixed(2));
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

export default function ReceiptPhotoReview({ T, sym = "₹", card, label, onUse }) {
  const [on, setOn] = useState(false);
  const [phase, setPhase] = useState({ name: "idle" });                 // idle | reading | review | declined
  const [shop, setShop] = useState(""), [date, setDate] = useState(""), [paid, setPaid] = useState("");
  const [rows, setRows] = useState([]);                                  // { id, label, qty, rate, value } as text
  const [printed, setPrinted] = useState(null);
  const input = { width: "100%", boxSizing: "border-box", padding: 8, minHeight: 40, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13 };
  const btn = (primary, disabled) => ({ minHeight: 44, padding: "10px 14px", borderRadius: 12, border: primary ? "0" : `1px solid ${T.border}`, background: primary ? T.accent : "none", color: primary ? "#fff" : T.text, fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 });

  const numeric = rows.map(r => ({ label: r.label, qty: Number(r.qty) > 0 ? Number(r.qty) : 0, ratePaise: toPaise(r.rate), valuePaise: toPaise(r.value) }));
  const paidPaise = paid.trim() === "" ? null : toPaise(paid);
  const complete = numeric.length > 0 && numeric.every((n, i) => n.qty > 0 && n.ratePaise != null && n.valuePaise != null && rows[i].label.trim() !== "");
  const c = checkReceipt({ items: numeric.map(n => ({ ...n, valuePaise: n.valuePaise ?? 0 })), printed, paidPaise });
  const suggestion = complete ? suggestReceiptFix({ items: numeric, printed, paidPaise }) : null;
  const canUse = complete && paidPaise != null && c.allHold && validDate(date);

  const chooseFile = async e => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    setPhase({ name: "reading" });
    const [{ readReceiptFromImage }, { DECLINE_MESSAGE }] = await Promise.all([import("../domain/receipts/ocrReceipt.js"), import("../domain/invoices/ocr/ocrSummary.js")]);
    const r = await readReceiptFromImage(file, { baseUrl: new URL("./", document.baseURI).href });
    if (!r.ok) { setPhase({ name: "declined", message: r.reason === "engine" ? "The photo could not be read on this phone. Add the expense by hand instead." : DECLINE_MESSAGE[r.reason] }); return; }
    if (!r.found) { setPhase({ name: "declined", message: "No item rows or amount paid were found in this photo. Try a flat, well-lit, full-length photo of the receipt, or add it by hand." }); return; }
    setShop(r.merchant || ""); setDate(r.date || ""); setPaid(two(r.paidPaise)); setPrinted(r.printed);
    setRows(r.items.map((it, i) => ({ id: `r${i}`, label: it.label, qty: String(it.qty), rate: two(it.ratePaise), value: two(it.valuePaise) })));
    setPhase({ name: "review", conflict: r.conflictingPayments });
  };
  const close = () => { setPhase({ name: "idle" }); setRows([]); setShop(""); setDate(""); setPaid(""); setPrinted(null); };
  const setRow = (id, k, v) => setRows(prev => prev.map(r => (r.id === id ? { ...r, [k]: v } : r)));
  const use = () => {
    if (!canUse) return;
    onUse({ who: shop.trim(), amount: two(paidPaise), date, note: "Read from a receipt photo; checked by you",
      lineItems: numeric.map(n => ({ label: n.label.trim(), qty: n.qty, unitPrice: n.ratePaise / 100 })) });
    close();
  };
  const eqRow = (id, text, e, detail) => (
    <div data-testid={id} data-status={e.status} style={{ fontSize: 12, color: e.status === "fails" ? "#f0a500" : T.text, padding: "3px 0" }}>
      {e.status === "holds" ? "✔ " : e.status === "fails" ? "⚠ " : "… "}{text}{e.status === "fails" && detail ? ` — ${detail}` : ""}
    </div>
  );

  return (
    <div style={card} data-testid="receipt-panel">
      <div style={label}>Shop receipt photo (trial)</div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", color: T.text, fontSize: 13 }}>
        <input data-testid="receipt-toggle" type="checkbox" checked={on} onChange={e => { setOn(e.target.checked); if (!e.target.checked) close(); }} />
        Let Arth read a photo of a shop receipt
      </label>
      {on && phase.name === "idle" && (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: T.sub, fontSize: 12, marginBottom: 8 }}>Use a flat, well-lit, full-length photo. The photo is read on this phone: nothing is uploaded and nothing is saved. You check every figure, then the expense form opens filled in.</div>
          <label style={{ ...btn(false), display: "block", textAlign: "center", cursor: "pointer", color: T.accent, borderStyle: "dashed", borderColor: T.accent }}>
            Choose a receipt photo
            <input data-testid="receipt-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile} style={{ display: "none" }} />
          </label>
        </div>
      )}
      {on && phase.name === "reading" && <div data-testid="receipt-reading" style={{ color: T.sub, fontSize: 13, marginTop: 10 }}>Reading the photo on this phone…</div>}
      {on && phase.name === "declined" && (
        <div data-testid="receipt-declined" style={{ marginTop: 10, fontSize: 12, color: "#f0a500" }}>{phase.message}
          <div style={{ marginTop: 8 }}><button data-testid="receipt-try-again" onClick={close} style={btn(false)}>Try another photo</button></div>
        </div>
      )}
      {on && phase.name === "review" && (
        <div data-testid="receipt-review" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 6 }}>Receipt — read from a photo, please check</div>
          <div style={{ color: T.sub, fontSize: 11, fontWeight: 700 }}>Shop</div>
          <input data-testid="receipt-shop" value={shop} onChange={e => setShop(e.target.value)} style={{ ...input, marginBottom: 6 }} />
          <div style={{ color: T.sub, fontSize: 11, fontWeight: 700 }}>Bill date</div>
          <input data-testid="receipt-date" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...input, marginBottom: 6 }} />
          {!validDate(date) && <div style={{ color: "#f0a500", fontSize: 11, marginBottom: 6 }}>The date was not read. Choose the bill date.</div>}
          <div style={{ color: T.sub, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Items (name · qty · rate · value)</div>
          {rows.map((r, i) => (
            <div key={r.id} data-testid="receipt-row" data-ok={String(c.rows[i] ? c.rows[i].ok : false)} style={{ borderTop: `1px solid ${T.border}`, padding: "6px 0" }}>
              <input data-testid={`receipt-label-${i}`} value={r.label} onChange={e => setRow(r.id, "label", e.target.value)} style={{ ...input, marginBottom: 4 }} />
              <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1fr auto", gap: 6, alignItems: "center" }}>
                <input data-testid={`receipt-qty-${i}`} inputMode="decimal" value={r.qty} onChange={e => setRow(r.id, "qty", e.target.value)} style={input} aria-label="Quantity" />
                <input data-testid={`receipt-rate-${i}`} inputMode="decimal" value={r.rate} onChange={e => setRow(r.id, "rate", e.target.value)} style={input} aria-label="Rate" />
                <input data-testid={`receipt-value-${i}`} inputMode="decimal" value={r.value} onChange={e => setRow(r.id, "value", e.target.value)} style={input} aria-label="Value" />
                <button data-testid={`receipt-remove-${i}`} aria-label="Remove this row" onClick={() => setRows(prev => prev.filter(x => x.id !== r.id))} style={{ ...btn(false), minHeight: 40, padding: "4px 10px" }}>✕</button>
              </div>
              {c.rows[i] && !c.rows[i].ok && <div data-testid={`receipt-rowwarn-${i}`} style={{ color: "#f0a500", fontSize: 11, marginTop: 2 }}>⚠ {c.rows[i].expectedPaise != null ? `qty × rate is ${inr(c.rows[i].expectedPaise, sym)}, the value is ${inr(numeric[i].valuePaise || 0, sym)}` : "Check this row's quantity, rate and value"}</div>}
            </div>
          ))}
          <div style={{ color: T.sub, fontSize: 11, fontWeight: 700, marginTop: 8 }}>Amount paid</div>
          <input data-testid="receipt-paid" inputMode="decimal" value={paid} onChange={e => setPaid(e.target.value)} style={input} placeholder="0.00" />
          {phase.conflict && <div data-testid="receipt-conflict" style={{ color: "#f0a500", fontSize: 11 }}>The receipt shows more than one payment amount. Type the amount you paid.</div>}
          {eqRow("receipt-e2", `Items add up to ${inr(c.sumPaise, sym)} = amount paid`, c.e2, c.e2.expectedPaise != null ? `you paid ${inr(c.e2.expectedPaise, sym)}, the items come to ${inr(c.e2.actualPaise, sym)}` : "enter the amount paid")}
          {printed && printed.totalPaise != null && eqRow("receipt-e1", `Items add up to the printed total ${inr(printed.totalPaise, sym)}`, c.e1, `printed ${inr(c.e1.expectedPaise, sym)}, the items come to ${inr(c.e1.actualPaise, sym)}`)}
          {printed && printed.qty != null && eqRow("receipt-qty", `Quantities add up to the printed ${printed.qty}`, c.qty, `printed ${c.qty.expected}, the rows come to ${c.qty.actual}`)}
          {suggestion && (
            <div data-testid="receipt-suggestion" style={{ fontSize: 12, color: T.sub, padding: "4px 0" }}>
              Did you mean row {suggestion.index + 1} to be {inr(suggestion.valuePaise, sym)}? The items would then add up.
              <button data-testid="receipt-apply-suggestion" onClick={() => setRow(rows[suggestion.index].id, "value", two(suggestion.valuePaise))} style={{ ...btn(false), marginLeft: 8, minHeight: 36, padding: "4px 10px" }}>Use it</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button data-testid="receipt-use" disabled={!canUse} onClick={use} style={btn(true, !canUse)}>These figures are right — open the expense form</button>
            <button data-testid="receipt-cancel" onClick={close} style={btn(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
