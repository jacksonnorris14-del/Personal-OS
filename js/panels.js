/* Every star opens one of these. Each fact lives in exactly one panel. */

import {
  state, getDay, day, getWeek, week, mutate, commit, taskById, setTaskDone,
  newTask, newGoal, deleteGoal, newProject, currentProject,
  newReminder, reminderById, deleteReminder, newLearned, deleteLearned,
  exportJSON, importJSON, resetAll, FAITH_KINDS, AREAS
} from './store.js';
import {
  faithFor, sleepTargets, workoutStats, socialStats, rhythmFor,
  mood, areaRates, projectTasks, dueReminders, reminderState,
  reminderRule, markReminderDone
} from './logic.js';
import {
  todayKey, tomorrowKey, addDays, dow, weekKeyOf, weekDays, esc, fmtTime,
  haptic, sortBy, relDay, fmtShort, DOW_SHORT, DOW_LONG, daysBetween
} from './util.js';
import { openPanel, closePanel, confirmPanel, toast, bind, line, dots, field } from './ui.js';

const K = () => todayKey();
const pctTxt = (hit, of) => (of ? `${Math.round((hit / of) * 100)}%` : '—');

/* ---------- choosing a task ---------- */

function pickTask({ title, dateKey, exclude = [], onPick }) {
  const open = sortBy(
    state.tasks.filter((t) => !t.done && t.type !== 'idea' && !exclude.includes(t.id)),
    (t) => `${t.date ? '0' + t.date : '1'}${t.createdAt}`
  ).slice(0, 30);

  openPanel({
    title,
    body: `
      <input class="input" id="pk" data-autofocus placeholder="Write it" enterkeyhint="done" autocomplete="off">
      <button class="btn accent wide" id="pk-go">Use This</button>
      ${open.length ? `<p class="kicker mt">Or Pick One</p>
        <div class="lines">${open.map((t) => `
          <button class="line" data-pick="${t.id}">
            <span class="line-text"><span class="line-label">${esc(t.title)}</span>
            ${t.date ? `<span class="line-meta">${esc(relDay(t.date))}</span>` : ''}</span>
          </button>`).join('')}</div>` : ''}`,
    onMount(panel, close) {
      const inp = panel.querySelector('#pk');
      const go = () => {
        const v = inp.value.trim();
        if (!v) return;
        const id = mutate(() => newTask({ title: v, date: dateKey, inbox: !dateKey }).id);
        haptic(12); close(); onPick(id);
      };
      panel.querySelector('#pk-go').onclick = go;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      bind(panel, '[data-pick]', (el) => { haptic(); close(); onPick(el.dataset.pick); });
    }
  });
}

/* ---------- the mission ---------- */

function mustPanel() {
  const key = K();
  const d = getDay(key);
  const t = taskById(d.mustId);
  const loose = dueReminders(key, null);
  openPanel({
    kicker: 'Today',
    title: t ? t.title : 'No Focus Set',
    body: (t
      ? `<button class="btn ${t.done ? '' : 'accent'} wide" data-x="done">${t.done ? 'Completed — Undo' : 'Mark Done'}</button>
         <button class="btn wide ghost" data-x="change">Change</button>`
      : `<p class="lede">One thing that would make today count.</p>
         <button class="btn accent wide" data-x="change">Choose It</button>`)
      + (loose.length ? `<p class="kicker mt">Due</p><div class="lines">${loose.map(({ r: rm, s: rs }) =>
          line(rm.label, { on: false, meta: rs.overdue > 0 ? `${rs.overdue} Days Overdue` : 'Due Today',
                           attrs: `data-rdone="${rm.id}"` })).join('')}</div>` : ''),
    onMount(panel, close) {
      bind(panel, '[data-rdone]', (el) => {
        haptic(); const rm = reminderById(el.dataset.rdone);
        if (rm) mutate(() => markReminderDone(rm, key));
        close();
      });
      bind(panel, '[data-x="done"]', () => {
        haptic(14); mutate(() => setTaskDone(t.id, !t.done)); close();
      });
      bind(panel, '[data-x="change"]', () => {
        close();
        pickTask({ title: "Today's Focus", dateKey: key,
          onPick: (id) => mutate(() => { const x = taskById(id); if (x) { x.date = key; x.inbox = false; } day(key).mustId = id; }) });
      });
    }
  });
}

function secondPanel(star) {
  const key = K();
  const t = taskById(star.taskId);
  if (!t) return;
  openPanel({
    kicker: 'Secondary',
    title: t.title,
    body: `<button class="btn ${t.done ? '' : 'accent'} wide" data-x="done">${t.done ? 'Completed — Undo' : 'Mark Done'}</button>
           <button class="btn wide ghost" data-x="drop">Remove From Today</button>`,
    onMount(panel, close) {
      bind(panel, '[data-x="done"]', () => { haptic(14); mutate(() => setTaskDone(t.id, !t.done)); close(); });
      bind(panel, '[data-x="drop"]', () => {
        mutate(() => { const r = day(key); r.secondIds = r.secondIds.filter((x) => x !== t.id); });
        close();
      });
    }
  });
}

/* ---------- commitments ---------- */

