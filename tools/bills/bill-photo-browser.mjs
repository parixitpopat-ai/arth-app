// Add bill from a PHOTO of a printed utility bill. The REAL on-device OCR engine reads a SYNTHETIC bill image (fake name; drawn by this script),
// then: review panel, checks, connection match, Add bill form filled, duplicate guard. A CHROMIUM check only; not a real phone photo.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
const PORT = 4226, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const dir = `${os.tmpdir()}/arth-billphoto`; mkdirSync(dir, { recursive: true });
const billPng = `${dir}/bill.png`, otherPng = `${dir}/notabill.png`;
const draw = async (lines, out, size = 26) => {
  const p = await browser.newPage({ viewport: { width: 780, height: 80 + lines.length * (size + 12) } });
  await p.setContent(`<body style="margin:0;background:#fff"><pre style="font:700 ${size}px 'Courier New',monospace;color:#111;margin:0;padding:24px;line-height:${size + 12}px">${lines.join("\n")}</pre></body>`);
  writeFileSync(out, await p.screenshot()); await p.close();
};
await draw(["GOVERNMENT OF SAMPLE", "DEPARTMENT OF DRINKING WATER", "", "CONSUMERID    BILL DATE     DUE DATE", "30071258      16/11/2026    30/11/2026", "", "NAME & ADDRESS    U - SAMPLE-07", "MR SAMPLE OWNER", "12 EXAMPLE ROAD SAMPLE TOWN", "", "BILL NO       INSTALL DT    METER NO", "044500034     21/10/2013    J2002934", "", "CURRENT   PREVIOUS   UNITS   USEDUNIT", "10443     10260      183     183", "", "WATER CHARGES       METER RENT", "5839                65", "", "ARREARS/CREDIT      NET PAYABLE", "0 / 0               5904", "", "AMOUNT IN WORDS", "Rupees Five Nine Zero Four Only"], billPng);
await draw(["SHOPPING LIST", "", "apples  6", "bread   1", "milk    2"], otherPng);
// the same bill as a BIG camera-style photo (about 40 megapixels), made by scaling the drawn bill up
const bigPng = `${dir}/bill-big.jpg`;
{ const p = await browser.newPage(); const b64 = (await import("node:fs")).readFileSync(billPng).toString("base64");
  const out = await p.evaluate(async (b64) => { const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const k = 8, c = document.createElement("canvas"); c.width = img.width * k; c.height = img.height * k; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.8)); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return { w: c.width, h: c.height, b64: btoa(s), bytes: buf.length }; }, b64);
  writeFileSync(bigPng, Buffer.from(out.b64, "base64")); globalThis.BIG = { w: out.w, h: out.h, bytes: out.bytes }; await p.close(); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 500000, openingBalanceDate: "2025-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_billers", [{ id: "bl1", name: "Drinking Water Dept", type: "Water" }]);
  set("arth_biller_accounts", [{ id: "ba1", name: "Common Meter Water", type: "Water", provider: "Drinking Water Dept", billerId: "bl1", consumerNo: "30071258", attributeType: "house" }]);
  set("arth_bills", []);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(700); } } };
