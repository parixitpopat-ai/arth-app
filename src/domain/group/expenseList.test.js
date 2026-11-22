import test from "node:test";
import assert from "node:assert/strict";
import { buildGroupExpenseList } from "./expenseList.js";
import { buildGroupExpenseMessage } from "./expenseMessage.js";

const nameOf = id => ({ r: "Raj", m: "Mangal", me: "Me" }[id] || id);
const base = { groupId: "g1", memberIds: ["r", "m"], meId: "me", from: "2026-11-01", to: "2026-11-30", nameOf };
const txns = [
  { id: "t1", type: "expense", desc: "Electricity", date: "2026-11-05", amount: 3000, groupId: "g1", people: { r: { amount: 1000, mode: "owes" }, m: { amount: 1000, mode: "owes", settled: true } } },
  { id: "t2", type: "expense", desc: "Party snacks", date: "2026-11-10", amount: 1200, groupId: "g1", groupCollectiveAmount: 1200 },            // tagged to the group, no member split
  { id: "t3", type: "expense", desc: "Other group", date: "2026-11-11", amount: 500, groupId: "g2" },
  { id: "t4", type: "expense", desc: "Old", date: "2026-10-30", amount: 700, groupId: "g1" },
  { id: "t5", type: "expense", desc: "Refund", date: "2026-11-12", amount: 100, groupId: "g1", isRefund: true },
  { id: "t6", type: "expense", desc: "Water bill", date: "2026-11-15", amount: 600, groupId: "g1", isBillPayment: true, paidBillId: "b1", paidBillName: "Water bill", people: { r: { amount: 200, mode: "owes" } } },
  { id: "t7", type: "income", desc: "Salary", date: "2026-11-02", amount: 9, groupId: "g1" },
];
const bills = [
  { id: "b1", name: "Water bill", amount: 600, billDate: "2026-11-14", groupId: "g1", status: "paid", paidByTxnId: "t6" },
  { id: "b2", name: "Internet", amount: 900, billDate: "2026-11-20", groupId: "g1", status: "unpaid", splitPeople: { r: { amount: 300, mode: "owes" }, m: { amount: 300, mode: "owes" } } },
  { id: "b3", name: "Elsewhere", amount: 50, billDate: "2026-11-20", groupId: "g2", status: "unpaid" },
  { id: "b4", name: "Cancelled", amount: 50, billDate: "2026-11-21", groupId: "g1", status: "cancelled" },
];
test("every expense tagged to the group in the period is listed, with or without a member split; others are not", () => {
  const r = buildGroupExpenseList({ ...base, txns, bills });
  assert.deepEqual(r.items.map(i => i.title), ["Electricity", "Party snacks", "November Water bill", "November Internet Bill"]);
  assert.equal(r.totals.count, 4); assert.equal(r.totals.total, 3000 + 1200 + 600 + 900);
});
test("shares: who owes what, what is still open, and the person's own part", () => {
  const e = buildGroupExpenseList({ ...base, txns, bills }).items[0];
  assert.deepEqual(e.shares.map(s => [s.name, s.amount, s.remaining]), [["Raj", 1000, 1000], ["Mangal", 1000, 0]]);
  assert.equal(e.memberTotal, 2000); assert.equal(e.due, 1000); assert.equal(e.yourShare, 1000); assert.equal(e.payer, "you");
});
test("an expense tagged to the group as a whole has no member shares but keeps its group amount", () => {
  const s = buildGroupExpenseList({ ...base, txns, bills }).items[1];
  assert.deepEqual([s.shares.length, s.total, s.groupAmount, s.yourShare], [0, 1200, 1200, null]);
});
test("a paid bill is its payment entry (not listed twice); an unpaid bill is listed from its split; cancelled and other groups are not", () => {
  const r = buildGroupExpenseList({ ...base, txns, bills });
  assert.equal(r.items.filter(i => /Water/.test(i.title)).length, 1);
  const net = r.items.find(i => /Internet/.test(i.title)); assert.deepEqual([net.kind, net.payer, net.due, net.shares.length], ["bill", "not paid yet", 600, 2]);
  assert.equal(r.items.some(i => /Elsewhere|Cancelled|Other group|Refund|Salary|Old/.test(i.title)), false);
});
test("a bill paid outside the period is not re-listed as unpaid, and an empty or strange input gives an empty list", () => {
  const r = buildGroupExpenseList({ ...base, from: "2026-11-18", to: "2026-11-30", txns, bills });
  assert.deepEqual(r.items.map(i => i.title), ["November Internet Bill"]);
  assert.deepEqual(buildGroupExpenseList({ ...base, txns: undefined, bills: undefined }).totals, { count: 0, total: 0, memberTotal: 0, due: 0 });
  assert.doesNotThrow(() => buildGroupExpenseList({ ...base, txns: [null, {}], bills: [undefined] }));
});
test("a person's parts: members their shares, the person using Arth what is left, tagged to a person -> that person, otherwise the group", () => {
  const nm = id => ({ me: "Parixit", r: "Raj", m: "Mangal" }[id] || id);
  const t = [
    { id: "p1", type: "expense", desc: "Lift", date: "2026-07-05", amount: 3000, groupId: "g1", people: { r: { amount: 1000, mode: "owes" }, m: { amount: 1000, mode: "owes" } } },
    { id: "p2", type: "expense", desc: "Building electricity", date: "2026-07-06", amount: 1520, groupId: "g1", forPerson: "me" },
    { id: "p3", type: "expense", desc: "K Auto", date: "2026-07-07", amount: 7899, groupId: "g1", people: { r: { amount: 7899, mode: "owes" } } },
    { id: "p4", type: "expense", desc: "Coffee", date: "2026-07-08", amount: 678, groupId: "g1" },
  ];
  const r = buildGroupExpenseList({ ...base, meId: "me", from: "2026-07-01", to: "2026-07-31", txns: t, bills: [], nameOf: nm });
  const parts = k => r.items.find(i => i.title === k).parts.map(p => [p.name, p.amount]);
  assert.deepEqual(parts("Lift"), [["Raj", 1000], ["Mangal", 1000], ["Parixit", 1000]]);
  assert.deepEqual(parts("Building electricity"), [["Parixit", 1520]]);
  assert.deepEqual(parts("K Auto"), [["Raj", 7899]]);
  assert.deepEqual(r.items.find(i => i.title === "Coffee").parts, [{ personId: null, name: "", amount: 678 }]);
});
test("the message: month by month, one 'Name - expenses' block per person with only their part, Sum, the month total, the PTD total", () => {
  const nm = id => ({ me: "Parixit", r: "Raj" }[id] || id);
  const t = [
    { id: "j1", type: "expense", desc: "July Building Electricity Bill", date: "2026-07-10", amount: 1520, groupId: "g1", forPerson: "me" },
    { id: "j2", type: "expense", desc: "K Auto", date: "2026-07-20", amount: 7899, groupId: "g1", people: { r: { amount: 7899, mode: "owes" } } },
    { id: "a1", type: "expense", desc: "August Building Electricity Bill", date: "2026-08-10", amount: 1480, groupId: "g1", forPerson: "me" },
  ];
  const items = buildGroupExpenseList({ ...base, meId: "me", from: "2026-07-01", to: "2026-08-31", txns: t, bills: [], nameOf: nm }).items.map(i => ({ ...i, on: true }));
  const m = buildGroupExpenseMessage(items, { groupName: "Building", from: "2026-07-01", to: "2026-08-31", upiHandle: "me@upi", meId: "me" });
  assert.equal(m, ["Building · 1 Jul 2026 – 31 Aug 2026", "", "July", "Parixit - expenses", "July Building Electricity Bill - 1520", "Sum - 1520", "", "Raj - expenses", "K Auto - 7899", "Sum - 7899", "", "July total - 9419", "", "August", "Parixit - expenses", "August Building Electricity Bill - 1480", "Sum - 1480", "", "PTD total - 10899", "", "Pay to: me@upi"].join("\n"));
  const mine = buildGroupExpenseMessage(items, { groupName: "Building", from: "2026-07-01", to: "2026-08-31", meId: "me", onlyPersonId: "me" });
  assert.doesNotMatch(mine, /Raj|K Auto/); assert.match(mine, /PTD total - 3000/);
  assert.equal(buildGroupExpenseMessage(items.map(i => ({ ...i, on: false })), {}), "");
  assert.doesNotMatch(buildGroupExpenseMessage(items.filter(i => i.date < "2026-08"), { from: "2026-07-01", to: "2026-07-31", meId: "me" }), /PTD total/);   // one month: no PTD
});

