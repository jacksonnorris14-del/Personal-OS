/* SETTINGS — the system bends to your life, not the other way around. */

import { state, mutate, FAITH_KINDS } from '../store.js';
import { esc, haptic, uid, DOW_SHORT, DOW_LONG } from '../util.js';
import { openSheet, confirmSheet, bind, toast, liveSave } from '../ui.js';
import { go } from '../app.js';

const PRIO_META = {
  money:  { emoji: '💰', label: 'Money / Business' },
  school: { emoji: '📚', label: 'School' },
  faith:  { emoji: '✝️', label: 'Faith' },
  health: { emoji: '💪', label: 'Health / Fitness' },
  social: { emoji: '👥', label: 'Social' }
};

function stepper(action, value, suffix = '') {
  return `
    <div class="row" style="gap:10px">
      <button class="btn sm ghost" data-a="${action}-" style="min-width:44px">−</button>
      <b style="min-width:34px;text-align:center;font-size:17px">${value}</b>
      <button class="btn sm ghost" data-a="${action}+" style="min-width:44px">+</button>
      ${suffix ? `<span class="tiny dim">${esc(suffix)}</span>` : ''}
    </div>`;
}

function standardEditor(id) {
  const st = id ? state.settings.standards.find((s) => s.id === id) : null;
  const custom = !st || st.type === 'custom';
  openSheet({
    title: st ? 'Edit standard' : 'New standard',
    body: `
      ${custom ? `
        <div class="field">
          <span class="lab">Label</span>
          <input class="input" id="s-label" data-autofocus value="${esc(st?.label || '')}" placeholder="e.g. No phone in bed" autocomplete="off">
        </div>
        <div class="field">
          <span class="lab">Emoji</span>
          <input class="input" id="s-emoji" value="${esc(st?.emoji || '•')}" maxlength="4" style="width:90px">
        </div>`
        : `<p class="sub">"${esc(st.label)}" adapts automatically — its days come from your ${st.type === 'faith' ? 'faith schedule' : st.type === 'move' ? 'fitness settings' : 'schedule'}.</p>`}

      ${st?.type === 'faith' ? '' : `
        <div class="field">
          <span class="lab">Days</span>
          <div class="chips">
            ${DOW_SHORT.map((d, i) => `<button class="chip ${(st?.days || [0,1,2,3,4,5,6]).includes(i) ? 'on' : ''}" data-d="${i}">${d}</button>`).join('')}
          </div>
        </div>`}

      <div class="field">
        <span class="lab">Counts toward a minimum day?</span>
        <div class="chips">
          <button class="chip ${st?.required !== false ? 'on' : ''}" data-r="1">Required</button>
          <button class="chip ${st?.required === false ? 'on' : ''}" data-r="0">Optional</button>
        </div>
      </div>

      <div class="actions">
        ${st ? '<button class="btn danger" data-x="del">Remove</button>' : ''}
        <button class="btn primary" data-x="save">Save</button>
      </div>`,
    onMount(sheet, close) {
      let days = [...(st?.days || [0, 1, 2, 3, 4, 5, 6])];
      let required = st?.required !== false;
      sheet.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => {
        const i = Number(b.dataset.d);
        days = days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort();
        b.classList.toggle('on');
      });
      sheet.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => {
        required = b.dataset.r === '1';
        sheet.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('on', x === b));
      });
      sheet.querySelector('[data-x="save"]').onclick = () => {
        const label = sheet.querySelector('#s-label')?.value.trim();
        if (custom && !label) { toast('Give it a label'); return; }
        mutate(() => {
          if (st) {
            if (custom) { st.label = label; st.emoji = sheet.querySelector('#s-emoji').value.trim() || '•'; }
            st.days = days; st.required = required;
          } else {
            state.settings.standards.push({
              id: uid(), type: 'custom', label,
              emoji: sheet.querySelector('#s-emoji').value.trim() || '•',
              days, required
            });
          }
        });
        close();
      };
      const del = sheet.querySelector('[data-x="del"]');
      if (del) del.onclick = async () => {
        close();
        if (await confirmSheet({ title: 'Remove standard?', sub: st.label, confirmLabel: 'Remove', danger: true })) {
          mutate(() => { state.settings.standards = state.settings.standards.filter((x) => x.id !== st.id); });
        }
      };
    }
  });
}

