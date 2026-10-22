// Building blocks shared by the screens: rows, chips, rich text, pickers.
import { h, ICON, iconEl, imgFor, openSheet, getPref, setPref, plural, relDays, isAuthor } from '../ui.js';
import { state, byId, byName, typeName, splitTokens, splitHash, findByName } from '../model.js';

export function setTitle(t) {
  document.getElementById('title').textContent = t;
  document.title = t === 'Archive' ? 'Archive' : `${t} · Archive`;
}

export const glyph = (c) => `${c?.glyph || '?'}︎`;

export function classChip(e, withWord = true) {
  const c = byId(state.settings.classes, e.kclass);
  if (!c) return null;
  return h('span', { class: 'chip chip-class' },
    h('span', { class: 'gl', 'aria-hidden': 'true' }, glyph(c)), withWord ? `${c.name} class` : c.name);
}

export function elementChips(e) {
  return (e.elements || [])
    .map((id) => byId(state.settings.elements, id))
    .filter(Boolean)
    .map((el) => h('span', { class: 'chip' }, h('i', { class: 'dot', style: `--c:${el.color}` }), el.name));
}

export function rankChip(e) {
  const r = byId(state.settings.ranks, e.rank);
  if (!r) return null;
  return h('span', { class: 'chip chip-rank' }, h('i', { class: 'belt', style: `--c:${r.color}` }), `${r.name} Slayer`);
}

export function thumb(e, cls = 'thumb') {
  const box = h('span', { class: cls });
  if (e.images && e.images.length) {
    box.append(imgFor(e.images[0], ''));
  } else if (e.faction === 'kaiju') {
    const c = byId(state.settings.classes, e.kclass);
    box.append(h('span', { class: 'ph gl', 'aria-hidden': 'true' }, c ? glyph(c) : '?'));
  } else if (e.kind !== 'being') {
    const ic = { place: 'places', lore: 'lore', item: 'item', event: 'history', story: 'stories' }[e.kind];
    box.append(h('span', { class: 'ph ph-ic', 'aria-hidden': 'true', html: ICON[ic] || '' }));
  } else {
    box.append(h('span', { class: 'ph', 'aria-hidden': 'true' }, (e.name || '?').trim().charAt(0).toUpperCase() || '?'));
  }
  if (e.faction === 'kaiju') {
    const el = byId(state.settings.elements, (e.elements || [])[0]);
    if (el) { box.style.setProperty('--ring', el.color); box.classList.add('ringed'); }
  }
  if (e.type === 'slayer') {
    const r = byId(state.settings.ranks, e.rank);
    if (r) { box.style.setProperty('--belt', r.color); box.classList.add('belted'); }
  }
  return box;
}

export function row(e, extra = []) {
  const meta = [];
  if (e.kind === 'being') {
    if (e.faction === 'kaiju') {
      const c = classChip(e, false);
      if (c) meta.push(c);
      meta.push(...elementChips(e).slice(0, 2));
    } else if (e.type === 'slayer') {
      const r = rankChip(e);
      if (r) meta.push(r);
    } else {
      meta.push(h('span', { class: 'chip quiet' }, typeName(e)));
    }
    if (e.tamer && isAuthor()) meta.push(h('span', { class: 'chip secret' }, 'Tamer'));
  }
  meta.push(...extra);
  return h('a', { class: 'row', href: `#/e/${e.id}` },
    thumb(e),
    h('span', { class: 'row-main' },
      h('span', { class: 'row-name' }, e.name || 'Untitled'),
      e.summary ? h('span', { class: 'row-sum' }, e.summary) : null,
      meta.length ? h('span', { class: 'row-meta' }, meta) : null));
}

export function groupHeader(title, count, href) {
  return h('h2', { class: 'grp' },
    href ? h('a', { href }, title) : h('span', {}, title),
    h('span', { class: 'grp-n', 'aria-label': `${count} entries` }, String(count)));
}

export function listSection(title, items, { href, rowFn = row } = {}) {
  return h('section', { class: 'grp-box' }, groupHeader(title, items.length, href), h('div', { class: 'list' }, items.map((e) => rowFn(e))));
}

export function fab(label, onclick) {
  return h('button', { class: 'fab', type: 'button', 'aria-label': label, title: label, onclick, html: ICON.plus });
}

export function empty(text, actionLabel, onAction) {
  return h('div', { class: 'empty' },
    h('p', {}, text),
    actionLabel ? h('button', { class: 'btn', type: 'button', onclick: onAction }, actionLabel) : null);
}

export function backupBanner() {
  const last = state.backup.lastAt;
  if (state.entries.size < 3) return null;
  if (last && Date.now() - last < 7 * 86400000) return null;
  if (Number(getPref('backupSnooze', 0)) > Date.now()) return null;
  const box = h('div', { class: 'banner', role: 'status' },
    h('p', {}, last ? `Your last backup was ${relDays(last)}.` : 'You haven’t saved a backup yet.',
      ' Everything lives only on this device, so keep a copy somewhere safe.'),
    h('div', { class: 'banner-actions' },
      h('a', { class: 'btn sm', href: '#/backup' }, 'Save a backup'),
      h('button', {
        class: 'btn ghost sm', type: 'button',
        onclick: () => { setPref('backupSnooze', String(Date.now() + 3 * 86400000)); box.remove(); },
      }, 'Later')));
  return box;
}

