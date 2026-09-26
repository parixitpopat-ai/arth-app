// Display text for UI-2C relationship rows (P-4 / G-12).

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayMonth = ymd => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ""));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : "";
};
const monthOf = ymd => {
  const m = /^(\d{4})-(\d{2})/.exec(String(ymd || ""));
  return m ? MONTHS[Number(m[2]) - 1] : "";
};

/** Status line and tone for a relationship row, from getRelationshipBillState. */
export function relationshipStatusText(state, sym, fmt) {
  const b = state?.bill;
  const amt = b ? `${sym}${fmt(Number(b.amount || 0))}` : "";
  switch (state?.kind) {
    case "overdue": return { text: `${amt} · ${state.days} day${state.days === 1 ? "" : "s"} overdue`, tone: "negative" };
    case "due": return { text: `${amt} · ${state.days === 0 ? "today" : dayMonth(b.dueDate)}`, tone: "attention" };
    case "unpaid": return { text: b?.dueDate ? `${amt} · ${dayMonth(b.dueDate)}` : `${amt} unpaid`, tone: "muted" };
    case "paid": return { text: `${monthOf(b.dueDate || b.paidDate) || "Last"} paid`, tone: "positive" };
    default: return { text: "Nothing due", tone: "muted" };
  }
}

