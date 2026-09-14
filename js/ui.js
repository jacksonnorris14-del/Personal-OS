/* UI primitives: bottom sheets, toasts, confirmations.
   Sheets own their own listeners and are destroyed on close — nothing leaks. */

import { esc, haptic } from './util.js';
import { commit } from './store.js';

const layer = () => document.getElementById('sheets');
let closing = null;

export function toast(msg, ms = 2100) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

export function closeSheet() {
  const l = layer();
  if (!l.classList.contains('open')) return;
  l.classList.remove('open');
  clearTimeout(closing);
  closing = setTimeout(() => { l.innerHTML = ''; }, 300);
}

/**
 * open({ title, sub, body, onMount })
 * onMount(sheetEl, close) wires up the content.
 */
export function openSheet({ title = '', sub = '', body = '', onMount } = {}) {
  const l = layer();
  clearTimeout(closing);
  l.innerHTML = `
    <div class="scrim" data-close="1"></div>
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="grabber"></div>
      ${title ? `<h2>${esc(title)}</h2>` : ''}
      ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
      <div class="sheet-body">${body}</div>
    </div>`;

  const sheet = l.querySelector('.sheet');
  l.querySelector('.scrim').addEventListener('click', closeSheet);

  // swipe-down to dismiss
  let y0 = null;
  sheet.addEventListener('touchstart', (e) => {
    y0 = sheet.scrollTop <= 0 ? e.touches[0].clientY : null;
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    const dy = e.touches[0].clientY - y0;
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', () => {
    const dy = parseFloat((sheet.style.transform.match(/translateY\((-?[\d.]+)px\)/) || [0, 0])[1]);
    sheet.style.transform = '';
    if (dy > 90) closeSheet();
    y0 = null;
  });

  requestAnimationFrame(() => l.classList.add('open'));
  onMount?.(sheet, closeSheet);

  // focus the first text field, but only on a real keyboard-friendly surface
  const first = sheet.querySelector('[data-autofocus]');
  if (first) setTimeout(() => first.focus(), 320);
  return closeSheet;
}

export function confirmSheet({ title, sub = '', confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    openSheet({
      title, sub,
      body: `<div class="actions">
        <button class="btn ghost" data-x="no">Cancel</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-x="yes">${esc(confirmLabel)}</button>
      </div>`,
      onMount(sheet, close) {
        sheet.querySelector('[data-x="no"]').onclick = () => { settled = true; resolve(false); close(); };
        sheet.querySelector('[data-x="yes"]').onclick = () => { settled = true; haptic(12); resolve(true); close(); };
        const l = layer();
        const obs = new MutationObserver(() => {
          if (!l.classList.contains('open') && !settled) { settled = true; resolve(false); obs.disconnect(); }
        });
        obs.observe(l, { attributes: true, attributeFilter: ['class'] });
      }
    });
  });
}

/** A single-choice list sheet. options: [{id, label, sub, emoji}] */
export function pickSheet({ title, sub = '', options, footer = '', onPick, onFooter }) {
  openSheet({
    title, sub,
    body: `
      <div class="list-sep" style="margin-top:14px">
        ${options.map((o) => `
          <button class="linkrow" data-id="${esc(o.id)}">
            ${o.emoji ? `<span class="ic">${o.emoji}</span>` : ''}
            <span class="grow">
              <span class="t">${esc(o.label)}</span>
              ${o.sub ? `<span class="d">${esc(o.sub)}</span>` : ''}
            </span>
            <span class="arrow">›</span>
          </button>`).join('')}
        ${options.length ? '' : '<p class="dim tiny center" style="padding:18px 0">Nothing here yet.</p>'}
      </div>
      ${footer ? `<button class="btn block ghost" data-footer="1" style="margin-top:14px">${esc(footer)}</button>` : ''}`,
    onMount(sheet, close) {
      sheet.querySelectorAll('[data-id]').forEach((b) => {
        b.onclick = () => { haptic(); close(); onPick?.(b.dataset.id); };
      });
      const f = sheet.querySelector('[data-footer]');
      if (f) f.onclick = () => { close(); onFooter?.(); };
    }
  });
}

/* ---------------- html builders ---------------- */

export function checkRow({ id, label, meta = '', emoji = '', on = false, cls = '', attrs = '' }) {
  return `
    <button class="check ${on ? 'on' : ''} ${cls}" ${id ? `data-id="${esc(id)}"` : ''} ${attrs}>
      <span class="box">✓</span>
      ${emoji ? `<span class="lead">${emoji}</span>` : ''}
      <span class="txt">${esc(label)}${meta ? `<span class="meta">${esc(meta)}</span>` : ''}</span>
    </button>`;
}

export function pips(done, min, ideal) {
  const total = Math.max(ideal, min, done);
  return `<div class="pips">${Array.from({ length: total }, (_, i) =>
    `<i class="${i >= min ? 'bonus' : ''} ${i < done ? 'on' : ''}"></i>`).join('')}</div>`;
}

export function emptyState(emoji, text) {
  return `<div class="empty-state"><div class="big">${emoji}</div><p>${esc(text)}</p></div>`;
}

/** Attach handlers to freshly rendered nodes (safe: nodes are new each render). */
export function bind(root, sel, fn, ev = 'click') {
  root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, (e) => fn(el, e)));
}

/**
 * Persist a field's value as it changes, without re-rendering the screen.
 * A re-render mid-tap destroys the element the tap started on and the tap is
 * lost, so fields inside a view save this way instead of through mutate().
 */
export function liveSave(el, apply, { event = 'input', delay = 350 } = {}) {
  if (!el) return;
  let t = null;
  const flush = () => { clearTimeout(t); t = null; apply(el.value); commit(); };
  el.addEventListener(event, () => {
    if (!delay) return flush();
    clearTimeout(t);
    t = setTimeout(flush, delay);
  });
  el.addEventListener('blur', () => { if (t || event !== 'input') flush(); });
}
