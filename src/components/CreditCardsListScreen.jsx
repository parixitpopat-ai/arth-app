import React from "react";
import { RADIUS, TOUCH, FONT } from "../constants/theme";

// Credit Card WP — "Payments -> Credit Cards". Per the locked model (rule 1: Credit Card = Account)
// this resolves directly from the real `cc` Accounts and their generated Statement Bills — never
// from the Biller list. Nothing here is a second source of truth: every figure is read straight
// off `bills`/`getCardSummary`, the same canonical data Money and the reconciliation sheet use.
export default function CreditCardsListScreen({
  accounts, bills, txns, T, sym, fmt, formatShortDate, toDateOnly, getCardSummary,
  onClose, onViewStatement, onPay,
}) {
  const cards = (accounts || []).filter(a => a.type === "cc");

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.card, borderRadius: "22px 22px 0 0", padding: "20px 16px 48px", width: "100%", maxWidth: 430, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>💳</span>
            <div style={{ color: T.text, fontSize: 16, fontWeight: 900 }}>Credit Cards</div>
          </div>
          <button onClick={onClose} style={{ background: T.input, border: "none", color: T.sub, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 16, fontFamily: FONT.sans }}>x</button>
        </div>

        {cards.length === 0 && <div style={{ color: T.sub, fontSize: 12, textAlign: "center", padding: "24px 0" }}>No credit cards yet — add one from Settings → Accounts.</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {cards.map(card => {
            const summary = getCardSummary(card, accounts, txns, toDateOnly);
            const cardBills = (bills || []).filter(b => b.isCcStatement && b.accId === card.id).sort((a, b) => String(b.periodTo).localeCompare(String(a.periodTo)));
            const currentStatement = cardBills.find(b => b.status === "unpaid") || cardBills[0] || null;
            const pill = !currentStatement ? null
              : currentStatement.verification === "matched" ? { l: "Matched with bank", c: T.success }
              : currentStatement.verification === "mismatch" ? { l: "Doesn't match", c: T.danger }
              : { l: "Needs verification", c: T.warn };

            return (
              <div key={card.id} style={{ background: T.input, borderRadius: RADIUS.lg, padding: 14, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{card.name}</div>
                    {card.last4 && <div style={{ color: T.sub, fontSize: 11, marginTop: 1 }}>••{card.last4}</div>}
                  </div>
                  {pill && <span style={{ background: pill.c + "18", color: pill.c, borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{pill.l}</span>}
                </div>

                {currentStatement ? (
                  <div onClick={() => onViewStatement(currentStatement)} style={{ background: T.card, borderRadius: RADIUS.md, padding: "10px 12px", cursor: "pointer", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ color: T.sub, fontSize: 10 }}>{currentStatement.status === "paid" ? "Last statement" : "Current statement"}</span>
                      <span style={{ color: T.text, fontSize: 16, fontWeight: 900 }}>{sym}{fmt(currentStatement.amount)}</span>
                    </div>
                    <div style={{ color: T.sub, fontSize: 10, marginTop: 2 }}>{formatShortDate(currentStatement.periodFrom) || currentStatement.periodFrom} → {formatShortDate(currentStatement.periodTo) || currentStatement.periodTo} · Due {formatShortDate(currentStatement.dueDate) || currentStatement.dueDate}</div>
                  </div>
                ) : (
                  <div style={{ color: T.sub, fontSize: 11, marginBottom: 10 }}>No statement generated yet.</div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{sym}{fmt(summary.currentCycleSpend || 0)}</div>
                    <div style={{ color: T.sub, fontSize: 9, marginTop: 1 }}>UNBILLED · THIS CYCLE</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{formatShortDate(summary.nextStatementDate) || "—"}</div>
                    <div style={{ color: T.sub, fontSize: 9, marginTop: 1 }}>NEXT STATEMENT</div>
                  </div>
                </div>

                {cardBills.length > 1 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: T.sub, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>STATEMENT HISTORY</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {cardBills.slice(1, 4).map(b => {
                        const histPill = b.verification === "matched" ? T.success : b.verification === "mismatch" ? T.danger : T.warn;
                        return (
                          <div key={b.id} onClick={() => onViewStatement(b)} style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", fontSize: 11, padding: "4px 0" }}>
                            <span style={{ color: T.sub }}>{formatShortDate(b.periodTo) || b.periodTo}</span>
                            <span style={{ color: T.text, fontWeight: 700 }}>{sym}{fmt(b.amount)}</span>
                            <span style={{ color: histPill }}>{b.status === "paid" ? "Paid" : b.verification === "matched" ? "Matched" : b.verification === "mismatch" ? "Mismatch" : "Unverified"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  {currentStatement && <button onClick={() => onViewStatement(currentStatement)} style={{ flex: 1, minHeight: TOUCH.min, background: "none", border: `1px solid ${T.border}`, color: T.text, borderRadius: RADIUS.md, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>View Statement</button>}
                  <button onClick={() => onPay(card)} style={{ flex: 1, minHeight: TOUCH.min, background: T.accentSoft, border: `1px solid ${T.accent}33`, color: T.accent, borderRadius: RADIUS.md, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.sans }}>💳 Pay</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
