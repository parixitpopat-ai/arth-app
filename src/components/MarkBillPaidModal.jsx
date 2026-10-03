import React, { useState } from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, TOUCH, FONT } from "../constants/theme";
import { PAYMENT_METHODS, paidWithDifference, isPaidWithBalanced } from "../domain/payments/paidWith";

// UI-2C M2 PY-25 / PY-25b — Record payment. Replaces the old "Mark as Paid" sheet and keeps
// everything it fixed: the paying account is chosen explicitly (never guessed) and an optional
// payment reference is collected. New in M2 (ADR-038): the amount can be less than the balance
// (the Bill becomes Partially paid) or more (the extra is shown as Unallocated — an amount, not a
// status, with nothing to resolve here). The date defaults to today and can be changed.
// Credit-card statements keep their own payment rules, so their amount stays the statement amount.
//
// `balance` is the Bill's remaining balance (billBalance.js); `forLabel` is the Bill's own For.
export default function MarkBillPaidModal({ bill, balance, forLabel, accounts, defaultAccId, today, T, sym, fmt, formatShortDate, onClose, onConfirm }) {
  const remaining = Number(balance ?? bill.amount ?? 0);
  const isCard = Boolean(bill.isCcStatement);
  const [accId, setAccId] = useState(defaultAccId || "");
  const [transactionRef, setTransactionRef] = useState("");
  const [amountText, setAmountText] = useState(String(remaining || ""));
  const [date, setDate] = useState(today);
  // Payments v2 H2 — if recording throws, nothing was saved (the caller writes only after its checks pass),
  // the entries stay as typed, and the primary button stays off until "Try again" or an edit.
  const [failed, setFailed] = useState(false);
  const edit = setter => v => { setFailed(false); setter(v); };
  // Payments v2 C3 — pay one Bill with several methods/accounts ("Split across methods"). The lines must add up to
  // the amount exactly (same rule as Pay Fees' "Paid with"); a card statement keeps its single account.
  const [split, setSplit] = useState(false);
  const [lines, setLines] = useState([]);
  const lineId = () => `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const amount = isCard ? remaining : Math.round((parseFloat(amountText) || 0) * 100) / 100;
  const applied = Math.min(amount, remaining);
  const unallocated = Math.max(0, Math.round((amount - remaining) * 100) / 100);
  const splitLines = lines.map(l => ({ ...l, amount: parseFloat(l.amount) || 0 }));
  const splitDiff = paidWithDifference(splitLines, amount);
  const splitOk = !split || isPaidWithBalanced(splitLines, amount);
  const canSave = (split ? true : Boolean(accId)) && splitOk && amount > 0 && Boolean(date) && !failed;
  const startSplit = () => {
    setFailed(false); setSplit(true);
    setLines([
      { id: lineId(), method: PAYMENT_METHODS[0], accId: accId || "", amount: "" },
      { id: lineId(), method: PAYMENT_METHODS[3], accId: "", amount: "" },
    ]);
  };
  const stopSplit = () => { setFailed(false); setSplit(false); setLines([]); };
  const setLine = (id, patch) => { setFailed(false); setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l)); };
  const addLine = () => setLines(prev => [...prev, { id: lineId(), method: PAYMENT_METHODS[0], accId: "", amount: String(Math.max(0, paidWithDifference(prev.map(l => ({ ...l, amount: parseFloat(l.amount) || 0 })), amount))) }]);
  const removeLine = id => setLines(prev => prev.length > 2 ? prev.filter(l => l.id !== id) : prev);

  const eligibleAccounts = (accounts || []).filter(a => a.type !== "cc");
  const lbl = { color: T.sub, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", display: "block", marginBottom: 6 };
  const inp = { width: "100%", boxSizing: "border-box", minHeight: TOUCH.min, background: T.input, border: `1px solid ${T.borderStrong}`, borderRadius: RADIUS.md, padding: "0 12px", color: T.text, fontSize: 15, fontFamily: FONT.sans, outline: "none" };
  const subtitle = [bill.name, forLabel ? `for ${forLabel}` : null, `balance ${sym}${fmt(remaining)}`].filter(Boolean).join(" · ");

  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="85vh">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
        <div>
          <div style={{ color: T.text, fontSize: 17, fontWeight: 800 }}>Record payment</div>
          <div data-testid="record-payment-subtitle" style={{ color: T.sub, fontSize: 12, marginTop: 3 }}>{subtitle}</div>
          {bill.dueDate && <div style={{ color: T.sub, fontSize: 11, marginTop: 2 }}>Due {formatShortDate(bill.dueDate) || bill.dueDate}</div>}
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: T.pill, border: "none", color: T.sub, borderRadius: 8, padding: "5px 11px", cursor: "pointer", fontSize: 16, fontFamily: FONT.sans }}>✕</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          <span style={lbl}>Amount</span>
          <input data-testid="record-payment-amount" type="number" inputMode="decimal" min="0" disabled={isCard} value={isCard ? String(remaining) : amountText} onChange={e => setAmountText(e.target.value)} style={{ ...inp, fontFamily: FONT.mono, fontSize: 18, opacity: isCard ? 0.7 : 1 }} />
          {!isCard && unallocated > 0 && (
            <div data-testid="record-payment-unallocated" style={{ color: T.attention, fontSize: 12, fontWeight: 600, marginTop: 6 }}>
              {sym}{fmt(applied)} will be applied · {sym}{fmt(unallocated)} Unallocated
            </div>
          )}
          {!isCard && amount > 0 && amount < remaining && (
            <div style={{ color: T.sub, fontSize: 12, marginTop: 6 }}>Partially paid · {sym}{fmt(Math.round((remaining - amount) * 100) / 100)} will remain</div>
          )}
        </label>
        {!split && (
          <label>
            <span style={lbl}>Paid from</span>
            <select data-testid="record-payment-account" value={accId} onChange={e => edit(setAccId)(e.target.value)} style={inp}>
              <option value="">Select an account…</option>
              {eligibleAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
        {!isCard && !split && (
          <button type="button" data-testid="record-payment-split" onClick={startSplit} style={{ alignSelf: "flex-start", minHeight: 44, padding: "0 4px", background: "none", border: "none", color: T.accent, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Split across methods</button>
        )}
        {split && (
          <div data-testid="record-payment-split-lines" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={lbl}>Paid with</span>
            {lines.map((l, i) => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, background: T.card, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 10 }}>
                <select aria-label={`Method ${i + 1}`} value={l.method} onChange={e => setLine(l.id, { method: e.target.value })} style={inp}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select aria-label={`Account ${i + 1}`} data-testid={`record-payment-line-account-${i}`} value={l.accId} onChange={e => setLine(l.id, { accId: e.target.value })} style={inp}>
                  <option value="">Account…</option>
                  {eligibleAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input aria-label={`Amount ${i + 1}`} data-testid={`record-payment-line-amount-${i}`} type="number" inputMode="decimal" min="0" value={l.amount} onChange={e => setLine(l.id, { amount: e.target.value })} placeholder="Amount" style={inp} />
                <button type="button" onClick={() => removeLine(l.id)} disabled={lines.length <= 2} style={{ minHeight: TOUCH.min, background: "none", border: `1px solid ${T.border}`, borderRadius: RADIUS.md, color: T.sub, cursor: lines.length <= 2 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>Remove</button>
              </div>
            ))}
            <div data-testid="record-payment-split-diff" style={{ color: splitOk ? T.success : T.attention, fontSize: 12, fontWeight: 600 }}>
              {splitOk ? "Adds up to the amount" : splitDiff > 0 ? `${sym}${fmt(splitDiff)} still to assign` : `${sym}${fmt(-splitDiff)} over the amount`}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={addLine} style={{ minHeight: 44, padding: "0 12px", background: T.pill, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, color: T.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Add method</button>
              <button type="button" onClick={stopSplit} style={{ minHeight: 44, padding: "0 12px", background: "none", border: "none", color: T.sub, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Use one account</button>
            </div>
          </div>
        )}
        <label>
          <span style={lbl}>Date</span>
          <input data-testid="record-payment-date" type="date" value={date} max={today} onChange={e => edit(setDate)(e.target.value)} style={inp} />
        </label>
        <label>
          <span style={lbl}>Reference · optional</span>
          <input value={transactionRef} onChange={e => setTransactionRef(e.target.value.toUpperCase())} placeholder="UTR or note" style={inp} />
        </label>
      </div>

      {failed && (
        <div data-testid="record-payment-error" role="alert" style={{ marginTop: 14, background: T.card, border: `1px solid ${T.danger || T.border}`, borderRadius: RADIUS.md, padding: "12px 14px" }}>
          <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>Couldn't record payment</div>
          <div style={{ color: T.sub, fontSize: 12, margin: "2px 0 8px" }}>Nothing was saved. Your entries are kept.</div>
          <button data-testid="record-payment-retry" onClick={() => setFailed(false)} style={{ minHeight: 44, padding: "0 16px", background: T.pill, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, color: T.text, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
        </div>
      )}
      <button
        data-testid="record-payment-confirm"
        onClick={() => { if (!canSave) return; try { onConfirm(split ? splitLines[0].accId : accId, transactionRef.trim(), split ? { amount, date, paymentLines: splitLines.map(({ id, method, accId: a, amount: n }) => ({ id, method, accId: a, amount: n })) } : { amount, date }); } catch (e) { setFailed(true); } }}
        disabled={!canSave}
        style={{ marginTop: 16, width: "100%", minHeight: TOUCH.min, background: canSave ? T.accent : T.border, border: "none", borderRadius: RADIUS.md, color: T.accentInk || "#fff", fontWeight: 700, fontSize: 15, cursor: canSave ? "pointer" : "not-allowed", fontFamily: FONT.sans }}
      >
        Record payment {sym}{fmt(amount || 0)}
      </button>
    </BottomSheet>
  );
}
