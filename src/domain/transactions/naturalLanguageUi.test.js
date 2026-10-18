import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
const quickAdd = src.slice(src.indexOf("const QuickAddModal"), src.indexOf("const AddModal = "));

test("a typed entry can never be saved without an account, even though the Save button stays enabled", () => {
  assert.ok(/const saveDirect = \(\) => \{\s*if\(savingRef\.current \|\| !canSave \|\| nlNeedsAccount\) return;/.test(quickAdd), "saveDirect refuses when the account is missing");
  assert.ok(quickAdd.includes('data-testid="qa-save" onClick={trySave}'), "the button calls trySave");
  assert.ok(/const trySave = \(\) => \{\s*if\(nlNeedsAccount\)\{\s*setNlAccError\(true\);/.test(quickAdd), "trySave shows the reason and returns");
  assert.ok(!/const canSave = [^\n]*nlNeedsAccount/.test(quickAdd), "a missing account no longer disables the button");
});
test("designer wording and structure", () => {
  assert.ok(quickAdd.includes('placeholder="Type it: ₹450 Swiggy on card 1234"'));
  assert.ok(quickAdd.includes("Choose an account to save"));
  assert.ok(quickAdd.includes('<option value="" disabled>Choose account</option>'), "no ellipsis");
  assert.ok(!/tap to use/i.test(quickAdd), "no '(tap to use)'");
  assert.ok(quickAdd.includes("· Suggested"));
  assert.ok(quickAdd.includes("Your bank isn't debited until the card bill is paid."));
  assert.ok(quickAdd.includes('aria-label="Fill the form from this text"'), "icon button is labelled for screen readers");
});
test("each filled field's tag is cleared by the edit handler of that field", () => {
  for (const key of ["amount", "who", "date", "acc", "cat"]) assert.ok(quickAdd.includes(`clearFilled("${key}")`), key);
});
test("the card note is limited to the first three times", () => {
  assert.ok(quickAdd.includes("arth_nl_card_note_seen") && /seen<3/.test(quickAdd));
});

test("typed entry has no address switch: Quick Add never reads the page address", () => {
  assert.ok(!quickAdd.includes("window.location"), "Quick Add does not look at the URL");
  assert.ok(!/nlEnabled|isNaturalLanguageEntryEnabled/.test(src), "no leftover switch");
  assert.ok(/\{\(\(\)=>\{\s*const open = nlDraft/.test(quickAdd), "the typed-entry row is always rendered");
});