import { categorySplit } from "./expenseList.js";
import { buildCategoryBreakup } from "./categoryBreakup.js";
test("an expense without line items goes whole to its category; with none it is 'no category'", () => {
  assert.deepEqual(categorySplit({ catId: "food" }, 100000), [{ catId: "food", amount: 1000, labels: [] }]);
  assert.deepEqual(categorySplit({}, 50000), [{ catId: null, amount: 500, labels: [] }]);
  assert.deepEqual(categorySplit({ catIds: ["a", "b"] }, 50000), [{ catId: "a", amount: 500, labels: [] }]);
});
test("line items count by their own category and amount; what is left (tax, rounding) goes to the main category; it always adds up", () => {
  const t = { catId: "groc", lineItems: [{ label: "Rice", qty: 2, unitPrice: 100, catId: "groc" }, { label: "Soap", qty: 1, unitPrice: 50, catId: "home" }, { label: "Bag", qty: 1, unitPrice: 20 }] };
  const r = categorySplit(t, 30000);   // total 300: groc 200 + home 50, 50 left -> main (groc)
  assert.deepEqual(r.map(x => [x.catId, x.amount]).sort(), [["groc", 250], ["home", 50]]);
  assert.equal(r.reduce((s, x) => s + x.amount, 0), 300);
});
test("line items that add up to more than the expense are not trusted", () => {
  assert.deepEqual(categorySplit({ catId: "x", lineItems: [{ qty: 1, unitPrice: 500, catId: "y" }] }, 30000).map(c => [c.catId, c.amount]), [["x", 300]]);
});
test("the break-up adds the ticked items by category, biggest first, no-category last, with shares and the entries behind each", () => {
  const cats = [{ id: "food", name: "Food", icon: "🍔" }, { id: "util", name: "Utilities", icon: "💡" }];
  const items = [
    { key: "a", title: "Electricity", date: "2026-11-05", categories: [{ catId: "util", amount: 3000, labels: [] }] },
    { key: "b", title: "Party", date: "2026-11-10", categories: [{ catId: "food", amount: 700, labels: ["Cake"] }, { catId: null, amount: 100, labels: [] }] },
    { key: "c", title: "Dinner", date: "2026-11-12", categories: [{ catId: "food", amount: 200, labels: [] }] },
  ];
  const b = buildCategoryBreakup(items, cats);
  assert.deepEqual(b.rows.map(r => [r.name, r.amount, r.pct]), [["Utilities", 3000, 75], ["Food", 900, 22.5], ["No category", 100, 2.5]]);
  assert.equal(b.total, 4000); assert.deepEqual(b.rows[1].entries.map(e => e.title), ["Party", "Dinner"]); assert.deepEqual(b.rows[1].entries[0].labels, ["Cake"]);
  assert.deepEqual(buildCategoryBreakup([], cats), { rows: [], total: 0 });
  assert.equal(buildCategoryBreakup([{ key: "z", title: "x", date: "2026-11-01", categories: [{ catId: "gone", amount: 5 }] }], cats).rows[0].name, "Other category");
});
test("the message adds a By category section with the shares", () => {
  const items = buildGroupExpenseList({ ...base, txns: [{ id: "q", type: "expense", desc: "Lunch", date: "2026-11-05", amount: 400, groupId: "g1", catId: "food" }], bills: [] }).items.map(i => ({ ...i, on: true }));
  const m = buildGroupExpenseMessage(items, { groupName: "Flat", from: base.from, to: base.to, breakup: buildCategoryBreakup(items, [{ id: "food", name: "Food" }]) });
  assert.match(m, /Sum - 400\n\nBy category:\nFood - 400 \(100%\)/);
});

