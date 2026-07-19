export const todayStr = () => new Date().toISOString().split("T")[0];

export const addDaysToDateStr = (dateStr, days) => {
  if(!dateStr) return dateStr;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days||0));
  return d.toISOString().split("T")[0];
};

// A membership period's real coverage end, accounting for any grace days attached to it. Grace
// extends how long a period is treated as "active" before it's lapsed, but is never baked into
// the stored `to` date itself — keeping `to` as the clean plan-end and `graceDays` as separate
// metadata is what lets the UI show e.g. "Quarterly (+15d grace)" instead of silently stretching
// the date. Every active/lapsed/expiring check should use this instead of comparing `to` directly.
export const getPeriodEffectiveEnd = (period) => addDaysToDateStr(period?.to, period?.graceDays||0);

export const daysInMonth = (monthKey) => {
  if(monthKey){
    const [y,m] = monthKey.split("-").map(Number);
    if(!y||!m) return 31;
    return new Date(y, m, 0).getDate();
  }
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth()+1, 0).getDate();
};

export const daysLeft = (monthKey) => {
  const today = new Date();
  const nowKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  if(!monthKey || monthKey === nowKey){
    return Math.max(0, daysInMonth(nowKey) - today.getDate());
  }
  if(monthKey < nowKey) return 0;
  return daysInMonth(monthKey);
};

export const getMonthBounds = (monthKey = todayStr().slice(0,7)) => {
  const [year, month] = String(monthKey || todayStr().slice(0,7)).split("-").map(Number);
  const safeYear = year || new Date().getFullYear();
  const safeMonth = month || (new Date().getMonth() + 1);
  const start = `${safeYear}-${String(safeMonth).padStart(2,"0")}-01`;
  const end = `${safeYear}-${String(safeMonth).padStart(2,"0")}-${String(new Date(safeYear, safeMonth, 0).getDate()).padStart(2,"0")}`;
  return { start, end };
};

export const getPreviousMonthKey = (monthKey = todayStr().slice(0,7)) => {
  const [year, month] = String(monthKey || todayStr().slice(0,7)).split("-").map(Number);
  const ref = new Date((year || new Date().getFullYear()), (month || 1) - 2, 1);
  return `${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,"0")}`;
};
