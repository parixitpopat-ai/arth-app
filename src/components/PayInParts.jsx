// One purchase paid in parts (₹500 = ₹100 + ₹400). Controlled by the form: `lines` is [{accId, amount}], `onChange` gets the new array.
// Nothing here saves anything; the form checks the lines with payPartsStatus and stores them as paymentLines.
import { payPartsStatus } from "../domain/payments/payInParts";

export default function PayInParts({ lines, onChange, total, accounts, sym, fmt, T, inp, lbl }) {
  const st = payPartsStatus(lines, total);
  const set = (i, patch) => onChange(lines.map((l, k) => k === i ? { ...l, ...patch } : l));
  const clean = v => String(v).replace(/[^0-9.]/g, "");
  const left = Number(st.left) || 0;
  return (
    <div data-testid="pay-parts" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={lbl}>Paid in parts</span>
      {lines.map((l, i) => (
        <div key={i} data-testid="pay-part" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select data-testid="pay-part-acc" aria-label={`Payment ${i + 1} account`} style={{ ...inp, flex: 1.4, minWidth: 0 }} value={l.accId} onChange={e => set(i, { accId: e.target.value })}>
            <option value="">Choose account</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input data-testid="pay-part-amt" aria-label={`Payment ${i + 1} amount`} style={{ ...inp, flex: 1, minWidth: 0, textAlign: "right" }} type="text" inputMode="decimal" placeholder={left > 0 ? `${sym}${fmt(left)}` : "Amount"} value={l.amount} onChange={e => set(i, { amount: clean(e.target.value) })} />
          {lines.length > 2 && <button type="button" data-testid="pay-part-remove" aria-label={`Remove payment ${i + 1}`} onClick={() => onChange(lines.filter((_, k) => k !== i))} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 16, padding: 4 }}>✕</button>}
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <button type="button" data-testid="pay-part-add" onClick={() => onChange([...lines, { accId: "", amount: "" }])} style={{ background: "none", border: "none", color: T.accent, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0, fontFamily: "Inter,sans-serif" }}>+ Add another payment</button>
        {left > 0.004 && lines.length > 0 && <button type="button" data-testid="pay-part-rest" onClick={() => { const i = lines.findIndex(l => !(parseFloat(l.amount) > 0)); if (i >= 0) set(i, { amount: String(left) }); }} style={{ background: "none", border: "none", color: T.accent, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0, fontFamily: "Inter,sans-serif" }}>Put the rest ({sym}{fmt(left)}) on an empty line</button>}
      </div>
      <div data-testid="pay-parts-status" style={{ fontSize: 12, color: st.ok ? T.success : T.sub }}>
        {st.ok ? `✓ ${sym}${fmt(st.placed)} placed, matches the amount.` : Math.abs(left) < 0.005 && Number(total) > 0 ? "" : left > 0 ? `${sym}${fmt(left)} still to place of ${sym}${fmt(total)}.` : `${sym}${fmt(-left)} more than the amount.`}
      </div>
    </div>
  );
}
