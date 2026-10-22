// Entry page: the full record for a kaiju, human, AI, place, event or story.
import { h, iconEl, imgFor, openSheet, confirmSheet, toast, fmt, isAuthor } from '../ui.js';
import {
  state, byId, byName, typeName, factorOf, scaleLabel, meterValues, meterDefs, meterMax, formulaText,
  backlinksOf, linkIds, deleteEntry, entriesWhere, canHaveMembers, membersOf,
} from '../model.js';
import { setTitle, glyph, classChip, elementChips, rankChip, row, richText, empty, linkButton } from './parts.js';

export function sectionHref(e) {
  if (e.kind === 'being') return `#/factions/${e.faction}`;
  if (e.kind === 'place') return '#/places';
  if (e.kind === 'lore') return '#/lore/topics';
  if (e.kind === 'item') return '#/lore/items';
  if (e.kind === 'event') return '#/history';
  return '#/stories';
}

function titleFor(e) {
  if (e.kind === 'being') return state.settings.factions.find((f) => f.id === e.faction)?.name || 'Entry';
  if (e.kind === 'place') return 'Place';
  if (e.kind === 'lore') return 'Lore';
  if (e.kind === 'item') return 'Item';
  if (e.kind === 'event') return 'History';
  return 'Story';
}

export function renderEntry(main, { id }) {
  const e = state.entries.get(id);
  if (!e) {
    setTitle('Not found');
    main.append(empty('This entry doesn’t exist anymore.', 'Go to Factions', () => { location.hash = '#/factions'; }));
    return;
  }
  const author = isAuthor();
  const S = state.settings;
  setTitle(titleFor(e));

  const art = h('article', { class: 'entry kind-' + e.kind });

  // ---- plate ----
  const plate = h('header', { class: 'plate' });
  if (e.images && e.images.length) {
    plate.append(h('button', { class: 'cover', type: 'button', 'aria-label': 'Open image', onclick: () => viewImages(e, 0) }, imgFor(e.images[0], e.name)));
  }
  const ident = h('div', { class: 'ident' });
  if (e.faction === 'kaiju') {
    const c = byId(S.classes, e.kclass);
    const el = byId(S.elements, (e.elements || [])[0]);
    ident.append(h('span', { class: 'medal', style: el ? `--ring:${el.color}` : null, title: c ? `${c.name} class` : 'No class' },
      h('span', { class: 'gl', 'aria-hidden': 'true' }, c ? glyph(c) : '?')));
  } else if (e.type === 'slayer') {
    const r = byId(S.ranks, e.rank);
    if (r) ident.append(h('span', { class: 'belt-big', style: `--c:${r.color}`, title: `${r.name} Slayer` }));
  }
  ident.append(h('h1', { class: 'e-name' }, e.name || 'Untitled'));
  plate.append(ident);

  const chips = [];
  if (e.kind === 'being') {
    if (e.faction === 'kaiju') {
      const cc = classChip(e);
      if (cc) chips.push(cc);
      chips.push(...elementChips(e));
    } else if (e.type === 'slayer') {
      const rc = rankChip(e);
      if (rc) chips.push(rc);
    } else chips.push(h('span', { class: 'chip quiet' }, typeName(e)));
    if (e.tamer && author) chips.push(h('span', { class: 'chip secret' }, 'Tamer'));
  } else if (e.kind === 'place' || e.kind === 'lore' || e.kind === 'item') chips.push(h('span', { class: 'chip quiet' }, typeName(e)));
  else {
    const era = byId(S.eras, e.era);
    if (era) chips.push(h('span', { class: 'chip quiet' }, era.name));
    if (e.kind === 'event' && e.when) chips.push(h('span', { class: 'chip quiet' }, e.when));
  }
  if (chips.length) plate.append(h('div', { class: 'chips' }, chips));
  if (e.summary) plate.append(h('p', { class: 'e-sum' }, e.summary));
  if (e.tags && e.tags.length) plate.append(h('div', { class: 'tags' }, e.tags.map((t) => h('span', { class: 'tag' }, t))));
  art.append(plate);

  const hasMeters = meterDefs(e).length > 0;
  art.append(h('div', { class: 'actions' },
    h('a', { class: 'btn', href: `#/edit/${e.id}` }, iconEl('edit'), 'Edit'),
    hasMeters ? h('a', { class: 'btn ghost', href: `#/versus/${e.id}` }, iconEl('swords'), 'Compare') : null));

  // ---- facts ----
  const facts = [];
  const fact = (label, ...value) => facts.push(h('div', { class: 'fact' }, h('dt', {}, label), h('dd', {}, value)));
  if (e.kind === 'being' && e.faction === 'kaiju') {
    const fam = byId(S.families, e.family);
    if (fam) fact('Family', fam.name);
    const c = byId(S.classes, e.kclass);
    if (c) fact('Power scale', `×${fmt(c.factor)} (${c.name} class)`);
    const sin = byId(S.sins, e.sin);
    if (sin && e.kclass === 'god') fact('Sin', sin.name);
  }
  if (e.kind === 'being' && e.faction === 'humans') {
    fact('Type', typeName(e));
    const v = state.entries.get(e.village);
    fact('Village', v ? linkButton(v) : 'None yet');
    if (e.type === 'slayer') {
      const r = byId(S.ranks, e.rank);
      if (r) {
        fact('Power scale', `×${fmt(r.factor)} (${r.name} Slayer${r.note ? `, ${r.note.toLowerCase()}` : ''})`);
        // The strongest kaiju class this rank can beat alone: class factor at or below the rank factor.
        const solo = S.classes.filter((c) => Number(c.factor) <= Number(r.factor))
          .sort((x, y) => Number(y.factor) - Number(x.factor))[0];
        fact('Hunts alone', solo ? `Up to ${solo.name} class` : 'Not on their own yet');
      }
    }
    if (e.tamer && author) fact('Tamer', h('span', { class: 'secret-text' }, 'Yes. Carries the ancient nanites, even if they don’t know it.'));
    if (e.mutations && e.mutations.length) fact('Mutations', h('ul', { class: 'plain-list' }, e.mutations.map((m) => h('li', {}, m))));
  }
  if (e.kind === 'being' && e.faction === 'ai') {
    fact('Type', typeName(e));
    if (e.type !== 'ai') {
      const p = state.entries.get(e.parentAi);
      fact('Belongs to', p ? linkButton(p) : 'No AI yet');
    }
  }
  if (e.kind === 'being' && !['kaiju', 'humans', 'ai'].includes(e.faction)) fact('Type', typeName(e));
  if (e.kind === 'being') {
    const groups = (e.groups || []).map((g) => state.entries.get(g)).filter(canHaveMembers).sort(byName);
    if (groups.length) fact('Member of', groups.flatMap((g, i) => (i ? [', ', linkButton(g)] : [linkButton(g)])));
  }
  if (e.kind === 'item') {
    const owner = state.entries.get(e.owner);
    if (owner) fact('Owner', linkButton(owner));
  }
  if (e.kind === 'event' && e.year != null && e.year !== '') fact('Year', String(e.year).replace('-', '−'));
  if (facts.length) art.append(h('dl', { class: 'facts' }, facts));

  // ---- meters ----
  const vals = meterValues(e).filter((v) => author || !v.def.hidden);
  if (vals.length) {
    const factor = factorOf(e);
    const defs = meterDefs(e);
    art.append(h('section', { class: 'sec' },
      h('h2', { class: 'sec-t' }, 'Meters'),
      h('div', { class: 'meters' }, vals.map((v) => meterRow(v, factor, defs))),
      factor !== 1 ? h('p', { class: 'hint' }, `Real power is the meter times ${fmt(factor)} for a ${scaleLabel(e)}.`) : null));
  }

  // ---- text ----
  if (e.kind === 'story') {
    if (e.body) art.append(richText(e.body, 'prose story'));
    else art.append(h('p', { class: 'hint' }, 'This story is still empty.'));
  } else if (e.kind === 'event') {
    if (e.body) art.append(h('section', { class: 'sec' }, h('h2', { class: 'sec-t' }, 'What people believe'), richText(e.body)));
    if (author && e.truth) art.append(h('section', { class: 'sec secret-box' }, h('h2', { class: 'sec-t' }, iconEl('key'), 'What really happened'), richText(e.truth)));
  } else if (e.body) {
    art.append(h('section', { class: 'sec' }, h('h2', { class: 'sec-t' }, 'Description'), richText(e.body)));
  }
  if (author && e.secret) {
    art.append(h('section', { class: 'sec secret-box' }, h('h2', { class: 'sec-t' }, iconEl('key'), 'Secret note'), richText(e.secret)));
  }

  // ---- related ----
  if (e.kind === 'place' && e.placeType === 'village') {
    const people = entriesWhere((x) => x.kind === 'being' && x.village === e.id).sort(byName);
    art.append(h('section', { class: 'sec' },
      h('h2', { class: 'sec-t' }, `People of ${e.name}`),
      people.length ? h('div', { class: 'list' }, people.map((p) => row(p))) : h('p', { class: 'hint' }, 'No one lives here yet. Pick this village when you add a human.')));
  }
  if (e.kind === 'being' && e.type === 'ai') {
    const kids = entriesWhere((x) => x.kind === 'being' && x.parentAi === e.id).sort(byName);
    if (kids.length) art.append(h('section', { class: 'sec' }, h('h2', { class: 'sec-t' }, `Serving ${e.name}`), h('div', { class: 'list' }, kids.map((p) => row(p)))));
  }
  if (canHaveMembers(e)) {
    const members = membersOf(e.id).sort(byName);
    art.append(h('section', { class: 'sec' },
      h('h2', { class: 'sec-t' }, members.length ? `Members (${members.length})` : 'Members'),
      members.length
        ? h('div', { class: 'list' }, members.map((m) => row(m)))
        : h('p', { class: 'hint' }, 'No members yet. Open someone’s edit page and pick this under “Member of”.')));
  }
  if (e.kind === 'being') {
    const gear = entriesWhere((x) => x.kind === 'item' && x.owner === e.id).sort(byName);
    if (gear.length) {
      art.append(h('section', { class: 'sec' }, h('h2', { class: 'sec-t' }, 'Gear'),
        h('div', { class: 'list' }, gear.map((g) => row(g, [h('span', { class: 'chip quiet' }, typeName(g))])))));
    }
  }
  if (e.kind === 'story') {
    const mentioned = [...linkIds(e.body)].map((x) => state.entries.get(x)).filter(Boolean).sort(byName);
    if (mentioned.length) art.append(h('section', { class: 'sec' }, h('h2', { class: 'sec-t' }, 'Mentioned in this story'), h('div', { class: 'list' }, mentioned.map((m) => row(m)))));
  }
  const back = backlinksOf(e.id, author);
  if (back.length) {
    art.append(h('section', { class: 'sec' },
      h('h2', { class: 'sec-t' }, 'Linked from'),
      h('div', { class: 'list' }, back.map(({ entry, secret }) => row(entry, secret ? [h('span', { class: 'chip secret' }, 'in a secret')] : [])))));
  }

  if (e.images && e.images.length > 1) {
    art.append(h('section', { class: 'sec' },
      h('h2', { class: 'sec-t' }, 'Images'),
      h('div', { class: 'gallery' }, e.images.map((bid, i) => h('button', { type: 'button', class: 'g-cell', 'aria-label': `Open image ${i + 1}`, onclick: () => viewImages(e, i) }, imgFor(bid, ''))))));
  }

  art.append(h('div', { class: 'danger-zone' }, h('button', {
    type: 'button', class: 'btn ghost danger',
    onclick: async () => {
      const ok = await confirmSheet({ title: `Delete ${e.name || 'this entry'}?`, text: 'Its images go too. Links to it in other texts turn into plain words.' });
      if (!ok) return;
      const target = sectionHref(e);
      await deleteEntry(e.id);
      toast('Deleted');
      location.replace(target);
    },
  }, iconEl('trash'), 'Delete')));

  main.append(art);
}

