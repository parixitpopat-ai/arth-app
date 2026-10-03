import React, { useState } from "react";
import BottomSheet from "../components/BottomSheet";
import { FONT, RADIUS } from "../constants/theme";
import { shiftMonthKey } from "../domain/budget/readiness";
import { itemKey } from "../domain/payTogether/group";
import { spreadMonths } from "../domain/budget/spread";
import SpreadSheet from "./SpreadSheet";
import { Chip, CashBudgetStrip } from "../components/CashBudgetStrip";

// Plan Ahead PA6/PA7/PA16 — Next-month readiness. Presentation only: every figure comes from
// domain/budget/readiness.js. CASH (solid chip) and BUDGET (outline chip) are always two labelled
// columns and are never added together. Cash needed is never coloured (a requirement, not a limit);
// only Budget used turns amber when planned spending exceeds the month budget. No red, no blocking.

const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = mk => MONTH_LONG[Number(mk.split("-")[1]) - 1];

function ColumnHead({ T, title }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 84px 84px", gap: 8, alignItems: "center", margin: "18px 0 6px" }}>
      <span style={{ color: T.sub, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>{title}</span>
      <span style={{ textAlign: "right" }}><Chip T={T} solid>CASH</Chip></span>
      <span style={{ textAlign: "right" }}><Chip T={T}>BUDGET</Chip></span>
    </div>
  );
}

function Row({ T, sym, fmt, row, onOpen }) {
  const tl = v => (row.estimate && Number(v) > 0 ? "~" : "");
  const num = { fontFamily: FONT.mono, fontSize: 14, fontWeight: 700, color: T.text, textAlign: "right", minWidth: 0 };
  return (
    <button type="button" data-testid={`readiness-row-${row.key}`} onClick={() => onOpen(row)}
      style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 84px 84px", gap: 8, alignItems: "center", width: "100%", minHeight: 52, padding: "8px 0", background: "none", border: "none", borderTop: `1px solid ${T.border}`, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", color: T.text, fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{row.label}</span>
        {row.sub ? <span style={{ display: "block", color: T.sub, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.sub}</span> : null}
      </span>
      <span style={num}>{tl(row.cash)}{sym}{fmt(row.cash)}</span>
      <span style={{ ...num, color: row.budget == null ? T.sub : T.text, fontWeight: row.budget == null ? 500 : 700, fontSize: row.budget == null ? 12 : 14 }}>
        {row.budget == null ? "Not in budget" : `${tl(row.budget)}${sym}${fmt(row.budget)}`}
      </span>
    </button>
  );
}

export default function ReadinessScreen({ T, sym, fmt, monthKey, buildFor, nudgeFor, onRaise, onNotNow, onUndoRaise, onBack, onMonth, onAddUpcoming, onOpenSource, onPayTogether, onRemoveFromGroup, onUndoGroup, onSaveSpread, onRemoveSpread }) {
  const r = buildFor(monthKey);
  const [detail, setDetail] = useState(null);
  const [spreadFor, setSpreadFor] = useState(null); // { key, label, amount, cashDate, existing }
  const tilde = r.spendingEstimated ? "~" : "";
  const tCash = r.spendingEstimated && r.cashNeeded > 0 ? "~" : "";
  const tSpend = r.spendingEstimated && r.spendingCash > 0 ? "~" : "";
  const tBudget = r.spendingEstimated && r.budgetUsed > 0 ? "~" : "";
  const over = r.over > 0;
  const nudge = nudgeFor ? nudgeFor(r) : null;
  const block = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 14px", minWidth: 0 };
  const big = { fontFamily: FONT.mono, fontSize: 24, fontWeight: 800, marginTop: 6, overflowWrap: "anywhere" };
  const nav = { background: T.input, border: "none", color: T.text, borderRadius: 10, minWidth: 44, minHeight: 44, cursor: "pointer", fontSize: 18, fontFamily: "inherit" };

  return (
    <div data-testid="readiness-screen" style={{ padding: "14px 16px 120px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
        <button type="button" aria-label="Back" onClick={onBack} style={nav}>‹</button>
        <div style={{ color: T.text, fontSize: 16, fontWeight: 800, textAlign: "center", minWidth: 0 }}>{monthName(monthKey)} · plan ahead</div>
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" aria-label="Previous month" data-testid="readiness-prev" onClick={() => onMonth(shiftMonthKey(monthKey, -1))} style={nav}>‹</button>
          <button type="button" aria-label="Next month" data-testid="readiness-next" onClick={() => onMonth(shiftMonthKey(monthKey, 1))} style={nav}>›</button>
        </span>
      </div>

      {onPayTogether && (
        <button type="button" data-testid="readiness-pay-together" onClick={onPayTogether} style={{ display: "block", width: "100%", minHeight: 48, marginBottom: 12, background: "none", border: `1px dashed ${T.borderStrong || T.border}`, borderRadius: 14, color: T.accent, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Pay together · plan several instalments on one date</button>
      )}
      {nudge && nudge.kind === "card" && (
        <div data-testid="readiness-nudge" style={{ background: T.card, border: `1px solid ${T.attention}`, borderRadius: 16, padding: "14px 14px", marginBottom: 12 }}>
          <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>Planned spending {r.spendingEstimated ? "~" : ""}{sym}{fmt(r.budgetUsed)} vs budget {sym}{fmt(r.monthBudget)}</div>
          <div style={{ color: T.sub, fontSize: 13, margin: "4px 0 12px" }}>Raise {monthName(monthKey)}’s budget? Investments aren’t included.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" data-testid="nudge-raise" onClick={() => onRaise(nudge.raiseTo)} style={{ minHeight: 48, padding: "0 16px", background: T.accent, border: "none", borderRadius: 14, color: T.accentInk || "#fff", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Raise to {sym}{fmt(nudge.raiseTo)}</button>
            <button type="button" data-testid="nudge-not-now" onClick={onNotNow} style={{ minHeight: 48, padding: "0 16px", background: "none", border: `1px solid ${T.border}`, borderRadius: 14, color: T.text, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Not now</button>
          </div>
        </div>
      )}
      {r.empty ? (
        <div data-testid="readiness-empty" style={{ ...block, textAlign: "center", padding: "28px 18px" }}>
          <div style={{ color: T.text, fontSize: 15, fontWeight: 800 }}>Nothing planned for {monthName(monthKey)} yet</div>
          <div style={{ color: T.sub, fontSize: 13, margin: "6px 0 14px" }}>Upcoming bills, fees, SIPs and commitments appear here as they’re added.</div>
          {onAddUpcoming && <button type="button" onClick={onAddUpcoming} style={{ minHeight: 48, padding: "0 18px", background: T.accent, border: "none", borderRadius: 14, color: T.accentInk || "#fff", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Add upcoming payment</button>}
        </div>
      ) : (<>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div data-testid="readiness-cash" style={block}>
            <Chip T={T} solid>CASH</Chip>
            <div style={{ color: T.sub, fontSize: 12, marginTop: 8 }}>Cash needed</div>
            <div style={{ ...big, color: T.text }}>{tCash}{sym}{fmt(r.cashNeeded)}</div>
            <div style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>to keep ready</div>
            <div style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>{tSpend}{sym}{fmt(r.spendingCash)} spending{r.investments > 0 ? ` + ${sym}${fmt(r.investments)} investments` : ""}</div>
          </div>
          <div data-testid="readiness-budget" style={block}>
            <Chip T={T}>BUDGET</Chip>
            <div style={{ color: T.sub, fontSize: 12, marginTop: 8 }}>Budget used</div>
            <div style={{ ...big, color: over ? T.attention : T.text }}>{tBudget}{sym}{fmt(r.budgetUsed)}</div>
            <div style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>{r.monthBudget > 0 ? `of ${sym}${fmt(r.monthBudget)} budget` : "No budget set"}</div>
            {over && <div data-testid="readiness-over" style={{ color: T.attention, fontSize: 12, fontWeight: 700, marginTop: 2 }}>{tilde}{sym}{fmt(r.over)} over</div>}
            {nudge && nudge.kind === "dismissed" && <button type="button" data-testid="nudge-quiet-raise" onClick={() => onRaise(nudge.raiseTo)} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 44, padding: 0, fontFamily: "inherit" }}>Raise budget</button>}
            {nudge && nudge.kind === "raised" && (
              <div data-testid="nudge-raised" style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>
                {monthName(monthKey)} budget raised from {sym}{fmt(nudge.raisedFrom)}{" "}
                <button type="button" onClick={onUndoRaise} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 44, padding: "0 4px", fontFamily: "inherit" }}>Undo</button>
              </div>
            )}
          </div>
        </div>

        <ColumnHead T={T} title="Spending by type" />
        {r.spendingRows.map(row => <Row key={row.key} T={T} sym={sym} fmt={fmt} row={row} onOpen={setDetail} />)}

        {r.investmentRows.length > 0 && (<>
          <ColumnHead T={T} title="Investments" />
          {r.investmentRows.map(row => <Row key={row.key} T={T} sym={sym} fmt={fmt} row={row} onOpen={setDetail} />)}
        </>)}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 84px 84px", gap: 8, alignItems: "center", borderTop: `2px solid ${T.borderStrong || T.border}`, marginTop: 4, padding: "10px 0" }}>
          <span style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>Total</span>
          <span style={{ fontFamily: FONT.mono, fontSize: 14, fontWeight: 800, color: T.text, textAlign: "right" }}>{tCash}{sym}{fmt(r.cashNeeded)}</span>
          <span style={{ fontFamily: FONT.mono, fontSize: 14, fontWeight: 800, color: over ? T.attention : T.text, textAlign: "right" }}>{tBudget}{sym}{fmt(r.budgetUsed)}</span>
        </div>
        <div style={{ color: T.sub, fontSize: 12, lineHeight: 1.5 }}>~ = estimate, not yet a bill. Cash counts money in the month it leaves. Budget counts the month’s share.</div>
      </>)}

      {spreadFor && (
        <SpreadSheet T={T} sym={sym} fmt={fmt} title={spreadFor.label} amount={spreadFor.amount}
          cashMonth={String(spreadFor.cashDate || `${monthKey}-01`).slice(0, 7)} initial={spreadFor.existing}
          onClose={() => setSpreadFor(null)}
          onSave={({ months, startMonth }) => { onSaveSpread({ ...spreadFor, months, startMonth }); setSpreadFor(null); setDetail(null); }}
          onRemove={spreadFor.existing ? () => { onRemoveSpread(spreadFor.existing.id); setSpreadFor(null); setDetail(null); } : undefined} />
      )}
      {detail && (
        <BottomSheet onClose={() => setDetail(null)} T={T} maxWidth={430} maxHeight="80vh" padding="20px 16px 32px" zIndex={360}>
          {detail.groupId ? (() => {
            const items = detail.items || [];
            const gmk = (detail.sub.match(/Paid together (\d+ \w+)/) || [])[1];
            const months = [...new Set([monthKey, ...items.map(e => String(e.date).slice(0, 7))])].sort();
            const total = Math.round(items.reduce((a, e) => a + Number(e.amount), 0) * 100) / 100;
            const strip = months.map(mk => ({ key: mk, cash: mk === monthKey ? total : null, cashNote: mk === monthKey ? null : `in ${MONTH_SHORT[Number(monthKey.split("-")[1]) - 1]}`, budget: items.filter(e => String(e.date).slice(0, 7) === mk).reduce((a, e) => a + Number(e.amount), 0) || null }));
            return (
              <div data-testid="pt-group-detail">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ color: T.text, fontSize: 16, fontWeight: 800 }}>{detail.label}</div>
                  <button type="button" onClick={() => setDetail(null)} style={{ background: T.input, border: "none", color: T.sub, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>Done</button>
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 24, fontWeight: 800, color: T.text }}>{sym}{fmt(total)}</div>
                <div style={{ color: T.sub, fontSize: 12, margin: "2px 0 12px" }}>Planned for {gmk} · planned together</div>
                <CashBudgetStrip T={T} sym={sym} fmt={fmt} months={strip} />
                <div style={{ color: T.sub, fontSize: 12, margin: "10px 0" }}>Each month’s budget still counts its own instalment; the cash all leaves on {gmk}.</div>
                <div style={{ color: T.sub, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", margin: "12px 0 4px" }}>In this group · original due dates</div>
                {items.map(e => (
                  <div key={itemKey(e)} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, borderTop: `1px solid ${T.border}` }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", color: T.text, fontSize: 13, fontWeight: 700, overflowWrap: "anywhere" }}>{e.name}</span>
                      <span style={{ display: "block", color: T.sub, fontSize: 12 }}>Due {Number(String(e.date).slice(8, 10))} {MONTH_SHORT[Number(String(e.date).slice(5, 7)) - 1]}</span>
                    </span>
                    <span style={{ fontFamily: FONT.mono, fontSize: 13, fontWeight: 700, color: T.text }}>{sym}{fmt(e.amount)}</span>
                    <button type="button" aria-label={`Remove ${e.name} from the group`} data-testid={`pt-remove-${e.sourceId}`} onClick={() => { onRemoveFromGroup(detail.groupId, itemKey(e), e.name); setDetail(null); }} style={{ minWidth: 44, minHeight: 44, background: "none", border: "none", color: T.sub, fontSize: 18, cursor: "pointer" }}>×</button>
                  </div>
                ))}
                <div style={{ color: T.sub, fontSize: 12, margin: "8px 0" }}>× puts an instalment back on its own due date. Pay each from its own screen; once paid it leaves the group.</div>
                <button type="button" data-testid="pt-undo-group" onClick={() => { onUndoGroup(detail.groupId); setDetail(null); }} style={{ width: "100%", minHeight: 48, marginTop: 6, background: "none", border: `1px solid ${T.border}`, borderRadius: 14, color: T.text, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Undo pay together</button>
              </div>
            );
          })() : (
          <div data-testid="readiness-detail">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ color: T.text, fontSize: 16, fontWeight: 800 }}>{detail.label}</div>
              <button type="button" onClick={() => setDetail(null)} style={{ background: T.input, border: "none", color: T.sub, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>Done</button>
            </div>
            <div style={{ color: T.sub, fontSize: 13, marginBottom: 12 }}>{detail.sub}</div>
            <CashBudgetStrip T={T} sym={sym} fmt={fmt} months={detail.kind === "spread" ? spreadMonths(detail.spread).slice(0, 4).map(m => ({ key: m.monthKey, cash: m.monthKey === String(detail.spread.cashDate || "").slice(0, 7) ? detail.spread.amount : null, budget: m.share })) : [{ key: monthKey, cash: detail.cash, budget: detail.budget }]} />
            {detail.kind === "spread" ? (
              <div data-testid="spread-explain">
                <div style={{ color: T.text, fontSize: 13, fontWeight: 700, margin: "12px 0 2px" }}>Why {sym}0 cash?</div>
                <div style={{ color: T.sub, fontSize: 12, marginBottom: 12 }}>The full {sym}{fmt(detail.spread.amount)} {detail.spread.cashDate && detail.spread.cashDate <= new Date().toISOString().slice(0, 10) ? "left" : "leaves"} on {Number(String(detail.spread.cashDate || "").slice(8, 10)) || "—"} {MONTH_SHORT[Number(String(detail.spread.cashDate || "").slice(5, 7)) - 1] || ""}. This month’s budget counts its {sym}{fmt(detail.budget)} share.</div>
                {onSaveSpread && <button type="button" data-testid="spread-change" onClick={() => setSpreadFor({ key: detail.spread.key, label: detail.spread.label, amount: detail.spread.amount, cashDate: detail.spread.cashDate, existing: detail.spread })} style={{ width: "100%", minHeight: 48, background: "none", border: `1px solid ${T.border}`, borderRadius: 14, color: T.text, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Change or remove spread</button>}
              </div>
            ) : (
            <div style={{ color: T.sub, fontSize: 12, margin: "12px 0" }}>{detail.budget == null ? "Investments leave your accounts but aren’t part of the spending budget." : "Cash leaves in this month, and the budget counts the same amount."}</div>
            )}
            {detail.items?.length > 0 && detail.items.map((e, i) => {
              const k = itemKey(e); const sp = detail.itemSpreads && detail.itemSpreads[k];
              return (
                <div key={`${k}:${i}`} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, borderTop: `1px solid ${T.border}` }}>
                  <button type="button" disabled={!onOpenSource} onClick={() => onOpenSource && onOpenSource(e)} style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", gap: 10, background: "none", border: "none", padding: "6px 0", color: T.text, cursor: onOpenSource ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
                    <span style={{ minWidth: 0, overflowWrap: "anywhere", fontSize: 13 }}>{e.name || e.sourceType}{sp ? ` · spread ×${sp.months}` : ""}</span>
                    <span style={{ fontFamily: FONT.mono, fontSize: 13, fontWeight: 700 }}>{sym}{fmt(e.amount)}</span>
                  </button>
                  {onSaveSpread && detail.budget != null && e.category !== "committedSaving" && (
                    <button type="button" data-testid={`spread-open-${e.sourceId}`} onClick={() => setSpreadFor({ key: k, label: e.name || "Payment", amount: Number(e.amount), cashDate: e.date, existing: sp || null })} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 44, padding: "0 4px", fontFamily: "inherit", flexShrink: 0 }}>{sp ? "Change spread" : "Spread in budget"}</button>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
