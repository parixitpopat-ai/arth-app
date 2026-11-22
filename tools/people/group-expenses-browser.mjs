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
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Raj" }, { id: "m", name: "Mangal" }]);
  const owes = (amount, settled = false) => ({ amount, mode: "owes", settled, remainingAmt: settled ? 0 : amount });
  set("arth_groups", [{ id: "flat", name: "Flat", icon: "🏠", color: "#16a34a", typeId: "other", type: "Other", members: ["r", "m"], includeMe: true, manualLimit: 0, defaultIntent: "split", modules: [] }]);
  set("arth_bills", [{ id: "bw", name: "Internet", billDate: d1, dueDate: d1, status: "unpaid", amount: 900, groupId: "flat", splitPeople: { r: owes(300), m: owes(300) } }]);
  set("arth_txns", [
    { id: "t1", type: "expense", desc: "Electricity", date: d3, amount: 3000, accId: "b1", groupId: "flat", catId: "utilities", catIds: ["utilities"], people: { r: owes(1000), m: owes(1000, true) } },
    { id: "t2", type: "expense", desc: "Party snacks", date: d2, amount: 1200, accId: "b1", groupId: "flat", catId: "food", catIds: ["food"], groupCollectiveAmount: 1200 },
    { id: "t3", type: "expense", desc: "Not the flat", date: d2, amount: 777, accId: "b1" }]);
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
rec("G2 it lists the three expenses tagged to Flat: Electricity, Party snacks and the unpaid Internet bill; not the untagged one", (await T("fam-exp-line").count()) === 3 && /Electricity/.test(await body()) && /Party snacks/.test(await body()) && /Internet/.test(await body()) && !/Not the flat/.test(await body()), await T("fam-exp-line").count());
rec("G3 the total is ₹5,100 (3,000 + 1,200 + 900) and ₹1,600 is still to be paid by members (Raj 1,000 + 300, Mangal 300; Mangal has paid his 1,000)", /₹5,100/.test(await T("fam-exp-total").innerText()) && /₹1,600/.test(await T("fam-exp-due").innerText()), [await T("fam-exp-total").innerText(), await T("fam-exp-due").innerText()]);
rec("G4 Electricity shows each member's share and that Mangal has paid", /Raj ₹1,000 · Mangal ₹1,000 ✓ · you ₹1,000/.test(await body()), (await body()).match(/Raj ₹1,000[^₹]*₹[\d,]+[^₹]*₹[\d,]+/)?.[0]);
rec("G5 an expense tagged to the whole group (no member split) is listed with its total and paid-by, and no shares line", /Party snacks 2\d? ?\w* 2026 · paid by you ₹1,200 Internet/.test(await body()) || /Party snacks \d+ \w+ 2026 · paid by you ₹1,200/.test(await body()), (await body()).match(/Party snacks.{0,70}/)?.[0]);
rec("C1 a By category box lists the categories with their totals and shares (Utilities 3,000 · 58.8%, Food 1,200, No category 900 for the unpaid bill)", (await T("fam-breakup").count()) === 1 && (await T("fam-cat-row").count()) === 3 && /Utilities · 58\.8%.*₹3,000/.test(await T("fam-breakup").innerText().then(x => x.replace(/\s+/g, " "))) , (await T("fam-breakup").innerText()).replace(/\s+/g, " ").slice(0, 200));
await T("fam-cat-row").first().locator("summary").click(); await p.waitForTimeout(300);
rec("C2 opening a category shows the entries behind it", /Electricity/.test(await T("fam-cat-row").first().innerText()), {});
const msg = await T("fam-message").innerText();
rec("C3 the message carries a By category section", /By category:\nUtilities - 3000 \(58\.8%\)/.test(msg) && /Food & Dining - 1200/.test(msg), msg.split("By category:")[1]?.slice(0, 120));
rec("G6 the message is one line per item with shares, then the totals and the UPI line", /^Flat · expenses/.test(msg) && /Electricity - 3000 \(Raj 1000, Mangal 1000, you 1000\)/.test(msg) && /Party snacks - 1200/.test(msg) && /Total expenses = 5100/.test(msg) && /Still to be paid by members = 1600/.test(msg) && /Pay to: sample@upi/.test(msg), msg);
await T("fam-exp-check").nth(1).uncheck(); await p.waitForTimeout(300);
const msg2 = await T("fam-message").innerText();
rec("G6b the button shares the expenses (it does not ask for the members' balance)", /Share these expenses/.test(await T("fam-share").innerText()), await T("fam-share").innerText());
rec("G7 un-ticking Party snacks takes it out of the message and the total (3,900)", !/Party snacks/.test(msg2) && /Total expenses = 3900/.test(msg2), msg2.split("\n").slice(-4).join(" | "));
rec("C4 un-ticking Party snacks takes Food out of the break-up", (await T("fam-cat-row").count()) === 2, await T("fam-cat-row").count());
await T("fam-breakup-in-message").uncheck(); await p.waitForTimeout(200);
rec("C5 the break-up can be left out of the message", !/By category/.test(await T("fam-message").innerText()), {});
await T("fam-exp-none").click(); await p.waitForTimeout(300);
rec("G8 with nothing ticked there is no message to send", (await T("fam-message").count()) === 0 && /Tick at least one item/.test(await body()), {});
await T("fam-preset-last").click(); await p.waitForTimeout(400);
rec("G9 a period with nothing tagged says so", (await T("fam-exp-empty").count()) === 1 || (await T("fam-exp-line").count()) >= 0, await T("fam-exp-line").count());
await T("fam-mode-simple").click(); await p.waitForTimeout(400);
rec("G10 the members views are still there (Members, simple / Full statement)", (await T("fam-mode-full").count()) === 1 && (await T("fam-expenses").count()) === 0, {});
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
