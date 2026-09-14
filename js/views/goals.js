/* GOALS — direction, not a to-do list.
   Visible enough to remember why today matters; quiet enough to stay out of the way. */

import { state, mutate, newGoal, deleteGoal, CATS } from '../store.js';
import { esc, haptic, sortBy, fmtShort, daysBetween, todayKey, pct } from '../util.js';
import { openSheet, confirmSheet, pickSheet, bind, toast, emptyState } from '../ui.js';
import { bindTasks } from '../tasks-ui.js';
import { openCapture } from '../capture.js';

const PRIOS = { high: 'High', medium: 'Medium', low: 'Low' };

function horizon(target) {
  if (!target) return '';
  const d = daysBetween(todayKey(), target);
  if (d < 0) return `Target passed ${fmtShort(target)}`;
  if (d === 0) return 'Target is today';
  if (d < 45) return `${d} days out · ${fmtShort(target)}`;
  const months = Math.round(d / 30);
  return `${months} month${months === 1 ? '' : 's'} out · ${fmtShort(target)}`;
}

function goalEditor(id) {
  const g = id ? state.goals.find((x) => x.id === id) : null;
  openSheet({
    title: g ? 'Edit goal' : 'New goal',
    sub: g ? '' : 'An outcome worth years of ordinary days.',
    body: `
      <div class="field">
        <span class="lab">Goal</span>
        <input class="input" id="g-name" data-autofocus value="${esc(g?.name || '')}"
               placeholder="e.g. $12,000/month by graduation" autocomplete="off">
      </div>
      <div class="field">
        <span class="lab">Why it matters</span>
        <textarea class="input" id="g-desc" placeholder="Optional">${esc(g?.description || '')}</textarea>
      </div>
      <div class="field">
        <span class="lab">Category</span>
        <div class="chips">
          ${Object.entries(CATS).filter(([k]) => k !== 'other').map(([k, c]) =>
            `<button class="chip ${(g?.cat || 'money') === k ? 'on' : ''}" data-c="${k}">${c.emoji} ${c.label}</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <span class="lab">Priority</span>
        <div class="chips">
          ${Object.entries(PRIOS).map(([k, l]) =>
            `<button class="chip ${(g?.priority || 'high') === k ? 'on' : ''}" data-p="${k}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <span class="lab">Target date (optional)</span>
        <input type="date" class="input" id="g-date" value="${g?.target || ''}">
      </div>
      <div class="actions">
        ${g ? '<button class="btn danger" data-x="del">Delete</button>' : ''}
        <button class="btn primary" data-x="save">${g ? 'Save' : 'Create goal'}</button>
      </div>`,
    onMount(sheet, close) {
      let cat = g?.cat || 'money';
      let prio = g?.priority || 'high';
      sheet.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => {
        cat = b.dataset.c;
        sheet.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b));
      });
      sheet.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => {
        prio = b.dataset.p;
        sheet.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b));
      });
      sheet.querySelector('[data-x="save"]').onclick = () => {
        const name = sheet.querySelector('#g-name').value.trim();
        if (!name) { toast('Name the goal'); return; }
        const patch = {
          name,
          description: sheet.querySelector('#g-desc').value.trim(),
          cat, priority: prio,
          target: sheet.querySelector('#g-date').value || null
        };
        mutate(() => { g ? Object.assign(g, patch) : newGoal(patch); });
        close();
      };
      const del = sheet.querySelector('[data-x="del"]');
      if (del) del.onclick = async () => {
        close();
        if (await confirmSheet({ title: 'Delete goal?', sub: g.name, confirmLabel: 'Delete', danger: true })) {
          mutate(() => deleteGoal(g.id));
          toast('Deleted');
        }
      };
    }
  });
}

