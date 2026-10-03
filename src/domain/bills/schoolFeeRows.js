// domain/bills/schoolFeeRows.js
//
// Payments v2 C1 - "All bills" shows a school's fee periods as ONE row per school (and child) once there
// are two or more of them, instead of one near-identical row per month. Presentation grouping only: it
// builds no obligation, changes no amount and no due date, and a lone fee period stays as its own row.
// Everything else in the renewals list (subscriptions, memberships) passes through untouched.
//
// The grouped row's total is the sum of the periods' outstanding amounts; it is "overdue" if any period
// is, and then its day count is the OLDEST overdue period (the one that has waited longest); otherwise
// it counts to the soonest upcoming period. `rows` keeps the originals, `rows[0]` being the most urgent,
// which is what tapping the row opens - the same destination a single fee row has today.

export function groupSchoolRenewals(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const buckets = new Map();
  for (const r of list) {
    if (r && r.sourceType === "school") {
      const key = `${r.billerAccountId}|${r.forText || ""}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(r);
    }
  }
  const out = [];
  const done = new Set();
  for (const r of list) {
    if (!r) continue;
    if (r.sourceType !== "school") { out.push(r); continue; }
    const key = `${r.billerAccountId}|${r.forText || ""}`;
    const members = buckets.get(key);
    if (members.length < 2) { out.push(r); continue; }
    if (done.has(key)) continue;
    done.add(key);
    const overdue = members.filter(m => m.kind === "overdue");
    const urgent = overdue.length
      ? [...overdue].sort((a, b) => b.days - a.days)
      : [...members].sort((a, b) => a.days - b.days);
    out.push({
      id: `school-group:${r.billerAccountId}:${r.forText || ""}`,
      grouped: true,
      sourceType: "school",
      billerAccountId: r.billerAccountId,
      name: `${r.schoolName || "School fees"} · ${members.length} fee periods`,
      forText: r.forText || "",
      amount: Math.round(members.reduce((s, m) => s + Number(m.amount || 0), 0) * 100) / 100,
      kind: overdue.length ? "overdue" : "renewing",
      days: urgent[0].days,
      count: members.length,
      overdueCount: overdue.length,
      rows: urgent,
    });
  }
  return out;
}
