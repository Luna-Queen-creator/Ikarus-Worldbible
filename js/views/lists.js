// Section lists: Places, History (timeline by era) and Stories.
import { h, plural, excerpt, isAuthor } from '../ui.js';
import { state, byId, byName, entriesWhere, plain } from '../model.js';
import { setTitle, row, listSection, fab, empty, backupBanner, chooseSheet } from './parts.js';

export function renderPlaces(main) {
  const S = state.settings;
  setTitle('Places');
  const banner = backupBanner();
  if (banner) main.append(banner);

  const add = () => chooseSheet('Add a place', null, S.placeTypes.map((p) => ({ value: p.id, label: p.name })))
    .then((t) => { if (t) location.hash = `#/new/place/${t}`; });

  const places = entriesWhere((e) => e.kind === 'place');
  if (!places.length) {
    main.append(empty('No places yet. Villages, lairs and ruins all live here.', 'Add a place', add));
    main.append(fab('Add a place', add));
    return;
  }
  const groups = h('div', { class: 'groups' });
  const people = (v) => entriesWhere((x) => x.kind === 'being' && x.village === v.id).length;
  for (const pt of S.placeTypes) {
    const items = places.filter((p) => p.placeType === pt.id).sort(byName);
    if (!items.length) continue;
    groups.append(listSection(plural(pt.name), items, {
      rowFn: (p) => row(p, pt.id === 'village' ? [h('span', { class: 'chip quiet' }, `${people(p)} ${people(p) === 1 ? 'person' : 'people'}`)] : []),
    }));
  }
  const other = places.filter((p) => !byId(S.placeTypes, p.placeType)).sort(byName);
  if (other.length) groups.append(listSection('Other places', other));
  main.append(groups);
  main.append(fab('Add a place', add));
}

// History: a timeline grouped by era. Shows the public version, plus the truth in author mode.
export function renderHistory(main) {
  const S = state.settings;
  const author = isAuthor();
  setTitle('History');
  const banner = backupBanner();
  if (banner) main.append(banner);

  const events = entriesWhere((e) => e.kind === 'event');
  const byYear = (a, b) => {
    const ya = a.year == null || a.year === '' ? Infinity : Number(a.year);
    const yb = b.year == null || b.year === '' ? Infinity : Number(b.year);
    return ya - yb || a.createdAt - b.createdAt;
  };
  if (!events.length) {
    main.append(h('p', { class: 'hint lead-hint' }, 'Your timeline is empty. Add an event to one of the eras below. You can rename eras or add new ones in Settings.'));
  }
  const tl = h('div', { class: 'timeline' });
  const eraIds = new Set(S.eras.map((x) => x.id));
  const block = (title, items, eraId) => h('section', { class: 'era' },
    h('div', { class: 'era-head' },
      h('h2', { class: 'era-t' }, title),
      eraId ? h('a', { class: 'btn ghost sm', href: `#/new/event/${eraId}` }, 'Add event') : null),
    items.length ? h('ol', { class: 'events' }, items.map((ev) => h('li', {},
      h('a', { class: 'ev', href: `#/e/${ev.id}` },
        (ev.when || (ev.year != null && ev.year !== '')) ? h('span', { class: 'ev-when' }, ev.when || `Year ${String(ev.year).replace('-', '−')}`) : null,
        h('span', { class: 'ev-name' }, ev.name || 'Untitled'),
        ev.body ? h('span', { class: 'ev-text' }, excerpt(plain(ev.body), 160)) : null,
        author && ev.truth ? h('span', { class: 'ev-truth' }, h('b', {}, 'Truth: '), excerpt(plain(ev.truth), 120)) : null))))
      : h('p', { class: 'hint era-empty' }, 'No events in this era yet.'));
  for (const era of S.eras) tl.append(block(era.name, events.filter((ev) => ev.era === era.id).sort(byYear), era.id));
  const loose = events.filter((ev) => !eraIds.has(ev.era)).sort(byYear);
  if (loose.length) tl.append(block('No era', loose, null));
  main.append(tl);
  main.append(fab('Add an event', () => { location.hash = '#/new/event'; }));
}

// Stories: short stories with links to the world.
export function renderStories(main) {
  const S = state.settings;
  setTitle('Stories');
  const banner = backupBanner();
  if (banner) main.append(banner);
  const stories = entriesWhere((e) => e.kind === 'story').sort((a, b) => b.updatedAt - a.updatedAt);
  const add = () => { location.hash = '#/new/story'; };
  if (!stories.length) {
    main.append(empty('No stories yet. Write the first one. Links with # work here too.', 'Write a story', add));
    main.append(fab('Write a story', add));
    return;
  }
  main.append(h('div', { class: 'stories' }, stories.map((st) => {
    const era = byId(S.eras, st.era);
    const words = plain(st.body).trim().split(/\s+/).filter(Boolean).length;
    return h('a', { class: 'story-card', href: `#/e/${st.id}` },
      h('span', { class: 'story-t' }, st.name || 'Untitled'),
      h('span', { class: 'story-meta' }, era ? h('span', { class: 'chip quiet' }, era.name) : null, h('span', { class: 'chip quiet' }, `${words} ${words === 1 ? 'word' : 'words'}`)),
      st.summary ? h('span', { class: 'story-sum' }, st.summary) : (st.body ? h('span', { class: 'story-sum' }, excerpt(plain(st.body), 180)) : null));
  })));
  main.append(fab('Write a story', add));
}
