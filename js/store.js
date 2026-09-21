/* Persistent state.
   One versioned object in localStorage. Everything the app knows lives here,
   which keeps a future cloud sync to a single read/write seam. */

import { uid, todayKey, weekKeyOf, addDays, dow } from './util.js';

const KEY = 'personal-os';
const SCHEMA = 2;

export const CATS = {
  money:  { label: 'Business', emoji: '💼', color: 'var(--money)' },
  school: { label: 'School', emoji: '📚', color: 'var(--school)' },
  faith:  { label: 'Faith',  emoji: '✝️', color: 'var(--faith)' },
  health: { label: 'Health', emoji: '💪', color: 'var(--health)' },
  social: { label: 'Social', emoji: '👥', color: 'var(--social)' },
  other:  { label: 'Other',  emoji: '•',  color: 'var(--text-2)' }
};

export const FAITH_KINDS = {
  none:     { label: 'Rest',                emoji: '' },
  personal: { label: 'Personal Bible Study', emoji: '📖' },
  church:   { label: 'Church',               emoji: '⛪' },
  group:    { label: 'Morning Bible Study',  emoji: '👥' }
};

/** The next time this weekday comes around (today counts if it matches). */
function upcoming(weekday = 0) {
  const t = todayKey();
  return dow(t) === weekday ? t : addDays(weekKeyOf(t), weekday + 7);
}

function defaults() {
  return {
    v: SCHEMA,
    createdAt: Date.now(),
    settings: {
      name: '',
      sleep: {
        windDown: '22:00',
        phoneAway: '22:30',
        bedtime: '22:45',
        wake: '06:30',
        weekendShift: 0 // minutes of slack on Fri/Sat nights
      },
      // index = day of week, 0 = Sunday
      faith: { plan: ['church', 'personal', 'personal', 'church', 'group', 'personal', 'personal'] },
      fitness: { min: 3, ideal: 4, excluded: [0], preferred: 'morning' },
      social: { min: 1, ideal: 2 },
      school: { days: [1, 2, 3, 4, 5] },
      /* How a typical week usually runs. Shown as a quiet suggestion on Today
         and when planning — never enforced, never scored. index 0 = Sunday. */
      rhythm: [
        { school: null, note: '', blocks: [
          { kind: 'faith', when: 'Morning', label: 'Church' },
          { kind: 'flex',  when: 'Afternoon', label: 'Sunday Reset + set up the week' }
        ] },
        { school: { start: '08:40', end: '14:15' }, note: '', blocks: [
          { kind: 'money',  when: 'Before school', label: 'Business work' },
          { kind: 'gym',    when: 'After school',  label: 'Gym' },
          { kind: 'school', when: 'Evening',       label: 'Work / homework' }
        ] },
        { school: { start: '09:25', end: '15:00' }, note: '', blocks: [
          { kind: 'gym',    when: 'Morning',      label: 'Gym' },
          { kind: 'money',  when: 'After school', label: 'Business work' }
        ] },
        { school: { start: '08:00', end: '13:40' }, note: '', blocks: [
          { kind: 'money',  when: 'Before school', label: 'A little business work' },
          { kind: 'gym',    when: 'After school',  label: 'Gym', soft: true }
        ] },
        { school: { start: '10:15', end: '15:00' }, note: 'Bible study 8:45', blocks: [
          { kind: 'faith',  when: '8:45',         label: 'Bible study' },
          { kind: 'money',  when: 'Late morning', label: 'Business work — or gym, your call' },
          { kind: 'school', when: 'After school', label: 'Work / homework' },
          { kind: 'gym',    when: 'After school', label: 'Gym if you skipped Wed', soft: true }
        ] },
        { school: { start: '08:00', end: '13:50' }, note: '', blocks: [
          { kind: 'money',  when: 'Before school', label: 'Business work' },
          { kind: 'money',  when: 'After school',  label: 'More business work', soft: true },
          { kind: 'social', when: 'Tonight',       label: 'Friends / wind down', soft: true }
        ] },
        { school: null, note: '', blocks: [
          { kind: 'flex', when: 'All day', label: 'Balance — some work, some fun, not all of either' }
        ] }
      ],
      priorities: ['money', 'school', 'faith', 'health', 'social'],
      standards: [
        { id: 'std-faith',  type: 'faith',  emoji: '✝️', label: 'Faith commitment', days: [0,1,2,3,4,5,6], required: true },
        { id: 'std-school', type: 'school', emoji: '📚', label: 'School handled',   days: [1,2,3,4,5],     required: true },
        { id: 'std-money',  type: 'money',  emoji: '💼', label: 'Moved the business forward', days: [0,1,2,3,4,5,6], required: true },
        { id: 'std-move',   type: 'move',   emoji: '💪', label: 'Workout or movement',    days: [0,1,2,3,4,5,6], required: false }
      ],
      sunday: {
        items: [
          { id: 'sr-church',   group: 'faith',  label: 'Church' },
          { id: 'sr-room',     group: 'life',   label: 'Clean room' },
          { id: 'sr-laundry',  group: 'life',   label: 'Laundry' },
          { id: 'sr-clothes',  group: 'life',   label: 'Prepare clothes for the week' },
          { id: 'sr-backpack', group: 'life',   label: 'Organize backpack' },
          { id: 'sr-meal',     group: 'food',   label: 'Meal prep' },
          { id: 'sr-assign',   group: 'school', label: 'Check assignments' },
          { id: 'sr-tests',    group: 'school', label: 'Check upcoming tests' },
          { id: 'sr-dead',     group: 'school', label: 'Identify important deadlines' },
          { id: 'sr-review',   group: 'money',  label: 'Review current project' },
          { id: 'sr-next',     group: 'money',  label: 'Decide the next major action' }
        ]
      },
      currentProjectId: null,
      welcomeDone: false
    },
    goals: [],
    projects: [],
    tasks: [],
    /* Recurring upkeep. Only surfaces on the days it is actually due. */
    reminders: [
      { id: 'rm-linens', emoji: '🛏️', label: 'Change towel, pillowcase, floor mat',
        mode: 'weekly', every: 2, days: [0], anchor: upcoming(0), lastDone: null, createdKey: todayKey() },
      { id: 'rm-shampoo', emoji: '🚿', label: 'Shampoo hair',
        mode: 'interval', every: 4, days: [], anchor: null, lastDone: null, createdKey: todayKey() }
    ],
    days: {},   // key -> day record
    weeks: {},  // sunday key -> week record
    focus: []   // completed focus sessions
  };
}