export default {
  render() {
    const s = state.settings;

    return `
      <div class="head">
        <div class="kicker"><button data-a="back" style="color:var(--text-3)">‹ More</button></div>
        <h1>Settings</h1>
        <p class="sub">Tune it once. Then stop thinking about it.</p>
      </div>

      <div class="section">
        <div class="label">You</div>
        <div class="card">
          <label class="field" style="margin-top:0">
            <span class="lab">First name (optional)</span>
            <input class="input" id="st-name" value="${esc(s.name)}" placeholder="Used in the greeting" autocomplete="off">
          </label>
        </div>
      </div>

      <div class="section">
        <div class="label">😴 Sleep <span class="hint">an appointment, not a suggestion</span></div>
        <div class="card">
          <div class="grid2">
            ${[['windDown', 'Wind-down'], ['phoneAway', 'Phone away'], ['bedtime', 'Lights out'], ['wake', 'Wake up']]
              .map(([k, l]) => `
                <label class="field" style="margin-top:0">
                  <span class="lab">${l}</span>
                  <input type="time" class="input" data-sleep="${k}" value="${s.sleep[k]}">
                </label>`).join('')}
          </div>
          <div class="field">
            <span class="lab">Weekend slack (Fri & Sat nights)</span>
            ${stepper('slack', `${s.sleep.weekendShift}m`)}
            <p class="tiny dim" style="margin-top:8px">Consistency matters more than earliness. Keep this small — or zero.</p>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="label">✝️ Faith schedule</div>
        <div class="stack">
          ${s.faith.plan.map((kind, i) => `
            <div class="row between card" style="padding:12px 15px">
              <span style="font-weight:580;font-size:14.5px">${DOW_LONG[i]}</span>
              <select class="input" data-faith="${i}" style="width:auto;min-width:190px;padding:9px 34px 9px 12px;font-size:14px">
                ${Object.entries(FAITH_KINDS).map(([k, m]) =>
                  `<option value="${k}" ${kind === k ? 'selected' : ''}>${m.emoji ? m.emoji + ' ' : ''}${m.label}</option>`).join('')}
              </select>
            </div>`).join('')}
        </div>
      </div>

      <div class="section">
        <div class="label">💪 Fitness</div>
        <div class="card">
          <div class="row between"><span class="tiny muted">Minimum per week</span>${stepper('fmin', s.fitness.min)}</div>
          <hr class="sep" style="margin:14px 0">
          <div class="row between"><span class="tiny muted">Ideal per week</span>${stepper('fideal', s.fitness.ideal)}</div>
          <div class="field">
            <span class="lab">Never schedule on</span>
            <div class="chips">
              ${DOW_SHORT.map((d, i) => `<button class="chip ${s.fitness.excluded.includes(i) ? 'on' : ''}" data-fx="${i}">${d}</button>`).join('')}
            </div>
          </div>
          <div class="field">
            <span class="lab">Preferred time</span>
            <div class="chips">
              ${[['morning', 'Before school'], ['afternoon', 'Afternoon'], ['evening', 'Evening'], ['any', 'Whenever it fits']]
                .map(([k, l]) => `<button class="chip ${s.fitness.preferred === k ? 'on' : ''}" data-fpref="${k}">${l}</button>`).join('')}
            </div>
          </div>
          <p class="tiny dim" style="margin-top:12px">${s.fitness.min} counts as a successful week. ${s.fitness.ideal} is ideal, not required.</p>
        </div>
      </div>

      <div class="section">
        <div class="label">👥 Social</div>
        <div class="card">
          <div class="row between"><span class="tiny muted">Minimum per week</span>${stepper('smin', s.social.min)}</div>
          <hr class="sep" style="margin:14px 0">
          <div class="row between"><span class="tiny muted">Usual maximum</span>${stepper('sideal', s.social.ideal)}</div>
          <p class="tiny dim" style="margin-top:12px">Friends are part of the plan. This just keeps the balance visible.</p>
        </div>
      </div>

      <div class="section">
        <div class="label">📚 School days</div>
        <div class="card">
          <div class="chips">
            ${DOW_SHORT.map((d, i) => `<button class="chip ${s.school.days.includes(i) ? 'on' : ''}" data-sch="${i}">${d}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="label">Priority order <span class="hint">what wins when time is short</span></div>
        <div class="stack">
          ${s.priorities.map((k, i) => `
            <div class="order-row">
              <span class="rank">${i + 1}</span>
              <span style="font-size:16px">${PRIO_META[k]?.emoji || ''}</span>
              <span class="grow" style="font-weight:580;font-size:14.5px">${esc(PRIO_META[k]?.label || k)}</span>
              <span class="mv">
                <button data-up="${i}" ${i === 0 ? 'disabled' : ''}>▲</button>
                <button data-down="${i}" ${i === s.priorities.length - 1 ? 'disabled' : ''}>▼</button>
              </span>
            </div>`).join('')}
        </div>
      </div>

      <div class="section">
        <div class="label">Daily standards</div>
        <div class="stack">
          ${s.standards.map((st) => `
            <button class="linkrow" data-std="${st.id}">
              <span class="ic">${st.emoji}</span>
              <span class="grow">
                <span class="t">${esc(st.label)}</span>
                <span class="d">${st.type === 'faith' ? 'Follows your faith schedule'
                  : st.type === 'move' ? 'Follows your fitness settings'
                  : (st.days || []).length === 7 ? 'Every day' : (st.days || []).map((d) => DOW_SHORT[d]).join(' ')}${st.required === false ? ' · optional' : ''}</span>
              </span>
              <span class="arrow">›</span>
            </button>`).join('')}
          <button class="btn sm block ghost" data-a="new-std">+ Add a standard</button>
        </div>
      </div>

      <div class="section">
        <div class="label">☀️ Sunday Reset checklist</div>
        <div class="stack">
          ${s.sunday.items.map((i) => `
            <div class="row between card" style="padding:12px 15px">
              <span class="grow tiny" style="font-size:14.5px">${esc(i.label)}<span class="d dim" style="display:block;font-size:12px">${i.group}</span></span>
              <button class="btn sm ghost" data-sr-del="${i.id}" style="min-height:34px;padding:0 12px">✕</button>
            </div>`).join('')}
          <div class="card" style="padding:12px">
            <input class="input" id="sr-new" placeholder="Add a reset item" autocomplete="off" enterkeyhint="done">
            <div class="chips" style="margin-top:9px">
              ${[['faith', '✝️'], ['life', '🧹'], ['food', '🍱'], ['school', '📚'], ['money', '💰']]
                .map(([g, e], idx) => `<button class="chip ${idx === 1 ? 'on' : ''}" data-sr-g="${g}">${e} ${g}</button>`).join('')}
            </div>
            <button class="btn sm block ghost" data-a="sr-add" style="margin-top:9px">Add</button>
          </div>
        </div>
      </div>

      <div class="section">
        <p class="tiny dim center" style="line-height:1.6">
          The day rolls over at 3:00 AM, so a late night still belongs to the day you're finishing.
        </p>
      </div>`;
  },

  mount(root) {
    const s = state.settings;
    const set = (fn) => mutate(fn);

    bind(root, '[data-a="back"]', () => go('more'));

    liveSave(root.querySelector('#st-name'), (v) => { s.name = v.trim(); });

    root.querySelectorAll('[data-sleep]').forEach((el) =>
      liveSave(el, (v) => { s.sleep[el.dataset.sleep] = v; }, { event: 'change', delay: 0 }));

    bind(root, '[data-a="slack+"]', () => set(() => { s.sleep.weekendShift = Math.min(120, s.sleep.weekendShift + 15); }));
    bind(root, '[data-a="slack-"]', () => set(() => { s.sleep.weekendShift = Math.max(0, s.sleep.weekendShift - 15); }));

    root.querySelectorAll('[data-faith]').forEach((el) =>
      liveSave(el, (v) => { s.faith.plan[Number(el.dataset.faith)] = v; }, { event: 'change', delay: 0 }));

    bind(root, '[data-a="fmin+"]', () => set(() => { s.fitness.min = Math.min(7, s.fitness.min + 1); s.fitness.ideal = Math.max(s.fitness.ideal, s.fitness.min); }));
    bind(root, '[data-a="fmin-"]', () => set(() => { s.fitness.min = Math.max(0, s.fitness.min - 1); }));
    bind(root, '[data-a="fideal+"]', () => set(() => { s.fitness.ideal = Math.min(7, s.fitness.ideal + 1); }));
    bind(root, '[data-a="fideal-"]', () => set(() => { s.fitness.ideal = Math.max(s.fitness.min, s.fitness.ideal - 1); }));

    bind(root, '[data-fx]', (el) => set(() => {
      const i = Number(el.dataset.fx);
      s.fitness.excluded = s.fitness.excluded.includes(i)
        ? s.fitness.excluded.filter((x) => x !== i)
        : [...s.fitness.excluded, i].sort();
    }));
    bind(root, '[data-fpref]', (el) => set(() => { s.fitness.preferred = el.dataset.fpref; }));

    bind(root, '[data-a="smin+"]', () => set(() => { s.social.min = Math.min(7, s.social.min + 1); s.social.ideal = Math.max(s.social.ideal, s.social.min); }));
    bind(root, '[data-a="smin-"]', () => set(() => { s.social.min = Math.max(0, s.social.min - 1); }));
    bind(root, '[data-a="sideal+"]', () => set(() => { s.social.ideal = Math.min(7, s.social.ideal + 1); }));
    bind(root, '[data-a="sideal-"]', () => set(() => { s.social.ideal = Math.max(s.social.min, s.social.ideal - 1); }));

    bind(root, '[data-sch]', (el) => set(() => {
      const i = Number(el.dataset.sch);
      s.school.days = s.school.days.includes(i) ? s.school.days.filter((x) => x !== i) : [...s.school.days, i].sort();
    }));

    bind(root, '[data-up]', (el) => set(() => {
      const i = Number(el.dataset.up);
      [s.priorities[i - 1], s.priorities[i]] = [s.priorities[i], s.priorities[i - 1]];
      haptic();
    }));
    bind(root, '[data-down]', (el) => set(() => {
      const i = Number(el.dataset.down);
      [s.priorities[i + 1], s.priorities[i]] = [s.priorities[i], s.priorities[i + 1]];
      haptic();
    }));

    bind(root, '[data-std]', (el) => standardEditor(el.dataset.std));
    bind(root, '[data-a="new-std"]', () => standardEditor(null));

    let srGroup = 'life';
    bind(root, '[data-sr-g]', (el) => {
      srGroup = el.dataset.srG;
      root.querySelectorAll('[data-sr-g]').forEach((x) => x.classList.toggle('on', x === el));
    });
    const srAdd = () => {
      const input = root.querySelector('#sr-new');
      const label = input.value.trim();
      if (!label) return;
      set(() => { s.sunday.items.push({ id: uid(), group: srGroup, label }); });
    };
    bind(root, '[data-a="sr-add"]', srAdd);
    root.querySelector('#sr-new').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); srAdd(); } });
    bind(root, '[data-sr-del]', (el) => set(() => {
      s.sunday.items = s.sunday.items.filter((x) => x.id !== el.dataset.srDel);
    }));
  }
};
