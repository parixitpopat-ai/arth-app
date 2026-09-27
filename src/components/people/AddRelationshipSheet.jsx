import React, { useState } from "react";
import BottomSheet from "../BottomSheet";
import { SheetHeader } from "./peopleUi";
import { fieldStyles } from "./peopleStyles";

// Arth 2.0 IA §6 — "+ Add relationship" no longer only creates a new Provider/Biller: it first
// offers every Provider you already have, so the same "Genesis" never gets a second row just
// because it wasn't attributed here yet. Picking one reassigns its existing "Attributed To" (D-1,
// today's one-owner-per-Provider model — locked as the scope for this pass); picking "+ Create
// new provider" falls through to the existing biller-account form unchanged.
//
// `currentLabel(ba)` returns the Provider's current owner as display text ("Unassigned", a
// person's name, or a group's name) so reassigning is never a surprise.
export default function AddRelationshipSheet({ T, billerAccounts, targetLabel, currentLabel, onClose, onSelectExisting, onCreateNew }) {
  const s = fieldStyles(T);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const matches = (billerAccounts || []).filter(ba =>
    !query
    || String(ba.name || "").toLowerCase().includes(query)
    || String(ba.type || "").toLowerCase().includes(query)
    || String(ba.provider || "").toLowerCase().includes(query)
  ).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base" }));

  return (
    <BottomSheet T={T} onClose={onClose}>
      <SheetHeader T={T} title="Add relationship" onCancel={onClose} />
      <div style={{ color: T.sub, fontSize: 12, marginBottom: 10 }}>Attach an existing biller to {targetLabel}, or create a new one.</div>
      <input data-testid="relationship-search" style={s.input} placeholder="Search your billers" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ marginTop: 10, maxHeight: "50vh", overflowY: "auto" }}>
        {matches.map(ba => (
          <button
            key={ba.id}
            data-testid={`relationship-existing-${ba.id}`}
            onClick={() => onSelectExisting(ba)}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "10px 0", cursor: "pointer", textAlign: "left" }}
          >
            <span style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{ba.name}</span>
            <span style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>{[ba.type, ba.provider].filter(Boolean).join(" · ")}</span>
            <span style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>Currently: {currentLabel(ba)}</span>
          </button>
        ))}
        {!matches.length ? <div style={{ ...s.hint, padding: "10px 0" }}>{query ? "No matching biller." : "No billers yet."}</div> : null}
      </div>
      <button
        data-testid="relationship-create-new"
        onClick={onCreateNew}
        style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", background: "none", border: "none", padding: "12px 0 4px", marginTop: 4, cursor: "pointer", textAlign: "left", borderTop: `1px solid ${T.border}` }}
      >
        <span style={{ color: T.accent, fontSize: 14, fontWeight: 700 }}>+ Create new provider</span>
        <span style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>For a biller you haven't added yet.</span>
      </button>
    </BottomSheet>
  );
}
