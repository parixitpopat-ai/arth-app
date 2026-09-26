// domain/person/capabilityTiles.js
//
// UI-2C P-4 — one short summary line per switched-on person capability,
// in the stored module order, with the D-15 labels. It reads figures the
// caller already computed (settlements, spend, loans, gifts, reminders)
// and never computes money itself. Reminders show dates only (D-9).

export function getPersonCapabilityTiles({ modules, moduleDefs, balance, spent, spendBudget, giftCount, loanOutstanding, notes, reminders, sym, fmt }) {
  const on = new Set(modules || []);
  const money = n => `${sym}${fmt(Number(n || 0))}`;
  const sub = {
    budget: Number(spendBudget) > 0 ? `${money(spent)} of ${money(spendBudget)}` : "No monthly amount set",
    sharedExpenses: (() => {
      const owesMe = Number(balance?.owesMe || 0), iOwe = Number(balance?.iOwe || 0);
      const net = owesMe - iOwe;
      if (net > 0) return `Owes you ${money(net)}`;
      if (net < 0) return `You owe ${money(-net)}`;
      return "All settled";
    })(),
    borrowMoney: Number(loanOutstanding) > 0 ? `${money(loanOutstanding)} outstanding` : "No money lent",
    gifts: giftCount > 0 ? `${giftCount} gift${giftCount === 1 ? "" : "s"}` : "No gifts yet",
    notes: String(notes || "").trim() ? String(notes).trim().split("\n")[0].slice(0, 40) : "No notes yet",
    reminders: reminders && reminders.length ? reminders[0].text : "No dates set",
  };
  return (moduleDefs || [])
    .filter(m => on.has(m.id))
    .map(m => ({ id: m.id, label: m.label, sub: sub[m.id] ?? "" }));
}
