import React, { useState } from "react";
import BottomSheet from "../BottomSheet";
import { SheetHeader } from "./peopleUi";
import { fieldStyles } from "./peopleStyles";
import { searchProviderAccounts } from "../../domain/billers/accountLabel";

// Arth 2.0 IA §6 — "+ Add relationship" no longer only creates a new Provider/Biller: it first
// offers every Provider you already have, so the same "Genesis" never gets a second row just
// because it wasn't attributed here yet. Picking one creates (or reuses, if already active here)
// a Financial Relationship to this Provider — one Provider can have several at once (§5's 1:N
// model). "+ Create new provider" falls through to the existing biller-account form unchanged.
//
// `currentLabel(ba)` returns the Provider's PRIMARY owner as display text ("Unassigned", a
// person's name, or a group's name) — the legacy attributeType/attributedTo bridge new Bills
// still read (billFor.js's compatibility rule), not the only relationship a Provider can have.
export default function AddRelationshipSheet({ T, billerAccounts, billers, targetLabel, currentLabel, onClose, onSelectExisting, onCreateNew }) {
  const s = fieldStyles(T);
  const [q, setQ] = useState("");
  // WP1 (Arth IA §2/§3) — search by Provider name, nickname, or full/partial account number; the
  // Provider name leads each row (not the nickname alone, which used to read as the whole
  // identity — the exact "Parixit"/"Me" duplicate-account confusion).
  const matches = searchProviderAccounts(billerAccounts, billers, q)
    .sort((a, b) => a.providerName.localeCompare(b.providerName, "en", { sensitivity: "base" }));

  return (
    <BottomSheet T={T} onClose={onClose}>
      <SheetHeader T={T} title="Add relationship" onCancel={onClose} />
      <div style={{ color: T.sub, fontSize: 12, marginBottom: 10 }}>Attach an existing Provider to {targetLabel}, or create a new one.</div>
      <input data-testid="relationship-search" style={s.input} placeholder="Search Provider, nickname or account number" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ marginTop: 10, maxHeight: "50vh", overflowY: "auto" }}>
        {matches.map(({ billerAccount: ba, providerName, accountLine }) => (
          <button
            key={ba.id}
            data-testid={`relationship-existing-${ba.id}`}
            onClick={() => onSelectExisting(ba)}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "10px 0", cursor: "pointer", textAlign: "left" }}
          >
            <span style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{providerName}</span>
            <span style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>{accountLine}</span>
            <span style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>Primary: {currentLabel(ba)}</span>
          </button>
        ))}
        {!matches.length ? <div style={{ ...s.hint, padding: "10px 0" }}>{q.trim() ? "No matching Provider or account." : "No Providers yet."}</div> : null}
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
