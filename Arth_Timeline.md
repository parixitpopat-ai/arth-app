# Arth — Implementation Timeline
**Living Document · Updated: April 2026**
**Owner: Major | Built with: Claude**
**Current codebase: ~10,780 lines (monolith) · Live: arth-app.vercel.app**

---

## Guiding Principles
- Bug fixes always first, every week
- No new features until current phase is complete
- Weekly fix sessions — share latest .jsx, fix, deploy
- Modular refactor happens in parallel, not as a blocker
- Timeline is realistic, not optimistic — buffer built in

---

## Current Status — April 2026

### Completed ✅
- 18 spending categories with Fixed/Flexible tags
- FY budget (Apr–Mar) with month overrides
- Bills & Payables lifecycle (Unpaid → Paid)
- Balance checkpoints per account
- Supabase cloud sync (basic)
- Loans (given/taken), repayments, interest
- CC EMI plans + split tracking
- Groups & people, split/settle flow
- PIN lock, dark/light theme
- SMS parser + receipt image upload
- Investments (MF/SIP, stocks, FD, gold)
- CC refund reduces outstanding ✅
- Bill amounts net of refunds ✅
- Settlement mirrors bill status ✅
- To Receive merged per person (splits + loans) ✅
- SMS balance auto-sync ✅

### In Progress / Pending Bugs
- B3 — Items UI redesign (mobile bottom-sheet)
- B4 — Allocate cuts personal budget (resolved by F8)

---

## Phase 0 — Foundation
**Target: May–June 2026 · Duration: 6–8 weeks**

This is the most important phase. Everything else depends on it.

### Week 1–2 (May 1–15)
**0a — Modular Architecture Refactor**
- Break monolith into feature folders
- Extract hooks: useSettlements, useBudget, useSMS, useLoans
- Extract utils: fmt, todayStr, remainingShare, extractSmsBalance
- Extract constants: categories, units, frequencies
- Set up Zustand store for shared state
- App.jsx becomes shell only — routing + layout
- *Deliverable: Same app, modular structure, zero regressions*

### Week 3–4 (May 15–31)
**0b — Backup & Multi-Device Sync (F16)**
- Real-time auto-sync to Supabase on every change
- 7-day snapshot history with one-tap restore
- New device login → full data restores automatically
- Local JSON export with optional PIN encryption
- Conflict resolution — newer timestamp wins
- Sync status indicator in Settings
- *Deliverable: Data safe across devices, never lose data*

### Week 5–6 (June 1–15)
**0c — Security & Identity (F17)**
- Email + Password account creation via Supabase Auth
- PIN as device-level quick access only
- Session management + auto-lock after inactivity
- Wrong PIN lockout with escalation (5x → 30min, 10x → email)
- Data encryption at rest in Supabase
- Device management — view, remove, logout all
- Account recovery via email OTP + backup codes
- *Deliverable: Secure, identity-bound app*

### Week 7–8 (June 15–30) — Buffer + Testing
- Full regression testing across all features
- Performance optimisation (10k+ line app is slow on low-end phones)
- Fix any regressions from refactor
- *Deliverable: Stable, fast, secure foundation*

---

## Phase 1 — Bug Fixes (Ongoing)
**Throughout all phases · Weekly sessions**

| ID | Bug | Target |
|----|-----|--------|
| B3 | Items UI bottom-sheet redesign | May Week 1 |
| B4 | Allocate personal budget fix | Resolved by F8 |
| Any new bugs | As reported | Same week |

*Rule: No bug stays open more than 2 weeks.*

---

## Phase 2 — Core UX Overhaul
**Target: July 2026 · Duration: 4 weeks**

### Week 1–2 (July 1–15)
**F8 — Replace Split/Tag/Allocate**
- Single "Who is this for?" flow
- One toggle per person: "They owe me back" ON/OFF
- ON → receivable tracked
- OFF → attribution only, household budget
- Migrate existing split/tag/allocate data
- *Deliverable: No more confusing 3-mode system*

### Week 3–4 (July 15–31)
**F3 — Receivables Drill-down Redesign**
- To Receive tap → clean list: splits + bills + loans per person
- Person name, amount, breakdown sub-label
- Tap any row → person profile
- *Deliverable: One tap to see who owes what*

