/* Bootstrap: router, bottom nav, capture button, service worker. */

import { subscribe } from './store.js';
import { todayKey } from './util.js';
import { openCapture } from './capture.js';

import today from './views/today.js';
import plan from './views/plan.js';
import business from './views/business.js';
import goals from './views/goals.js';
import more from './views/more.js';
import stats from './views/stats.js';
import settings from './views/settings.js';
import sunday from './views/sunday.js';

const VIEWS = { today, plan, business, goals, more, stats, settings, sunday };
const TABS = { today: 'today', plan: 'plan', business: 'business', goals: 'goals',
               more: 'more', stats: 'more', settings: 'more', sunday: 'more' };

let current = 'today';
let params = {};
let lastDay = todayKey();

const screen = () => document.getElementById('screen');

let lastRendered = null;

export function render() {
  const view = VIEWS[current] || VIEWS.today;
  const root = screen();
  root.innerHTML = view.render(params);
  if (lastRendered !== current) {
    lastRendered = current;
    root.classList.remove('enter');
    void root.offsetWidth; // restart the transition
    root.classList.add('enter');
  }
  view.mount?.(root, params);
  document.querySelectorAll('#nav button').forEach((b) => {
    if (TABS[current] === b.dataset.nav) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

/** Navigate. `scroll:false` keeps the position (used for in-place refreshes). */
export function go(name, p = {}, { push = true, scroll = true } = {}) {
  current = VIEWS[name] ? name : 'today';
  params = p;
  if (push) history.pushState({ view: current, params }, '');
  render();
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

window.addEventListener('popstate', (e) => {
  const s = e.state;
  if (s?.view) { current = s.view; params = s.params || {}; render(); }
  else go('today', {}, { push: false });
});

document.querySelectorAll('#nav button').forEach((b) => {
  b.addEventListener('click', () => go(b.dataset.nav));
});

document.getElementById('fab').addEventListener('click', () => openCapture());

subscribe(() => render());

/* A new day should be waiting when you open the app in the morning. */
function checkRollover() {
  const k = todayKey();
  if (k !== lastDay) { lastDay = k; render(); }
}
setInterval(checkRollover, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkRollover(); });

history.replaceState({ view: 'today', params: {} }, '');
render();

/* Updates land on their own: a new worker takes over and the page reloads once,
   so opening the app is all it takes to be on the latest version. */
if ('serviceWorker' in navigator) {
  // On a first-ever visit the worker claims an uncontrolled page, which is not
  // an update — reloading for that would just flash the app on launch.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // Check for a new build whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    }).catch(() => { /* offline support is a bonus */ });
  });
}
