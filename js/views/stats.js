/* HISTORY — reality, not a scoreboard.
   No points, no levels, no streak to protect. Just what actually happened,
   so patterns become visible and fixable. */

import { state, getDay, getWeek } from '../store.js';
import { rangeStats, dayScore, dayStatus } from '../logic.js';
import { todayKey, weekKeyOf, weekDays, addDays, dow, esc, pct, DOW_LETTER, fmtShort, daysBetween, relDay } from '../util.js';
import { openSheet, bind } from '../ui.js';

function statTile(k, value, sub = '', delta = null) {
  const arrow = delta === null || delta === 0 ? '' : delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`;
  const cls = delta === null || delta === 0 ? '' : delta > 0 ? 'up' : 'down';
  return `
    <div class="stat">
      <div class="k">${esc(k)}</div>
      <div class="v">${value}</div>
      <div class="d ${cls}">${esc(sub)}${arrow ? ` · ${arrow}` : ''}</div>
    </div>`;
}

function weekStrip(wkKey, today) {
  return `
    <div class="weekstrip">
      ${weekDays(wkKey).map((k, i) => {
        const s = dayScore(k);
        const future = daysBetween(today, k) > 0;
        const cls = future ? 'miss' : s === null ? 'miss' : s >= 0.999 ? 'full' : s > 0 ? 'part' : 'miss';
        const label = future ? '' : s === null ? '·' : s >= 0.999 ? '✓' : `${Math.round(s * 100)}`;
        return `
          <div class="d">
            <div class="n">${DOW_LETTER[i]}</div>
            <button class="dot ${cls} ${k === today ? 'today' : ''}" data-day="${k}" style="border:0">${label}</button>
          </div>`;
      }).join('')}
    </div>`;
}

function dayDetail(key) {
  const st = dayStatus(key);
  const d = getDay(key);
  const rows = [];
  if (st.must) rows.push([st.mustDone ? '✓' : '○', `Must Win — ${st.must.title}`]);
  st.seconds.forEach((t) => rows.push([t.done ? '✓' : '○', `Secondary — ${t.title}`]));
  st.standards.forEach((s) => rows.push([s.done ? '✓' : '○', s.label]));
  rows.push([d.bed ? '✓' : '○', 'Lights out on time']);
  rows.push([d.wake ? '✓' : '○', 'Woke at target']);
  if (d.workout) rows.push(['✓', 'Workout']);
  if (d.social) rows.push(['✓', 'Time with friends']);
  if (d.salvage) rows.push(['🚨', 'Salvage day — momentum kept']);

  openSheet({
    title: relDay(key),
    sub: fmtShort(key),
    body: `
      <div class="stack" style="margin-top:14px">
        ${rows.map(([m, t]) => `
          <div class="row" style="gap:11px;padding:11px 14px;background:var(--card);border:1px solid var(--line);border-radius:14px">
            <span style="width:18px;color:${m === '✓' ? 'var(--ok)' : 'var(--text-4)'}">${m}</span>
            <span class="grow tiny" style="font-size:14px">${esc(t)}</span>
          </div>`).join('')}
        ${d.note ? `<p class="tiny dim" style="padding:6px 2px">Note: ${esc(d.note)}</p>` : ''}
      </div>`
  });
}

export default {
  render() {
    const today = todayKey();
    const wkKey = weekKeyOf(today);
    const prevKey = addDays(wkKey, -7);
    const elapsed = dow(today) + 1;

    const cur = rangeStats(weekDays(wkKey).slice(0, elapsed));
    const prev = rangeStats(weekDays(prevKey).slice(0, elapsed));
    const w = getWeek(wkKey);

    const last30 = rangeStats(Array.from({ length: 30 }, (_, i) => addDays(today, -(29 - i))));
    const weeks4 = Array.from({ length: 4 }, (_, i) => {
      const k = addDays(wkKey, -7 * (3 - i));
      const s = rangeStats(weekDays(k));
      return { k, s, held: s.stdReq ? pct(s.stdDone, s.stdReq) : 0 };
    });

    const focus7 = state.focus
      .filter((f) => daysBetween(f.day, today) < 7 && daysBetween(f.day, today) >= 0)
      .reduce((a, f) => a + (f.minutes || 0), 0);

    return `
      <div class="head">
        <div class="kicker">History</div>
        <h1>What actually happened.</h1>
        <p class="sub">Patterns, not points. Consistency beats a perfect week.</p>
      </div>

      <div class="card">
        ${weekStrip(wkKey, today)}
        <p class="tiny dim center" style="margin-top:12px">Tap a day to see it</p>
      </div>

      <div class="section">
        <div class="label">This week so far <span class="hint">vs. same days last week</span></div>
        <div class="stats2">
          ${statTile('Must Wins', `${cur.mustDone}<small> / ${cur.mustSet || 0}</small>`, 'completed', cur.mustDone - prev.mustDone)}
          ${statTile('Standards', `${cur.stdReq ? pct(cur.stdDone, cur.stdReq) : 0}<small>%</small>`, 'held',
                     (cur.stdReq ? pct(cur.stdDone, cur.stdReq) : 0) - (prev.stdReq ? pct(prev.stdDone, prev.stdReq) : 0))}
          ${statTile('Workouts', `${cur.workouts}<small> / ${state.settings.fitness.min}</small>`, cur.workouts >= state.settings.fitness.min ? 'minimum met' : 'minimum', cur.workouts - prev.workouts)}
          ${statTile('Bedtime', `${cur.bed}<small> / ${elapsed}</small>`, 'on time', cur.bed - prev.bed)}
          ${statTile('Wake-up', `${cur.wake}<small> / ${elapsed}</small>`, 'on target', cur.wake - prev.wake)}
          ${statTile('Faith', `${cur.faithDone}<small> / ${cur.faithDue}</small>`, 'commitments', cur.faithDone - prev.faithDone)}
          ${statTile('Money Engine', `${cur.money}<small> / ${elapsed}</small>`, 'active days', cur.money - prev.money)}
          ${statTile('Social', `${cur.social}<small> / ${state.settings.social.min}</small>`, 'minimum', cur.social - prev.social)}
        </div>
      </div>

      <div class="section">
        <div class="label">The week's big win</div>
        <div class="card">
          ${w.bigWin
            ? `<div class="row" style="gap:11px">
                 <span style="font-size:18px">${w.bigWinDone ? '✅' : '🎯'}</span>
                 <span class="grow wrap-any" style="font-weight:620">${esc(w.bigWin)}</span>
               </div>
               <p class="tiny dim" style="margin-top:8px">${w.bigWinDone ? 'Achieved.' : 'Still open — there is time.'}</p>`
            : '<p class="tiny dim">Not set. The Sunday Reset picks this.</p>'}
        </div>
      </div>

      <div class="section">
        <div class="label">Last four weeks <span class="hint">standards held</span></div>
        <div class="card">
          <div class="row" style="align-items:flex-end;gap:10px;height:104px">
            ${weeks4.map((x) => `
              <div class="grow" style="text-align:center">
                <div style="height:${Math.max(4, x.held * 0.82)}px;background:${x.k === wkKey ? 'linear-gradient(180deg,#FF8A3D,#FF4B3E)' : 'var(--card-3)'};border-radius:7px 7px 3px 3px"></div>
                <div class="tiny dim" style="margin-top:7px">${x.held}%</div>
                <div class="tiny" style="color:var(--text-4);font-size:11px">${esc(fmtShort(x.k))}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="label">Last 30 days</div>
        <div class="stats2">
          ${statTile('Must Wins', `${last30.mustDone}<small> / ${last30.mustSet}</small>`, 'completed')}
          ${statTile('Workouts', `${last30.workouts}`, 'sessions')}
          ${statTile('Money Engine', `${last30.money}<small> / 30</small>`, 'active days')}
          ${statTile('Bedtime', `${last30.bedDays ? pct(last30.bed, last30.bedDays) : 0}<small>%</small>`, 'consistency')}
          ${statTile('Nights planned', `${last30.planned}`, 'evenings')}
          ${statTile('Focus', `${Math.round(focus7 / 60 * 10) / 10}<small>h</small>`, 'last 7 days')}
        </div>
      </div>

      ${last30.salvage ? `
        <div class="section">
          <div class="banner calm">
            <b>🚨 ${last30.salvage} salvaged day${last30.salvage === 1 ? '' : 's'} in the last month.</b>
            Days you shrank instead of scrapped. That is the habit that keeps everything else alive.
          </div>
        </div>` : ''}

      <div class="section">
        <p class="tiny dim center" style="line-height:1.6">
          No streaks, no scores, no levels.<br>Miss once and return — never miss twice.
        </p>
      </div>`;
  },

  mount(root) {
    bind(root, '[data-day]', (el) => dayDetail(el.dataset.day));
  }
};
