// domain/transactions/naturalLanguageExpense.js
//
// Turns one typed sentence ("I paid ₹3,000 to Domino's via credit card ending 3445") into an expense DRAFT.
// Deterministic, no network, no dependencies, and pure: it never reads or writes app state, so parsing alone
// cannot create a transaction. The caller shows the draft for confirmation and saves only on the person's tap.
//
// Three small steps, each separately testable:
//   parseExpenseText(text, {now})              -> what the sentence says (amount, merchant, date, payment words)
//   resolvePaymentAccount(payment, accounts)   -> which existing account that points at: one, several, or none
//   resolveCategory(text, cats)                -> which existing category a stated one points at
// buildExpenseDraft() runs all three. Nothing here ever invents a value: anything unclear becomes a question.
//
// Scope (v1): INR, common English phrasing, purchases only. A credit-card BILL payment, a repayment and money
// received are recognised and refused (intent !== "expense") so they are never recorded as purchases.

const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const MONTH_RX = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const validDate = (y, m, d) => {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
};

// "12 Oct", "12th October 2026", "Oct 12", "October 12th, 2026"
function namedMonthDate(text) {
  const dayFirst = new RegExp(`\\b(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RX})\\b,?(?:\\s+(\\d{4}))?`, "i").exec(text);
  if (dayFirst) return { day: +dayFirst[1], month: MONTHS[dayFirst[2].toLowerCase()], year: dayFirst[3] ? +dayFirst[3] : null, span: [dayFirst.index, dayFirst.index + dayFirst[0].length] };
  const monthFirst = new RegExp(`\\b(?:on\\s+)?(${MONTH_RX})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b,?(?:\\s+(\\d{4}))?`, "i").exec(text);
  if (monthFirst) return { day: +monthFirst[2], month: MONTHS[monthFirst[1].toLowerCase()], year: monthFirst[3] ? +monthFirst[3] : null, span: [monthFirst.index, monthFirst.index + monthFirst[0].length] };
  return null;
}

// Replace a matched span by a same-length run of NULs so later steps cannot reuse it and indices stay aligned.
const blank = (s, start, end) => s.slice(0, start) + "\u0000".repeat(end - start) + s.slice(end);

