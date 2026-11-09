import React, { useMemo, useState } from "react";
import { vendorSpend, findVendorDuplicates } from "../domain/vendors/vendorMerge";

// Money -> Reports -> Vendors: spend by vendor for the selected financial year (or all time), and "same vendor?" questions.
// Nothing is merged until the person taps Merge on a suggestion; "Not the same" is remembered; the last merge can be undone.
// Presentation only: every figure and every suggestion comes from domain/vendors/vendorMerge.js.
export default function VendorsReport({ T, sym, fmt, txns, fy, fyLabel, dismissed, lastMerge, onOpenVendor, onMerge, onDismiss, onUndo }) {
  const [range, setRange] = useState("fy");              // fy | all
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState({});                  // signature -> the spelling to keep
  const period = range === "fy" ? { from: `${fy}-04-01`, to: `${fy + 1}-03-31` } : {};
  const rows = useMemo(() => vendorSpend(txns, period), [txns, range, fy]);   // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => findVendorDuplicates(txns, { dismissed }), [txns, dismissed]);
  const shown = rows.filter(r => !query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase()));
  const total = rows.reduce((s, r) => s + r.amount, 0), top = rows[0]?.amount || 0;
  const chip = on => ({ border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accentSoft || T.accent + "22" : T.pill, color: T.text, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" });
  const btn = primary => ({ border: primary ? "none" : `1px solid ${T.border}`, background: primary ? T.accent : T.card, color: primary ? (T.accentInk || "#fff") : T.text, borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" });
  return (
    <div data-testid="vendors-report">
      {lastMerge && (
        <div data-testid="vendor-merged" style={{ background: T.success + "18", border: `1px solid ${T.success}44`, borderRadius: 12, padding: "10px 12px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ flex: 1, color: T.text, fontSize: 12, fontWeight: 700 }}>✓ Merged {lastMerge.count} {lastMerge.count === 1 ? "entry" : "entries"} into “{lastMerge.to}”.</span>
          <button type="button" data-testid="vendor-undo" onClick={onUndo} style={btn(false)}>Undo</button>
        </div>
      )}
      {groups.length > 0 && (
        <div data-testid="vendor-suggestions" style={{ background: T.warn + "12", border: `1px solid ${T.warn}44`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
          <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>❓ {groups.length === 1 ? "These look like the same vendor" : `${groups.length} sets of vendors look the same`}</div>
          <div style={{ color: T.sub, fontSize: 11, margin: "3px 0 10px" }}>Nothing changes unless you tap Merge. Merging renames the vendor on all those entries and bills, and can be undone.</div>
          {groups.map(g => {
            const keep = pick[g.signature] || g.suggested;
            return (
              <div key={g.signature} data-testid={`vendor-group-${g.key}`} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 10, marginBottom: 8 }}>
                <div style={{ color: T.sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Keep this name</div>
                {g.names.map(n => (
                  <label key={n.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                    <input type="radio" name={`keep-${g.signature}`} data-testid={`vendor-keep-${n.name}`} checked={keep === n.name} onChange={() => setPick(p => ({ ...p, [g.signature]: n.name }))} />
                    <span style={{ flex: 1, color: T.text, fontSize: 13, fontWeight: 700 }}>{n.name}</span>
                    <span style={{ color: T.sub, fontSize: 11 }}>{n.entries} {n.entries === 1 ? "entry" : "entries"} · {sym}{fmt(n.amount)}</span>
                  </label>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button type="button" data-testid={`vendor-merge-${g.key}`} onClick={() => onMerge({ from: g.names.map(n => n.name), to: keep })} style={btn(true)}>Merge into “{keep}”</button>
                  <button type="button" data-testid={`vendor-notsame-${g.key}`} onClick={() => onDismiss(g.signature)} style={btn(false)}>Not the same</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button type="button" data-testid="vendor-range-fy" onClick={() => setRange("fy")} style={chip(range === "fy")}>{fyLabel}</button>
        <button type="button" data-testid="vendor-range-all" onClick={() => setRange("all")} style={chip(range === "all")}>All time</button>
      </div>
      <input data-testid="vendor-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vendors" style={{ width: "100%", boxSizing: "border-box", minHeight: 44, borderRadius: 12, border: `1px solid ${T.border}`, background: T.input, color: T.text, padding: "0 14px", fontSize: 16, marginBottom: 10 }} />
      <div style={{ color: T.sub, fontSize: 12, marginBottom: 10 }}>{rows.length} vendor{rows.length === 1 ? "" : "s"} · {sym}{fmt(total)} spent. Amounts are the full amount of each expense.</div>
      {shown.length === 0 && <div data-testid="vendor-empty" style={{ color: T.sub, fontSize: 13, padding: "18px 0", textAlign: "center" }}>{rows.length ? "No vendor matches that." : "No spending with a vendor name in this period."}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map(r => (
          <button key={r.id} type="button" data-testid={`vendor-row-${r.id}`} onClick={() => onOpenVendor(r.name)} style={{ textAlign: "left", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px", cursor: "pointer", color: T.text }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{sym}{fmt(r.amount)}</span>
            </div>
            <div style={{ height: 4, background: T.border, borderRadius: 2, margin: "6px 0" }}><div style={{ height: "100%", width: `${top ? Math.max(2, Math.round((r.amount / top) * 100)) : 0}%`, background: T.accent, borderRadius: 2 }} /></div>
            <div style={{ color: T.sub, fontSize: 11 }}>{r.entries} {r.entries === 1 ? "entry" : "entries"} · last {r.last}{r.variants.length > 1 ? ` · written ${r.variants.length} ways` : ""}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
