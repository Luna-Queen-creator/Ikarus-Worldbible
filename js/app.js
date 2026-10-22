// Archive: app shell, navigation and startup.
import { load, cleanupBlobs } from './model.js';
import { h, injectIcons, openSheet, confirmSheet, toast, iconEl, isAuthor, navState } from './ui.js';
import { hide as hideSuggest } from './editor.js';
import { renderFactions } from './views/factions.js';
import { renderEntry } from './views/entry.js';
import { renderEdit } from './views/edit.js';
import { renderPlaces, renderHistory, renderStories } from './views/lists.js';
import { renderVersus } from './views/versus.js';
import { renderMap } from './views/map.js';
import { renderSettings } from './views/settings.js';
import { renderBackup } from './views/backup.js';
import { renderSearch } from './views/search.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav');
const backBtn = document.getElementById('back');
const authorBtn = document.getElementById('authorBtn');
const SECTIONS = ['factions', 'places', 'history', 'stories', 'map'];
let navCount = 0;
let currentPath = '';
const scrollMemory = new Map();

const routes = [
  [/^\/?$/, () => { location.replace('#/factions'); return false; }],
  [/^\/factions(?:\/([^/]+))?$/, (m) => renderFactions(main, { factionId: m[1] })],
  [/^\/places$/, () => renderPlaces(main)],
  [/^\/history$/, () => renderHistory(main)],
  [/^\/stories$/, () => renderStories(main)],
  [/^\/map$/, () => renderMap(main)],
  [/^\/e\/([^/]+)$/, (m) => renderEntry(main, { id: m[1] })],
  [/^\/edit\/([^/]+)$/, (m) => renderEdit(main, { id: m[1] })],
  [/^\/new\/(being|place|event|story)(?:\/([^/]*))?(?:\/([^/]*))?$/, (m) => renderEdit(main, { kind: m[1], a: m[2], b: m[3] })],
  [/^\/versus(?:\/([^/]*))?(?:\/([^/]*))?$/, (m) => renderVersus(main, { a: m[1], b: m[2] })],
  [/^\/settings$/, () => renderSettings(main)],
  [/^\/backup$/, () => renderBackup(main)],
  [/^\/search$/, () => renderSearch(main)],
];

const currentRoute = () => decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
const isEditing = (path) => /^\/(edit|new)\//.test(path);

function sectionOf(path) {
  const first = path.split('/')[1] || '';
  return SECTIONS.includes(first) ? first : null;
}

function setChrome(path) {
  const sec = sectionOf(path);
  if (sec) {
    try { sessionStorage.setItem('archive.section', sec); } catch { /* ignore */ }
  }
  let active = sec;
  if (!active) { try { active = sessionStorage.getItem('archive.section'); } catch { active = null; } }
  for (const a of nav.querySelectorAll('a')) {
    if (a.dataset.sec === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  backBtn.hidden = !!sec;
  document.body.classList.toggle('editing', isEditing(path));
}

async function render() {
  hideSuggest();
  const path = currentRoute();
  if (currentPath) scrollMemory.set(currentPath, window.scrollY);
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (!m) continue;
    main.replaceChildren();
    setChrome(path);
    navState.prev = currentPath;
    const result = await fn(m);
    if (result === false) return;
    currentPath = path;
    const y = sectionOf(path) ? scrollMemory.get(path) || 0 : 0;
    window.scrollTo(0, y);
    return;
  }
  currentPath = path;
  main.replaceChildren(h('div', { class: 'empty' }, h('p', {}, 'This page doesn’t exist.'), h('a', { class: 'btn', href: '#/factions' }, 'Go to Factions')));
}

function setAuthor(on) {
  document.body.classList.toggle('author', on);
  authorBtn.setAttribute('aria-pressed', String(on));
  authorBtn.title = on ? 'Author mode is on' : 'Author mode is off';
  document.getElementById('authorFlag').hidden = !on;
  try { localStorage.setItem('archive.author', on ? '1' : '0'); } catch { /* ignore */ }
}

authorBtn.addEventListener('click', () => {
  if (isEditing(currentRoute())) {
    toast('Save or cancel first, then switch author mode.');
    return;
  }
  setAuthor(!isAuthor());
  toast(isAuthor() ? 'Author mode on: secrets are visible' : 'Author mode off: secrets are hidden');
  render();
});

backBtn.addEventListener('click', () => {
  if (navCount > 0) history.back();
  else {
    let sec = 'factions';
    try { sec = sessionStorage.getItem('archive.section') || 'factions'; } catch { /* ignore */ }
    location.hash = `#/${sec}`;
  }
});

document.getElementById('menuBtn').addEventListener('click', () => {
  openSheet((close) => [
    h('h2', { class: 'sheet-t' }, 'Archive'),
    h('nav', { class: 'menu' },
      h('a', { href: '#/versus', onclick: () => close() }, iconEl('swords'), 'Versus'),
      h('a', { href: '#/search', onclick: () => close() }, iconEl('search'), 'Search'),
      h('a', { href: '#/settings', onclick: () => close() }, iconEl('settings'), 'Settings'),
      h('a', { href: '#/backup', onclick: () => close() }, iconEl('download'), 'Backup and restore')),
    h('p', { class: 'hint menu-foot' }, 'Your world lives on this device only. Version 1.0'),
  ], { label: 'Menu' });
});

// Unsaved edits: in-app links ask first, before anything navigates.
let asking = false;
async function askToLeave() {
  if (asking) return false;
  asking = true;
  const leave = await confirmSheet({ title: 'Discard changes?', text: 'What you changed here won’t be saved.', confirm: 'Discard' });
  asking = false;
  if (leave && navState.guard) {
    await navState.guard.leave();
    navState.guard = null;
  }
  return leave;
}

document.addEventListener('click', async (ev) => {
  const a = ev.target.closest && ev.target.closest('a[href^="#"]');
  if (!a || !navState.guard || !navState.guard.dirty()) return;
  if (a.getAttribute('href') === location.hash) return;
  ev.preventDefault();
  const target = a.getAttribute('href');
  if (await askToLeave()) location.hash = target;
}, true);

window.addEventListener('hashchange', async (ev) => {
  const g = navState.guard;
  if (g) {
    if (g.dirty()) {
      // The back gesture already left the editor's address: add it again, then ask.
      history.pushState(null, '', ev.oldURL);
      if (await askToLeave()) history.back();
      return;
    }
    await g.leave();
    navState.guard = null;
  }
  navCount += 1;
  render();
});

window.addEventListener('beforeunload', (ev) => {
  if (navState.guard && navState.guard.dirty()) {
    ev.preventDefault();
    ev.returnValue = '';
  }
});

(async () => {
  injectIcons(document);
  let author = false;
  try { author = localStorage.getItem('archive.author') === '1'; } catch { /* ignore */ }
  setAuthor(author);
  try {
    await load();
  } catch {
    main.replaceChildren(h('div', { class: 'empty' }, h('p', {}, 'Archive couldn’t open its storage on this device. If this is a private window, open Archive in a normal one.')));
    return;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await render();
  setTimeout(() => { cleanupBlobs().catch(() => {}); }, 3000);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
