import React, { useState } from "react";
import BottomSheet from "../BottomSheet";
import { SheetHeader } from "./peopleUi";
import { fieldStyles } from "./peopleStyles";
import { searchProviderAccounts, getProviderAccountLabel } from "../../domain/billers/accountLabel";

// Fixes the exact live-reported "Parixit"/"Me" duplicate: two Biller Accounts, same real
// Provider, created separately, each with its own Financial Relationship and payment history.
// Picks another account to retire into `survivor` (kept); domain/billers/merge.js does the
// actual re-pointing. Same-type accounts are listed first since that's the overwhelmingly
// likely match, but any account can be picked — a duplicate isn't always same-typed if it was
// mis-categorized the first time.
export default function MergeBillerAccountSheet({ T, survivor, billerAccounts, billers, ownerLabel, onClose, onConfirm }) {
  const s = fieldStyles(T);
  const [q, setQ] = useState("");
  const [pickedId, setPickedId] = useState(null);

  // WP1 (Arth IA §2/§3) — search by Provider name, nickname, or full/partial account number.
  // Same-type accounts still sort first (the overwhelmingly likely match), but any account is
  // findable, and a matching account number all but confirms it's the same real Provider.
  const candidates = searchProviderAccounts((billerAccounts || []).filter(ba => ba.id !== survivor.id), billers, q)
    .sort((a, b) => {
      const aSame = a.billerAccount.type === survivor.type ? 0 : 1;
      const bSame = b.billerAccount.type === survivor.type ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
      return a.providerName.localeCompare(b.providerName, "en", { sensitivity: "base" });
    });

  const picked = pickedId ? (billerAccounts || []).find(ba => ba.id === pickedId) : null;

  if (picked) {
    const pickedLabel = getProviderAccountLabel(picked, billers);
    const survivorLabel = getProviderAccountLabel(survivor, billers);
    return (
      <BottomSheet T={T} onClose={onClose}>
        <SheetHeader T={T} title="Confirm merge" onCancel={() => setPickedId(null)} />
        <div style={{ color: T.text, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          <strong>{pickedLabel.accountLine || picked.name}</strong> will be merged into <strong>{survivorLabel.accountLine || survivor.name}</strong> ({survivorLabel.providerName}) and removed.
          {" "}{survivor.name}'s relationships, membership history, bills and transactions are kept;
          {" "}{picked.name}'s are moved over. This can't be undone.
        </div>
        <button
          onClick={() => onConfirm(picked)}
          style={{ width: "100%", background: T.danger, border: "none", borderRadius: 14, padding: 13, cursor: "pointer", fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: "Nunito,sans-serif" }}
        >
          Merge "{pickedLabel.accountLine || picked.name}" into "{survivorLabel.accountLine || survivor.name}"
        </button>
      </BottomSheet>
    );
  }

  const survivorLabel = getProviderAccountLabel(survivor, billers);
  return (
    <BottomSheet T={T} onClose={onClose}>
      <SheetHeader T={T} title="Merge duplicate account" onCancel={onClose} />
      <div style={{ color: T.sub, fontSize: 12, marginBottom: 10 }}>Pick the other account to merge into {survivorLabel.accountLine || survivor.name} ({survivorLabel.providerName} · {ownerLabel}). Same-type accounts are listed first.</div>
      <input style={s.input} placeholder="Search Provider, nickname or account number" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ marginTop: 10, maxHeight: "50vh", overflowY: "auto" }}>
        {candidates.map(({ billerAccount: ba, providerName, accountLine }) => (
          <button key={ba.id} data-testid={`merge-candidate-${ba.id}`} onClick={() => setPickedId(ba.id)}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "10px 0", cursor: "pointer", textAlign: "left" }}>
            <span style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{providerName}</span>
            <span style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>{accountLine}{ba.type !== survivor.type ? " · different type" : ""}</span>
          </button>
        ))}
        {!candidates.length ? <div style={{ ...s.hint, padding: "10px 0" }}>{q.trim() ? "No matching Provider or account." : "No other accounts to merge."}</div> : null}
      </div>
    </BottomSheet>
  );
}
