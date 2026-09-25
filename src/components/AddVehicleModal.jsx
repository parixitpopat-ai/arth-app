import React, { useState } from "react";
import BottomSheet from "./BottomSheet";
import { PALETTE, RADIUS, TOUCH, FONT } from "../constants/theme";
import { genId } from "../helpers/idGenerator";

// Reusable Add/Edit Vehicle flow (Vehicle Experience brief, section 3). Used from both
// Settings → Manage → Vehicles and Transaction → Link to → Vehicle → New Vehicle — one
// component, one persistence path (`setVehicles`), so there is never a second Vehicle-creation
// flow living inside the transaction form.
//
// Minimal creation rule (brief section 2 / design ADR-021): a vehicle is valid with Type +
// Registration. Every other field here — name, colour, make, model, year, odometer, purchase
// value/date — is optional and does not block Save. Nothing here creates an InsurancePolicy,
// Bill, Loan or reminder; those are explicit next steps offered elsewhere (the vehicle profile),
// never silently from this modal.
//
// Preserves the existing Vehicle shape exactly ({id, type, number, name, color}) and only adds
// new fields alongside it (make, model, year, odometer, purchaseValue, purchaseDate, archived) —
// no second Vehicle representation.
const VEHICLE_TYPES = [
  { id: "car", label: "Car", icon: "🚗" },
  { id: "bike", label: "Bike", icon: "🏍️" },
  { id: "truck", label: "Truck", icon: "🚛" },
  { id: "auto", label: "Auto", icon: "🛺" },
  { id: "other", label: "Other", icon: "🚘" },
];