function togglePanel({ kicker, title, lede = '', fieldName, extra = '', onMount }) {
  const key = K();
  const d = getDay(key);
  openPanel({
    kicker, title,
    body: `${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
      <button class="btn ${d[fieldName] ? '' : 'accent'} wide" data-x="t">${d[fieldName] ? 'Done — Undo' : 'Mark Done'}</button>
      ${extra}`,
    onMount(panel, close) {
      bind(panel, '[data-x="t"]', () => {
        haptic(14); mutate(() => { const r = day(key); r[fieldName] = !r[fieldName]; }); close();
      });
      onMount?.(panel, close);
    }
  });
}

function businessPanel() {
  const key = K();
  const d = getDay(key);
  const proj = currentProject();
  if (!proj) {
    openPanel({
      kicker: 'Business', title: 'No Current Project',
      body: `<p class="lede">Name the thing you're building.</p>
             <input class="input" id="np" data-autofocus placeholder="Project name" enterkeyhint="done">
             <button class="btn accent wide" id="np-go">Set It</button>`,
      onMount(panel, close) {
        const go = () => {
          const v = panel.querySelector('#np').value.trim();
          if (!v) return;
          mutate(() => { state.settings.currentProjectId = newProject({ name: v }).id; });
          close();
        };
        panel.querySelector('#np-go').onclick = go;
        panel.querySelector('#np').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      }
    });
    return;
  }

  const week7 = Array.from({ length: 7 }, (_, i) => !!getDay(addDays(key, -(6 - i))).money);
  const learns = projectTasks(proj.id).filter((t) => t.kind === 'learn');

  openPanel({
    kicker: 'Business', title: proj.name,
    body: `
      <button class="btn ${d.money ? '' : 'accent'} wide" data-x="log">${d.money ? 'Worked Today — Undo' : 'Log Work Today'}</button>
      <div class="rowline">${dots(week7)}<span class="line-meta">${week7.filter(Boolean).length} of 7 days</span></div>
      <p class="kicker mt">Learning List</p>
      <div class="lines">
        ${learns.map((t) => line(t.title, { on: false, attrs: `data-learn="${t.id}"` })).join('')
          || '<p class="empty">Empty</p>'}
      </div>
      <button class="btn wide ghost" data-x="add-learn">Add Something To Learn</button>
      <button class="btn wide ghost" data-x="switch">Change Project</button>`,
    onMount(panel, close) {
      bind(panel, '[data-x="log"]', () => { haptic(14); mutate(() => { day(key).money = !day(key).money; }); close(); });
      bind(panel, '[data-learn]', (el) => {
        haptic(); mutate(() => setTaskDone(el.dataset.learn, true)); close();
      });
      bind(panel, '[data-x="add-learn"]', () => {
        close();
        openPanel({
          title: 'Add To Learning List',
          body: `<input class="input" id="ln" data-autofocus placeholder="What To Learn" enterkeyhint="done">
                 <button class="btn accent wide" id="ln-go">Add</button>`,
          onMount(p2, c2) {
            const go = () => {
              const v = p2.querySelector('#ln').value.trim();
              if (!v) return c2();
              mutate(() => newTask({ title: v, projectId: proj.id, kind: 'learn', cat: 'money' }));
              haptic(12); c2();
            };
            p2.querySelector('#ln-go').onclick = go;
            p2.querySelector('#ln').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
          }
        });
      });
      bind(panel, '[data-x="switch"]', () => { close(); projectsPanel(); });
    }
  });
}

function projectsPanel() {
  openPanel({
    kicker: 'Projects', title: 'Projects',
    body: `<div class="lines">
        ${state.projects.map((p) => line(p.name, {
          meta: p.id === state.settings.currentProjectId ? 'Current' : p.status,
          attrs: `data-p="${p.id}"` })).join('') || '<p class="empty">None yet</p>'}
      </div>
      <input class="input mt" id="pn" placeholder="New Project" enterkeyhint="done">
      <button class="btn wide ghost" id="pn-go">Add Project</button>`,
    onMount(panel, close) {
      bind(panel, '[data-p]', (el) => {
        mutate(() => { state.settings.currentProjectId = el.dataset.p; const p = state.projects.find((x) => x.id === el.dataset.p); if (p) p.status = 'active'; });
        close();
      });
      panel.querySelector('#pn-go').onclick = () => {
        const v = panel.querySelector('#pn').value.trim();
        if (!v) return;
        mutate(() => { state.settings.currentProjectId = newProject({ name: v }).id; });
        close();
      };
    }
  });
}

function movePanel() {
  const key = K();
  const wk = weekKeyOf(key);
  const w = workoutStats(wk, key);
  const flags = weekDays(wk).map((k) => !!getDay(k).workout);
  togglePanel({
    kicker: 'Training', title: `${w.done} of ${w.min} this week`,
    fieldName: 'workout',
    extra: `<div class="rowline">${dots(flags)}<span class="line-meta">${w.ideal} is the ideal week</span></div>`
  });
}

function sleepPanel() {
  const key = K();
  const d = getDay(key);
  const t = sleepTargets(key);
  openPanel({
    kicker: 'Sleep', title: `${fmtTime(t.bedtime)} → ${fmtTime(t.wake)}`,
    body: `
      <div class="grid4">
        ${[['Wind-Down', t.windDown], ['Phone Away', t.phoneAway], ['Lights Out', t.bedtime], ['Wake', t.wake]]
          .map(([l, v]) => `<div><span class="flabel">${l}</span><span class="stat-v">${fmtTime(v)}</span></div>`).join('')}
      </div>
      <div class="lines mt">
        ${line('Woke At Target', { on: !!d.wake, attrs: 'data-s="wake"' })}
        ${line('Lights Out On Time', { on: !!d.bed, attrs: 'data-s="bed"' })}
      </div>`,
    onMount(panel) {
      bind(panel, '[data-s]', (el) => {
        haptic();
        mutate(() => { const r = day(key); r[el.dataset.s] = !r[el.dataset.s]; });
        closePanel();
      });
    }
  });
}

