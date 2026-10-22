// Lore tab: groups, technology, concepts and everything else that makes the world tick, plus items.
import { h, plural, getPref, setPref } from '../ui.js';
import { state, byId, byName, entriesWhere, membersOf } from '../model.js';
import { setTitle, row, listSection, fab, empty, backupBanner, chooseSheet } from './parts.js';

export function renderLore(main, { seg }) {
  const S = state.settings;
  const part = seg || getPref('loreSeg', 'topics');
  const items = part === 'items';
  setPref('loreSeg', items ? 'items' : 'topics');
  setTitle('Lore');

  const banner = backupBanner();
  if (banner) main.append(banner);

  main.append(h('nav', { class: 'seg', 'aria-label': 'Lore or items' },
    [['#/lore/topics', 'Lore', !items], ['#/lore/items', 'Items', items]].map(([href, label, on]) => h('a', {
      href, class: 'seg-b' + (on ? ' on' : ''), 'aria-current': on ? 'page' : null,
    }, label))));

  if (items) renderItems(main, S);
  else renderTopics(main, S);
}

function memberChip(e) {
  const n = membersOf(e.id).length;
  return h('span', { class: 'chip quiet' }, `${n} ${n === 1 ? 'member' : 'members'}`);
}

function renderTopics(main, S) {
  const add = () => chooseSheet('Add lore', null, S.loreCategories.map((c) => ({ value: c.id, label: c.name })))
    .then((c) => { if (c) location.hash = `#/new/lore/${c}`; });

  const all = entriesWhere((e) => e.kind === 'lore');
  if (!all.length) {
    main.append(empty('No lore yet. Groups like a religion or a slayer faction, technology, customs, beliefs: everything that makes the world tick goes here.', 'Add lore', add));
    main.append(fab('Add lore', add));
    return;
  }
  const groups = h('div', { class: 'groups' });
  for (const c of S.loreCategories) {
    const list = all.filter((e) => e.category === c.id).sort(byName);
    if (!list.length) continue;
    groups.append(listSection(plural(c.name), list, { rowFn: (e) => row(e, c.members ? [memberChip(e)] : []) }));
  }
  const other = all.filter((e) => !byId(S.loreCategories, e.category)).sort(byName);
  if (other.length) groups.append(listSection('Other lore', other));
  main.append(groups);
  main.append(fab('Add lore', add));
}

function renderItems(main, S) {
  const add = () => chooseSheet('Add an item', null, S.itemTypes.map((t) => ({ value: t.id, label: t.name })))
    .then((t) => { if (t) location.hash = `#/new/item/${t}`; });

  const all = entriesWhere((e) => e.kind === 'item');
  if (!all.length) {
    main.append(empty('No items yet. Weapons, armor, tools and anything else worth remembering. Give an item an owner and it shows up on their page.', 'Add an item', add));
    main.append(fab('Add an item', add));
    return;
  }
  const ownerChip = (e) => {
    const o = state.entries.get(e.owner);
    return o ? [h('span', { class: 'chip quiet' }, `Owned by ${o.name}`)] : [];
  };
  const groups = h('div', { class: 'groups' });
  for (const t of S.itemTypes) {
    const list = all.filter((e) => e.itemType === t.id).sort(byName);
    if (list.length) groups.append(listSection(plural(t.name), list, { rowFn: (e) => row(e, ownerChip(e)) }));
  }
  const other = all.filter((e) => !byId(S.itemTypes, e.itemType)).sort(byName);
  if (other.length) groups.append(listSection('Other items', other, { rowFn: (e) => row(e, ownerChip(e)) }));
  main.append(groups);
  main.append(fab('Add an item', add));
}
