import React, { useMemo, useState, useEffect } from "react";
import BottomSheet from "../components/BottomSheet";
import { getCategoryAttributedTotal, getHouseholdAttributedTotal, buildRefundTotalsByExpense } from "../../domain/allocations/adapter.js";
import {
  getMonthlyCashFlow, getFiscalYearSeries, sumFyToDate, getMonthState, fyStartYearOf, fyMonthKeys, shiftMonth, monthKeyOf,
} from "../../domain/cashflow/monthlyCashFlow.js";

// Money → Monthly cash flow (M1–M9). Presentation only: every figure comes from
// domain/cashflow/monthlyCashFlow.js, which reads recorded transactions and nothing else.
//
// Deliberately NO red/green and no icons/score/praise: the sign, the third tile's label and one
// plain sentence carry the meaning (M5). Same ink for positive, zero and negative.

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthTitle = mk => { const [y, m] = mk.split("-").map(Number); return `${MONTH_LONG[m - 1]} ${y}`; };
const monthName = mk => MONTH_LONG[Number(mk.split("-")[1]) - 1];

const fmtShort = n => {
  const v = Math.abs(Number(n) || 0);
  if (v >= 100000) return `${(v / 100000).toFixed(v >= 1000000 ? 1 : 2).replace(/\.?0+$/, "")}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(v));
};

function useWidth() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 420 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

const signed = (sym, fmt, amount) => `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${sym}${fmt(Math.abs(amount))}`;

/** The three tiles. Third tile's label/value come from describeLeftOver (never a bare minus). */
function Trio({ T, sym, fmt, cf, narrow }) {
  const tile = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 12px", minWidth: 0, boxSizing: "border-box" };
  const lbl = { color: T.sub, fontSize: 12, marginBottom: 4 };
  const val = { color: T.text, fontSize: narrow ? 22 : 17, fontWeight: 800, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" };
  return (
    <div data-testid="cf-trio" style={{ display: "grid", gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "repeat(3, minmax(0, 1fr))", gap: 8 }}>
      <div style={tile}><div style={lbl}>Came in</div><div data-testid="cf-came-in" style={val}>{sym}{fmt(cf.cameIn)}</div></div>
      <div style={tile}><div style={lbl}>Went out</div><div data-testid="cf-went-out" style={val}>{sym}{fmt(cf.wentOut)}</div></div>
      <div style={tile}><div style={lbl}>{cf.leftOver.label}</div><div data-testid="cf-left-over" style={val}>{cf.leftOver.kind === "zero" ? `${sym}0` : signed(sym, fmt, cf.leftOver.amount)}</div></div>
    </div>
  );
}

const sentenceFor = (sym, fmt, lo) =>
  lo.kind === "zero" ? "Came in equals went out"
    : lo.kind === "positive" ? `${sym}${fmt(lo.amount)} more came in than went out`
    : `${sym}${fmt(Math.abs(lo.amount))} more went out than came in`;

function Row({ T, left, sub, right, onClick, testId }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} disabled={!onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minWidth: 0, minHeight: 52, padding: "6px 0", background: "none", border: "none", borderTop: `1px solid ${T.border}`, cursor: onClick ? "pointer" : "default", textAlign: "left", fontFamily: "inherit", color: T.text }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</span>
        {sub && <span style={{ display: "block", color: T.sub, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{right}</span>
      {onClick && <span aria-hidden="true" style={{ color: T.sub, flexShrink: 0 }}>›</span>}
    </button>
  );
}

/** M1 — the card inside Money, between Financial position and the account groups. */
export function CashFlowCard({ T, sym, fmt, txns, cats, todayMonthKey, todayLabel, onOpen }) {
  const { cf, prev, error } = useMemo(() => {
    try {
      return { cf: getMonthlyCashFlow({ txns, cats, monthKey: todayMonthKey }), prev: getMonthlyCashFlow({ txns, cats, monthKey: shiftMonth(todayMonthKey, -1) }), error: null };
    } catch (e) { return { cf: null, prev: null, error: e }; }
  }, [txns, cats, todayMonthKey]);
  const fy = fyStartYearOf(todayMonthKey);
  const narrow = useWidth() < 400;
  return (
    <div data-testid="cashflow-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ color: T.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Monthly cash flow</div>
        <div style={{ color: T.sub, fontSize: 11 }}>FY {fy}–{String(fy + 1).slice(2)}</div>
      </div>
      {error ? (
        <div style={{ color: T.sub, fontSize: 13, padding: "12px 0" }}>Couldn't load cash flow. Your transactions are safe.</div>
      ) : (
        <button type="button" onClick={() => onOpen(todayMonthKey)} style={{ display: "block", width: "100%", background: "none", border: "none", padding: 0, marginTop: 6, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
          <div style={{ color: T.text, fontSize: 16, fontWeight: 800 }}>{monthTitle(todayMonthKey)}</div>
          <div style={{ color: T.sub, fontSize: 12, marginBottom: 10 }}>to date · {todayLabel}</div>
          <Trio T={T} sym={sym} fmt={fmt} cf={cf} narrow={narrow} />
          {prev.hasActivity && (
            <div style={{ color: T.sub, fontSize: 12, marginTop: 10 }}>
              {monthName(prev.monthKey)}: {prev.leftOver.kind === "zero" ? `${sym}0 · came in equals went out` : prev.leftOver.kind === "positive" ? `${signed(sym, fmt, prev.leftOver.amount)} left over` : `${signed(sym, fmt, prev.leftOver.amount)} went out more`}
            </div>
          )}
        </button>
      )}
      <button type="button" data-testid="cashflow-all-months" onClick={() => onOpen(todayMonthKey)} style={{ display: "block", marginTop: 10, background: "none", border: "none", padding: "6px 0", color: T.accent, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>All months ›</button>
    </div>
  );
}

/** M2–M9 — the Cash flow screen. */
export default function CashFlowScreen({
  T, sym, fmt, txns, cats, todayMonthKey, todayLabel, initialMonthKey, getIncomeLabel, getAccountName,
  onBack, onOpenTxn, onShowAllTransactions, onAddTransaction, forceError,
}) {
  const width = useWidth();
  const wide = width >= 960;
  const narrow = width < 400; // one column when three tiles can no longer show a full figure
  const [monthKey, setMonthKey] = useState(initialMonthKey || todayMonthKey);
  const [view, setView] = useState("overview"); // overview (M2) | month (M3) | category (M4)
  const [drill, setDrill] = useState(null); // {side:"in"|"out", id, name}
  const [fyOpen, setFyOpen] = useState(false);
  const [retry, setRetry] = useState(0);

  const fy = fyStartYearOf(monthKey);
  const computed = useMemo(() => {
    try {
      if (forceError && retry === 0) throw new Error("forced");
      return {
        cf: getMonthlyCashFlow({ txns, cats, monthKey }),
        series: getFiscalYearSeries({ txns, cats, fyStartYear: fy }),
        error: null,
      };
    } catch (e) { return { cf: null, series: [], error: e }; }
  }, [txns, cats, monthKey, fy, forceError, retry]);

  const { cf, series, error } = computed;
  const state = cf ? getMonthState(cf, todayMonthKey) : "normal";
  const isCurrent = monthKey === todayMonthKey;
  const step = n => { setMonthKey(shiftMonth(monthKey, n)); setDrill(null); if (view === "category") setView(wide ? "overview" : "month"); };
  const fyKeys = fyMonthKeys(fy);
  const fyUpto = todayMonthKey > fyKeys[11] ? fyKeys[11] : todayMonthKey < fyKeys[0] ? fyKeys[0] : todayMonthKey;
  const maxVal = Math.max(1, ...series.map(s => Math.max(s.cameIn, s.wentOut)));

  const section = { color: T.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, margin: "18px 2px 8px" };
  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "4px 14px", marginBottom: 4 };
  const iconBtn = { width: 44, height: 44, flexShrink: 0, background: T.pill, border: "none", borderRadius: 12, color: T.text, fontSize: 20, cursor: "pointer" };

  // ---- M4 rows -------------------------------------------------------------------------------------
  const drillRows = useMemo(() => {
    if (!drill || !cf) return [];
    const all = Array.isArray(txns) ? txns : [];
    const period = all.filter(t => monthKeyOf(t.date) === monthKey);
    const refunds = buildRefundTotalsByExpense(all);
    if (drill.side === "in") {
      return period.filter(t => t.type === "income" && String(t.incomeType || "") === drill.id)
        .map(t => ({ t, amount: Number(t.amount || 0) })).sort((a, b) => String(b.t.date).localeCompare(String(a.t.date)));
    }
    return period.filter(t => t.type === "expense").map(t => {
      const amount = drill.id === "__uncategorised__"
        ? ((t.catIds && t.catIds.length) || t.catId ? 0 : getHouseholdAttributedTotal({ periodTransactions: [t], allTransactions: all, refundTotalsByExpense: refunds }))
        : getCategoryAttributedTotal([t], drill.id, { allTransactions: all, refundTotalsByExpense: refunds });
      return { t, amount };
    }).filter(r => r.amount > 0).sort((a, b) => String(b.t.date).localeCompare(String(a.t.date)));
  }, [drill, cf, txns, monthKey]);

  const txnTitle = t => t.merchant || t.desc || t.who || (t.type === "income" ? "Income" : "Expense");
  const txnSub = t => {
    const subs = (t.subIds && t.subIds.length ? t.subIds : t.subId ? [t.subId] : [])
      .map(id => (cats || []).flatMap(c => c.subs || []).find(s => s.id === id)?.name).filter(Boolean);
    return [subs.join(", "), getAccountName ? getAccountName(t.accId || t.fromAccId) : ""].filter(Boolean).join(" · ");
  };

  // ---- pieces --------------------------------------------------------------------------------------
  const MonthNav = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <button type="button" aria-label="Previous month" data-testid="cf-prev" onClick={() => step(-1)} style={iconBtn}>‹</button>
      <button type="button" data-testid="cf-title" onClick={() => setFyOpen(true)} style={{ flex: 1, minWidth: 0, minHeight: 44, background: "none", border: "none", color: T.text, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
        <span style={{ display: "block", fontSize: 18, fontWeight: 800 }}>{monthTitle(monthKey)}</span>
        <span style={{ display: "block", color: T.sub, fontSize: 12 }}>FY {fy}–{String(fy + 1).slice(2)}{isCurrent ? ` · to date${todayLabel ? ` · ${todayLabel}` : ""}` : ""}</span>
      </button>
      <button type="button" aria-label="Next month" data-testid="cf-next" onClick={() => step(1)} style={iconBtn}>›</button>
    </div>
  );

  const Chart = (
    <div data-testid="cf-chart">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 4, alignItems: "end", height: 120 }}>
        {series.map(s => {
          const sel = s.monthKey === monthKey;
          const future = s.monthKey > todayMonthKey;
          return (
            <button key={s.monthKey} type="button" aria-label={`${monthTitle(s.monthKey)}: came in ${s.cameIn}, went out ${s.wentOut}`} data-testid={`cf-bar-${s.monthKey}`}
              onClick={() => { setMonthKey(s.monthKey); setDrill(null); }}
              style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, height: "100%", minWidth: 0, padding: "0 1px", background: sel ? T.pill : "transparent", border: future ? `1px dashed ${T.border}` : "1px solid transparent", borderRadius: 6, cursor: "pointer" }}>
              {!future && <span style={{ flex: 1, minWidth: 0, maxWidth: 10, height: `${Math.round((s.cameIn / maxVal) * 100)}%`, minHeight: s.cameIn > 0 ? 2 : 0, background: T.text, opacity: 0.85, borderRadius: 2 }} />}
              {!future && <span style={{ flex: 1, minWidth: 0, maxWidth: 10, height: `${Math.round((s.wentOut / maxVal) * 100)}%`, minHeight: s.wentOut > 0 ? 2 : 0, background: T.sub, borderRadius: 2 }} />}
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 4, marginTop: 4 }}>
        {series.map(s => <span key={s.monthKey} style={{ textAlign: "center", color: s.monthKey === monthKey ? T.text : T.sub, fontSize: 11, fontWeight: s.monthKey === monthKey ? 800 : 500 }}>{MONTH_SHORT[Number(s.monthKey.slice(5)) - 1][0]}</span>)}
      </div>
      <div style={{ display: "flex", gap: 14, color: T.sub, fontSize: 11, marginTop: 8 }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: T.text, opacity: 0.85, borderRadius: 2, marginRight: 4 }} />Came in</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: T.sub, borderRadius: 2, marginRight: 4 }} />Went out</span>
      </div>
    </div>
  );

  const MonthList = (
    <div data-testid="cf-month-list">
      <div style={section}>Month by month</div>
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 12px", gap: 6, color: T.sub, fontSize: 11, padding: "8px 0" }}>
          <span>Month</span><span style={{ textAlign: "right" }}>In</span><span style={{ textAlign: "right" }}>Out</span><span style={{ textAlign: "right" }}>Left over</span><span />
        </div>
        {[...series].reverse().filter(s => s.monthKey <= todayMonthKey || s.monthKey === monthKey).map(s => (
          <button key={s.monthKey} type="button" data-testid={`cf-row-${s.monthKey}`} onClick={() => { setMonthKey(s.monthKey); setDrill(null); }}
            style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 12px", gap: 6, alignItems: "center", width: "100%", minHeight: 44, padding: "0", background: s.monthKey === monthKey ? T.pill : "none", border: "none", borderTop: `1px solid ${T.border}`, color: T.text, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontVariantNumeric: "tabular-nums" }}>
            <span style={{ fontWeight: s.monthKey === monthKey ? 800 : 600 }}>{MONTH_SHORT[Number(s.monthKey.slice(5)) - 1]}</span>
            <span style={{ textAlign: "right" }}>{s.hasActivity ? `${sym}${fmtShort(s.cameIn)}` : "—"}</span>
            <span style={{ textAlign: "right" }}>{s.hasActivity ? `${sym}${fmtShort(s.wentOut)}` : "—"}</span>
            <span style={{ textAlign: "right", fontWeight: 700 }}>{s.hasActivity ? (s.leftOver.kind === "zero" ? `${sym}0` : `${s.leftOver.amount > 0 ? "+" : "−"}${sym}${fmtShort(s.leftOver.amount)}`) : "—"}</span>
            <span aria-hidden="true" style={{ color: T.sub }}>›</span>
          </button>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${T.border}`, fontSize: 13 }}>
          <span style={{ color: T.sub }}>FY to date · Apr–{MONTH_SHORT[Number(fyUpto.slice(5)) - 1]}</span>
          <span data-testid="cf-fy-total" style={{ color: T.text, fontWeight: 800 }}>{signed(sym, fmt, sumFyToDate(series, fyUpto))}</span>
        </div>
      </div>
    </div>
  );

  const Empty = ({ title, body, cta }) => (
    <div data-testid="cf-empty" style={{ border: `1px dashed ${T.border}`, borderRadius: 14, padding: "20px 16px", textAlign: "center", marginTop: 14 }}>
      <div style={{ color: T.text, fontSize: 16, fontWeight: 800 }}>{title}</div>
      {body && <div style={{ color: T.sub, fontSize: 13, margin: "6px 0" }}>{body}</div>}
      {cta}
    </div>
  );

  const detail = () => {
    if (error) {
      return (
        <div data-testid="cf-error" role="alert" style={{ border: `1px solid ${T.border}`, background: T.card, borderRadius: 14, padding: 16, marginTop: 14 }}>
          <div style={{ color: T.text, fontSize: 16, fontWeight: 800 }}>Couldn't load cash flow</div>
          <div style={{ color: T.sub, fontSize: 13, margin: "4px 0 12px" }}>Your transactions are safe. Try again in a moment.</div>
          <button type="button" data-testid="cf-retry" onClick={() => setRetry(r => r + 1)} style={{ minHeight: 44, padding: "0 18px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.pill, color: T.text, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
        </div>
      );
    }
    if (state === "future") return <Empty title={`${monthTitle(monthKey)} hasn't started`} body="Only money that actually moves is counted. Upcoming bills aren't included." />;
    return (
      <>
        <div style={{ marginTop: 14 }}><Trio T={T} sym={sym} fmt={fmt} cf={cf} narrow={narrow} /></div>
        <div data-testid="cf-sentence" style={{ color: T.sub, fontSize: 13, margin: "10px 2px 0" }}>{state === "empty" ? "" : sentenceFor(sym, fmt, cf.leftOver)}</div>
        {state === "empty" ? (
          <Empty title={txns && txns.length ? `No activity in ${monthTitle(monthKey)}` : "Nothing recorded yet"}
            body={txns && txns.length ? "Nothing came in or went out this month." : "Cash flow is worked out from the transactions you record. Add one and this month fills in."}
            cta={onAddTransaction && !(txns && txns.length) ? <button type="button" onClick={onAddTransaction} style={{ marginTop: 6, minHeight: 44, padding: "0 18px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.pill, color: T.text, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add a transaction</button> : null} />
        ) : (
          <>
            <div style={section}>Came in{cf.cameIn > 0 ? ` · ${sym}${fmt(cf.cameIn)}` : ""}</div>
            {cf.incomeBySource.length === 0
              ? <div style={{ color: T.sub, fontSize: 13, padding: "0 2px" }}>No income recorded in {monthName(monthKey)}.</div>
              : <div style={card}>{cf.incomeBySource.map(r => <Row key={r.key || "__income__"} T={T} testId={`cf-src-${r.key || "income"}`} left={r.key ? getIncomeLabel(r.key) : "Income"} right={`${sym}${fmt(r.amount)}`} onClick={() => { setDrill({ side: "in", id: r.key, name: r.key ? getIncomeLabel(r.key) : "Income" }); setView("category"); }} />)}</div>}
            <div style={section}>Went out{cf.wentOut > 0 ? ` · ${sym}${fmt(cf.wentOut)}` : ""}</div>
            {cf.wentOutByCategory.length === 0
              ? <div style={{ color: T.sub, fontSize: 13, padding: "0 2px" }}>No spending recorded in {monthName(monthKey)}.</div>
              : <div style={card}>{cf.wentOutByCategory.map(r => <Row key={r.id} T={T} testId={`cf-cat-${r.id}`} left={r.name} right={`${sym}${fmt(r.amount)}`} onClick={() => { setDrill({ side: "out", id: r.id, name: r.name }); setView("category"); }} />)}</div>}
            {cf.wentOutByCategory.length > 0 && <div style={{ color: T.sub, fontSize: 11, margin: "6px 2px 0" }}>Categories are Arth's existing expense categories.</div>}
            {cf.notCounted.length > 0 && (
              <div data-testid="cf-not-counted">
                <div style={section}>Not counted in {monthName(monthKey)}</div>
                <div style={card}>{cf.notCounted.map(r => <Row key={r.type} T={T} left={r.label} right={`${sym}${fmt(r.amount)}`} />)}</div>
                <div style={{ color: T.sub, fontSize: 11, margin: "6px 2px 0" }}>These move money you already have; they aren't income or spending. Unpaid bills and renewals are never shown here.</div>
              </div>
            )}
            <button type="button" data-testid="cf-all-txns" onClick={() => onShowAllTransactions(monthKey)} style={{ width: "100%", minHeight: 48, marginTop: 16, borderRadius: 12, border: `1px solid ${T.border}`, background: T.pill, color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>All {cf.txnCount} transaction{cf.txnCount === 1 ? "" : "s"} in {monthName(monthKey)}</button>
          </>
        )}
      </>
    );
  };

  const categoryView = () => {
    const total = drillRows.reduce((s, r) => s + r.amount, 0);
    const side = drill.side === "in" ? cf.cameIn : cf.wentOut;
    const pct = side > 0 ? Math.round((total / side) * 100) : 0;
    return (
      <div data-testid="cf-category">
        <div style={{ color: T.text, fontSize: 24, fontWeight: 800, marginTop: 14 }}>{sym}{fmt(total)}</div>
        <div style={{ color: T.sub, fontSize: 13, marginBottom: 6 }}>{drill.side === "in" ? "Came in" : "Went out"} · {pct}% of {monthName(monthKey)} · {drillRows.length} transaction{drillRows.length === 1 ? "" : "s"}</div>
        <div style={card}>
          {drillRows.map(({ t, amount }) => (
            <Row key={t.id} T={T} testId={`cf-txn-${t.id}`} left={txnTitle(t)} sub={`${String(t.date).slice(8, 10)} ${MONTH_SHORT[Number(String(t.date).slice(5, 7)) - 1]} · ${txnSub(t)}`} right={`${sym}${fmt(amount)}`} onClick={() => onOpenTxn(t)} />
          ))}
        </div>
        {drill.side === "out" && <div style={{ color: T.sub, fontSize: 11, margin: "8px 2px 0" }}>A transaction with several lines counts once per category, by line amount.</div>}
      </div>
    );
  };

  const headTitle = view === "category" && drill ? `${drill.name} · ${monthName(monthKey)}` : "Cash flow";
  const back = () => { if (view === "category") { setView(wide ? "overview" : "month"); setDrill(null); } else if (view === "month") setView("overview"); else onBack(); };

  const body = () => {
    if (view === "category" && drill && cf) return categoryView();
    if (wide) {
      return (
        <div data-testid="cf-wide" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
          <div>{MonthNav}<div style={{ marginTop: 14 }}>{Chart}</div>{MonthList}</div>
          <div>{detail()}</div>
        </div>
      );
    }
    if (view === "month") return <>{MonthNav}{detail()}</>;
    return (
      <>
        {MonthNav}
        {error ? detail() : <>
          <div style={{ marginTop: 14 }}><Trio T={T} sym={sym} fmt={fmt} cf={cf} narrow={narrow} /></div>
          <div style={{ color: T.sub, fontSize: 13, margin: "10px 2px 0" }}>{state === "future" ? "Nothing has happened yet" : state === "empty" ? "No transactions this month" : sentenceFor(sym, fmt, cf.leftOver)}</div>
          <div style={{ marginTop: 14 }}>{Chart}</div>
          {MonthList}
          {state !== "future" && <button type="button" data-testid="cf-see-month" onClick={() => setView("month")} style={{ width: "100%", minHeight: 48, marginTop: 14, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>See {monthName(monthKey)}</button>}
          {state === "future" && <Empty title={`Nothing has happened in ${monthName(monthKey)} yet`} body="Only recorded transactions count here. Upcoming bills and renewals are in Payments." />}
        </>}
      </>
    );
  };

  const firstFy = Math.min(fyStartYearOf(todayMonthKey), ...(txns || []).map(t => monthKeyOf(t.date)).filter(Boolean).map(fyStartYearOf));
  const fyChoices = []; for (let y = fyStartYearOf(todayMonthKey) + 1; y >= firstFy; y--) fyChoices.push(y);

  return (
    <div data-testid="cashflow-screen" style={{ padding: "14px 16px 90px", maxWidth: wide ? 1100 : undefined, margin: "0 auto", boxSizing: "border-box", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, minWidth: 0 }}>
        <button type="button" aria-label="Back" data-testid="cf-back" onClick={back} style={iconBtn}>‹</button>
        <div style={{ color: T.text, fontSize: 20, fontWeight: 900, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{headTitle}</div>
      </div>
      {body()}
      {fyOpen && (
        <BottomSheet onClose={() => setFyOpen(false)} T={T} maxWidth={430} padding="20px 16px 32px" zIndex={360}>
          <div style={{ color: T.text, fontSize: 16, fontWeight: 900, marginBottom: 10 }}>Financial year</div>
          {fyChoices.map(y => (
            <button key={y} type="button" data-testid={`cf-fy-${y}`} onClick={() => {
              const keys = fyMonthKeys(y);
              setMonthKey(keys.includes(todayMonthKey) ? todayMonthKey : keys[0]); setDrill(null); setFyOpen(false);
            }} style={{ display: "block", width: "100%", minHeight: 48, textAlign: "left", padding: "0 12px", marginBottom: 6, borderRadius: 12, border: `1px solid ${y === fy ? T.accent : T.border}`, background: T.pill, color: T.text, fontSize: 15, fontWeight: y === fy ? 800 : 600, cursor: "pointer", fontFamily: "inherit" }}>FY {y}–{String(y + 1).slice(2)} · Apr–Mar</button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}
