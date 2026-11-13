/* What sits on the globe, in order of importance.
   Index 0 faces you. Everything after it wraps towards the back. */

import { state, getDay, getWeek, taskById, currentProject } from './store.js';
import { faithFor, workoutStats, dayStatus } from './logic.js';
import { todayKey, dow, weekKeyOf } from './util.js';
import { spherePoints } from './sky.js';

const C = {
  must:     [178, 80, 72],
  second:   [166, 134, 82],
  business: [88, 142, 132],
  faith:    [134, 120, 172],
  school:   [96, 128, 168],
  move:     [116, 150, 120],
  sleep:    [84, 104, 148],
  plan:     [150, 158, 176],
  week:     [132, 142, 162],
  life:     [162, 152, 132],
  set:      [104, 112, 128]
};

export function buildStars(key = todayKey()) {
  const d = getDay(key);
  const st = dayStatus(key);
  const wd = dow(key);
  const wk = weekKeyOf(key);
  const list = [];

  /* --- the mission, dead centre --- */
  const must = taskById(d.mustId);
  list.push({
    id: 'must', panel: 'must',
    label: must ? trim(must.title, 34) : 'No focus set',
    color: C.must, size: 8.4, primary: true,
    done: must ? !!must.done : false
  });

  const seconds = (d.secondIds || []).map(taskById).filter(Boolean);
  seconds.slice(0, 2).forEach((t, i) => list.push({
    id: 'second' + i, panel: 'second', taskId: t.id,
    label: trim(t.title), color: C.second, size: 6, done: !!t.done
  }));

  /* --- today's commitments --- */
  const proj = currentProject();
  list.push({
    id: 'business', panel: 'business',
    label: proj ? trim(proj.name, 20) : 'Business',
    color: C.business, size: 5.4, done: !!d.money
  });

  const faith = faithFor(key);
  if (faith) list.push({
    id: 'faith', panel: 'faith',
    label: faith.label.replace('Personal ', ''),
    color: C.faith, size: 5.2, done: !!d.faith
  });

  if (state.settings.school.days.includes(wd)) list.push({
    id: 'school', panel: 'school',
    label: 'School', color: C.school, size: 5.2, done: !!d.school
  });

  if (!state.settings.fitness.excluded.includes(wd)) {
    const w = workoutStats(wk, key);
    list.push({
      id: 'move', panel: 'move',
      label: `Train ${w.done}/${w.min}`,
      color: C.move, size: 5.2, done: !!d.workout
    });
  }

  list.push({
    id: 'sleep', panel: 'sleep',
    label: 'Sleep', color: C.sleep, size: 5,
    done: !!(d.bed && d.wake)
  });

  /* --- the wider orbit --- */
  list.push({ id: 'plan', panel: 'plan', label: 'Tomorrow', color: C.plan, size: 4.8, done: null });
  list.push({ id: 'week', panel: 'week', label: 'This week', color: C.week, size: 4.6, done: null });
  list.push({ id: 'life', panel: 'life', label: 'Life', color: C.life, size: 4.6, done: null });
  list.push({ id: 'settings', panel: 'settings', label: 'Settings', color: C.set, size: 4, done: null });

  const pts = spherePoints(list.length);
  return list.map((s, i) => ({ ...s, pos: pts[i], rank: i }));
}

function trim(s, n = 26) {
  const v = String(s || '').trim();
  return v.length > n ? v.slice(0, n - 1).trimEnd() + '…' : v;
}
