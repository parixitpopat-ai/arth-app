import React from "react";
import BottomSheet from "../components/BottomSheet";
import { FONT } from "../constants/theme";

// Pay together -> Pay, for a group that isn't a single school's fees: one row per part, each opening the
// existing payment flow (Pay fees / Record payment). Parts that can't be paid from here are listed, not hidden.

export default function PayGroupSheet({ T, sym, fmt, plan, onPayFees, onPayBill, onClose }) {
  const btn = { minHeight: 44, padding: "0 14px", background: T.accent, border: "none", borderRadius: 12, color: T.accentInk || "#fff", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 };
  return (
    <BottomSheet onClose={onClose} T={T} maxWidth={430} maxHeight="85vh" padding="20px 16px 32px" zIndex={370}>
      <div data-testid="pay-group-sheet">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ color: T.text, fontSize: 16, fontWeight: 800 }}>Pay this group</div>
          <button type="button" onClick={onClose} style={{ background: T.input, border: "none", color: T.sub, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>Done</button>
        </div>
        <div style={{ color: T.sub, fontSize: 13, marginBottom: 12 }}>Each part opens its usual payment screen. Anything you pay leaves the group.</div>
        {plan.parts.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 56, borderTop: `1px solid ${T.border}` }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", color: T.text, fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{p.kind === "fees" ? `${p.schedule.schoolName} · ${p.periodIds.length} fee period${p.periodIds.length === 1 ? "" : "s"}` : p.bill.name}</span>
              <span style={{ display: "block", color: T.sub, fontFamily: FONT.mono, fontSize: 12 }}>{sym}{fmt(p.total)}</span>
            </span>
            <button type="button" data-testid={`pay-part-${i}`} onClick={() => p.kind === "fees" ? onPayFees(p) : onPayBill(p.bill)} style={btn}>{p.kind === "fees" ? "Pay fees" : "Record payment"}</button>
          </div>
        ))}
        {plan.unpayable.length > 0 && (
          <div data-testid="pay-group-unpayable" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, color: T.sub, fontSize: 12 }}>
            Can’t be paid from here — open them from their own screen: {plan.unpayable.map(e => e.name || e.sourceType).join(", ")}.
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