test("one statement for the group and its people: member-tagged expenses join in at what the members bear, whether tagged to the group, to nobody or to ANOTHER group (a common meter); non-members' are left out", () => {
  const t = [
    { id: "g1", type: "expense", desc: "Common meter bill", date: "2026-11-05", amount: 900, groupId: "g1", people: { r: { amount: 300, mode: "owes" } } },
    { id: "p1", type: "expense", desc: "K Auto", date: "2026-11-06", amount: 7899, people: { r: { amount: 7899, mode: "owes" } } },
    { id: "p2", type: "expense", desc: "Lunch split", date: "2026-11-07", amount: 1000, people: { r: { amount: 250, mode: "owes" }, zed: { amount: 250, mode: "owes" } } },   // zed is not a member: only Raj's 250 counts
    { id: "p3", type: "expense", desc: "Tagged to Mangal", date: "2026-11-08", amount: 400, forPerson: "m" },
    { id: "p4", type: "expense", desc: "Other group", date: "2026-11-09", amount: 500, groupId: "g2", people: { r: { amount: 500, mode: "owes" } } },   // another group: Raj still bears it
    { id: "p5", type: "expense", desc: "Not a member", date: "2026-11-10", amount: 600, people: { zed: { amount: 600, mode: "owes" } } },
    { id: "p6", type: "expense", desc: "Nobody", date: "2026-11-11", amount: 100 },
  ];
  const b = [{ id: "bb", name: "Gas", billDate: "2026-11-12", amount: 800, status: "unpaid", splitPeople: { m: { amount: 400, mode: "owes" } } }];
  const off = buildGroupExpenseList({ ...base, txns: t, bills: b });
  assert.deepEqual(off.items.map(i => i.title), ["Common meter bill"]);                                   // default: the group's own only
  const gn = id => ({ g2: "Common Meter" }[id] || "");
  const on = buildGroupExpenseList({ ...base, includePeople: true, groupNameOf: gn, txns: t, bills: b });
  assert.deepEqual(on.items.map(i => [i.title, i.scope, i.total]), [["Common meter bill", "group", 900], ["K Auto", "people", 7899], ["Lunch split", "people", 250], ["Tagged to Mangal", "people", 400], ["Other group", "people", 500], ["November Gas Bill", "people", 400]]);
  assert.equal(on.items[4].fromGroup, "Common Meter"); assert.equal(on.items[1].fromGroup, "");
  assert.equal(on.items[2].parts.length, 1); assert.equal(on.items[2].parts[0].name, "Raj");
  assert.equal(on.totals.total, 900 + 7899 + 250 + 400 + 500 + 400);
});
test("a bill payment that carries a member's share is counted once, from the payment", () => {
  const t = [{ id: "pay", type: "expense", desc: "Gas", date: "2026-11-12", amount: 800, paidBillId: "bb", people: { m: { amount: 400, mode: "owes" } } }];
  const b = [{ id: "bb", name: "Gas", billDate: "2026-11-12", amount: 800, status: "paid", paidByTxnId: "pay", splitPeople: { m: { amount: 400, mode: "owes" } } }];
  assert.equal(buildGroupExpenseList({ ...base, includePeople: true, txns: t, bills: b }).items.length, 1);
});