const openAddBill = async () => {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(500);
  await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(900);
  await page.getByText("+ Add Bill", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(700);
};
try {
  await openAddBill();
  rec("P1 Add bill has 'Read from a bill photo'", (await T("billphoto-file").count()) === 1, {});
  await T("billphoto-file").setInputFiles(otherPng); await T("billphoto-declined").waitFor({ timeout: 90000 }).catch(() => {});
  rec("P2 a photo that is not a bill is declined, nothing filled", (await T("billphoto-declined").count()) === 1, (await T("billphoto-declined").innerText().catch(() => "")));
  await T("billphoto-file").setInputFiles(billPng); await T("billphoto-use").waitFor({ timeout: 90000 }).catch(() => {});
  const v = async k => (await T(`billphoto-${k}`).inputValue().catch(() => null));
  const read = { consumerId: await v("consumerId"), billDate: await v("billDate"), dueDate: await v("dueDate"), amount: await v("amount"), billNo: await v("billNo"), previous: await v("previous"), current: await v("current"), units: await v("units") };
  rec("P3 the REAL engine read the key fields from the synthetic bill image", read.consumerId === "30071258" && read.billDate === "2026-11-16" && read.dueDate === "2026-11-30" && read.amount === "5904", read);
  rec("P4 the matching connection is found by consumer ID", /Matches your connection: Common Meter Water/.test(await T("billphoto-connection").innerText().catch(() => "")), {});
  rec("P5 the amount is cross-checked against the amount in words", (await T("billphoto-check-words").getAttribute("data-status").catch(() => null)) === "holds", await T("billphoto-check-words").innerText().catch(() => ""));
  const owner = await text();
  rec("P6 the name and address from the bill are nowhere on screen", !/SAMPLE OWNER|EXAMPLE ROAD/.test(owner), {});
  await T("billphoto-amount").fill("5804"); await page.waitForTimeout(300);
  rec("P7 a changed amount that disagrees with the words blocks 'These figures are right'", (await T("billphoto-use").isDisabled()) && (await T("billphoto-check-words").getAttribute("data-status")) === "fails", {});
  await T("billphoto-use-words").click(); await page.waitForTimeout(300);
  rec("P8 'Use the words' puts 5904 back and unblocks", (await v("amount")) === "5904" && !(await T("billphoto-use").isDisabled()), {});
  await T("billphoto-use").click(); await page.waitForTimeout(900);
  const form = await text();
  rec("P9 the Add bill form is filled and linked: connection, amount, dates", /Common Meter Water/.test(form) && /5904|5,904/.test(await page.evaluate(() => [...document.querySelectorAll("input")].map(i => i.value).join(" "))) , form.slice(0, 200));
  const vals = await page.evaluate(() => [...document.querySelectorAll("input")].map(i => i.value));
  rec("P10 the due date 2026-11-30 is in the form (the bill date sits under More details; P11 checks it was saved)", vals.includes("2026-11-30"), vals.filter(Boolean).slice(0, 12));
  // a big camera-style photo: the shared reader would refuse it (over 16 megapixels); the bill reader shrinks it and reads it
  await T("billphoto-cancel").click().catch(() => {});
  await T("billphoto-file").setInputFiles(bigPng); await Promise.race([T("billphoto-use").waitFor({ timeout: 120000 }), T("billphoto-declined").waitFor({ timeout: 120000 })]).catch(() => {});
  const bigRead = { consumerId: await T("billphoto-consumerId").inputValue().catch(() => null), amount: await T("billphoto-amount").inputValue().catch(() => null) };
  rec("P13 a big camera-style photo (" + Math.round(globalThis.BIG.w * globalThis.BIG.h / 1e6) + " MP) is read, not refused", globalThis.BIG.w * globalThis.BIG.h > 16000000 && bigRead.consumerId === "30071258" && bigRead.amount === "5904", { ...globalThis.BIG, ...bigRead, declined: (await T("billphoto-declined").innerText().catch(() => "")) });
  await T("billphoto-cancel").click().catch(() => {}); await T("billphoto-file").setInputFiles(billPng); await T("billphoto-use").waitFor({ timeout: 90000 }).catch(() => {}); await T("billphoto-use").click(); await page.waitForTimeout(900);
  // save the bill, then the same photo again must be flagged as already added
  await T("addbill-submit").click().catch(() => {}); await page.waitForTimeout(1000);
  const bills = JSON.parse(await page.evaluate(() => localStorage.getItem("arth_bills") || "[]"));
  rec("P11 saving creates ONE unpaid bill on that connection for 5904, bill date and due date from the photo", bills.length === 1 && bills[0].billerAccountId === "ba1" && bills[0].amount === 5904 && bills[0].status === "unpaid" && bills[0].dueDate === "2026-11-30" && bills[0].billDate === "2026-11-16", bills.map(b => ({ ba: b.billerAccountId, amount: b.amount, status: b.status, due: b.dueDate, billDate: b.billDate })));
  await openAddBill();
  await T("billphoto-file").setInputFiles(billPng); await T("billphoto-use").waitFor({ timeout: 90000 }).catch(() => {});
  rec("P12 the same bill photographed again is flagged as already added and cannot be added twice", (await T("billphoto-duplicate").count()) === 1 && (await T("billphoto-use").isDisabled()), (await T("billphoto-duplicate").innerText().catch(() => "")));
} catch (e) { rec("RUN", false, String(e).slice(0, 700)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
