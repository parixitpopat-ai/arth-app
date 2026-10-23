// Add / edit / delete one refuelling (odometer capture). Validation is the domain's (fuelFills.validateFill); this only collects input
// and shows the messages. Nothing is saved until Save; a fill never creates or changes an expense.
import React, { useState } from "react";
import { RADIUS, TOUCH, TYPE_SCALE } from "../constants/theme";
import { validateFill, normalizeFill, localIsoDate, fillsForVehicle } from "../domain/vehicles/fuelFills";

export default function FuelFillSheet({ T, vehicle, fills, existing = null, sym = "₹", onSave, onDelete, onClose }) {
  const last = fillsForVehicle(fills, vehicle.id).slice(-1)[0];
  const [date, setDate] = useState(existing?.date || localIsoDate());
  const [odometer, setOdometer] = useState(existing ? String(existing.odometer) : "");
  const [litres, setLitres] = useState(existing ? String(existing.litres) : "");
  const [amount, setAmount] = useState(existing && existing.amount != null ? String(existing.amount) : "");
  const [full, setFull] = useState(existing ? existing.full !== false : true);
  const [note, setNote] = useState(existing?.note || "");
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const candidate = normalizeFill({ id: existing?.id, vehicleId: vehicle.id, date, odometer, litres, amount, full, note });
  const v = validateFill(fills, candidate);
  const err = k => (tried ? v.errors[k] : undefined);
  const inp = { width: "100%", boxSizing: "border-box", minHeight: TOUCH.min, background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, color: T.text, fontSize: 16, padding: "0 12px", fontFamily: "inherit" };
  const lbl = { ...TYPE_SCALE.label, color: T.sub, marginBottom: 4, display: "block" };
  const errLine = k => (err(k) ? <div data-testid={`fill-error-${k}`} style={{ color: T.danger, fontSize: 12, fontWeight: 700, marginTop: 4 }}>{err(k)}</div> : null);
  const save = () => { setTried(true); if (v.ok) onSave({ ...candidate, id: existing?.id }); };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 360, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div data-testid="fuel-fill-sheet" onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "22px 22px 0 0", padding: "20px 18px 36px", width: "100%", maxWidth: 430, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ ...TYPE_SCALE.cardTitle, color: T.text }}>{existing ? "Edit refuel" : "Add refuel"} · {vehicle.name || vehicle.number}</span>
        <div><label style={lbl}>Date</label><input data-testid="fill-date" type="date" value={date} max={localIsoDate()} onChange={e => setDate(e.target.value)} style={inp} />{errLine("date")}</div>
        <div>
          <label style={lbl}>Odometer (km){last ? ` · last ${last.odometer} km` : ""}</label>
          <input data-testid="fill-odometer" inputMode="numeric" placeholder="e.g. 24850" value={odometer} onChange={e => setOdometer(e.target.value)} style={inp} />{errLine("odometer")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lbl}>Litres</label><input data-testid="fill-litres" inputMode="decimal" placeholder="0.0" value={litres} onChange={e => setLitres(e.target.value)} style={inp} />{errLine("litres")}</div>
          <div><label style={lbl}>Amount paid ({sym})</label><input data-testid="fill-amount" inputMode="decimal" placeholder="optional" value={amount} onChange={e => setAmount(e.target.value)} style={inp} />{errLine("amount")}</div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: TOUCH.min, color: T.text, fontSize: 15, cursor: "pointer" }}>
          <input data-testid="fill-full" type="checkbox" checked={full} onChange={e => setFull(e.target.checked)} style={{ width: 22, height: 22 }} />
          <span>Filled the tank to full<span style={{ display: "block", color: T.sub, fontSize: 12 }}>Untick for a top-up. Mileage is worked out between full tanks.</span></span>
        </label>
        <div><label style={lbl}>Note (optional)</label><input data-testid="fill-note" value={note} maxLength={200} onChange={e => setNote(e.target.value)} style={inp} /></div>
        {tried && v.warnings.map((w, i) => <div key={i} data-testid="fill-warning" style={{ color: T.warn, fontSize: 13, fontWeight: 700 }}>⚠️ {w}</div>)}
        <div style={{ color: T.subDim, fontSize: 12, lineHeight: 1.4 }}>This records the refuel only. It does not add an expense; the fuel payment stays in your transactions.</div>
        <div data-testid="fill-save" onClick={save} style={{ minHeight: TOUCH.min, borderRadius: RADIUS.md, background: T.accent, color: T.accentInk, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>Save refuel</div>
        {existing && !confirmDelete && <div data-testid="fill-delete" onClick={() => setConfirmDelete(true)} style={{ color: T.danger, fontSize: 14, textAlign: "center", cursor: "pointer", padding: 8 }}>Delete this refuel</div>}
        {existing && confirmDelete && (
          <div style={{ border: `1px solid ${T.danger}`, borderRadius: RADIUS.md, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ color: T.text, fontSize: 14 }}>Delete this refuel? The mileage figures around it will be recalculated. Your fuel expense is not affected.</span>
            <div data-testid="fill-delete-confirm" onClick={() => onDelete(existing.id)} style={{ minHeight: TOUCH.min, borderRadius: RADIUS.md, background: T.danger, color: "#fff", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>Yes, delete</div>
            <div onClick={() => setConfirmDelete(false)} style={{ color: T.sub, textAlign: "center", cursor: "pointer", padding: 6 }}>Keep it</div>
          </div>
        )}
      </div>
    </div>
  );
}
