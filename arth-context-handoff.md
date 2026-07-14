# ARTH 4.0 — CONTEXT HANDOFF

Personal finance PWA (React + Vite + Supabase + Vercel), single monolith `src/App.jsx` (~13,900+ lines at end of this session). Repo: github.com/parixitpopat-ai/arth-app. Live: arth-app.vercel.app. Owner: Major (Parixit Popat), Goa. Direct, no-sugarcoating communication preferred; CXO-register.

## Deploy
```bash
cd /d/arth-app
# replace src/App.jsx with the downloaded file
git add .
git commit -m "..."
git push
vercel --prod --force   # --force bypasses build cache, use if a fix doesn't seem to show up
```

## Architecture ground rules
- Bug fixes before new features. Transaction is always source of truth.
- **CRITICAL — the file's #1 recurring bug class**: pieces of state that live at the very top of the whole app (`AppContent`) but are only ever used inside one nested "page" component (e.g. Settings, a specific modal) will cause that ENTIRE nested component to unmount/remount on every keystroke — because typing forces `AppContent` to re-render, which recreates the nested component as a "new" function. Symptom: keyboard closes after one letter, or the whole screen flashes/refreshes randomly. Fix: move that state inside the component that actually uses it. This exact bug hit the vehicle-entry screen once already — check any "random refresh" report against this pattern first.
- `window.confirm()` / `alert()` silently fail in this app's WebView. All confirmation dialogs must use the in-app `askConfirm(message, onConfirm)` helper instead. `restoreBackupSnapshot` still uses raw `window.confirm()` — known risk, never fixed, low priority since it only fires on manual restore.
- Before deleting/editing a large JSX block, always re-view the file immediately after the edit — several mistakes this session came from accidentally consuming a sibling block's opening/closing tags during a `str_replace` (e.g. deleting an adjacent `</div>` or an adjacent component's opening `{tab==="x"&&(<>`). Caught every time by immediately re-viewing, but only because of that habit.
- Before adding a duplicate-sounding feature, grep for existing state/mechanisms first. This session found and merged multiple accidentally-parallel systems: Membership vs. Fee Payment (merged), a legacy `Txn Breakup/Allocate` system with mode string `owes_by_me` (revived instead of rebuilt), `perPersonBudgets` object vs. each person's own `spendBudget` field (unified onto the person's own field, old object left as inert unused state).

## Navigation structure (current)
- Bottom nav: Home / Transactions / Bills / Wealth / Settings
- ☰ hamburger drawer (new, sits alongside bottom nav): User Profile, Budget, Goals (placeholder, "coming soon" alert only), Trips & Outings
- **Budget** (tab=`"budget"`) now has 3 sub-tabs: **Overview** (existing FY dashboard) | **Insights** (renamed from standalone "Stats", embedded via `<StatsPage embedded/>`) | **Budgets** (Per-Person + Group budget editors, tap a person to expand category breakdown → tap category to see transactions)
- Inside **Insights**: tabs are Overview | Cash Flow | Credit | Investments. Inside **Overview** specifically: a segmented control **Person | Month | Summary** (Month shows last 6 months vs `monthOverrides`/annual÷12, tap to expand category breakdown; Person shows category breakdown for a selected dependant, tap category for transactions; Summary = Financial Health + Household Cost)
- Settings now only holds true settings: Dark Mode, Auto-suggest Category, PIN & Lock, Manage Accounts, Vehicles, Manage Categories, Account/Income/Liability Types, Cloud Sync, Backup & Restore, User Guides, Release Notes.

## Biller system
- Shells (`billers`: `{id, name, type, provider}`) → Accounts (`billerAccounts`, each with `Nickname` — renamed from misleading "Biller Name" — + optional Account Number + optional Attribute To) → Bills/Memberships per account.
- Provider is asked once at first-account creation, then locked (with "Change" option) for every subsequent account under that shell.
- Biller Type picker locks whenever a type is already known (new account arriving from a category tap, OR editing an existing account) — full 35-chip grid only shows if genuinely nothing is set yet. This was a real bug (edit case was never locked, by design gap not accident) — fixed.
- "MY ACCOUNTS" quick row groups by shell (one tile per biller regardless of how many nicknamed accounts exist inside) — was showing one tile per account before, looked like duplicate icons. Fixed.
- Account picker in Add Bill shows "Nickname — Provider" format.

