import React, { useState } from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, TOUCH, FONT } from "../constants/theme";
import {
  confirmMatchedWithBank, undoMatch, recordBankAmount,
  getMismatchDirection, getRecordsNowTotal, applyRecalculatedUpdate, getReviewCandidates,
} from "../domain/cards/reconciliation";

// Credit Card WP, deliverables 7-12 (CC-10 .. CC-15). Every state keeps the Arth amount and the
// underlying transactions untouched until the user changes something themselves (rule "every
// state keeps the Arth amount... untouched until the user changes a record") — this component
// only ever calls setBills with the explicit output of a reconciliation.js transition function,
// never a guessed/derived value of its own.
export default function CreditCardStatementSheet({
  bill, card, accounts, txns, T, sym, fmt, formatShortDate, toDateOnly,
  onClose, setBills,
  onRecordPayment, onAddMissingTxn, onReviewTxn, onViewTransactions,
}) {
  const [enteringBank, setEnteringBank] = useState(false);
  const [bankInput, setBankInput] = useState("");

  const patch = next => setBills(prev => prev.map(b => (b.id === bill.id ? next : b)));

  const periodTxnCount = (txns || []).filter(t => {
    const linkedUpiIds = (accounts || []).filter(a => a.type === "upi" && a.linkedAccount === card?.id).map(a => a.id);
    const allIds = [card?.id, ...linkedUpiIds];
    if ((t.type !== "expense" && t.type !== "investment" && t.type !== "cc_emi") || !allIds.includes(t.accId)) return false;
    return t.date && t.date > bill.periodFrom && t.date <= bill.periodTo;
  }).length;

  const recordsNowTotal = bill.verification === "mismatch" ? getRecordsNowTotal(bill, card, accounts, txns, toDateOnly) : bill.arthAmount;
  const investigationChanged = bill.verification === "mismatch" && Math.abs(recordsNowTotal - bill.arthAmount) > 0.005;
  const direction = getMismatchDirection(bill);

  const lbl = { color: T.sub, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" };
  const pillStyle = { l: bill.verification === "matched" ? "Matched with bank" : bill.verification === "mismatch" ? "Doesn't match" : "Needs verification", c: bill.verification === "matched" ? T.success : bill.verification === "mismatch" ? T.danger : T.warn };

  const submitBankAmount = () => {
    const amt = Number(bankInput);
    if (!Number.isFinite(amt) || amt <= 0) return;
    patch(recordBankAmount(bill, amt));
    setEnteringBank(false);
    setBankInput("");
  };

  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="92vh">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ color: T.text, fontSize: 16, fontWeight: 900 }}>{bill.name}</div>
          <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>{formatShortDate(bill.periodFrom) || bill.periodFrom} – {formatShortDate(bill.periodTo) || bill.periodTo}</div>
        </div>
        <button onClick={onClose} style={{ background: T.pill, border: "none", color: T.sub, borderRadius: 8, padding: "5px 11px", cursor: "pointer", fontSize: 16, fontFamily: FONT.sans }}>✕</button>
      </div>

      <div style={{ background: T.input, borderRadius: RADIUS.lg, padding: "16px 14px", marginBottom: 14, textAlign: "center" }}>
        <div style={{ color: T.sub, fontSize: 11, marginBottom: 2 }}>{bill.verification === "matched" ? "Statement amount" : "Arth-calculated"}</div>
        <div style={{ color: T.text, fontSize: 26, fontWeight: 900 }}>{sym}{fmt(bill.amount)}</div>
        <span style={{ display: "inline-block", marginTop: 8, background: pillStyle.c + "18", color: pillStyle.c, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 800 }}>{pillStyle.l}</span>
        <div style={{ color: T.sub, fontSize: 11, marginTop: 8 }}>Due {formatShortDate(bill.dueDate) || bill.dueDate}{card?.name ? ` · pay from ${card.paymentAccName || "linked account"}` : ""}</div>
      </div>

      {bill.verification === "needs_verification" && !enteringBank && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Does this amount match your bank statement?</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => patch(confirmMatchedWithBank(bill))} style={{ flex: 1, minHeight: TOUCH.min, background: T.success + "18", border: `1px solid ${T.success}44`, color: T.success, borderRadius: RADIUS.md, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>Yes</button>
            <button onClick={() => setEnteringBank(true)} style={{ flex: 1, minHeight: TOUCH.min, background: "none", border: `1px solid ${T.border}`, color: T.text, borderRadius: RADIUS.md, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>No</button>
          </div>
        </div>
      )}

      {enteringBank && (
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={lbl}>What does your bank statement say?</span>
          <input autoFocus type="number" inputMode="decimal" value={bankInput} onChange={e => setBankInput(e.target.value)} placeholder={`${sym}0`}
            style={{ minHeight: TOUCH.min, background: T.input, border: `1px solid ${T.borderStrong}`, borderRadius: RADIUS.md, padding: "0 12px", color: T.text, fontSize: 18, fontWeight: 700, fontFamily: FONT.sans }} />
          {bankInput && Number(bankInput) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.sub }}>
              <span>Difference</span>
              <span style={{ color: T.warn, fontWeight: 700 }}>{sym}{fmt(Math.abs(Number(bankInput) - bill.arthAmount))}</span>
            </div>
          )}
          <button onClick={submitBankAmount} disabled={!bankInput || Number(bankInput) <= 0} style={{ minHeight: TOUCH.min, background: T.accent, border: "none", color: T.accentInk, borderRadius: RADIUS.md, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans, opacity: bankInput && Number(bankInput) > 0 ? 1 : 0.5 }}>
            {bankInput && Number(bankInput) === bill.arthAmount ? "Mark as matched" : "Continue"}
          </button>
        </div>
      )}

      {bill.verification === "matched" && (
        <div style={{ marginBottom: 14, background: T.success + "10", border: `1px solid ${T.success}33`, borderRadius: RADIUS.lg, padding: 12 }}>
          <div style={{ color: T.success, fontSize: 13, fontWeight: 700 }}>Arth and your bank agree</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <span style={{ color: T.sub, fontSize: 11 }}>Confirmed {formatShortDate(bill.verifiedAt) || bill.verifiedAt}</span>
            <button onClick={() => patch(undoMatch(bill))} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>Undo</button>
          </div>
        </div>
      )}

      {bill.verification === "mismatch" && (
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div style={{ textAlign: "center" }}><div style={lbl}>Arth</div><div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{sym}{fmt(bill.arthAmount)}</div></div>
            <div style={{ textAlign: "center" }}><div style={lbl}>Bank</div><div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{sym}{fmt(bill.bankAmount)}</div></div>
            <div style={{ textAlign: "center" }}><div style={lbl}>Difference</div><div style={{ color: T.danger, fontSize: 14, fontWeight: 800 }}>{sym}{fmt(Math.abs(bill.bankAmount - bill.arthAmount))}</div></div>
          </div>

          {!investigationChanged && direction === "bank_higher" && (
            <div style={{ background: T.warn + "10", border: `1px solid ${T.warn}33`, borderRadius: RADIUS.lg, padding: 12 }}>
              <div style={{ color: T.warn, fontSize: 13, fontWeight: 700 }}>{sym}{fmt(bill.bankAmount - bill.arthAmount)} is missing from Arth's records.</div>
              <div style={{ color: T.sub, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>Usually a spend, fee, interest or tax that wasn't added. Check your bank statement for charges between {formatShortDate(bill.periodFrom)} and {formatShortDate(bill.periodTo)}.</div>
              <button onClick={onAddMissingTxn} style={{ marginTop: 10, minHeight: TOUCH.min, width: "100%", background: T.accent, border: "none", color: T.accentInk, borderRadius: RADIUS.md, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>Add missing transaction</button>
            </div>
          )}

          {!investigationChanged && direction === "arth_higher" && (
            <div style={{ background: T.warn + "10", border: `1px solid ${T.warn}33`, borderRadius: RADIUS.lg, padding: 12 }}>
              <div style={{ color: T.warn, fontSize: 13, fontWeight: 700 }}>Arth has {sym}{fmt(bill.arthAmount - bill.bankAmount)} more recorded than your bank statement.</div>
              <div style={{ color: T.sub, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>Review the transactions for this period. Look for duplicates, refunds not recorded, or spends dated outside the period.</div>
              {(() => {
                const candidates = getReviewCandidates(bill, txns, card, accounts);
                if (candidates.length === 0) return null;
                return (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={lbl}>Worth checking first</span>
                    {candidates.slice(0, 5).map((c, i) => (
                      <div key={i} onClick={() => onReviewTxn(c.txn)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: "8px 10px", cursor: "pointer" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{c.txn.note || c.txn.merchant || "Transaction"}</div>
                          <div style={{ color: T.sub, fontSize: 10, marginTop: 1 }}>{c.why}</div>
                        </div>
                        <div style={{ color: T.text, fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{sym}{fmt(c.txn.amount)}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <button onClick={onViewTransactions} style={{ marginTop: 10, minHeight: TOUCH.min, width: "100%", background: "none", border: `1px solid ${T.border}`, color: T.text, borderRadius: RADIUS.md, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>Review transactions</button>
            </div>
          )}

          {investigationChanged && (
            <div style={{ background: T.accentSoft, border: `1px solid ${T.accent}44`, borderRadius: RADIUS.lg, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>
                {recordsNowTotal === bill.bankAmount
                  ? `Arth's records for this period now total ${sym}${fmt(recordsNowTotal)}, the same as your bank.`
                  : `Arth's records for this period now total ${sym}${fmt(recordsNowTotal)}.`}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.sub }}><span>Statement as generated</span><span>{sym}{fmt(bill.arthAmount)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.sub }}><span>Records now</span><span style={{ color: T.text, fontWeight: 700 }}>{sym}{fmt(recordsNowTotal)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.sub }}><span>Bank</span><span>{sym}{fmt(bill.bankAmount)}</span></div>
              <button onClick={() => patch(applyRecalculatedUpdate(bill, recordsNowTotal))} style={{ minHeight: TOUCH.min, background: T.accent, border: "none", color: T.accentInk, borderRadius: RADIUS.md, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>
                {recordsNowTotal === bill.bankAmount ? "Update statement and mark matched" : "Update statement"}
              </button>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {direction === "bank_higher" && <button onClick={onAddMissingTxn} style={{ flex: 1, minHeight: 40, background: "none", border: `1px solid ${T.border}`, color: T.text, borderRadius: RADIUS.md, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>Add missing transaction</button>}
                <button onClick={onViewTransactions} style={{ flex: 1, minHeight: 40, background: "none", border: `1px solid ${T.border}`, color: T.text, borderRadius: RADIUS.md, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>Review transactions</button>
                <button onClick={() => setEnteringBank(true)} style={{ flex: 1, minHeight: 40, background: "none", border: `1px solid ${T.border}`, color: T.text, borderRadius: RADIUS.md, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>Change bank amount</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${T.border}` }}>
        <span style={{ color: T.sub, fontSize: 12 }}>Transactions in period · {periodTxnCount}</span>
        <button onClick={onViewTransactions} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>View</button>
      </div>

      <button onClick={onRecordPayment} style={{ marginTop: 10, minHeight: TOUCH.min, width: "100%", background: T.accentSoft, border: `1px solid ${T.accent}33`, color: T.accent, borderRadius: RADIUS.md, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>💳 Record payment</button>
    </BottomSheet>
  );
}
