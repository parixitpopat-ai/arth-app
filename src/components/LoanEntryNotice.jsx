import React from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, TOUCH, FONT } from "../constants/theme";

// A "Loan given" money-out entry has no destination account, so it cannot be edited as a transfer. Its amount, person and date belong to the loan.
export default function LoanEntryNotice({ T, entry, loan, onEditLoan, onClose }) {
  const btn = primary => ({ width: "100%", minHeight: TOUCH.min, borderRadius: RADIUS.md, border: primary ? "none" : `1px solid ${T.border}`, background: primary ? T.accent : T.pill, color: primary ? (T.accentInk || "#fff") : T.text, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: FONT.sans });
  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="60vh">
      <div data-testid="loan-entry-notice">
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900 }}>🤝 {entry.desc || "Loan given"}</div>
        <div style={{ color: T.sub, fontSize: 13, margin: "8px 0 16px" }}>
          This entry is part of a loan you gave, so it is changed from the loan, not as a transfer between accounts.
          {loan ? "" : " The loan it belongs to could not be found, so it can only be viewed here."}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loan && <button data-testid="loan-entry-edit" onClick={onEditLoan} style={btn(true)}>Open the loan</button>}
          <button data-testid="loan-entry-close" onClick={onClose} style={btn(false)}>Close</button>
        </div>
      </div>
    </BottomSheet>
  );
}
