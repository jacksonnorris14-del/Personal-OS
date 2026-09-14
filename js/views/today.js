/* TODAY — the only screen that has to be right.
   One Must Win, up to two Secondary Wins, the standards that apply to *this*
   day, and the few numbers that matter. Nothing else competes for attention. */

import { state, getDay, getWeek, day, mutate, taskById, setTaskDone, currentProject } from '../store.js';
import { dayStatus, standardsFor, toggleStandard, nudgeFor, sleepTargets, workoutStats, socialStats, leisureStatus } from '../logic.js';
import { todayKey, tomorrowKey, dow, weekKeyOf, esc, fmtTime, toMin, nowMin, haptic, DOW_LONG } from '../util.js';
import { checkRow, pips, bind, toast, confirmSheet } from '../ui.js';
import { pickTask, scheduleTask } from '../pick.js';
import { openFocus } from '../focus.js';
import { go } from '../app.js';

function greeting(h) {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Late night';
}

function mustWinHtml(st) {
  if (!st.must) {
    return `
      <button class="mustwin empty" data-a="set-must" style="width:100%;text-align:left">
        <span class="tag" style="color:var(--text-3)">🔴 Must Win</span>
        <div class="title" style="color:var(--text-3);font-weight:600">Choose the one thing that has to happen today</div>
      </button>`;
  }
  const done = st.must.done;
  return `
    <div class="mustwin ${done ? 'done' : ''}">
      <div class="row between">
        <span class="tag">${done ? '✓ Must Win' : '🔴 Must Win'}</span>
        <button class="btn sm ghost" data-a="set-must" style="min-height:30px;padding:0 11px">Change</button>
      </div>
      <div class="title wrap-any">${esc(st.must.title)}</div>
      <button class="btn block ${done ? 'ghost' : 'primary'}" data-a="toggle-must" style="margin-top:15px">
        ${done ? 'Completed — undo' : 'Mark it done'}
      </button>
    </div>`;
}

function salvageHtml(key) {
  const d = getDay(key);
  const proj = currentProject();
  const t = sleepTargets(key);
  const steps = [
    { id: 'urgent', emoji: '1', label: 'Handle the most urgent responsibility', meta: 'Just the one that actually matters', on: !!d.salvageSteps.urgent },
    { id: 'future', emoji: '2', label: 'Do something small for your future', meta: proj ? `10+ minutes on ${proj.name}` : '10+ minutes on your current project', on: !!d.money },
    { id: 'tonight', emoji: '3', label: 'Get back on schedule tonight', meta: `Lights out ${fmtTime(t.bedtime)}`, on: !!d.bed }
  ];
  return `
    <div class="card" style="border-color:rgba(106,166,255,.24);background:linear-gradient(155deg,rgba(106,166,255,.10),rgba(106,166,255,.02))">
      <div class="row between">
        <span class="tag" style="font-size:11.5px;font-weight:750;letter-spacing:.15em;text-transform:uppercase;color:#9CC4FF">🚨 Salvage mode</span>
        <button class="btn sm ghost" data-a="salvage-off" style="min-height:30px;padding:0 11px">Exit</button>
      </div>
      <p class="muted" style="font-size:14.5px;margin-top:9px;line-height:1.5">
        Three moves and today counts. A bad day that keeps momentum beats starting over on Monday.
      </p>
      <div class="stack" style="margin-top:14px">
        ${steps.map((s) => checkRow({ id: s.id, label: s.label, meta: s.meta, emoji: s.emoji, on: s.on, attrs: 'data-a="salvage-step"' })).join('')}
      </div>
    </div>`;
}

