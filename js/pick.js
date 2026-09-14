/* Shared picker: choose an existing task or type a new one in the same sheet.
   Used anywhere a Must Win / Secondary Win / project task gets chosen. */

import { state, mutate, newTask, currentProject, taskById } from './store.js';
import { openSheet } from './ui.js';
import { esc, haptic, relDay, sortBy } from './util.js';
import { CATS } from './store.js';

/**
 * pickTask({ title, sub, dateKey, exclude, onPick })
 * Creates the task if the user types something new; always returns a task id.
 */
export function pickTask({ title = 'Choose a task', sub = '', dateKey = null, exclude = [], onPick }) {
  const proj = currentProject();
  const open = sortBy(
    state.tasks.filter((t) => !t.done && t.type !== 'idea' && !exclude.includes(t.id)),
    (t) => `${t.date ? '0' + t.date : '1'}${t.createdAt}`
  ).slice(0, 40);

  const rowHtml = (t) => {
    const bits = [];
    if (t.date) bits.push(relDay(t.date));
    else if (t.inbox) bits.push('Inbox');
    if (t.projectId && t.projectId === proj?.id) bits.push('Money Engine');
    else if (t.cat && t.cat !== 'other') bits.push(CATS[t.cat].label);
    return `
      <button class="linkrow" data-pick="${t.id}">
        <span class="ic">${CATS[t.cat]?.emoji || '•'}</span>
        <span class="grow">
          <span class="t">${esc(t.title)}</span>
          ${bits.length ? `<span class="d">${esc(bits.join(' · '))}</span>` : ''}
        </span>
        <span class="arrow">›</span>
      </button>`;
  };

  openSheet({
    title, sub,
    body: `
      <div class="field" style="margin-top:14px">
        <input class="input" id="pk-new" data-autofocus placeholder="Type a new one…" enterkeyhint="done" autocomplete="off">
      </div>
      <button class="btn primary block" id="pk-add" style="margin-top:10px">Use this</button>
      ${open.length ? `
        <div class="section"><div class="label">Or pick an existing task</div>
          <div class="list-sep">${open.map(rowHtml).join('')}</div>
        </div>` : ''}`,
    onMount(sheet, close) {
      const input = sheet.querySelector('#pk-new');
      const add = () => {
        const v = input.value.trim();
        if (!v) return;
        const id = mutate(() => newTask({
          title: v,
          date: dateKey,
          inbox: !dateKey,
          projectId: null,
          cat: 'other'
        }).id);
        haptic(12);
        close();
        onPick?.(id);
      };
      sheet.querySelector('#pk-add').onclick = add;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      sheet.querySelectorAll('[data-pick]').forEach((b) => b.onclick = () => {
        haptic();
        close();
        onPick?.(b.dataset.pick);
      });
    }
  });
}

/** Assign a task to a day (used when it becomes a Must/Secondary Win). */
export function scheduleTask(id, dateKey) {
  const t = taskById(id);
  if (!t) return;
  t.date = dateKey;
  t.inbox = false;
}
