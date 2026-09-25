// Vehicle profile — Overview / Fuel / Maintenance / Insurance / Documents / Transactions.
//
// Every number on this screen is derived from src/domain/vehicles/vehicleFinancials.js, which
// only reads existing transactions linked via vehicleId. Nothing here writes money, creates an
// InsurancePolicy/Bill/Loan/reminder on its own, or keeps a parallel ledger — this screen is a
// read (plus explicit hand-offs to the real flows: Add expense opens the T3 form, Add insurance
// policy opens the existing AddInsurancePolicyModal). "Not set" is a real state, never rendered
// as ₹0 (Vehicle Experience brief, rule 3 / rule 5).
import React, { useState } from "react";
import { RADIUS, TOUCH, FONT, TYPE_SCALE, MONEY } from "../constants/theme";
import EmptyState from "../components/EmptyState";
import {
  getVehicleRunningCostBuckets, getVehicleTCO, getVehicleStatusTiles, getVehicleRecentTxns,
  getVehicleTxnsByMonth, getVehicleFuelSummary, getVehicleMaintenanceSummary,
  getVehicleInsuranceSummary, getVehicleReceipts, getUntaggedVehicleCandidates,
} from "../domain/vehicles/vehicleFinancials";

const vehicleIcon = type => (type === "bike" ? "🏍️" : type === "truck" ? "🚛" : type === "auto" ? "🛺" : type === "other" ? "🚘" : "🚗");

const StatusVal = ({ tile, sym, fmt, formatShortDate, T }) => {
  if (tile.val.kind === "none") return <span style={{ color: T.subDim, fontSize: 15, fontWeight: 600 }}>None linked</span>;
  if (tile.val.kind === "sum") return <span style={{ color: T.text, fontSize: 15, fontWeight: 600 }}>{sym}{fmt(tile.val.amount)} · {tile.val.count}</span>;
  return <span style={{ color: T.text, fontSize: 15, fontWeight: 600 }}>Last {formatShortDate(tile.val.date) || tile.val.date} · {sym}{fmt(tile.val.amount)}</span>;
};

