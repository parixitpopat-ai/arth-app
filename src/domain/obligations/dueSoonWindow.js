// domain/obligations/dueSoonWindow.js
//
// Payments v2 (WP18) Decision #5 — "Badges follow D-16... Due = due within
// 14 days, Unpaid = due later, Overdue = past due... Keep 14 as a single
// constant." Before this file existed, 14 was duplicated: billBalance.js
// (ADR-038, the one owner of a Bill's badge) had it hardcoded inline, and
// domain/relationships/attributedAccounts.js declared its own separate
// local DUE_WINDOW_DAYS = 14 for its own, functionally-identical badge
// read. Both now import this single constant instead.

export const DUE_SOON_DAYS = 14;
