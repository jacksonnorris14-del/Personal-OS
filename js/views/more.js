/* MORE — history, the weekly reset, settings, and your data. */

import { state, exportJSON, importJSON, resetAll } from '../store.js';
import { todayKey, esc, dow } from '../util.js';
import { openSheet, confirmSheet, bind, toast } from '../ui.js';
import { go } from '../app.js';

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export default {
  render() {
    const inbox = state.tasks.filter((t) => !t.done && !t.date).length;
    const isSunday = dow(todayKey()) === 0;

    return `
      <div class="head">
        <div class="kicker">More</div>
        <h1>The rest of the system.</h1>
      </div>

      <div class="list-sep">
        <button class="linkrow" data-a="stats">
          <span class="ic">📊</span>
          <span class="grow"><span class="t">History</span><span class="d">Trends, consistency, what actually happened</span></span>
          <span class="arrow">›</span>
        </button>
        <button class="linkrow" data-a="sunday">
          <span class="ic">☀️</span>
          <span class="grow"><span class="t">Sunday Reset</span><span class="d">${isSunday ? 'Today is the day' : 'Weekly reset and planning'}</span></span>
          <span class="arrow">›</span>
        </button>
        <button class="linkrow" data-a="inbox">
          <span class="ic">📥</span>
          <span class="grow"><span class="t">Inbox</span><span class="d">${inbox ? `${inbox} waiting to be sorted` : 'Clear'}</span></span>
          <span class="arrow">›</span>
        </button>
        <button class="linkrow" data-a="settings">
          <span class="ic">⚙️</span>
          <span class="grow"><span class="t">Settings</span><span class="d">Sleep, faith, fitness, standards, priorities</span></span>
          <span class="arrow">›</span>
        </button>
      </div>

      ${!standalone() ? `
        <div class="section">
          <div class="label">Install</div>
          <div class="banner">
            <b>📲 Add to your Home Screen.</b>
            In Safari, tap the Share button, then <b>Add to Home Screen</b>. It opens full-screen, works offline, and keeps your data on the phone.
          </div>
        </div>` : ''}

      <div class="section">
        <div class="label">How this app thinks</div>
        <div class="card">
          <ul class="stack" style="gap:9px">
            ${[
              ['🎯', 'One Must Win a day. Two secondary, at most.'],
              ['📉', 'Minimum beats ideal. Ideal is a bonus, never the bar.'],
              ['🔁', 'Miss once, return. Never miss twice.'],
              ['🚨', 'A salvaged day beats a restart on Monday.'],
              ['🟢', 'Build before learn. Output compounds; research does not.'],
              ['🌙', 'Decide tonight so tomorrow is execution.'],
              ['😌', 'Rest is earned, not forbidden. Intentional rest is not avoidance.']
            ].map(([e, t]) => `<li class="row" style="gap:11px;align-items:flex-start">
                 <span style="width:20px">${e}</span>
                 <span class="tiny muted" style="font-size:13.5px;line-height:1.5">${esc(t)}</span>
               </li>`).join('')}
          </ul>
        </div>
      </div>

      <div class="section">
        <div class="label">Your data</div>
        <div class="list-sep">
          <button class="linkrow" data-a="export">
            <span class="ic">⬇️</span>
            <span class="grow"><span class="t">Export a backup</span><span class="d">Everything stays on this device otherwise</span></span>
            <span class="arrow">›</span>
          </button>
          <button class="linkrow" data-a="import">
            <span class="ic">⬆️</span>
            <span class="grow"><span class="t">Restore from a backup</span></span>
            <span class="arrow">›</span>
          </button>
          <button class="linkrow" data-a="reset">
            <span class="ic">🗑️</span>
            <span class="grow"><span class="t" style="color:#FF7A6B">Erase everything</span></span>
            <span class="arrow">›</span>
          </button>
        </div>
      </div>

      <p class="tiny dim center" style="margin-top:26px">Personal OS · v1 · offline, local, yours</p>`;
  },

  mount(root) {
    bind(root, '[data-a="stats"]', () => go('stats'));
    bind(root, '[data-a="sunday"]', () => go('sunday'));
    bind(root, '[data-a="settings"]', () => go('settings'));
    bind(root, '[data-a="inbox"]', () => go('plan'));

    bind(root, '[data-a="export"]', () => {
      const text = exportJSON();
      openSheet({
        title: 'Backup',
        sub: 'Copy this somewhere safe — notes, email, a file.',
        body: `
          <textarea class="input" id="ex" style="min-height:220px;font-size:12px;font-family:ui-monospace,monospace" readonly>${esc(text)}</textarea>
          <div class="actions"><button class="btn primary block" data-x="copy">Copy to clipboard</button></div>`,
        onMount(sheet, close) {
          sheet.querySelector('[data-x="copy"]').onclick = async () => {
            const ta = sheet.querySelector('#ex');
            try {
              await navigator.clipboard.writeText(ta.value);
              toast('Copied');
            } catch {
              ta.select();
              document.execCommand?.('copy');
              toast('Copied');
            }
            close();
          };
        }
      });
    });

    bind(root, '[data-a="import"]', () => {
      openSheet({
        title: 'Restore',
        sub: 'Paste a backup. This replaces everything currently saved.',
        body: `
          <textarea class="input" id="im" data-autofocus style="min-height:200px;font-size:12px;font-family:ui-monospace,monospace" placeholder="Paste backup JSON"></textarea>
          <div class="actions"><button class="btn primary block" data-x="go">Restore</button></div>`,
        onMount(sheet, close) {
          sheet.querySelector('[data-x="go"]').onclick = () => {
            try {
              importJSON(sheet.querySelector('#im').value);
              close();
              toast('Restored');
              go('today');
            } catch {
              toast('That does not look like a valid backup');
            }
          };
        }
      });
    });

    bind(root, '[data-a="reset"]', async () => {
      const ok = await confirmSheet({
        title: 'Erase everything?',
        sub: 'Every goal, task, day and setting on this device. This cannot be undone.',
        confirmLabel: 'Erase', danger: true
      });
      if (ok) { resetAll(); go('today'); toast('Cleared'); }
    });
  }
};
