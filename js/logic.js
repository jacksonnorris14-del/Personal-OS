/* Domain logic: what the app *knows* about a given day or week.
   Kept apart from storage so the rules stay readable and testable. */

import { state, getDay, FAITH_KINDS, currentProject, taskById } from './store.js';
import { dow, weekKeyOf, weekDays, addDays, todayKey, toMin, nowMin, fmtTime, daysBetween } from './util.js';

/* ---------------- faith ---------------- */

export function faithFor(key) {
  const kind = state.settings.faith.plan[dow(key)] || 'none';
  if (kind === 'none') return null;
  const meta = FAITH_KINDS[kind] || FAITH_KINDS.personal;
  return { kind, emoji: meta.emoji, label: meta.label };
}

/* ---------------- sleep ---------------- */

export function sleepTargets(key) {
  const s = state.settings.sleep;
  // Friday and Saturday *nights* may carry a little slack, if you set any.
  const shift = [5, 6].includes(dow(key)) ? (s.weekendShift || 0) : 0;
  const bump = (t) => {
    if (!shift) return t;
    const m = toMin(t) + shift;
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  return {
    windDown: bump(s.windDown),
    phoneAway: bump(s.phoneAway),
    bedtime: bump(s.bedtime),
    wake: s.wake,
    shifted: shift > 0
  };
}

/* ---------------- fitness ---------------- */

export function workoutStats(wkKey, ref = todayKey()) {
  const f = state.settings.fitness;
  const days = weekDays(wkKey);
  const done = days.filter((k) => getDay(k).workout).length;
  const remaining = days.filter((k) => (
    daysBetween(ref, k) >= 0 && !f.excluded.includes(dow(k)) && !getDay(k).workout
  )).length;
  return {
    done,
    min: f.min,
    ideal: f.ideal,
    remaining,
    metMin: done >= f.min,
    metIdeal: done >= f.ideal,
    /** true when every remaining opportunity is needed to reach the minimum */
    tight: done < f.min && remaining > 0 && remaining <= f.min - done
  };
}

export function socialStats(wkKey) {
  const s = state.settings.social;
  const done = weekDays(wkKey).filter((k) => getDay(k).social).length;
  return { done, min: s.min, ideal: s.ideal, metMin: done >= s.min, over: done > s.ideal };
}

/* ---------------- daily standards ----------------
   Standards adapt to the day: the faith row shows the commitment actually
   scheduled, school is quiet on weekends, and movement is only "required"
   when it's the last chance to reach the weekly minimum. */

export function standardsFor(key) {
  const d = getDay(key);
  const wd = dow(key);
  const out = [];

  for (const st of state.settings.standards) {
    if (st.type === 'faith') {
      const f = faithFor(key);
      if (!f) continue;
      out.push({ ...st, emoji: f.emoji || st.emoji, label: f.label, required: st.required !== false, done: !!d.faith, field: 'faith' });
      continue;
    }

    if (!(st.days || []).includes(wd)) continue;

    if (st.type === 'school') {
      out.push({ ...st, done: !!d.school, field: 'school', required: st.required !== false });
      continue;
    }

    if (st.type === 'money') {
      // Sunday's business work is the review inside Sunday Reset.
      out.push({ ...st, done: !!d.money, field: 'money', required: st.required !== false && wd !== 0 });
      continue;
    }

    if (st.type === 'move') {
      if (state.settings.fitness.excluded.includes(wd)) continue;
      const w = workoutStats(weekKeyOf(key), key);
      out.push({
        ...st,
        done: !!d.workout,
        field: 'workout',
        required: w.tight,
        note: w.metMin ? 'Minimum already met — bonus' : w.tight ? 'Needed to hit your minimum' : ''
      });
      continue;
    }

    out.push({ ...st, done: !!d.std[st.id], field: null, required: st.required !== false });
  }

  return out;
}

export function toggleStandard(dayRec, st) {
  if (st.field) dayRec[st.field] = !dayRec[st.field];
  else dayRec.std[st.id] = !dayRec.std[st.id];
}

/** How the day is going, without keeping score against you. */
export function dayStatus(key) {
  const d = getDay(key);
  const stds = standardsFor(key);
  const req = stds.filter((s) => s.required);
  const reqDone = req.filter((s) => s.done).length;
  const must = taskById(d.mustId);
  const seconds = (d.secondIds || []).map(taskById).filter(Boolean);
  return {
    standards: stds,
    required: req.length,
    requiredDone: reqDone,
    held: req.length > 0 && reqDone === req.length,
    must,
    mustDone: !!must?.done,
    seconds,
    secondsDone: seconds.filter((t) => t.done).length,
    allDone: !!must?.done && req.length === reqDone && seconds.every((t) => t.done)
  };
}

/* ---------------- never miss twice ----------------
   One nudge, at most. Yesterday's miss is information, not a verdict. */

export function nudgeFor(key) {
  const y = addDays(key, -1);
  const yd = state.days[y];
  if (!yd) return null;
  const d = getDay(key);

  if (!yd.bed && !d.bed) {
    const twoAgo = state.days[addDays(key, -2)];
    return twoAgo && !twoAgo.bed
      ? { icon: '😴', text: 'Two nights off schedule. Tonight, just be in bed at the target — nothing else has to be perfect.' }
      : { icon: '😴', text: 'Bedtime slipped last night. Never miss twice — tonight is the one that counts.' };
  }
  const yFaith = faithFor(y);
  if (yFaith && !yd.faith) {
    const t = faithFor(key);
    if (t) return { icon: '✝️', text: `Missed ${yFaith.label.toLowerCase()} yesterday. Today's ${t.label.toLowerCase()} brings it back.` };
  }
  if (!yd.money && (yd.mustId || yd.plannedAt)) {
    return { icon: '💼', text: 'No business work yesterday. Ten honest minutes today resets the pattern.' };
  }
  return null;
}

/* ---------------- money engine ---------------- */

export function projectTasks(projectId, { open = true } = {}) {
  return state.tasks.filter((t) => t.projectId === projectId && (open ? !t.done : true));
}

export function buildLearnBalance(days = 14, ref = todayKey()) {
  const since = addDays(ref, -(days - 1));
  let build = 0, learn = 0;
  for (const t of state.tasks) {
    if (!t.done || !t.doneAt) continue;
    const k = t.date || '';
    if (k && k < since) continue;
    if (t.kind === 'build') build++;
    else if (t.kind === 'learn') learn++;
  }
  return { build, learn, total: build + learn };
}

/* ---------------- recurring reminders ----------------
   Upkeep that repeats on its own clock: every N days, or every N weeks on a
   chosen day. A reminder only appears once it is actually due, and stays until
   it is done — missing Sunday doesn't erase it, it just carries. */

/** The most recent date on or before `key` that this reminder was due. */
export function lastDueOn(r, key) {
  if (r.mode === 'weekly') {
    const every = Math.max(1, r.every || 1);
    const days = r.days?.length ? r.days : [0];
    const anchor = r.anchor || r.createdKey || key;
    for (let i = 0; i <= every * 7 + 7; i++) {
      const d = addDays(key, -i);
      if (!days.includes(dow(d))) continue;
      const weeks = Math.floor(daysBetween(weekKeyOf(anchor), weekKeyOf(d)) / 7);
      if (weeks >= 0 && weeks % every === 0) return d;
    }
    return null;
  }
  // interval: due every N days from the last time it was done
  const every = Math.max(1, r.every || 1);
  const base = r.lastDone || r.createdKey;
  if (!base) return key;
  if (!r.lastDone) return base <= key ? base : null;
  const gap = daysBetween(base, key);
  if (gap < every) return null;
  return addDays(base, Math.floor(gap / every) * every);
}

export function reminderState(r, key = todayKey()) {
  const due = lastDueOn(r, key);
  const isDue = !!due && (!r.lastDone || r.lastDone < due);
  return {
    due: isDue,
    dueOn: due,
    overdue: isDue && due ? daysBetween(due, key) : 0,
    lastDone: r.lastDone
  };
}

/** Reminders that want attention on this day, most overdue first. */
export function dueReminders(key = todayKey()) {
  return (state.reminders || [])
    .map((r) => ({ r, s: reminderState(r, key) }))
    .filter((x) => x.s.due)
    .sort((a, b) => b.s.overdue - a.s.overdue);
}

/** When this reminder next comes around, for display in settings. */
export function nextDueText(r, key = todayKey()) {
  const st = reminderState(r, key);
  if (st.due) return st.overdue > 0 ? `Due — ${st.overdue}d late` : 'Due today';
  if (r.mode === 'interval') {
    const next = addDays(r.lastDone || key, Math.max(1, r.every || 1));
    const inDays = daysBetween(key, next);
    return inDays <= 0 ? 'Due today' : inDays === 1 ? 'Due tomorrow' : `Due in ${inDays} days`;
  }
  for (let i = 1; i <= (r.every || 1) * 7 + 7; i++) {
    const d = addDays(key, i);
    const last = lastDueOn(r, d);
    if (last === d) return i === 1 ? 'Due tomorrow' : `Due in ${i} days`;
  }
  return '';
}

export function markReminderDone(r, key = todayKey()) {
  r.lastDone = key;
}

/** Plain-English summary of the schedule, e.g. "Every 4 days". */
export function reminderRule(r) {
  const n = Math.max(1, r.every || 1);
  if (r.mode === 'interval') return n === 1 ? 'Every day' : `Every ${n} days`;
  const names = (r.days?.length ? r.days : [0]).map((d) => DOW_LONG_LOCAL[d]).join(', ');
  return n === 1 ? `Every ${names}` : n === 2 ? `Every other ${names}` : `Every ${n} weeks on ${names}`;
}

const DOW_LONG_LOCAL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---------------- the shape of a normal day ----------------
   Baseline suggestions drawn from how the week usually runs. Advisory only:
   nothing here is checked off, scored, or held against you. */

export function rhythmFor(key) {
  const r = state.settings.rhythm?.[dow(key)];
  if (!r) return null;
  return { school: r.school || null, note: r.note || '', blocks: r.blocks || [] };
}

/** Where the day currently sits relative to school, if there is school. */
export function schoolPhase(key, now = new Date()) {
  const r = rhythmFor(key);
  if (!r?.school) return 'none';
  const m = nowMin(now);
  if (m < toMin(r.school.start)) return 'before';
  if (m <= toMin(r.school.end)) return 'during';
  return 'after';
}

/* ---------------- "what should I be doing right now?" ----------------
   The doomscroll interrupt: one honest answer, based on the clock and
   what's still open. */

export function rightNow(key = todayKey(), now = new Date()) {
  const d = getDay(key);
  const t = sleepTargets(key);
  const m = nowMin(now);
  const st = dayStatus(key);
  const proj = currentProject();

  if (m >= toMin(t.bedtime) || m < 5 * 60) {
    return { icon: '😴', title: 'Sleep', why: `Lights out at ${fmtTime(t.bedtime)}. Tomorrow starts tonight.`, intent: 'sleep' };
  }
  if (m >= toMin(t.phoneAway)) {
    return { icon: '📵', title: 'Phone away', why: `Wind-down started at ${fmtTime(t.windDown)}. Put it down and get ready for bed.`, intent: 'sleep' };
  }
  if (d.salvage) {
    return { icon: '🚨', title: 'Salvage the day', why: 'Three small moves. That is all today needs.', intent: 'salvage' };
  }
  const rhythm = rhythmFor(key);
  const phase = schoolPhase(key, now);

  if (phase === 'during') {
    return {
      icon: '🏫', title: 'You\'re at school',
      why: `Out at ${fmtTime(rhythm.school.end)}. Nothing here needs deciding until then.`,
      intent: 'school'
    };
  }
  if (st.must && !st.must.done) {
    return { icon: '🔴', title: st.must.title, why: 'This is today\'s Must Win. Everything else is negotiable.', intent: 'must' };
  }

  // Before school, lean on whatever this day usually opens with.
  if (phase === 'before') {
    const first = rhythm.blocks.find((b) => !b.soft && ['money', 'gym', 'faith'].includes(b.kind));
    if (first && !(first.kind === 'money' && d.money) && !(first.kind === 'gym' && d.workout)) {
      return {
        icon: first.kind === 'gym' ? '💪' : first.kind === 'faith' ? '✝️' : '💼',
        title: first.label,
        why: `This is usually how ${DOW_LONG_LOCAL[dow(key)]} starts. School at ${fmtTime(rhythm.school.start)}.`,
        intent: first.kind === 'gym' ? 'gym' : first.kind === 'faith' ? 'other' : 'money'
      };
    }
  }

  if (!d.school && state.settings.school.days.includes(dow(key)) && m < 21 * 60) {
    return { icon: '📚', title: 'School responsibilities', why: 'Not handled yet today.', intent: 'school' };
  }
  if (!d.money) {
    return {
      icon: '💼', title: proj ? proj.name : 'Business work',
      why: proj ? 'No work logged today. Ten minutes counts.' : 'Set a current project so this always has an answer.',
      intent: 'money'
    };
  }
  const w = workoutStats(weekKeyOf(key), key);
  if (!d.workout && w.tight && !state.settings.fitness.excluded.includes(dow(key))) {
    return { icon: '💪', title: 'Workout', why: 'Today is one of the last chances to hit your weekly minimum.', intent: 'gym' };
  }
  return {
    icon: '🟢', title: 'You actually have free time',
    why: 'Mission is handled. Rest on purpose — it is not the same as avoiding.',
    intent: 'free'
  };
}

/** Earned-leisure read-out. Never scolding, just honest. */
export function leisureStatus(key = todayKey()) {
  const st = dayStatus(key);
  const open = [];
  if (st.must && !st.must.done) open.push('Must Win');
  st.standards.filter((s) => s.required && !s.done).forEach((s) => open.push(s.label));
  return { clear: open.length === 0, open };
}

/* ---------------- stats ---------------- */

export function rangeStats(keys) {
  let mustSet = 0, mustDone = 0, secondSet = 0, secondDone = 0;
  let stdReq = 0, stdDone = 0, bed = 0, bedDays = 0, wake = 0;
  let faithDue = 0, faithDone = 0, money = 0, workouts = 0, social = 0, salvage = 0, planned = 0;
  let records = 0;

  for (const k of keys) {
    const rec = state.days[k];
    if (!rec) continue;
    records++;
    const st = dayStatus(k);
    if (rec.mustId) { mustSet++; if (st.mustDone) mustDone++; }
    secondSet += st.seconds.length;
    secondDone += st.secondsDone;
    stdReq += st.required;
    stdDone += st.requiredDone;
    bedDays++;
    if (rec.bed) bed++;
    if (rec.wake) wake++;
    if (faithFor(k)) { faithDue++; if (rec.faith) faithDone++; }
    if (rec.money) money++;
    if (rec.workout) workouts++;
    if (rec.social) social++;
    if (rec.salvage) salvage++;
    if (rec.plannedAt) planned++;
  }
  return { days: keys.length, records, mustSet, mustDone, secondSet, secondDone, stdReq, stdDone,
           bed, bedDays, wake, faithDue, faithDone, money, workouts, social, salvage, planned };
}

export function weekOf(key) { return weekKeyOf(key); }

export function lastNDays(n, ref = todayKey()) {
  return Array.from({ length: n }, (_, i) => addDays(ref, -(n - 1 - i)));
}

/** Per-day completion score, used by the week strip. 0..1 */
export function dayScore(key) {
  const rec = state.days[key];
  if (!rec) return null;
  const st = dayStatus(key);
  let total = st.required + (rec.mustId ? 1 : 0);
  let got = st.requiredDone + (st.mustDone ? 1 : 0);
  if (total === 0) return null;
  return got / total;
}
