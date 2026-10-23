# INVOICE-IMPORT-003 — Phase 2 definition: confirmed import (proposal; nothing built)

Status: IMPLEMENTED (P2a) on branch `feat-invoice-discovery`, after the user asked for invoices to be added to Arth as itemised transactions. The open decisions were taken at the recommended defaults, which the user can still change: whole-order category defaulting to Groceries with per-line override and uncategorised lines allowed; link only for same-amount matches; one account per invoice; metadata only, no PDF. Nothing is written before Confirm. Unverified items are marked.

Verification done: 2,024 unit/static tests; real-screen runs in Chromium (create, itemised lines, undo, duplicate blocked, link, similar-amount not linkable, credit-card account, per-line categories, simulated save failure with rollback, wrong-total and credit-note refusals). NOT done: Android app run, two-device sync of the new list, real Supabase. One existing defect was worked around: Settings is re-created on every data change, so the invoice screen is rendered outside it.

## What Confirm does (P2a)
Exactly one of these, chosen by the user on a review screen that states it in a sentence:

**A. Create a new expense.** Uses the same boundary as Quick Add, `createTransactionThroughBoundary` (no parallel expense logic).
* type `expense`, merchant "Blinkit", amount = invoice total, date = the payment date the user confirmed (defaults to the invoice date), `accId` = an account the user must choose (no default; the invoice does not say how it was paid).
* `lineItems` = the invoice items (label, qty, `unitPrice` and `amount` from the printed line total, `catId`) plus ONE "Handling charge" line (verified, consolidated). The lines add up to the invoice total exactly, which the existing Add form requires of itemised expenses. If they do not (to the paisa), Confirm is blocked with the reason.
* Discounts stay inside each line's printed total; there is no negative line.
* No new field is added to the transaction (it is **unverified** whether unknown transaction fields survive the boundary and legacy adapters, so none is relied on).

**B. Link to an existing expense** (only when the user selects a suggestion). Adds the invoice's line items to that expense if it has none. Its amount, date and account never change. P2a allows this only for a **same-amount** match, because an itemised expense whose lines differ from its amount is blocked by the Add form's own rule. A similar-amount match offers "add as a new expense", "don't import", or "edit that expense yourself".

**Not in P2a:** refunds, credit notes and cancellations (still rejected, nothing created); split or wallet payments; "paid by someone else"; merging several invoices into one expense; Amazon and Flipkart; keeping the PDF.

## Invoice record (the only new persisted data)
A new synced list `invoiceImports`, one entry per confirmed import: `{ key (seller GSTIN | invoice number), sellerGstin, invoiceNumber, orderId, invoiceDate, totalPaise, txnId, mode: "created"|"linked", importedAt, fileHash, parserVersion }`. No customer name or address, no PDF, no item text beyond what is already on the expense.
* Registered exactly like `fuelFills`: tab-ownership DATA_KEYS, `userData` LISTS, cloud snapshot object and restore guard, differences label, backup coverage, plus the snapshot-completeness test. This is what lets "already imported" survive sync, restore and reinstall (unverified on two real devices).
* Sync safety is unchanged. The list rides in the existing compare-and-swap snapshot.

## Duplicate prevention
* Key = seller GSTIN + invoice number; the order ID is stored separately. Checked before Confirm is enabled. A repeat shows "imported on <date>" with the expense it created or linked.
* File hash is a secondary signal. Missing identifiers: Confirm stays available only as an explicit "can't check for duplicates" acknowledgement.
* If the linked or created expense was later deleted, the record is shown as "imported earlier; that expense no longer exists" and importing again is an explicit choice, never automatic.

## Payment source and credit cards
* The account is always the user's choice. A credit-card purchase is an expense on the card account; paying the card bill later is the existing `cc_payment` (not an expense), so nothing is counted twice. This needs a test that creates the expense and then a card payment and checks spend.
* P2a is one account per invoice. Part-wallet or split payments are **not modelled**; whether expenses support `paymentLines` (seen only on bill payments) is **unverified** and decided in P2b.

## Category handling — DECISION NEEDED
The full Add form blocks itemised expenses with any uncategorised line; Quick Add does not. Invoice items arrive uncategorised. Recommendation: one "Category for this order" defaulting to Groceries (Quick Add's existing Blinkit→Groceries map) applied to all lines, per-line override, and lines left uncategorised are allowed (your decision 6) but flagged. How reports treat uncategorised lines inside an itemised expense is **unverified**.

## Failure and recovery
1. Validate before writing: invoice reconciles, account chosen, valid date, key not already imported, no id clash. Otherwise Confirm shows the reason and nothing is written.
2. Write the expense (or its added lines) and the invoice record in ONE state update: both or neither.
3. Saving failures must be visible. `safeSetLocalStorage` only logs today, so P2a adds a read-back check after saving and a visible "couldn't save on this device" message with the existing backup download.
4. Undo from the toast removes the created expense (or the added lines) and the record, only if that expense is unchanged since.
5. Sync: if sync fails or conflicts, the existing sync-safety flows apply (verified pinned backups, conflict sheet). An import made offline travels with the snapshot when sync resumes.

## Tests and device checks (specific, no broad expansion)
Create path (one transaction, lines sum to total, chosen account); link path (amount/date/account unchanged, same-amount only); duplicate import blocked and explained; undo; storage-quota failure shows the message; snapshot-completeness guard for the new list; card purchase then card payment counted once; offline create then sync; real-screen run; **Android phone run before any claim about the app**.

## Release
Own branch, own release, never combined with sync-safety work. No production deploy without explicit approval.

## Addendum: brands (added after the first phone use)
Item names on the expense are shown WITHOUT the brand ("Lay's India's Magic Masala Chips" becomes "India's Magic Masala Chips"); the brand is kept in the background for brand comparison.
* Where it is kept: each `invoiceImports` record has a `lines` list: barcode (UPC), full printed name, brand, plain product, size found in the name (e.g. "1 l"), quantity, line amount and unit price. No new synced list and no new field on the transaction.
* How the brand is found (`brands.js`): (1) what the person told Arth about that barcode last time, including "no brand"; (2) a STARTER list of common brands matched at the START of the name only (longest first, so "Haldiram's Nagpur" beats "Haldiram's"); (3) otherwise no brand is assumed and the full name is kept. The starter list is **unverified and not exhaustive**; corrections made on the review screen are remembered by barcode.
* Review screen: each item has a name box and a brand box (both editable), and a switch "Show item names without the brand" (on by default). Clearing a brand brings that item's full name back.
* Category memory is now keyed by the plain product name (so "Chips" is remembered across brands); older full-name entries still match.
* Not done: the brand-comparison view itself (nothing reads `lines` yet), and brands for items that are not in the starter list until they are corrected once.
