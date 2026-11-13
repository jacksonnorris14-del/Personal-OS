/* What sits on the globe, in order of importance.
   Index 0 faces you; index 1 sits right beside it. Today and Tomorrow are
   deliberately adjacent — they're the pair you move between most. */

import { state, getDay, taskById } from './store.js';
import { faithFor, workoutStats, urgentStars } from './logic.js';
import { todayKey, dow, weekKeyOf } from './util.js';
import { spherePoints } from './sky.js';

const C = {
  must:     [196, 86, 76],
  plan:     [168, 142, 196],
  second:   [172, 140, 86],
  business: [88, 146, 134],
  faith:    [136, 122, 176],
  edu:      [96, 130, 170],
  move:     [116, 152, 122],
  sleep:    [84, 106, 150],
  week:     [132, 142, 162],
  life:     [164, 154, 134],
  set:      [104, 112, 128]
};

/** Stars the bottom tabs can jump to. */
export const TABS = [
  { id: 'must', label: 'Today' },
  { id: 'plan', label: 'Tomorrow' },
  { id: 'business', label: 'Business' },
  { id: 'education', label: 'Education' },
  { id: 'life', label: 'Life' }
];

export function buildStars(key = todayKey(), now = new Date()) {
  const d = getDay(key);
  const wd = dow(key);
  const wk = weekKeyOf(key);
  const urgent = urgentStars(key, now);
  const list = [];

  const must = taskById(d.mustId);
  list.push({
    id: 'must', panel: 'must',
    label: must ? trim(must.title, 34) : 'No Focus Set',
    color: C.must, size: 8.6, primary: true,
    done: must ? !!must.done : false
  });

  // right next to Today
  list.push({ id: 'plan', panel: 'plan', label: 'Tomorrow', color: C.plan, size: 5.6, done: null });

  (d.secondIds || []).map(taskById).filter(Boolean).slice(0, 2).forEach((t, i) =>
    list.push({ id: 'second' + i, panel: 'second', taskId: t.id,
                label: trim(t.title, 18), color: C.second, size: 5.4, done: !!t.done }));

  list.push({ id: 'business', panel: 'business', label: 'Business', color: C.business, size: 5.4, done: !!d.money });

  if (faithFor(key)) list.push({ id: 'faith', panel: 'faith', label: 'Christian', color: C.faith, size: 5.2, done: !!d.faith });

  list.push({ id: 'education', panel: 'education', label: 'Education', color: C.edu, size: 5.2,
              done: state.settings.school.days.includes(wd) ? !!d.school : null });

  if (!state.settings.fitness.excluded.includes(wd)) {
    const w = workoutStats(wk, key);
    list.push({ id: 'move', panel: 'move', label: 'Training', color: C.move, size: 5.2, done: !!d.workout, count: `${w.done}/${w.min}` });
  }

  list.push({ id: 'sleep', panel: 'sleep', label: 'Sleep', color: C.sleep, size: 5, done: !!(d.bed && d.wake) });
  list.push({ id: 'week', panel: 'week', label: 'This Week', color: C.week, size: 4.8, done: null });
  list.push({ id: 'life', panel: 'life', label: 'Life', color: C.life, size: 4.8, done: null });
  list.push({ id: 'settings', panel: 'settings', label: 'Settings', color: C.set, size: 4.2, done: null });

  const pts = spherePoints(list.length);
  return list.map((s, i) => ({ ...s, pos: pts[i], rank: i, urgent: urgent.has(s.id) }));
}

function trim(s, n = 26) {
  const v = String(s || '').trim();
  return v.length > n ? v.slice(0, n - 1).trimEnd() + '…' : v;
}