## Membership system — MAJOR REDESIGN this session (lifecycle-manager reframe)
Philosophy: a membership is "access for a period," payment is just how you got it. Rebuilt per this exact plan:
- `memberships` collection: each record is now a **Payment** with a `periods` array (not one fixed validFrom/validUntil). Old records (pre-redesign) still work via `getMembershipPeriods(m)` / `getCurrentPeriod(m)` helpers that synthesize an equivalent single period from the old flat fields — no migration script needed, fully backward compatible.
- **Add Membership**: Plan (Monthly/Quarterly/Annual/Custom, auto-computes Ends unless Custom) → Amount + Paid From → **One period / Multiple periods** toggle. Multiple periods = add named periods each with own from/to/amount, running "Allocated ₹X / ₹Y" total must match before saving.
- **Member picker removed entirely** — auto-derived from the account's own Attribute To (falls back to "self"). Same fix applied in the parallel inline membership panel inside the transaction form.
- **Membership Details** simplified to: Provider, Member, Payment Date, Payment Account, Note, Linked Transaction (if any).
- **Payment Allocation** view: each period shown with ✅ (past) / 🟢 (current) / ⏳ (future) status.
- **Hero Card** on the biller account screen: current period, days left, progress bar, amount paid, renewal banner auto-appears at ≤15 days left.
- **Timeline**: Current/Completed list of past payments.
- **Lifetime Analytics**: Lifetime Spend, First Joined, Payments Made, Avg Monthly Cost — all real computed values.
- Old redundant "per-person status" block (predated this redesign, showed inline on the account screen) removed — was broken against the new data model anyway.
- "Attach Past Expenses" button hidden for pure-membership-type accounts (kept for Bill/Hybrid types).
- Fixed: Home screen expiry/lapsed reminders now use `getCurrentPeriod()` instead of the old flat `validUntil` field (would have silently broken for all new-format records otherwise).

### 🐛 OPEN BUGS on the membership redesign (confirmed, NOT yet fixed — explicitly told to just diagnose, not fix, as of last message)
1. **Grace period was removed** in the main Add Membership rewrite. The *other*, separate inline membership panel (inside the transaction form, triggered by "+ Add dates" when linking a bill) still has grace days (`linkGraceDays`) — so the two entry points are now inconsistent. Needs a decision: add grace days back to the main flow, or remove from the inline one too, or redesign how grace period should work under the new period-allocation model.
2. **"Ends" date field is locked/disabled whenever Plan ≠ "Custom"** (`disabled={plan!=="custom"}`). So picking "Quarterly" but wanting a 30-day period instead of the standard ~90 days is currently impossible without switching to "Custom" — which loses the "Quarterly" semantic label on the record. This is the same underlying problem as the original 10-day-gym-catchup scenario from early in the conversation, resurfaced in the new design. Needs a fix that lets duration be overridden while keeping the plan label, or an explicit decision that Custom is the only path for non-standard durations.

### Also unconfirmed by user (built, not yet verified working end-to-end)
- Debt to Income Ratio report under Insights → Credit tab (code traced as correct, user hadn't confirmed visually as of last check — possible deploy-lag pattern seen repeatedly this session)
- Full membership redesign end-to-end on a real new multi-period payment (only spot-checks done so far)

## Cloud sync
- Real root cause of the long-running "app flashes/refreshes randomly" bug: Supabase's `onAuthStateChange` fires on periodic token refresh (not just real sign-in/out), and was calling `setCloudUser` with a fresh object every time — forcing a full app re-render on a recurring cycle. Fixed: only updates state when the signed-in user's actual ID changes. **User confirmed this fixed it.**
- Separately found and fixed: `vehicles`, `events`, `memberships`, `feePayments`, `perPersonBudgets`, `gifts` were all missing from the debounced cloud-push effect's dependency array — meaning changes to them never triggered an automatic push, so a reload would silently overwrite local changes with a stale cloud copy. This was the real cause of "vehicles keep getting deleted." Fixed for all six.

## Features built this session, roughly in order
Trips & Outings (F-Events-1, tag expenses to an occasion, separate from Groups) · You Owe standalone entry (no fake expense needed) · F10 category breakdown + monthly history per person · Essential/Discretionary spend fix (was using raw amounts, now uses `getMyExpenseAmount`) · Cash calibration toggle for accounts (needs-manual-calibration) · Nav drawer · Stats/Insights module (Cash Flow, Credit Utilization, Debt-to-Income, Recurring Debts, Investments tab reusing the existing Investments component) · Person/Month/Summary segmented Overview · Group budget monthly-comparison bug fix (was comparing against all-time cumulative spend, not the current month) · Budget tab consolidation (Person + Group budgets now read the same field as each entity's own profile, not a disconnected duplicate) · Biller flow fixes described above · Full membership lifecycle redesign described above.

## Known still-open items from earlier in the conversation, not touched this session
- F2 (FY Budget vs Actual 12-month table) — discussed, never built
- P2P/A2A Transfer — never resolved what it should represent
- Item-level itemized+person+category linkage — chose the lighter option, never built even that
- Credit Card Utilization Average/Max over time — deliberately skipped, needs real historical balance reconstruction (current `cardOutstanding` is hardcoded to "today")
- Add Transaction form length — discussed at length, agreed "smart defaults" (remember last-used Paid Via etc.) was the right direction for this specific user, never built
- Goals — still just a placeholder alert, no real feature
- "Subscriptions & Memberships" renaming — proposed in the lifecycle-manager doc, not decided/built
- ~10 other `alert()`-gated validation blocks flagged early on, never confirmed whether they misfire like the ones that were fixed

## Communication style notes for continuation
Direct, no fluff. Confirmed working practice this whole session: verify code claims by actually reading the file before asserting something works or is missing (deployment-lag false alarms happened repeatedly — always ask "did you redeploy the latest download and hard-refresh" before assuming a code bug when something "isn't showing"). Don't build multi-part asks in one shot without sequencing/confirming scope first — several early large redesigns got walked back or had to be corrected in placement because everything was attempted at once.
