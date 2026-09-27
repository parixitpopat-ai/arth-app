import React, { useState } from "react";
import BottomSheet from "../BottomSheet";
import { SheetHeader } from "./peopleUi";
import { fieldStyles } from "./peopleStyles";

// Fixes the exact live-reported "Parixit"/"Me" duplicate: two Biller Accounts, same real
// Provider, created separately, each with its own Financial Relationship and payment history.
// Picks another account to retire into `survivor` (kept); domain/billers/merge.js does the
// actual re-pointing. Same-type accounts are listed first since that's the overwhelmingly
// likely match, but any account can be picked — a duplicate isn't always same-typed if it was
// mis-categorized the first time.
export default function MergeBillerAccountSheet({ T, survivor, billerAccounts, ownerLabel, onClose, onConfirm }) {
  const s = fieldStyles(T);
  const [q, setQ] = useState("");
  const [pickedId, setPickedId] = useState(null);
  const query = q.trim().toLowerCase();

  const candidates = (billerAccounts || [])
    .filter(ba => ba.id !== survivor.id)
    .filter(ba => !query || String(ba.name || "").toLowerCase().includes(query) || String(ba.type || "").toLowerCase().includes(query))
    .sort((a, b) => {
      const aSame = a.type === survivor.type ? 0 : 1;
      const bSame = b.type === survivor.type ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
      return String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base" });
    });

  const picked = pickedId ? (billerAccounts || []).find(ba => ba.id === pickedId) : null;

  if (picked) {
    return (
      <BottomSheet T={T} onClose={onClose}>
        <SheetHeader T={T} title="Confirm merge" onCancel={() => setPickedId(null)} />
        <div style={{ color: T.text, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          <strong>{picked.name}</strong> will be merged into <strong>{survivor.name}</strong> and removed.
          {survivor.name}'s relationships, membership history, bills and transactions are kept;
          {" "}{picked.name}'s are moved over. This can't be undone.
        </div>
        <button
          onClick={() => onConfirm(picked)}
          style={{ width: "100%", background: T.danger, border: "none", borderRadius: 14, padding: 13, cursor: "pointer", fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: "Nunito,sans-serif" }}
        >
          Merge "{picked.name}" into "{survivor.name}"
        </button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet T={T} onClose={onClose}>
      <SheetHeader T={T} title="Merge duplicate account" onCancel={onClose} />
      <div style={{ color: T.sub, fontSize: 12, marginBottom: 10 }}>Pick the other account to merge into {survivor.name} ({ownerLabel}). Same-type accounts are listed first.</div>
      <input style={s.input} placeholder="Search your accounts" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ marginTop: 10, maxHeight: "50vh", overflowY: "auto" }}>
        {candidates.map(ba => (
          <button key={ba.id} data-testid={`merge-candidate-${ba.id}`} onClick={() => setPickedId(ba.id)}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "10px 0", cursor: "pointer", textAlign: "left" }}>
            <span style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{ba.name}</span>
            <span style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>{ba.type}{ba.type !== survivor.type ? " · different type" : ""}</span>
          </button>
        ))}
        {!candidates.length ? <div style={{ ...s.hint, padding: "10px 0" }}>{query ? "No matching account." : "No other accounts to merge."}</div> : null}
      </div>
    </BottomSheet>
  );
}
