// Map: a base image with territories (colored areas) and pins linked to entries.
import { h, s, iconEl, toast, openSheet, confirmSheet, getPref, setPref, imgFor } from '../ui.js';
import { state, uid, saveMap, addImage, deleteBlob, imageUrl } from '../model.js';
import { setTitle, empty, entrySelect, backupBanner } from './parts.js';

const PALETTE = ['#D9572B', '#2E84C8', '#55C248', '#8E5BC4', '#E6BE22', '#D04C9C', '#8A8F8C', '#AEB82A'];
const ZOOMS = [1, 1.5, 2, 3, 4];
const round = (n) => Math.round(n * 10000) / 10000;
let resizeHandler = null;

function measure(id) {
  return imageUrl(id).then((url) => new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth || 1000, ht: im.naturalHeight || 600 });
    im.onerror = () => resolve({ w: 1000, ht: 600 });
    im.src = url;
  }));
}

function centroid(points) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = points.length;
    return [points.reduce((t, p) => t + p[0], 0) / n, points.reduce((t, p) => t + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

const linkedName = (id) => (id ? state.entries.get(id)?.name || '' : '');

export function renderMap(main) {
  setTitle('Map');
  const M = state.map;
  const banner = backupBanner();
  if (banner) main.append(banner);

  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', id: 'map-file', tabindex: '-1' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    try {
      toast('Saving the map image…');
      const res = await addImage(f, 4096);
      let w = res.width;
      let ht = res.height;
      if (!w || !ht) ({ w, ht } = await measure(res.id));
      const old = M.baseImage;
      M.baseImage = res.id;
      M.width = w;
      M.height = ht;
      await saveMap();
      if (old) await deleteBlob(old);
      toast('Map image saved');
      main.replaceChildren();
      renderMap(main);
    } catch (err) {
      toast(err && err.name === 'QuotaExceededError' ? 'Storage is full. Free some space first.' : 'That file couldn’t be used. Try a JPG, PNG or WebP image.');
    }
  });
  main.append(fileInput);

  if (!M.baseImage) {
    main.append(empty('Upload a map to start. A world map you’ve edited works great, or your own drawing. Then mark territories and pin villages and lairs on top.', 'Upload map image', () => fileInput.click()));
    return;
  }

  let mode = 'view';
  let zoom = Number(getPref('mapZoom', '1'));
  if (!ZOOMS.includes(zoom)) zoom = 1;
  let draft = [];
  const W = 1000;
  const H = Math.max(1, Math.round((W * (M.height || 600)) / (M.width || 1000)));

  const modeBtns = {};
  const modes = [['view', 'Look', 'hand'], ['pin', 'Add pin', 'pin'], ['terr', 'Territory', 'polygon']];
  const modeBar = h('div', { class: 'seg seg-sm map-modes', role: 'group', 'aria-label': 'Map tool' },
    modes.map(([k, label, ic]) => {
      modeBtns[k] = h('button', { type: 'button', class: 'seg-b', 'aria-pressed': 'false', onclick: () => setMode(k) }, iconEl(ic), label);
      return modeBtns[k];
    }));
  const zoomLabel = h('span', { class: 'zoom-l', 'aria-live': 'polite' });
  const zoomBox = h('div', { class: 'zoom' },
    h('button', { type: 'button', class: 'ib', 'aria-label': 'Zoom out', onclick: () => setZoom(-1) }, iconEl('minus')),
    zoomLabel,
    h('button', { type: 'button', class: 'ib', 'aria-label': 'Zoom in', onclick: () => setZoom(1) }, iconEl('plus')));
  const hint = h('p', { class: 'hint map-hint' });
  const undoBtn = h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { draft.pop(); draw(); updateUi(); } }, 'Undo corner');
  const finishBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => finish() }, 'Finish');
  const cancelBtn = h('button', { type: 'button', class: 'btn ghost sm', onclick: () => setMode('view') }, 'Cancel');
  const drawBar = h('div', { class: 'draw-bar', hidden: true }, undoBtn, finishBtn, cancelBtn);

  const wrap = h('div', { class: 'map-wrap' });
  const inner = h('div', { class: 'map-inner' });
  const img = imgFor(M.baseImage, 'World map');
  img.addEventListener('load', () => draw());
  const svg = s('svg', { class: 'map-svg', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' });
  inner.append(img, svg);
  wrap.append(inner);
  const legend = h('div', { class: 'legend' });

  main.append(
    h('div', { class: 'map-tools' }, modeBar),
    hint, drawBar, h('div', { class: 'map-stage' }, wrap, zoomBox), legend,
    h('div', { class: 'map-foot' }, h('button', { type: 'button', class: 'btn ghost sm', onclick: () => fileInput.click() }, iconEl('upload'), 'Replace map image')),
  );

  const upp = () => W / Math.max(1, inner.clientWidth);

  function draw() {
    if (!svg.isConnected) return;
    const u = upp();
    svg.replaceChildren();
    for (const t of M.territories) {
      if (!t.points || t.points.length < 3) continue;
      svg.append(s('polygon', {
        points: t.points.map(([x, y]) => `${x * W},${y * H}`).join(' '),
        fill: t.color, 'fill-opacity': '0.3', stroke: t.color, 'stroke-width': 2 * u, 'stroke-linejoin': 'round',
        class: 'terr', 'data-kind': 'terr', 'data-id': t.id,
      }));
    }
    for (const t of M.territories) {
      const name = t.name || linkedName(t.entry);
      if (!t.points || t.points.length < 3 || !name) continue;
      const [cx, cy] = centroid(t.points);
      svg.append(s('text', { x: cx * W, y: cy * H, class: 'terr-label', 'font-size': 13 * u, 'stroke-width': 3 * u, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, name));
    }
    for (const p of M.pins) {
      const g = s('g', { class: 'pin', 'data-kind': 'pin', 'data-id': p.id, transform: `translate(${p.x * W} ${p.y * H})` });
      g.append(s('circle', { r: 14 * u, class: 'pin-hit' }));
      g.append(s('circle', { r: 6 * u, class: 'pin-dot', 'stroke-width': 2 * u }));
      const label = p.label || linkedName(p.entry);
      if (label) g.append(s('text', { x: 10 * u, y: 0, class: 'pin-label', 'font-size': 12 * u, 'stroke-width': 3 * u, 'dominant-baseline': 'middle' }, label));
      svg.append(g);
    }
    if (draft.length) {
      svg.append(s('polyline', { points: draft.map(([x, y]) => `${x * W},${y * H}`).join(' '), class: 'draft-line', 'stroke-width': 2 * u, fill: 'none' }));
      draft.forEach(([x, y], i) => svg.append(s('circle', { cx: x * W, cy: y * H, r: (i === 0 ? 7 : 4.5) * u, class: 'draft-pt' + (i === 0 ? ' first' : '') })));
    }
  }

  function updateUi() {
    for (const [k, b] of Object.entries(modeBtns)) {
      b.classList.toggle('on', k === mode);
      b.setAttribute('aria-pressed', String(k === mode));
    }
    wrap.dataset.mode = mode;
    hint.textContent = {
      view: 'Tap a territory or pin to open it. Zoom with − and +, then scroll to move around.',
      pin: 'Tap the map where the pin should go.',
      terr: 'Tap to set the corners. Tap the first corner again, or Finish, to close the territory.',
    }[mode];
    drawBar.hidden = mode !== 'terr';
    undoBtn.disabled = !draft.length;
    finishBtn.disabled = draft.length < 3;
    zoomLabel.textContent = `${zoom}×`;
  }

  function setMode(k) {
    mode = k;
    if (k !== 'terr') draft = [];
    updateUi();
    draw();
  }

  function setZoom(dir) {
    const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + dir));
    if (ZOOMS[i] === zoom) return;
    const cx = (wrap.scrollLeft + wrap.clientWidth / 2) / Math.max(1, inner.clientWidth);
    const cy = (wrap.scrollTop + wrap.clientHeight / 2) / Math.max(1, inner.clientHeight);
    zoom = ZOOMS[i];
    setPref('mapZoom', String(zoom));
    inner.style.width = `${zoom * 100}%`;
    wrap.scrollLeft = cx * inner.clientWidth - wrap.clientWidth / 2;
    wrap.scrollTop = cy * inner.clientHeight - wrap.clientHeight / 2;
    updateUi();
    draw();
  }

  svg.addEventListener('click', (ev) => {
    const r = svg.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width;
    const y = (ev.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (mode === 'pin') { addPin(round(x), round(y)); return; }
    if (mode === 'terr') {
      if (draft.length >= 3) {
        const [fx, fy] = draft[0];
        if (Math.hypot((fx - x) * r.width, (fy - y) * r.height) < 18) { finish(); return; }
      }
      draft.push([round(x), round(y)]);
      draw();
      updateUi();
      return;
    }
    const target = ev.target.closest('[data-kind]');
    if (!target) return;
    if (target.dataset.kind === 'pin') openPin(target.dataset.id);
    else openTerritory(target.dataset.id);
  });

  async function persist() {
    try { await saveMap(); } catch { toast('Couldn’t save the map. Try again.'); }
  }

  function pinSheet(p, title) {
    return openSheet((close) => {
      const sel = entrySelect('pin-entry', p.entry, { none: 'Nothing linked' });
      const lab = h('input', { class: 'in', id: 'pin-label', value: p.label || '', maxlength: '60', autocomplete: 'off', placeholder: 'Shown next to the pin' });
      return [
        h('h2', { class: 'sheet-t' }, title),
        h('div', { class: 'field' }, h('label', { class: 'fl', for: 'pin-entry' }, 'Linked entry'), sel, h('p', { class: 'hint' }, 'Tapping the pin opens this entry.')),
        h('div', { class: 'field' }, h('label', { class: 'fl', for: 'pin-label' }, 'Label'), lab, h('p', { class: 'hint' }, 'Leave empty to show the linked entry’s name.')),
        h('div', { class: 'sheet-actions' },
          h('button', { type: 'button', class: 'btn ghost', onclick: () => close(undefined) }, 'Cancel'),
          h('button', {
            type: 'button', class: 'btn',
            onclick: () => {
              if (!sel.value && !lab.value.trim()) { toast('Link an entry or give the pin a label.'); lab.focus(); return; }
              close({ label: lab.value.trim(), entry: sel.value || null });
            },
          }, 'Save pin')),
      ];
    }, { label: title });
  }

  function terrSheet(t, title) {
    return openSheet((close) => {
      const name = h('input', { class: 'in', id: 'terr-name', value: t.name || '', maxlength: '60', autocomplete: 'off', placeholder: 'Wrath’s domain' });
      const color = h('input', { class: 'in color-in', id: 'terr-color', type: 'color', value: t.color });
      const swatches = h('div', { class: 'swatches' }, PALETTE.map((c) => h('button', {
        type: 'button', class: 'swatch-b', style: `--c:${c}`, 'aria-label': `Use color ${c}`,
        onclick: () => { color.value = c; },
      })));
      const sel = entrySelect('terr-entry', t.entry, { none: 'Nothing linked' });
      return [
        h('h2', { class: 'sheet-t' }, title),
        h('div', { class: 'field' }, h('label', { class: 'fl', for: 'terr-name' }, 'Name'), name),
        h('div', { class: 'field' }, h('label', { class: 'fl', for: 'terr-color' }, 'Color'), h('div', { class: 'color-row' }, color, swatches)),
        h('div', { class: 'field' }, h('label', { class: 'fl', for: 'terr-entry' }, 'Linked entry'), sel, h('p', { class: 'hint' }, 'For example the kaiju who rules it.')),
        h('div', { class: 'sheet-actions' },
          h('button', { type: 'button', class: 'btn ghost', onclick: () => close(undefined) }, 'Cancel'),
          h('button', {
            type: 'button', class: 'btn',
            onclick: () => {
              if (!name.value.trim() && !sel.value) { toast('Give the territory a name or link an entry.'); name.focus(); return; }
              close({ name: name.value.trim(), color: color.value, entry: sel.value || null });
            },
          }, 'Save territory')),
      ];
    }, { label: title });
  }

  async function addPin(x, y) {
    const res = await pinSheet({ label: '', entry: null }, 'New pin');
    if (!res) return;
    M.pins.push({ id: uid(), x, y, label: res.label, entry: res.entry });
    await persist();
    toast('Pin added');
    setMode('view');
    drawLegend();
  }

  async function finish() {
    if (draft.length < 3) return;
    const res = await terrSheet({ name: '', color: PALETTE[M.territories.length % PALETTE.length], entry: null }, 'New territory');
    if (!res) return;
    M.territories.push({ id: uid(), name: res.name, color: res.color, entry: res.entry, points: draft.slice() });
    draft = [];
    await persist();
    toast('Territory saved');
    setMode('view');
    drawLegend();
  }

  async function openThing(kind, id) {
    const list = kind === 'pin' ? M.pins : M.territories;
    const item = list.find((x) => x.id === id);
    if (!item) return;
    const linked = item.entry ? state.entries.get(item.entry) : null;
    const title = (kind === 'pin' ? item.label : item.name) || linked?.name || (kind === 'pin' ? 'Pin' : 'Territory');
    const choice = await openSheet((close) => [
      h('h2', { class: 'sheet-t' }, kind === 'terr' ? h('span', { class: 'swatch', style: `--c:${item.color}` }) : null, title),
      h('p', { class: 'sheet-p' }, linked ? `Linked to ${linked.name}.` : 'Not linked to an entry.'),
      h('div', { class: 'sheet-actions wrap' },
        linked ? h('button', { type: 'button', class: 'btn', onclick: () => close('open') }, `Open ${linked.name}`) : null,
        h('button', { type: 'button', class: 'btn ghost', onclick: () => close('edit') }, 'Edit'),
        h('button', { type: 'button', class: 'btn ghost danger', onclick: () => close('delete') }, 'Delete'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => close(undefined) }, 'Close')),
    ], { label: title });
    if (choice === 'open' && linked) { location.hash = `#/e/${linked.id}`; return; }
    if (choice === 'edit') {
      const res = kind === 'pin' ? await pinSheet(item, 'Edit pin') : await terrSheet(item, 'Edit territory');
      if (!res) return;
      Object.assign(item, res);
      await persist();
      toast('Saved');
      draw();
      drawLegend();
      return;
    }
    if (choice === 'delete') {
      const ok = await confirmSheet({ title: `Delete ${title}?`, text: kind === 'pin' ? 'The pin disappears from the map.' : 'The territory disappears from the map.' });
      if (!ok) return;
      list.splice(list.indexOf(item), 1);
      await persist();
      toast('Deleted');
      draw();
      drawLegend();
    }
  }
  const openPin = (id) => openThing('pin', id);
  const openTerritory = (id) => openThing('terr', id);

  function drawLegend() {
    const out = [];
    if (M.territories.length) {
      out.push(h('h2', { class: 'sec-t' }, 'Territories'));
      out.push(h('div', { class: 'list' }, M.territories.map((t) => h('button', { type: 'button', class: 'row legend-row', onclick: () => openTerritory(t.id) },
        h('span', { class: 'swatch', style: `--c:${t.color}` }),
        h('span', { class: 'row-main' }, h('span', { class: 'row-name' }, t.name || linkedName(t.entry) || 'Unnamed territory'),
          t.entry && t.name ? h('span', { class: 'row-sum' }, linkedName(t.entry)) : null)))));
    }
    if (M.pins.length) {
      out.push(h('h2', { class: 'sec-t' }, 'Pins'));
      out.push(h('div', { class: 'list' }, M.pins.map((p) => h('button', { type: 'button', class: 'row legend-row', onclick: () => openPin(p.id) },
        h('span', { class: 'swatch pin-swatch' }),
        h('span', { class: 'row-main' }, h('span', { class: 'row-name' }, p.label || linkedName(p.entry) || 'Pin'),
          p.entry && p.label ? h('span', { class: 'row-sum' }, linkedName(p.entry)) : null)))));
    }
    if (!out.length) out.push(h('p', { class: 'hint' }, 'Nothing marked yet. Use Add pin or Territory above.'));
    legend.replaceChildren(...out);
  }

  inner.style.width = `${zoom * 100}%`;
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  resizeHandler = () => draw();
  window.addEventListener('resize', resizeHandler);
  updateUi();
  drawLegend();
  requestAnimationFrame(draw);
}
