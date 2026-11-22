// domain/group/categoryBreakup.js — a group's expenses added up by category: one row per category with its total, its share, and the entries behind it. Pure.
// Input: the items from buildGroupExpenseList (each carries `categories`), already filtered to what is ticked. Output rows are biggest first; "no category" is last.

/** @param {Array} items  @param {Array<{id:string,name:string,icon?:string}>} cats
 *  @returns {{rows:Array<{catId:string|null,name:string,icon:string,amount:number,pct:number,entries:Array<{key:string,title:string,date:string,amount:number,labels:string[]}>}>,total:number}} */
export function buildCategoryBreakup(items, cats = []) {
  const P = n => Math.round((Number(n) || 0) * 100);
  const by = new Map();
  for (const it of items || []) for (const c of it.categories || []) {
    const k = c.catId || "__none__";
    const row = by.get(k) || { catId: c.catId || null, paise: 0, entries: [] };
    row.paise += P(c.amount); row.entries.push({ key: it.key, title: it.title, date: it.date, amount: c.amount, labels: c.labels || [] }); by.set(k, row);
  }
  const total = [...by.values()].reduce((s, r) => s + r.paise, 0);
  const rows = [...by.values()].map(r => {
    const cat = (cats || []).find(x => String(x.id) === String(r.catId));
    return { catId: r.catId, name: r.catId ? (cat ? cat.name : "Other category") : "No category", icon: r.catId ? (cat && cat.icon) || "🏷️" : "❔", amount: r.paise / 100,
      pct: total > 0 ? Math.round((r.paise / total) * 1000) / 10 : 0, entries: r.entries.sort((a, b) => a.date.localeCompare(b.date)) };
  }).sort((a, b) => (a.catId === null) - (b.catId === null) || b.amount - a.amount);
  return { rows, total: total / 100 };
}