test("a group the person is NOT part of (meId null): items count at the family's part, no part for the person, categories follow, the whole cost is kept", () => {
  const t = [
    { id: "e", type: "expense", desc: "Electricity", date: "2026-11-05", amount: 12000, groupId: "g1", catId: "util", people: { r: { amount: 3000, mode: "owes" }, m: { amount: 3000, mode: "owes" } } },
    { id: "c", type: "expense", desc: "Coffee", date: "2026-11-06", amount: 678, groupId: "g1", catId: "food" },                                // tagged to the group as a whole: all of it is for them
  ];
  const r = buildGroupExpenseList({ ...base, meId: null, txns: t, bills: [] });
  const e = r.items[0]; assert.deepEqual([e.total, e.wholeTotal], [6000, 12000]); assert.deepEqual(e.parts.map(p => p.name), ["Raj", "Mangal"]);
  assert.deepEqual(e.categories.map(c => [c.catId, c.amount]), [["util", 6000]]);
  const c = r.items[1]; assert.deepEqual([c.total, c.parts.length, c.parts[0].personId], [678, 1, null]);
  assert.equal(r.totals.total, 6678);
  const m = buildGroupExpenseMessage(r.items.map(i => ({ ...i, on: true })), { groupName: "Neighbours", from: "2026-11-01", to: "2026-11-30" });
  assert.doesNotMatch(m, /You|Me /); assert.match(m, /Neighbours - expenses\nCoffee - 678/);
});

