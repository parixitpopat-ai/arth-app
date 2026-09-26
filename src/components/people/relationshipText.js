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


/** "3 relationships · ₹699 due 5 Oct", "1 relationship · ₹8,765 overdue", or "" when there are none. */
export function relationshipSummaryText(summary, sym, fmt) {
  if (!summary || !summary.count) return "";
  const parts = [`${summary.count} relationship${summary.count === 1 ? "" : "s"}`];
  const a = summary.attention;
  if (a && a.bill) {
    const amt = `${sym}${fmt(Number(a.bill.amount || 0))}`;
    if (a.kind === "overdue") parts.push(`${amt} overdue`);
    else if (a.bill.dueDate) parts.push(`${amt} due ${a.kind === "due" && a.days === 0 ? "today" : dayMonth(a.bill.dueDate)}`);
    else parts.push(`${amt} unpaid`);
  }
  return parts.join(" · ");
}
