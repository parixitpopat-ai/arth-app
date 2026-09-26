import React, { useState } from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, TOUCH, FONT } from "../constants/theme";
import { dateAtDay, toLocalDateStr } from "../helpers/dateHelpers";
import { getEffectiveBillingConfig, getEarliestEligibleChangeDate, addBillingVersion, migrateLegacyBillingHistory } from "../domain/cards/billingConfig";

// Credit Card WP, deliverable 5 (CC-5/CC-6). A billing change is a new dated version, never an
// overwrite — existing generated statements stay exactly as they were built (rule 3). The
// earliest "Applies from" date is always the day after the latest generated statement's period,
// so a historical statement can never be selected, per the WP's own rule.
export default function ChangeBillingModal({ account, bills, accounts, todayStr, setAccounts, T, onClose }) {
  const migrated = migrateLegacyBillingHistory(account);
  const current = getEffectiveBillingConfig(migrated, todayStr());
  const currentStatementDay = current.statementDay;
  const earliestEligible = getEarliestEligibleChangeDate(account.id, bills) || todayStr();

  const [statementDay, setStatementDay] = useState(String(current.statementDay));
  const [dueDay, setDueDay] = useState(String(current.dueDay));
  const [payFromAccId, setPayFromAccId] = useState(current.payFromAccId || "");
  const [applyMode, setApplyMode] = useState("next"); // "next" | "later"
  const [effectiveFrom, setEffectiveFrom] = useState(earliestEligible);
  const [error, setError] = useState("");

  // CC-5 "A later statement -> Pick a month": candidate effective-from dates beyond the
  // immediate next eligible one, walking forward under the CURRENT (pre-change) statement day —
  // those are the only period boundaries the current config actually produces, so they're the
  // only ones a "later statement" can honestly mean.
  const laterCandidates = (() => {
    const out = [];
    let cursor = (() => { const [y, m, d] = earliestEligible.split("-").map(Number); return new Date(y, m - 1, d, 12, 0, 0, 0); })();
    for (let i = 0; i < 6; i++) {
      let next = dateAtDay(cursor.getFullYear(), cursor.getMonth() + 1, currentStatementDay);
      if (next <= cursor) next = dateAtDay(cursor.getFullYear(), cursor.getMonth() + 2, currentStatementDay);
      const nextDay = new Date(next); nextDay.setDate(nextDay.getDate() + 1);
      out.push(toLocalDateStr(nextDay));
      cursor = next;
    }
    return out;
  })();

  const lbl = { color: T.sub, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" };
  const inp = { minHeight: TOUCH.min, background: T.input, border: `1px solid ${T.borderStrong}`, borderRadius: RADIUS.md, padding: "0 12px", color: T.text, fontSize: 15, width: "100%", boxSizing: "border-box", fontFamily: FONT.sans };

  const save = () => {
    try {
      const history = addBillingVersion(migrated, {
        effectiveFrom,
        statementDay: Math.max(1, Math.min(31, parseInt(statementDay, 10) || 15)),
        dueDay: Math.max(1, Math.min(31, parseInt(dueDay, 10) || 5)),
        payFromAccId: payFromAccId || null,
      }, bills, todayStr());
      setAccounts(prev => prev.map(x => (x.id === account.id ? { ...x, billingHistory: history } : x)));
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const payFromOptions = (accounts || []).filter(a => a.id !== account.id && a.type !== "cc");
  const payFromName = id => (accounts || []).find(a => a.id === id)?.name;
  const todayS = todayStr();

  // CC-6: "A scheduled change can be edited or removed until its first statement is generated."
  // A version with 0 statements generated under it, and a still-future effectiveFrom, is exactly
  // that scheduled-not-yet-active case — removable. The version currently in effect, and any
  // version that already produced a real statement, never can be (rule 3).
  const removeVersion = effectiveFrom => {
    const next = migrated.billingHistory.filter(v => v.effectiveFrom !== effectiveFrom);
    setAccounts(prev => prev.map(x => (x.id === account.id ? { ...x, billingHistory: next } : x)));
  };

  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="88vh">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ color: T.text, fontSize: 16, fontWeight: 900 }}>Change billing</div>
        <button onClick={onClose} style={{ background: T.pill, border: "none", color: T.sub, borderRadius: 8, padding: "5px 11px", cursor: "pointer", fontSize: 16, fontFamily: FONT.sans }}>✕</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><span style={lbl}>Statement day</span><input style={inp} type="number" min="1" max="31" value={statementDay} onChange={e => setStatementDay(e.target.value)} /></div>
          <div><span style={lbl}>Payment due day</span><input style={inp} type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} /></div>
        </div>
        {payFromOptions.length > 0 && (
          <div>
            <span style={lbl}>Pay from</span>
            <select style={inp} value={payFromAccId} onChange={e => setPayFromAccId(e.target.value)}>
              <option value="">Not set</option>
              {payFromOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <span style={lbl}>Applies from</span>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button onClick={() => { setApplyMode("next"); setEffectiveFrom(earliestEligible); }} style={{ flex: 1, minHeight: TOUCH.min, background: applyMode === "next" ? T.accentSoft : "none", border: `1px solid ${applyMode === "next" ? T.accent : T.border}`, color: applyMode === "next" ? T.accent : T.text, borderRadius: RADIUS.md, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>Next statement</button>
            <button onClick={() => { setApplyMode("later"); setEffectiveFrom(laterCandidates[0] || earliestEligible); }} style={{ flex: 1, minHeight: TOUCH.min, background: applyMode === "later" ? T.accentSoft : "none", border: `1px solid ${applyMode === "later" ? T.accent : T.border}`, color: applyMode === "later" ? T.accent : T.text, borderRadius: RADIUS.md, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>A later statement</button>
          </div>
          {applyMode === "next" ? (
            <div style={{ color: T.sub, fontSize: 11, marginTop: 6 }}>Period starting {earliestEligible}</div>
          ) : (
            <select style={{ ...inp, marginTop: 6 }} value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}>
              {laterCandidates.map(d => <option key={d} value={d}>Period starting {d}</option>)}
            </select>
          )}
          <div style={{ color: T.sub, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
            Statements already generated stay exactly as they were — this can only apply from {earliestEligible} onward, the first period with no generated statement yet.
          </div>
        </div>
        {error && <div style={{ color: T.danger, fontSize: 12, fontWeight: 700 }}>⚠️ {error}</div>}
        <button onClick={save} style={{ minHeight: TOUCH.min, background: T.accent, border: "none", color: T.accentInk, borderRadius: RADIUS.md, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>Save from {effectiveFrom}</button>

        {migrated.billingHistory.length > 0 && (
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            <span style={lbl}>Billing history</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {[...migrated.billingHistory].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).map(v => {
                const stmtCount = (bills || []).filter(b => b.isCcStatement && b.accId === account.id && b.billingConfigVersion === v.effectiveFrom).length;
                const isRemovable = stmtCount === 0 && v.effectiveFrom > todayS && migrated.billingHistory.length > 1;
                return (
                  <div key={v.effectiveFrom} style={{ background: T.input, borderRadius: 10, padding: "8px 10px", fontSize: 11, color: T.sub, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span>From {v.effectiveFrom === "2000-01-01" ? "the start" : v.effectiveFrom} · {v.statementDay}th / due {v.dueDay}th{payFromName(v.payFromAccId) ? ` · ${payFromName(v.payFromAccId)}` : ""}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span>{stmtCount} statement{stmtCount === 1 ? "" : "s"}</span>
                      {isRemovable && <button onClick={() => removeVersion(v.effectiveFrom)} style={{ background: "none", border: "none", color: T.danger, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans, padding: 0 }}>Remove</button>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