function educationPanel() {
  const key = K();
  const d = getDay(key);
  const r = rhythmFor(key);
  const isSchoolDay = state.settings.school.days.includes(dow(key));
  const due = dueReminders(key, 'education');
  const recent = state.learned.slice(0, 8);

  openPanel({
    kicker: 'Education',
    title: isSchoolDay && r?.school ? `School ${fmtTime(r.school.start)}–${fmtTime(r.school.end)}` : 'Education',
    wide: true,
    body: `
      ${isSchoolDay
        ? `<button class="btn ${d.school ? '' : 'accent'} wide" data-x="school">${d.school ? 'Handled Today — Undo' : 'Mark School Handled'}</button>`
        : '<p class="lede">No school today.</p>'}

      ${due.length ? `<p class="kicker mt">Due</p>
        <div class="lines">${due.map(({ r: rm, s: rs }) => line(rm.label, {
          on: false, meta: rs.overdue > 0 ? `${rs.overdue} Days Overdue` : 'Due Today',
          attrs: `data-rdone="${rm.id}"` })).join('')}</div>` : ''}

      <p class="kicker mt">Learned Outside School</p>
      <div class="lines">
        ${recent.map((l) => line(l.title, { meta: fmtShort(l.at), attrs: `data-ldel="${l.id}"` })).join('')
          || '<p class="empty">Nothing logged yet</p>'}
      </div>
      <button class="btn wide ghost" data-x="learn">Log Something Learned</button>
      <button class="btn wide ghost" data-x="remind">Add A Reminder</button>`,
    onMount(panel, close) {
      bind(panel, '[data-x="school"]', () => {
        haptic(14); mutate(() => { day(key).school = !day(key).school; }); close();
      });
      bind(panel, '[data-rdone]', (el) => {
        haptic(); const rm = reminderById(el.dataset.rdone);
        if (rm) mutate(() => markReminderDone(rm, key));
        close();
      });
      bind(panel, '[data-ldel]', async (el) => {
        const l = state.learned.find((x) => x.id === el.dataset.ldel);
        close();
        if (await confirmPanel({ title: 'Remove This?', note: l?.title || '', confirm: 'Remove', danger: true })) {
          mutate(() => deleteLearned(el.dataset.ldel));
        }
        educationPanel();
      });
      bind(panel, '[data-x="learn"]', () => {
        close();
        openPanel({
          kicker: 'Education', title: 'What Did You Learn?',
          body: `<input class="input" id="lt" data-autofocus placeholder="In a few words" enterkeyhint="done">
                 ${field('When', `<input type="date" class="input" id="ld" value="${todayKey()}">`)}
                 <button class="btn accent wide" id="lg">Log It</button>`,
          onMount(p2, c2) {
            const go = () => {
              const v = p2.querySelector('#lt').value.trim();
              if (!v) return c2();
              mutate(() => newLearned({ title: v, at: p2.querySelector('#ld').value || todayKey() }));
              haptic(12); c2(); educationPanel();
            };
            p2.querySelector('#lg').onclick = go;
            p2.querySelector('#lt').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
          }
        });
      });
      bind(panel, '[data-x="remind"]', () => { close(); reminderEditor(null, 'education'); });
    }
  });
}

/* ---------- nightly push ----------
   The browser can only subscribe; something server-side has to do the sending
   at 10:15pm. A scheduled GitHub Action does that, and it needs the
   subscription below stored as a repo secret. */

const urlB64ToU8 = (s64) => {
  const pad = '='.repeat((4 - (s64.length % 4)) % 4);
  const raw = atob((s64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export function pushPanel() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const perm = supported ? Notification.permission : 'unsupported';

  openPanel({
    kicker: 'Nightly Reminder', title: 'Set Tomorrow, Nightly',
    body: `
      ${!supported ? '<p class="lede">This browser cannot do push notifications.</p>'
        : !standalone ? '<p class="lede">Add the app to your Home Screen first — iOS only allows notifications from an installed app. Then come back here.</p>'
        : perm === 'denied' ? '<p class="lede">Notifications are blocked for this app. Turn them back on in iOS Settings → Notifications → Personal OS, then return here.</p>'
        : '<p class="lede">Turn this on, then paste the code below into the repo secret so the nightly send knows where to reach you.</p>'}
      ${supported && standalone && perm !== 'denied'
        ? `<button class="btn accent wide" data-x="sub">${perm === 'granted' ? 'Refresh Subscription' : 'Turn On'}</button>` : ''}
      <div id="sub-out"></div>`,
    onMount(panel) {
      bind(panel, '[data-x="sub"]', async () => {
        const out = panel.querySelector('#sub-out');
        out.innerHTML = '<p class="lede">Asking…</p>';
        try {
          const p2 = await Notification.requestPermission();
          if (p2 !== 'granted') { out.innerHTML = '<p class="lede">Not granted.</p>'; return; }
          const reg = await navigator.serviceWorker.ready;
          const cfg = await fetch('push-config.json').then((r) => r.json());
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToU8(cfg.vapidPublicKey)
          });
          const json = JSON.stringify(sub.toJSON());
          out.innerHTML = `<p class="kicker mt">Your Subscription</p>
            <textarea class="input tall" id="subj" readonly>${esc(json)}</textarea>
            <button class="btn wide" id="subcopy">Copy</button>
            <p class="lede">Save this as the repo secret <b>PUSH_SUBSCRIPTION</b>.</p>`;
          panel.querySelector('#subcopy').onclick = async () => {
            try { await navigator.clipboard.writeText(json); toast('Copied'); } catch { toast('Select And Copy'); }
          };
        } catch (err) {
          out.innerHTML = `<p class="lede">Could not subscribe: ${esc(err.message)}</p>`;
        }
      });
    }
  });
}

