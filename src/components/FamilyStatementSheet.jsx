// A family's (a group's) statement: one total to ask for, who owes what, and each member's own statement underneath. Reads only; never changes a record.
// Everything comes from domain/person/personStatement.js (buildFamilyStatement); the message from statementMessage.js (buildFamilyMessage).
import { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import StatementPreview from "./StatementPreview";
import { buildFamilyStatement } from "../domain/person/personStatement";
import StatementSelection from "./StatementSelection";
import { buildFamilyMessage, shortDate, familyLines, buildSimpleMessage } from "../domain/person/statementMessage";
import { buildGroupExpenseList, unpaidOnly, notItemised } from "../domain/group/expenseList";
import { buildGroupExpenseMessage } from "../domain/group/expenseMessage";
import { buildCategoryBreakup } from "../domain/group/categoryBreakup";

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function presets(todayIso, earliest = "2000-01-01") {
  const [y, m] = [+todayIso.slice(0, 4), +todayIso.slice(5, 7) - 1];
  const fyY = m >= 3 ? y : y - 1;
  return { month: { label: "This month", from: iso(new Date(y, m, 1)), to: todayIso }, last: { label: "Last month", from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    fy: { label: "This financial year", from: `${fyY}-04-01`, to: todayIso }, all: { label: "Everything", from: earliest, to: todayIso } };
}

export default function FamilyStatementSheet({ T, sym = "₹", fmt = n => Number(n).toFixed(2), group, people = [], txns = [], bills = [], billerAccounts = [], groups = [], cats = [], upiHandle = "", meId, startAll = false, cardParts = null, onClose }) {
  const today = useMemo(() => iso(new Date()), []);
  // "Everything" starts at the first entry that concerns this group or its people, not at a made-up year
  const earliest = useMemo(() => {
    const ids = new Set((group.members || []).map(String)); const gid = String(group.id);
    const hit = x => String(x.groupId) === gid || (x.groupAllocations || []).some(a => String(a.groupId) === gid) || Object.keys({ ...(x.splitPeople || {}), ...(x.people || {}) }).some(k => ids.has(k)) || (x.forPerson != null && ids.has(String(x.forPerson)));
    let m = "";
    for (const x of [...txns, ...bills]) { if (!x || !hit(x)) continue; const d = String(x.date || x.billDate || x.createdDate || x.dueDate || "").slice(0, 10); if (d.length === 10 && (!m || d < m)) m = d; }
    return m || `${today.slice(0, 4)}-01-01`;
  }, [group.id, group.members, txns, bills, today]);
  const P = useMemo(() => presets(today, earliest), [today, earliest]);
  const [preset, setPreset] = useState(startAll ? "all" : "fy");   // startAll: opened from "Everything owed to me", all time
  const [from, setFrom] = useState(startAll ? P.all.from : P.fy.from), [to, setTo] = useState(startAll ? P.all.to : P.fy.to);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState(() => startAll ? "expenses" : (buildGroupExpenseList({ groupId: group.id, memberIds: (group.members || []).filter(id => String(id) !== String(meId) && id !== "__me__"), includePeople: true, txns, bills, from: presets(iso(new Date())).fy.from, to: iso(new Date()) }).totals.count > 0 ? "expenses" : "simple"));   // a group with expenses tagged to it opens on them
  const [exOff, setExOff] = useState({});
  const [withPeople, setWithPeople] = useState(true);       // one statement: the group's expenses AND the expenses tagged to its people
  const [showNames, setShowNames] = useState(group.includeMe !== false && meId != null);   // names as headings: on for my own flat, off for a family I send it to
  const [allView, setAllView] = useState(startAll);   // "All": everything owed by the group and each member in one list, with what no entry explains added as its own lines, so it reaches the card total
  const [onlyUnpaid, setOnlyUnpaid] = useState(true);   // only what is still owed: settled items drop out, part-paid ones are cut to what is left
  const [onlyMine, setOnlyMine] = useState(false);          // the message carries only the person using Arth's own parts
  const [withBreakup, setWithBreakup] = useState(true);   // the category break-up goes in the message too                // itemised expenses the person un-ticked            // "simple": Member: Item - amount lines you tick, then a total | "full": the family statement
  const [overrides, setOverrides] = useState({});
  const nameOf = id => (people.find(p => String(p.id) === String(id)) || {}).name || "someone";
  const labelOf = c => { const ba = billerAccounts.find(b => String(b.id) === String(c.billerAccountId)); return (ba && ba.type) || (c.billId ? "Bills" : "Own expenses"); };
  const inGroup = group.includeMe !== false && meId != null;   // false: a neighbour's family. The statement is theirs; there is no "my part"
  const memberIds = useMemo(() => (group.members || []).filter(id => String(id) !== String(meId) && id !== "__me__"), [group.members, meId]);
  const money = n => `${sym}${fmt(Math.abs(n))}`;
  const fam = useMemo(() => (from && to && from <= to && memberIds.length ? buildFamilyStatement({ memberIds, groupId: group.id, txns, bills, billerAccounts, from, to, nameOf, labelOf }) : null), [memberIds, group.id, txns, bills, from, to, people, billerAccounts]);   // eslint-disable-line react-hooks/exhaustive-deps
  const lines = useMemo(() => (fam ? familyLines(fam, nameOf) : []), [fam]);   // eslint-disable-line react-hooks/exhaustive-deps
  const isOn = l => (l.key in overrides ? overrides[l.key] : l.ticked);
  const simpleMessage = buildSimpleMessage(lines.map(l => ({ ...l, on: isOn(l) })), { upiHandle, withNames: true });
  const exAll = useMemo(() => (from && to && from <= to ? buildGroupExpenseList({ groupId: group.id, groupName: group.name, groupNameOf: gid => (groups.find(x => String(x.id) === String(gid)) || {}).name || "", memberIds, meId: inGroup ? meId : null, includePeople: withPeople, txns, bills, billerAccounts, from, to, nameOf }) : null), [memberIds, group.id, txns, bills, billerAccounts, from, to, people, withPeople]);   // eslint-disable-line react-hooks/exhaustive-deps
  const cardBalance = cardParts ? Math.round((Object.values(cardParts.byPerson || {}).reduce((a, v) => a + Number(v || 0), 0) + Number(cardParts.group || 0)) * 100) / 100 : null;
  const ex = useMemo(() => {
    if (!exAll || !onlyUnpaid) return exAll;
    const R = n => Math.round(n * 100) / 100;
    let items = unpaidOnly(exAll.items);
    const gaps = allView && cardParts ? notItemised(items, cardParts, { nameOf, date: to }) : [];
    items = [...items, ...gaps];
    return { items, gapTotal: R(gaps.reduce((a, i) => a + i.total, 0)), totals: { count: items.length, total: R(items.reduce((a, i) => a + i.total, 0)), memberTotal: R(items.reduce((a, i) => a + (i.memberTotal || 0), 0)), due: R(items.reduce((a, i) => a + i.total, 0)) } };
  }, [exAll, onlyUnpaid, allView, cardParts, to]);   // eslint-disable-line react-hooks/exhaustive-deps
  const exItems = ex ? ex.items.map(i => ({ ...i, on: !exOff[i.key] })) : [];
  const breakup = useMemo(() => {   // only my part: each expense counts at my share of it, spread over its categories in the same proportion
    const on = exItems.filter(i => i.on);
    if (!onlyMine) return buildCategoryBreakup(on, cats);
    return buildCategoryBreakup(on.map(i => { const mine = (i.parts || []).filter(pt => pt.personId != null && String(pt.personId) === String(meId)).reduce((s, pt) => s + pt.amount, 0); if (!(mine > 0) || !(i.total > 0)) return null; const r = mine / i.total; return { ...i, categories: i.categories.map(c => ({ ...c, amount: Math.round(c.amount * r * 100) / 100 })) }; }).filter(Boolean), cats);
  }, [ex, exOff, cats, onlyMine]);   // eslint-disable-line react-hooks/exhaustive-deps
  const exMessage = ex ? buildGroupExpenseMessage(exItems, { onlyUnpaid, groupName: group.name, from, to, upiHandle, meId: inGroup ? meId : null, onlyPersonId: inGroup && onlyMine && showNames ? meId : null, showNames, breakup: withBreakup ? breakup : null }) : "";
  const message = mode === "expenses" ? exMessage : !fam ? "" : mode === "simple" ? simpleMessage : buildFamilyMessage(fam, { groupName: group.name, nameOf, sym, fmt, upiHandle });
  const owed = fam ? fam.closing : 0;
  const choose = id => { setPreset(id); setFrom(P[id].from); setTo(P[id].to); setStatus(""); setOverrides({}); setExOff({}); };
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: `Statement for the ${group.name} family`, text: message }); setStatus(""); }
      else { await navigator.clipboard.writeText(message); setStatus("Copied. Paste it into a message."); }
    } catch (e) { if (!e || e.name !== "AbortError") setStatus("Could not share. Use Copy instead."); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(message); setStatus("Copied. Paste it into a message."); } catch (e) { setStatus("Could not copy. Select the message and copy it."); } };
  const sub = { color: T.sub, fontSize: 11 }, line = { display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0" };
  const chip = on => ({ border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent + "22" : "none", color: on ? T.accent : T.sub, borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter,sans-serif" });
  const inp = { minWidth: 0, boxSizing: "border-box", background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, padding: "9px 10px", fontSize: 13, fontFamily: "Inter,sans-serif", width: "100%" };
  const active = fam ? fam.members.filter(m => m.sections.length || m.payments.length || Math.abs(m.opening) > 0.004) : [];

  const shareBlock = (<>
        <div style={{ ...sub, marginTop: 12 }}>Message that will be shared</div>
          {!message && <div data-testid="fam-none-ticked" style={{ color: T.warn, fontSize: 13, margin: "4px 0 10px" }}>Tick at least one item to send.</div>}
          {message && <pre data-testid="fam-message" style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, color: T.text, fontSize: 12, whiteSpace: "pre-wrap", margin: "4px 0 10px", fontFamily: "inherit" }}>{message}</pre>}
          {!upiHandle && <div style={{ ...sub, marginBottom: 8 }}>No UPI handle is saved, so the message has no "Pay to" line.</div>}
          {message && <div style={{ display: "flex", gap: 8 }}>
            <button type="button" data-testid="fam-share" onClick={share} style={{ flex: 1, background: T.accent, color: T.accentInk, border: "none", borderRadius: 12, padding: "12px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>{mode === "expenses" ? "Share these expenses" : owed > 0.004 ? `Request ${money(owed)} from the family` : "Share"}</button>
            <button type="button" data-testid="fam-copy" onClick={copy} style={{ background: "none", color: T.text, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Copy</button>
          </div>}
          {status && <div data-testid="fam-status" style={{ ...sub, marginTop: 8 }}>{status}</div>}
  </>);

  return (
    <BottomSheet onClose={onClose} T={T} maxHeight="92vh">
      <div data-testid="family-statement-sheet">
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900 }}>Statement · {group.name}</div>
        <div style={{ ...sub, marginBottom: 10 }}>{mode === "expenses" ? "Every expense and bill tagged to this group, with who paid and each member's share. Nothing is changed." : "The whole family in one: each member's shares and the repayments you recorded. Nothing is changed."}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.entries(P).map(([id, p]) => <button key={id} type="button" data-testid={`fam-preset-${id}`} style={chip(preset === id)} onClick={() => choose(id)}>{p.label}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <label style={{ flex: 1, minWidth: 0 }}><span style={sub}>From</span><input data-testid="fam-from" type="date" style={inp} value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPreset("custom"); setStatus(""); setOverrides({}); }} /></label>
          <label style={{ flex: 1, minWidth: 0 }}><span style={sub}>Until</span><input data-testid="fam-to" type="date" style={inp} value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPreset("custom"); setStatus(""); setOverrides({}); }} /></label>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          <button type="button" data-testid="fam-mode-expenses" style={chip(mode === "expenses" && !allView)} onClick={() => { setMode("expenses"); setAllView(false); setStatus(""); }}>Group expenses</button>
          {cardParts && <button type="button" data-testid="fam-mode-all" style={chip(mode === "expenses" && allView)} onClick={() => { setMode("expenses"); setAllView(true); setPreset("all"); setFrom(P.all.from); setTo(P.all.to); setOnlyUnpaid(true); setWithPeople(true); setExOff({}); setStatus(""); }}>All</button>}
          <button type="button" data-testid="fam-mode-simple" style={chip(mode === "simple")} onClick={() => { setMode("simple"); setStatus(""); }}>Members, simple</button>
          <button type="button" data-testid="fam-mode-full" style={chip(mode === "full")} onClick={() => { setMode("full"); setStatus(""); }}>Full statement</button>
        </div>
        {fam && mode === "simple" && <StatementSelection T={T} sym={sym} fmt={fmt} lines={lines} isOn={isOn} withNames testPrefix="famsel" onToggle={(l, on) => setOverrides(o => ({ ...o, [l.key]: on }))}
          onAll={() => setOverrides(Object.fromEntries(lines.map(l => [l.key, true])))} onNone={() => setOverrides(Object.fromEntries(lines.map(l => [l.key, false])))} />}
        {mode === "expenses" && <div data-testid="fam-expenses">
          {!ex ? <div data-testid="fam-bad-range" style={{ color: T.warn, fontSize: 13 }}>Choose a start date that is not after the end date.</div>
            : !ex.items.length ? <div data-testid="fam-exp-empty" style={{ ...sub, padding: "8px 0" }}>{onlyUnpaid ? "Nothing is unpaid for " + group.name + " in this period." : <>No expense for {group.name}{withPeople ? " or its people" : ""} in this period.</>}{onlyUnpaid && <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}><input data-testid="fam-only-unpaid-off" type="checkbox" checked onChange={() => setOnlyUnpaid(false)} />Only what is still unpaid</label>}</div> : <>
            <div data-testid="fam-exp-summary" style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <div style={line}><span style={{ color: T.text, fontSize: 13 }}>{ex.totals.count} expense{ex.totals.count === 1 ? "" : "s"}{withPeople ? ` for ${group.name} and its people` : ` tagged to ${group.name}`}</span><span data-testid="fam-exp-total" style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{money(ex.totals.total)}</span></div>
              {cardBalance != null && onlyUnpaid && allView && (() => {
                const gap = Math.round((cardBalance - ex.totals.total) * 100) / 100;
                return <>
                  <div style={line}><span style={{ color: T.text, fontSize: 13 }}>Total of the entries listed</span><span data-testid="fam-owed-entries" style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{money(ex.totals.total)}</span></div>
                  <div style={line}><span style={{ color: T.text, fontSize: 13 }}>Balance on your cards (owes you + group owes)</span><span data-testid="fam-owed-card" style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{money(cardBalance)}</span></div>
                  {ex.gapTotal > 0.004 && <div data-testid="fam-owed-notitemised" style={{ ...sub, fontSize: 11 }}>{money(ex.gapTotal)} of this has no entry to list: your cards say it is owed, but no expense, tag or bill adds up to it. It is shown as "Other balance" lines so you can check it.</div>}
                  {Math.abs(gap) >= 0.5 && <div data-testid="fam-owed-gap" style={{ ...sub, fontSize: 11 }}>{gap > 0 ? `${money(gap)} on your cards is not in this list.` : `${money(gap)} more is listed than your cards show: paybacks or petty cash are netted off the cards, and they are not single entries.`}</div>}
                </>;
              })()}
              {ex.totals.due > 0.004 && <div style={line}><span style={{ color: T.text, fontSize: 13 }}>Still to be paid by members</span><span data-testid="fam-exp-due" style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{money(ex.totals.due)}</span></div>}
            </div>
            {breakup.rows.length > 0 && <div data-testid="fam-breakup" style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 6 }}>By category</div>
              {breakup.rows.map(r => (
                <details key={String(r.catId)} data-testid="fam-cat-row" style={{ borderTop: `1px solid ${T.border}` }}>
                  <summary style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer", listStyle: "none" }}>
                    <span style={{ fontSize: 15 }}>{r.icon}</span>
                    <span style={{ flex: 1, minWidth: 0, color: T.text, fontSize: 13, fontWeight: 700 }}>{r.name}<span style={{ color: T.sub, fontWeight: 500 }}> · {r.pct}%</span></span>
                    <span style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{money(r.amount)}</span>
                  </summary>
                  {r.entries.map((e, k) => <div key={e.key + k} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0 3px 23px", ...sub }}><span style={{ minWidth: 0 }}>{shortDate(e.date)} · {e.title}{e.labels.length ? ` (${e.labels.join(", ")})` : ""}</span><span style={{ whiteSpace: "nowrap" }}>{money(e.amount)}</span></div>)}
                </details>
              ))}
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, ...sub }}><input data-testid="fam-breakup-in-message" type="checkbox" checked={withBreakup} onChange={e => setWithBreakup(e.target.checked)} />Put this break-up in the message</label>
            </div>}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, ...sub }}><input data-testid="fam-only-unpaid" type="checkbox" checked={onlyUnpaid} onChange={e => { setOnlyUnpaid(e.target.checked); setExOff({}); }} />Only what is still unpaid (settled entries are left out)</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, ...sub }}><input data-testid="fam-with-people" type="checkbox" checked={withPeople} onChange={e => { setWithPeople(e.target.checked); setExOff({}); }} />Also include what {group.name}'s people bear in expenses tagged to them or to another group (such as a common meter), at what they bear</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, ...sub }}><input data-testid="fam-show-names" type="checkbox" checked={showNames} onChange={e => setShowNames(e.target.checked)} />Put each person's name as a heading in the message</label>
            {inGroup && showNames && <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={sub}>Message shows</span>
              {inGroup && <button type="button" data-testid="fam-who-all" style={chip(!onlyMine)} onClick={() => setOnlyMine(false)}>Everyone's parts</button>}
              {inGroup && <button type="button" data-testid="fam-who-me" style={chip(onlyMine)} onClick={() => setOnlyMine(true)}>Only my part</button>}
            </div>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={sub}>Tick what to send</span>
              <span style={{ display: "flex", gap: 12 }}><button type="button" data-testid="fam-exp-all" style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }} onClick={() => setExOff({})}>All</button><button type="button" data-testid="fam-exp-none" style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }} onClick={() => setExOff(Object.fromEntries(ex.items.map(i => [i.key, true])))}>None</button></span>
            </div>
            {ex.items.map(i => (
              <label key={i.key} data-testid="fam-exp-line" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                <input data-testid="fam-exp-check" type="checkbox" checked={!exOff[i.key]} onChange={e => setExOff(o => ({ ...o, [i.key]: !e.target.checked }))} style={{ marginTop: 3 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: T.text, fontSize: 13, fontWeight: 700, display: "block", wordBreak: "break-word" }}>{i.title}</span>
                  <span style={sub}>{shortDate(i.date, true)} · {i.scope === "people" ? (i.fromGroup ? `for its people, tagged to ${i.fromGroup} · ` : "tagged to people, not the group · ") : ""}{i.kind === "bill" ? "bill, not paid yet" : `paid by ${i.payer}`}{i.wholeTotal && i.wholeTotal !== i.total ? ` · whole bill ${money(i.wholeTotal)}` : ""}{i.groupAmount > 0 && !i.shares.length ? ` · ${group.name}'s part ${money(i.groupAmount)}${onlyUnpaid && i.total < i.groupAmount - 0.004 ? `, ${money(i.total)} still owed` : ""}` : ""}</span>
                  {i.shares.length > 0 && <span style={{ ...sub, display: "block" }}>{i.shares.map(x => `${x.name} ${money(x.amount)}${x.remaining < 0.005 ? " ✓" : ""}`).join(" · ")}{i.yourShare ? ` · you ${money(i.yourShare)}` : ""}</span>}
                </span>
                <span style={{ color: T.text, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{money(i.total)}</span>
              </label>
            ))}
            <div style={{ ...sub, marginTop: 8 }}>"✓" means that member has paid their share.</div>
            {shareBlock}
          </>}
        </div>}
        {mode !== "expenses" && (!memberIds.length ? <div data-testid="fam-no-members" style={{ color: T.warn, fontSize: 13 }}>This group has no members besides you, so there is no one to ask.</div>
          : !fam ? <div data-testid="fam-bad-range" style={{ color: T.warn, fontSize: 13 }}>Choose a start date that is not after the end date.</div> : <>
          {mode === "full" && <div data-testid="fam-summary" style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{group.name} family</div>
            <div style={sub}>Statement from {shortDate(fam.from, true)} until {shortDate(fam.to, true)}</div>
            {Math.abs(fam.opening) > 0.004 && <div style={line}><span style={{ color: T.text, fontSize: 13 }}>Brought forward</span><span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{fam.opening < 0 ? "−" : ""}{money(fam.opening)}</span></div>}
            <div style={line}><span style={{ color: T.text, fontSize: 13 }}>Charges</span><span data-testid="fam-charges" style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{money(fam.chargesTotal)}</span></div>
            {fam.movedTotal > 0 && <div style={line}><span style={{ color: T.text, fontSize: 13 }}>Moved to someone outside the family</span><span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>−{money(fam.movedTotal)}</span></div>}
            <div style={line}><span style={{ color: T.text, fontSize: 13 }}>Paid by the family</span><span data-testid="fam-paid" style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>−{money(fam.paymentsTotal)}</span></div>
            <div data-testid="fam-balance" style={{ ...line, background: T.accent + "18", borderRadius: 10, padding: "10px 10px", marginTop: 6 }}>
              <span style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>{owed < -0.004 ? "Credit in their favour" : Math.abs(owed) < 0.005 ? "Settled" : "Balance due"}</span>
              <span style={{ color: T.text, fontSize: 14, fontWeight: 900 }}>{Math.abs(owed) < 0.005 ? "✓" : money(owed)}</span>
            </div>
            <div style={{ ...sub, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 10, borderBottom: `1px solid ${T.border}`, paddingBottom: 3 }}>By person</div>
            {fam.members.map(m => (
              <div key={String(m.personId)} data-testid="fam-person" style={line}>
                <span style={{ color: T.text, fontSize: 13 }}>{nameOf(m.personId)}</span>
                <span style={{ color: Math.abs(m.closing) < 0.005 ? T.success : T.text, fontSize: 13, fontWeight: 700 }}>{Math.abs(m.closing) < 0.005 ? "Settled" : m.closing < 0 ? `Credit ${money(m.closing)}` : money(m.closing)}</span>
              </div>
            ))}
            {fam.unapplied.length > 0 && <div data-testid="fam-unapplied" style={{ color: T.warn, fontSize: 12, marginTop: 8 }}>⚠ {money(fam.unapplied.reduce((s, u) => s + u.amount, 0))} paid by the family is not applied to any member, so it is not in anyone's balance above.</div>}
          </div>}
          {mode === "full" && active.map(m => (
            <details key={String(m.personId)} data-testid="fam-member" style={{ marginTop: 10 }}>
              <summary style={{ color: T.accent, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{nameOf(m.personId)}'s statement</summary>
              <div style={{ marginTop: 6 }}><StatementPreview T={T} sym={sym} fmt={fmt} st={m} name={nameOf(m.personId)} nameOf={nameOf} /></div>
            </details>
          ))}
          {shareBlock}
        </>)}
      </div>
    </BottomSheet>
  );
}