test("a line is 'Vendor - Item' (Amazon - Coffee); one of them alone when only one is known or one already says the other", () => {
  const t = [
    { id: "v1", type: "expense", desc: "Coffee", merchant: "Amazon", date: "2026-11-06", amount: 678, groupId: "g1" },
    { id: "v2", type: "expense", desc: "Gate fix", date: "2026-11-07", amount: 150, groupId: "g1" },
    { id: "v3", type: "expense", desc: "x", merchant: "  ", date: "2026-11-08", amount: 10, groupId: "g1" },
    { id: "v4", type: "expense", desc: "Amazon order", merchant: "Amazon", date: "2026-11-09", amount: 10, groupId: "g1" },
    { id: "v5", type: "expense", desc: "Swiggy", merchant: "Swiggy", date: "2026-11-10", amount: 10, groupId: "g1" },
    { id: "v6", type: "expense", desc: "", merchant: "K Auto", date: "2026-11-11", amount: 10, groupId: "g1" },
  ];
  assert.deepEqual(buildGroupExpenseList({ ...base, meId: null, txns: t, bills: [] }).items.map(i => i.title), ["Amazon - Coffee", "Gate fix", "x", "Amazon order", "Swiggy", "K Auto"]);
});
test("showNames false: one plain list per month, no names, no headings, then the Sum and the PTD total", () => {
  const nm = id => ({ r: "Raj", m: "Mangal" }[id] || id);
  const t = [
    { id: "a", type: "expense", desc: "Electricity", date: "2026-07-04", amount: 12000, groupId: "g1", people: { r: { amount: 3000, mode: "owes" }, m: { amount: 3000, mode: "owes" } } },
    { id: "b", type: "expense", desc: "Coffee", merchant: "Amazon", date: "2026-07-22", amount: 678, groupId: "g1" },
    { id: "c", type: "expense", desc: "Water", date: "2026-08-05", amount: 1000, groupId: "g1", people: { r: { amount: 500, mode: "owes" }, m: { amount: 500, mode: "owes" } } },
  ];
  const items = buildGroupExpenseList({ ...base, meId: null, from: "2026-07-01", to: "2026-08-31", txns: t, bills: [], nameOf: nm }).items.map(i => ({ ...i, on: true }));
  const m = buildGroupExpenseMessage(items, { groupName: "Neighbours", from: "2026-07-01", to: "2026-08-31", showNames: false, upiHandle: "me@upi" });
  assert.equal(m, ["Neighbours · 1 Jul 2026 – 31 Aug 2026", "", "July", "Electricity - 6000", "Amazon - Coffee - 678", "Sum - 6678", "", "August", "Water - 1000", "Sum - 1000", "", "PTD total - 7678", "", "Pay to: me@upi"].join("\n"));
  assert.doesNotMatch(m, /Raj|Mangal|expenses\n/);
});

