// Search across every entry and story.
import { h, isAuthor } from '../ui.js';
import { search, kindNoun } from '../model.js';
import { setTitle, row } from './parts.js';

export function renderSearch(main) {
  setTitle('Search');
  let q = '';
  try { q = sessionStorage.getItem('archive.q') || ''; } catch { /* ignore */ }
  const input = h('input', { class: 'in search-in', id: 'q', type: 'search', placeholder: 'Names, tags, words in texts', value: q, autocomplete: 'off', 'aria-label': 'Search' });
  const results = h('div', { class: 'results', 'aria-live': 'polite' });
  const run = () => {
    q = input.value;
    try { sessionStorage.setItem('archive.q', q); } catch { /* ignore */ }
    results.replaceChildren();
    if (!q.trim()) {
      results.append(h('p', { class: 'hint' }, isAuthor() ? 'Secrets are searched too while author mode is on.' : 'Turn on author mode to search secrets too.'));
      return;
    }
    const hits = search(q, isAuthor());
    if (!hits.length) { results.append(h('p', { class: 'hint' }, `Nothing matches “${q.trim()}”.`)); return; }
    // Humans and AI rows already name their type; kaiju, places, events and stories get a kind chip.
    const kindChip = (e) => (e.kind !== 'being' || e.faction === 'kaiju' ? [h('span', { class: 'chip quiet' }, kindNoun(e))] : []);
    results.append(h('div', { class: 'list' }, hits.slice(0, 80).map((e) => row(e, kindChip(e)))));
  };
  input.addEventListener('input', run);
  main.append(h('div', { class: 'search-box' }, input), results);
  run();
  setTimeout(() => input.focus(), 50);
}
