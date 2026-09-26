// domain/group/reminders.js
//
// UI-2C D-8 / Q-3 — a group's reminders: a small optional list of
// { id, label, date } items stored on the group as `reminders`, shown as
// "Gas cylinder · 3 Oct". Dates only (D-9): nothing here schedules,
// notifies or implies that a notification will be sent.
//
// A group's notes are a plain optional `notes` string on the group, the
// same shape as a person's notes.

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseYMD(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ""));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** "3 Oct" for "2026-10-03"; the year is added when it isn't refYear. */
export function formatReminderDate(dateStr, refYear) {
  const d = parseYMD(dateStr);
  if (!d) return "";
  const base = `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
  return refYear && d.getFullYear() !== refYear ? `${base} ${d.getFullYear()}` : base;
}

function validate({ label, date }) {
  const clean = String(label || "").trim();
  if (!clean) throw new Error("A reminder needs a label.");
  if (!parseYMD(date)) throw new Error("A reminder needs a valid date.");
  return { label: clean, date };
}

export function getGroupReminders(group) {
  return Array.isArray(group?.reminders) ? group.reminders : [];
}

export function addGroupReminder(group, input, genId) {
  if (typeof genId !== "function") throw new Error("genId is required.");
  const clean = validate(input || {});
  return { ...group, reminders: [...getGroupReminders(group), { id: genId(), ...clean }] };
}

export function updateGroupReminder(group, reminderId, input) {
  const clean = validate(input || {});
  const list = getGroupReminders(group);
  if (!list.some(r => r.id === reminderId)) throw new Error("Reminder not found.");
  return { ...group, reminders: list.map(r => (r.id === reminderId ? { ...r, ...clean } : r)) };
}

export function removeGroupReminder(group, reminderId) {
  return { ...group, reminders: getGroupReminders(group).filter(r => r.id !== reminderId) };
}

/**
 * Reminders in date order, upcoming first, then past ones (most recent
 * first). Each gets its display text.
 */
export function getSortedGroupReminders(group, todayStr) {
  const today = String(todayStr || "");
  const withText = getGroupReminders(group)
    .filter(r => parseYMD(r.date))
    .map(r => ({ ...r, text: `${r.label} · ${formatReminderDate(r.date, Number(today.slice(0, 4)) || undefined)}`, past: r.date < today }));
  const upcoming = withText.filter(r => !r.past).sort((a, b) => a.date.localeCompare(b.date));
  const past = withText.filter(r => r.past).sort((a, b) => b.date.localeCompare(a.date));
  return [...upcoming, ...past];
}

export function getGroupNotes(group) {
  const n = typeof group?.notes === "string" ? group.notes.trim() : "";
  return { hasValue: n.length > 0, value: n };
}
