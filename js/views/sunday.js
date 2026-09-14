/* SUNDAY RESET — the weekly appointment with yourself.
   Ten to twenty minutes: clear the decks, then decide the one thing that
   would make the coming week a success. */

import { state, getWeek, week, mutate, currentProject } from '../store.js';
import { workoutStats, socialStats } from '../logic.js';
import { todayKey, weekKeyOf, weekDays, dow, esc, haptic, DOW_SHORT, fmtShort, uid } from '../util.js';
import { checkRow, bind, toast, liveSave } from '../ui.js';
import { go } from '../app.js';

const GROUPS = [
  ['faith',  '✝️ Faith'],
  ['life',   '🧹 Life reset'],
  ['food',   '🍱 Food'],
  ['school', '📚 School'],
  ['money',  '💰 Money Engine']
];

export default {
  render() {
    const today = todayKey();
    const wkKey = weekKeyOf(today);
    const w = getWeek(wkKey);
    const items = state.settings.sunday.items;
    const doneCount = items.filter((i) => w.reset[i.id]).length;
    const proj = currentProject();
    const wo = workoutStats(wkKey, today);
    const soc = socialStats(wkKey);
    const plannedGym = w.plannedGym || [];
    const excluded = state.settings.fitness.excluded;
    const days = weekDays(wkKey);

    return `
      <div class="head">
        <div class="kicker">☀️ Sunday Reset</div>
        <h1>Set the week up.</h1>
        <p class="sub">${doneCount}/${items.length} handled · about 10–20 minutes</p>
      </div>

      <div class="card">
        <div class="bar"><i style="width:${Math.round((doneCount / Math.max(1, items.length)) * 100)}%"></i></div>
      </div>

      ${GROUPS.map(([g, label]) => {
        const list = items.filter((i) => i.group === g);
        if (!list.length) return '';
        return `
          <div class="section">
            <div class="label">${label}</div>
            <div class="stack">
              ${list.map((i) => checkRow({ id: i.id, label: i.label, on: !!w.reset[i.id], attrs: 'data-a="reset-item"' })).join('')}
            </div>
            ${g === 'money' && proj ? `<p class="tiny dim" style="margin-top:9px;padding:0 2px">Current project: ${esc(proj.name)}</p>` : ''}
          </div>`;
      }).join('')}

      <div class="section">
        <div class="label">📅 The week's big win</div>
        <div class="card" style="border-color:rgba(255,95,70,.26);background:linear-gradient(155deg,rgba(255,75,62,.10),rgba(255,75,62,.02))">
          <p class="muted" style="font-size:14.5px;line-height:1.5">
            What <b style="color:var(--text)">one</b> accomplishment would make this week a success?
          </p>
          <input class="input" id="bigwin" style="margin-top:12px" value="${esc(w.bigWin || '')}"
                 placeholder="e.g. Finish and launch Version 1" autocomplete="off">
          ${w.bigWin ? `
            <button class="check ${w.bigWinDone ? 'on' : ''}" data-a="bigwin-done" style="margin-top:10px;background:transparent">
              <span class="box">✓</span>
              <span class="txt">${w.bigWinDone ? 'Achieved this week' : 'Mark it achieved'}</span>
            </button>` : ''}
          <p class="tiny dim" style="margin-top:10px">One weekly objective. Everything else is support.</p>
        </div>
      </div>

      <div class="section">
        <div class="label">🗓️ This week's schedule <span class="hint">tests, plans, events</span></div>
        <div class="stack">
          ${(w.notes || []).map((n) => `
            <div class="check">
              <span class="lead">${n.day ? '📌' : '•'}</span>
              <span class="txt grow wrap-any">${esc(n.text)}${n.day ? `<span class="meta">${esc(fmtShort(n.day))}</span>` : ''}</span>
              <button class="btn sm ghost" data-a="note-del" data-id="${n.id}" style="min-height:34px;padding:0 12px">✕</button>
            </div>`).join('')}
          <div class="card" style="padding:12px">
            <input class="input" id="note-text" placeholder="Add: test, appointment, plans…" autocomplete="off" enterkeyhint="done">
            <div class="chips" style="margin-top:9px">
              ${days.map((k, i) => `<button class="chip" data-note-day="${k}">${DOW_SHORT[i]}</button>`).join('')}
            </div>
            <button class="btn sm block ghost" data-a="note-add" style="margin-top:9px">Add to the week</button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="label">💪 Gym plan <span class="hint">${wo.min} minimum · ${wo.ideal} ideal</span></div>
        <div class="card">
          <p class="tiny dim">Pick the days you intend to train. Sunday stays off by default.</p>
          <div class="chips" style="margin-top:11px">
            ${days.map((k, i) => excluded.includes(dow(k))
              ? `<button class="chip" disabled style="opacity:.3">${DOW_SHORT[i]}</button>`
              : `<button class="chip ${plannedGym.includes(k) ? 'on' : ''}" data-gym="${k}">${DOW_SHORT[i]}</button>`).join('')}
          </div>
          <p class="tiny" style="margin-top:11px;color:${plannedGym.length >= wo.min ? 'var(--ok)' : 'var(--text-3)'}">
            ${plannedGym.length} planned ${plannedGym.length >= wo.ideal ? '· ideal week'
              : plannedGym.length >= wo.min ? '· minimum covered'
              : `· ${wo.min - plannedGym.length} more to reach the minimum`}
          </p>
        </div>
      </div>

      <div class="section">
        <div class="label">👥 Social <span class="hint">${soc.min} minimum · ${soc.ideal} ideal</span></div>
        <div class="card">
          <div class="row between">
            <div class="metric"><b>${w.plannedSocial || 0}</b><span>planned this week</span></div>
            <div class="row" style="gap:8px">
              <button class="btn sm ghost" data-a="soc-" style="min-width:44px">−</button>
              <button class="btn sm ghost" data-a="soc+" style="min-width:44px">+</button>
            </div>
          </div>
          <p class="tiny dim" style="margin-top:10px">
            ${(w.plannedSocial || 0) > soc.ideal
              ? 'Above your usual target — fine if the week allows it.'
              : (w.plannedSocial || 0) >= soc.min
                ? 'Good. Friends are part of the plan, not a leak from it.'
                : 'At least one thing with friends keeps the balance honest.'}
          </p>
        </div>
      </div>

      <div class="section">
        <button class="btn primary block" data-a="finish">${w.resetDoneAt ? 'Update the reset' : 'Finish the reset'}</button>
        <p class="tiny dim center" style="margin-top:9px">
          ${w.resetDoneAt ? 'Completed this week. Come back anytime.' : 'You can finish with items unchecked — the week still counts.'}
        </p>
      </div>`;
  },

  mount(root) {
    const wkKey = weekKeyOf(todayKey());
    let noteDay = null;

    bind(root, '[data-a="reset-item"]', (el) => {
      haptic();
      mutate(() => { const w = week(wkKey); w.reset[el.dataset.id] = !w.reset[el.dataset.id]; });
    });

    liveSave(root.querySelector('#bigwin'), (v) => { week(wkKey).bigWin = v.trim(); });

    bind(root, '[data-a="bigwin-done"]', () => {
      haptic(14);
      mutate(() => { const w = week(wkKey); w.bigWinDone = !w.bigWinDone; });
    });

    bind(root, '[data-note-day]', (el) => {
      noteDay = noteDay === el.dataset.noteDay ? null : el.dataset.noteDay;
      root.querySelectorAll('[data-note-day]').forEach((x) => x.classList.toggle('on', x.dataset.noteDay === noteDay));
      haptic();
    });

    const addNote = () => {
      const input = root.querySelector('#note-text');
      const text = input.value.trim();
      if (!text) return;
      mutate(() => {
        const w = week(wkKey);
        w.notes = w.notes || [];
        w.notes.push({ id: uid(), text, day: noteDay });
      });
      haptic(12);
    };
    bind(root, '[data-a="note-add"]', addNote);
    const noteInput = root.querySelector('#note-text');
    if (noteInput) noteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } });

    bind(root, '[data-a="note-del"]', (el) => mutate(() => {
      const w = week(wkKey);
      w.notes = (w.notes || []).filter((n) => n.id !== el.dataset.id);
    }));

    bind(root, '[data-gym]', (el) => {
      haptic();
      mutate(() => {
        const w = week(wkKey);
        const set = new Set(w.plannedGym || []);
        set.has(el.dataset.gym) ? set.delete(el.dataset.gym) : set.add(el.dataset.gym);
        w.plannedGym = [...set].sort();
      });
    });

    bind(root, '[data-a="soc+"]', () => mutate(() => { const w = week(wkKey); w.plannedSocial = (w.plannedSocial || 0) + 1; }));
    bind(root, '[data-a="soc-"]', () => mutate(() => { const w = week(wkKey); w.plannedSocial = Math.max(0, (w.plannedSocial || 0) - 1); }));

    bind(root, '[data-a="finish"]', () => {
      const b = root.querySelector('#bigwin');
      haptic(18);
      mutate(() => {
        const w = week(wkKey);
        if (b) w.bigWin = b.value.trim();
        w.resetDoneAt = Date.now();
        w.plannedAt = Date.now();
      });
      toast('Week is set. Now go execute it.');
      go('today');
    });
  }
};
