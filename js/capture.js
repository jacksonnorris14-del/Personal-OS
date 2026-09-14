/* Capture: get it out of your head in a few seconds, then get back to work.
   One field, two optional taps, done. Defaults to the Inbox so nothing
   demands a decision at the moment of capture. */

import { mutate, newTask } from './store.js';
import { openSheet, toast } from './ui.js';
import { todayKey, tomorrowKey, haptic } from './util.js';

export function openCapture(prefill = {}) {
  let when = prefill.when || 'inbox';        // inbox | today | tomorrow
  let type = prefill.type || 'task';         // task | idea

  openSheet({
    title: 'Capture',
    sub: 'Write it down and get back to what you were doing.',
    body: `
      <div class="field" style="margin-top:16px">
        <input class="input" id="cap-text" data-autofocus placeholder="Task, idea, something to remember…"
               autocomplete="off" autocapitalize="sentences" enterkeyhint="done">
      </div>
      <div class="chips" style="margin-top:12px">
        <button class="chip on" data-when="inbox">📥 Inbox</button>
        <button class="chip" data-when="today">Today</button>
        <button class="chip" data-when="tomorrow">Tomorrow</button>
      </div>
      <div class="chips" style="margin-top:8px">
        <button class="chip on" data-type="task">📋 Task</button>
        <button class="chip" data-type="idea">💡 Idea</button>
      </div>
      <div class="actions">
        <button class="btn primary block" id="cap-save">Capture</button>
      </div>`,

    onMount(sheet, close) {
      const input = sheet.querySelector('#cap-text');

      sheet.querySelectorAll('[data-when]').forEach((b) => b.onclick = () => {
        when = b.dataset.when;
        sheet.querySelectorAll('[data-when]').forEach((x) => x.classList.toggle('on', x === b));
        haptic();
      });
      sheet.querySelectorAll('[data-type]').forEach((b) => b.onclick = () => {
        type = b.dataset.type;
        sheet.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('on', x === b));
        haptic();
      });

      const save = () => {
        const title = input.value.trim();
        if (!title) { close(); return; }
        mutate(() => newTask({
          title,
          type,
          inbox: when === 'inbox',
          date: when === 'today' ? todayKey() : when === 'tomorrow' ? tomorrowKey() : null,
          projectId: prefill.projectId || null,
          goalId: prefill.goalId || null,
          cat: prefill.cat || (type === 'idea' ? 'money' : 'other'),
          kind: prefill.kind || null
        }));
        haptic(12);
        close();
        toast(when === 'inbox' ? 'Saved to Inbox' : `Saved for ${when}`);
      };

      sheet.querySelector('#cap-save').onclick = save;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    }
  });
}
