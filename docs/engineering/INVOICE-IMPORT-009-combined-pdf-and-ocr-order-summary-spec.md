# INVOICE-IMPORT-009 — One upload, two readers: text PDFs and an OCR-assisted Amazon order summary (SPEC AND IMPLEMENTATION PLAN, revision 2)

Status: **documentation only. Nothing here is approved for implementation, push or deployment.** Revision 2 records the owner's five decisions (§12) and the safeguards that follow from them (§13). It extends INVOICE-IMPORT-006 §3 (order summary as the source of the order total), uses the library evaluation in INVOICE-IMPORT-008, and keeps the guards of INVOICE-IMPORT-006 §4.2 and PURCHASE-ENTRY-001: **no Confirm for Amazon, no discounted order is confirmable, no EMI order is confirmable, nothing is saved.**
Labels: **[VERIFIED]** = run or read in this work. **[NOT VERIFIED]** = proposal or unknown. Amounts in the worked cases are from the owner's own order-summary screenshot (amounts only) or invented.

## 1. What the owner asked for
One upload in which Arth reads **text PDFs** normally and reads a **picture-only order summary** too, then reconciles them. A picture must never be trusted silently, because OCR misreads digits.

## 2. Routing, page by page [proposal]
Every page of every file is routed on its own, as the importer already classifies each page [VERIFIED]:
| Page | Reader | Result |
|---|---|---|
| Has a text layer and looks like an Amazon.in tax invoice | existing text reader | exact, as today; **OCR never touches it and never overrides it** |
| Has a text layer and is an order summary (a future Print-to-PDF) | the same **label parser** as below, with no OCR | read exactly, same equations |
| **Picture only** and looks like an **Amazon order summary** | **OCR, assisted** (§4) | "Order summary, read from a picture, please check" |
| Picture only and anything else (including a picture-only **invoice**) | none | stays "Picture only (needs OCR)": **OCR is limited to the order-summary layout**; tax invoices carry GST and per-line detail where a misread is too costly |
| Blinkit | unchanged | single-file flow |
How a picture page is recognised as an order summary: by OCR of its labels (the label column read at about 95% confidence on the sample) containing "Order Summary" and at least "Grand Total" [VERIFIED on one sample; NOT VERIFIED on others]. Anything else stays unsupported.

## 3. What is read from the summary (allow-list, in memory only)
Order number, order date, and the labelled amounts: **Item(s) Subtotal, Shipping, Offer Processing Fee, Total, Instant Bank Discount, Grand Total** (the labels in the one real sample). Rows with any other label (a coupon, cashback, gift-wrap fee, COD fee, taxes…) are shown as **"unrecognised row, cannot be verified"** and block acceptance; none are guessed. The Ship-to name and address, the payment method line and every other word are **never kept**: the recognised text is dropped as soon as the allow-listed values are extracted.
**Card last four digits are not extracted, kept or used (owner decision, §12.2).** The payment-method line is never parsed. No account is suggested from a picture. A static test proves nothing reads that line, and a privacy test with an invented card line proves no digit from it reaches any state, log, storage or screen. Enabling it would need a separate spec and approval.

## 4. Assisted OCR (the contract)
1. **On the device only.** The OCR engine, its worker and its English data are **bundled with the app and loaded locally**; nothing is fetched from any network and nothing is cached in IndexedDB. The browser suite's existing "no remote request" and "no IndexedDB / sessionStorage" checks must keep passing with OCR on.
2. **Nothing is accepted on trust.** The values appear in an editable panel marked "read from a picture, please check". They count as read only after **both** equations in §5 hold **and the person has explicitly tapped "These figures are right"** (mandatory, §12.1). That tap is a statement about the **figures only** (§13).
3. **The engine is fully released** after each reading (worker terminated, image released). No recognised text is logged, stored, synced or shown beyond the allow-listed fields.
4. **Page size and time are capped** by what the phone measurement (§9) allows; a bigger image is declined with a message, never silently down-scaled into a worse read.
5. **English only (owner decision, §12.3).** Only the English language data is bundled and loaded; a non-English row simply fails to match a known label and becomes an "unrecognised row". No other language data ships.
6. **A fixed read recipe:** label column and amount column read separately, sparse text mode, digits and "." only for amounts. This is tuned on the sample and is **not validated beyond it** (§8).