/* ---------- reminders ---------- */

export function reminderEditor(id, presetArea = null) {
  const r = id ? reminderById(id) : null;
  const mode = r?.mode || 'once';
  const area = r?.area ?? presetArea;

  openPanel({
    kicker: 'Reminder', title: r ? 'Edit Reminder' : 'New Reminder',
    body: `
      <input class="input" id="rl" data-autofocus value="${esc(r?.label || '')}" placeholder="What is it">

      <p class="kicker mt">When</p>
      <div class="seg">
        <button class="${mode === 'once' ? 'on' : ''}" data-m="once">Once</button>
        <button class="${mode === 'interval' ? 'on' : ''}" data-m="interval">Every N Days</button>
        <button class="${mode === 'weekly' ? 'on' : ''}" data-m="weekly">Certain Days</button>
      </div>

      <div id="m-once" ${mode === 'once' ? '' : 'hidden'}>
        ${field('Date', `<input type="date" class="input" id="rd" value="${r?.due || todayKey()}">`)}
      </div>
      <div id="m-interval" ${mode === 'interval' ? '' : 'hidden'}>
        ${field('Every', `<input type="number" class="input" id="rn" min="1" max="365" value="${r?.mode === 'interval' ? r.every : 4}"> `)}
        <p class="lede">Days, counted from the last time you did it.</p>
      </div>
      <div id="m-weekly" ${mode === 'weekly' ? '' : 'hidden'}>
        <p class="kicker mt">On</p>
        <div class="chips">${DOW_SHORT.map((dn, i) =>
          `<button class="chip ${(r?.days || []).includes(i) ? 'on' : ''}" data-rd2="${i}">${dn}</button>`).join('')}</div>
        ${field('Every N Weeks', `<input type="number" class="input" id="rw" min="1" max="12" value="${r?.mode === 'weekly' ? r.every : 1}">`)}
      </div>

      <p class="kicker mt">Which Star</p>
      <div class="chips">
        <button class="chip ${!area ? 'on' : ''}" data-ar="">None</button>
        ${AREAS.map((a) => `<button class="chip ${area === a ? 'on' : ''}" data-ar="${a}">${a[0].toUpperCase() + a.slice(1)}</button>`).join('')}
      </div>

      <div class="row-actions">
        ${r ? '<button class="btn danger" data-x="del">Delete</button>' : ''}
        <button class="btn accent" data-x="save">Save</button>
      </div>`,
    onMount(panel, close) {
      let m = mode, ar = area, days = [...(r?.days || [])];
      const sync = () => {
        ['once', 'interval', 'weekly'].forEach((x) => { panel.querySelector('#m-' + x).hidden = x !== m; });
        panel.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
      };
      bind(panel, '[data-m]', (el) => { m = el.dataset.m; haptic(); sync(); });
      bind(panel, '[data-rd2]', (el) => {
        const i = +el.dataset.rd2;
        days = days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort();
        el.classList.toggle('on');
      });
      bind(panel, '[data-ar]', (el) => {
        ar = el.dataset.ar || null;
        panel.querySelectorAll('[data-ar]').forEach((x) => x.classList.toggle('on', x === el));
      });
      panel.querySelector('[data-x="save"]').onclick = () => {
        const label = panel.querySelector('#rl').value.trim();
        if (!label) { toast('Name It First'); return; }
        const patch = { label, area: ar, mode: m,
          due: m === 'once' ? panel.querySelector('#rd').value : null,
          every: m === 'interval' ? Math.max(1, +panel.querySelector('#rn').value || 1)
               : m === 'weekly' ? Math.max(1, +panel.querySelector('#rw').value || 1) : 1,
          days: m === 'weekly' ? days : [] };
        mutate(() => { r ? Object.assign(r, patch) : newReminder(patch); });
        close();
      };
      const del = panel.querySelector('[data-x="del"]');
      if (del) del.onclick = async () => {
        close();
        if (await confirmPanel({ title: 'Delete Reminder?', note: r.label, confirm: 'Delete', danger: true })) {
          mutate(() => deleteReminder(r.id));
        }
      };
    }
  });
}

export function remindersPanel() {
  const key = K();
  openPanel({
    kicker: 'Reminders', title: `${state.reminders.length} Set`,
    body: `<div class="lines">
        ${state.reminders.map((r) => {
          const st = reminderState(r, key);
          return line(r.label, {
            on: !st.due,
            meta: `${reminderRule(r)}${st.due ? (st.overdue > 0 ? ` · ${st.overdue} Days Overdue` : ' · Due Today') : ''}`,
            attrs: `data-redit="${r.id}"` });
        }).join('') || '<p class="empty">None yet</p>'}
      </div>
      <button class="btn accent wide" data-x="new">New Reminder</button>`,
    onMount(panel, close) {
      bind(panel, '[data-redit]', (el) => { close(); reminderEditor(el.dataset.redit); });
      bind(panel, '[data-x="new"]', () => { close(); reminderEditor(null); });
    }
  });
}

