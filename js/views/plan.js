/* PLAN — tomorrow in about two minutes, plus the task lists.
   Three decisions, the third optional. Then it's done. */

import { state, getDay, day, mutate, taskById } from '../store.js';
import { faithFor, sleepTargets, workoutStats } from '../logic.js';
import { todayKey, tomorrowKey, dow, weekKeyOf, esc, fmtTime, haptic, sortBy, DOW_LONG } from '../util.js';
import { bind, toast, emptyState, liveSave } from '../ui.js';
import { taskRowHtml, bindTasks } from '../tasks-ui.js';
import { pickTask, scheduleTask } from '../pick.js';
import { openCapture } from '../capture.js';
import { go } from '../app.js';

let tab = 'today';

function planCard() {
  const key = tomorrowKey();
  const d = getDay(key);
  const must = taskById(d.mustId);
  const seconds = (d.secondIds || []).map(taskById).filter(Boolean);
  const faith = faithFor(key);
  const sleep = sleepTargets(key);
  const w = workoutStats(weekKeyOf(key), todayKey());
  const gymFits = !state.settings.fitness.excluded.includes(dow(key)) && !w.metIdeal;

  const context = [];
  if (faith) context.push(`${faith.emoji} ${faith.label}`);
  if (gymFits) context.push(`💪 Gym fits (${w.done}/${w.min})`);
  context.push(`😴 ${fmtTime(sleep.bedtime)} → ${fmtTime(sleep.wake)}`);

  return `
    <div class="card" style="padding:18px">
      <div class="row between">
        <div>
          <div style="font-size:11.5px;font-weight:750;letter-spacing:.15em;text-transform:uppercase;color:var(--text-3)">🌙 Tomorrow</div>
          <div style="font-size:19px;font-weight:700;margin-top:5px;letter-spacing:-.02em">${DOW_LONG[dow(key)]}</div>
        </div>
        ${d.plannedAt ? '<span class="pill" style="background:rgba(55,211,153,.14);color:#6EE7B7">Planned</span>' : ''}
      </div>

      <p class="tiny dim" style="margin-top:10px">${esc(context.join('  ·  '))}</p>

      <div style="margin-top:18px">
        <div class="label" style="display:block;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Step 1 — Must Win</div>
        ${must ? `
          <div class="check sec" style="border-color:rgba(255,95,70,.28);background:linear-gradient(150deg,rgba(255,75,62,.10),rgba(255,75,62,.02))">
            <span class="lead">🔴</span>
            <span class="txt grow wrap-any">${esc(must.title)}</span>
            <button class="btn sm ghost" data-a="p-must" style="min-height:34px;padding:0 12px">Change</button>
          </div>`
        : `<button class="check" data-a="p-must" style="border-style:dashed">
             <span class="box" style="border-style:dashed">+</span>
             <span class="txt" style="color:var(--text-3);font-weight:540">Pick the one thing that matters</span>
           </button>`}
      </div>

      <div style="margin-top:16px">
        <div class="label" style="display:block;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Step 2 — Secondary wins <span style="font-weight:500;letter-spacing:0;text-transform:none;color:var(--text-4)">· up to 2, optional</span></div>
        <div class="stack">
          ${seconds.map((t) => `
            <div class="check">
              <span class="lead">🟠</span>
              <span class="txt grow wrap-any">${esc(t.title)}</span>
              <button class="btn sm ghost" data-a="p-drop" data-id="${t.id}" style="min-height:34px;padding:0 12px">Remove</button>
            </div>`).join('')}
          ${seconds.length < 2 ? `
            <button class="check" data-a="p-second" style="border-style:dashed">
              <span class="box" style="border-style:dashed">+</span>
              <span class="txt" style="color:var(--text-3);font-weight:540">Add a secondary win</span>
            </button>` : ''}
        </div>
      </div>

      <div style="margin-top:16px">
        <div class="label" style="display:block;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Step 3 — Anything unusual? <span style="font-weight:500;letter-spacing:0;text-transform:none;color:var(--text-4)">· skip if not</span></div>
        <input class="input" id="p-note" placeholder="Test, appointment, plans…" value="${esc(d.note || '')}" autocomplete="off">
      </div>

      <button class="btn ${d.plannedAt ? 'ghost' : 'primary'} block" data-a="p-lock" style="margin-top:18px">
        ${d.plannedAt ? 'Update tomorrow' : 'Lock in tomorrow'}
      </button>
      ${must ? '' : '<p class="tiny dim center" style="margin-top:9px">A Must Win is the one thing worth deciding tonight.</p>'}
    </div>`;
}

