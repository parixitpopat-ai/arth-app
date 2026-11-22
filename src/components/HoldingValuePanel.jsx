import React, { useState, useEffect } from "react";
import { fetchLatestNav, searchFunds } from "../native/navClient.js";
import { navFailureMessage } from "../domain/investments/mfNav.js";

const LABELS = { mf: { price: "NAV today (per unit)", units: "Units you hold" }, stocks: { price: "Price today (per share)", units: "Shares you hold" }, gold: { price: "Price today (per gram)", units: "Grams you hold" }, crypto: { price: "Price today (per coin)", units: "Coins you hold" } };
const clean = v => String(v).replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

// "What is it worth now" for one holding: units and today's price per unit. A mutual fund can look its NAV up by scheme code (or by name); the rest are typed.
// Net worth uses units x price once both are known; until then it keeps what was invested. Saved on this phone.
export default function HoldingValuePanel({ T, sym, fmt, type, valuation, saved, today, onSave, onClear, onNote }) {
  const L = LABELS[type]; if (!L) return null;
  const v = valuation || {};
  const [units, setUnits] = useState(saved?.units ? String(saved.units) : "");
  const [price, setPrice] = useState(saved?.price ? String(saved.price) : "");
  const [code, setCode] = useState(saved?.schemeCode || "");
  const [fundName, setFundName] = useState(saved?.fundName || "");
  const [q, setQ] = useState(""); const [found, setFound] = useState(null);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { setPrice(saved?.price ? String(saved.price) : ""); }, [saved?.price]);   // a refresh from outside shows here
  const inp = { width: "100%", boxSizing: "border-box", background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontSize: 14, fontFamily: "Inter,sans-serif" };
  const lbl = { color: T.sub, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 };
  const btn = (primary) => ({ background: primary ? T.accent : "none", border: primary ? "none" : `1px solid ${T.border}`, color: primary ? (T.accentInk || "#fff") : T.text, borderRadius: 12, minHeight: 44, padding: "0 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Inter,sans-serif" });
  const save = (extra = {}) => { const p = Number(price), u = Number(units); onSave({ ...(u > 0 ? { units: u } : {}), price: p > 0 ? p : 0, priceDate: extra.priceDate || saved?.priceDate || today, schemeCode: code.trim(), fundName, source: extra.source || (code.trim() ? saved?.source : "typed") || "typed", ...extra }); };
  const search = async () => { setBusy(true); setMsg(""); const r = await searchFunds(q); setBusy(false); if (!r.ok) { setMsg(navFailureMessage(r.reason)); setFound(null); } else { setFound(r.funds.slice(0, 8)); if (!r.funds.length) setMsg("No fund matched that name. Try fewer words."); } };
  const getNav = async (c = code) => { if (!String(c).trim()) { setMsg("Choose a fund or type its scheme code first."); return; } setBusy(true); setMsg(""); const r = await fetchLatestNav(c); setBusy(false); if (!r.ok) { setMsg(navFailureMessage(r.reason)); return; } setPrice(String(r.nav)); onSave({ ...(Number(units) > 0 ? { units: Number(units) } : {}), price: r.nav, priceDate: r.date, schemeCode: String(c).trim(), fundName: r.name || fundName, source: "mfapi" }); onNote?.(`NAV ${r.nav} as of ${r.date}`); };
  return (
    <div data-testid="holding-value-panel" style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>What it is worth now</div>
      {v.valued
        ? <div data-testid="holding-valued" style={{ color: T.text, fontSize: 12, marginBottom: 8 }}>{sym}{fmt(v.value)} <span style={{ color: v.gain >= 0 ? T.success : T.danger, fontWeight: 800 }}>{v.gain >= 0 ? "+" : "−"}{sym}{fmt(Math.abs(v.gain))}{v.gainPct !== null ? ` (${v.gain >= 0 ? "+" : ""}${v.gainPct}%)` : ""}</span> on {sym}{fmt(v.invested)} put in · price as of {v.priceDate || "an unknown date"}{v.stale ? " · old, refresh it" : ""}</div>
        : <div style={{ color: T.sub, fontSize: 12, marginBottom: 8 }}>Net worth counts the {sym}{fmt(v.invested ?? 0)} put in. Add the units and today's price to count what it is worth.</div>}
      <span style={lbl}>{L.units}{v.unitsSource === "worked-out" ? ` · worked out from your entries: ${v.units}` : ""}</span>
      <input data-testid="holding-units" style={inp} inputMode="decimal" placeholder={v.units > 0 ? String(v.units) : "e.g. 225.5"} value={units} onChange={e => setUnits(clean(e.target.value))} />
      {v.partialUnits && <div style={{ color: T.warn, fontSize: 11, marginTop: 4 }}>{v.missingEntries} entr{v.missingEntries === 1 ? "y has" : "ies have"} no NAV, so those units are not counted. Type your real units from your statement.</div>}
      <span style={{ ...lbl, marginTop: 10 }}>{L.price}</span>
      <input data-testid="holding-price" style={inp} inputMode="decimal" placeholder="e.g. 123.45" value={price} onChange={e => setPrice(clean(e.target.value))} />
      {type === "mf" && (
        <div style={{ marginTop: 10 }}>
          <span style={lbl}>Fund {code ? `· scheme code ${code}${fundName ? ` · ${fundName}` : ""}` : "(to get the NAV for you)"}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input data-testid="holding-search" style={inp} placeholder="Search by name, or type the scheme code" value={q} onChange={e => setQ(e.target.value)} />
            <button data-testid="holding-search-go" disabled={busy} onClick={() => { if (/^\d{4,7}$/.test(q.trim())) { setCode(q.trim()); setFundName(""); setFound(null); setQ(""); getNav(q.trim()); } else search(); }} style={btn(false)}>Find</button>
          </div>
          {found && found.map(f => <div key={f.code} data-testid="holding-fund" onClick={() => { setCode(f.code); setFundName(f.name); setFound(null); setQ(""); getNav(f.code); }} style={{ padding: "10px 4px", borderBottom: `1px solid ${T.border}`, color: T.text, fontSize: 12, cursor: "pointer" }}>{f.name}<span style={{ color: T.sub }}> · {f.code}</span></div>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {type === "mf" && code && <button data-testid="holding-get-nav" disabled={busy} onClick={() => getNav()} style={btn(false)}>{busy ? "Getting…" : "Get latest NAV"}</button>}
        <button data-testid="holding-save" onClick={() => { save(); onNote?.("Saved"); }} style={btn(true)}>Save</button>
        {(saved && (saved.price || saved.units)) && <button data-testid="holding-clear" onClick={() => { onClear(); setUnits(""); setPrice(""); setCode(""); setFundName(""); onNote?.("Back to counting what was put in"); }} style={btn(false)}>Clear</button>}
      </div>
      {msg && <div data-testid="holding-msg" style={{ color: T.sub, fontSize: 12, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
