// Create and edit form for every kind of entry.
import { h, iconEl, imgFor, toast, confirmSheet, openSheet, isAuthor, fmt, ICON, navState } from '../ui.js';
import {
  state, byId, byName, newEntry, saveEntry, addImage, deleteBlob, meterDefs, meterValues, formulaText,
  toEditable, fromEditable, entriesWhere, canHaveMembers,
} from '../model.js';
import { linkEditor, hide as hideSuggest } from '../editor.js';
import { setTitle, takePrefill, noun, empty } from './parts.js';

function makeNew({ kind, a, b }) {
  const S = state.settings;
  const name = takePrefill();
  if (kind === 'being') {
    const f = byId(S.factions, a) || S.factions[0];
    const t = byId(f.types, b) || f.types[0];
    const e = newEntry('being', { faction: f.id, type: t ? t.id : null, name, groups: [] });
    if (f.id === 'kaiju') Object.assign(e, { family: null, kclass: null, elements: [], sin: null });
    if (f.id === 'humans') Object.assign(e, { village: null, rank: t && t.id === 'slayer' ? (S.ranks[0]?.id || null) : null, mutations: [], tamer: false });
    if (f.id === 'ai') e.parentAi = null;
    return e;
  }
  if (kind === 'place') return newEntry('place', { placeType: (byId(S.placeTypes, a) || S.placeTypes[0])?.id || null, name });
  if (kind === 'lore') return newEntry('lore', { category: (byId(S.loreCategories, a) || S.loreCategories[0])?.id || null, name });
  if (kind === 'item') return newEntry('item', { itemType: (byId(S.itemTypes, a) || S.itemTypes[0])?.id || null, owner: null, name });
  if (kind === 'event') return newEntry('event', { era: (byId(S.eras, a) || S.eras[S.eras.length - 1])?.id || null, year: null, when: '', truth: '', name });
  return newEntry('story', { era: null, name });
}

function parseTags(v) {
  const seen = new Set();
  const out = [];
  for (const t of String(v || '').split(',')) {
    const x = t.trim();
    if (!x || seen.has(x.toLowerCase())) continue;
    seen.add(x.toLowerCase());
    out.push(x);
  }
  return out;
}

export function askName(title, label, action = 'Create') {
  return openSheet((close) => {
    const inp = h('input', { class: 'in', id: 'ask-name', maxlength: '80', autocomplete: 'off' });
    const go = () => {
      const v = inp.value.replace(/#/g, '').trim();
      if (v) close(v); else inp.focus();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    setTimeout(() => inp.focus(), 60);
    return [
      h('h2', { class: 'sheet-t' }, title),
      h('div', { class: 'field' }, h('label', { class: 'fl', for: 'ask-name' }, label), inp),
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'btn ghost', onclick: () => close(undefined) }, 'Cancel'),
        h('button', { type: 'button', class: 'btn', onclick: go }, action)),
    ];
  }, { label: title });
}

