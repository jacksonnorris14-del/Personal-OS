/* BUSINESS — what you're building right now, and nothing you have to maintain.
   No queues to groom, no next-action field to keep current. The tab answers
   one question at a glance — what am I working on? — and gets out of the way. */

import { state, mutate, currentProject, newProject, deleteProject, newTask, day, getDay } from '../store.js';
import { todayKey, addDays, esc, haptic, sortBy, DOW_LETTER, dow } from '../util.js';
import { openSheet, confirmSheet, pickSheet, bind, toast, emptyState } from '../ui.js';
import { taskRowHtml, bindTasks } from '../tasks-ui.js';
import { openFocus } from '../focus.js';

function projectEditor(id, prefill = '') {
  const p = id ? state.projects.find((x) => x.id === id) : null;
  openSheet({
    title: p ? 'Edit project' : 'New project',
    sub: p ? '' : 'One thing you are actively building.',
    body: `
      <div class="field">
        <span class="lab">Name</span>
        <input class="input" id="pj-name" data-autofocus value="${esc(p?.name || prefill)}"
               placeholder="e.g. Launch Version 1 of my app" autocomplete="off">
      </div>
      <div class="field">
        <span class="lab">What is it, in a line? <span style="text-transform:none;letter-spacing:0;font-weight:500;color:var(--text-4)">· optional</span></span>
        <textarea class="input" id="pj-desc" placeholder="Skip it if you'd rather">${esc(p?.description || '')}</textarea>
      </div>
      ${state.goals.length ? `
        <div class="field">
          <span class="lab">Serves which goal? <span style="text-transform:none;letter-spacing:0;font-weight:500;color:var(--text-4)">· optional</span></span>
          <select class="input" id="pj-goal">
            <option value="">None</option>
            ${state.goals.map((g) => `<option value="${g.id}" ${p?.goalId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
          </select>
        </div>` : ''}
      ${p ? `
        <div class="field">
          <span class="lab">Status</span>
          <div class="chips">
            ${[['active', 'Active'], ['paused', 'Paused'], ['done', 'Completed']].map(([k, l]) =>
              `<button class="chip ${p.status === k ? 'on' : ''}" data-s="${k}">${l}</button>`).join('')}
          </div>
        </div>` : ''}
      <div class="actions">
        ${p ? '<button class="btn danger" data-x="del">Delete</button>' : ''}
        <button class="btn primary" data-x="save">${p ? 'Save' : 'Create & make current'}</button>
      </div>`,
    onMount(sheet, close) {
      let status = p?.status || 'active';
      sheet.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => {
        status = b.dataset.s;
        sheet.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b));
      });
      sheet.querySelector('[data-x="save"]').onclick = () => {
        const name = sheet.querySelector('#pj-name').value.trim();
        if (!name) { toast('Name it first'); return; }
        const desc = sheet.querySelector('#pj-desc').value.trim();
        const goalId = sheet.querySelector('#pj-goal')?.value || null;
        mutate(() => {
          if (p) {
            Object.assign(p, { name, description: desc, goalId, status });
            if (status !== 'active' && state.settings.currentProjectId === p.id) {
              const next = state.projects.find((x) => x.status === 'active' && x.id !== p.id);
              state.settings.currentProjectId = next?.id || null;
            }
          } else {
            const np = newProject({ name, description: desc, goalId });
            state.settings.currentProjectId = np.id;
          }
        });
        close();
      };
      const del = sheet.querySelector('[data-x="del"]');
      if (del) del.onclick = async () => {
        close();
        if (await confirmSheet({ title: 'Delete project?', sub: p.name, confirmLabel: 'Delete', danger: true })) {
          mutate(() => deleteProject(p.id));
          toast('Deleted');
        }
      };
    }
  });
}

function addLearnItem(projectId) {
  openSheet({
    title: 'Add to the learning list',
    sub: 'Somewhere to put it so it stops pulling at your attention mid-build.',
    body: `
      <div class="field">
        <input class="input" data-autofocus id="pt-title" placeholder="e.g. How ad targeting actually works"
               autocomplete="off" enterkeyhint="done">
      </div>
      <div class="actions"><button class="btn primary block" data-x="save">Add</button></div>`,
    onMount(sheet, close) {
      const input = sheet.querySelector('#pt-title');
      const save = () => {
        const v = input.value.trim();
        if (!v) { close(); return; }
        mutate(() => newTask({ title: v, projectId, kind: 'learn', cat: 'money' }));
        haptic(12);
        close();
        toast('Parked for later');
      };
      sheet.querySelector('[data-x="save"]').onclick = save;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    }
  });
}

/** Last 7 days of logged business work — derived, nothing to fill in. */
function activityStrip(key) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(key, -(6 - i)));
  const hits = days.filter((k) => getDay(k).money).length;
  return `
    <div class="card">
      <div class="row between">
        <span class="pill">📈 Last 7 days</span>
        <span class="tiny dim">${hits}/7 days worked</span>
      </div>
      <div class="weekstrip" style="margin-top:12px">
        ${days.map((k) => `
          <div class="d">
            <div class="n">${DOW_LETTER[dow(k)]}</div>
            <div class="dot ${getDay(k).money ? 'full' : 'miss'} ${k === key ? 'today' : ''}" style="height:26px">${getDay(k).money ? '✓' : ''}</div>
          </div>`).join('')}
      </div>
      <p class="tiny dim" style="margin-top:10px">
        ${hits >= 6 ? 'Near-daily. That is the whole game.'
          : hits >= 4 ? 'Solid rhythm. Consistency beats intensity here.'
          : hits >= 2 ? 'Some movement. Ten minutes on a bad day still counts.'
          : 'Quiet week. One small session today restarts it.'}
      </p>
    </div>`;
}

export default {
  render(params = {}) {
    const key = todayKey();
    const proj = currentProject();
    const others = state.projects.filter((p) => p.id !== proj?.id);
    const d = getDay(key);

    const otherProjectsSection = `
      <div class="section">
        <div class="label">Projects</div>
        <div class="list-sep">
          ${sortBy(others, (p) => ({ active: 0, paused: 1, done: 2 }[p.status])).map((p) => `
            <button class="linkrow" data-a="open-proj" data-id="${p.id}">
              <span class="grow"><span class="t">${esc(p.name)}</span><span class="d">${p.status === 'active' ? 'Active' : p.status === 'paused' ? 'Paused' : 'Completed'}</span></span>
              <span class="arrow">›</span>
            </button>`).join('')}
          <button class="btn sm block ghost" data-a="new-proj">+ New project</button>
        </div>
      </div>`;

    if (!proj) {
      return `
        <div class="head">
          <div class="kicker">Business</div>
          <h1>What are you building?</h1>
          <p class="sub">One current project. Just a name is enough.</p>
        </div>
        ${emptyState('💼', 'Name the thing you are actively working on. You can change it whenever the work changes.')}
        <button class="btn primary block" data-a="new-proj">Set my current project</button>
        ${others.length ? otherProjectsSection : ''}`;
    }

    const learns = state.tasks.filter((t) => t.projectId === proj.id && t.kind === 'learn' && !t.done);
    const goal = state.goals.find((g) => g.id === proj.goalId);

    return `
      <div class="head">
        <div class="kicker">Business</div>
        <h1>${esc(proj.name)}</h1>
        ${proj.description ? `<p class="sub">${esc(proj.description)}</p>` : ''}
      </div>

      <div class="engine">
        <div class="tag">💼 Working on it</div>
        <p class="muted" style="font-size:14.5px;margin-top:9px;line-height:1.5">
          ${d.money ? 'Logged today. That is all this asks for.' : 'Did you move it forward today? Ten minutes counts.'}
        </p>
        <div class="row" style="margin-top:14px;gap:8px">
          <button class="btn sm grow ${d.money ? 'ghost' : 'primary'}" data-a="log">${d.money ? '✓ Logged today' : 'Log work'}</button>
          <button class="btn sm grow ghost" data-a="focus-now">Start focus</button>
        </div>
        ${goal ? `<p class="tiny dim" style="margin-top:12px">🏔️ Serves: ${esc(goal.name)}</p>` : ''}
      </div>

      <div class="section">
        ${activityStrip(key)}
      </div>

      <div class="section">
        <div class="label">📖 Learning list <span class="hint">${learns.length || ''}</span></div>
        <div class="stack">
          ${learns.length
            ? learns.map((t) => taskRowHtml(t, { inProject: true })).join('')
            : '<p class="dim tiny" style="padding:4px 2px">Empty. Add things here when curiosity strikes mid-build.</p>'}
          <button class="btn sm block ghost" data-a="add-learn">+ Add something to learn</button>
        </div>
        <p class="tiny dim" style="margin-top:9px;padding:0 2px">
          Park it here instead of chasing it now — then pick from this list when you actually have time to read.
        </p>
      </div>

      <div class="section">
        <button class="btn block ghost" data-a="edit-proj">Edit this project</button>
      </div>

      ${otherProjectsSection}`;
  },

  mount(root, params = {}) {
    const proj = currentProject();

    bind(root, '[data-a="new-proj"]', () => projectEditor(null));
    bind(root, '[data-a="edit-proj"]', () => projectEditor(proj.id));
    bind(root, '[data-a="add-learn"]', () => addLearnItem(proj.id));
    bind(root, '[data-a="focus-now"]', () => openFocus('money'));

    bind(root, '[data-a="log"]', () => {
      haptic(14);
      mutate(() => { const d = day(todayKey()); d.money = !d.money; });
    });

    bind(root, '[data-a="open-proj"]', (el) => {
      const p = state.projects.find((x) => x.id === el.dataset.id);
      if (!p) return;
      pickSheet({
        title: p.name,
        sub: p.status === 'active' ? 'Active project' : p.status === 'paused' ? 'Paused' : 'Completed',
        options: [
          { id: 'current', label: 'Make this my current project', emoji: '💼' },
          { id: 'edit', label: 'Edit project', emoji: '✏️' }
        ],
        onPick: (id) => {
          if (id === 'current') {
            mutate(() => { p.status = 'active'; state.settings.currentProjectId = p.id; });
            toast('Switched');
          } else projectEditor(p.id);
        }
      });
    });

    bindTasks(root);
  }
};
