// Read-only preview of Amazon.in invoices grouped by order. Nothing here creates or changes an expense; the screen holds the readings in memory only.
import { chargeTypeLabel } from "../domain/transactions/chargeShare.js";

const inr = (paise, sym) => `${sym}${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AmazonOrderPreview({ orders, T, sym = "₹", card, label, onAddAnother, onClear }) {
  return (
    <div data-testid="amazon-preview">
      <div style={{ ...card, borderColor: T.border }} data-testid="amazon-privacy">
        <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Your name, address and payment details are not read</div>
        <div style={{ color: T.sub, fontSize: 12 }}>Arth reads only the seller and the item table. Nothing from this PDF is stored or sent anywhere.</div>
      </div>
      {orders.map(o => (
        <div key={o.orderNumber} style={card} data-testid="amazon-order" data-status={o.status}>
          <div style={label}>Amazon order · {o.invoiceDate}</div>
          <div style={{ color: T.text, fontSize: 12, marginBottom: 6 }}>{o.invoices.length} invoice{o.invoices.length === 1 ? "" : "s"} read</div>
          {o.rows.map((r, i) => (
            <div key={i} data-testid="amazon-row" style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 700, overflowWrap: "anywhere" }}>{r.kind === "charge" ? `${chargeTypeLabel(r.chargeType)} · ${r.label || ""}` : (r.label || "Item")}</div>
                <div style={{ color: T.sub, fontSize: 11 }}>{r.sellerName} · qty {r.qty} · tax {r.ratePct}% included</div>
              </div>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{inr(r.totalPaise, sym)}</div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 12, color: T.sub }}><span>Items</span><span>{inr(o.itemsPaise, sym)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.sub }}><span>Fees on invoices</span><span>{inr(o.chargesPaise, sym)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, color: T.text, fontWeight: 800 }} data-testid="amazon-invoiced-total"><span>Invoiced total</span><span>{inr(o.invoicedPaise, sym)}</span></div>
          <div style={{ background: T.accentSoft, borderRadius: 10, padding: "8px 10px", color: T.text, fontSize: 12 }} data-testid="amazon-missing">
            <b>This is not necessarily what you paid.</b> It does not include: {o.notOnTheseInvoices.join("; ")}. Add the other invoices from this order, and the amount you actually paid comes from your own entry.
          </div>
          {o.status !== "supported" && <div style={{ color: "#f0a500", fontSize: 12, marginTop: 8 }} data-testid="amazon-review">Check this before relying on it: {o.invoices.flatMap(i => i.findings).map(f => f.message).join(" ")}</div>}
        </div>
      ))}
      <div style={{ ...card, color: T.sub, fontSize: 12 }} data-testid="amazon-confirm-note">Adding an Amazon order as an expense arrives with the purchase-entry change (amount paid first, items underneath). Until then this is a preview only.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button data-testid="amazon-add-another" onClick={onAddAnother} style={{ padding: "10px 14px", borderRadius: 12, border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontWeight: 800, cursor: "pointer" }}>Add another invoice from this order</button>
        <button data-testid="amazon-clear" onClick={onClear} style={{ padding: "10px 14px", borderRadius: 12, border: `1px solid ${T.border}`, background: "none", color: T.sub, fontWeight: 700, cursor: "pointer" }}>Clear</button>
      </div>
    </div>
  );
}