export function renderEdit(main, params) {
  const S = state.settings;
  const author = isAuthor();
  const isNew = !params.id;
  let original = null;
  let draft;
  if (params.id) {
    original = state.entries.get(params.id);
    if (!original) {
      setTitle('Not found');
      main.append(empty('This entry doesn’t exist anymore.', 'Go to Factions', () => { location.hash = '#/factions'; }));
      return;
    }
    draft = structuredClone(original);
  } else {
    draft = makeNew(params);
  }
  draft.meters = draft.meters || {};
  draft.tags = draft.tags || [];
  draft.images = draft.images || [];

  const session = new Map();
  const texts = {
    body: toEditable(draft.body, session),
    truth: toEditable(draft.truth, session),
    secret: toEditable(draft.secret, session),
  };
  let tagsText = draft.tags.join(', ');
  let mutationsText = (draft.mutations || []).join('\n');
  const newBlobs = [];
  const removedBlobs = [];
  let dirty = false;
  let finished = false;
  let saving = false;
  let refreshCalcs = () => {};
  const touch = () => { dirty = true; };

  setTitle(`${isNew ? 'New' : 'Edit'} ${noun(draft)}`);

  const form = h('form', { class: 'edit', novalidate: true, onsubmit: (ev) => { ev.preventDefault(); save(); } });
  main.append(form);

  // Leaving without saving: images added in this session are thrown away again.
  navState.guard = {
    dirty: () => dirty && !finished,
    leave: async () => {
      if (finished) return;
      finished = true;
      hideSuggest();
      for (const b of newBlobs) await deleteBlob(b).catch(() => {});
      newBlobs.length = 0;
    },
  };

  build();
  if (isNew && !draft.name) setTimeout(() => form.querySelector('#f-name')?.focus(), 80);

  function build() {
    const y = window.scrollY;
    form.replaceChildren(...fields(), footer());
    window.scrollTo(0, y);
  }

  // ---------- small controls ----------
  function field(label, id, control, hint) {
    return h('div', { class: 'field' }, h('label', { class: 'fl', for: id }, label), control, hint ? h('p', { class: 'hint' }, hint) : null);
  }

  function input(id, value, oninput, attrs = {}) {
    const el = h('input', { class: 'in', id, value: value == null ? '' : String(value), ...attrs });
    el.addEventListener('input', () => { oninput(el.value); touch(); });
    return el;
  }

  function textarea(id, value, oninput, rows) {
    const el = h('textarea', { class: 'in', id, rows: String(rows) });
    el.value = value || '';
    el.addEventListener('input', () => { oninput(el.value); touch(); });
    return el;
  }

  function select(id, options, value, onchange, { none, label, extra } = {}) {
    const sel = h('select', { class: 'in', id });
    if (none != null) sel.append(h('option', { value: '' }, none));
    for (const o of options) sel.append(h('option', { value: o.id, selected: o.id === value }, label ? label(o) : (o.name || 'Untitled')));
    for (const o of extra || []) sel.append(h('option', { value: o.id }, o.name));
    sel.addEventListener('change', () => { touch(); onchange(sel.value || null); });
    return sel;
  }

  function checkField(label, id, checked, onchange, hint) {
    const cb = h('input', { type: 'checkbox', id, class: 'cb', checked });
    cb.addEventListener('change', () => { onchange(cb.checked); touch(); });
    return h('div', { class: 'field check' }, cb,
      h('label', { for: id }, h('span', { class: 'cb-l' }, label), hint ? h('span', { class: 'hint' }, hint) : null));
  }

  function textField(label, key, rows, secret = false) {
    const id = 'f-' + key;
    const ta = linkEditor({
      value: texts[key], rows, session, selfId: draft.id, id,
      placeholder: key === 'body' ? 'Type # to link to another entry.' : '',
      onInput: (v) => { texts[key] = v; touch(); },
    });
    return h('div', { class: 'field' + (secret ? ' secret-field' : '') },
      h('label', { class: 'fl', for: id }, secret ? iconEl('key') : null, label),
      ta,
      key === 'body' ? h('p', { class: 'hint' }, 'Type # to pick an entry to link. Writing #Name# yourself works too.') : null);
  }

  // ---------- fields ----------
  function fields() {
    const out = [];
    out.push(field(draft.kind === 'story' ? 'Title' : 'Name', 'f-name',
      input('f-name', draft.name, (v) => { draft.name = v; }, { maxlength: '80', autocomplete: 'off', required: true })));

    if (draft.kind === 'being') out.push(...beingFields());
    if (draft.kind === 'place') {
      out.push(field('Type of place', 'f-ptype', select('f-ptype', S.placeTypes, draft.placeType, (v) => { draft.placeType = v; })));
    }
    if (draft.kind === 'lore') {
      out.push(field('Category', 'f-cat', select('f-cat', S.loreCategories, draft.category, (v) => { draft.category = v; }),
        'People and creatures can join a group from their own edit page.'));
    }
    if (draft.kind === 'item') {
      out.push(field('Type of item', 'f-itype', select('f-itype', S.itemTypes, draft.itemType, (v) => { draft.itemType = v; })));
      out.push(field('Owner', 'f-owner', ownerSelect(), 'The item shows up as gear on its owner’s page.'));
    }
    if (draft.kind === 'event') {
      out.push(field('Era', 'f-era', select('f-era', S.eras, draft.era, (v) => { draft.era = v; }, { none: 'No era' })));
      out.push(h('div', { class: 'two' },
        field('When', 'f-when', input('f-when', draft.when, (v) => { draft.when = v; }, { placeholder: 'Year 12 after the Fall', maxlength: '60', autocomplete: 'off' })),
        field('Year number', 'f-year', input('f-year', draft.year ?? '', (v) => { draft.year = v === '' ? null : Number(v); }, { type: 'number', inputmode: 'numeric', step: '1' }), 'Only used to sort the timeline.')));
    }
    if (draft.kind === 'story') {
      out.push(field('Era', 'f-era', select('f-era', S.eras, draft.era, (v) => { draft.era = v; }, { none: 'No era' })));
    }

    out.push(field(draft.kind === 'story' ? 'Short description' : 'Summary', 'f-sum',
      input('f-sum', draft.summary, (v) => { draft.summary = v; }, { maxlength: '200', autocomplete: 'off' })));
    out.push(field('Tags', 'f-tags',
      input('f-tags', tagsText, (v) => { tagsText = v; draft.tags = parseTags(v); refreshCalcs(); }, { autocomplete: 'off', placeholder: 'Proud, ancient' }),
      'Separate tags with commas. Some tags give meter bonuses.'));

    if (draft.kind === 'being') out.push(metersSection());
    out.push(imagesSection());

    const bodyLabel = { event: 'What people believe', story: 'Story' }[draft.kind] || 'Description';
    out.push(textField(bodyLabel, 'body', draft.kind === 'story' ? 16 : 8));
    if (draft.kind === 'event') {
      if (author) out.push(textField('What really happened', 'truth', 6, true));
      else if (texts.truth.trim()) out.push(h('p', { class: 'hint secret-hint' }, 'This event has a true version. Turn on author mode to see it.'));
    }
    if (author) out.push(textField('Secret note', 'secret', 4, true));
    else if (texts.secret.trim()) out.push(h('p', { class: 'hint secret-hint' }, 'This entry has a secret note. Turn on author mode to see it.'));
    return out;
  }

  function beingFields() {
    const out = [];
    const f = byId(S.factions, draft.faction);
    if (f && f.types.length > 1) {
      out.push(field('Type', 'f-type', select('f-type', f.types, draft.type, (v) => {
        draft.type = v;
        if (draft.faction === 'humans' && v === 'slayer' && !draft.rank) draft.rank = S.ranks[0]?.id || null;
        build();
      })));
    }
    if (draft.faction === 'kaiju') {
      out.push(h('div', { class: 'two' },
        field('Family', 'f-fam', select('f-fam', S.families, draft.family, (v) => { draft.family = v; }, { none: 'No family yet' })),
        field('Class', 'f-class', select('f-class', S.classes, draft.kclass, (v) => { draft.kclass = v; build(); }, { none: 'No class yet', label: (c) => `${c.glyph} ${c.name}` }))));
      out.push(elementsField());
      if (draft.kclass === 'god') out.push(field('Sin', 'f-sin', select('f-sin', S.sins, draft.sin, (v) => { draft.sin = v; }, { none: 'None' })));
    }
    if (draft.faction === 'humans') {
      out.push(villageField());
      if (draft.type === 'slayer') {
        out.push(field('Rank', 'f-rank', select('f-rank', S.ranks, draft.rank, (v) => { draft.rank = v; }, { label: (r) => `${r.name}${r.note ? ` (${r.note})` : ''}` })));
      }
      // Tamers don't know what they are, so it's a secret like hidden meters.
      if (author) {
        const tf = checkField('Tamer', 'f-tamer', !!draft.tamer, (v) => { draft.tamer = v; }, 'Carries the ancient nanites. Only shows in author mode.');
        tf.classList.add('secret-field');
        out.push(tf);
      }
      out.push(field('Mutations', 'f-mut',
        textarea('f-mut', mutationsText, (v) => { mutationsText = v; draft.mutations = v.split('\n').map((x) => x.trim()).filter(Boolean); }, 3),
        'One per line.'));
    }
    if (draft.faction === 'ai' && draft.type !== 'ai') {
      const ais = entriesWhere((x) => x.kind === 'being' && x.type === 'ai').sort(byName);
      out.push(field('Belongs to', 'f-parent', select('f-parent', ais, draft.parentAi, (v) => { draft.parentAi = v; }, { none: ais.length ? 'No AI' : 'No AI entries yet' })));
    }
    const groupsField = membershipField();
    if (groupsField) out.push(groupsField);
    return out;
  }

  // Groups from the Lore tab (like a religion or a slayer faction) this being belongs to.
  function membershipField() {
    const groups = entriesWhere((x) => canHaveMembers(x)).sort(byName);
    if (!groups.length) return null;
    const mine = draft.groups || (draft.groups = []);
    const wrap = h('div', { class: 'toggles', role: 'group', 'aria-labelledby': 'lbl-groups' });
    for (const g of groups) {
      const on = mine.includes(g.id);
      wrap.append(h('button', {
        type: 'button', class: 'toggle' + (on ? ' on' : ''), 'aria-pressed': String(on),
        onclick: (ev) => {
          const i = mine.indexOf(g.id);
          if (i >= 0) mine.splice(i, 1); else mine.push(g.id);
          const b = ev.currentTarget;
          b.classList.toggle('on', i < 0);
          b.setAttribute('aria-pressed', String(i < 0));
          touch();
        },
      }, g.name || 'Untitled'));
    }
    return h('div', { class: 'field' }, h('span', { class: 'fl', id: 'lbl-groups' }, 'Member of'), wrap,
      h('p', { class: 'hint' }, 'Groups come from the Lore tab.'));
  }

  function ownerSelect() {
    const sel = h('select', { class: 'in', id: 'f-owner' });
    sel.append(h('option', { value: '' }, 'No owner'));
    for (const f of S.factions) {
      const beings = entriesWhere((x) => x.kind === 'being' && x.faction === f.id).sort(byName);
      if (!beings.length) continue;
      const g = h('optgroup', { label: f.name });
      for (const b of beings) g.append(h('option', { value: b.id, selected: b.id === draft.owner }, b.name || 'Untitled'));
      sel.append(g);
    }
    sel.addEventListener('change', () => { draft.owner = sel.value || null; touch(); });
    return sel;
  }

  function elementsField() {
    const wrap = h('div', { class: 'toggles', role: 'group', 'aria-labelledby': 'lbl-el' });
    for (const el of S.elements) {
      const on = (draft.elements || []).includes(el.id);
      wrap.append(h('button', {
        type: 'button', class: 'toggle' + (on ? ' on' : ''), 'aria-pressed': String(on),
        onclick: (ev) => {
          const list = draft.elements || (draft.elements = []);
          const i = list.indexOf(el.id);
          if (i >= 0) list.splice(i, 1); else list.push(el.id);
          const b = ev.currentTarget;
          b.classList.toggle('on', i < 0);
          b.setAttribute('aria-pressed', String(i < 0));
          touch();
        },
      }, h('i', { class: 'dot', style: `--c:${el.color}` }), el.name));
    }
    return h('div', { class: 'field' }, h('span', { class: 'fl', id: 'lbl-el' }, 'Elements'), wrap, h('p', { class: 'hint' }, 'Pick one or more.'));
  }

  function villageField() {
    const villages = entriesWhere((x) => x.kind === 'place' && x.placeType === 'village').sort(byName);
    const sel = select('f-village', villages, draft.village, async (v) => {
      if (v !== '__new') { draft.village = v; return; }
      const name = await askName('New village', 'Village name');
      if (name) {
        const typeId = byId(S.placeTypes, 'village')?.id || S.placeTypes[0]?.id || null;
        const place = newEntry('place', { placeType: typeId, name });
        try {
          await saveEntry(place, { isNew: true });
          draft.village = place.id;
          toast(`${name} added to Places`);
        } catch {
          toast('Couldn’t create the village. Try again.');
        }
      }
      build();
    }, { none: 'No village', extra: [{ id: '__new', name: '+ New village…' }] });
    return field('Village', 'f-village', sel);
  }

  function metersSection() {
    const defs = meterDefs(draft);
    const sec = h('fieldset', { class: 'field meters-edit' }, h('legend', { class: 'fl' }, 'Meters'));
    if (!defs.length) {
      refreshCalcs = () => {};
      sec.append(h('p', { class: 'hint' }, 'This type has no meters yet. Add some in Settings.'));
      return sec;
    }
    const outs = new Map();
    for (const d of defs) {
      if (d.hidden && !author) continue;
      if (d.mode === 'calc') {
        const o = h('output', { class: 'm-out' });
        outs.set(d.id, o);
        sec.append(h('div', { class: 'm-row calc' + (d.hidden ? ' secret' : '') },
          h('span', { class: 'm-name' }, d.name, h('span', { class: 'm-sub' }, formulaText(d, defs))),
          h('span', { class: 'm-auto' }, 'calculated'),
          o));
        continue;
      }
      const id = 'm-' + d.id;
      const v = Math.max(0, Math.min(10, Number(draft.meters[d.id]) || 0));
      const out = h('output', { class: 'm-out', for: id }, v ? String(v) : '–');
      const rng = h('input', { type: 'range', class: 'rng', id, min: '0', max: '10', step: '1', value: String(v), 'aria-valuetext': v ? String(v) : 'not set' });
      rng.addEventListener('input', () => {
        const n = Number(rng.value);
        draft.meters[d.id] = n;
        out.textContent = n ? String(n) : '–';
        rng.setAttribute('aria-valuetext', n ? String(n) : 'not set');
        touch();
        refreshCalcs();
      });
      sec.append(h('div', { class: 'm-row' + (d.hidden ? ' secret' : '') }, h('label', { class: 'm-name', for: id }, d.name), rng, out));
    }
    if (!author && defs.some((d) => d.hidden)) sec.append(h('p', { class: 'hint secret-hint' }, 'Hidden meters show up in author mode.'));
    sec.append(h('p', { class: 'hint' }, 'Slide to 0 to leave a meter empty.'));
    refreshCalcs = () => {
      for (const { def, value } of meterValues(draft)) {
        const o = outs.get(def.id);
        if (o) o.textContent = value ? fmt(value) : '–';
      }
    };
    refreshCalcs();
    return sec;
  }

  function imagesSection() {
    const grid = h('div', { class: 'img-grid' });
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'visually-hidden', id: 'f-img', tabindex: '-1' });
    const label = h('span', {}, 'Add images');
    const addBtn = h('button', { type: 'button', class: 'img-add', onclick: () => file.click() }, iconEl('image'), label);
    const draw = () => {
      grid.replaceChildren(...draft.images.map((bid, i) => h('div', { class: 'img-cell' },
        imgFor(bid, ''),
        i === 0
          ? h('span', { class: 'cover-tag' }, 'Cover')
          : h('button', { type: 'button', class: 'mini', onclick: () => { draft.images.splice(i, 1); draft.images.unshift(bid); touch(); draw(); } }, 'Make cover'),
        h('button', {
          type: 'button', class: 'mini x', 'aria-label': 'Remove image', html: ICON.close,
          onclick: () => { draft.images.splice(i, 1); removedBlobs.push(bid); touch(); draw(); },
        }))), addBtn);
    };
    file.addEventListener('change', async () => {
      const files = [...file.files];
      file.value = '';
      addBtn.disabled = true;
      label.textContent = 'Adding…';
      for (const f of files) {
        try {
          const { id } = await addImage(f);
          newBlobs.push(id);
          draft.images.push(id);
          touch();
        } catch (err) {
          toast(err && err.name === 'QuotaExceededError' ? 'Storage is full. Remove some images first.' : 'That file couldn’t be added. Use a JPG, PNG or WebP image.');
        }
      }
      addBtn.disabled = false;
      label.textContent = 'Add images';
      draw();
    });
    draw();
    return h('div', { class: 'field' }, h('span', { class: 'fl' }, 'Images'), grid, file,
      h('p', { class: 'hint' }, 'Sketches, references, anything. The first image is the cover.'));
  }

  function footer() {
    return h('div', { class: 'edit-bar' },
      h('button', { type: 'button', class: 'btn ghost', onclick: cancel }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn' }, isNew ? 'Create' : 'Save changes'));
  }

  // ---------- save / cancel ----------
  async function save() {
    if (saving) return;
    hideSuggest();
    const name = String(draft.name || '').replace(/#/g, '').trim();
    if (!name) {
      toast('Give it a name first.');
      form.querySelector('#f-name')?.focus();
      return;
    }
    saving = true;
    draft.name = name;
    draft.body = fromEditable(texts.body, session);
    draft.secret = fromEditable(texts.secret, session);
    if (draft.kind === 'event') draft.truth = fromEditable(texts.truth, session);
    const renamed = !isNew && original && original.name !== draft.name;
    try {
      await saveEntry(draft, { isNew, renamed });
    } catch (err) {
      saving = false;
      toast(err && err.name === 'QuotaExceededError' ? 'Storage is full. Remove some images, then try again.' : 'Couldn’t save. Try again.');
      return;
    }
    for (const b of removedBlobs) await deleteBlob(b).catch(() => {});
    finished = true;
    toast(isNew ? 'Created' : 'Saved');
    leaveTo(`#/e/${draft.id}`);
  }

  // Go back to the entry page when we came from it, so the back gesture doesn't show it twice.
  function leaveTo(target) {
    if (!isNew && navState.prev === `/e/${draft.id}`) history.back();
    else location.replace(target);
  }

  async function cancel() {
    hideSuggest();
    if (dirty && !(await confirmSheet({ title: 'Discard changes?', text: 'What you changed here won’t be saved.', confirm: 'Discard' }))) return;
    for (const b of newBlobs) await deleteBlob(b).catch(() => {});
    newBlobs.length = 0;
    finished = true;
    if (!isNew) leaveTo(`#/e/${draft.id}`);
    else if (history.length > 1) history.back();
    else location.replace('#/factions');
  }
}
