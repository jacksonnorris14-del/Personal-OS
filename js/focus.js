/* FOCUS — the interrupt.
   Before you drift, one question with an honest answer: what are you supposed
   to be doing right now? Timing is optional; intentionality is the point. */

import { state, getDay, day, currentProject, mutate } from './store.js';
import { rightNow, leisureStatus } from './logic.js';
import { todayKey, esc, uid, haptic } from './util.js';
import { toast } from './ui.js';

const el = () => document.getElementById('focus');

const INTENTS = {
  must:   { emoji: '🎯', label: 'My Must Win' },
  money:  { emoji: '💰', label: 'Money Engine' },
  school: { emoji: '📚', label: 'School' },
  build:  { emoji: '💻', label: 'Build something' },
  learn:  { emoji: '📖', label: 'Learn / research' },
  other:  { emoji: '•',  label: 'Something else' }
};

let timer = null;
let session = null;

export function openFocus(preset = null) {
  const box = el();
  box.classList.add('on');
  if (preset) startSession(preset);
  else renderChoose();
}

export function closeFocus() {
  clearInterval(timer);
  timer = null;
  session = null;
  el().classList.remove('on');
  el().innerHTML = '';
}

function renderChoose() {
  const key = todayKey();
  const d = getDay(key);
  const now = rightNow(key);
  const proj = currentProject();
  const leisure = leisureStatus(key);

  const rows = Object.entries(INTENTS).map(([id, m]) => {
    let sub = '';
    if (id === 'must') sub = state.tasks.find((t) => t.id === d.mustId)?.title || 'Not set yet';
    if (id === 'money') sub = proj?.name || 'No current project';
    return `
      <button class="linkrow" data-i="${id}">
        <span class="ic">${m.emoji}</span>
        <span class="grow"><span class="t">${m.label}</span>${sub ? `<span class="d">${esc(sub)}</span>` : ''}</span>
        <span class="arrow">›</span>
      </button>`;
  }).join('');

  el().innerHTML = `
    <div style="overflow-y:auto;flex:1">
      <div class="row between">
        <div class="kicker" style="font-size:12px;font-weight:640;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3)">Focus</div>
        <button class="btn sm ghost" data-x="close" style="min-height:34px">Close</button>
      </div>

      <h1 style="font-size:26px;margin-top:16px;line-height:1.2">What are you supposed to be doing right now?</h1>

      <div class="card" style="margin-top:18px;border-color:rgba(255,255,255,.14)">
        <div style="font-size:11.5px;font-weight:750;letter-spacing:.15em;text-transform:uppercase;color:var(--text-3)">The honest answer</div>
        <div style="font-size:19px;font-weight:680;margin-top:8px;letter-spacing:-.02em">${now.icon} ${esc(now.title)}</div>
        <p class="muted" style="font-size:14px;margin-top:6px;line-height:1.45">${esc(now.why)}</p>
        ${['sleep', 'free'].includes(now.intent) ? '' :
          `<button class="btn primary block" data-i="${now.intent === 'salvage' ? 'other' : now.intent}" style="margin-top:14px">Start on this</button>`}
      </div>

      <div class="section" style="margin-top:22px">
        <div class="label">Or choose</div>
        <div class="list-sep">${rows}</div>
      </div>

      <div class="section">
        <button class="linkrow" data-x="free" style="border-style:dashed">
          <span class="ic">🟢</span>
          <span class="grow">
            <span class="t">Nothing — I actually have free time</span>
            <span class="d">${leisure.clear ? 'Confirmed: your day is handled' : `${leisure.open.length} thing${leisure.open.length === 1 ? '' : 's'} still open`}</span>
          </span>
          <span class="arrow">›</span>
        </button>
      </div>
    </div>`;

  wire();
}