test("a family the person is not part of: a bill that is entirely theirs reads (Group name); a bill they only share keeps its meter; with several meters or none", () => {
  const owes = a => ({ amount: a, mode: "owes" });
  const ba = [{ id: "ba1", name: "Common Meter", type: "Electricity" }, { id: "ba2", name: "Raj flat", type: "Electricity" }];
  const bills2 = [
    { id: "b1", name: "Goa Electricity", billDate: "2026-11-02", billerAccountId: "ba1", amount: 9000, status: "paid", paidByTxnId: "t1" },
    { id: "b2", name: "Goa Electricity", billDate: "2026-11-03", billerAccountId: "ba2", amount: 2400, status: "paid", paidByTxnId: "t2" },
    { id: "b3", name: "Goa Electricity", billDate: "2026-11-04", billerAccountId: "ba2", amount: 700, status: "unpaid", groupId: "g1" },   // unpaid, tagged to the group, no split: theirs
  ];
  const t = [
    { id: "t1", type: "expense", desc: "x", date: "2026-11-05", amount: 9000, groupId: "g1", paidBillId: "b1", people: { r: owes(3000), m: owes(3000) } },   // they bear 6000 of 9000: shared
    { id: "t2", type: "expense", desc: "x", date: "2026-11-06", amount: 2400, paidBillId: "b2", people: { r: owes(2400) } },                                 // all theirs, tagged to Raj
  ];
  const titles = (o) => buildGroupExpenseList({ ...base, meId: null, includePeople: true, groupName: "Suryamandal", txns: t, bills: bills2, billerAccounts: ba, ...o }).items.map(i => i.title);
  // by date: the unpaid group bill (4th), the shared payment (5th), Raj's own (6th)
  assert.deepEqual(titles({}), ["November Goa Electricity Bill (Suryamandal)", "November Goa Electricity Bill (Common Meter)", "November Goa Electricity Bill (Suryamandal)"]);
  assert.deepEqual(titles({ billerAccounts: [] }), ["November Goa Electricity Bill (Suryamandal)", "November Goa Electricity Bill", "November Goa Electricity Bill (Suryamandal)"]);   // no meter nickname: the shared one stays plain
  assert.equal(buildGroupExpenseList({ ...base, meId: "me", includePeople: true, groupName: "Suryamandal", txns: t, bills: bills2, billerAccounts: ba }).items.some(i => /Suryamandal/.test(i.title)), false);   // my own flat: never
});

test("the layout asked for: month by month, 'Common Meter water Bill - 800', 'Person B - Vendor - 800' (a vendor expense of one person), a bill with no person name, 'Amazon - Coffee - 331'", () => {
  const nm = id => ({ b: "Person B", s: "Sachin Masa" }[id] || id);
  const owes = a => ({ amount: a, mode: "owes" });
  const ba = [{ id: "cm", name: "Common Meter", type: "Water" }, { id: "own", name: "Flat", type: "Water" }];
  const bills3 = [{ id: "w1", name: "Public Works Department (Goa)", billDate: "2026-07-10", billerAccountId: "cm", amount: 2400, status: "paid", paidByTxnId: "t1" }];
  const t = [
    { id: "t1", type: "expense", desc: "Public Works Department (Goa)", date: "2026-07-11", amount: 2400, groupId: "commonMeter", paidBillId: "w1", isBillPayment: true, people: { s: owes(800), q: owes(800) } },   // a common meter bill, Sachin bears 800 of it
    { id: "t2", type: "expense", desc: "Plumber", merchant: "Urban Co", date: "2026-07-14", amount: 800, people: { b: owes(800) } },                                          // Person B's own vendor expense
    { id: "t3", type: "expense", desc: "Coffee", merchant: "Amazon", date: "2026-07-20", amount: 331, groupId: "fam" },                                                       // tagged to the family
    { id: "t4", type: "expense", desc: "Water bill", date: "2026-08-03", amount: 500, groupId: "fam" },
  ];
  const items = buildGroupExpenseList({ groupId: "fam", groupName: "Suryamandal", memberIds: ["s", "b"], meId: null, includePeople: true, groupNameOf: id => ({ commonMeter: "Common Meter" }[id] || ""), txns: t, bills: bills3, billerAccounts: ba, from: "2026-07-01", to: "2026-08-31", nameOf: nm }).items.map(i => ({ ...i, on: true }));
  const m = buildGroupExpenseMessage(items, { groupName: "Suryamandal", from: "2026-07-01", to: "2026-08-31", showNames: false });
  assert.equal(m, ["Suryamandal · 1 Jul 2026 – 31 Aug 2026", "", "July", "July Public Works Department (Goa) Bill (Common Meter) - 800", "Person B - Urban Co - Plumber - 800", "Amazon - Coffee - 331", "Sum - 1931", "", "August", "Water bill - 500", "Sum - 500", "", "PTD total - 2431"].join("\n"));
  assert.doesNotMatch(m, /Sachin/);   // a bill's share is not named after the person
});
