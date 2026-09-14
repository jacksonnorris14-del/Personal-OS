/* Shared task row + editor, used by Plan, Money and Goals. */

import { state, mutate, taskById, setTaskDone, deleteTask, CATS } from './store.js';
import { openSheet, confirmSheet, bind, toast } from './ui.js';
import { esc, haptic, relDay, todayKey, tomorrowKey } from './util.js';

export function taskRowHtml(t, { showDate = true, inProject = false } = {}) {
  const meta = [];
  if (showDate && t.date) meta.push(relDay(t.date));
  else if (t.inbox && !inProject) meta.push('Inbox');
  else if (inProject && !t.date) meta.push('Unscheduled');
  if (!inProject) {
    if (t.kind === 'build') meta.push('Build');
    if (t.kind === 'learn') meta.push('Learn');
    const proj = state.projects.find((p) => p.id === t.projectId);
    if (proj) meta.push(proj.name);
    const goal = state.goals.find((g) => g.id === t.goalId);
    if (goal && !proj) meta.push(goal.name);
  }

  return `
    <div class="check ${t.done ? 'on' : ''}" style="padding:0">
      <button data-task-toggle="${t.id}" aria-label="Toggle complete"
              style="display:flex;align-items:center;gap:13px;padding:14px 0 14px 15px;flex:none">
        <span class="box">✓</span>
      </button>
      <button data-task-open="${t.id}" class="grow"
              style="text-align:left;padding:14px 15px 14px 13px;min-width:0">
        <span class="txt" style="display:block">${t.priority === 'high' && !t.done ? '<span style="color:var(--must)">•</span> ' : ''}${t.type === 'idea' ? '💡 ' : ''}${esc(t.title)}</span>
        ${meta.length ? `<span class="meta">${esc(meta.join(' · '))}</span>` : ''}
      </button>
    </div>`;
}

export function bindTasks(root) {
  bind(root, '[data-task-toggle]', (el) => {
    haptic();
    mutate(() => setTaskDone(el.dataset.taskToggle, !taskById(el.dataset.taskToggle)?.done));
  });
  bind(root, '[data-task-open]', (el) => openTaskEditor(el.dataset.taskOpen));
}

export function openTaskEditor(id) {
  const t = taskById(id);
  if (!t) return;
  const when = t.date === todayKey() ? 'today' : t.date === tomorrowKey() ? 'tomorrow' : t.date ? 'date' : 'someday';

  openSheet({
    title: 'Edit',
    body: `
      <div class="field">
        <span class="lab">Title</span>
        <input class="input" id="e-title" value="${esc(t.title)}" autocomplete="off">
      </div>

      <div class="field">
        <span class="lab">Notes</span>
        <textarea class="input" id="e-notes" placeholder="Optional">${esc(t.notes)}</textarea>
      </div>

      <div class="field">
        <span class="lab">When</span>
        <div class="chips">
          <button class="chip ${when === 'today' ? 'on' : ''}" data-w="today">Today</button>
          <button class="chip ${when === 'tomorrow' ? 'on' : ''}" data-w="tomorrow">Tomorrow</button>
          <button class="chip ${when === 'someday' ? 'on' : ''}" data-w="someday">Someday</button>
        </div>
        <input type="date" class="input" id="e-date" style="margin-top:8px" value="${t.date || ''}">
      </div>

      <div class="field">
        <span class="lab">Category</span>
        <div class="chips">
          ${Object.entries(CATS).map(([k, c]) =>
            `<button class="chip ${t.cat === k ? 'on' : ''}" data-c="${k}">${c.emoji} ${c.label}</button>`).join('')}
        </div>
      </div>

      <div class="field">
        <span class="lab">Priority</span>
        <div class="chips">
          ${[['high', 'High'], ['normal', 'Normal'], ['low', 'Low']].map(([k, l]) =>
            `<button class="chip ${(t.priority || 'normal') === k ? 'on' : ''}" data-pr="${k}">${l}</button>`).join('')}
        </div>
      </div>

      <div class="field">
        <span class="lab">Build or learn</span>
        <div class="chips">
          <button class="chip ${t.kind === 'build' ? 'on' : ''}" data-k="build">🟢 Build</button>
          <button class="chip ${t.kind === 'learn' ? 'on' : ''}" data-k="learn">🔵 Learn</button>
          <button class="chip ${!t.kind ? 'on' : ''}" data-k="">Neither</button>
        </div>
      </div>

      ${state.projects.length ? `
        <div class="field">
          <span class="lab">Project</span>
          <select class="input" id="e-proj">
            <option value="">None</option>
            ${state.projects.map((p) => `<option value="${p.id}" ${t.projectId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
        </div>` : ''}

      ${state.goals.length ? `
        <div class="field">
          <span class="lab">Goal</span>
          <select class="input" id="e-goal">
            <option value="">None</option>
            ${state.goals.map((g) => `<option value="${g.id}" ${t.goalId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
          </select>
        </div>` : ''}

      <div class="actions">
        <button class="btn danger" data-x="del">Delete</button>
        <button class="btn primary" data-x="save">Save</button>
      </div>`,

    onMount(sheet, close) {
      let cat = t.cat, kind = t.kind, priority = t.priority || 'normal';
      const dateInput = sheet.querySelector('#e-date');

      sheet.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => {
        const w = b.dataset.w;
        dateInput.value = w === 'today' ? todayKey() : w === 'tomorrow' ? tomorrowKey() : '';
        sheet.querySelectorAll('[data-w]').forEach((x) => x.classList.toggle('on', x === b));
        haptic();
      });
      sheet.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => {
        cat = b.dataset.c;
        sheet.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b));
      });
      sheet.querySelectorAll('[data-pr]').forEach((b) => b.onclick = () => {
        priority = b.dataset.pr;
        sheet.querySelectorAll('[data-pr]').forEach((x) => x.classList.toggle('on', x === b));
      });
      sheet.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => {
        kind = b.dataset.k || null;
        sheet.querySelectorAll('[data-k]').forEach((x) => x.classList.toggle('on', x === b));
      });

      sheet.querySelector('[data-x="save"]').onclick = () => {
        const title = sheet.querySelector('#e-title').value.trim();
        if (!title) { toast('Give it a title'); return; }
        mutate(() => {
          t.title = title;
          t.notes = sheet.querySelector('#e-notes').value.trim();
          t.date = dateInput.value || null;
          t.inbox = !t.date && t.inbox;
          t.cat = cat;
          t.kind = kind;
          t.priority = priority;
          const ps = sheet.querySelector('#e-proj');
          if (ps) t.projectId = ps.value || null;
          const gs = sheet.querySelector('#e-goal');
          if (gs) t.goalId = gs.value || null;
        });
        close();
      };

      sheet.querySelector('[data-x="del"]').onclick = async () => {
        close();
        const ok = await confirmSheet({ title: 'Delete this?', sub: t.title, confirmLabel: 'Delete', danger: true });
        if (ok) { mutate(() => deleteTask(t.id)); toast('Deleted'); }
      };
    }
  });
}