const TxnRow = ({ title, meta, amount, sym, fmt, onClick, T }) => (
  <div onClick={onClick} style={{ minHeight: 56, padding: "8px 0", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.border}`, cursor: onClick ? "pointer" : "default" }}>
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ ...TYPE_SCALE.rowTitle, color: T.text }}>{title}</span>
      <span style={{ ...TYPE_SCALE.meta, color: T.sub }}>{meta}</span>
    </div>
    <span style={{ ...MONEY.row, color: T.text }}>{sym}{fmt(amount)}</span>
  </div>
);

const SectionLabel = ({ children, T }) => <span style={{ ...TYPE_SCALE.label, color: T.sub }}>{children}</span>;

// Bulk-link sheet ("Link past expenses" / Fuel tab's "No fuel linked" prompt). Module-level in
// this file — not a nested const inside VehicleProfileScreen — since a picker sheet defined
// that way would remount (and lose its selection) on every parent re-render.
function BulkLinkVehicleSheet({ vehicle, candidates, onClose, onLink, T, sym, fmt, formatShortDate }) {
  const [selected, setSelected] = useState(() => new Set(candidates.map(t => t.id)));
  const toggle = id => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 360, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "22px 22px 0 0", padding: "20px 18px 44px", width: "100%", maxWidth: 430, maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "center", padding: "4px 8px" }}>
          <span style={{ ...TYPE_SCALE.cardTitle, color: T.text }}>{candidates.length ? `No fuel linked to this vehicle` : "Nothing to link"}</span>
          <span style={{ color: T.sub, fontSize: 14, lineHeight: 1.5 }}>{candidates.length ? "These recent Transport payments aren't linked to any vehicle. Pick the ones for the " + (vehicle.name || vehicle.number) + "." : "No untagged Transport expenses in the last 90 days."}</span>
        </div>
        {candidates.length > 0 && (
          <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: "0 14px" }}>
            {candidates.map(t => (
              <div key={t.id} onClick={() => toggle(t.id)} style={{ minHeight: 56, display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${selected.has(t.id) ? T.accent : T.borderStrong}`, background: selected.has(t.id) ? T.accent : "transparent", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: T.accentInk, fontSize: 14, fontWeight: 700 }}>{selected.has(t.id) ? "✓" : ""}</span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ color: T.text, fontSize: 15 }}>{t.desc || t.merchant || "Expense"}</span>
                  <span style={{ color: T.sub, fontSize: 13 }}>{formatShortDate(t.date) || t.date}</span>
                </span>
                <span style={{ ...MONEY.row, color: T.text }}>{sym}{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <span style={{ color: T.subDim, fontSize: 13, lineHeight: 1.45 }}>Only Transport transactions with no vehicle, last 90 days. Transactions already linked to another vehicle are never listed.</span>
        {candidates.length > 0 && (
          <div style={{ minHeight: TOUCH.min, borderRadius: RADIUS.md, background: selected.size ? T.accent : T.border, color: selected.size ? T.accentInk : T.subDim, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: selected.size ? "pointer" : "default" }}
            onClick={() => { if (selected.size) { onLink([...selected]); onClose(); } }}>
            Link {selected.size} to {vehicle.name || vehicle.number}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VehicleProfileScreen({
  vehicle, txns, insurancePolicies = [], T, sym, fmt, formatShortDate,
  onClose, onEdit, onAddExpense, onOpenTxn, onBulkLink, onAddInsurancePolicy, onOpenPolicy,
}) {
  const [tab, setTab] = useState("overview");
  const [bulkLinkSubId, setBulkLinkSubId] = useState(undefined); // undefined = closed, null = any Transport subcat

  const linkedPolicy = insurancePolicies.find(p => String(p.vehicleId) === String(vehicle.id));
  const running = getVehicleRunningCostBuckets(vehicle, txns);
  const tco = getVehicleTCO(vehicle, txns);
  const statusTiles = getVehicleStatusTiles(vehicle, txns, { insurancePolicy: linkedPolicy });
  const recent = getVehicleRecentTxns(vehicle, txns, 5);

  const hasAnyActivity = running.count > 0 || Boolean(linkedPolicy);
  const identityGaps = [
    !linkedPolicy && { key: "insurance", title: "Insurance policy", sub: "Renewal appears in Outlook as a bill", action: () => onAddInsurancePolicy?.({ policyType: vehicle.type === "bike" ? "Bike" : "Vehicle", name: `${vehicle.name || vehicle.number} insurance`, vehicleId: vehicle.id }) },
    !(vehicle.make || vehicle.model || vehicle.year) && { key: "identity", title: "Make, model and year", sub: "Helps tell vehicles apart", action: onEdit },
    vehicle.purchaseValue == null && { key: "purchase", title: "Purchase value", sub: "Needed for total cost of ownership. Never estimated.", action: onEdit },
  ].filter(Boolean).slice(0, 3);

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "fuel", label: "Fuel" },
    { id: "maintenance", label: "Maintenance" },
    { id: "insurance", label: "Insurance" },
    { id: "documents", label: "Documents" },
    { id: "transactions", label: "Transactions" },
  ];

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 12px" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.accent, cursor: "pointer", fontSize: 22, padding: 0, fontFamily: FONT.sans }}>←</button>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ ...TYPE_SCALE.cardTitle, color: T.text }}>{vehicle.name || vehicle.number}</span>
          <span style={{ color: T.sub, fontSize: 13, fontFamily: FONT.mono }}>{(vehicleIcon(vehicle.type))} {(({ car: "Car", bike: "Bike", truck: "Truck", auto: "Auto", other: "Other" })[vehicle.type] || "Car")} · {vehicle.number}</span>
        </div>
        <button onClick={onEdit} style={{ background: "none", border: "none", color: T.accent, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT.sans }}>Edit</button>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginBottom: 14, borderBottom: `1px solid ${T.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ minHeight: 36, padding: "0 14px", borderRadius: 999, whiteSpace: "nowrap", background: tab === t.id ? T.accent : "none", border: `1px solid ${tab === t.id ? T.accent : T.borderStrong}`, color: tab === t.id ? T.accentInk : T.sub, fontSize: 14, fontWeight: tab === t.id ? 600 : 400, cursor: "pointer", fontFamily: FONT.sans }}>{t.label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 30 }}>
          <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionLabel T={T}>Running cost</SectionLabel>
            {!hasAnyActivity ? (
              <>
                <span style={{ color: T.text, fontSize: 16, fontWeight: 600 }}>No spending linked yet</span>
                <span style={{ color: T.sub, fontSize: 14, lineHeight: 1.5 }}>Link fuel, service and insurance payments to this vehicle and they add up here.</span>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ ...MONEY.card, color: T.text }}>{sym}{fmt(running.total)}</span>
                  <span style={{ color: T.sub, fontSize: 13 }}>{running.count} transaction{running.count === 1 ? "" : "s"}</span>
                </div>
                {running.buckets.length > 0 && (
                  <>
                    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
                      {running.buckets.map(b => <span key={b.key} style={{ flex: b.amt, background: b.color }} />)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {running.buckets.map(b => (
                        <div key={b.key} style={{ minHeight: 40, display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color, flex: "none" }} />
                          <span style={{ flex: 1, color: T.text, fontSize: 14 }}>{b.label}</span>
                          <span style={{ color: T.sub, fontSize: 12 }}>{b.n}</span>
                          <span style={{ ...MONEY.meta, color: T.text, fontWeight: 600, minWidth: 76, textAlign: "right" }}>{sym}{fmt(b.amt)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <div onClick={onAddExpense} style={{ flex: 1, minHeight: 44, borderRadius: RADIUS.md, background: T.accent, color: T.accentInk, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>Add expense</div>
              <div onClick={() => setBulkLinkSubId(null)} style={{ flex: 1, minHeight: 44, borderRadius: RADIUS.md, border: `1px solid ${T.borderStrong}`, color: T.text, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>Link past expenses</div>
            </div>
          </div>

          <div style={{ background: T.input, border: `1px dashed ${T.warn}`, borderRadius: RADIUS.lg, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <SectionLabel T={T}>Total cost of ownership</SectionLabel>
              <span style={{ ...MONEY.row, color: T.text }}>{sym}{fmt(tco.total)}</span>
            </div>
            <span style={{ color: T.sub, fontSize: 13, lineHeight: 1.45 }}>
              Everything linked. Purchase value is {tco.purchaseValueIncluded ? <span style={{ color: T.text }}>included</span> : <><span style={{ color: T.text }}>not set</span> and not included. <span onClick={onEdit} style={{ color: T.accent, fontWeight: 600, cursor: "pointer" }}>Add</span></>}
            </span>
          </div>

          {identityGaps.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SectionLabel T={T}>Complete this vehicle</SectionLabel>
              <div style={{ border: `1px dashed ${T.borderStrong}`, borderRadius: RADIUS.lg, padding: "0 14px" }}>
                {identityGaps.map((g, i) => (
                  <div key={g.key} onClick={g.action} style={{ minHeight: 56, display: "flex", alignItems: "center", gap: 12, borderBottom: i < identityGaps.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer" }}>
                    <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ color: T.text, fontSize: 15, fontWeight: 600 }}>{g.title}</span>
                      <span style={{ color: T.subDim, fontSize: 13 }}>{g.sub}</span>
                    </span>
                    <span style={{ color: T.accent, fontSize: 14, fontWeight: 600 }}>Add</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasAnyActivity && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <SectionLabel T={T}>Status</SectionLabel>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {statusTiles.map(s => (
                  <div key={s.key} style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 12, minHeight: 84, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: T.sub, fontSize: 12 }}>{s.label}</span>
                    <StatusVal tile={s} sym={sym} fmt={fmt} formatShortDate={formatShortDate} T={T} />
                    {s.sub && <span style={{ color: T.subDim, fontSize: 12, lineHeight: 1.35 }}>{s.sub}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <SectionLabel T={T}>Recent</SectionLabel>
                <span onClick={() => setTab("transactions")} style={{ color: T.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>All {running.count}</span>
              </div>
              <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: "0 14px" }}>
                {recent.map(t => <TxnRow key={t.id} title={t.desc || t.merchant || "Expense"} meta={formatShortDate(t.date) || t.date} amount={t.amount} sym={sym} fmt={fmt} onClick={() => onOpenTxn?.(t)} T={T} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "fuel" && (() => {
        const fs = getVehicleFuelSummary(vehicle, txns);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 30 }}>
            {fs.twelveMonth.count === 0 ? (
              <EmptyState icon="⛽" title="No fuel linked to this vehicle" subtitle="Link recent fuel payments, or add one now." T={T}
                action={<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div onClick={() => setBulkLinkSubId("t1")} style={{ minHeight: 44, borderRadius: RADIUS.md, background: T.accent, color: T.accentInk, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>Link past fuel expenses</div>
                  <div onClick={onAddExpense} style={{ color: T.sub, fontSize: 14, cursor: "pointer" }}>Add fuel expense instead</div>
                </div>} />
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}><span style={{ color: T.sub, fontSize: 12 }}>This month</span><span style={{ ...MONEY.meta, color: T.text, fontWeight: 600, fontSize: 16 }}>{sym}{fmt(fs.thisMonth.amt)}</span><span style={{ color: T.subDim, fontSize: 12 }}>{fs.thisMonth.count} fill{fs.thisMonth.count === 1 ? "" : "s"}</span></div>
                  <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}><span style={{ color: T.sub, fontSize: 12 }}>6-mo avg</span><span style={{ ...MONEY.meta, color: T.text, fontWeight: 600, fontSize: 16 }}>{sym}{fmt(fs.sixMonthAvg)}</span><span style={{ color: T.subDim, fontSize: 12 }}>per month</span></div>
                  <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}><span style={{ color: T.sub, fontSize: 12 }}>12 months</span><span style={{ ...MONEY.meta, color: T.text, fontWeight: 600, fontSize: 16 }}>{sym}{fmt(fs.twelveMonth.amt)}</span><span style={{ color: T.subDim, fontSize: 12 }}>{fs.twelveMonth.count} fills</span></div>
                </div>
                <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <SectionLabel T={T}>By month</SectionLabel>
                  <div style={{ height: 80, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, alignItems: "end" }}>
                    {fs.byMonth.map((m, i) => {
                      const max = Math.max(...fs.byMonth.map(x => x.amt), 1);
                      return <span key={m.key} style={{ height: `${Math.max(4, (m.amt / max) * 100)}%`, background: i === fs.byMonth.length - 1 ? "#f97316" : T.borderStrong, borderRadius: "3px 3px 0 0" }} />;
                    })}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, color: T.sub, fontSize: 11, textAlign: "center" }}>
                    {fs.byMonth.map((m, i) => <span key={m.key} style={{ color: i === fs.byMonth.length - 1 ? T.text : T.sub }}>{m.label}</span>)}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <SectionLabel T={T}>This month</SectionLabel>
                  <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: "0 14px" }}>
                    {fs.thisMonthTxns.length === 0 && <div style={{ color: T.subDim, fontSize: 13, padding: "14px 0" }}>No fuel this month.</div>}
                    {fs.thisMonthTxns.map(t => <TxnRow key={t.id} title={t.desc || t.merchant || "Fuel"} meta={formatShortDate(t.date) || t.date} amount={t.amount} sym={sym} fmt={fmt} onClick={() => onOpenTxn?.(t)} T={T} />)}
                  </div>
                </div>
                <div style={{ border: `1px dashed ${T.warn}`, borderRadius: RADIUS.md, padding: "10px 12px", color: T.sub, fontSize: 13, lineHeight: 1.45 }}>Litres, price per litre and mileage need fuel fields on the transaction. Not shown today.</div>
              </>
            )}
          </div>
        );
      })()}

      {tab === "maintenance" && (() => {
        const ms = getVehicleMaintenanceSummary(vehicle, txns);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 30 }}>
            {ms.rows.length === 0 ? (
              <EmptyState icon="🔧" title="No service or repairs linked yet" T={T}
                action={<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div onClick={onAddExpense} style={{ minHeight: 44, borderRadius: RADIUS.md, background: T.accent, color: T.accentInk, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>Add service expense</div>
                  <div onClick={() => setBulkLinkSubId("t6")} style={{ color: T.sub, fontSize: 14, cursor: "pointer" }}>Link past service expenses</div>
                </div>} />
            ) : (
              <>
                {ms.lastService && (
                  <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><SectionLabel T={T}>Last service</SectionLabel><span style={{ ...MONEY.row, color: T.text }}>{sym}{fmt(ms.lastService.amount)}</span></div>
                    <span style={{ color: T.text, fontSize: 16, fontWeight: 600 }}>{formatShortDate(ms.lastService.date) || ms.lastService.date}</span>
                    <div style={{ border: `1px dashed ${T.warn}`, borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ color: T.sub, fontSize: 13, lineHeight: 1.4 }}>Next service · needs a service interval</span>
                      <span style={{ color: T.subDim, fontSize: 13 }}>Future</span>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <SectionLabel T={T}>History · {sym}{fmt(ms.total)}</SectionLabel>
                  <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: "0 14px" }}>
                    {ms.rows.map((r, i) => <TxnRow key={r.txn.id + i} title={r.txn.desc || r.txn.merchant || (r.bucketKey === "puc" ? "PUC" : r.bucketKey === "challan" ? "Challan" : "Service")} meta={`${r.bucketKey === "puc" ? "PUC" : r.bucketKey === "challan" ? "Challan" : "Service & repairs"} · ${formatShortDate(r.txn.date) || r.txn.date}`} amount={r.amount} sym={sym} fmt={fmt} onClick={() => onOpenTxn?.(r.txn)} T={T} />)}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {tab === "insurance" && (() => {
        const is_ = getVehicleInsuranceSummary(vehicle, txns);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 30 }}>
            {linkedPolicy ? (
              <div style={{ background: T.input, border: `1px dashed ${T.warn}`, borderRadius: RADIUS.lg, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ color: T.text, fontSize: 16, fontWeight: 600 }}>{linkedPolicy.name}</span><span style={{ color: T.sub, fontSize: 13 }}>{linkedPolicy.provider || "—"} · {linkedPolicy.policyType}</span></span>
                </div>
                <div style={{ borderTop: `1px solid ${T.border}` }}>
                  {[["Policy number", linkedPolicy.policyNumber || "Not tracked"], ["Cover (IDV)", linkedPolicy.sumInsured ? `${sym}${fmt(linkedPolicy.sumInsured)}` : "Not tracked"], ["Premium", linkedPolicy.premiumAmount ? `${sym}${fmt(linkedPolicy.premiumAmount)} / ${linkedPolicy.premiumFrequency}` : "Not tracked"], ["Renews", formatShortDate(linkedPolicy.renewalDate) || linkedPolicy.renewalDate], ["AutoPay", linkedPolicy.autopay ? "On" : "Off"]].map(([k, v]) => (
                    <div key={k} style={{ minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.border}` }}><span style={{ color: T.sub, fontSize: 14 }}>{k}</span><span style={{ color: T.text, fontSize: 14, fontWeight: 500 }}>{v}</span></div>
                  ))}
                </div>
                <div onClick={() => onOpenPolicy?.(linkedPolicy)} style={{ minHeight: 44, borderRadius: RADIUS.md, border: `1px solid ${T.borderStrong}`, color: T.text, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>Open policy</div>
              </div>
            ) : (
              <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionLabel T={T}>Policy</SectionLabel>
                <span style={{ color: T.text, fontSize: 16, fontWeight: 600 }}>No policy added</span>
                <span style={{ color: T.sub, fontSize: 14, lineHeight: 1.5 }}>Add the policy to track its number, cover and renewal. The premium becomes a Bill in Outlook; you pay it like any other bill.</span>
                <div onClick={() => onAddInsurancePolicy?.({ policyType: vehicle.type === "bike" ? "Bike" : "Vehicle", name: `${vehicle.name || vehicle.number} insurance`, vehicleId: vehicle.id })} style={{ minHeight: 44, borderRadius: RADIUS.md, background: T.accent, color: T.accentInk, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>Add insurance policy</div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SectionLabel T={T}>Premiums paid for this vehicle</SectionLabel>
              {is_.rows.length === 0 ? <div style={{ color: T.subDim, fontSize: 13 }}>None yet.</div> : (
                <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: "0 14px" }}>
                  {is_.rows.map((r, i) => <TxnRow key={r.txn.id + i} title={r.txn.desc || r.txn.merchant || "Insurance premium"} meta={formatShortDate(r.txn.date) || r.txn.date} amount={r.amount} sym={sym} fmt={fmt} onClick={() => onOpenTxn?.(r.txn)} T={T} />)}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {tab === "documents" && (() => {
        const receipts = getVehicleReceipts(vehicle, txns);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 30 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SectionLabel T={T}>Vehicle documents</SectionLabel>
              <div style={{ border: `1px dashed ${T.warn}`, borderRadius: RADIUS.lg, padding: "12px 14px" }}>
                <span style={{ color: T.sub, fontSize: 13, lineHeight: 1.5 }}>Registration certificate, insurance policy PDF and PUC certificate need the shared Attachment service, which doesn't exist yet in this app. Hidden until it does — nothing fabricated here.</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SectionLabel T={T}>Receipts on linked transactions · {receipts.length}</SectionLabel>
              {receipts.length === 0 ? <div style={{ color: T.subDim, fontSize: 13 }}>No receipts on linked transactions.</div> : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {receipts.map((r, i) => (
                    <div key={r.txnId + r.kind + i} style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer" }} onClick={() => onOpenTxn?.(txns.find(t => t.id === r.txnId))}>
                      <img src={r.src} alt={r.kind} style={{ height: 90, width: "100%", objectFit: "cover", background: T.card }} />
                      <span style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ color: T.text, fontSize: 13 }}>{r.kind === "receipt" ? "Receipt" : "Payment proof"}</span>
                        <span style={{ color: T.sub, fontSize: 12 }}>{formatShortDate(r.date) || r.date} · {sym}{fmt(r.amount)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {tab === "transactions" && (() => {
        const groups = getVehicleTxnsByMonth(vehicle, txns);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 30 }}>
            {groups.length === 0 ? <EmptyState icon="🚗" title="No transactions linked yet" T={T} /> : groups.map(g => (
              <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <SectionLabel T={T}>{g.key === "unknown" ? "No date" : new Date(g.key + "-01").toLocaleString("en-US", { month: "long", year: "numeric" })}</SectionLabel>
                  <span style={{ color: T.sub, fontSize: 12, fontFamily: FONT.mono }}>{sym}{fmt(g.total)}</span>
                </div>
                <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: "0 14px" }}>
                  {g.rows.map(t => <TxnRow key={t.id} title={t.desc || t.merchant || "Expense"} meta={formatShortDate(t.date) || t.date} amount={t.amount} sym={sym} fmt={fmt} onClick={() => onOpenTxn?.(t)} T={T} />)}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {bulkLinkSubId !== undefined && (
        <BulkLinkVehicleSheet
          vehicle={vehicle}
          candidates={getUntaggedVehicleCandidates(txns, { subId: bulkLinkSubId })}
          onClose={() => setBulkLinkSubId(undefined)}
          onLink={ids => onBulkLink?.(ids, vehicle.id)}
          T={T} sym={sym} fmt={fmt} formatShortDate={formatShortDate}
        />
      )}
    </div>
  );
}
