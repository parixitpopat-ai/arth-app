import test from "node:test";
import assert from "node:assert/strict";
import { parseBillText, wordsToAmount } from "./billPhotoParse.js";

// What the on-device engine really returned for a photographed common-meter water bill (name and address replaced by fake ones).
const OCR = `No aa © rig g
0 00 AE
CONSUMERID BILL DATE DUE DATE
70012345 16/11/2026 30/11/2026
3 NAME & ADDRESS U - ZONE9-07
8 MR SAMPLE OWNER
| 12 EXAMPLE ROAD TOWN
BDA SAMPLE GOA
BE CODE + ABCD0100200300
BILL NO INSTALL DT METER NO
099900012 21/10/2013 X1234567 [
i REV SUBDIV ZONE CATEGORY DEPOSIT i
=f AE DATE 0 DATE DAYS To SIZE i
| 5 a
=| CURRENT PREVIOUS UNITS USEDUNIT
§ 10443 10260 183 183
| ADD UNITS WATER CHARGES METER RENT
N Scwees RE rk erro A ciasons
: ARKEARS/CRED 7 NET PAYABLE
| 0/0 5904
AMOUNT IN WORDS
§ Rupees Five Nine Zero Four Only
{BE DIGITAL | PAY DIGITAL`;

test("the fields the engine really got right are read, and nothing else is invented", () => {
  const p = parseBillText(OCR);
  assert.equal(p.consumerId, "70012345");
  assert.equal(p.billDate, "2026-11-16"); assert.equal(p.dueDate, "2026-11-30");
  assert.equal(p.amount, 5904); assert.equal(p.amountInWords, 5904);
  assert.equal(p.billNo, "099900012");
  assert.equal(p.currentReading, 10443); assert.equal(p.previousReading, 10260); assert.equal(p.units, 183);
  assert.equal(p.periodFrom, null); assert.equal(p.periodTo, null);   // the engine lost the from/to dates: left empty, not guessed
  assert.deepEqual(p.checks, { amountMatchesWords: true, readingsMatchUnits: true, dueAfterBill: true });
  assert.equal(p.found, true);
});
test("the name and address are not part of the result", () => {
  assert.ok(!JSON.stringify(parseBillText(OCR)).match(/SAMPLE|EXAMPLE|ZONE9/));
});
test("amount in words: digit by digit and ordinary words", () => {
  assert.equal(wordsToAmount("Rupees Five Nine Zero Four Only"), 5904);
  assert.equal(wordsToAmount("Rupees Five Thousand Nine Hundred Four Only"), 5904);
  assert.equal(wordsToAmount("Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only"), 123456);
  assert.equal(wordsToAmount("Rupees Seven Thousand Thirty Nine Only"), 7039);
  assert.equal(wordsToAmount("Rupees Banana Only"), null);
  assert.equal(wordsToAmount(""), null);
});
test("a misread figure is caught against the words, not trusted", () => {
  const p = parseBillText(OCR.replace("0/0 5904", "0/0 5804"));
  assert.equal(p.amount, 5804); assert.equal(p.amountInWords, 5904); assert.equal(p.checks.amountMatchesWords, false);
});
test("readings that do not add up are flagged", () => {
  const p = parseBillText(OCR.replace("10443 10260 183 183", "10443 10260 193 193"));
  assert.equal(p.checks.readingsMatchUnits, false);
});
test("a due date before the bill date is flagged", () => {
  const p = parseBillText(OCR.replace("16/11/2026 30/11/2026", "30/11/2026 16/11/2026"));
  assert.equal(p.checks.dueAfterBill, false);
});
test("a photo that is not a bill gives nothing", () => {
  const p = parseBillText("some random text\n12 apples");
  assert.equal(p.found, false); assert.equal(p.amount, null); assert.equal(p.consumerId, null);
});
test("amount on the same line as the label, and with paise", () => {
  const p = parseBillText("CONSUMER NO BILL DATE DUE DATE\n9988776 01/12/2026 15/12/2026\nNET PAYABLE 1,0 7039.46");
  assert.equal(p.amount, 7039.46); assert.equal(p.consumerId, "9988776");
});
test("an impossible date is rejected", () => {
  assert.equal(parseBillText("BILL DATE DUE DATE\n12345678 31/02/2026 30/11/2026").billDate, null);
});
