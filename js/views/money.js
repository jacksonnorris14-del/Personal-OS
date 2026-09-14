/* MONEY ENGINE — one current project, always visible, always with a next action.
   Build before learn: research is allowed, but output is what compounds. */

import { state, mutate, currentProject, newProject, deleteProject, newTask, taskById, day, getDay } from '../store.js';
import { projectTasks, buildLearnBalance } from '../logic.js';
import { todayKey, esc, haptic, sortBy, pct } from '../util.js';
import { openSheet, confirmSheet, pickSheet, bind, toast, emptyState } from '../ui.js';
import { taskRowHtml, bindTasks } from '../tasks-ui.js';
import { openFocus } from '../focus.js';
import { go } from '../app.js';

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
        <span class="lab">What is it, in a line?</span>
        <textarea class="input" id="pj-desc" placeholder="Optional">${esc(p?.description || '')}</textarea>
      </div>
      ${state.goals.length ? `
        <div class="field">
          <span class="lab">Serves which goal?</span>
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

function addProjectTask(projectId, kind) {
  openSheet({
    title: kind === 'build' ? 'What will you build?' : 'What do you need to learn?',
    sub: kind === 'build' ? 'Something that exists when you are done.' : 'Keep it tied to the build.',
    body: `
      <div class="field">
        <input class="input" data-autofocus id="pt-title" placeholder="${kind === 'build' ? 'e.g. Publish the landing page' : 'e.g. Research 3 competitors'}"
               autocomplete="off" enterkeyhint="done">
      </div>
      <div class="actions"><button class="btn primary block" data-x="save">Add</button></div>`,
    onMount(sheet, close) {
      const input = sheet.querySelector('#pt-title');
      const save = () => {
        const v = input.value.trim();
        if (!v) { close(); return; }
        mutate(() => newTask({ title: v, projectId, kind, cat: 'money', inbox: true }));
        haptic(12);
        close();
        toast('Added to the project');
      };
      sheet.querySelector('[data-x="save"]').onclick = save;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    }
  });
}

export default {
  render(params = {}) {
    const proj = currentProject();
    const others = state.projects.filter((p) => p.id !== proj?.id);
    const bal = buildLearnBalance(14);
    const d = getDay(todayKey());

    if (!proj) {
      return `
        <div class="head">
          <div class="kicker">Money Engine</div>
          <h1>What are you building?</h1>
          <p class="sub">One current project. It should never be a question.</p>
        </div>
        ${emptyState('💰', 'Pick the one thing you are actively pursuing. You can change it whenever the work changes — just not every day.')}
        <button class="btn primary block" data-a="new-proj">Set my current project</button>
        ${others.length ? `<div class="section"><div class="label">Other projects</div>
          <div class="list-sep">${others.map((p) => `
            <button class="linkrow" data-a="open-proj" data-id="${p.id}">
              <span class="grow"><span class="t">${esc(p.name)}</span><span class="d">${p.status}</span></span>
              <span class="arrow">›</span>
            </button>`).join('')}</div></div>` : ''}`;
    }

    const open = projectTasks(proj.id);
    const builds = open.filter((t) => t.kind === 'build');
    const learns = open.filter((t) => t.kind === 'learn');
    const rest = open.filter((t) => !t.kind);
    const next = builds[0] || rest[0] || learns[0] || null;
    const goal = state.goals.find((g) => g.id === proj.goalId);
    const buildShare = bal.total ? pct(bal.build, bal.total) : null;

    return `
      <div class="head">
        <div class="kicker">Money Engine</div>
        <h1>Build before learn.</h1>
        <p class="sub">Learning is valuable. Output comes first when it can.</p>
      </div>

      <div class="engine">
        <div class="tag">💰 Current project</div>
        <div class="name wrap-any">${esc(proj.name)}</div>
        ${proj.description ? `<p class="muted" style="font-size:14px;margin-top:8px">${esc(proj.description)}</p>` : ''}
        ${goal ? `<p class="tiny dim" style="margin-top:8px">🏔️ Serves: ${esc(goal.name)}</p>` : ''}
        <div class="row" style="margin-top:14px;gap:8px">
          <button class="btn sm grow ${d.money ? 'ghost' : ''}" data-a="log">${d.money ? '✓ Logged today' : 'Log progress today'}</button>
          <button class="btn sm ghost" data-a="edit-proj">Edit</button>
        </div>
      </div>

      <div class="section">
        <div class="label">Next action</div>
        ${next ? `
          <div class="card">
            <div style="font-size:18px;font-weight:660;letter-spacing:-.02em" class="wrap-any">${esc(next.title)}</div>
            <div class="row" style="gap:8px;margin-top:6px">
              ${next.kind ? `<span class="pill ${next.kind}">${next.kind}</span>` : ''}
            </div>
            <div class="row" style="gap:8px;margin-top:14px">
              <button class="btn sm grow primary" data-a="focus-now">Start focus</button>
              <button class="btn sm grow ghost" data-a="make-must" data-id="${next.id}">Make it today's Must Win</button>
            </div>
          </div>`
        : `<button class="card" data-a="add-build" style="width:100%;text-align:left;border-style:dashed">
             <div style="font-weight:620">Decide the next action</div>
             <div class="tiny dim" style="margin-top:4px">A project without a next action turns into thinking about the project.</div>
           </button>`}
      </div>

      ${bal.total >= 3 ? `
        <div class="section">
          <div class="label">Last 14 days <span class="hint">${bal.build} built · ${bal.learn} learned</span></div>
          <div class="card">
            <div class="bar"><i style="width:${buildShare}%"></i><i style="width:${100 - buildShare}%;background:var(--learn)"></i></div>
            <p class="tiny" style="margin-top:10px;color:var(--text-2)">
              ${buildShare >= 60 ? 'Output is leading. That is the pattern that pays.'
                : buildShare >= 40 ? 'Reasonably balanced. When in doubt, ship the smaller thing.'
                : 'Learning is outpacing building. Publish or send something small today.'}
            </p>
          </div>
        </div>` : ''}

      <div class="section">
        <div class="label">🟢 Build <span class="hint">${builds.length}</span></div>
        <div class="stack">
          ${builds.length ? builds.map((t) => taskRowHtml(t, { showDate: true })).join('')
            : '<p class="dim tiny" style="padding:4px 2px">Nothing queued to build.</p>'}
          <button class="btn sm block ghost" data-a="add-build">+ Add build task</button>
        </div>
      </div>

      <div class="section">
        <div class="label">🔵 Learn <span class="hint">${learns.length}</span></div>
        <div class="stack">
          ${learns.length ? learns.map((t) => taskRowHtml(t, { showDate: true })).join('')
            : '<p class="dim tiny" style="padding:4px 2px">Nothing queued to learn.</p>'}
          <button class="btn sm block ghost" data-a="add-learn">+ Add learning task</button>
        </div>
      </div>

      ${rest.length ? `
        <div class="section">
          <div class="label">Unsorted</div>
          <div class="stack">${rest.map((t) => taskRowHtml(t)).join('')}</div>
        </div>` : ''}

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
  },

  mount(root, params = {}) {
    const proj = currentProject();

    if (params.fromIdea) {
      const idea = taskById(params.fromIdea);
      if (idea) projectEditor(null, idea.title);
    }

    bind(root, '[data-a="new-proj"]', () => projectEditor(null));
    bind(root, '[data-a="edit-proj"]', () => projectEditor(proj.id));

    bind(root, '[data-a="open-proj"]', (el) => {
      const p = state.projects.find((x) => x.id === el.dataset.id);
      if (!p) return;
      pickSheet({
        title: p.name,
        sub: p.status === 'active' ? 'Active project' : p.status === 'paused' ? 'Paused' : 'Completed',
        options: [
          { id: 'current', label: 'Make this my current project', emoji: '💰' },
          { id: 'edit', label: 'Edit project', emoji: '✏️' }
        ],
        onPick: (id) => {
          if (id === 'current') {
            mutate(() => { p.status = 'active'; state.settings.currentProjectId = p.id; });
            toast('Current project switched');
          } else projectEditor(p.id);
        }
      });
    });

    bind(root, '[data-a="log"]', () => {
      haptic(14);
      mutate(() => { const d = day(todayKey()); d.money = !d.money; });
    });

    bind(root, '[data-a="add-build"]', () => addProjectTask(proj.id, 'build'));
    bind(root, '[data-a="add-learn"]', () => addProjectTask(proj.id, 'learn'));
    bind(root, '[data-a="focus-now"]', () => openFocus('money'));

    bind(root, '[data-a="make-must"]', (el) => {
      const key = todayKey();
      mutate(() => {
        const t = taskById(el.dataset.id);
        if (t) { t.date = key; t.inbox = false; day(key).mustId = t.id; }
      });
      toast("Set as today's Must Win");
      go('today');
    });

    bindTasks(root);
  }
};
