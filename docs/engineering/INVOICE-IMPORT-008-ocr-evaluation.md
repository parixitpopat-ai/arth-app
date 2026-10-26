# INVOICE-IMPORT-008 — On-device OCR for the Amazon order-summary screenshot: library check and first test

Status: **evaluation only. Nothing was added to the repository's dependencies or code.** The library was installed in a throw-away folder outside the repository (install scripts disabled). The owner's real order-summary screenshot (an image-only PDF) was used for the test; its personal lines (name, address, card digits) are not reproduced here and the working copies were deleted.
Labels: **[VERIFIED]** = run or read in this evaluation. **[NOT VERIFIED]** = not tested.

## 1. Library check — tesseract.js 7.0.0 (+ tesseract.js-core, @tesseract.js-data/eng)
| Gate | Finding |
|---|---|
| Maintenance | Latest release 15 Dec 2025 (73 releases; four npm maintainers; repository `naptha/tesseract.js`) [VERIFIED from the registry] |
| Licence | Apache-2.0 (library and core); MIT (English data package) [VERIFIED] |
| Security | `npm audit`: 0 known vulnerabilities in the 15-package tree [VERIFIED at the time of the check] |
| Install scripts | One: `tesseract.js` runs `opencollective-postinstall || true` (a funding notice). Harmless but it is a script; install with scripts disabled [VERIFIED] |
| Size | The text-only ("lstm") core is **2.9 MB** (wasm) and the English data **2.95 MB** compressed, about 6 MB loaded only when the person chooses an order summary; the package also carries other core variants (44 MB on disk) that must not be bundled [VERIFIED] |
| **Network behaviour** | In a browser it **fetches its worker script, core and language data from a public CDN by default** (cdn.jsdelivr.net) [VERIFIED by reading its source]. It would have to be configured with local paths for all three, so no request leaves the device, and the app's "no remote request while reading" test must keep passing |
| Storage | By default it caches language data in IndexedDB; this must be set to "none" so nothing is written [VERIFIED by reading its source] |
| Compatibility | Ran in Node here. The installed Android WebView and a real phone were **not tested** [NOT VERIFIED]; memory and time on a phone are unknown |

## 2. First test on the real screenshot (Node, offline, local data)
Time (desktop sandbox): library and language load about 0.6 s; one full-page read about 1.3 s; a cropped region about 0.2 s [VERIFIED; a phone will be slower, unmeasured].
**Full page, default settings:** the text labels read correctly, but the **rupee sign was read as a digit**, so amounts came out wrong: ₹329.00 → "2329.00", ₹50.00 → "350.00", ₹1.35 → "31.35", ₹380.35 → "7380.35", and the **Instant Bank Discount amount was missed entirely**. Only the Grand Total (363.02) was right. Overall confidence 86%.
**Only the Order Summary box, amounts and labels read separately** (a layout-specific crop): labels read at about 95% confidence and perfectly; amounts read as 329.00, 50.00, 1.35, **3380.35** (should be 380.35), 17.33 (**the minus sign was lost**), 363.02. So 4 of 6 amounts right, one with a stray leading digit, one with the sign lost.
**The built-in arithmetic check catches these:** 329.00 + 50.00 + 1.35 = 380.35, which is not 3380.35; and 380.35 − 17.33 = 363.02 holds only with the discount taken as negative. A reader that accepts a figure only when every equation holds would have flagged this screenshot as "needs checking" and shown the numbers for correction.

## 3. Conclusion
- The library is **acceptable to adopt as a dependency** if it is bundled locally with the network and storage defaults switched off; nothing in the check is a blocker. Phone memory, speed and WebView behaviour are unverified and must be measured before any claim.
- **Its raw accuracy on this screenshot is not good enough to be trusted silently.** The rupee sign breaks digits, and a minus sign can vanish. Any use must be an **assisted read**: show what was read, run the arithmetic equations, accept nothing that fails them, and let the person correct a figure before it is used. A rule that guesses a "fixed" figure is not safe unless exactly one correction satisfies every equation, and even then it is shown as a suggestion.
- It must never lead to Confirm for a discounted order. The order summary read this way is a **reconciliation aid only**.
- The screenshot layout (label column and amount column) is a single sample; other screenshots, phones, fonts and languages are untested.

## 4. Options
1. **Assisted OCR** (this library, bundled locally): read the labelled amounts, run the equations, show a "read from a picture, please check" panel with editable figures. Needs a spec, mutation-tested arithmetic rules, phone measurements and a network-isolation test.
2. **Type the five figures** (no OCR): the same equations and reconciliation, no new dependency, fully reliable. This remains the backup either way.
3. **Both:** OCR pre-fills the form; the person confirms or corrects each figure. This is the safest way to use OCR and is the recommendation if OCR is built.