function meterRow(v, factor, defs) {
  const calc = v.def.mode === 'calc';
  const max = meterMax(v.def, defs);
  const cells = 10;
  const filled = max ? Math.round(Math.min(1, v.value / max) * cells) : 0;
  return h('div', { class: 'meter' + (v.def.hidden ? ' secret' : '') + (calc ? ' calc' : '') },
    h('span', { class: 'm-name' }, v.def.name, calc ? h('span', { class: 'm-sub' }, formulaText(v.def, defs)) : null),
    h('span', { class: 'bar', role: 'img', 'aria-label': `${fmt(v.value)} out of ${fmt(max)}` },
      Array.from({ length: cells }, (_, i) => h('i', { class: i < filled ? 'on' : '' }))),
    h('span', { class: 'm-val' }, v.value ? fmt(v.value) : '–'),
    factor !== 1 ? h('span', { class: 'm-real', title: 'Real power' }, v.value ? fmt(v.value * factor) : '') : null);
}

export function viewImages(e, start) {
  let i = start;
  openSheet((close) => {
    const holder = h('div', { class: 'viewer' });
    const count = h('span', { class: 'viewer-n' });
    const draw = () => {
      holder.replaceChildren(imgFor(e.images[i], e.name));
      count.textContent = `${i + 1} of ${e.images.length}`;
    };
    draw();
    const nav = e.images.length > 1 ? h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { i = (i - 1 + e.images.length) % e.images.length; draw(); } }, 'Previous'),
      count,
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { i = (i + 1) % e.images.length; draw(); } }, 'Next')) : null;
    return [holder, nav, h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Close'))];
  }, { label: 'Image' });
}
