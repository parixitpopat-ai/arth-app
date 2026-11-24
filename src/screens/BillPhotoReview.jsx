// A UTILITY BILL read from a PHOTO. The photo is read on this device only and is not kept; the name and address printed on it are never read out.
// What was read appears in an editable panel marked "read from a photo, please check". Nothing is saved here: "These figures are right" fills the
// Add bill form (the person still picks the split, category and saves). A bill already added for the same connection and bill date is flagged, not added twice.
import { useState } from "react";

const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
const money = n => (Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "");

export default function BillPhotoReview({ T, sym = "₹", billerAccounts = [], bills = [], onUse }) {
  const [phase, setPhase] = useState({ name: "idle" });                   // idle | reading | review | declined
  const [f, setF] = useState({});                                          // every field as text
  const [words, setWords] = useState(null);
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const input = { width: "100%", boxSizing: "border-box", padding: 8, minHeight: 40, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13 };
  const btn = (primary, disabled) => ({ minHeight: 44, padding: "10px 14px", borderRadius: 12, border: primary ? "0" : `1px solid ${T.border}`, background: primary ? T.accent : "none", color: primary ? (T.accentInk || "#fff") : T.text, fontWeight: 700, fontSize: 13, opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" });
  const lbl = { color: T.sub, fontSize: 11, fontWeight: 700, margin: "8px 0 3px", display: "block" };

  const cleanId = s => String(s || "").replace(/\D/g, "");
  const connection = cleanId(f.consumerId) ? billerAccounts.find(b => cleanId(b.consumerNo) === cleanId(f.consumerId)) : null;
  const amount = Number(String(f.amount || "").replace(/,/g, ""));
  const duplicate = connection && validDate(f.billDate) ? bills.find(b => b.billerAccountId === connection.id && b.status !== "cancelled" && String(b.billDate || "").slice(0, 10) === f.billDate) : null;
  const wordsDiffer = words != null && Number.isFinite(amount) && amount !== words;
  const readingsOk = f.current === "" || f.previous === "" || f.units === "" ? null : Number(f.current) - Number(f.previous) === Number(f.units);
  const dueOk = validDate(f.billDate) && validDate(f.dueDate) ? f.dueDate >= f.billDate : null;
  const canUse = amount > 0 && validDate(f.billDate) && validDate(f.dueDate) && dueOk !== false && !wordsDiffer && !duplicate;

  const chooseFile = async e => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    setPhase({ name: "reading" });
    const [{ readBillFromImage }, { DECLINE_MESSAGE }] = await Promise.all([import("../domain/invoices/ocr/ocrBill.js"), import("../domain/invoices/ocr/ocrSummary.js")]);
    const r = await readBillFromImage(file, { baseUrl: new URL("./", document.baseURI).href });
    if (!r.ok) { setPhase({ name: "declined", detail: r.detail || "", reason: r.reason, message: r.reason === "engine" ? "The photo could not be read on this phone. Add the bill by hand instead." : r.reason === "shrink" ? "This photo is too big to open on this phone. Try a smaller photo, or add the bill by hand." : DECLINE_MESSAGE[r.reason] }); return; }
    if (!r.found) { setPhase({ name: "declined", message: "No bill details were found in this photo. Try a flat, well-lit photo of the whole bill, or add it by hand." }); return; }
    setWords(r.amountInWords);
    setF({ consumerId: r.consumerId || "", billDate: r.billDate || "", dueDate: r.dueDate || "", amount: r.amount != null ? String(r.amount) : "", billNo: r.billNo || "",
      periodFrom: r.periodFrom || "", periodTo: r.periodTo || "", current: r.currentReading != null ? String(r.currentReading) : "", previous: r.previousReading != null ? String(r.previousReading) : "", units: r.units != null ? String(r.units) : "" });
    setPhase({ name: "review" });
  };
  const close = () => { setPhase({ name: "idle" }); setF({}); setWords(null); };
  const use = () => {
    if (!canUse) return;
    onUse({ consumerId: cleanId(f.consumerId), billDate: f.billDate, dueDate: f.dueDate, amount: String(amount), billNo: f.billNo.trim(),
      periodFrom: validDate(f.periodFrom) ? f.periodFrom : "", periodTo: validDate(f.periodTo) ? f.periodTo : "",
      currentReading: f.current, previousReading: f.previous, units: f.units, connection });
    close();
  };
  const row = (id, ok, text, detail) => (
    <div data-testid={id} data-status={ok === null ? "unknown" : ok ? "holds" : "fails"} style={{ fontSize: 12, color: ok === false ? T.warn : T.text, padding: "3px 0" }}>
      {ok === null ? "… " : ok ? "✔ " : "⚠ "}{text}{ok === false && detail ? ` — ${detail}` : ""}
    </div>
  );
  const field = (k, label, extra = {}) => (<><span style={lbl}>{label}</span><input data-testid={`billphoto-${k}`} style={input} value={f[k] ?? ""} onChange={e => set(k, e.target.value)} {...extra} /></>);

  if (phase.name === "idle" || phase.name === "declined") {
    return (
      <div data-testid="billphoto-panel" style={{ background: T.input, borderRadius: 12, padding: 12 }}>
        <label style={{ display: "block", color: T.text, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
          📷 Read from a bill photo
          <input data-testid="billphoto-file" type="file" accept="image/*" onChange={chooseFile} style={{ display: "block", marginTop: 8, maxWidth: "100%", fontSize: 12 }} />
        </label>
        <div style={{ color: T.sub, fontSize: 11, marginTop: 6 }}>Read on this phone only. The photo is not kept, and the name and address on the bill are not read out.</div>
        {phase.name === "declined" && <div data-testid="billphoto-declined" style={{ color: T.warn, fontSize: 12, marginTop: 8 }}>{phase.message}{phase.reason ? <span style={{ display: "block", color: T.sub, fontSize: 10, marginTop: 4 }}>Reason: {phase.reason}{phase.detail ? ` (${phase.detail})` : ""}</span> : null}</div>}
      </div>
    );
  }
  if (phase.name === "reading") return <div data-testid="billphoto-panel" style={{ background: T.input, borderRadius: 12, padding: 12, color: T.sub, fontSize: 13 }}>Reading the photo…</div>;

  return (
    <div data-testid="billphoto-panel" style={{ background: T.input, borderRadius: 12, padding: 12 }}>
      <div style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>Read from a photo, please check</div>
      <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>Fix anything that is wrong. Nothing is saved until you finish the bill.</div>
      {field("consumerId", "Consumer ID")}
      {connection
        ? <div data-testid="billphoto-connection" style={{ color: T.accent, fontSize: 12, fontWeight: 700, marginTop: 4 }}>✔ Matches your connection: {connection.name}</div>
        : <div data-testid="billphoto-connection" style={{ color: T.sub, fontSize: 11, marginTop: 4 }}>No connection of yours has this consumer ID yet. You can pick one, or add the bill without one.</div>}
      {field("billDate", "Bill date (YYYY-MM-DD)")}
      {field("dueDate", "Due date (YYYY-MM-DD)")}
      {field("amount", `Amount payable (${sym})`, { inputMode: "decimal" })}
      {field("billNo", "Bill number")}
      {field("periodFrom", "Bill period from (YYYY-MM-DD, optional)")}
      {field("periodTo", "Bill period to (YYYY-MM-DD, optional)")}
      {field("previous", "Previous meter reading", { inputMode: "decimal" })}
      {field("current", "Current meter reading", { inputMode: "decimal" })}
      {field("units", "Units used", { inputMode: "decimal" })}
      <div style={{ marginTop: 10 }}>
        {row("billphoto-check-words", words == null ? null : !wordsDiffer, words == null ? "The amount in words could not be read, so it is not cross-checked" : `Amount matches the amount in words (${sym}${money(words)})`, `the bill's words say ${sym}${money(words)}, the amount above says ${sym}${money(amount)}`)}
        {row("billphoto-check-due", dueOk, "Due date is on or after the bill date", "check the two dates")}
        {row("billphoto-check-readings", readingsOk, "Current − previous reading equals the units used", "the three numbers do not agree; check them")}
        {duplicate && <div data-testid="billphoto-duplicate" style={{ color: T.warn, fontSize: 12, padding: "3px 0" }}>⚠ Already added: {duplicate.name || "a bill"} dated {duplicate.billDate}. Change the bill date only if this is a different bill.</div>}
      </div>
      {wordsDiffer && (
        <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <button data-testid="billphoto-use-words" onClick={() => set("amount", String(words))} style={btn(false)}>Use {sym}{money(words)} (the words)</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button data-testid="billphoto-use" disabled={!canUse} onClick={use} style={btn(true, !canUse)}>These figures are right</button>
        <button data-testid="billphoto-cancel" onClick={close} style={btn(false)}>Cancel</button>
      </div>
    </div>
  );
}