export function emptyDay(key) {
  return {
    key,
    mustId: null,
    secondIds: [],
    faith: false, school: false, money: false, workout: false,
    bed: false, wake: false, social: false,
    std: {},            // custom standards
    salvage: false,
    salvageSteps: {},
    note: '',
    plannedAt: null
  };
}

export function emptyWeek(key) {
  return {
    key,
    bigWin: '',
    bigWinDone: false,
    reset: {},
    resetDoneAt: null,
    notes: [],
    plannedSocial: 0,
    plannedAt: null
  };
}

/* ---------------- load / save ---------------- */

function migrate(raw) {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  // Deep-merge settings so new fields appear for existing installs.
  const s = { ...base.settings, ...(raw.settings || {}) };
  for (const k of ['sleep', 'faith', 'fitness', 'social', 'school', 'sunday']) {
    s[k] = { ...base.settings[k], ...((raw.settings || {})[k] || {}) };
  }
  if (!Array.isArray(s.standards) || !s.standards.length) s.standards = base.settings.standards;
  if (!Array.isArray(s.priorities) || s.priorities.length !== 5) s.priorities = base.settings.priorities;
  if (!Array.isArray(s.rhythm) || s.rhythm.length !== 7) s.rhythm = base.settings.rhythm;
  // "Money Engine" was renamed; existing installs carry the old wording.
  s.standards = s.standards.map((st) => (
    st.type === 'money' && /money engine/i.test(st.label || '')
      ? { ...st, emoji: '💼', label: 'Moved the business forward' }
      : st
  ));
  return {
    ...base,
    ...raw,
    v: SCHEMA,
    settings: s,
    goals: raw.goals || [],
    projects: raw.projects || [],
    tasks: raw.tasks || [],
    reminders: Array.isArray(raw.reminders) ? raw.reminders : base.reminders,
    days: raw.days || {},
    weeks: raw.weeks || {},
    focus: raw.focus || []
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return migrate(JSON.parse(raw));
  } catch (err) {
    console.warn('Could not read saved data; starting fresh.', err);
    return defaults();
  }
}