## 5. The equations (the safety net) [arithmetic verified on the sample]
Amounts are positive numbers; the label gives the direction.
- **E1** Item(s) Subtotal + Shipping + Offer Processing Fee (+ any other recognised charge) = **Total**
- **E2** Total − Instant Bank Discount (− any other recognised discount) = **Grand Total**
Rules: an equation either holds to the paisa or it **fails**; a failure never changes any figure. If exactly **one** figure, changed to one specific value, would make **every** equation hold, that value is offered as a **suggestion** ("Did you mean ₹380.35?") that needs a tap. If two or more figures fail, or no single change fixes it, the screen says which equation fails and by how much and waits for the person to correct figures. **Holding is necessary, not sufficient:** two compensating misreads could pass, which is why the person's check (§4.2) and the comparison with the invoices (§6) both stay.

## 6. Matching the summary to the right order, then reconciling with the invoices
### 6.1 Which order does this summary belong to? (owner decision, §12.5)
1. **Exact match:** the order number read (format `###-#######-#######`) equals the order number of invoices already read → the summary attaches to that order automatically, and the screen says so.
2. **Not confident** (it does not match, the digits are not in the format, a digit is flagged low-confidence, or it could match more than one order) → **the person selects the order manually** from the orders read (shown by date, seller names and invoiced total, never by guessing). A near match (one digit off) is shown as a hint, **never** auto-attached.
3. **Still ambiguous** (the person cannot tell, picks "not sure", no order read matches, or two orders fit) → **the summary stays unattached** and **confirmation is blocked** for every order involved; no comparison is attempted and no figure is carried to any order.
The matched or chosen link is recorded in memory with how it was made ("matched exactly" or "chosen by you"); a chosen link is shown on the order card.
### 6.2 The comparison (only for a matched or chosen order)
Component by component:
- **Items:** summary subtotal vs the invoices' items total.
- **Fees:** summary fee vs the fee invoices' total.
- **Shipping, discounts:** summary-only (invoices rarely carry them): shown as such, never as a mismatch.
- **Order total (what was paid):** the summary's **Grand Total**; the check is that subtotal + shipping + fee − discount equals it (E1/E2).
Results use the wording of INVOICE-IMPORT-006 §4: exact rupee differences, "missing coverage", "invoices exceed the summary", never a silent correction. The order moves from "Unverified — no order summary" to **"Order summary read from a picture, checked by you"** (or **"entered by you"** for manual entry, §6.3). **Confirm stays withheld**, and a discount keeps the order unconfirmable (§13).
### 6.3 Manual entry of the five figures (fallback, owner decision, §12.4)
Always available beside OCR, and the only path when OCR is not used or fails. The person types **Item(s) Subtotal, Shipping, Processing fee, Discount** and **Grand Total** (**Total** is calculated and shown). The same equations apply (E1 holds by construction; E2 compares the typed Grand Total with the calculated Total less the discount), the same order matching (§6.1) and the same invoice comparison (§6.2). Typed figures are labelled **"entered by you"**, never "read".

## 7. Phone-width flow (390 px)
```
Choose files → Reading… "Reading 2 of 5" (a picture takes longer: "Reading a picture on this phone…")
→ Preview
   WHAT WAS READ   files 5 · invoices read 4 · pictures read 1 (check) · unreadable 0 …
   ORDER SUMMARY — read from a picture, please check
      Item(s) Subtotal     329.00  ✔
      Shipping              50.00  ✔
      Offer Processing Fee   1.35  ✔
      Total                380.35  ✔  = 329.00 + 50.00 + 1.35
      Instant Bank Discount 17.33  ✔  (subtracted)
      Grand Total          363.02  ✔  = 380.35 − 17.33
      Belongs to order: matched exactly  |  or  [ Choose the order ]  (blocked until chosen)
      [ These figures are right ]   [ Edit a figure ]   [ Enter the figures myself ]
   AMAZON ORDER … "Order summary checked by you" · reconciliation lines · [no Confirm]
```
Each figure has a tick or a warning with the equation it fails; a failing figure is editable with a number pad. Targets 44 px; collapsed details as today.

