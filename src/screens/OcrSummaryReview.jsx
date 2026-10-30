// Order summary read from a PICTURE (INVOICE-IMPORT-009 step 6). Off until the person switches it on; reads the picture on this device only.
// The figures appear in an editable panel marked "read from a picture, please check". They count only after both equations hold and the person taps
// "These figures are right" (a statement about the figures only). Nothing is saved; the picture and the recognised text are not kept - only the
// figures, the order number and the order date, in this screen's memory.
import { useState } from "react";
import { FIGURE_KEYS, FIGURE_LABEL, checkEquations, suggestCorrection, toPaise, newSummary, acknowledge } from "../domain/invoices/orderSummary.js";

const inr = (paise, sym) => `${sym}${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const asText = p => (p == null ? "" : (p / 100).toFixed(2));

export default function OcrSummaryReview({ T, sym = "₹", card, label, orders, onAdd, onManual }) {
  const [on, setOn] = useState(false);
  const [phase, setPhase] = useState({ name: "idle" });          // idle | reading | review | declined
  const [vals, setVals] = useState({});
  const [orderNo, setOrderNo] = useState("");
  const [extra, setExtra] = useState({ unrecognised: [], conflicts: [] });
  const input = { width: "100%", boxSizing: "border-box", padding: 10, minHeight: 44, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 14 };
  const btn = (primary, disabled) => ({ minHeight: 44, padding: "10px 14px", borderRadius: 12, border: primary ? "0" : `1px solid ${T.border}`, background: primary ? T.accent : "none", color: primary ? "#fff" : T.text, fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 });

  const figures = Object.fromEntries(FIGURE_KEYS.map(k => [k, String(vals[k] ?? "").trim() === "" ? null : toPaise(vals[k])]));
  const bad = k => String(vals[k] ?? "").trim() !== "" && figures[k] == null;
  const eqs = checkEquations(figures);
  const suggestion = FIGURE_KEYS.some(bad) ? null : suggestCorrection(figures);
  const blocked = extra.unrecognised.length > 0 || extra.conflicts.length > 0;
  const canAck = !FIGURE_KEYS.some(bad) && !blocked && eqs.allHold;       // the same rule acknowledge() enforces again on tap

  const chooseFile = async e => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    setPhase({ name: "reading" });
    const { readSummaryFromImage, DECLINE_MESSAGE } = await import("../domain/invoices/ocr/ocrSummary.js");
    const r = await readSummaryFromImage(file, { baseUrl: new URL("./", document.baseURI).href });
    if (!r.ok) { setPhase({ name: "declined", message: r.reason === "engine" ? "The picture could not be read on this phone. Type the figures instead." : DECLINE_MESSAGE[r.reason] }); return; }
    if (!r.found) { setPhase({ name: "declined", message: "No order summary amounts were found in this picture. Choose a clearer screenshot of the Order Summary, or type the figures." }); return; }
    setVals(Object.fromEntries(FIGURE_KEYS.map(k => [k, asText(r.figures[k])])));
    setOrderNo(r.orderNumber || "");
    setExtra({ unrecognised: r.unrecognised, conflicts: r.conflictingFigures || [] });
    setPhase({ name: "review" });
  };
  const close = () => { setPhase({ name: "idle" }); setVals({}); setOrderNo(""); setExtra({ unrecognised: [], conflicts: [] }); };
  const submit = () => {
    if (!canAck) return;
    const a = acknowledge(newSummary({ source: "read-from-picture", figures, unrecognised: extra.unrecognised, orderNumber: orderNo.trim() || null, orders }));
    if (!a.ok) return;
    onAdd(a.summary); close();
  };
  const eqRow = (id, text, e) => (
    <div data-testid={id} data-status={e.status} style={{ fontSize: 12, color: e.status === "fails" ? "#f0a500" : T.text, padding: "3px 0" }}>
      {e.status === "holds" ? "✔ " : e.status === "fails" ? "⚠ " : "… "}{text}{e.status === "fails" ? ` — it should be ${inr(e.expectedPaise, sym)}, you have ${inr(e.actualPaise, sym)}` : ""}
    </div>
  );
  const IN = { subtotal: ["e1"], shipping: ["e1"], fee: ["e1"], total: ["e1", "e2"], discount: ["e2"], grandTotal: ["e2"] };
  const tick = k => (figures[k] == null ? "…" : IN[k].every(e => eqs[e].status === "holds") ? "✔" : IN[k].some(e => eqs[e].status === "fails") ? "⚠" : "…");

  return (
    <div style={card} data-testid="ocr-panel">
      <div style={label}>Read from a picture (trial)</div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", color: T.text, fontSize: 13 }}>
        <input data-testid="ocr-toggle" type="checkbox" checked={on} onChange={e => { setOn(e.target.checked); if (!e.target.checked) close(); }} />
        Let Arth read a screenshot of the Amazon Order Summary
      </label>
      {on && phase.name === "idle" && (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: T.sub, fontSize: 12, marginBottom: 8 }}>The picture is read on this phone: nothing is uploaded and nothing is saved. The first reading loads about 6 MB of reading files from Arth itself. You check every figure before it counts.</div>
          <label style={{ ...btn(false), display: "block", textAlign: "center", cursor: "pointer", color: T.accent, borderStyle: "dashed", borderColor: T.accent }}>
            Choose a screenshot
            <input data-testid="ocr-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile} style={{ display: "none" }} />
          </label>
        </div>
      )}
      {on && phase.name === "reading" && <div data-testid="ocr-reading" style={{ color: T.sub, fontSize: 13, marginTop: 10 }}>Reading the picture on this phone…</div>}
      {on && phase.name === "declined" && (
        <div data-testid="ocr-declined" style={{ marginTop: 10, fontSize: 12, color: "#f0a500" }}>{phase.message}
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button data-testid="ocr-try-again" onClick={close} style={btn(false)}>Try another picture</button>
            <button data-testid="ocr-manual" onClick={() => { close(); onManual && onManual(); }} style={btn(false)}>Enter the figures myself</button>
          </div>
        </div>
      )}
      {on && phase.name === "review" && (
        <div data-testid="ocr-review" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 6 }}>Order summary — read from a picture, please check</div>
          {FIGURE_KEYS.map(k => (
            <div key={k} style={{ marginBottom: 8 }}>
              <div style={{ color: T.sub, fontSize: 11, fontWeight: 700 }}>{FIGURE_LABEL[k]}{k === "discount" ? " (subtracted)" : ""} <span data-testid={`ocr-tick-${k}`}>{tick(k)}</span></div>
              <input data-testid={`ocr-${k}`} inputMode="decimal" autoComplete="off" value={vals[k] ?? ""} onChange={e => setVals({ ...vals, [k]: e.target.value })} style={input} placeholder="not read" />
              {bad(k) && <div style={{ color: "#f0a500", fontSize: 11 }}>Enter a plain amount like 329.00</div>}
            </div>
          ))}
          {eqRow("ocr-e1", "Subtotal + shipping + fee = Total", eqs.e1)}
          {eqRow("ocr-e2", "Total − discount = Grand Total", eqs.e2)}
          {suggestion && (
            <div data-testid="ocr-suggestion" style={{ fontSize: 12, color: T.sub, padding: "4px 0" }}>
              Did you mean {FIGURE_LABEL[suggestion.figure]} {inr(suggestion.valuePaise, sym)}? The figures would add up.
              <button data-testid="ocr-apply-suggestion" onClick={() => setVals({ ...vals, [suggestion.figure]: asText(suggestion.valuePaise) })} style={{ ...btn(false), marginLeft: 8, minHeight: 36, padding: "4px 10px" }}>Use it</button>
            </div>
          )}
          {extra.unrecognised.length > 0 && <div data-testid="ocr-unrecognised" style={{ fontSize: 12, color: "#f0a500", padding: "4px 0" }}>The picture has a row Arth does not recognise ({extra.unrecognised.map(u => inr(u.amountPaise, sym)).join(", ")}). Arth cannot accept this reading. Enter the figures yourself instead.</div>}
          {extra.conflicts.length > 0 && <div data-testid="ocr-conflicts" style={{ fontSize: 12, color: "#f0a500", padding: "4px 0" }}>The picture shows two different amounts for the same row. Arth cannot accept this reading. Enter the figures yourself instead.</div>}
          <div style={{ marginTop: 8 }}>
            <div style={{ color: T.sub, fontSize: 11, fontWeight: 700 }}>Order number (read from the picture; check it)</div>
            <input data-testid="ocr-ordernumber" value={orderNo} onChange={e => setOrderNo(e.target.value)} style={input} placeholder="405-1234567-1234567" />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button data-testid="ocr-ack" disabled={!canAck} onClick={submit} style={btn(true, !canAck)}>These figures are right</button>
            <button data-testid="ocr-manual" onClick={() => { close(); onManual && onManual(); }} style={btn(false)}>Enter the figures myself</button>
            <button data-testid="ocr-cancel" onClick={close} style={btn(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
