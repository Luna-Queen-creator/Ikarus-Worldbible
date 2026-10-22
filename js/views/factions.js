// Factions screen: Humans by village, Kaiju by family/class/element, AI by AI.
import { h, iconEl, getPref, setPref, plural } from '../ui.js';
import { state, byId, byName, entriesWhere, classIndex, rankIndex, meterDefs } from '../model.js';
import { setTitle, row, groupHeader, listSection, fab, empty, backupBanner, chooseSheet } from './parts.js';

export function renderFactions(main, { factionId }) {
  const S = state.settings;
  const f = byId(S.factions, factionId || getPref('faction', '')) || S.factions[0];
  setPref('faction', f.id);
  setTitle('Factions');

  const banner = backupBanner();
  if (banner) main.append(banner);

  const facBar = h('div', { class: 'fac-bar' }, h('nav', { class: 'seg', 'aria-label': 'Factions' }, S.factions.map((x) => h('a', {
    href: `#/factions/${x.id}`, class: 'seg-b' + (x.id === f.id ? ' on' : ''), 'aria-current': x.id === f.id ? 'page' : null,
  }, x.name))));
  main.append(facBar);

  const members = entriesWhere((e) => e.kind === 'being' && e.faction === f.id);
  const tools = h('div', { class: 'tools' });
  main.append(tools);

  const add = () => {
    if (f.types.length === 1) { location.hash = `#/new/being/${f.id}/${f.types[0].id}`; return; }
    chooseSheet(`Add to ${f.name}`, null, f.types.map((t) => ({ value: t.id, label: t.name })))
      .then((t) => { if (t) location.hash = `#/new/being/${f.id}/${t}`; });
  };

  if (!members.length) {
    const intro = {
      humans: 'No humans yet. People are grouped by village, so it helps to add a village in Places first.',
      kaiju: 'No kaiju yet. You can group them by family, class or element once there are a few.',
      ai: 'No AI yet. Add an AI first, then the Shamans who serve it.',
    }[f.id] || `No ${f.name} entries yet. Add the first one.`;
    main.append(empty(intro, `Add to ${f.name}`, add));
    main.append(fab(`Add to ${f.name}`, add));
    return;
  }

  const groups = h('div', { class: 'groups' });
  if (f.id === 'kaiju') {
    const mode = getPref('kaijuGroup', 'family');
    tools.append(h('div', { class: 'seg seg-sm', role: 'group', 'aria-label': 'Group kaiju by' },
      h('span', { class: 'seg-label' }, 'Group by'),
      [['family', 'Family'], ['class', 'Class'], ['element', 'Element']].map(([k, label]) => h('button', {
        type: 'button', class: 'seg-b' + (mode === k ? ' on' : ''), 'aria-pressed': String(mode === k),
        onclick: () => { setPref('kaijuGroup', k); main.replaceChildren(); renderFactions(main, { factionId: f.id }); },
      }, label))));
    kaijuGroups(groups, members, mode);
  } else if (f.id === 'humans') {
    humanGroups(groups, members, f);
  } else if (f.id === 'ai') {
    aiGroups(groups, members, f);
  } else {
    for (const t of f.types) {
      const items = members.filter((m) => m.type === t.id).sort(byName);
      if (items.length) groups.append(listSection(plural(t.name), items));
    }
    const other = members.filter((m) => !byId(f.types, m.type));
    if (other.length) groups.append(listSection('Other', other.sort(byName)));
  }
  const hasMeters = (e) => meterDefs(e).length > 0;
  if (members.some(hasMeters) && entriesWhere((e) => e.kind === 'being' && hasMeters(e)).length >= 2) {
    facBar.append(h('a', { class: 'btn ghost sm vs-link', href: '#/versus' }, iconEl('swords'), 'Versus'));
  }

  main.append(groups);
  main.append(fab(`Add to ${f.name}`, add));
}

const byClassThenName = (a, b) => classIndex(b) - classIndex(a) || byName(a, b);

function kaijuGroups(root, members, mode) {
  const S = state.settings;
  if (mode === 'class') {
    for (const c of [...S.classes].reverse()) {
      const items = members.filter((k) => k.kclass === c.id).sort(byName);
      if (items.length) root.append(listSection(`${c.name} class`, items));
    }
    const none = members.filter((k) => !byId(S.classes, k.kclass));
    if (none.length) root.append(listSection('No class yet', none.sort(byName)));
    return;
  }
  if (mode === 'element') {
    for (const el of S.elements) {
      const items = members.filter((k) => (k.elements || []).includes(el.id)).sort(byClassThenName);
      if (items.length) root.append(listSection(el.name, items));
    }
    const none = members.filter((k) => !(k.elements || []).some((id) => byId(S.elements, id)));
    if (none.length) root.append(listSection('No element yet', none.sort(byClassThenName)));
    return;
  }
  for (const fam of S.families) {
    const items = members.filter((k) => k.family === fam.id).sort(byClassThenName);
    if (items.length) root.append(listSection(`${fam.name} family`, items));
  }
  const none = members.filter((k) => !byId(S.families, k.family));
  if (none.length) root.append(listSection('No family yet', none.sort(byClassThenName)));
}

function peopleBlock(people, f) {
  const out = [];
  for (const t of f.types) {
    const ps = people.filter((p) => p.type === t.id);
    if (!ps.length) continue;
    if (t.id === 'slayer') ps.sort((a, b) => rankIndex(b) - rankIndex(a) || byName(a, b));
    else ps.sort(byName);
    out.push(h('h3', { class: 'sub' }, plural(t.name), h('span', { class: 'grp-n' }, String(ps.length))));
    out.push(h('div', { class: 'list' }, ps.map((p) => row(p))));
  }
  const other = people.filter((p) => !byId(f.types, p.type));
  if (other.length) out.push(h('div', { class: 'list' }, other.sort(byName).map((p) => row(p))));
  return out;
}

function humanGroups(root, members, f) {
  const villages = entriesWhere((e) => e.kind === 'place' && e.placeType === 'village').sort(byName);
  for (const v of villages) {
    const ps = members.filter((p) => p.village === v.id);
    if (!ps.length) continue;
    root.append(h('section', { class: 'grp-box' }, groupHeader(v.name, ps.length, `#/e/${v.id}`), peopleBlock(ps, f)));
  }
  const loose = members.filter((p) => !villages.some((v) => v.id === p.village));
  if (loose.length) root.append(h('section', { class: 'grp-box' }, groupHeader('Without a village', loose.length), peopleBlock(loose, f)));
}

function aiGroups(root, members, f) {
  const ais = members.filter((m) => m.type === 'ai').sort(byName);
  for (const ai of ais) {
    const belong = members.filter((m) => m.type !== 'ai' && m.parentAi === ai.id);
    const kids = [];
    for (const t of f.types) {
      if (t.id === 'ai') continue;
      const items = belong.filter((m) => m.type === t.id).sort(byName);
      if (!items.length) continue;
      kids.push(h('h3', { class: 'sub' }, plural(t.name), h('span', { class: 'grp-n' }, String(items.length))));
      kids.push(h('div', { class: 'list' }, items.map((m) => row(m))));
    }
    root.append(h('section', { class: 'grp-box' },
      groupHeader(ai.name, belong.length, `#/e/${ai.id}`),
      h('div', { class: 'list lead' }, row(ai)),
      kids));
  }
  const loose = members.filter((m) => m.type !== 'ai' && !ais.some((a) => a.id === m.parentAi));
  if (loose.length) root.append(listSection('Not assigned to an AI', loose.sort(byName)));
}
