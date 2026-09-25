import React, { useState } from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, TOUCH, FONT } from "../constants/theme";
import { getEffectiveBillingConfig, getEarliestEligibleChangeDate, addBillingVersion, migrateLegacyBillingHistory } from "../domain/cards/billingConfig";

// Credit Card WP, deliverable 5 (CC-5/CC-6). A billing change is a new dated version, never an
// overwrite — existing generated statements stay exactly as they were built (rule 3). The
// earliest "Applies from" date is always the day after the latest generated statement's period,
// so a historical statement can never be selected, per the WP's own rule.
export default function ChangeBillingModal({ account, bills, accounts, todayStr, setAccounts, T, onClose }) {
  const migrated = migrateLegacyBillingHistory(account);
  const current = getEffectiveBillingConfig(migrated, todayStr());
  const earliestEligible = getEarliestEligibleChangeDate(account.id, bills) || todayStr();

  const [statementDay, setStatementDay] = useState(String(current.statementDay));
  const [dueDay, setDueDay] = useState(String(current.dueDay));
  const [payFromAccId, setPayFromAccId] = useState(current.payFromAccId || "");
  const [effectiveFrom, setEffectiveFrom] = useState(earliestEligible);
  const [error, setError] = useState("");

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
          <input style={inp} type="date" min={earliestEligible} value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
          <div style={{ color: T.sub, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
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
                return (
                  <div key={v.effectiveFrom} style={{ background: T.input, borderRadius: 10, padding: "8px 10px", fontSize: 11, color: T.sub, display: "flex", justifyContent: "space-between" }}>
                    <span>From {v.effectiveFrom === "2000-01-01" ? "the start" : v.effectiveFrom} · {v.statementDay}th / due {v.dueDay}th</span>
                    <span>{stmtCount} statement{stmtCount === 1 ? "" : "s"}</span>
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