/* ---------- tomorrow ---------- */

function planPanel() {
  const key = tomorrowKey();
  const d = getDay(key);
  const must = taskById(d.mustId);
  const seconds = (d.secondIds || []).map(taskById).filter(Boolean);
  const r = rhythmFor(key);
  const faith = faithFor(key);
  const ctx = [];
  if (r?.school) ctx.push(`School ${fmtTime(r.school.start)}–${fmtTime(r.school.end)}`);
  if (faith) ctx.push(faith.label);

  openPanel({
    kicker: DOW_LONG[dow(key)], title: 'Tomorrow',
    body: `
      ${ctx.length ? `<p class="lede">${esc(ctx.join(' · '))}</p>` : ''}
      <p class="kicker mt">Focus</p>
      <div class="lines">
        ${must ? line(must.title, { attrs: 'data-x="must"' })
               : line('Choose The One Thing', { attrs: 'data-x="must"' })}
      </div>
      <p class="kicker mt">Secondary · Up To Two</p>
      <div class="lines">
        ${seconds.map((t) => line(t.title, { attrs: `data-drop="${t.id}"`, meta: 'Tap To Remove' })).join('')}
        ${seconds.length < 2 ? line('Add', { attrs: 'data-x="second"' }) : ''}
      </div>
      <p class="kicker mt">Anything Unusual</p>
      <input class="input" id="note" value="${esc(d.note || '')}" placeholder="Optional">
      <button class="btn accent wide" data-x="lock">${d.plannedAt ? 'Update' : 'Set Tomorrow'}</button>`,
    onMount(panel, close) {
      const note = panel.querySelector('#note');
      bind(panel, '[data-x="must"]', () => {
        close();
        pickTask({ title: "Tomorrow's Focus", dateKey: key,
          onPick: (id) => { mutate(() => { const x = taskById(id); if (x) { x.date = key; x.inbox = false; } day(key).mustId = id; }); planPanel(); } });
      });
      bind(panel, '[data-x="second"]', () => {
        close();
        pickTask({ title: 'Secondary', dateKey: key, exclude: [d.mustId, ...(d.secondIds || [])].filter(Boolean),
          onPick: (id) => {
            mutate(() => {
              const x = taskById(id); if (x) { x.date = key; x.inbox = false; }
              const rec = day(key);
              if (!rec.secondIds.includes(id) && rec.secondIds.length < 2) rec.secondIds.push(id);
            });
            planPanel();
          } });
      });
      bind(panel, '[data-drop]', (el) => {
        mutate(() => { const rec = day(key); rec.secondIds = rec.secondIds.filter((x) => x !== el.dataset.drop); });
        close(); planPanel();
      });
      bind(panel, '[data-x="lock"]', () => {
        const rec = day(key);
        if (!rec.mustId) { toast('Pick A Focus First'); return; }
        haptic(16);
        mutate(() => { const w = day(key); w.note = note.value.trim(); w.plannedAt = Date.now(); });
        toast('Tomorrow Is Set');
        close();
      });
    }
  });
}

/* ---------- the week ---------- */

function weekPanel() {
  const key = K();
  const wk = weekKeyOf(key);
  const w = getWeek(wk);
  const items = state.settings.sunday.items;
  const doneCount = items.filter((i) => w.reset[i.id]).length;
  const soc = socialStats(wk);
  const wo = workoutStats(wk, key);

  openPanel({
    kicker: `Week of ${fmtShort(wk)}`, title: w.bigWin || 'No Week Goal',
    body: `
      <input class="input" id="bw" value="${esc(w.bigWin || '')}" placeholder="The One Thing This Week">
      ${w.bigWin ? `<div class="lines">${line(w.bigWinDone ? 'Achieved' : 'Mark Achieved', { on: !!w.bigWinDone, attrs: 'data-x="bwdone"' })}</div>` : ''}

      <p class="kicker mt">Rhythm</p>
      <div class="lines">
        ${line('Training', { value: `${wo.done}/${wo.min}` })}
        ${line('With Friends', { value: `${soc.done}/${soc.min}` })}
      </div>
      <button class="btn wide ghost" data-x="soc">Log Time With Friends</button>

      <p class="kicker mt">Weekly Reset · ${doneCount}/${items.length}</p>
      <div class="lines">
        ${items.map((i) => line(i.label, { on: !!w.reset[i.id], attrs: `data-r="${i.id}"` })).join('')}
      </div>`,
    onMount(panel) {
      const bw = panel.querySelector('#bw');
      let t = null;
      bw.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { week(wk).bigWin = bw.value.trim(); commit(); }, 350);
      });
      bind(panel, '[data-x="bwdone"]', () => { haptic(); mutate(() => { const x = week(wk); x.bigWinDone = !x.bigWinDone; }); closePanel(); weekPanel(); });
      bind(panel, '[data-r]', (el) => {
        haptic();
        const x = week(wk); x.reset[el.dataset.r] = !x.reset[el.dataset.r]; commit();
        el.querySelector('.mark').classList.toggle('on');
      });
      bind(panel, '[data-x="soc"]', () => { haptic(14); mutate(() => { day(key).social = !day(key).social; }); closePanel(); });
    }
  });
}