function renderFree() {
  const leisure = leisureStatus(todayKey());
  el().innerHTML = `
    <div style="margin:auto;text-align:center;max-width:420px">
      <div style="font-size:44px">${leisure.clear ? '🟢' : '🟠'}</div>
      <h1 style="font-size:25px;margin-top:14px;line-height:1.25">
        ${leisure.clear ? 'Then enjoy it.' : 'Almost.'}
      </h1>
      <p class="muted" style="margin-top:12px;font-size:15px;line-height:1.55">
        ${leisure.clear
          ? 'Your mission is handled. Rest, friends, a game, a show — none of it needs to be earned twice. Intentional rest is different from avoidance.'
          : `Still open: <b style="color:var(--text)">${esc(leisure.open.slice(0, 3).join(', '))}</b>.<br>Not a verdict — just what's true. Handle one, then rest properly.`}
      </p>
      <div style="margin-top:26px;display:flex;flex-direction:column;gap:10px">
        ${leisure.clear ? '' : '<button class="btn primary" data-x="back">Pick something to do</button>'}
        <button class="btn ghost" data-x="close">${leisure.clear ? 'Close' : 'Rest anyway'}</button>
      </div>
    </div>`;
  wire();
}

function startSession(intent) {
  const m = INTENTS[intent] || INTENTS.other;
  session = { id: uid(), intent, label: m.label, startedAt: Date.now(), target: 0 };
  renderRunning();
}

function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  const mm = Math.floor(s / 60), ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function renderRunning() {
  const m = INTENTS[session.intent] || INTENTS.other;
  const proj = currentProject();
  const detail = session.intent === 'money' ? proj?.name
    : session.intent === 'must' ? state.tasks.find((t) => t.id === getDay(todayKey()).mustId)?.title
    : '';

  el().innerHTML = `
    <div class="row between">
      <div style="font-size:12px;font-weight:640;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3)">In focus</div>
      <button class="btn sm ghost" data-x="close" style="min-height:34px">Cancel</button>
    </div>

    <div style="margin:auto 0;text-align:center;width:100%">
      <div style="font-size:40px">${m.emoji}</div>
      <div class="what" style="margin-top:12px">${esc(detail || m.label)}</div>
      ${detail ? `<div class="dim tiny" style="margin-top:6px">${esc(m.label)}</div>` : ''}
      <div class="clock" id="fclock" style="margin-top:26px">0:00</div>
      <div class="chips" style="justify-content:center;margin-top:18px">
        ${[0, 25, 45, 90].map((n) => `<button class="chip ${session.target === n ? 'on' : ''}" data-t="${n}">${n === 0 ? 'Open-ended' : n + 'm'}</button>`).join('')}
      </div>
      <p class="dim tiny" style="margin-top:18px;max-width:300px;margin-left:auto;margin-right:auto;line-height:1.5">
        The timer is optional. Being clear about what you're doing is the part that works.
      </p>
    </div>

    <button class="btn primary block" data-x="done">Finish session</button>`;

  clearInterval(timer);
  timer = setInterval(tick, 250);
  tick();
  wire();
}

function tick() {
  const c = document.getElementById('fclock');
  if (!c || !session) return;
  const elapsed = (Date.now() - session.startedAt) / 1000;
  if (session.target) {
    const left = session.target * 60 - elapsed;
    c.textContent = fmtClock(Math.abs(left));
    c.style.color = left < 0 ? 'var(--ok)' : '';
    if (left < 0 && !session.rang) {
      session.rang = true;
      haptic(60);
      toast('Target reached. Keep going or wrap up.');
    }
  } else {
    c.textContent = fmtClock(elapsed);
  }
}

function finish() {
  if (!session) return closeFocus();
  const mins = Math.round((Date.now() - session.startedAt) / 60000);
  const { intent } = session;
  mutate(() => {
    state.focus.push({ id: session.id, intent, minutes: mins, at: Date.now(), day: todayKey() });
    if (mins >= 10) {
      const d = day(todayKey());
      if (intent === 'money' || intent === 'build') d.money = true;
      if (intent === 'school') d.school = true;
    }
  });
  haptic(20);
  closeFocus();
  toast(mins >= 1 ? `${mins} min logged on ${INTENTS[intent]?.label || 'focus'}` : 'Session ended');
}

function wire() {
  const box = el();
  box.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { haptic(); startSession(b.dataset.i); });
  box.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
    session.target = Number(b.dataset.t);
    session.rang = false;
    renderRunning();
  });
  box.querySelectorAll('[data-x]').forEach((b) => b.onclick = () => {
    const x = b.dataset.x;
    if (x === 'close') closeFocus();
    else if (x === 'free') renderFree();
    else if (x === 'back') renderChoose();
    else if (x === 'done') finish();
  });
}