export default function AddVehicleModal({ existing = null, vehicles = [], setVehicles, onClose, onCreated, linkedTxnCount = 0, T }) {
  const isEdit = Boolean(existing);
  const [type, setType] = useState(existing?.type || "car");
  const [number, setNumber] = useState(existing?.number || "");
  const [name, setName] = useState(existing?.name || "");
  const [color, setColor] = useState(existing?.color || PALETTE[2]);
  const [make, setMake] = useState(existing?.make || "");
  const [model, setModel] = useState(existing?.model || "");
  const [year, setYear] = useState(existing?.year != null ? String(existing.year) : "");
  const [odometer, setOdometer] = useState(existing?.odometer != null ? String(existing.odometer) : "");
  const [purchaseValue, setPurchaseValue] = useState(existing?.purchaseValue != null ? String(existing.purchaseValue) : "");
  const [purchaseDate, setPurchaseDate] = useState(existing?.purchaseDate || "");
  const [showEnrichment, setShowEnrichment] = useState(isEdit && (existing?.make || existing?.model || existing?.year || existing?.odometer || existing?.purchaseValue));

  const lbl = { color: T.sub, fontSize: 13 };
  const inp = { minHeight: TOUCH.min, background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: "0 12px", color: T.text, fontSize: 15, width: "100%", boxSizing: "border-box", fontFamily: FONT.sans };

  const normalizedNumber = number.trim().toUpperCase();
  const canSave = normalizedNumber.length > 0;
  const duplicate = canSave && vehicles.some(v => v.id !== existing?.id && (v.number || "").trim().toUpperCase() === normalizedNumber);

  const save = () => {
    if (!canSave) return;
    const record = {
      id: existing?.id || genId(),
      type, number: normalizedNumber,
      name: name.trim(), color,
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      year: year.trim() ? Number(year) : undefined,
      odometer: odometer.trim() ? Number(odometer) : undefined,
      purchaseValue: purchaseValue.trim() ? Number(purchaseValue) : undefined,
      purchaseDate: purchaseDate || undefined,
      archived: existing?.archived || false,
    };
    if (isEdit) setVehicles(prev => prev.map(v => (v.id === record.id ? { ...v, ...record } : v)));
    else setVehicles(prev => [...prev, record]);
    onCreated?.(record);
    onClose();
  };

  const archive = () => {
    if (!existing) return;
    if (!window.confirm(`Archive ${existing.name || existing.number}? It leaves the vehicle list and the "Link to" picker — every transaction linked to it keeps its vehicleId and still shows it.`)) return;
    setVehicles(prev => prev.map(v => (v.id === existing.id ? { ...v, archived: true } : v)));
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="92vh">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.sub, fontSize: 15, cursor: "pointer", fontFamily: FONT.sans }}>Cancel</button>
        <span style={{ color: T.text, fontSize: 15, fontWeight: 600 }}>{isEdit ? "Edit vehicle" : "Add vehicle"}</span>
        <button onClick={save} disabled={!canSave} style={{ background: "none", border: "none", color: canSave ? T.accent : T.subDim, fontSize: 15, fontWeight: 600, cursor: canSave ? "pointer" : "default", fontFamily: FONT.sans }}>{isEdit ? "Save" : "Save vehicle"}</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={lbl}>Type</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, background: T.input, border: `1px solid ${T.borderStrong}`, borderRadius: RADIUS.md, padding: 3 }}>
            {VEHICLE_TYPES.map(vt => (
              <button key={vt.id} onClick={() => setType(vt.id)} style={{ minHeight: 42, borderRadius: RADIUS.sm, border: "none", background: type === vt.id ? T.accent : "transparent", color: type === vt.id ? T.accentInk : T.sub, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT.sans }}>
                <div>{vt.icon}</div>
                <div>{vt.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={lbl}>Registration number</span>
          <input style={inp} placeholder="e.g. KA 05 MX 4412" value={number} onChange={e => setNumber(e.target.value)} onBlur={() => setNumber(n => n.trim().toUpperCase())} />
          {duplicate && <span style={{ color: T.warn, fontSize: 12 }}>Another vehicle already has this registration. You can still save.</span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={lbl}>Name <span style={{ color: T.subDim }}>· optional</span></span>
          <input style={inp} placeholder={normalizedNumber || "e.g. Maruti Swift"} value={name} onChange={e => setName(e.target.value)} />
          {!name.trim() && <span style={{ color: T.subDim, fontSize: 12 }}>If left empty, the registration is used as the name.</span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={lbl}>Colour</span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {PALETTE.slice(0, 8).map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: 999, background: c, border: "none", cursor: "pointer", boxShadow: color === c ? `0 0 0 2px ${T.bg}, 0 0 0 4px ${T.text}` : "none" }} />
            ))}
          </div>
        </div>

        {!showEnrichment && (
          <button onClick={() => setShowEnrichment(true)} style={{ background: "none", border: `1px dashed ${T.borderStrong}`, borderRadius: RADIUS.lg, padding: "12px 14px", color: T.accent, fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", fontFamily: FONT.sans }}>+ Make, model, year, odometer, purchase details</button>
        )}

        {showEnrichment && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, border: `1px dashed ${T.warn}`, borderRadius: RADIUS.lg, padding: 12 }}>
              <span style={{ color: T.sub, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Make and model · optional</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input style={inp} placeholder="Make" value={make} onChange={e => setMake(e.target.value)} />
                <input style={inp} placeholder="Model" value={model} onChange={e => setModel(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input style={inp} type="number" placeholder="Year" value={year} onChange={e => setYear(e.target.value)} />
                <input style={inp} type="number" placeholder="Odometer, km" value={odometer} onChange={e => setOdometer(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, border: `1px dashed ${T.warn}`, borderRadius: RADIUS.lg, padding: 12 }}>
              <span style={{ color: T.sub, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Purchase · optional</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input style={inp} type="number" inputMode="decimal" placeholder="₹ Value" value={purchaseValue} onChange={e => setPurchaseValue(e.target.value)} />
                <input style={inp} type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
              </div>
              <span style={{ color: T.subDim, fontSize: 12, lineHeight: 1.45 }}>Used only for total cost of ownership. Arth never estimates depreciation or resale value.</span>
            </div>
          </>
        )}

        {!isEdit && <div style={{ color: T.subDim, fontSize: 13, lineHeight: 1.5 }}>Insurance, documents and reminders can be added after saving, from the vehicle's own profile.</div>}

        {isEdit && (
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            <button onClick={archive} style={{ minHeight: TOUCH.min, background: "none", border: "none", color: T.warn, fontSize: 15, fontWeight: 600, textAlign: "left", cursor: "pointer", fontFamily: FONT.sans, padding: 0 }}>Archive vehicle</button>
            <span style={{ color: T.subDim, fontSize: 12, lineHeight: 1.45 }}>Archived vehicles leave the picker and the vehicle list. Linked transactions keep their vehicleId and still show it.</span>
            {linkedTxnCount > 0 && <span style={{ color: T.subDim, fontSize: 12 }}>Delete isn't offered while {linkedTxnCount} transaction{linkedTxnCount === 1 ? "" : "s"} still reference this vehicle — archive instead.</span>}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
