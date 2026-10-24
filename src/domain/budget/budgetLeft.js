// One definition of "how much of this month's budget is left", shared by Home and the Budget tab.
// Budget question only (not the cash Buffer). Pure: `today` is passed in.

const daysInMonthOf = (year, month1) => new Date(year, month1, 0).getDate();

// Days the remaining budget has to last. Today counts (today's budget is still unspent when you look).
// Current month: days in month - day of month + 1. Past month: 0. Future month: all its days.
export const daysLeftInclusive = (today, monthKey) => {
  const y = today.getFullYear(), m = today.getMonth() + 1;
  const nowKey = `${y}-${String(m).padStart(2, "0")}`;
  const key = monthKey || nowKey;
  if (key === nowKey) return daysInMonthOf(y, m) - today.getDate() + 1;
  if (key < nowKey) return 0;
  const [ky, km] = key.split("-").map(Number);
  return daysInMonthOf(ky, km);
};

// state: "none" (no budget set), "left", "over". perDay is null when no budget or no days remain,
// 0 when over budget (never negative).
export const getBudgetLeft = ({ budget, spent, today, monthKey }) => {
  const b = Number(budget) || 0, s = Number(spent) || 0;
  const daysLeft = daysLeftInclusive(today, monthKey);
  if (!(b > 0)) return { budget: b, spent: s, remaining: b - s, overBy: 0, perDay: null, daysLeft, state: "none" };
  const remaining = b - s;
  if (remaining < 0) return { budget: b, spent: s, remaining, overBy: -remaining, perDay: daysLeft > 0 ? 0 : null, daysLeft, state: "over" };
  return { budget: b, spent: s, remaining, overBy: 0, perDay: daysLeft > 0 ? Math.round(remaining / daysLeft) : null, daysLeft, state: "left" };
};