export const state = load();

let saveTimer = null;
let onChange = () => {};

export function subscribe(fn) { onChange = fn; }

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Save failed', err);
    }
  }, 90);
}

/** Mutate state, persist, and re-render the current view. */
export function mutate(fn) {
  const r = fn(state);
  save();
  onChange();
  return r;
}

/** Persist without a re-render (for in-place UI updates). */
export function commit() { save(); }

/* ---------------- record access ---------------- */

/** Read-only day record (never writes). */
export function getDay(key) {
  return state.days[key] || emptyDay(key);
}

/** Writable day record (creates it). */
export function day(key) {
  if (!state.days[key]) state.days[key] = emptyDay(key);
  return state.days[key];
}

export function getWeek(key) {
  return state.weeks[key] || emptyWeek(key);
}

export function week(key) {
  if (!state.weeks[key]) state.weeks[key] = emptyWeek(key);
  return state.weeks[key];
}

/* ---------------- tasks ---------------- */

export function newTask(patch = {}) {
  const t = {
    id: uid(),
    title: '',
    notes: '',
    date: null,
    cat: 'other',
    priority: 'normal', // 'high' | 'normal' | 'low'
    kind: null,        // 'build' | 'learn' | null
    type: 'task',      // 'task' | 'idea'
    goalId: null,
    projectId: null,
    inbox: false,
    done: false,
    doneAt: null,
    createdAt: Date.now(),
    ...patch
  };
  state.tasks.push(t);
  return t;
}

export const taskById = (id) => (id ? state.tasks.find((t) => t.id === id) || null : null);

export function setTaskDone(id, done) {
  const t = taskById(id);
  if (!t) return;
  t.done = done;
  t.doneAt = done ? Date.now() : null;
  if (done && !t.date) { t.date = todayKey(); t.inbox = false; }
}

export function deleteTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  for (const d of Object.values(state.days)) {
    if (d.mustId === id) d.mustId = null;
    if (d.secondIds?.includes(id)) d.secondIds = d.secondIds.filter((x) => x !== id);
  }
}

/* ---------------- goals & projects ---------------- */

export function newGoal(patch = {}) {
  const g = {
    id: uid(), name: '', description: '', cat: 'money',
    priority: 'high', target: null, status: 'active',
    createdAt: Date.now(), doneAt: null, ...patch
  };
  state.goals.push(g);
  return g;
}

export function deleteGoal(id) {
  state.goals = state.goals.filter((g) => g.id !== id);
  state.tasks.forEach((t) => { if (t.goalId === id) t.goalId = null; });
  state.projects.forEach((p) => { if (p.goalId === id) p.goalId = null; });
}

export function newProject(patch = {}) {
  const p = {
    id: uid(), name: '', description: '', goalId: null,
    status: 'active', createdAt: Date.now(), doneAt: null, ...patch
  };
  state.projects.push(p);
  if (!state.settings.currentProjectId && p.status === 'active') state.settings.currentProjectId = p.id;
  return p;
}

export function deleteProject(id) {
  state.projects = state.projects.filter((p) => p.id !== id);
  state.tasks.forEach((t) => { if (t.projectId === id) t.projectId = null; });
  if (state.settings.currentProjectId === id) {
    const next = state.projects.find((p) => p.status === 'active');
    state.settings.currentProjectId = next ? next.id : null;
  }
}

export const currentProject = () =>
  state.projects.find((p) => p.id === state.settings.currentProjectId) || null;

/* ---------------- reminders ---------------- */

export function newReminder(patch = {}) {
  const r = {
    id: uid(),
    emoji: '🔁',
    label: '',
    mode: 'interval',   // 'interval' (every N days) | 'weekly' (every N weeks on chosen days)
    every: 7,
    days: [],
    anchor: weekKeyOf(todayKey()),
    lastDone: null,
    createdKey: todayKey(),
    ...patch
  };
  state.reminders.push(r);
  return r;
}

export const reminderById = (id) => state.reminders.find((r) => r.id === id) || null;

export function deleteReminder(id) {
  state.reminders = state.reminders.filter((r) => r.id !== id);
}

/* ---------------- export / import ---------------- */

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const next = migrate(parsed);
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, next);
  save();
  onChange();
}

export function resetAll() {
  const next = defaults();
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, next);
  save();
  onChange();
}