## 8. Worked cases (the real screenshot's figures; misreads as measured in INVOICE-IMPORT-008)
- **A. Clean read.** 329.00 + 50.00 + 1.35 = 380.35; 380.35 − 17.33 = 363.02. Both equations hold → panel shows ticks; you tap "These figures are right". Invoices for the same order: item ₹329.00, fee ₹1.35 → items and fees match; shipping 50.00 and discount 17.33 are summary-only. Order total ₹363.02. **Confirm withheld (a discount).**
- **B. A rupee sign read as a digit** (measured: "3380.35" for 380.35). E1 fails: 329.00 + 50.00 + 1.35 = 380.35, not 3380.35. Exactly one figure fixes both equations (Total = 380.35) → suggestion "Did you mean 380.35?" Nothing is applied until you tap.
- **C. The discount amount not read** (measured). E2 fails by exactly 17.33: the screen shows "Discount missing; the difference is ₹17.33. Enter it" and offers 17.33 as a suggestion you confirm.
- **D. Two figures wrong.** No single change fixes it → "Total and Grand Total do not add up" with the arithmetic shown; you correct the figures.
- **E. An unrecognised row** (for example a coupon line). The panel lists it as "cannot be verified" and acceptance is blocked until you either type its amount and direction or mark the order "not checked".
- **F. Summary and invoices from different orders** (as in the owner's current files). The order number does not match any invoice read: the summary is shown on its own as "no invoices read for this order"; no comparison is attempted.
- **G. A picture-only invoice** in the same selection. Still "Picture only (needs OCR)": not read.
- **I. You tapped "These figures are right" but the invoices disagree.** Summary subtotal ₹329.00; invoices read total ₹359.00. The tap marks the *figures* as accepted; the order **still shows "Invoices exceed the summary by ₹30.00"** and stays blocked. There is no control that clears an invoice mismatch.
- **J. Order number misread by one digit.** The summary shows a hint ("may be order …") and asks you to choose; it attaches only after you choose. If you pick "not sure", it stays unattached and confirmation is blocked.
- **K. Manual entry.** You type 329.00, 50.00, 1.35, 17.33 and Grand Total 363.02 → Total 380.35 is calculated, 380.35 − 17.33 = 363.02 holds → "entered by you". Typing 360.02 instead → "Grand Total does not equal 380.35 − 17.33 = 363.02"; nothing is changed for you.
- **H. A merged PDF with text pages and a picture page.** Routed page by page; the text pages are read exactly, the picture page goes to the assisted panel.

## 9. Gates before any code ships
1. **Dependency gate** (the written check is INVOICE-IMPORT-008): add **tesseract.js 7.0.0** only with: scripts disabled at install; the **text-only core (about 2.9 MB) and English data (about 2.95 MB) bundled locally**; worker, core and language paths all local; IndexedDB cache off; other core variants **not** shipped; bundle size reported before and after; lazy loaded only when a picture page appears.
2. **Isolation tests:** with OCR enabled, the browser suite still shows no remote request and no IndexedDB or sessionStorage entry, on the production-mode preview build.
3. **Privacy tests:** an invented screenshot containing a fake name, address and card line proves none of it reaches any state, log, storage or screen; the full recognised text object is never retained.
4. **Accuracy corpus:** many **synthetic** order-summary screenshots (several fonts, sizes, dark and light themes, a "₹" and an "Rs." variant, with and without a discount, long item names) plus the owner's real sample. Measure per-figure misread rates and how often the equations catch a misread or let one pass. **Targets are not set until the data exists;** none of the figures in §5 and §8 count as validated.
5. **Phone measurement on a real Android device** (time to first result, peak memory, behaviour when the app is backgrounded, behaviour on low memory). Time and size limits come from this measurement, not from the desktop numbers (about 0.6 s load and 1.3 s per full page in Node [VERIFIED]).
6. **Mutation checks** on every equation, the single-correction rule, the unrecognised-row block, the order-number matching states (§6.1) and the acknowledgement rule: a test must prove that tapping "These figures are right" **cannot** change an order's reconciliation state or enable Confirm, that a discounted or EMI-paid order stays unconfirmable whatever is tapped, that the card line is never parsed, and that only English data is bundled.
7. **Release gate:** an isolated preview first, then your phone, then your explicit release approval, as for the importer.

## 10. Implementation plan (not started; each step is its own reviewed change; none is pushed or deployed without your explicit approval)
1. **Pure label parser, equations and order matching** over plain text lines (no OCR, no UI): E1/E2 with exact paise arithmetic, the single-correction *suggestion* rule, unrecognised-row blocking, the order-number matching states of §6.1, the invoice comparison of §6.2, and the **acknowledgement model of §13** (figures accepted ≠ order reconciled). Unit tests for cases A–K and mutation checks on every rule. The same code serves a future text order summary.
2. **Manual entry panel** (§6.3), on the preview screen, using step 1; phone-width browser tests on synthetic data. This is fully usable without OCR and is the fallback permanently.
3. **Order picker UI** (§6.1): exact match, near-match hint, choose manually, "not sure" → unattached and blocked; tests for J and for the ambiguous cases.
4. **Dependency gate and local bundling** (§9.1) with the network and storage isolation tests on the production-mode preview build; English data only.
5. **OCR adapter** (lazy, local, released after use) behind a flag that is **off** in production builds; static tests that the card line is never parsed and that only English data ships.
6. **Assisted panel** (editable figures, ticks, suggestions, the mandatory "These figures are right" tap) feeding the same state as manual entry; privacy tests with an invented screenshot.
7. **Accuracy corpus and real-phone measurement** (§9.4, §9.5); you decide whether the flag is turned on.
8. **Release:** isolated preview, your phone, your explicit release approval.
Steps 1–3 deliver value and carry no OCR dependency, so they can ship first without any new library.

## 11. Unknowns [NOT VERIFIED]
Other Amazon screenshot layouts, languages and themes; other summary rows; accuracy beyond one sample; Android WebView support, memory and speed; whether a text print of the summary exists on your phone (so far it does not); how an OCR'd order number matches reliably (digits are the weak point); and whether bundling the engine affects first-load time of the main app (it is loaded only on demand).

## 12. Decisions (resolved by the owner)
1. **"These figures are right" is a mandatory explicit confirmation** for OCR-extracted figures. Equations passing is not enough; the person must tap.
2. **Card last-four extraction and account suggestions stay disabled** (§3).
3. **English-only OCR** for this phase (§4.5).
4. **Manual entry of all five figures is provided as a fallback** (§6.3).
5. **Order matching:** exact match attaches; otherwise the person selects the order manually; if it remains ambiguous, confirmation is blocked (§6.1).

## 13. Safeguards that do not change
1. **OCR only for picture-based order summaries.** Text pages stay on the existing text extraction, which is **authoritative**; OCR never touches or overrides a text page.
2. **Both equations (E1 and E2) must reconcile** before a figure set can be acknowledged; **no guessed corrections** are ever applied: a suggestion needs a tap and a failing figure is never changed for the person.
3. **The figures must be matched to the correct order** (§6.1) **and compared with the invoices** (§6.2).
4. **Acknowledgement does not override an invoice mismatch.** The tap "These figures are right" accepts the *figures as read or typed*, nothing more. Any difference between the summary and the invoices (missing coverage, invoices exceeding the summary, an unmatched order) **remains visible and keeps the order blocked**; there is no "accept anyway" control, and a test proves that acknowledging cannot change an order's reconciliation state.
5. **Discounted and EMI-paid orders remain unconfirmable** until separately authorised accounting work (PURCHASE-ENTRY-001 and the EMI work it defers) makes them safe. Reading a summary that shows a discount or a financed payment can never enable Confirm.
6. **There is still no Confirm for Amazon, nothing is saved,** and no expense, loan, instalment or down payment is created by any of this.
7. **Privacy:** only the allow-listed amounts and order number/date are kept, in memory; the recognised text is dropped at once; nothing is logged, stored or synced; no remote request is made.
