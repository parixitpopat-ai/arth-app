// Read-only preview of Amazon.in invoices grouped by order (INVOICE-IMPORT-006). Nothing here creates or changes an expense; the screen holds the readings in memory only.
// Details are collapsed by default. No buyer name, address or payment detail is ever read, so none can be shown.
import { chargeTypeLabel } from "../domain/transactions/chargeShare.js";
import { OUTCOME_LABEL } from "../domain/invoices/amazonBatch.js";
import { GATE_MESSAGE, SOURCE_LABEL } from "../domain/invoices/orderSummary.js";

const inr = (paise, sym) => `${sym}${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AmazonOrderPreview({ orders, counts, outcomes, panel = null, T, sym = "₹", card, label, onAddAnother, onClear }) {
  const sum = { cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, listStyle: "none", color: T.text, fontSize: 13, fontWeight: 700 };
  const stat = (id, text, n, warn) => <div key={id} data-testid={`count-${id}`} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: warn && n > 0 ? "#f0a500" : T.text }}><span>{text}</span><b>{n}</b></div>;
  const flat = outcomes.flatMap(o => (o.pages ? o.pages.map(p => ({ ...p, index: o.index })) : [o]));
  return (
    <div data-testid="amazon-preview">
      <div style={{ ...card, borderColor: T.border }} data-testid="amazon-privacy">
        <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Your name, address and payment details are not read</div>
        <div style={{ color: T.sub, fontSize: 12 }}>Arth reads only the seller and the item table, on this device. Nothing from these PDFs is stored or sent anywhere.</div>
      </div>
      <div style={card} data-testid="amazon-counts">
        <div style={label}>What was read</div>
        {stat("files", "Files chosen", counts.files)}
        {stat("read", "Invoices read", counts.invoicesRead)}
        {stat("exact", "Exact duplicates (counted once)", counts.exactDuplicates)}
        {stat("probable", "Probable duplicates to check (kept)", counts.probableDuplicateGroups, true)}
        {stat("review", "Invoices that need a check", counts.needsReview, true)}
        {stat("unreadable", "Files that could not be read", counts.unreadable, true)}
        {stat("ocr", "Pictures needing OCR (not read)", counts.needsOcr, true)}
        {stat("unsupported", "Not a supported invoice", counts.unsupported, true)}
        {counts.blinkit > 0 && stat("blinkit", "Blinkit invoices (add one at a time)", counts.blinkit, true)}
        <details data-testid="amazon-outcomes" style={{ marginTop: 6 }}>
          <summary style={sum}><span>Result for each file</span><span style={{ color: T.accent }}>Show</span></summary>
          {flat.map((o, i) => <div key={i} data-testid="outcome-row" data-kind={o.kind} style={{ padding: "6px 0", borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.text }}>
            <b>File {o.index}{o.page ? ` · page ${o.page}` : ""}</b> — {OUTCOME_LABEL[o.kind] || o.kind}{o.reason ? <div style={{ color: T.sub, fontSize: 11 }}>{o.reason}</div> : null}</div>)}
        </details>
      </div>
      {panel}
      {orders.map(o => (
        <div key={o.orderNumber} style={card} data-testid="amazon-order" data-status={o.status}>
          <div style={label}>Amazon order · {o.invoiceDate}</div>
          <div data-testid="amazon-unverified" style={{ display: "inline-block", background: T.accentSoft, borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 800, color: T.text, marginBottom: 6 }}>{o.summaryView ? `Order summary ${SOURCE_LABEL[o.summaryView.summary.source]}` : o.reconciliation.label}</div>
          <div style={{ color: T.text, fontSize: 12, marginBottom: 6 }}>{o.invoices.length} invoice{o.invoices.length === 1 ? "" : "s"} read</div>
          {o.sellers.map(sg => (
            <details key={sg.sellerName} data-testid="amazon-seller-group" style={{ borderTop: `1px solid ${T.border}` }}>
              <summary style={sum}><span>{sg.sellerName} · {sg.itemCount} item{sg.itemCount === 1 ? "" : "s"}</span><span>{inr(sg.totalPaise, sym)}</span></summary>
              {sg.rows.map((r, i) => <div key={i} data-testid="amazon-row" style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", fontSize: 12, color: T.text }}>
                <span style={{ overflowWrap: "anywhere" }}>{r.label || "Item"} <span style={{ color: T.sub }}>· qty {r.qty} · tax {r.ratePct}% included</span></span><b>{inr(r.totalPaise, sym)}</b></div>)}
            </details>
          ))}
          {o.fees.count > 0 && (
            <details data-testid="amazon-fee-group" style={{ borderTop: `1px solid ${T.border}` }}>
              <summary style={sum}><span>Processing fees × {o.fees.count}</span><span>{inr(o.fees.totalPaise, sym)}</span></summary>
              {o.fees.sources.map((f, i) => <div key={i} data-testid="amazon-fee-source" style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: T.sub }}><span>Invoice {f.invoiceNumber}</span><span>{inr(f.totalPaise, sym)}</span></div>)}
            </details>
          )}
          {o.otherCharges.map((r, i) => <div key={i} data-testid="amazon-row" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.text }}><span>{chargeTypeLabel(r.chargeType)} · {r.label || ""}</span><b>{inr(r.totalPaise, sym)}</b></div>)}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 2px", fontSize: 12, color: T.sub, borderTop: `1px solid ${T.border}` }}><span>Items</span><span>{inr(o.itemsPaise, sym)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.sub }}><span>Fees on invoices</span><span>{inr(o.chargesPaise, sym)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, color: T.text, fontWeight: 800 }} data-testid="amazon-invoiced-total"><span>Invoiced total</span><span>{inr(o.invoicedPaise, sym)}</span></div>
          {o.flaggedInvoiceNumbers.length > 0 && <div data-testid="amazon-probable" style={{ color: "#f0a500", fontSize: 12, marginBottom: 6 }}>Probable duplicate: invoices {o.flaggedInvoiceNumbers.join(" and ")} look alike (same seller, date, amount and item). Both are kept and counted until you decide.</div>}
          {o.summaryView && o.summaryView.gate.reconciliation && (
            <div data-testid="summary-reconciliation" data-mismatch={String(o.summaryView.gate.reconciliation.hasInvoiceMismatch)} style={{ borderTop: `1px solid ${T.border}`, padding: "8px 0", fontSize: 12, color: T.text }}>
              <b>Summary against the invoices</b>
              {o.summaryView.gate.reconciliation.components.map(c => (
                <div key={c.name} data-testid="summary-component" data-state={c.state} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0", color: c.state === "matches" || c.state === "summary-only" ? T.text : "#f0a500" }}>
                  <span>{c.name}</span>
                  <span>{c.state === "matches" ? `matches · ${inr(c.summaryPaise, sym)}` : c.state === "summary-only" ? `${inr(c.summaryPaise, sym)} (only on the summary)` : c.state === "missing-coverage" ? `invoices fall short by ${inr(-c.differencePaise, sym)}` : `invoices exceed the summary by ${inr(c.differencePaise, sym)}`}</span>
                </div>))}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, paddingTop: 4 }} data-testid="summary-order-total"><span>Order total (Grand Total)</span><span>{inr(o.summaryView.gate.reconciliation.orderTotalPaise, sym)}</span></div>
            </div>)}
          {o.summaryView && (
            <div data-testid="order-gate" style={{ color: "#f0a500", fontSize: 12, marginBottom: 6 }}>
              Confirmation is blocked: {o.summaryView.gate.reasons.filter(r => r !== "amazon-confirm-not-available").map(r => GATE_MESSAGE[r]).join(" ") || GATE_MESSAGE["amazon-confirm-not-available"]}
            </div>)}
          <div style={{ background: T.accentSoft, borderRadius: 10, padding: "8px 10px", color: T.text, fontSize: 12 }} data-testid="amazon-missing">
            <b>This is not necessarily what you paid.</b> It does not include: {o.notOnTheseInvoices.join("; ")}. Add the other invoices from this order; the amount you actually paid comes from your own entry.
          </div>
          {o.status !== "supported" && <div style={{ color: "#f0a500", fontSize: 12, marginTop: 8 }} data-testid="amazon-review">Check this before relying on it: {o.invoices.flatMap(i => i.findings).map(f => f.message).join(" ")}</div>}
        </div>
      ))}
      <div style={{ ...card, color: T.sub, fontSize: 12 }} data-testid="amazon-confirm-note">Adding an Amazon order as an expense is not available yet. It waits for the purchase-entry change (amount paid first, items underneath), so a discount, shipping or EMI is never guessed. Until then this is a preview only; nothing is saved.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button data-testid="amazon-add-another" onClick={onAddAnother} style={{ minHeight: 44, padding: "10px 14px", borderRadius: 12, border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontWeight: 800, cursor: "pointer" }}>Add more invoices</button>
        <button data-testid="amazon-clear" onClick={onClear} style={{ minHeight: 44, padding: "10px 14px", borderRadius: 12, border: `1px solid ${T.border}`, background: "none", color: T.sub, fontWeight: 700, cursor: "pointer" }}>Clear</button>
      </div>
    </div>
  );
}
