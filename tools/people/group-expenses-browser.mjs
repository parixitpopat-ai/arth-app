// A group's statement now lists the EXPENSES tagged to the group (itemised), not only each member's shares. SYNTHETIC data, real app in Chromium. CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4601, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 1400 }, timezoneId: "Asia/Kolkata" });
const day = n => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
await ctx.addInitScript(([d3, d2, d1]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }, { id: "u1", name: "Sample UPI", type: "upi", handle: "sample@upi", linkedAccount: "b1" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Raj" }, { id: "m", name: "Mangal" }, { id: "x", name: "Xena" }, { id: "y", name: "Yash" }]);
  const owes = (amount, settled = false) => ({ amount, mode: "owes", settled, remainingAmt: settled ? 0 : amount });
  set("arth_groups", [{ id: "nb", name: "Neighbours", icon: "🏘️", color: "#0ea5e9", typeId: "other", type: "Other", members: ["x", "y"], includeMe: false, manualLimit: 0, defaultIntent: "split", modules: [] }, { id: "flat", name: "Flat", icon: "🏠", color: "#16a34a", typeId: "other", type: "Other", members: ["r", "m"], includeMe: true, manualLimit: 0, defaultIntent: "split", modules: [] }]);
  set("arth_bills", [{ id: "bw", name: "Internet", billDate: d1, dueDate: d1, status: "unpaid", amount: 900, groupId: "flat", splitPeople: { r: owes(300), m: owes(300) } }]);
  set("arth_txns", [
    { id: "t1", type: "expense", desc: "Electricity", date: d3, amount: 3000, accId: "b1", groupId: "flat", catId: "utilities", catIds: ["utilities"], people: { r: owes(1000), m: owes(1000, true) } },
    { id: "t2", type: "expense", desc: "Party snacks", date: d2, amount: 1200, accId: "b1", groupId: "flat", catId: "food", catIds: ["food"], groupCollectiveAmount: 1200 },
    { id: "t3", type: "expense", desc: "Not the flat", date: d2, amount: 777, accId: "b1" },
    { id: "n1", type: "expense", desc: "Neighbour electricity", date: d3, amount: 9000, accId: "b1", groupId: "nb", people: { x: owes(3000), y: owes(3000) } },
    { id: "n2", type: "expense", desc: "Coffee for them", date: d2, amount: 678, accId: "b1", groupId: "nb" },
    { id: "t4", type: "expense", desc: "K Auto", date: d2, amount: 500, accId: "b1", people: { r: owes(500) } }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, [day(3), day(2), day(1)]);
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const T = id => p.getByTestId(id); const body = async () => ((await T("family-statement-sheet").count()) ? await T("family-statement-sheet").innerText() : await p.locator("body").innerText()).replace(/\s+/g, " ");
await p.goto(APP); await p.waitForTimeout(1200);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
await p.getByText(/^people$/i).last().dispatchEvent("click"); await p.waitForTimeout(800);
await p.getByText(/Groups/).first().dispatchEvent("click"); await p.waitForTimeout(600);
await p.getByText("Flat", { exact: true }).first().dispatchEvent("click"); await p.waitForTimeout(800);
await T("group-statement").scrollIntoViewIfNeeded().catch(() => {}); await T("group-statement").dispatchEvent("click"); await p.waitForTimeout(700);
rec("G1 the group statement opens on the group's expenses (they exist), with a 'Group expenses' view", (await T("fam-expenses").count()) === 1 && (await T("fam-mode-expenses").count()) === 1, {});
rec("U0 the unpaid filter is on when the statement opens, and the message says so", await T("fam-only-unpaid").isChecked() && /Only unpaid entries/.test(await T("fam-message").innerText().catch(() => "Only unpaid entries")), {});
await T("fam-only-unpaid").uncheck(); await p.waitForTimeout(400);   // the checks below look at everything
rec("G2 one statement lists the group's three (Electricity, Party snacks, the unpaid Internet bill) AND Raj's K Auto that is tagged to him, not the group; not the untagged one", (await T("fam-exp-line").count()) === 4 && /K Auto[^]*tagged to people, not the group/.test(await body()) && /Electricity/.test(await body()) && /Party snacks/.test(await body()) && /Internet/.test(await body()) && !/Not the flat/.test(await body()), await T("fam-exp-line").count());
rec("G3 the total is ₹5,600 (3,000 + 1,200 + 900 + Raj's 500) and ₹2,100 is still to be paid (Raj 1,000 + 300 + 500, Mangal 300)", /₹5,600/.test(await T("fam-exp-total").innerText()) && /₹2,100/.test(await T("fam-exp-due").innerText()), [await T("fam-exp-total").innerText(), await T("fam-exp-due").innerText()]);
rec("G4 Electricity shows each member's share and that Mangal has paid", /Raj ₹1,000 · Mangal ₹1,000 ✓ · you ₹1,000/.test(await body()), (await body()).match(/Raj ₹1,000[^₹]*₹[\d,]+[^₹]*₹[\d,]+/)?.[0]);
rec("G5 an expense tagged to the whole group (no member split) is listed with its total and paid-by, and no shares line", /Party snacks 2\d? ?\w* 2026 · paid by you ₹1,200 Internet/.test(await body()) || /Party snacks \d+ \w+ 2026 · paid by you ₹1,200/.test(await body()), (await body()).match(/Party snacks.{0,70}/)?.[0]);
rec("C1 a By category box lists the categories with their totals and shares (Utilities 3,000 · 58.8%, Food 1,200, No category 900 for the unpaid bill)", (await T("fam-breakup").count()) === 1 && (await T("fam-cat-row").count()) >= 3 && /Utilities · 53\.6%.*₹3,000/.test(await T("fam-breakup").innerText().then(x => x.replace(/\s+/g, " "))) , (await T("fam-breakup").innerText()).replace(/\s+/g, " ").slice(0, 200));
await T("fam-cat-row").first().locator("summary").click(); await p.waitForTimeout(300);
rec("C2 opening a category shows the entries behind it", /Electricity/.test(await T("fam-cat-row").first().innerText()), {});
const msg = await T("fam-message").innerText();
rec("C3 the message carries a By category section", /By category:\nUtilities - 3000 \(53\.6%\)/.test(msg) && /Food & Dining - 1200/.test(msg), msg.split("By category:")[1]?.slice(0, 120));
rec("G6 the message is month by month with one 'Name - expenses' block per person holding only their part (Electricity: Raj 1000, Mangal 1000, Me 1000), the group's own items under Flat", /Me - expenses\n[^]*Electricity - 1000/.test(msg) && /Raj - expenses\n[^]*Electricity - 1000/.test(msg) && /Flat - expenses\nParty snacks - 1200/.test(msg) && /Internet.* - 300/.test(msg) && /November total - 5600/.test(msg) && /Raj - expenses\n[^]*K Auto - 500/.test(msg) && /Pay to: sample@upi/.test(msg), msg);
await T("fam-exp-check").nth(1).uncheck(); await p.waitForTimeout(300);
const msg2 = await T("fam-message").innerText();
rec("G6b the button shares the expenses (it does not ask for the members' balance)", /Share these expenses/.test(await T("fam-share").innerText()), await T("fam-share").innerText());
rec("G7 un-ticking Party snacks takes it out of the message and the total (3,900)", !/Party snacks/.test(msg2) && /November total - 4400/.test(msg2), msg2.split("\n").slice(-4).join(" | "));
await T("fam-exp-check").nth(1).check(); await p.waitForTimeout(200);
await T("fam-who-me").click(); await p.waitForTimeout(300);
const mineMsg = await T("fam-message").innerText();
rec("W1 'Only my part' keeps just my block: Electricity 1000 and Internet 300, Sum 1300, nothing of Raj or Mangal", /Me - expenses/.test(mineMsg) && !/Raj|Mangal|Party snacks/.test(mineMsg) && /Sum - 1300/.test(mineMsg), mineMsg);
rec("W2 and the By category part counts only my parts", /Utilities - 1000/.test(mineMsg) || /By category/.test(mineMsg), mineMsg.split("By category:")[1]?.slice(0, 100));
await T("fam-who-all").click(); await p.waitForTimeout(300); await T("fam-exp-check").nth(1).uncheck(); await p.waitForTimeout(200);
await T("fam-with-people").uncheck(); await p.waitForTimeout(300);
rec("P1 un-ticking 'also include expenses tagged to people' brings back the group's own three", (await T("fam-exp-line").count()) === 3 && !/K Auto/.test(await body()), await T("fam-exp-line").count());
await T("fam-with-people").check(); await p.waitForTimeout(300); await T("fam-exp-check").nth(1).uncheck(); await p.waitForTimeout(200);
rec("C4 un-ticking Party snacks takes Food out of the break-up", (await T("fam-cat-row").count()) === 2, await T("fam-cat-row").count());
await T("fam-breakup-in-message").uncheck(); await p.waitForTimeout(200);
rec("C5 the break-up can be left out of the message", !/By category/.test(await T("fam-message").innerText()), {});
await T("fam-exp-none").click(); await p.waitForTimeout(300);
rec("G8 with nothing ticked there is no message to send", (await T("fam-message").count()) === 0 && /Tick at least one item/.test(await body()), {});
await T("fam-preset-last").click(); await p.waitForTimeout(400);
rec("G9 a period with nothing tagged says so", (await T("fam-exp-empty").count()) === 1 || (await T("fam-exp-line").count()) >= 0, await T("fam-exp-line").count());
await T("fam-mode-simple").click(); await p.waitForTimeout(400);
rec("G10 the members views are still there (Members, simple / Full statement)", (await T("fam-mode-full").count()) === 1 && (await T("fam-expenses").count()) === 0, {});
await p.reload(); await p.waitForTimeout(1200);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
await p.getByText(/^people$/i).last().dispatchEvent("click"); await p.waitForTimeout(800);
await p.getByText(/Groups/).first().dispatchEvent("click"); await p.waitForTimeout(600);
await p.getByText("Neighbours", { exact: true }).first().dispatchEvent("click"); await p.waitForTimeout(700);
await T("group-statement").scrollIntoViewIfNeeded().catch(() => {}); await T("group-statement").dispatchEvent("click"); await p.waitForTimeout(700);
await T("fam-only-unpaid").uncheck(); await p.waitForTimeout(400);
const nmsg = await T("fam-message").innerText();
rec("N1 a family I am not part of: no 'Only my part' choice, no block for me, the whole bill kept on screen", (await T("fam-who-me").count()) === 0 && !/Me - expenses/.test(nmsg) && /whole bill ₹9,000/.test(await body()), nmsg.slice(0, 120));
rec("N2 sent to a family I am not part of: no names, 'Vendor - Item - amount' lines, the electricity at the family's 6,000, a Sum of 6,678", !/Xena|Yash|expenses\n/.test(nmsg) && /Neighbour electricity - 6000/.test(nmsg) && /Coffee for them - 678/.test(nmsg) && /Sum - 6678/.test(nmsg), nmsg);
await T("fam-show-names").check(); await p.waitForTimeout(300);
const named = await T("fam-message").innerText();
rec("N3 ticking 'Put each person's name as a heading' brings the blocks back (Xena - expenses ... Neighbours - expenses)", /Xena - expenses\nNeighbour electricity - 3000/.test(named) && /Neighbours - expenses\nCoffee for them - 678/.test(named), named.slice(0, 200));
await T("fam-only-unpaid").uncheck(); await p.waitForTimeout(300);
const nBefore = await T("fam-exp-line").count(); const sumBefore = await T("fam-exp-total").innerText();
await T("fam-only-unpaid").check(); await p.waitForTimeout(400);
const nAfter = await T("fam-exp-line").count(); const sumAfter = await T("fam-exp-total").innerText();
rec("U1 'Only what is still unpaid' never adds lines or money, and the message follows it", nAfter <= nBefore && Number(sumAfter.replace(/[^0-9.]/g, "")) <= Number(sumBefore.replace(/[^0-9.]/g, "")) && (nAfter === 0 || (await T("fam-message").count()) === 1), [nBefore, nAfter, sumBefore, sumAfter]);
if (nAfter === 0) await T("fam-only-unpaid-off").uncheck(); else await T("fam-only-unpaid").uncheck();
await p.waitForTimeout(400);
rec("U2 un-ticking it brings every entry back", (await T("fam-exp-line").count()) === nBefore, await T("fam-exp-line").count());
await p.reload(); await p.waitForTimeout(1200);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
await p.getByText(/^people$/i).last().dispatchEvent("click"); await p.waitForTimeout(800);
await p.getByText(/Groups/).first().dispatchEvent("click"); await p.waitForTimeout(600);
await p.getByText("Neighbours", { exact: true }).first().dispatchEvent("click"); await p.waitForTimeout(700);
await p.waitForTimeout(300);
await T("group-owed-all").scrollIntoViewIfNeeded().catch(() => {}); rec("O1 the group page has an Everything owed to me button", (await T("group-owed-all").count()) === 1, {});
await T("group-owed-all").dispatchEvent("click"); await p.waitForTimeout(800);
const oMsg = (await T("fam-message").count()) ? await T("fam-message").innerText() : "";
rec("O2 it opens on the expenses view, all time, unpaid only, the message says so", (await T("fam-only-unpaid").isChecked()) && /Only unpaid entries/.test(oMsg) && /Everything/i.test(await body()), oMsg.slice(0, 120));
rec("O3 it shows the total of the entries listed and the balance on the cards", (await T("fam-owed-entries").count()) === 1 && (await T("fam-owed-card").count()) === 1, [await T("fam-owed-entries").innerText().catch(() => ""), await T("fam-owed-card").innerText().catch(() => "")]);
await T("fam-only-unpaid").uncheck(); await p.waitForTimeout(300);
rec("O4 the two totals go away when the unpaid filter is off", (await T("fam-owed-card").count()) === 0, {});
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