export default {
  render() {
    const key = todayKey();
    const now = new Date();
    const d = getDay(key);
    const st = dayStatus(key);
    const wd = dow(key);
    const wkKey = weekKeyOf(key);
    const proj = currentProject();
    const sleep = sleepTargets(key);
    const w = workoutStats(wkKey, key);
    const nudge = nudgeFor(key);
    const wk = getWeek(wkKey);
    const bigWin = wk.bigWin;
    const bigWinDone = wk.bigWinDone;
    const soc = socialStats(wkKey);
    const leisure = leisureStatus(key);
    const name = state.settings.name ? `, ${state.settings.name}` : '';

    const bits = [];
    if (!st.must) bits.push('No Must Win yet');
    else bits.push(st.mustDone ? 'Must Win done' : 'Must Win open');
    if (st.required) bits.push(`${st.requiredDone}/${st.required} standards`);

    const sundayOpen = wd === 0 && !getWeek(wkKey).resetDoneAt;
    const tomorrowUnplanned = !getDay(tomorrowKey()).mustId;
    const evening = nowMin(now) >= Math.min(toMin(sleep.windDown) - 180, 19 * 60);

    return `
      <div class="head">
        <div class="kicker">${DOW_LONG[wd].toUpperCase()} · ${esc(new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</div>
        <h1>${greeting(now.getHours())}${esc(name)}.</h1>
        <p class="sub">${esc(bits.join(' · '))}</p>
      </div>

      ${bigWin ? `
        <button class="row between" data-a="go-sunday" style="width:100%;text-align:left;padding:11px 14px;background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:10px">
          <span class="grow" style="min-width:0">
            <span class="tiny dim" style="display:block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">This week</span>
            <span class="truncate" style="display:block;font-size:14.5px;font-weight:600;margin-top:2px;${bigWinDone ? 'color:var(--text-3);text-decoration:line-through' : ''}">${esc(bigWin)}</span>
          </span>
          <span style="font-size:15px;flex:none;margin-left:10px">${bigWinDone ? '✅' : '🎯'}</span>
        </button>` : ''}

      ${nudge ? `<div class="banner warm"><b>${nudge.icon} Never miss twice.</b> ${esc(nudge.text)}</div>` : ''}

      ${sundayOpen ? `
        <button class="card" data-a="go-sunday" style="width:100%;text-align:left;margin-top:${nudge ? '10px' : '0'};border-color:rgba(245,165,36,.28);background:linear-gradient(150deg,rgba(245,165,36,.12),rgba(245,165,36,.02))">
          <div class="row between">
            <div>
              <div style="font-size:11.5px;font-weight:750;letter-spacing:.15em;text-transform:uppercase;color:#F7C877">☀️ Sunday Reset</div>
              <div style="font-size:16.5px;font-weight:640;margin-top:6px">Set up the week — about 10 minutes</div>
            </div>
            <span class="arrow" style="color:var(--text-3);font-size:19px">›</span>
          </div>
        </button>` : ''}

      <div class="section">
        <div class="label">Today's mission</div>
        ${d.salvage ? salvageHtml(key) : mustWinHtml(st)}
      </div>

      ${d.salvage ? '' : `
        <div class="section">
          <div class="label">Secondary wins <span class="hint">${st.seconds.length}/2</span></div>
          <div class="stack">
            ${st.seconds.map((t) => checkRow({
              id: t.id, label: t.title, on: t.done, emoji: '🟠', cls: t.done ? '' : 'sec',
              attrs: 'data-a="toggle-second"'
            })).join('')}
            ${st.seconds.length < 2 ? `
              <button class="check" data-a="add-second" style="border-style:dashed;color:var(--text-3)">
                <span class="box" style="border-style:dashed">+</span>
                <span class="txt" style="font-weight:520;color:var(--text-3)">Add a secondary win</span>
              </button>` : ''}
          </div>
        </div>`}

      <div class="section">
        <div class="label">Daily standards ${d.salvage ? '<span class="hint">optional today</span>' : st.held ? '<span class="hint">all held ✓</span>' : ''}</div>
        <div class="stack">
          ${st.standards.length
            ? st.standards.map((s) => checkRow({
                id: s.id, label: s.label, emoji: s.emoji, on: s.done,
                meta: s.note || (!s.required && !d.salvage ? 'Optional' : ''),
                cls: s.required && !d.salvage ? '' : 'opt',
                attrs: 'data-a="toggle-std"'
              })).join('')
            : '<p class="dim tiny" style="padding:6px 2px">No standards for today.</p>'}
        </div>
      </div>

      <div class="section">
        <div class="label">Sleep <span class="hint">${sleep.shifted ? 'weekend slack applied' : 'treat it like an appointment'}</span></div>
        <div class="card">
          <div class="row between" style="flex-wrap:wrap;gap:6px 14px">
            ${[['Wind-down', sleep.windDown], ['Phone away', sleep.phoneAway], ['Lights out', sleep.bedtime], ['Wake', sleep.wake]]
              .map(([l, v]) => `<div><div class="tiny dim">${l}</div><div style="font-weight:640;font-size:14.5px">${fmtTime(v)}</div></div>`).join('')}
          </div>
        </div>
        <div class="stack" style="margin-top:10px">
          ${checkRow({ id: 'wake', label: 'Woke up at target', emoji: '🌅', on: !!d.wake, attrs: 'data-a="toggle-sleep"' })}
          ${checkRow({ id: 'bed', label: 'Lights out on time', emoji: '😴', on: !!d.bed, attrs: 'data-a="toggle-sleep"' })}
        </div>
      </div>

      <div class="section">
        <div class="label">This week</div>
        <div class="card">
          <div class="row between">
            <span class="pill">💪 Workouts</span>
            <span class="tiny dim">${w.metMin ? 'minimum met' : `${w.remaining} chance${w.remaining === 1 ? '' : 's'} left`}</span>
          </div>
          <div class="metric" style="margin-top:9px"><b>${w.done}</b><span>/ ${w.min} minimum · ${w.ideal} ideal</span></div>
          <div style="margin-top:12px">${pips(w.done, w.min, w.ideal)}</div>
          <p class="tiny dim" style="margin-top:9px">
            ${w.metIdeal ? 'Ideal week hit. Anything more is a bonus.'
              : w.metMin ? `Minimum met. Ideal is ${w.ideal} — only if it fits.`
              : w.tight ? 'Every remaining day counts to reach the minimum.'
              : `${w.min} is a successful week. ${w.ideal} is ideal, not required.`}
          </p>
          ${state.settings.fitness.excluded.includes(wd)
            ? '<p class="tiny dim" style="margin-top:8px">No gym scheduled today — rest day.</p>'
            : `<button class="btn sm block ${d.workout ? 'ghost' : ''}" data-a="log-workout" style="margin-top:12px">
                 ${d.workout ? '✓ Workout logged today' : 'Log today\'s workout'}
               </button>`}
        </div>
        <div class="card">
          <div class="row between">
            <span class="pill">👥 Social</span>
            <span class="tiny dim">${soc.metMin ? 'minimum met' : `${soc.min - soc.done} to go`}</span>
          </div>
          <div class="metric" style="margin-top:9px"><b>${soc.done}</b><span>/ ${soc.min} minimum · ${soc.ideal} usual max</span></div>
          <button class="btn sm block ${d.social ? 'ghost' : ''}" data-a="log-social" style="margin-top:12px">
            ${d.social ? '✓ Time with friends logged' : 'Log time with friends'}
          </button>
        </div>
      </div>

      <div class="section">
        <div class="label">Money Engine</div>
        ${proj ? `
          <div class="engine">
            <div class="tag">💰 Current project</div>
            <div class="name wrap-any">${esc(proj.name)}</div>
            <p class="muted" style="font-size:14px;margin-top:8px">
              ${d.money ? 'Moved forward today. That is the whole game — consistently.' : 'What can you do today to move it forward?'}
            </p>
            <div class="row" style="margin-top:14px;gap:8px">
              <button class="btn sm ${d.money ? 'ghost' : ''} grow" data-a="log-money">${d.money ? '✓ Logged today' : 'Log progress'}</button>
              <button class="btn sm ghost grow" data-a="go-money">Open</button>
            </div>
          </div>`
        : `<button class="card" data-a="go-money" style="width:100%;text-align:left;border-style:dashed">
             <div style="font-size:11.5px;font-weight:750;letter-spacing:.15em;text-transform:uppercase;color:var(--text-3)">💰 Money Engine</div>
             <div style="font-size:16px;font-weight:620;margin-top:6px">Set your current project</div>
             <div class="tiny dim" style="margin-top:4px">One project at a time. It should always be obvious what you're building.</div>
           </button>`}
      </div>

      <div class="section">
        <button class="btn block" data-a="focus">🎯 Start a focus session</button>
        ${(leisure.clear || nowMin(now) > 12 * 60) ? `
          <div class="banner ${leisure.clear ? 'good' : ''}" style="margin-top:10px">
            ${leisure.clear
              ? '<b>Mission handled.</b> Rest, friends, games — enjoy it without guilt. Intentional rest is not avoidance.'
              : `<b>Before leisure:</b> ${esc(leisure.open.slice(0, 3).join(', '))}.`}
          </div>` : ''}
      </div>

      ${evening && tomorrowUnplanned ? `
        <div class="section">
          <button class="card" data-a="go-plan" style="width:100%;text-align:left">
            <div class="row between">
              <div>
                <div style="font-size:11.5px;font-weight:750;letter-spacing:.15em;text-transform:uppercase;color:var(--text-3)">🌙 Tonight</div>
                <div style="font-size:16.5px;font-weight:640;margin-top:6px">Plan tomorrow — 2 minutes</div>
              </div>
              <span class="arrow" style="color:var(--text-3);font-size:19px">›</span>
            </div>
          </button>
        </div>` : ''}

      ${d.salvage ? '' : `
        <div class="section">
          <button class="btn block ghost" data-a="salvage-on">🚨 Salvage today</button>
          <p class="tiny dim center" style="margin-top:8px">Woke up late, got derailed, or the day slipped? Shrink it instead of scrapping it.</p>
        </div>`}
    `;
  },

  mount(root) {
    const key = todayKey();

    bind(root, '[data-a="set-must"]', () => {
      pickTask({
        title: "Today's Must Win",
        sub: 'One thing. The one that would make today count.',
        dateKey: key,
        onPick: (id) => mutate(() => {
          scheduleTask(id, key);
          day(key).mustId = id;
        })
      });
    });

    bind(root, '[data-a="toggle-must"]', () => {
      const d = getDay(key);
      const t = taskById(d.mustId);
      if (!t) return;
      haptic(14);
      mutate(() => setTaskDone(t.id, !t.done));
      if (!t.done) toast('Must Win done. That is the day secured.');
    });

    bind(root, '[data-a="add-second"]', () => {
      pickTask({
        title: 'Secondary win',
        sub: 'Good if it happens. Not at the cost of the Must Win.',
        dateKey: key,
        exclude: [getDay(key).mustId, ...(getDay(key).secondIds || [])].filter(Boolean),
        onPick: (id) => mutate(() => {
          scheduleTask(id, key);
          const rec = day(key);
          if (!rec.secondIds.includes(id) && rec.secondIds.length < 2) rec.secondIds.push(id);
        })
      });
    });

    bind(root, '[data-a="toggle-second"]', (el) => {
      const t = taskById(el.dataset.id);
      if (!t) return;
      haptic();
      mutate(() => setTaskDone(t.id, !t.done));
    });

    bind(root, '[data-a="toggle-std"]', (el) => {
      const st = standardsFor(key).find((s) => s.id === el.dataset.id);
      if (!st) return;
      haptic();
      mutate(() => toggleStandard(day(key), st));
    });

    bind(root, '[data-a="toggle-sleep"]', (el) => {
      haptic();
      mutate(() => { const d = day(key); d[el.dataset.id] = !d[el.dataset.id]; });
    });

    bind(root, '[data-a="log-workout"]', () => {
      haptic(14);
      mutate(() => { const d = day(key); d.workout = !d.workout; });
    });

    bind(root, '[data-a="log-social"]', () => {
      haptic(14);
      mutate(() => { const d = day(key); d.social = !d.social; });
    });

    bind(root, '[data-a="log-money"]', () => {
      haptic(14);
      mutate(() => { const d = day(key); d.money = !d.money; });
    });

    bind(root, '[data-a="salvage-on"]', async () => {
      const ok = await confirmSheet({
        title: 'Salvage today',
        sub: 'Today shrinks to three moves: the most urgent responsibility, ten minutes for your future, and getting back on schedule tonight. Standards become optional.',
        confirmLabel: 'Shrink the day'
      });
      if (ok) mutate(() => { day(key).salvage = true; });
    });

    bind(root, '[data-a="salvage-off"]', () => mutate(() => { day(key).salvage = false; }));

    bind(root, '[data-a="salvage-step"]', (el) => {
      haptic();
      const id = el.dataset.id;
      mutate(() => {
        const d = day(key);
        if (id === 'future') d.money = !d.money;
        else if (id === 'tonight') d.bed = !d.bed;
        else d.salvageSteps[id] = !d.salvageSteps[id];
      });
    });

    bind(root, '[data-a="focus"]', () => openFocus());
    bind(root, '[data-a="go-money"]', () => go('money'));
    bind(root, '[data-a="go-plan"]', () => go('plan'));
    bind(root, '[data-a="go-sunday"]', () => go('sunday'));
  }
};
