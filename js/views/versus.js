// Versus: compare two entries meter by meter using real power (meter × factor).
import { h, iconEl, fmt, isAuthor } from '../ui.js';
import { state, byName, entriesWhere, meterDefs, meterValues, factorOf, scaleLabel, meterByName } from '../model.js';
import { setTitle, empty } from './parts.js';

export function renderVersus(main, { a, b }) {
  const S = state.settings;
  const author = isAuthor();
  setTitle('Versus');
  const pool = entriesWhere((e) => e.kind === 'being' && meterDefs(e).length > 0).sort(byName);
  if (pool.length < 2) {
    main.append(empty('Add at least two entries with meters to compare them. Kaiju and Slayers have meters from the start.'));
    return;
  }
  const A = state.entries.get(a) || null;
  const B = state.entries.get(b) || null;

  const picker = (id, label, value, other) => {
    const sel = h('select', { class: 'in', id });
    sel.append(h('option', { value: '' }, 'Pick one'));
    for (const f of S.factions) {
      const items = pool.filter((e) => e.faction === f.id);
      if (!items.length) continue;
      const g = h('optgroup', { label: f.name });
      for (const e of items) g.append(h('option', { value: e.id, selected: e.id === value?.id }, e.name || 'Untitled'));
      sel.append(g);
    }
    sel.addEventListener('change', () => {
      const ids = id === 'vs-a' ? [sel.value, other?.id || ''] : [other?.id || '', sel.value];
      location.replace(`#/versus/${ids[0]}/${ids[1]}`);
    });
    return h('div', { class: 'field' }, h('label', { class: 'fl', for: id }, label), sel);
  };

  main.append(h('div', { class: 'vs-pick' },
    picker('vs-a', 'First', A, B),
    h('button', {
      type: 'button', class: 'ib vs-swap', 'aria-label': 'Swap sides', title: 'Swap sides',
      onclick: () => location.replace(`#/versus/${B?.id || ''}/${A?.id || ''}`),
    }, iconEl('swap')),
    picker('vs-b', 'Second', B, A)));

  if (!A || !B) {
    main.append(h('p', { class: 'hint' }, 'Pick two entries to see who wins on paper.'));
    return;
  }

  const fa = factorOf(A);
  const fb = factorOf(B);
  const va = meterValues(A).filter((v) => author || !v.def.hidden);
  const vb = new Map(meterValues(B).filter((v) => author || !v.def.hidden).map((v) => [v.def.name.trim().toLowerCase(), v]));
  const rows = [];
  for (const v of va) {
    const w = vb.get(v.def.name.trim().toLowerCase());
    if (!w || (!v.value && !w.value)) continue;
    rows.push({ name: v.def.name, hidden: v.def.hidden || w.def.hidden, rawA: v.value, rawB: w.value, ra: v.value * fa, rb: w.value * fb });
  }

  const winsA = rows.filter((r) => r.ra > r.rb).length;
  const winsB = rows.filter((r) => r.rb > r.ra).length;
  const totalA = rows.reduce((s, r) => s + r.ra, 0);
  const totalB = rows.reduce((s, r) => s + r.rb, 0);
  let verdict;
  if (!rows.length) verdict = 'These two have no filled-in meters in common, so there’s nothing to compare yet.';
  else if (winsA !== winsB) verdict = `${winsA > winsB ? A.name : B.name} wins on paper, ahead in ${Math.max(winsA, winsB)} of ${rows.length} meters.`;
  else if (totalA !== totalB) verdict = `Even on meters, but ${totalA > totalB ? A.name : B.name} has more total power on paper.`;
  else verdict = 'Too close to call on paper.';

  const side = (e, f) => h('div', { class: 'vs-side' },
    h('span', { class: 'vs-name' }, e.name),
    h('span', { class: 'vs-scale' }, scaleLabel(e) ? `${scaleLabel(e)}, ×${fmt(f)}` : `×${fmt(f)}`));

  main.append(h('section', { class: 'vs-card' },
    h('div', { class: 'vs-head' }, side(A, fa), h('span', { class: 'vs-x', 'aria-hidden': 'true' }, 'vs'), side(B, fb)),
    h('p', { class: 'vs-verdict' }, verdict),
    rows.length ? h('div', { class: 'vs-rows' }, rows.map((r) => {
      const total = r.ra + r.rb || 1;
      return h('div', { class: 'vs-row' + (r.hidden ? ' secret' : '') },
        h('span', { class: 'vs-m' }, r.name),
        h('span', { class: 'vs-v' + (r.ra > r.rb ? ' win' : '') }, fmt(r.ra), h('small', {}, `${fmt(r.rawA)}×${fmt(fa)}`)),
        h('span', { class: 'vs-bar', role: 'img', 'aria-label': `${fmt(r.ra)} against ${fmt(r.rb)}` },
          h('i', { class: 'vs-a', style: `width:${(r.ra / total) * 100}%` }),
          h('i', { class: 'vs-b', style: `width:${(r.rb / total) * 100}%` })),
        h('span', { class: 'vs-v right' + (r.rb > r.ra ? ' win' : '') }, fmt(r.rb), h('small', {}, `${fmt(r.rawB)}×${fmt(fb)}`)));
    })) : null,
    h('p', { class: 'hint' }, 'On paper only: skill, equipment and teamwork aren’t counted.')));

  if (author) {
    const tamer = [A, B].find((x) => x.faction === 'humans' && x.tamer);
    const kaiju = [A, B].find((x) => x.faction === 'kaiju');
    if (tamer && kaiju) {
      const wp = meterByName(tamer, 'Willpower');
      const dom = meterByName(kaiju, 'Dominance');
      const box = h('section', { class: 'sec secret-box' }, h('h2', { class: 'sec-t' }, iconEl('key'), 'Taming check'));
      if (wp == null || dom == null) {
        box.append(h('p', {}, 'The taming check needs a Willpower meter on the Tamer and a Dominance meter on the kaiju. You can set both up in Settings.'));
      } else {
        const rw = wp * factorOf(tamer);
        const rd = dom * factorOf(kaiju);
        box.append(
          h('p', { class: 'vs-verdict' }, rw >= rd ? `${tamer.name} could tame ${kaiju.name} on paper.` : `${kaiju.name} is too dominant for ${tamer.name}.`),
          h('p', {}, `Willpower ${fmt(wp)} × ${fmt(factorOf(tamer))} = ${fmt(rw)}, against Dominance ${fmt(dom)} × ${fmt(factorOf(kaiju))} = ${fmt(rd)}.`));
      }
      main.append(box);
    }
  }
}