/* ---------- life ---------- */

const AREA = {
  money:  { label: 'Business' },
  school: { label: 'School' },
  faith:  { label: 'Faith' },
  health: { label: 'Health' },
  social: { label: 'Social' }
};

function lifePanel() {
  const key = K();
  const wk = weekKeyOf(key);
  const wo = workoutStats(wk, key);
  const soc = socialStats(wk);
  const faithDays = state.settings.faith.plan.filter((k) => k !== 'none').length;

  const rhythmOf = {
    money:  { daily: 'Move the project forward', weekly: 'Ship something real' },
    school: { daily: 'Handle what is due', weekly: 'No surprises on Sunday' },
    faith:  { daily: null, weekly: `${faithDays} commitments a week` },
    health: { daily: `${fmtTime(state.settings.sleep.bedtime)} lights out`, weekly: `Train ${wo.min}×, ideally ${wo.ideal}` },
    social: { daily: null, weekly: `${soc.min}× minimum, ${soc.ideal} usual max` }
  };

  const body = state.settings.priorities.map((p, i) => {
    const goals = state.goals.filter((g) => g.cat === p && g.status === 'active');
    const r = rhythmOf[p] || {};
    return `
      <section class="area">
        <div class="area-head"><span class="rank">${i + 1}</span><h3>${esc(AREA[p]?.label || p)}</h3></div>
        ${goals.length
          ? goals.map((g) => `<p class="goal">${esc(g.name)}${g.target ? `<span class="line-meta"> · ${esc(horizon(g.target))}</span>` : ''}</p>`).join('')
          : '<p class="goal dim">No Goal Set</p>'}
        <dl class="cadence">
          ${r.daily ? `<div><dt>Daily</dt><dd>${esc(r.daily)}</dd></div>` : ''}
          ${r.weekly ? `<div><dt>Weekly</dt><dd>${esc(r.weekly)}</dd></div>` : ''}
        </dl>
        <button class="btn tiny ghost" data-goal="${p}">Add Goal</button>
      </section>`;
  }).join('');

  openPanel({
    kicker: 'Life', title: 'What This Is All For', wide: true,
    body: body + `<button class="btn wide ghost mt" data-x="order">Reorder Priorities</button>`,
    onMount(panel, close) {
      bind(panel, '[data-goal]', (el) => { close(); goalEditor(null, el.dataset.goal); });
      bind(panel, '[data-x="order"]', () => { close(); orderPanel(); });
    }
  });
}

function horizon(target) {
  const d = daysBetween(todayKey(), target);
  if (d < 0) return 'passed';
  if (d < 45) return `${d} days`;
  const m = Math.round(d / 30);
  return `${m} month${m === 1 ? '' : 's'}`;
}

function goalEditor(id, cat = 'money') {
  const g = id ? state.goals.find((x) => x.id === id) : null;
  openPanel({
    title: g ? 'Edit Goal' : 'New Goal',
    body: `
      ${field('Goal', `<input class="input" id="gn" data-autofocus value="${esc(g?.name || '')}" placeholder="What outcome">`)}
      ${field('Target Date · Optional', `<input type="date" class="input" id="gd" value="${g?.target || ''}">`)}
      <div class="row-actions">
        ${g ? '<button class="btn danger" data-x="del">Delete</button>' : ''}
        <button class="btn accent" data-x="save">Save</button>
      </div>`,
    onMount(panel, close) {
      panel.querySelector('[data-x="save"]').onclick = () => {
        const name = panel.querySelector('#gn').value.trim();
        if (!name) return;
        const target = panel.querySelector('#gd').value || null;
        mutate(() => { g ? Object.assign(g, { name, target }) : newGoal({ name, target, cat: g?.cat || cat }); });
        close(); lifePanel();
      };
      const del = panel.querySelector('[data-x="del"]');
      if (del) del.onclick = async () => {
        close();
        if (await confirmPanel({ title: 'Delete Goal?', note: g.name, confirm: 'Delete', danger: true })) {
          mutate(() => deleteGoal(g.id)); lifePanel();
        }
      };
    }
  });
}

function orderPanel() {
  const render = () => {
    const s = state.settings;
    openPanel({
      kicker: 'Priorities', title: 'What Wins When Time Is Short',
      body: `<div class="lines">${s.priorities.map((p, i) => `
        <div class="line static">
          <span class="rank">${i + 1}</span>
          <span class="line-text"><span class="line-label">${esc(AREA[p]?.label || p)}</span></span>
          <span class="movers">
            <button data-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button data-down="${i}" ${i === s.priorities.length - 1 ? 'disabled' : ''}>↓</button>
          </span>
        </div>`).join('')}</div>`,
      onMount(panel) {
        bind(panel, '[data-up]', (el) => {
          const i = +el.dataset.up;
          mutate(() => { const a = state.settings.priorities; [a[i - 1], a[i]] = [a[i], a[i - 1]]; });
          closePanel(); render();
        });
        bind(panel, '[data-down]', (el) => {
          const i = +el.dataset.down;
          mutate(() => { const a = state.settings.priorities; [a[i + 1], a[i]] = [a[i], a[i + 1]]; });
          closePanel(); render();
        });
      }
    });
  };
  render();
}

/* ---------- the read-out behind the sky ---------- */

