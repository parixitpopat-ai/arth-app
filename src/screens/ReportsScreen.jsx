import React, { useMemo, useState } from "react";
import { getHouseholdFiscalYearSummary, getPersonFiscalYearReport } from "../../domain/reports/fiscalYear.js";
import { fyStartYearOf } from "../../domain/cashflow/monthlyCashFlow.js";

// Money → Reports (Web v1): the household financial-year summary and the per-person financial-year report.
// Presentation only: every figure comes from domain/reports/fiscalYear.js, which sums the same monthly cash-flow
// rules and the Budget per-person attribution. No new calculation lives here.

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthShort = mk => `${MONTH_SHORT[Number(mk.split("-")[1]) - 1]} ${mk.slice(2, 4)}`;
const fyLabel = y => `FY ${y}–${String(y + 1).slice(2)}`;
const signed = (sym, fmt, n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${sym}${fmt(Math.abs(n))}`;

export function ReportsCard({ T, onOpen, fy }) {
  return (
    <button type="button" data-testid="reports-card" onClick={onOpen}
      style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, marginBottom: 20, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
      <span>
        <span style={{ display: "block", color: T.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Reports</span>
        <span style={{ display: "block", color: T.text, fontSize: 15, fontWeight: 800, marginTop: 4 }}>Year summary and by person</span>
        <span style={{ display: "block", color: T.sub, fontSize: 12, marginTop: 2 }}>{fyLabel(fy)}</span>
      </span>
      <span style={{ color: T.accent, fontSize: 18 }}>›</span>
    </button>
  );
}

export default function ReportsScreen({ T, sym, fmt, txns, cats, people, todayMonthKey, getIncomeLabel, getPersonAttributedAmount, getPersonPlanningAllocation, onBack, onOpenMonth }) {
  const currentFy = fyStartYearOf(todayMonthKey);
  const firstFy = useMemo(() => {
    const dates = (txns || []).map(t => String(t?.date || "").slice(0, 7)).filter(d => /^\d{4}-\d{2}$/.test(d)).sort();
    return dates.length ? Math.min(fyStartYearOf(dates[0]), currentFy) : currentFy;
  }, [txns, currentFy]);
  const [fy, setFy] = useState(currentFy);
  const [tab, setTab] = useState("year"); // year | people
  const [openPerson, setOpenPerson] = useState(null);

  const house = useMemo(() => getHouseholdFiscalYearSummary({ txns, cats, fyStartYear: fy }), [txns, cats, fy]);
  const peopleReport = useMemo(
    () => getPersonFiscalYearReport({ people, txns, cats, fyStartYear: fy, getPersonAttributedAmount, getPersonPlanningAllocation }),
    [people, txns, cats, fy, getPersonAttributedAmount, getPersonPlanningAllocation]);

  const iconBtn = { width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: `1px solid ${T.border}`, background: T.pill, color: T.text, fontSize: 20, cursor: "pointer", fontFamily: "inherit" };
  const tile = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px", minWidth: 0 };
  const lbl = { color: T.sub, fontSize: 12, marginBottom: 4 };
  const val = { color: T.text, fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" };
  const head = { color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, margin: "18px 2px 6px" };
  const line = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: `1px solid ${T.border}`, color: T.text, fontSize: 13, minWidth: 0 };

  const Year = () => !house.hasActivity ? (
    <div data-testid="rp-empty" style={{ border: `1px dashed ${T.border}`, borderRadius: 14, padding: "20px 16px", textAlign: "center", color: T.sub, fontSize: 13 }}>
      Nothing recorded in {fyLabel(fy)} yet.
    </div>
  ) : (
    <div data-testid="rp-year">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
        <div style={tile}><div style={lbl}>Came in</div><div data-testid="rp-came-in" style={val}>{sym}{fmt(house.cameIn)}</div></div>
        <div style={tile}><div style={lbl}>Went out</div><div data-testid="rp-went-out" style={val}>{sym}{fmt(house.wentOut)}</div></div>
        <div style={tile}><div style={lbl}>{house.leftOver.label}</div><div data-testid="rp-left-over" style={val}>{house.leftOver.kind === "zero" ? `${sym}0` : signed(sym, fmt, house.leftOver.amount)}</div></div>
      </div>
      <div data-testid="rp-sentence" style={{ color: T.sub, fontSize: 13, margin: "10px 2px 0" }}>
        {house.keptPercent == null ? "Nothing came in this year, so there is no share to show." : house.keptPercent >= 0 ? `${house.keptPercent}% of what came in was left over.` : `${Math.abs(house.keptPercent)}% more went out than came in.`}
        {` ${house.activeMonths} of 12 months have entries.`}
      </div>

      <div style={head}>Month by month</div>
      <div data-testid="rp-months">
        {house.months.map(m => (
          <button key={m.monthKey} type="button" data-testid={`rp-month-${m.monthKey}`} onClick={() => onOpenMonth(m.monthKey)} disabled={!m.hasActivity}
            style={{ ...line, width: "100%", background: "none", border: "none", borderTop: `1px solid ${T.border}`, cursor: m.hasActivity ? "pointer" : "default", fontFamily: "inherit", opacity: m.hasActivity ? 1 : 0.5, textAlign: "left" }}>
            <span style={{ width: 52, flexShrink: 0 }}>{monthShort(m.monthKey)}</span>
            <span style={{ flex: 1, color: T.sub, fontSize: 12 }}>{m.hasActivity ? `in ${sym}${fmt(m.cameIn)} · out ${sym}${fmt(m.wentOut)}` : "no entries"}</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{m.hasActivity ? (m.leftOver.kind === "zero" ? `${sym}0` : signed(sym, fmt, m.leftOver.amount)) : ""}</span>
          </button>
        ))}
      </div>

      {house.wentOutByCategory.length > 0 && (<>
        <div style={head}>Where it went</div>
        <div data-testid="rp-categories">
          {house.wentOutByCategory.map(r => (
            <div key={r.id} style={line}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.icon} {r.name}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{sym}{fmt(r.amount)}{house.wentOut > 0 ? <span style={{ color: T.sub, fontWeight: 600 }}> · {Math.round((r.amount / house.wentOut) * 100)}%</span> : null}</span>
            </div>
          ))}
        </div>
      </>)}

      {house.incomeBySource.length > 0 && (<>
        <div style={head}>Where it came from</div>
        <div data-testid="rp-income">
          {house.incomeBySource.map(r => (
            <div key={r.key || "none"} style={line}><span>{getIncomeLabel ? getIncomeLabel(r.key) : (r.key || "Income")}</span><span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{sym}{fmt(r.amount)}</span></div>
          ))}
        </div>
      </>)}

      {house.notCounted.length > 0 && (<>
        <div style={head}>Not counted as came in or went out</div>
        <div data-testid="rp-not-counted">
          {house.notCounted.map(r => (
            <div key={r.type} style={line}><span>{r.label} <span style={{ color: T.sub }}>· {r.count}</span></span><span style={{ fontVariantNumeric: "tabular-nums" }}>{sym}{fmt(r.amount)}</span></div>
          ))}
        </div>
      </>)}
    </div>
  );

  const People = () => peopleReport.rows.length === 0 ? (
    <div data-testid="rp-people-empty" style={{ border: `1px dashed ${T.border}`, borderRadius: 14, padding: "20px 16px", textAlign: "center", color: T.sub, fontSize: 13 }}>
      No spending is attributed to a person in {fyLabel(fy)}.
    </div>
  ) : (
    <div data-testid="rp-people">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
        <div style={tile}><div style={lbl}>Spent on people</div><div data-testid="rp-people-total" style={val}>{sym}{fmt(peopleReport.totalSpent)}</div></div>
        <div style={tile}><div style={lbl}>Planned</div><div style={val}>{peopleReport.totalBudget > 0 ? `${sym}${fmt(peopleReport.totalBudget)}` : "Not set"}</div></div>
      </div>
      <div style={{ color: T.sub, fontSize: 12, margin: "8px 2px 0" }}>Spend is each person's own share, counted the same way as in Budget.</div>
      <div style={head}>By person · {fyLabel(fy)}</div>
      {peopleReport.rows.map(r => {
        const open = openPerson === r.person.id;
        return (
          <div key={r.person.id} style={{ borderTop: `1px solid ${T.border}` }}>
            <button type="button" data-testid={`rp-person-${r.person.id}`} aria-expanded={open} onClick={() => setOpenPerson(open ? null : r.person.id)}
              style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, minHeight: 56, padding: "8px 2px", background: "none", border: "none", color: T.text, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <span style={{ fontSize: 20 }}>{r.person.emoji || "🧑"}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{r.person.name}</span>
                <span style={{ display: "block", color: T.sub, fontSize: 12 }}>{r.budget > 0 ? `of ${sym}${fmt(r.budget)} planned · ${r.usedPercent}% used` : "no budget set"} · {r.txnCount} entr{r.txnCount === 1 ? "y" : "ies"}</span>
              </span>
              <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{sym}{fmt(r.spent)}</span>
              <span style={{ color: T.sub }}>{open ? "▾" : "▸"}</span>
            </button>
            {open && (
              <div data-testid={`rp-person-detail-${r.person.id}`} style={{ padding: "0 2px 12px" }}>
                {r.budget > 0 && <div style={{ color: T.sub, fontSize: 12, marginBottom: 8 }}>{r.remaining >= 0 ? `${sym}${fmt(r.remaining)} remaining` : `${sym}${fmt(Math.abs(r.remaining))} over budget`}</div>}
                {r.categories.length > 0 && (<>
                  <div style={{ ...head, margin: "8px 0 4px" }}>By category</div>
                  {r.categories.slice(0, 8).map(c => <div key={c.id} style={line}><span>{c.icon} {c.name}</span><span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{sym}{fmt(c.amount)}</span></div>)}
                </>)}
                <div style={{ ...head, margin: "12px 0 4px" }}>Month by month</div>
                {r.months.filter(m => m.spend > 0 || m.budget > 0).map(m => (
                  <div key={m.monthKey} style={line}><span>{monthShort(m.monthKey)}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{sym}{fmt(m.spend)}{m.budget > 0 ? <span style={{ color: m.spend > m.budget ? T.danger : T.sub }}> / {sym}{fmt(m.budget)}</span> : null}</span></div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div data-testid="reports-screen" style={{ padding: "14px 16px 90px", boxSizing: "border-box", minWidth: 0, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, minWidth: 0 }}>
        <button type="button" aria-label="Back" data-testid="rp-back" onClick={onBack} style={iconBtn}>‹</button>
        <div style={{ color: T.text, fontSize: 20, fontWeight: 900 }}>Reports</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button type="button" aria-label="Previous financial year" data-testid="rp-fy-prev" disabled={fy <= firstFy} onClick={() => { setFy(fy - 1); setOpenPerson(null); }} style={{ ...iconBtn, opacity: fy <= firstFy ? 0.4 : 1 }}>‹</button>
        <div data-testid="rp-fy" style={{ flex: 1, textAlign: "center", color: T.text, fontSize: 17, fontWeight: 800 }}>{fyLabel(fy)}{fy === currentFy ? <span style={{ display: "block", color: T.sub, fontSize: 12, fontWeight: 600 }}>to date</span> : null}</div>
        <button type="button" aria-label="Next financial year" data-testid="rp-fy-next" disabled={fy >= currentFy} onClick={() => { setFy(fy + 1); setOpenPerson(null); }} style={{ ...iconBtn, opacity: fy >= currentFy ? 0.4 : 1 }}>›</button>
      </div>
      <div role="tablist" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
        {[["year", "Year summary"], ["people", "By person"]].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} data-testid={`rp-tab-${id}`} onClick={() => setTab(id)}
            style={{ minHeight: 44, borderRadius: 12, border: `1px solid ${tab === id ? T.accent : T.border}`, background: tab === id ? T.accentSoft : T.pill, color: T.text, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
        ))}
      </div>
      {tab === "year" ? Year() : People()}
    </div>
  );
}
