/* Small helpers: dates, formatting, DOM. No dependencies. */

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}

/* ---------------- dates ----------------
   Keys are local calendar dates: 'YYYY-MM-DD'.
   The "day" rolls over at ROLLOVER_HOUR so a 12:40am check-in still
   belongs to the day you're finishing, not the one you haven't started. */

export const ROLLOVER_HOUR = 3;

export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayKey(now = new Date()) {
  const d = new Date(now.getTime());
  if (d.getHours() < ROLLOVER_HOUR) d.setDate(d.getDate() - 1);
  return dayKey(d);
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // midday: immune to DST edges
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export const dow = (key) => parseKey(key).getDay(); // 0 = Sunday

export const tomorrowKey = (now = new Date()) => addDays(todayKey(now), 1);

/** Week runs Sunday -> Saturday; the key is that Sunday's date.
    Sunday leads the week because that's when the reset and planning happen. */
export function weekKeyOf(key) {
  return addDays(key, -dow(key));
}

export function weekDays(wkKey) {
  return Array.from({ length: 7 }, (_, i) => addDays(wkKey, i));
}

export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function fmtDate(key, opts = { weekday: 'long', month: 'long', day: 'numeric' }) {
  return parseKey(key).toLocaleDateString(undefined, opts);
}

export function fmtShort(key) {
  return parseKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** 'Today' / 'Tomorrow' / 'Yesterday' / 'Sat, Mar 8' */
export function relDay(key, ref = todayKey()) {
  if (key === ref) return 'Today';
  if (key === addDays(ref, 1)) return 'Tomorrow';
  if (key === addDays(ref, -1)) return 'Yesterday';
  const withinWeek = daysBetween(ref, key);
  if (withinWeek > 0 && withinWeek < 7) return parseKey(key).toLocaleDateString(undefined, { weekday: 'long' });
  return parseKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function daysBetween(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}

/* ---------------- times ---------------- */

export function toMin(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fmtTime(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

export const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

/* ---------------- misc ---------------- */

export const pct = (a, b) => (b <= 0 ? 0 : Math.round((a / b) * 100));

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || one + 's'}`;
}

/** Stable sort by a key function. */
export function sortBy(arr, fn) {
  return arr.map((v, i) => [fn(v), i, v])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]))
    .map((t) => t[2]);
}
