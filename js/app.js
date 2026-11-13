/* Bootstrap: the sky is the app. */

import { subscribe } from './store.js';
import { todayKey } from './util.js';
import { mood } from './logic.js';
import { Sky } from './sky.js';
import { buildStars, TABS } from './stars.js';
import { openStar, statsPanel, capturePanel, tasksPanel, salvagePanel } from './panels.js';
import { openPanel, closePanel, bind } from './ui.js';

window.__POS_READY = 7;

const sky = new Sky(document.getElementById('sky'), {
  onStar: (s) => openStar(s),
  onSpace: () => statsPanel()
});

window.__sky = sky;   // handy for debugging and for driving the view in tests

let lastDay = todayKey();

function refresh() {
  sky.setStars(buildStars());
  sky.setMood(mood());
}

subscribe(refresh);
refresh();

/* A new day should be waiting in the morning. */
setInterval(() => {
  const k = todayKey();
  if (k !== lastDay) { lastDay = k; refresh(); }
}, 60_000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const k = todayKey();
  if (k !== lastDay) { lastDay = k; }
  refresh();
});

/* Bottom tabs are shortcuts, not pages: each spins the globe to that star. */
const tabBar = document.getElementById('tabs');
tabBar.innerHTML = TABS.map((t) =>
  `<button data-tab="${t.id}" aria-label="${t.label}">${t.icon}<span>${t.label}</span></button>`).join('');
tabBar.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  try { navigator.vibrate?.(8); } catch {}
  sky.focusStar(b.dataset.tab);
}));

/* The only other chrome: one corner button for what isn't on the globe. */
document.getElementById('menu').addEventListener('click', () => {
  openPanel({
    title: 'More',
    body: `<div class="lines">
      <button class="line" data-m="capture"><span class="line-text"><span class="line-label">Quick Note</span></span></button>
      <button class="line" data-m="tasks"><span class="line-text"><span class="line-label">Task List</span></span></button>
      <button class="line" data-m="salvage"><span class="line-text"><span class="line-label">Rescue Today</span></span></button>
    </div>`,
    onMount(panel, close) {
      bind(panel, '[data-m]', (el) => {
        close();
        setTimeout(() => ({ capture: capturePanel, tasks: tasksPanel, salvage: salvagePanel })[el.dataset.m](), 180);
      });
    }
  });
});

addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

/* A push that opens straight onto tomorrow's planning. */
if (location.hash === '#plan') {
  history.replaceState(null, '', location.pathname);
  setTimeout(() => { sky.focusStar('plan', 400); setTimeout(() => openStar({ panel: 'plan' }), 450); }, 500);
}

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}