// Render stored text with links. [[id]] becomes a link; #Name# becomes a link if the
// name exists, otherwise a dashed "create" link.
export function richText(text, cls = 'prose') {
  const wrap = h('div', { class: cls });
  const paras = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  for (const p of paras) {
    if (!p.trim()) continue;
    const el = h('p');
    p.split('\n').forEach((line, i) => {
      if (i) el.append(h('br'));
      appendInline(el, line);
    });
    wrap.append(el);
  }
  return wrap;
}

function appendInline(el, text) {
  splitTokens(text).forEach((part, i) => {
    if (i % 2 === 1) {
      const t = state.entries.get(part);
      el.append(t ? h('a', { class: 'lk', href: `#/e/${t.id}` }, t.name) : document.createTextNode(''));
      return;
    }
    for (const piece of splitHash(part)) {
      if (piece.link == null) { el.append(piece.text); continue; }
      const hit = findByName(piece.link);
      if (hit) el.append(h('a', { class: 'lk', href: `#/e/${hit.id}` }, hit.name));
      else {
        el.append(h('button', {
          class: 'lk missing', type: 'button', title: `Create “${piece.link}”`,
          onclick: () => createFromMissing(piece.link),
        }, piece.link));
      }
    }
  });
}

export function setPrefill(name) {
  try { sessionStorage.setItem('archive.prefill', name); } catch { /* ignore */ }
}

export function takePrefill() {
  try {
    const v = sessionStorage.getItem('archive.prefill');
    sessionStorage.removeItem('archive.prefill');
    return v || '';
  } catch { return ''; }
}

// Ask what kind of entry a missing link should become, then open the new-entry form.
export async function createFromMissing(name) {
  const choice = await chooseSheet(`Create “${name}”`, 'There’s no entry with this name yet. What is it?', newEntryChoices());
  if (!choice) return;
  setPrefill(name);
  location.hash = choice;
}

export function newEntryChoices() {
  const S = state.settings;
  const out = [];
  for (const f of S.factions) for (const t of f.types) out.push({ value: `#/new/being/${f.id}/${t.id}`, label: t.name, group: f.name });
  for (const pt of S.placeTypes) out.push({ value: `#/new/place/${pt.id}`, label: pt.name, group: 'Places' });
  for (const c of S.loreCategories) out.push({ value: `#/new/lore/${c.id}`, label: c.name, group: 'Lore' });
  for (const t of S.itemTypes) out.push({ value: `#/new/item/${t.id}`, label: t.name, group: 'Items' });
  out.push({ value: '#/new/event', label: 'Event', group: 'History' });
  return out;
}

// Pick one option. Options with a group are shown as compact buttons under group headings.
export function chooseSheet(title, text, options) {
  const grouped = options.some((o) => o.group);
  const button = (o, cls) => h('button', { type: 'button', class: cls, onclick: () => close(o.value) },
    h('span', { class: 'choice-l' }, o.label), o.hint ? h('span', { class: 'choice-h' }, o.hint) : null);
  let close;
  return openSheet((done) => {
    close = done;
    let body;
    if (grouped) {
      const names = [...new Set(options.map((o) => o.group || ''))];
      body = h('div', { class: 'choice-groups' }, names.map((g) => h('section', { class: 'choice-group' },
        g ? h('h3', { class: 'choice-gt' }, g) : null,
        h('div', { class: 'choice-wrap' }, options.filter((o) => (o.group || '') === g).map((o) => button(o, 'choice compact'))))));
    } else {
      body = h('div', { class: 'choices' }, options.map((o) => button(o, 'choice')));
    }
    return [
      h('h2', { class: 'sheet-t' }, title),
      text ? h('p', { class: 'sheet-p' }, text) : null,
      body,
      h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => done(undefined) }, 'Cancel')),
    ];
  }, { label: title });
}

// <select> of every entry you can link to, grouped by faction, places and events.
export function entrySelect(id, value, { none = 'Nothing linked', exclude } = {}) {
  const S = state.settings;
  const sel = h('select', { class: 'in', id });
  sel.append(h('option', { value: '' }, none));
  const add = (label, items) => {
    if (!items.length) return;
    const g = h('optgroup', { label });
    for (const e of items.sort(byName)) g.append(h('option', { value: e.id, selected: e.id === value }, e.name || 'Untitled'));
    sel.append(g);
  };
  const all = [...state.entries.values()].filter((e) => e.id !== exclude);
  for (const f of S.factions) add(f.name, all.filter((e) => e.kind === 'being' && e.faction === f.id));
  add('Places', all.filter((e) => e.kind === 'place'));
  add('Lore', all.filter((e) => e.kind === 'lore'));
  add('Items', all.filter((e) => e.kind === 'item'));
  add('History', all.filter((e) => e.kind === 'event'));
  return sel;
}

export function noun(e) {
  if (e.kind === 'event') return 'event';
  if (e.kind === 'story') return 'story';
  return typeName(e);
}

export function pluralName(name) { return plural(name); }

export function linkButton(e) {
  return h('a', { class: 'inline-link', href: `#/e/${e.id}` }, e.name || 'Untitled');
}

export { iconEl };
