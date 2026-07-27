# Architecture Debt Register v1

Behavior is frozen. Implementation is tracked here separately, so
technical debt is visible and prioritized rather than discovered
randomly later. Every entry below is verified against the actual code
— not assumed from the example table that prompted this register.

| ID | Debt | Priority | User Impact | Verified |
|---|---|---|---|---|
| AD-001 | Home calculates Safe to Spend / Protected Money / Today's Focus locally, not via a Forecast Engine function | Medium | None | Confirmed — `getTopFocusCards()`/`calculateProtectedMoney()` don't exist anywhere in the codebase |
| AD-002 | Home and Outlook duplicate the same opening-balance/commitment calculations independently — **refined after O001 comparison: this is two-tiered, not flat duplication.** Outlook's version reaches real `engine.js` calls (`calculateProjectedBalance`, `buildCashFlowTimeline`); Home's Protected Money stops at a plain `.reduce()` sum and never calls the engine at all. | Medium | None | Confirmed via direct comparison during O001's Freeze Package |
| AD-013 | CMP-016 (Commitment Card) was designed with a specific shape (icon/frequency/status chip) but never actually implemented — the real grouped Commitments list on O001 uses a simpler inline row | Low | None (visually adequate, just simpler than designed) | Confirmed during O001 Freeze Package |
| AD-003 | No shared Summary Card component — every "card" is the `card` style object applied inline, not an imported component | Low | None | Confirmed — no `<SummaryCard>` or `CMP-002` component exists; it's a style token, not a component |
| AD-004 | ~~Legacy Investment Reminder block still renders separately~~ **RESOLVED** — folded into Today's Focus, capped at 3 with "+N more in Investments" link | ~~High~~ Resolved | ~~Visible~~ None | Confirmed via real screenshot showing the old standalone card still live, then fixed and rebuilt |
| AD-005 | `calculateRecognition` blocked on schema — `recognitionMethod`/`recognitionDuration` fields don't exist on Bill | Low | None (not yet consumed anywhere) | Confirmed earlier this session |
| AD-006 | Per-instance Skip/Snooze don't exist on Bill — only whole-series Pause (`isPaused`) does | Medium | Visible if a user expects Skip/Snooze on a Commitment Detail screen that doesn't exist yet | Confirmed via code check, flagged originally at O019/UX-002 |
| AD-007 | Forecast Status thresholds are hardcoded, not product-configurable per ADR-022's own requirement | Low | None | Confirmed — `buffer<cashRequired*0.1`-style literals in `OutlookPage`, not named config values |
| AD-008 | Credit Card accounts have no `creditLimit` field — Available Limit/Utilisation always show "Not set"/"—" | Low | Visible (intentional honesty, not a bug, but still a real data-model gap) | Confirmed earlier this session |
| AD-009 | Vehicle has no `purchaseValue` field — Money's Vehicle section always shows "Value not set" | Low | Visible (same category as AD-008) | Confirmed earlier this session |
| AD-010 | Property and Business Assets have zero CRUD — pure static placeholders | High | Visible | Confirmed — no add/edit modal exists for either |
| AD-011 | Import (transactions) doesn't exist anywhere in the app | Medium | Visible | Confirmed, deliberately no fake link added anywhere |
| AD-012 | Analytics Engine doesn't exist — blocks all 15 Insights screens as a single dependency, not incrementally | High | Visible | Confirmed, unchanged since the original Screen Inventory |
| AD-014 | ~~Home had an entire second, undiscovered render path~~ **RESOLVED** — a duplicate greeting, a month navigator, and a Spent/Budget hero were sitting above the whole CARDS system this entire session, invisible until a real screenshot exposed it. Also put month navigation directly on Home, contradicting the explicit "month browsing belongs in Outlook" decision. Removed entirely; `dueRecurring` (investments due today, with Snooze) properly folded into Today's Focus in its place. | ~~High~~ Resolved | ~~Visible (very)~~ None | Confirmed via 4 real screenshots showing duplicate greetings and a Budget-style hero never touched by any of this session's Home work |

## Priority summary

**High (visible to users, worth prioritizing before more feature work):**
AD-010 (Property/Business Assets have no CRUD), AD-012 (Analytics Engine).

**Medium (real, but not user-visible yet or narrowly scoped):**
AD-001, AD-002, AD-006, AD-011.

**Low (correct-but-incomplete data model gaps, already handled honestly in the UI):**
AD-003, AD-005, AD-007, AD-008, AD-009.

**Resolved:** AD-004, AD-014.

Not a blocker to shipping. Not a reason to pause feature/screen work.
Reviewed and re-prioritized after each Freeze Package, not fixed
reactively mid-feature.