export function statsPanel() {
  const m = mood();
  const rates = areaRates();
  const band = m >= 0.8 ? 'Blue' : m >= 0.6 ? 'Blue-grey' : m >= 0.4 ? 'Neutral' : m >= 0.2 ? 'Warm' : 'Red';
  const weakest = rates[0];

  openPanel({
    kicker: 'Last seven days', title: `${Math.round(m * 100)}% Held`,
    body: `
      <p class="lede">The sky reads ${band.toLowerCase()}. It tracks the seven days before today, so this morning never counts against you.</p>
      <div class="lines mt">
        ${rates.map((r) => line(r.label, { value: pctTxt(r.hit, r.of) })).join('')}
      </div>
      ${weakest && weakest.of >= 3 && weakest.hit / weakest.of < 0.75
        ? `<p class="kicker mt">This Week</p><p class="lede">${esc(weakest.label)} is the weakest at ${pctTxt(weakest.hit, weakest.of)}. Hold it once more than last week.</p>`
        : ''}`
  });
}

/* ---------- settings ---------- */

function settingsPanel() {
  const s = state.settings;
  openPanel({
    kicker: 'Settings', title: 'Adjust', wide: true,
    body: `
      ${field('Name', `<input class="input" id="nm" value="${esc(s.name)}" placeholder="Optional">`)}

      <p class="kicker mt">Sleep</p>
      <div class="grid2">
        ${[['windDown', 'Wind-down'], ['phoneAway', 'Phone away'], ['bedtime', 'Lights out'], ['wake', 'Wake']]
          .map(([k, l]) => field(l, `<input type="time" class="input" data-sleep="${k}" value="${s.sleep[k]}">`)).join('')}
      </div>

      <p class="kicker mt">Faith</p>
      <div class="lines">
        ${s.faith.plan.map((kind, i) => `
          <div class="line static">
            <span class="line-text"><span class="line-label">${DOW_LONG[i]}</span></span>
            <select class="mini" data-faith="${i}">
              ${Object.entries(FAITH_KINDS).map(([k, v]) => `<option value="${k}" ${kind === k ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
          </div>`).join('')}
      </div>

      <p class="kicker mt">Training</p>
      <div class="lines">
        ${line('Minimum Per Week', { value: String(s.fitness.min), attrs: 'data-step="fmin"' })}
        ${line('Ideal Per Week', { value: String(s.fitness.ideal), attrs: 'data-step="fideal"' })}
        ${line('With Friends · Minimum', { value: String(s.social.min), attrs: 'data-step="smin"' })}
      </div>

      <p class="kicker mt">School Hours</p>
      <div class="lines">
        ${s.rhythm.map((r, i) => `
          <button class="line" data-rh="${i}">
            <span class="line-text"><span class="line-label">${DOW_LONG[i]}</span></span>
            <span class="line-value">${r.school ? `${fmtTime(r.school.start)}–${fmtTime(r.school.end)}` : '—'}</span>
          </button>`).join('')}
      </div>

      <p class="kicker mt">Nightly Reminder</p>
      <div class="lines">${line('Nightly Push', {
        value: Notification?.permission === 'granted' ? 'On' : 'Off',
        meta: 'A Nudge To Set Tomorrow', attrs: 'data-x="push"' })}</div>

      <p class="kicker mt">Reminders</p>
      <div class="lines">${line('Manage Reminders', { value: String(state.reminders.length), attrs: 'data-x="rem"' })}</div>

      <p class="kicker mt">Data</p>
      <div class="lines">
        ${line('Export A Backup', { attrs: 'data-x="exp"' })}
        ${line('Restore From Backup', { attrs: 'data-x="imp"' })}
        ${line('Erase Everything', { attrs: 'data-x="reset"' })}
      </div>`,
    onMount(panel, close) {
      const nm = panel.querySelector('#nm');
      let t = null;
      nm.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { s.name = nm.value.trim(); commit(); }, 350); });
      bind(panel, '[data-sleep]', (el) => { s.sleep[el.dataset.sleep] = el.value; commit(); }, 'change');
      bind(panel, '[data-faith]', (el) => { s.faith.plan[+el.dataset.faith] = el.value; commit(); }, 'change');

      bind(panel, '[data-step]', (el) => {
        const k = el.dataset.step;
        mutate(() => {
          if (k === 'fmin') s.fitness.min = s.fitness.min >= 7 ? 1 : s.fitness.min + 1;
          if (k === 'fideal') s.fitness.ideal = s.fitness.ideal >= 7 ? s.fitness.min : s.fitness.ideal + 1;
          if (k === 'smin') s.social.min = s.social.min >= 7 ? 0 : s.social.min + 1;
        });
        closePanel(); settingsPanel();
      });

      bind(panel, '[data-rh]', (el) => { close(); rhythmPanel(+el.dataset.rh); });
      bind(panel, '[data-x="rem"]', () => { close(); remindersPanel(); });
      bind(panel, '[data-x="push"]', () => { close(); pushPanel(); });

      bind(panel, '[data-x="exp"]', () => {
        close();
        openPanel({ title: 'Backup',
          body: `<textarea class="input tall" id="ex" readonly>${esc(exportJSON())}</textarea>
                 <button class="btn accent wide" id="cp">Copy</button>`,
          onMount(p2, c2) {
            p2.querySelector('#cp').onclick = async () => {
              try { await navigator.clipboard.writeText(p2.querySelector('#ex').value); toast('Copied'); } catch { toast('Select and copy'); }
              c2();
            };
          } });
      });
      bind(panel, '[data-x="imp"]', () => {
        close();
        openPanel({ title: 'Restore', body: `<textarea class="input tall" id="im" data-autofocus placeholder="Paste Backup"></textarea>
          <button class="btn accent wide" id="go">Restore</button>`,
          onMount(p2, c2) {
            p2.querySelector('#go').onclick = () => {
              try { importJSON(p2.querySelector('#im').value); c2(); toast('Restored'); }
              catch { toast('Not a valid backup'); }
            };
          } });
      });
      bind(panel, '[data-x="reset"]', async () => {
        close();
        if (await confirmPanel({ title: 'Erase Everything?', note: 'Every goal, day and setting on this device.', confirm: 'Erase', danger: true })) {
          resetAll(); toast('Cleared');
        }
      });
    }
  });
}

function rhythmPanel(i) {
  const r = state.settings.rhythm[i];
  openPanel({
    kicker: DOW_LONG[i], title: 'School Hours',
    body: `
      <div class="lines">${line('Has School', { on: !!r.school, attrs: 'data-x="has"' })}</div>
      <div class="grid2 mt" id="tw" ${r.school ? '' : 'hidden'}>
        ${field('Starts', `<input type="time" class="input" id="st" value="${r.school?.start || '08:00'}">`)}
        ${field('Ends', `<input type="time" class="input" id="en" value="${r.school?.end || '15:00'}">`)}
      </div>
      <button class="btn accent wide" data-x="save">Save</button>`,
    onMount(panel, close) {
      let has = !!r.school;
      bind(panel, '[data-x="has"]', (el) => {
        has = !has;
        el.querySelector('.mark').classList.toggle('on', has);
        panel.querySelector('#tw').hidden = !has;
      });
      bind(panel, '[data-x="save"]', () => {
        mutate(() => {
          r.school = has ? { start: panel.querySelector('#st').value, end: panel.querySelector('#en').value } : null;
        });
        close(); settingsPanel();
      });
    }
  });
}

/* ---------- capture & tasks (menu) ---------- */

export function capturePanel() {
  openPanel({
    title: 'Quick Note',
    body: `<input class="input" id="cp" data-autofocus placeholder="Anything worth remembering" enterkeyhint="done">
           <button class="btn accent wide" id="cg">Save To Inbox</button>`,
    onMount(panel, close) {
      const go = () => {
        const v = panel.querySelector('#cp').value.trim();
        if (!v) return close();
        mutate(() => newTask({ title: v, inbox: true }));
        haptic(12); close(); toast('Saved');
      };
      panel.querySelector('#cg').onclick = go;
      panel.querySelector('#cp').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    }
  });
}

export function tasksPanel() {
  const open = sortBy(state.tasks.filter((t) => !t.done), (t) => `${t.date ? '0' + t.date : '1'}${t.createdAt}`);
  openPanel({
    kicker: 'Tasks', title: `${open.length} Open`,
    body: `<div class="lines">${open.map((t) => line(t.title, {
      on: false, meta: t.date ? relDay(t.date) : 'Inbox', attrs: `data-t="${t.id}"` })).join('') || '<p class="empty">Nothing open</p>'}</div>`,
    onMount(panel) {
      bind(panel, '[data-t]', (el) => {
        haptic(); mutate(() => setTaskDone(el.dataset.t, true));
        el.querySelector('.mark').classList.add('on');
        el.style.opacity = '.4';
      });
    }
  });
}

export function salvagePanel() {
  const key = K();
  const d = getDay(key);
  const proj = currentProject();
  const t = sleepTargets(key);
  openPanel({
    kicker: 'Rescue Today', title: 'Three Moves',
    body: `<p class="lede">Three moves and the day still counts.</p>
      <div class="lines">
        ${line('Handle The Most Urgent Thing', { on: !!d.salvageSteps.urgent, attrs: 'data-s="urgent"' })}
        ${line(proj ? `Ten Minutes On ${proj.name}` : 'Ten Minutes On Your Project', { on: !!d.money, attrs: 'data-s="future"' })}
        ${line(`Lights Out At ${fmtTime(t.bedtime)}`, { on: !!d.bed, attrs: 'data-s="tonight"' })}
      </div>`,
    onMount(panel) {
      bind(panel, '[data-s]', (el) => {
        haptic();
        const id = el.dataset.s;
        mutate(() => {
          const r = day(key);
          r.salvage = true;
          if (id === 'future') r.money = !r.money;
          else if (id === 'tonight') r.bed = !r.bed;
          else r.salvageSteps[id] = !r.salvageSteps[id];
        });
        el.querySelector('.mark').classList.toggle('on');
      });
    }
  });
}

/* ---------- dispatch ---------- */

export function openStar(star) {
  switch (star.panel) {
    case 'must': return mustPanel();
    case 'second': return secondPanel(star);
    case 'business': return businessPanel();
    case 'faith': {
      const f = faithFor(K());
      return togglePanel({ kicker: 'Faith', title: f.label, fieldName: 'faith' });
    }
    case 'education': return educationPanel();
    case 'move': return movePanel();
    case 'sleep': return sleepPanel();
    case 'plan': return planPanel();
    case 'week': return weekPanel();
    case 'life': return lifePanel();
    case 'settings': return settingsPanel();
  }
}