function listFor(kind) {
  const today = todayKey();
  const open = state.tasks.filter((t) => !t.done);
  const rank = (t) => ({ high: 0, normal: 1, low: 2 }[t.priority || 'normal']);
  if (kind === 'today') return sortBy(open.filter((t) => t.date && t.date <= today), (t) => `${t.date}${rank(t)}`);
  if (kind === 'upcoming') return sortBy(open.filter((t) => t.date && t.date > today), (t) => `${t.date}${rank(t)}`);
  if (kind === 'inbox') return sortBy(open.filter((t) => !t.date), (t) => `${rank(t)}${-t.createdAt}`);
  return sortBy(state.tasks.filter((t) => t.done), (t) => -(t.doneAt || 0)).slice(0, 40);
}

export default {
  render() {
    const items = listFor(tab);
    const counts = {
      today: listFor('today').length,
      upcoming: listFor('upcoming').length,
      inbox: listFor('inbox').length
    };

    const body = !items.length
      ? emptyState(
          tab === 'inbox' ? '📥' : tab === 'done' ? '✓' : '📋',
          tab === 'inbox' ? 'Inbox is clear. Capture anything that pulls at your attention.'
            : tab === 'done' ? 'Nothing completed yet.'
            : tab === 'today' ? 'Nothing scheduled for today.'
            : 'Nothing scheduled ahead.')
      : tab === 'inbox'
        ? items.map((t) => `
            <div class="card" style="padding:0;overflow:hidden">
              ${taskRowHtml(t)}
              <div class="row" style="gap:8px;padding:0 15px 13px">
                <button class="chip" data-a="inbox-today" data-id="${t.id}">→ Today</button>
                <button class="chip" data-a="inbox-tom" data-id="${t.id}">→ Tomorrow</button>
                ${t.type === 'idea' ? `<button class="chip" data-a="inbox-proj" data-id="${t.id}">→ Project</button>` : ''}
              </div>
            </div>`).join('')
        : items.map((t) => taskRowHtml(t, { showDate: tab !== 'today' })).join('');

    return `
      <div class="head">
        <div class="kicker">Plan</div>
        <h1>Decide once, tonight.</h1>
        <p class="sub">Tomorrow you execute instead of deciding.</p>
      </div>

      ${planCard()}

      <div class="section">
        <div class="label">Tasks <span class="hint">${counts.inbox ? `${counts.inbox} in inbox` : ''}</span></div>
        <div class="seg">
          ${[['today', 'Today'], ['upcoming', 'Upcoming'],
             ['inbox', `Inbox${counts.inbox ? ` ${counts.inbox}` : ''}`],
             ['done', 'Done']]
            .map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}
        </div>
        <div class="stack" style="margin-top:12px">${body}</div>
      </div>

      <div class="section">
        <button class="btn block ghost" data-a="new-task">+ New task</button>
      </div>`;
  },

  mount(root) {
    const key = tomorrowKey();

    bind(root, '[data-tab]', (el) => { tab = el.dataset.tab; haptic(); go('plan', {}, { push: false, scroll: false }); });

    bind(root, '[data-a="p-must"]', () => pickTask({
      title: "Tomorrow's Must Win",
      sub: 'The one that would make tomorrow count.',
      dateKey: key,
      onPick: (id) => mutate(() => { scheduleTask(id, key); day(key).mustId = id; })
    }));

    bind(root, '[data-a="p-second"]', () => pickTask({
      title: 'Secondary win',
      dateKey: key,
      exclude: [getDay(key).mustId, ...(getDay(key).secondIds || [])].filter(Boolean),
      onPick: (id) => mutate(() => {
        scheduleTask(id, key);
        const rec = day(key);
        if (!rec.secondIds.includes(id) && rec.secondIds.length < 2) rec.secondIds.push(id);
      })
    }));

    bind(root, '[data-a="p-drop"]', (el) => mutate(() => {
      const rec = day(key);
      rec.secondIds = rec.secondIds.filter((x) => x !== el.dataset.id);
    }));

    const note = root.querySelector('#p-note');
    liveSave(note, (v) => { day(key).note = v.trim(); });

    bind(root, '[data-a="p-lock"]', () => {
      if (note) day(key).note = note.value.trim();
      const rec = getDay(key);
      if (!rec.mustId) { toast('Pick a Must Win first — it takes ten seconds.'); return; }
      haptic(16);
      mutate(() => { day(key).plannedAt = Date.now(); });
      toast('Tomorrow is set. Nothing left to decide.');
      go('today');
    });

    bind(root, '[data-a="inbox-today"]', (el) => mutate(() => {
      const t = taskById(el.dataset.id); if (t) { t.date = todayKey(); t.inbox = false; }
    }));
    bind(root, '[data-a="inbox-tom"]', (el) => mutate(() => {
      const t = taskById(el.dataset.id); if (t) { t.date = tomorrowKey(); t.inbox = false; }
    }));
    bind(root, '[data-a="inbox-proj"]', (el) => { go('money', { fromIdea: el.dataset.id }); });

    bind(root, '[data-a="new-task"]', () => openCapture({ when: 'today' }));

    bindTasks(root);
  }
};