**F5 — Household Expense Mode**
- Expenses paid from pocket, used by all
- Goes to Household budget, not personal
- Fuel, groceries, utilities — clean separation
- *Deliverable: Personal spend is actually personal*

---

## Phase 3 — Budgeting Depth
**Target: August 2026 · Duration: 5 weeks**

### Week 1–2 (Aug 1–15)
**F9 — Per-Person & Per-Group Annual Budget**
- Set yearly budget per person/group (Apr–Mar)
- Tracks attributed spend against it
- Refunds restore headroom
- Visible in person/group profile

**F11 — Budget Carryover & Discipline Reminders**
- Show Planned vs Effective budget side by side
- Overspend shown as deduction line
- Underspend builds buffer pool
- 3 consecutive overspend months → reminder
- Never suggests increasing budget

### Week 3–4 (Aug 15–31)
**F10 — Per-Person & Per-Group Mini Dashboard**
- Open any person/group → full spend dashboard
- Month: Spent vs Budget, progress bar, safe/day
- Category breakdown of their spend
- Monthly history scrollable
- Annual FY vs yearly budget
- Rollover logic tied to F11

### Week 5 (Sep 1–7) — Buffer
**F2 — FY Budget vs Actual Table**
- 12-month Apr–Mar table
- Budgeted vs Actual vs Variance per month
- Category drill-down
- Running FY total

---

## Phase 4 — Recurring & Memberships
**Target: September 2026 · Duration: 3 weeks**

### Week 1–2 (Sep 8–22)
**F12 — Recurring & Membership Management**
- Frequencies: Monthly, Quarterly, Half-yearly, Annual
- Types: School fees, gym, OTT, phone, clubs
- Pause membership — counts days paused, resumes on date
- Free trial tracking — reminder before conversion
- Renewal reminders X days before (user sets X)
- Linked to Bills & Payables lifecycle

### Week 3 (Sep 22–30)
**F18 — Loan Amortisation & Policy Schedule**
- Input: principal, rate, tenure, start date
- Auto-generate month-by-month schedule
- Principal vs interest split per EMI
- Track actual payments against schedule
- Works for loans AND insurance premiums
- Next instalment due on Home screen

---

## Phase 5 — Notifications & Alerts
**Target: October 2026 · Duration: 2 weeks**

### Week 1–2 (Oct 1–15)
**F13 — Notifications & Reminders**

| Trigger | Notification |
|---------|-------------|
| Daily | Evening spend summary |
| Budget 80% | Warning with days left |
| Budget 100% | Overspend alert — immediate |
| Bill due | 3 days before + day of |
| EMI due | 3 days before |
| Gym/membership renewal | X days before |
| Free trial ending | 3 days before |
| 3 months overspend | Discipline reminder |
| Low account balance | User-set threshold |
| Sync failure | If cloud backup fails |
| Loan repayment due | On due date |

*Requires PWA push notification setup*

---

## Phase 6 — Reports & Analysis
**Target: October–November 2026 · Duration: 5 weeks**

### Week 1–2 (Oct 15–31)
**F1 — FY Annual Summary Screen**
- One screen: FY Income, Expenses, Savings, Investments
- Month-by-month table, tap to drill down

**R1 — Monthly Spend Report**
- Category-wise and person-wise breakdown
- Trend lines vs last month and last year same month

**R2 — Annual FY Report**
- Income, expenses, savings rate, investment growth
- Full Apr–Mar summary with charts

### Week 3–4 (Nov 1–15)
**R3 — Category Deep-Dive**
- Tap any category → all transactions
- Month trend, top merchants, vs budget

**R4 — Net Worth Trend**
- Total wealth movement month by month
- Assets vs liabilities over time

**R5 — Cash Flow Report**
- Income vs Expenses vs Investments
- Month by month, visual chart

### Week 5 (Nov 15–22)
**R6 — Person/Group Spend Report**
- Per-person spend analytics (part of F10)
- Group expense history and patterns
- Export as PDF or share

---