const AMOUNT_NUM = "\\d[\\d,]*(?:\\.\\d{1,2})?";
const toAmount = raw => {
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

const LAST4_RX = new RegExp(
  "(?:ending(?:\\s+(?:in|with|at))?|last\\s*(?:4|four)(?:\\s*digits?)?(?:\\s*(?:of|is|are))?|card\\s*(?:no\\.?|number|#)?|x{2,}|\\*+|\\u2022+|\\.{2,}|\\u2026)\\s*[:\\-]?\\s*(\\d{4})(?!\\d)",
  "gi"
);

// ---- intent: purchase vs card-bill payment vs repayment/incoming ------------------------------------------------
// Sentences that are not purchases, and what each one is. Order matters: the first match names it.
const NOT_A_PURCHASE = [
  { kind: "refund", rx: /\b(refund(?:ed)?|reimburs\w*|cashback|got\s+back)\b/i, name: "a refund" },
  { kind: "repayment", rx: /\b(paid\s+me|paid\s+back|pay(?:ing)?\s+back|repaid|repay|settled\s+up|returned)\b/i, name: "a repayment" },
  { kind: "income", rx: /\b(received|credited|salary)\b/i, name: "income" },
];
const PAYMENT_PREPOSITIONS = /^(via|using|with|by|through|from|on|at|in)$/i;

function isCardBillPayment(lower) {
  if (/\b(credit\s*card|cc|card)\s*(bill|payment|statement|dues?|outstanding)\b/.test(lower)) return true;
  if (/\b(bill|statement|dues?|outstanding)\b.{0,25}\b(credit\s*card|cc|card)\b/.test(lower)) return true;
  // "paid 5000 to my HDFC credit card": the card is the thing being paid, not the way of paying. A card named after
  // via / using / with / on / by / through is the way of paying ("paid 3000 to Domino's via credit card").
  const m = /\b(?:paid|pay|payment|cleared|settled)\b/.exec(lower);
  if (m) {
    const rest = lower.slice(m.index);
    const cc = /\b(credit\s*card|cc)\b/.exec(rest);
    if (cc) {
      const before = rest.slice(0, cc.index).trim().split(/\s+/);
      const near = before.slice(-4);
      const viaCard = near.some(w => PAYMENT_PREPOSITIONS.test(w));
      const toCard = near.some(w => /^(to|towards|for)$/.test(w));
      if (toCard && !viaCard) return true;
    }
  }
  return false;
}

// ---- main parser ------------------------------------------------------------------------------------------------
export function parseExpenseText(input, { now = new Date(), _amountOnly = false } = {}) {
  const raw = String(input ?? "").trim();
  const result = {
    raw, intent: "expense", message: null, detected: null,
    amount: null, merchant: null, description: null,
    date: null, dateStated: false,
    payment: { kind: null, last4: null },
    categoryText: null,
    questions: [],
  };
  if (!raw) { result.intent = "empty"; return result; }

  // Same length as raw, so indices carry over to the original text (keeps the person's own apostrophes).
  let work = raw.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
  const lower = work.toLowerCase();

  const refuse = (kind, message) => {
    result.intent = kind === "card_payment" ? "card_payment" : "not_a_purchase";
    result.detected = kind;
    result.message = message;
    // Carry the amount over so the full form does not need it typed again.
    const amountOnly = parseExpenseText(raw, { now, _amountOnly: true });
    result.amount = amountOnly.amount;
    return result;
  };
  if (!_amountOnly) {
    if (isCardBillPayment(lower)) return refuse("card_payment", "This looks like a card bill payment. Use the full form for that.");
    const hit = NOT_A_PURCHASE.find(n => n.rx.test(lower));
    if (hit) {
      return refuse(hit.kind, hit.kind === "income"
        ? "Income isn't supported here yet. Use the full form for that."
        : `This looks like ${hit.name}. Use the full form for that.`);
    }
  }

  // 1. card suffix (also blanked so its digits are never read as an amount)
  const last4s = new Set();
  for (const m of [...work.matchAll(LAST4_RX)]) {
    last4s.add(m[1]);
    // Blank the digits only: the words before them ("credit card") still say what kind of card it is.
    const digitsAt = m.index + m[0].lastIndexOf(m[1]);
    work = blank(work, digitsAt, digitsAt + 4);
  }
  if (last4s.size === 1) result.payment.last4 = [...last4s][0];
  if (last4s.size > 1) result.questions.push({ field: "payment", code: "card-last4-ambiguous", message: `I found more than one card ending (${[...last4s].join(", ")}). Which card was it?` });

  // 2. date
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const setDate = (dt, span) => {
    result.dateStated = true;
    work = blank(work, span[0], span[1]);
    if (dt > today) {
      result.questions.push({ field: "date", code: "date-future", message: "That date is in the future. Which date was it?" });
      return;
    }
    result.date = ymd(dt);
  };
  const dateProblem = span => {
    result.dateStated = true;
    work = blank(work, span[0], span[1]);
    result.questions.push({ field: "date", code: "date-unreadable", message: "I could not read that date. Please check the date below." });
  };
  let dm;
  if ((dm = /\b(?:on\s+)?day\s+before\s+yesterday\b/i.exec(work))) {
    const dt = new Date(today); dt.setDate(dt.getDate() - 2); setDate(dt, [dm.index, dm.index + dm[0].length]);
  } else if ((dm = /\b(?:on\s+)?yesterday\b/i.exec(work))) {
    const dt = new Date(today); dt.setDate(dt.getDate() - 1); setDate(dt, [dm.index, dm.index + dm[0].length]);
  } else if ((dm = /\b(?:on\s+)?today\b/i.exec(work))) {
    result.dateStated = true; result.date = ymd(today); work = blank(work, dm.index, dm.index + dm[0].length);
  } else if ((dm = /\b(?:on\s+)?(\d{4})-(\d{2})-(\d{2})\b/.exec(work))) {
    const dt = validDate(+dm[1], +dm[2], +dm[3]);
    dt ? setDate(dt, [dm.index, dm.index + dm[0].length]) : dateProblem([dm.index, dm.index + dm[0].length]);
  } else if ((dm = /\b(?:on\s+)?(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})\b/.exec(work))) {
    // Indian order: day / month / year.
    const y = dm[3].length === 2 ? 2000 + +dm[3] : +dm[3];
    const dt = validDate(y, +dm[2], +dm[1]);
    dt ? setDate(dt, [dm.index, dm.index + dm[0].length]) : dateProblem([dm.index, dm.index + dm[0].length]);
  } else if ((dm = namedMonthDate(work))) {
    const { day, month, year, span } = dm;
    if (year) {
      const dt = validDate(year, month, day);
      dt ? setDate(dt, span) : dateProblem(span);
    } else {
      const dt = validDate(today.getFullYear(), month, day);
      if (!dt) dateProblem(span);
      else if (dt > today) {
        // Could be last year; that is a guess, so ask.
        result.dateStated = true; work = blank(work, span[0], span[1]);
        result.questions.push({ field: "date", code: "date-year", message: "Which year was that date in? It would be in the future this year." });
      } else setDate(dt, span);
    }
  }
  if (!result.date && !result.questions.some(q => q.field === "date")) result.date = ymd(today);

  // 3. amount: currency-marked first; otherwise one unmarked number
  const marked = [];
  const mk = new RegExp(`(?<![a-z])(?:\\u20b9|rs\\.?|inr|rupees?)\\s*(${AMOUNT_NUM})|(${AMOUNT_NUM})\\s*(?:\\u20b9|rs\\b\\.?|inr\\b|rupees?\\b)`, "gi");
  for (const m of [...work.matchAll(mk)]) {
    marked.push({ value: toAmount(m[1] ?? m[2]), start: m.index, end: m.index + m[0].length });
  }
  let amountSpans = marked;
  if (!marked.length) {
    amountSpans = [...work.matchAll(new RegExp(`(?<![\\w.\\u0000])(${AMOUNT_NUM})(?![\\w\\u0000])`, "g"))]
      .map(m => ({ value: toAmount(m[1]), start: m.index, end: m.index + m[0].length }));
  }
  const distinct = [...new Set(amountSpans.map(a => a.value))];
  if (distinct.length === 1 && distinct[0] > 0 && distinct[0] < 1e10) result.amount = distinct[0];
  else if (distinct.length === 0) result.questions.push({ field: "amount", code: "amount-missing", message: "How much was it?" });
  else if (distinct.length > 1) result.questions.push({ field: "amount", code: "amount-ambiguous", message: "I found more than one amount. How much was the total?" });
  else result.questions.push({ field: "amount", code: "amount-invalid", message: "That amount is not valid. How much was it?" });
  amountSpans.slice().sort((a, b) => b.start - a.start).forEach(a => { work = blank(work, a.start, a.end); });

  // 4. payment kind
  const wl = work.toLowerCase();
  const kinds = new Set();
  if (/\b(credit\s*card|cc)\b/.test(wl)) kinds.add("cc");
  if (/\bdebit\s*card\b/.test(wl)) kinds.add("debit");
  if (/\b(upi|gpay|google\s*pay|phonepe|paytm)\b/.test(wl)) kinds.add("upi");
  if (/\b(?:in|with|by|via|using)\s+cash\b|\bcash\s+payment\b|\bpaid\s+cash\b/.test(wl)) kinds.add("cash");
  if (/\b(net\s*banking|neft|imps|bank\s+(?:account|transfer))\b/.test(wl)) kinds.add("bank");
  if (!kinds.size && result.payment.last4 && /\bcard\b/.test(wl)) kinds.add("card");
  if (kinds.size === 1) result.payment.kind = [...kinds][0];
  if (kinds.size > 1) result.questions.push({ field: "payment", code: "payment-kind-ambiguous", message: "I found more than one way of paying. Which one was it?" });

  // 5. category, only when stated: "category food", "under groceries", "categorised as travel"
  const cm = /\b(?:category(?:\s+is)?|categori[sz]ed\s+as|under|tagged)\s+(?:the\s+)?([a-z][a-z &/-]{1,30}?)(?:\s+category)?(?=\s+(?:via|using|with|on|by|ending|yesterday|today)\b|[,.;]|\s*$)/i.exec(work);
  if (cm) { result.categoryText = cm[1].trim(); work = blank(work, cm.index, cm.index + cm[0].length); }

  // 6. merchant: the words after to / at / from, up to the next joining word, number, or punctuation
  const STOP = /^(via|using|with|on|by|through|from|for|in|ending|yesterday|today|and|paid|pay|spent|bought|using|my)$/i;
  const tokens = [...work.matchAll(/\S+/g)].map(m => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
  const clean = t => t.replace(/[.,;:!?]+$/g, "");
  const takeName = from => {
    const parts = [];
    for (let i = from; i < tokens.length && parts.length < 7; i++) {
      const t = tokens[i];
      if (t.text.includes("\u0000")) break;
      const bare = clean(t.text);
      if (!bare || (parts.length && STOP.test(bare))) break;
      if (!parts.length && STOP.test(bare) && !/^my$/i.test(bare)) break;
      parts.push(t);
      if (/[.,;!?]$/.test(t.text)) break;
    }
    if (!parts.length) return null;
    const start = parts[0].start;
    const end = parts[parts.length - 1].start + clean(parts[parts.length - 1].text).length;
    return raw.slice(start, end).replace(/^["']+|["']+$/g, "").trim() || null;
  };
  for (let i = 0; i < tokens.length && !result.merchant; i++) {
    if (/^(to|at|from)$/i.test(tokens[i].text)) {
      if (/^to$/i.test(tokens[i].text) && i > 0 && /^(went|going|back|due|get|go)$/i.test(clean(tokens[i - 1].text))) continue;
      result.merchant = takeName(i + 1);
    }
  }
  for (let i = 0; i < tokens.length && !result.description; i++) {
    if (/^for$/i.test(tokens[i].text)) result.description = takeName(i + 1);
  }
  if (!result.merchant && result.description) { result.merchant = result.description; result.description = null; }
  if (!result.merchant) result.questions.push({ field: "merchant", code: "merchant-missing", message: "Where or what was it for?" });

  return result;
}

// ---- which existing account? --------------------------------------------------------------------------------------
const EXPECTED_TYPES = { cc: ["cc"], debit: ["debit"], upi: ["upi"], cash: ["cash"], bank: ["bank"], card: ["cc", "debit"] };
const KIND_LABEL = { cc: "credit card", debit: "debit card", upi: "UPI", cash: "cash account", bank: "bank account", card: "card" };
const last4Of = a => String(a?.last4 ?? "").trim();
const label = a => `${a.name}${last4Of(a) ? ` ··${last4Of(a)}` : ""}`;

// Where the expense is recorded: a credit card is charged directly (the bank is untouched until the bill is paid);
// a debit card or UPI handle is a way of paying from its linked bank (or card), exactly as Quick Add already does.
function target(account, accounts, paidFrom) {
  let accId = account.id, paymentMethod = null;
  if (account.type === "debit" || account.type === "upi") {
    const parentId = account.type === "debit" ? account.linkedBank : account.linkedAccount;
    const parent = accounts.find(a => String(a.id) === String(parentId));
    if (!parent) return null;
    accId = parent.id;
    paymentMethod = parent.type === "bank" ? account.name : null;
  }
  if (paidFrom && !paidFrom.some(a => String(a.id) === String(accId))) return null;
  return { accId, paymentMethod };
}

export function resolvePaymentAccount(payment, accounts, { paidFrom = null } = {}) {
  const { kind = null, last4 = null } = payment || {};
  const list = Array.isArray(accounts) ? accounts : [];
  if (!kind && !last4) return { status: "unspecified", candidates: [], message: "Which account did you pay from?" };
  if (!kind) return { status: "needs-type", candidates: [], message: `Which kind of account ends in ${last4}: credit card, debit card or bank account?` };

  const expected = EXPECTED_TYPES[kind] || [];
  const ofType = list.filter(a => expected.includes(a.type));
  const pool = last4 ? ofType.filter(a => last4Of(a) === last4) : ofType;
  const usable = pool.map(a => ({ account: a, label: label(a), ...(target(a, list, paidFrom) || {}) })).filter(c => c.accId);
  const unusable = pool.length - usable.length;

  if (usable.length === 1) {
    const only = usable[0];
    return { status: "resolved", accId: only.accId, paymentMethod: only.paymentMethod, via: only.label, byLast4: !!last4, candidates: usable, message: null };
  }
  if (usable.length > 1) {
    return { status: "ambiguous", candidates: usable, message: last4
      ? `More than one ${KIND_LABEL[kind]} ends in ${last4}. Which one?`
      : `You have more than one ${KIND_LABEL[kind]}. Which one?` };
  }
  const otherType = last4 ? list.filter(a => !expected.includes(a.type) && last4Of(a) === last4) : [];
  if (otherType.length) {
    return { status: "wrong-type", candidates: [], otherType, message: `No ${KIND_LABEL[kind]} ending ${last4}, but ${otherType.map(a => `${label(a)} (${a.type})`).join(" and ")} does. Pick the account below.` };
  }
  if (unusable) {
    return { status: "none", candidates: [], message: `That ${KIND_LABEL[kind]} is not linked to an account an expense can be recorded against. Pick the account below.` };
  }
  const cardWord = kind === "cc" || kind === "debit" || kind === "card" ? "card" : KIND_LABEL[kind];
  return { status: "none", candidates: [], message: last4
    ? `No ${cardWord} ending ${last4}. Pick one below or check the number.`
    : `No ${KIND_LABEL[kind]} set up. Pick an account below.` };
}

// ---- which existing category? ---------------------------------------------------------------------------------------
const catWords = s => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean).map(w => w.replace(/s$/, ""));

export function resolveCategory(text, cats) {
  const want = catWords(text);
  if (!want.length) return { status: "none" };
  const hits = (Array.isArray(cats) ? cats : []).filter(c => {
    const have = catWords(c.name);
    return want.every(w => have.includes(w)) || want.join(" ") === have.join(" ");
  });
  if (hits.length === 1) return { status: "resolved", catId: hits[0].id, name: hits[0].name };
  if (hits.length > 1) return { status: "ambiguous", candidates: hits.map(c => ({ catId: c.id, name: c.name })) };
  return { status: "unmatched" };
}

// ---- soft check for a repeated submission ---------------------------------------------------------------------------
const normName = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
export function findPossibleDuplicate({ amount, merchant, date, accId }, txns) {
  return (Array.isArray(txns) ? txns : []).filter(t =>
    t && t.type === "expense" && t.date === date && String(t.accId) === String(accId)
    && Math.abs(Number(t.amount || 0) - Number(amount || 0)) < 0.005
    && normName(t.merchant || t.desc) === normName(merchant));
}

// ---- everything together ---------------------------------------------------------------------------------------------
export function buildExpenseDraft(text, { accounts = [], cats = [], paidFrom = null, now = new Date() } = {}) {
  const parsed = parseExpenseText(text, { now });
  if (parsed.intent !== "expense") return { ...parsed, account: null, category: null };
  const account = resolvePaymentAccount(parsed.payment, accounts, { paidFrom });
  const category = parsed.categoryText ? resolveCategory(parsed.categoryText, cats) : { status: "none" };
  const questions = [...parsed.questions];
  if (account.status !== "resolved" && !questions.some(q => q.field === "payment")) {
    questions.push({ field: "payment", code: `account-${account.status}`, message: account.message });
  }
  if (parsed.categoryText && category.status !== "resolved") {
    questions.push({ field: "category", code: `category-${category.status}`, message: category.status === "ambiguous"
      ? `More than one category matches "${parsed.categoryText}". Pick one, or leave it unassigned.`
      : `I do not have a category called "${parsed.categoryText}". Pick one, or leave it unassigned.` });
  }
  return { ...parsed, questions, account, category };
}
