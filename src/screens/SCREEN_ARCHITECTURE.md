# Arth — Screen Architecture & Status

Living document. Update the Status column as work lands — this is the
single source of truth for "is X actually built," not memory or assumption.

Legend: ✅ Done · 🟡 Partial · ⬜ Not started

## Foundation
| Screen | Status | Notes |
|---|---|---|
| 1. Splash | ⬜ | PWA has no native splash; would be a loading overlay at most. |
| 2. Onboarding | ⬜ | Not started. |
| 3. Login & Security | 🟡 | PIN lock exists. Optional Google/Email sign-in (cloud sync) exists but isn't framed as an onboarding step. |

## Daily Experience
| Screen | Status | Notes |
|---|---|---|
| 4. Home | ✅ | Greeting, Financial Health Score (real formula), Action Centre, Quick Actions, Goals card, Events card, Stats, Category breakdown, CC summary, Bills, Recent Activity, AI Insight (rule-based, one card max). |
| 5. Add Transaction | ✅ | Quick Add: Amount → What was it? (live category detection) → Confirm → direct save, 3 taps. "More options" routes to the full legacy form (2,600+ lines, untouched) for splits/people/groups/investments. |
| 6. Timeline | ✅ V1 COMPLETE | See detail below. Core is stable; voice entry, natural language, OCR, AI categorization, undo, and Timeline Replay are V2 — deliberately not in scope for V1. |

### Screen 6 — Transaction Timeline

**Status: ✅ V1 COMPLETE**

**Implemented**
- Swipe actions (right: ⭐ Favourite / 🔁 Repeat, left: 📤 Share / 🗑️ Delete) — via a `SwipeableTxnRow` wrapper, `TxnRow` itself untouched (still used as-is by Home Recent and Account Detail)
- Date grouping: Today / Yesterday / Earlier This Week / This Month / Older
- Sticky section headers with per-bucket spend totals
- Search (pre-existing, confirmed working)
- Advanced filters: type, category, person, group, date range, amount range, account, reimbursable-only (pre-existing, confirmed working — more extensive than initially assessed)
- Bulk select (toggle button, not gesture-based long-press — chosen for reliability over a fragile gesture)
- Bulk delete, bulk category change, bulk CSV export (real file download: date/merchant/category/amount/type — CSV mechanics now come from `reports/csv.js`; the column definition and transaction→row mapping stay local, since that's business logic, not CSV plumbing)

**Deferred (V2)**
- Month Replay (Timeline Replay)
- AI Highlights on transactions (AI categorization)
- Receipt OCR preview
- Voice entry
- Natural language search/commands
- Undo (delete/edit)

**Regression Checklist**
- ✓ Existing transactions render correctly (grouping/sorting is additive, no data shape changes)
- ✓ Existing filters still work (untouched)
- ✓ Existing search still works (untouched)
- ✓ Offline — no new network dependency introduced
- ✓ Backward compatible — no new required fields on the transaction object; `favorite` defaults to falsy for every pre-existing transaction

**Known correction:** an earlier claim that "both swipe-wrapped TxnRow usages are inside Timeline" was wrong — one is inside a Group's transaction view in People (harmless, but worth knowing precisely what changed where).

## Money Management
| Screen | Status | Notes |
|---|---|---|
| 7. Money | 🟡 | Exists as "Wealth" tab, renamed. Account Story / Money Map not built. |
| 8. Bills | ✅ | Needs Attention/Pinned/All Billers, Connection Dashboard, Analytics, Units/Meter fields, Credit Cards folded into the Biller hierarchy, shell/account/provider editing. |
| 9. Budgets | ✅ | Monthly Dashboard, per-month person/group overrides, Annual Person View, "Can I Afford This?", alerts (Notifications only, not duplicated on Home). |
| 10. Goals | ✅ | Create/edit, manual or account-auto-tracked progress, list, completion, Home card. **Extracted** into `src/screens/GoalsScreen.jsx` — first true component extraction (not just a utility module), per the Extraction Readiness Score. |
| 11. Events | ✅ | Was already more built than assessed (expense linking, spend totals, people). Added: Budget field + progress tracking. **Extracted** into `src/screens/EventsScreen.jsx` — second screen extraction, first one built using the Design System (BottomSheet, EmptyState). |
| 12. Reports | ⬜ | No dedicated screen. Fragments exist (Bill Analytics, Budget Insights) but nothing unified. |

## Wealth
| Screen | Status | Notes |
|---|---|---|
| 13. Wealth (unified hub) | 🟡 | Data exists (Net Worth, Investments, Assets, Loans) but not unified into one tabbed hub. No Financial Freedom Meter, no Scenario Planner. |

## Life
| Screen | Status | Notes |
|---|---|---|
| 14. People | ✅ | Modules/capabilities system, Person Dashboard, Add Person/Group wizards, settlements, gifts, debt transfer. |
| 15. AI + Search | ⬜ | Deliberately parked ("build the engine first, intelligence later"). |

## Storage & Personal
| Screen | Status | Notes |
|---|---|---|
| 16. Documents | ⬜ | Attachments exist per-bill/transaction. No unified vault. |
| 17. Profile (Me) | 🟡 | Financial Health Score is real and reusable here. Achievements, Streaks, Personal Statistics not built. |

## System
| Screen | Status | Notes |
|---|---|---|
| 18. Settings | 🟡 | Pre-existing, functional, not yet reorganized into the locked structure. |

## Cross-cutting, not screen-specific
| Item | Status |
|---|---|
| Daily wealth/budget snapshot recorder | ✅ Recording silently, no UI yet. Feeds Net Worth Growth in the Health Score. |
| Financial Health Score formula | ✅ Implemented, matches locked weights. |
| Green rebrand | ✅ Base theme + all session-added blue instances. |
| Nav shell (Home/Timeline/+/Money/Me) | ✅ |
| Group/Person spend double-count bug | ✅ Fixed. |
| Person budget doubling bug | ✅ Fixed. |
| Duplicate biller shells bug | ✅ Fixed + auto-cleanup. |
| Cloud sync bugs (stale snapshot, no re-pull, sign-in data loss) | ✅ Fixed, with mandatory pre-overwrite backup. |
| Pass 3A extraction (theme, dateHelpers, textHelpers, constants, investmentConfig, formatters) | ✅ Done. Validated via real bundling (esbuild --bundle), not just single-file syntax check. See `DEPENDENCY_MAP.md`. |