## Phase 7 — Data & Intelligence
**Target: November–December 2026 · Duration: 5 weeks**

### Week 1–2 (Nov 22 – Dec 5)
**F6 — Custom Units & Measures**
- Manage unit types in Settings → Data
- Learn from purchase history
- Smart suggestions by item name

**F7 — SMS Balance Auto-Sync** ✅ Already done

**F4 — CC Statement Mini-View**
- Per card: charges, payments, refunds, net due
- Reconcile Arth vs actual statement

### Week 3–4 (Dec 5–19)
**F14 — Smart Category Intelligence**
- Learn which merchants belong to which category
- Auto-suggest as you type
- Flag recurring items automatically

**Bank Statement Upload**
- Upload PDF/CSV → auto-import transactions
- Match against existing → flag duplicates

### Week 5 (Dec 19–31) — Buffer + Polish
- Performance pass across all features
- UI consistency review
- Fix any accumulated issues

---

## Phase 8 — Co-User & Family Access
**Target: January 2027 · Duration: 4 weeks**

**F19 — Co-User / Family Access Mode**
- Invite family members as co-users
- Each sees only what's attributed to them
- Read-only by default
- Owner controls access per person
- Powered by Supabase row-level security
- Wife sees her budget vs spend
- Kid sees their spend (financial literacy)
- No access to accounts, wealth, settings

---

## Phase 9 — AI Layer
**Target: February–March 2027 · Duration: 6 weeks**

*Built after sufficient data (6–12 months) exists in the system*

**F15 — AI Financial Advisor**

### On Demand
- "How did I do this month?"
- "Where am I bleeding money?"
- "Can I afford this vacation?"
- "What's my savings rate trend?"
- "How does April compare to last April?"

### Proactive Nudges (meaningful only, not noise)
- Unusual spend detected
- Savings rate dropping trend
- Bill you might be forgetting
- Investment opportunity based on surplus
- Consistent overspend pattern with specific category insight

### Built On
- Your actual Arth data only
- Privacy-first — no data shared
- Claude API integration (Anthropic)
- Conversational interface inside the app

---

## Summary Timeline

| Phase | What | When | Duration |
|-------|------|------|----------|
| 0 | Foundation — Modular + Backup + Security | May–June 2026 | 8 weeks |
| 1 | Bug fixes | Ongoing weekly | — |
| 2 | Core UX — F8 Split simplify + Receivables + Household | July 2026 | 4 weeks |
| 3 | Budgeting — Per-person, Carryover, Dashboard, FY table | Aug–Sep 2026 | 5 weeks |
| 4 | Recurring, Memberships, Amortisation | September 2026 | 3 weeks |
| 5 | Notifications & Reminders | October 2026 | 2 weeks |
| 6 | Reports & Analysis | Oct–Nov 2026 | 5 weeks |
| 7 | Data & Intelligence — Smart categories, Bank upload | Nov–Dec 2026 | 5 weeks |
| 8 | Co-User & Family Access | January 2027 | 4 weeks |
| 9 | AI Financial Advisor | Feb–Mar 2027 | 6 weeks |

**Total: ~12 months from May 2026 to March 2027**
**Full product complete: March 2027 (end of FY)**

---

## Weekly Session Protocol

1. Major shares latest `.jsx` file
2. Fix all open bugs first
3. Build next phase item
4. Test, deliver updated `.jsx`
5. Major deploys: `vercel --prod`
6. Update roadmap + timeline documents

---

## Risk & Buffer

| Risk | Mitigation |
|------|-----------|
| Week slips due to work | Each phase has 1 buffer week built in |
| Bug spike | Bugs always prioritised, features pause |
| Architecture refactor takes longer | Phase 0 has 2 buffer weeks |
| AI phase needs more data | F15 pushed to Apr 2027 if needed |
| Scope creep | No new requests until phase complete |

---

## Change Log

| Date | Change |
|------|--------|
| 27 Apr 2026 | Timeline created — full 12-month plan |

---

*Arth: React + Vite · Supabase · Vercel · Recharts*
*Repo: D:/arth-app · Live: arth-app.vercel.app*
*Stack target: Zustand + modular features + Supabase Auth*