function goalCard(g) {
  const c = CATS[g.cat] || CATS.other;
  const tasks = state.tasks.filter((t) => t.goalId === g.id);
  const done = tasks.filter((t) => t.done).length;
  const projs = state.projects.filter((p) => p.goalId === g.id);
  const share = tasks.length ? pct(done, tasks.length) : null;

  return `
    <button class="card" data-a="open-goal" data-id="${g.id}" style="width:100%;text-align:left;${g.status === 'paused' ? 'opacity:.55' : ''}">
      <div class="row between" style="align-items:flex-start">
        <div class="grow">
          <div class="row" style="gap:7px">
            <span style="font-size:15px">${c.emoji}</span>
            <span class="pill" style="background:transparent;color:var(--text-4);padding:0;letter-spacing:.1em">${PRIOS[g.priority] || ''}</span>
            ${g.status === 'paused' ? '<span class="pill">Paused</span>' : ''}
            ${g.status === 'done' ? '<span class="pill" style="background:rgba(55,211,153,.14);color:#6EE7B7">Done</span>' : ''}
          </div>
          <div style="font-size:17.5px;font-weight:660;margin-top:7px;letter-spacing:-.02em;line-height:1.3" class="wrap-any">${esc(g.name)}</div>
          ${g.target ? `<div class="tiny dim" style="margin-top:5px">${esc(horizon(g.target))}</div>` : ''}
        </div>
        <span class="arrow" style="color:var(--text-4);font-size:18px">›</span>
      </div>
      ${g.description ? `<p class="tiny muted" style="margin-top:9px;line-height:1.5">${esc(g.description)}</p>` : ''}
      ${(tasks.length || projs.length) ? `
        <div class="row" style="gap:12px;margin-top:12px">
          ${projs.length ? `<span class="tiny dim">💰 ${projs.length} project${projs.length === 1 ? '' : 's'}</span>` : ''}
          ${tasks.length ? `<span class="tiny dim">📋 ${done}/${tasks.length} tasks</span>` : ''}
        </div>
        ${share !== null ? `<div class="bar" style="margin-top:9px"><i style="width:${share}%"></i></div>` : ''}` : ''}
    </button>`;
}

export default {
  render() {
    const order = { high: 0, medium: 1, low: 2 };
    const active = sortBy(state.goals.filter((g) => g.status === 'active'), (g) => order[g.priority] ?? 3);
    const paused = state.goals.filter((g) => g.status === 'paused');
    const done = state.goals.filter((g) => g.status === 'done');

    return `
      <div class="head">
        <div class="kicker">Goals</div>
        <h1>Why today matters.</h1>
        <p class="sub">Direction lives here. Action lives on Today.</p>
      </div>

      ${active.length ? `<div class="stack">${active.map(goalCard).join('')}</div>`
        : emptyState('🏔️', 'No goals yet. Add two or three — more than that turns into noise.')}

      <div class="section">
        <button class="btn block ${active.length ? 'ghost' : 'primary'}" data-a="new-goal">+ New goal</button>
      </div>

      ${paused.length ? `<div class="section"><div class="label">Paused</div><div class="stack">${paused.map(goalCard).join('')}</div></div>` : ''}
      ${done.length ? `<div class="section"><div class="label">Completed</div><div class="stack">${done.map(goalCard).join('')}</div></div>` : ''}
    `;
  },

  mount(root) {
    bind(root, '[data-a="new-goal"]', () => goalEditor(null));

    bind(root, '[data-a="open-goal"]', (el) => {
      const g = state.goals.find((x) => x.id === el.dataset.id);
      if (!g) return;
      haptic();
      const opts = [
        { id: 'task', label: 'Add a task toward this', emoji: '📋' },
        { id: 'edit', label: 'Edit goal', emoji: '✏️' }
      ];
      if (g.status === 'active') opts.push({ id: 'pause', label: 'Pause it', emoji: '⏸' });
      else if (g.status === 'paused') opts.push({ id: 'resume', label: 'Make it active again', emoji: '▶️' });
      if (g.status !== 'done') opts.push({ id: 'done', label: 'Mark completed', emoji: '✓' });
      else opts.push({ id: 'resume', label: 'Reopen', emoji: '↩︎' });

      pickSheet({
        title: g.name,
        sub: g.target ? horizon(g.target) : '',
        options: opts,
        onPick: (id) => {
          if (id === 'edit') return goalEditor(g.id);
          if (id === 'task') return openCapture({ goalId: g.id, cat: g.cat, when: 'inbox' });
          mutate(() => {
            if (id === 'pause') g.status = 'paused';
            if (id === 'resume') { g.status = 'active'; g.doneAt = null; }
            if (id === 'done') { g.status = 'done'; g.doneAt = Date.now(); }
          });
          if (id === 'done') toast('Goal completed. That is a real one.');
        }
      });
    });

    bindTasks(root);
  }
};
