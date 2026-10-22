// Settings: everything about the world's structure is editable here.
import { h, ICON, iconEl, toast, debounce, getPref, setPref } from '../ui.js';
import { state, uid, saveSettings, inUseCount, formulaText } from '../model.js';
import { setTitle } from './parts.js';
import { askName } from './edit.js';

const CORE_TYPES = ['villager', 'slayer', 'kaiju', 'ai', 'shaman'];
const CORE_FACTIONS = ['humans', 'kaiju', 'ai'];

export function renderSettings(main) {
  const S = state.settings;
  setTitle('Settings');
  const saveNow = async () => {
    try { await saveSettings(); } catch { toast('Settings couldn’t be saved. Try again.'); }
  };
  const save = debounce(saveNow, 300);
  window.addEventListener('hashchange', saveNow, { once: true });

  const ensureMeters = () => {
    for (const f of S.factions) for (const t of f.types) if (!Array.isArray(S.meters[t.id])) S.meters[t.id] = [];
  };

  // ---------- generic list editor ----------
  function listEditor(items, fields, { blockRemove, newItem, minItems = 0, addLabel = 'Add' }) {
    const box = h('div', { class: 'le' });
    const draw = () => {
      box.replaceChildren();
      items.forEach((item, i) => {
        const rowEl = h('div', { class: 'le-row' });
        for (const f of fields) {
          const id = `le-${f.key}-${item.id}`;
          let control;
          if (f.type === 'color') {
            control = h('input', { type: 'color', class: 'in color-in', id, value: item[f.key] || '#888888' });
            control.addEventListener('input', () => { item[f.key] = control.value; save(); });
          } else if (f.type === 'number') {
            control = h('input', { type: 'number', class: 'in', id, value: String(item[f.key] ?? ''), step: 'any', min: '0', inputmode: 'decimal' });
            control.addEventListener('input', () => {
              const n = Number(control.value);
              if (control.value !== '' && Number.isFinite(n)) { item[f.key] = n; save(); }
            });
          } else {
            control = h('input', { class: 'in', id, value: item[f.key] || '', maxlength: String(f.max || 60), autocomplete: 'off', placeholder: f.placeholder || '' });
            control.addEventListener('input', () => { item[f.key] = control.value; save(); });
          }
          rowEl.append(h('label', { class: 'le-cell' + (f.cls ? ' ' + f.cls : ''), for: id }, h('span', { class: 'le-l' }, f.label), control));
        }
        rowEl.append(h('div', { class: 'le-btns' },
          h('button', {
            type: 'button', class: 'ib', 'aria-label': 'Move up', disabled: i === 0, html: ICON.up,
            onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; save(); draw(); },
          }),
          h('button', {
            type: 'button', class: 'ib', 'aria-label': 'Move down', disabled: i === items.length - 1, html: ICON.down,
            onclick: () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; save(); draw(); },
          }),
          h('button', {
            type: 'button', class: 'ib danger', 'aria-label': 'Remove', html: ICON.trash,
            onclick: () => {
              const why = blockRemove ? blockRemove(item) : null;
              if (why) { toast(why); return; }
              if (items.length <= minItems) { toast('Keep at least one.'); return; }
              items.splice(i, 1);
              save();
              draw();
            },
          })));
        box.append(rowEl);
      });
      box.append(h('button', {
        type: 'button', class: 'btn ghost sm',
        onclick: () => {
          items.push(newItem());
          save();
          draw();
          setTimeout(() => { const inputs = box.querySelectorAll('.le-row:last-of-type input'); if (inputs[0]) inputs[0].focus(); }, 30);
        },
      }, iconEl('plus'), addLabel));
    };
    draw();
    return box;
  }

  const used = (test) => {
    const n = inUseCount(test);
    return n ? `Used by ${n} ${n === 1 ? 'entry' : 'entries'}. Change those first.` : null;
  };

  // ---------- factions ----------
  function factionsEditor() {
    const box = h('div', { class: 'factions-ed' });
    const draw = () => {
      box.replaceChildren();
      for (const f of S.factions) {
        const core = CORE_FACTIONS.includes(f.id);
        const nameIn = h('input', { class: 'in', id: `fac-${f.id}`, value: f.name, maxlength: '40', autocomplete: 'off' });
        nameIn.addEventListener('input', () => { f.name = nameIn.value; save(); });
        box.append(h('div', { class: 'fac-card' },
          h('div', { class: 'field' }, h('label', { class: 'fl', for: `fac-${f.id}` }, 'Faction name'), nameIn),
          h('p', { class: 'fl' }, 'Types'),
          listEditor(f.types, [{ key: 'name', label: 'Type name', placeholder: 'e.g. Drone' }], {
            newItem: () => ({ id: uid(), name: '' }),
            minItems: 1,
            addLabel: 'Add type',
            blockRemove: (t) => (CORE_TYPES.includes(t.id) ? 'This type is built in. You can rename it, but not remove it.' : used((e) => e.kind === 'being' && e.type === t.id)),
          }),
          core ? null : h('button', {
            type: 'button', class: 'btn ghost sm danger',
            onclick: () => {
              const why = used((e) => e.kind === 'being' && e.faction === f.id);
              if (why) { toast(why); return; }
              S.factions.splice(S.factions.indexOf(f), 1);
              save();
              draw();
            },
          }, iconEl('trash'), 'Remove faction')));
      }
      box.append(h('button', {
        type: 'button', class: 'btn ghost sm',
        onclick: async () => {
          const name = await askName('New faction', 'Faction name', 'Add faction');
          if (!name) return;
          S.factions.push({ id: uid(), name, types: [{ id: uid(), name: 'Member' }] });
          ensureMeters();
          save();
          draw();
        },
      }, iconEl('plus'), 'Add faction'));
    };
    draw();
    return box;
  }

  // ---------- meters ----------
  function metersEditor() {
    const allTypes = () => S.factions.flatMap((f) => f.types.map((t) => ({ id: t.id, name: `${f.name}: ${t.name || 'Untitled'}` })));
    let cur = getPref('meterType', 'kaiju');
    const sel = h('select', { class: 'in', id: 'mt-type' });
    const list = h('div', { class: 'mt-list' });
    const fill = () => {
      ensureMeters();
      const types = allTypes();
      if (!types.some((t) => t.id === cur)) cur = types[0]?.id;
      sel.replaceChildren(...types.map((t) => h('option', { value: t.id, selected: t.id === cur }, t.name)));
    };
    sel.addEventListener('change', () => { cur = sel.value; setPref('meterType', cur); draw(); });

    function draw() {
      if (!cur) { list.replaceChildren(); return; }
      const defs = S.meters[cur] || (S.meters[cur] = []);
      list.replaceChildren(...defs.map((d, i) => card(d, i, defs)),
        h('button', {
          type: 'button', class: 'btn ghost sm',
          onclick: () => { defs.push({ id: uid(), name: '', mode: 'manual', hidden: false, terms: [], bonuses: [] }); save(); draw(); },
        }, iconEl('plus'), 'Add meter'));
    }

    function card(d, i, defs) {
      const nameIn = h('input', { class: 'in', id: `mn-${d.id}`, value: d.name, maxlength: '40', autocomplete: 'off', placeholder: 'Meter name' });
      nameIn.addEventListener('input', () => { d.name = nameIn.value; save(); preview.textContent = d.mode === 'calc' ? formulaText(d, defs) : ''; });
      const modeSel = h('select', { class: 'in', id: `mm-${d.id}` },
        h('option', { value: 'manual', selected: d.mode !== 'calc' }, 'Set by hand (1 to 10)'),
        h('option', { value: 'calc', selected: d.mode === 'calc' }, 'Calculated from other meters'));
      modeSel.addEventListener('change', () => { d.mode = modeSel.value; d.terms = d.terms || []; d.bonuses = d.bonuses || []; save(); draw(); });
      const hid = h('input', { type: 'checkbox', class: 'cb', id: `mh-${d.id}`, checked: !!d.hidden });
      hid.addEventListener('change', () => { d.hidden = hid.checked; save(); });
      const preview = h('p', { class: 'hint mt-preview' }, d.mode === 'calc' ? formulaText(d, defs) : '');

      const parts = [];
      if (d.mode === 'calc') {
        const others = defs.filter((x) => x.id !== d.id);
        parts.push(h('p', { class: 'fl' }, 'Adds up'));
        (d.terms || []).forEach((t, ti) => {
          const ms = h('select', { class: 'in', 'aria-label': 'Meter' }, others.map((o) => h('option', { value: o.id, selected: o.id === t.meter }, o.name || 'Untitled')));
          ms.addEventListener('change', () => { t.meter = ms.value; save(); preview.textContent = formulaText(d, defs); });
          const w = h('input', { type: 'number', class: 'in w-num', value: String(t.weight ?? 1), step: 'any', inputmode: 'decimal', 'aria-label': 'Weight' });
          w.addEventListener('input', () => { const n = Number(w.value); if (w.value !== '' && Number.isFinite(n)) { t.weight = n; save(); preview.textContent = formulaText(d, defs); } });
          parts.push(h('div', { class: 'term' }, ms, h('span', { class: 'times' }, '×'), w,
            h('button', { type: 'button', class: 'ib danger', 'aria-label': 'Remove part', html: ICON.close, onclick: () => { d.terms.splice(ti, 1); save(); draw(); } })));
        });
        parts.push(h('button', {
          type: 'button', class: 'btn ghost sm', disabled: !others.length,
          onclick: () => { d.terms.push({ meter: others[0]?.id, weight: 1 }); save(); draw(); },
        }, iconEl('plus'), 'Add a meter to the sum'));
        parts.push(h('p', { class: 'fl' }, 'Tag bonuses'));
        (d.bonuses || []).forEach((b, bi) => {
          const tag = h('input', { class: 'in', value: b.tag || '', placeholder: 'Tag, e.g. Proud', maxlength: '30', autocomplete: 'off', 'aria-label': 'Tag' });
          tag.addEventListener('input', () => { b.tag = tag.value; save(); preview.textContent = formulaText(d, defs); });
          const val = h('input', { type: 'number', class: 'in w-num', value: String(b.value ?? 1), step: 'any', inputmode: 'decimal', 'aria-label': 'Bonus' });
          val.addEventListener('input', () => { const n = Number(val.value); if (val.value !== '' && Number.isFinite(n)) { b.value = n; save(); preview.textContent = formulaText(d, defs); } });
          parts.push(h('div', { class: 'term' }, tag, h('span', { class: 'times' }, '+'), val,
            h('button', { type: 'button', class: 'ib danger', 'aria-label': 'Remove bonus', html: ICON.close, onclick: () => { d.bonuses.splice(bi, 1); save(); draw(); } })));
        });
        parts.push(h('button', {
          type: 'button', class: 'btn ghost sm',
          onclick: () => { d.bonuses.push({ tag: '', value: 1 }); save(); draw(); },
        }, iconEl('plus'), 'Add a tag bonus'));
      }

      return h('div', { class: 'mt-card' + (d.hidden ? ' secret' : '') },
        h('div', { class: 'mt-top' },
          h('label', { class: 'le-cell grow', for: `mn-${d.id}` }, h('span', { class: 'le-l' }, 'Name'), nameIn),
          h('div', { class: 'le-btns' },
            h('button', { type: 'button', class: 'ib', 'aria-label': 'Move up', disabled: i === 0, html: ICON.up, onclick: () => { [defs[i - 1], defs[i]] = [defs[i], defs[i - 1]]; save(); draw(); } }),
            h('button', { type: 'button', class: 'ib', 'aria-label': 'Move down', disabled: i === defs.length - 1, html: ICON.down, onclick: () => { [defs[i + 1], defs[i]] = [defs[i], defs[i + 1]]; save(); draw(); } }),
            h('button', {
              type: 'button', class: 'ib danger', 'aria-label': 'Remove meter', html: ICON.trash,
              onclick: () => {
                defs.splice(i, 1);
                for (const o of defs) if (o.terms) o.terms = o.terms.filter((t) => t.meter !== d.id);
                save();
                draw();
              },
            }))),
        h('label', { class: 'le-cell', for: `mm-${d.id}` }, h('span', { class: 'le-l' }, 'Value'), modeSel),
        h('div', { class: 'field check' }, hid, h('label', { for: `mh-${d.id}` }, h('span', { class: 'cb-l' }, 'Hidden'), h('span', { class: 'hint' }, 'Only shows in author mode.'))),
        parts, preview);
    }

    fill();
    draw();
    const wrapEl = h('div', {},
      h('div', { class: 'field' }, h('label', { class: 'fl', for: 'mt-type' }, 'Meters for'), sel),
      list,
      h('p', { class: 'hint' }, 'Versus compares meters that have the same name, like Toughness against Toughness.'));
    wrapEl.refresh = () => { fill(); draw(); };
    return wrapEl;
  }

  // ---------- page ----------
  const section = (title, body, open = false, onOpen) => {
    const d = h('details', { class: 'set-sec', open }, h('summary', {}, title), h('div', { class: 'set-body' }, body));
    if (onOpen) d.addEventListener('toggle', () => { if (d.open) onOpen(); });
    return d;
  };
  const meters = metersEditor();

  main.append(
    h('p', { class: 'hint' }, 'Changes save automatically.'),
    section('Factions and types', factionsEditor(), true),
    section('Kaiju classes', h('div', {},
      h('p', { class: 'hint' }, 'From weakest to strongest. The factor sets real power: meter × factor.'),
      listEditor(S.classes, [{ key: 'name', label: 'Name' }, { key: 'glyph', label: 'Symbol', cls: 'narrow', max: 3 }, { key: 'factor', label: 'Factor', type: 'number', cls: 'narrow' }], {
        newItem: () => ({ id: uid(), name: '', glyph: '◆', factor: 1 }),
        minItems: 1,
        addLabel: 'Add class',
        blockRemove: (c) => used((e) => e.kclass === c.id),
      }))),
    section('Slayer ranks', h('div', {},
      h('p', { class: 'hint' }, 'From lowest to highest. The factor sets real power for Slayers.'),
      listEditor(S.ranks, [{ key: 'name', label: 'Color name' }, { key: 'color', label: 'Color', type: 'color', cls: 'narrow' }, { key: 'factor', label: 'Factor', type: 'number', cls: 'narrow' }, { key: 'note', label: 'Note', placeholder: 'e.g. Trainee' }], {
        newItem: () => ({ id: uid(), name: '', color: '#888888', factor: 1, note: '' }),
        minItems: 1,
        addLabel: 'Add rank',
        blockRemove: (r) => used((e) => e.rank === r.id),
      }))),
    section('Kaiju families', listEditor(S.families, [{ key: 'name', label: 'Where the family comes from', placeholder: 'e.g. Tundra' }], {
      newItem: () => ({ id: uid(), name: '' }),
      addLabel: 'Add family',
      blockRemove: (x) => used((e) => e.family === x.id),
    })),
    section('Elements', listEditor(S.elements, [{ key: 'name', label: 'Element' }, { key: 'color', label: 'Color', type: 'color', cls: 'narrow' }], {
      newItem: () => ({ id: uid(), name: '', color: '#888888' }),
      addLabel: 'Add element',
      blockRemove: (x) => used((e) => (e.elements || []).includes(x.id)),
    })),
    section('Sins', listEditor(S.sins, [{ key: 'name', label: 'Sin' }], {
      newItem: () => ({ id: uid(), name: '' }),
      addLabel: 'Add sin',
      blockRemove: (x) => used((e) => e.sin === x.id),
    })),
    section('Place types', listEditor(S.placeTypes, [{ key: 'name', label: 'Type of place' }], {
      newItem: () => ({ id: uid(), name: '' }),
      minItems: 1,
      addLabel: 'Add place type',
      blockRemove: (x) => (x.id === 'village' ? 'Villages are built in. You can rename them, but not remove them.' : used((e) => e.placeType === x.id)),
    })),
    section('Eras', h('div', {},
      h('p', { class: 'hint' }, 'In order, oldest first. History and stories use these.'),
      listEditor(S.eras, [{ key: 'name', label: 'Era' }], {
        newItem: () => ({ id: uid(), name: '' }),
        addLabel: 'Add era',
        blockRemove: (x) => used((e) => e.era === x.id),
      }))),
    section('Meters', meters, false, () => meters.refresh()),
    section('Data', h('div', {},
      h('p', {}, 'Everything is stored only on this device. Save a backup now and then, and keep it somewhere safe.'),
      h('a', { class: 'btn', href: '#/backup' }, iconEl('download'), 'Backup and restore'))),
  );
}
