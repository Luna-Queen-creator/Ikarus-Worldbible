// Small DOM helpers shared by every screen.
import { imageUrl } from './model.js';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' && (tag === 'input' || tag === 'textarea')) el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  appendAll(el, children);
  return el;
}

function appendAll(el, kids) {
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) appendAll(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(NS, tag);
  if (attrs) for (const k of Object.keys(attrs)) if (attrs[k] != null && attrs[k] !== false) el.setAttribute(k, String(attrs[k]));
  for (const c of children) if (c != null) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

const svg = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${p}</svg>`;
export const ICON = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  eye: svg('<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  factions: svg('<path d="M12 3l7 3v5c0 4.6-3 8.1-7 10-4-1.9-7-5.4-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
  places: svg('<path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0113 0c0 5.3-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  history: svg('<path d="M6.5 3.5v17"/><circle cx="6.5" cy="7" r="1.9"/><circle cx="6.5" cy="17" r="1.9"/><path d="M10.5 7h9M10.5 12h6M10.5 17h9"/>'),
  stories: svg('<path d="M5 4.5A1.5 1.5 0 016.5 3H19v15H6.5A1.5 1.5 0 005 19.5z"/><path d="M5 19.5A1.5 1.5 0 006.5 21H19v-3"/><path d="M9 7.5h6M9 11h4"/>'),
  map: svg('<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  trash: svg('<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>'),
  image: svg('<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  key: svg('<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H21M17.5 12v3M20.5 12v2"/>'),
  swords: svg('<path d="M14.5 14.5L20 20M18 16l-2 2M4 4h3.5l9 9-3.5 3.5-9-9zM20 4h-3.5l-5 5M9.5 14.5L4 20M6 16l2 2"/>'),
  swap: svg('<path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5"/>'),
  download: svg('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>'),
  upload: svg('<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>'),
  share: svg('<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'),
  pin: svg('<path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0113 0c0 5.3-6.5 11-6.5 11z"/>'),
  polygon: svg('<path d="M5 8l6-4 8 5-2 10H7z"/>'),
  hand: svg('<path d="M8 13V6.5a1.5 1.5 0 013 0V12M11 11V5a1.5 1.5 0 013 0v6M14 11V6.5a1.5 1.5 0 013 0V14c0 4-2.5 7-6 7s-4.5-1.5-6-4l-1.5-2.5a1.5 1.5 0 012.5-1.6L8 14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  lore: svg('<path d="M8 8H5V6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5V17"/><path d="M8 6.5V18a2.5 2.5 0 002.5 2.5h8a2 2 0 002-2V17H11v1.5"/><path d="M11 9h5M11 12.5h5"/>'),
  item: svg('<path d="M4 4l2.8.4 9.4 9.4-2.4 2.4-9.4-9.4z"/><path d="M11.6 18.4l6.8-6.8M16.8 16.8L20.5 20.5"/>'),
};

export function iconEl(name, cls = 'ico') {
  return h('span', { class: cls, html: ICON[name] || '' });
}

export function injectIcons(root) {
  for (const el of root.querySelectorAll('[data-icon]')) el.insertAdjacentHTML('afterbegin', ICON[el.dataset.icon] || '');
}

// The open editor registers itself here so leaving it with unsaved changes asks first,
// including the phone's back gesture. { dirty(): boolean, leave(): Promise }
export const navState = { guard: null, prev: '' };

let toastTimer = 0;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// Bottom sheet built on <dialog>. build(close) returns the content; close(value) resolves the promise.
export function openSheet(build, { label } = {}) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'sheet', 'aria-label': label || null });
    const inner = h('div', { class: 'sheet-in' });
    dlg.append(inner);
    let finished = false;
    const close = (val) => {
      if (finished) return;
      finished = true;
      try { dlg.close(); } catch { /* already closed */ }
      dlg.remove();
      resolve(val);
    };
    inner.append(...[].concat(build(close)).filter(Boolean));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(undefined); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(undefined); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function confirmSheet({ title, text, confirm = 'Delete', danger = true, cancel = 'Cancel' }) {
  return openSheet((close) => [
    h('h2', { class: 'sheet-t' }, title),
    text ? h('p', { class: 'sheet-p' }, text) : null,
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => close(false) }, cancel),
      h('button', { type: 'button', class: 'btn' + (danger ? ' danger' : ''), onclick: () => close(true) }, confirm)),
  ], { label: title }).then((v) => v === true);
}

export function imgFor(id, alt = '') {
  const img = h('img', { alt, decoding: 'async' });
  imageUrl(id).then((u) => {
    if (u) img.src = u;
    else img.classList.add('missing');
  }).catch(() => img.classList.add('missing'));
  return img;
}

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
export const fmt = (n) => nf.format(Number(n) || 0);

export function debounce(fn, ms) {
  let t = 0;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export const isAuthor = () => document.body.classList.contains('author');

export function getPref(k, d) {
  try { const v = localStorage.getItem('archive.' + k); return v == null ? d : v; } catch { return d; }
}

export function setPref(k, v) {
  try { localStorage.setItem('archive.' + k, v); } catch { /* storage may be blocked */ }
}

// Words that read wrong with an s on the end, like "Armors".
const UNCOUNTABLE = /\b(kaiju|armou?r|gear|equipment|clothing|ammo|ammunition|technology|magic|lore|knowledge|food|money|music|art|wildlife|fauna|flora|other)$/i;

export function plural(n) {
  if (UNCOUNTABLE.test(n) || /s$/i.test(n)) return n;
  if (/[^aeiou]y$/i.test(n)) return n.slice(0, -1) + 'ies';
  return n + 's';
}

export function excerpt(text, n) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

export function relDays(ts) {
  if (!ts) return 'never';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
