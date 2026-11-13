/* Panels, toasts, confirms. One sheet at a time, nothing nested. */

import { esc, haptic } from './util.js';

const layer = () => document.getElementById('sheet');
let closeTimer = null;

export function toast(msg, ms = 1900) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), ms);
}

export function closePanel() {
  const l = layer();
  if (!l.classList.contains('on')) return;
  l.classList.remove('on');
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => { l.innerHTML = ''; }, 320);
  document.body.classList.remove('locked');
}

export function openPanel({ title = '', kicker = '', body = '', onMount, wide = false } = {}) {
  const l = layer();
  clearTimeout(closeTimer);
  l.innerHTML = `
    <div class="scrim"></div>
    <section class="panel ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="grip"></div>
      <div class="panel-scroll">
        ${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}
        ${title ? `<h2>${esc(title)}</h2>` : ''}
        ${body}
      </div>
    </section>`;

  const panel = l.querySelector('.panel');
  const scroll = l.querySelector('.panel-scroll');
  l.querySelector('.scrim').addEventListener('click', closePanel);

  let y0 = null;
  panel.addEventListener('touchstart', (e) => {
    y0 = scroll.scrollTop <= 0 ? e.touches[0].clientY : null;
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    const dy = e.touches[0].clientY - y0;
    if (dy > 0) panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  panel.addEventListener('touchend', () => {
    const m = panel.style.transform.match(/translateY\(([\d.]+)px\)/);
    panel.style.transform = '';
    if (m && parseFloat(m[1]) > 80) closePanel();
    y0 = null;
  });

  document.body.classList.add('locked');
  requestAnimationFrame(() => l.classList.add('on'));
  onMount?.(panel, closePanel);
  const first = panel.querySelector('[data-autofocus]');
  if (first) setTimeout(() => first.focus(), 340);
}

export function confirmPanel({ title, note = '', confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    openPanel({
      title,
      body: `${note ? `<p class="lede">${esc(note)}</p>` : ''}
        <div class="row-actions">
          <button class="btn" data-x="no">Cancel</button>
          <button class="btn ${danger ? 'danger' : 'accent'}" data-x="yes">${esc(confirm)}</button>
        </div>`,
      onMount(panel, close) {
        panel.querySelector('[data-x="no"]').onclick = () => { settled = true; resolve(false); close(); };
        panel.querySelector('[data-x="yes"]').onclick = () => { settled = true; haptic(12); resolve(true); close(); };
        const obs = new MutationObserver(() => {
          if (!layer().classList.contains('on') && !settled) { settled = true; resolve(false); obs.disconnect(); }
        });
        obs.observe(layer(), { attributes: true, attributeFilter: ['class'] });
      }
    });
  });
}

export function bind(root, sel, fn, ev = 'click') {
  root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, (e) => fn(el, e)));
}

/* ---------- small builders ---------- */

/** A tappable line with an optional state dot. */
export function line(label, { meta = '', on = null, attrs = '', value = '' } = {}) {
  return `
    <button class="line" ${attrs}>
      ${on === null ? '' : `<span class="mark ${on ? 'on' : ''}"></span>`}
      <span class="line-text">
        <span class="line-label">${esc(label)}</span>
        ${meta ? `<span class="line-meta">${esc(meta)}</span>` : ''}
      </span>
      ${value ? `<span class="line-value">${esc(value)}</span>` : ''}
    </button>`;
}

/** Seven dots, oldest to newest. */
export function dots(flags) {
  return `<span class="dots">${flags.map((f) => `<i class="${f ? 'on' : ''}"></i>`).join('')}</span>`;
}

export function field(label, inner) {
  return `<label class="field"><span class="flabel">${esc(label)}</span>${inner}</label>`;
}
