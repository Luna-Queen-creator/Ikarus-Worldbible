// Data model for Archive: settings, entries, links, meters, search and backups.
import * as db from './db.js';

export const uid = () => {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).slice(0, 16);
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const named = (names) => names.map((name) => ({ id: slug(name), name }));
function meter(id, name, hidden = false) {
  return { id, name, mode: 'manual', hidden, terms: [], bonuses: [] };
}

export const DEFAULT_SETTINGS = {
  version: 1,
  factions: [
    { id: 'humans', name: 'Humans', types: [{ id: 'villager', name: 'Villager' }, { id: 'slayer', name: 'Slayer' }] },
    { id: 'kaiju', name: 'Kaiju', types: [{ id: 'kaiju', name: 'Kaiju' }] },
    { id: 'ai', name: 'AI', types: [{ id: 'ai', name: 'AI' }, { id: 'shaman', name: 'Shaman' }] },
  ],
  classes: [
    { id: 'pawn', name: 'Pawn', glyph: '♙', factor: 1 },
    { id: 'knight', name: 'Knight', glyph: '♘', factor: 3 },
    { id: 'bishop', name: 'Bishop', glyph: '♗', factor: 9 },
    { id: 'rook', name: 'Rook', glyph: '♖', factor: 27 },
    { id: 'king', name: 'King', glyph: '♔', factor: 81 },
    { id: 'queen', name: 'Queen', glyph: '♕', factor: 486 },
    { id: 'god', name: 'God', glyph: '✶', factor: 11664 },
  ],
  ranks: [
    { id: 'white', name: 'White', color: '#F1F1EC', factor: 0.2, note: 'Trainee' },
    { id: 'yellow', name: 'Yellow', color: '#E5C443', factor: 0.5, note: '' },
    { id: 'green', name: 'Green', color: '#4C9A5A', factor: 1.5, note: '' },
    { id: 'blue', name: 'Blue', color: '#3A6DB0', factor: 4, note: '' },
    { id: 'red', name: 'Red', color: '#B9433A', factor: 12, note: '' },
    { id: 'black', name: 'Black', color: '#161616', factor: 35, note: '' },
  ],
  families: named(['Desert', 'Jungle', 'Ocean', 'Woodlands', 'Mountains']),
  elements: [
    { id: 'poison', name: 'Poison', color: '#8E5BC4' },
    { id: 'fire', name: 'Fire', color: '#D9572B' },
    { id: 'acid', name: 'Acid', color: '#AEB82A' },
    { id: 'electricity', name: 'Electricity', color: '#E6BE22' },
    { id: 'non-elemental', name: 'Non-Elemental', color: '#8A8F8C' },
    { id: 'radioactive', name: 'Radioactive', color: '#55C248' },
    { id: 'psychic', name: 'Psychic', color: '#D04C9C' },
    { id: 'water', name: 'Water', color: '#2E84C8' },
  ],
  sins: named(['Pride', 'Greed', 'Lust', 'Envy', 'Gluttony', 'Wrath', 'Sloth']),
  placeTypes: named(['Village', 'Lair', 'Region', 'Ruin', 'Other']),
  eras: named(['Ancient era', 'The Uprising', 'Present day']),
  meters: {
    kaiju: [
      meter('toughness', 'Toughness'),
      meter('regen', 'Regeneration speed'),
      meter('intelligence', 'Intelligence'),
      meter('instinct', 'Instinct'),
      meter('ego', 'Ego'),
      meter('danger', 'Danger level'),
      {
        id: 'dominance', name: 'Dominance', mode: 'calc', hidden: true,
        terms: [{ meter: 'intelligence', weight: 1 }, { meter: 'instinct', weight: 1 }, { meter: 'ego', weight: 1 }],
        bonuses: [{ tag: 'Proud', value: 1 }],
      },
    ],
    slayer: [
      meter('strength', 'Strength'),
      meter('speed', 'Speed'),
      meter('toughness', 'Toughness'),
      meter('intelligence', 'Intelligence'),
      meter('selfbelief', 'Self-belief', true),
      meter('mind', 'Strength of mind', true),
      {
        id: 'willpower', name: 'Willpower', mode: 'calc', hidden: true,
        terms: [{ meter: 'intelligence', weight: 1 }, { meter: 'selfbelief', weight: 1 }, { meter: 'mind', weight: 1 }],
        bonuses: [],
      },
    ],
    villager: [],
    ai: [],
    shaman: [],
  },
};

export const state = {
  entries: new Map(),
  settings: null,
  map: null,
  backup: { lastAt: null },
  backlinks: new Map(),
};

export const emptyMap = () => ({ baseImage: null, width: 0, height: 0, territories: [], pins: [] });

function migrate(saved) {
  const base = structuredClone(DEFAULT_SETTINGS);
  if (!saved || typeof saved !== 'object') return base;
  for (const k of Object.keys(base)) if (saved[k] === undefined) saved[k] = base[k];
  if (!saved.meters || typeof saved.meters !== 'object') saved.meters = {};
  for (const f of saved.factions) for (const t of f.types) if (!Array.isArray(saved.meters[t.id])) saved.meters[t.id] = [];
  return saved;
}

export async function load() {
  const [entries, s, mp, bk] = await Promise.all([
    db.getAll('entries'), db.get('meta', 'settings'), db.get('meta', 'map'), db.get('meta', 'backup'),
  ]);
  state.entries = new Map(entries.map((e) => [e.id, e]));
  state.settings = migrate(s ? s.value : null);
  state.map = mp ? mp.value : emptyMap();
  state.backup = bk ? bk.value : { lastAt: null };
  if (!s) await saveSettings();
  rebuildIndex();
}

export async function saveSettings() {
  await db.put('meta', { key: 'settings', value: state.settings });
}

export async function saveMap() {
  await db.put('meta', { key: 'map', value: state.map });
}

// ---------- lookups ----------
export const byId = (list, id) => (list || []).find((x) => x.id === id);
export const byName = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
export const entriesWhere = (fn) => [...state.entries.values()].filter(fn);
export const factionOf = (id) => byId(state.settings.factions, id);
export const typeOf = (factionId, typeId) => byId(factionOf(factionId)?.types, typeId);

export function typeName(e) {
  if (e.kind === 'being') return typeOf(e.faction, e.type)?.name || 'Being';
  if (e.kind === 'place') return byId(state.settings.placeTypes, e.placeType)?.name || 'Place';
  if (e.kind === 'event') return 'Event';
  if (e.kind === 'story') return 'Story';
  return '';
}

// Short label for the kind of entry, used in menus and search results.
export function kindNoun(e) {
  if (e.kind === 'being') return typeName(e);
  if (e.kind === 'place') return typeName(e);
  if (e.kind === 'event') return 'Event';
  return 'Story';
}

export function classIndex(e) {
  const i = state.settings.classes.findIndex((c) => c.id === e.kclass);
  return i;
}

export function rankIndex(e) {
  return state.settings.ranks.findIndex((r) => r.id === e.rank);
}

// ---------- power scaling ----------
export function factorOf(e) {
  if (!e || e.kind !== 'being') return 1;
  if (e.faction === 'kaiju') return Number(byId(state.settings.classes, e.kclass)?.factor) || 1;
  if (e.type === 'slayer') return Number(byId(state.settings.ranks, e.rank)?.factor) || 1;
  return 1;
}

export function scaleLabel(e) {
  if (e.faction === 'kaiju') {
    const c = byId(state.settings.classes, e.kclass);
    return c ? `${c.name} class` : '';
  }
  if (e.type === 'slayer') {
    const r = byId(state.settings.ranks, e.rank);
    return r ? `${r.name} Slayer` : '';
  }
  return '';
}

// ---------- meters ----------
export function meterDefs(e) {
  if (!e || e.kind !== 'being') return [];
  return state.settings.meters[e.type] || [];
}

export function meterValues(e) {
  const defs = meterDefs(e);
  const vals = {};
  for (const d of defs) {
    if (d.mode === 'calc') continue;
    const v = Number(e.meters?.[d.id]);
    vals[d.id] = Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 0;
  }
  const tags = (e.tags || []).map((t) => t.trim().toLowerCase());
  for (const d of defs) {
    if (d.mode !== 'calc') continue;
    let v = 0;
    for (const t of d.terms || []) v += (vals[t.meter] || 0) * (Number(t.weight) || 0);
    for (const b of d.bonuses || []) {
      if (b.tag && tags.includes(b.tag.trim().toLowerCase())) v += Number(b.value) || 0;
    }
    vals[d.id] = Math.round(v * 10) / 10;
  }
  return defs.map((d) => ({ def: d, value: vals[d.id] ?? 0 }));
}

// Highest value a meter can reach, used to draw calculated meters to scale.
export function meterMax(def, defs, depth = 0) {
  if (def.mode !== 'calc') return 10;
  if (depth > 4) return 10;
  let max = 0;
  for (const t of def.terms || []) {
    const ref = defs.find((d) => d.id === t.meter);
    const refMax = ref ? meterMax(ref, defs, depth + 1) : 10;
    max += Math.abs(Number(t.weight) || 0) * refMax;
  }
  for (const b of def.bonuses || []) max += Math.max(0, Number(b.value) || 0);
  return max || 10;
}

export function meterByName(e, name) {
  const k = name.trim().toLowerCase();
  const hit = meterValues(e).find((v) => v.def.name.trim().toLowerCase() === k);
  return hit ? hit.value : null;
}

export function formulaText(def, defs) {
  let out = '';
  const add = (n, text) => {
    if (!out) out = n < 0 ? `−${text}` : text;
    else out += n < 0 ? ` − ${text}` : ` + ${text}`;
  };
  for (const t of def.terms || []) {
    const ref = defs.find((d) => d.id === t.meter);
    const w = Number(t.weight) || 0;
    const n = ref ? ref.name : '?';
    add(w, Math.abs(w) === 1 ? n : `${Math.abs(w)} × ${n}`);
  }
  for (const b of def.bonuses || []) {
    if (!b.tag) continue;
    const v = Number(b.value) || 0;
    add(v, `${Math.abs(v)} if tagged “${b.tag}”`);
  }
  return out || 'No formula yet';
}

// ---------- links ----------
// Links are stored as [[id]] so renaming an entry keeps every link working.
// While editing they show as #Name#. A #Name# that matches no entry yet stays as text
// and turns into a real link as soon as an entry with that name exists.
export const TEXT_FIELDS = ['body', 'truth', 'secret'];
const TOKEN_RE = /\[\[([A-Za-z0-9_-]{4,40})\]\]/g;
const validInner = (s) => s.length >= 1 && s.length <= 80 && !s.includes('\n') && !/^\s|\s$/.test(s);

export function splitHash(text) {
  const out = [];
  let i = 0;
  let buf = '';
  while (i < text.length) {
    const a = text.indexOf('#', i);
    if (a < 0) { buf += text.slice(i); break; }
    const b = text.indexOf('#', a + 1);
    if (b < 0) { buf += text.slice(i); break; }
    const inner = text.slice(a + 1, b);
    if (validInner(inner)) {
      buf += text.slice(i, a);
      if (buf) out.push({ text: buf });
      buf = '';
      out.push({ link: inner });
      i = b + 1;
      continue;
    }
    buf += text.slice(i, a + 1);
    i = a + 1;
  }
  if (buf) out.push({ text: buf });
  return out;
}

export function scanHash(text, fn) {
  return splitHash(text || '').map((p) => (p.link != null ? (fn(p.link) ?? `#${p.link}#`) : p.text)).join('');
}

export function splitTokens(text) {
  return String(text || '').split(TOKEN_RE);
}

export function findByName(name, excludeId) {
  const k = name.trim().toLowerCase();
  const order = { being: 0, place: 1, event: 2, story: 3 };
  let best = null;
  for (const e of state.entries.values()) {
    if (e.id === excludeId) continue;
    if ((e.name || '').trim().toLowerCase() !== k) continue;
    if (!best || order[e.kind] < order[best.kind]) best = e;
  }
  return best;
}

export function toEditable(text, session) {
  return String(text || '').replace(TOKEN_RE, (m, id) => {
    const t = state.entries.get(id);
    if (!t || !t.name) return m;
    session.set(t.name.trim().toLowerCase(), id);
    return `#${t.name}#`;
  });
}

export function fromEditable(text, session) {
  return scanHash(String(text || ''), (inner) => {
    const k = inner.trim().toLowerCase();
    let id = session.get(k);
    if (!id || !state.entries.has(id)) id = findByName(k)?.id;
    return id ? `[[${id}]]` : null;
  });
}

export function plain(text) {
  return String(text || '')
    .replace(TOKEN_RE, (m, id) => state.entries.get(id)?.name || '')
    .replace(/#([^#\n]{1,80})#/g, '$1');
}

export function linkIds(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(TOKEN_RE)) out.add(m[1]);
  return out;
}

export function rebuildIndex() {
  const bl = new Map();
  const add = (target, from, secretOnly) => {
    if (target === from) return;
    if (!bl.has(target)) bl.set(target, new Map());
    bl.get(target).set(from, secretOnly);
  };
  for (const e of state.entries.values()) {
    const pub = linkIds(e.body);
    const sec = new Set([...linkIds(e.secret), ...linkIds(e.truth)]);
    for (const id of pub) add(id, e.id, false);
    for (const id of sec) if (!pub.has(id)) add(id, e.id, true);
  }
  state.backlinks = bl;
}

export function backlinksOf(id, author) {
  const m = state.backlinks.get(id);
  if (!m) return [];
  const out = [];
  for (const [from, secretOnly] of m) {
    if (secretOnly && !author) continue;
    const e = state.entries.get(from);
    if (e) out.push({ entry: e, secret: secretOnly });
  }
  return out.sort((a, b) => byName(a.entry, b.entry));
}

// Turn plain #Name# text everywhere into real links once an entry with that name exists.
async function resolvePending(target) {
  const k = (target.name || '').trim().toLowerCase();
  if (!k) return;
  const changed = [];
  for (const e of state.entries.values()) {
    let dirty = false;
    for (const f of TEXT_FIELDS) {
      if (!e[f] || !e[f].includes('#')) continue;
      const next = scanHash(e[f], (inner) => (inner.trim().toLowerCase() === k ? `[[${target.id}]]` : null));
      if (next !== e[f]) { e[f] = next; dirty = true; }
    }
    if (dirty) changed.push(e);
  }
  if (changed.length) await db.putMany('entries', changed);
}

// ---------- entries ----------
export function newEntry(kind, extra = {}) {
  const now = Date.now();
  return {
    id: uid(), kind, name: '', summary: '', body: '', secret: '', tags: [], images: [], meters: {},
    createdAt: now, updatedAt: now, ...extra,
  };
}

export async function saveEntry(e, { isNew = false, renamed = false } = {}) {
  e.name = String(e.name || '').replace(/#/g, '').trim();
  e.updatedAt = Date.now();
  await db.put('entries', e);
  state.entries.set(e.id, e);
  if (isNew || renamed) await resolvePending(e);
  rebuildIndex();
}

export async function deleteEntry(id) {
  const e = state.entries.get(id);
  if (!e) return;
  const token = `[[${id}]]`;
  const changed = [];
  for (const o of state.entries.values()) {
    if (o.id === id) continue;
    let dirty = false;
    for (const f of TEXT_FIELDS) {
      if (o[f] && o[f].includes(token)) { o[f] = o[f].split(token).join(e.name || ''); dirty = true; }
    }
    if (o.village === id) { o.village = null; dirty = true; }
    if (o.parentAi === id) { o.parentAi = null; dirty = true; }
    if (dirty) changed.push(o);
  }
  let mapDirty = false;
  for (const t of state.map.territories) if (t.entry === id) { t.entry = null; mapDirty = true; }
  for (const p of state.map.pins) if (p.entry === id) { p.entry = null; mapDirty = true; }
  await db.putMany('entries', changed);
  await db.remove('entries', id);
  for (const b of e.images || []) await deleteBlob(b);
  if (mapDirty) await saveMap();
  state.entries.delete(id);
  rebuildIndex();
}

export function inUseCount(test) {
  let n = 0;
  for (const e of state.entries.values()) if (test(e)) n += 1;
  return n;
}

// ---------- images ----------
const urlCache = new Map();

export async function processImage(file, max = 1800) {
  if (!file || !file.type || !file.type.startsWith('image/')) throw new Error('not-image');
  // Formats the browser can't draw (like HEIC on some phones) are refused instead of stored unreadable.
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const hgt = Math.max(1, Math.round(bmp.height * scale));
  if (scale === 1 && file.size < 1500000 && /^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
    if (bmp.close) bmp.close();
    return { blob: file, width: w, height: hgt };
  }
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = hgt;
  cv.getContext('2d').drawImage(bmp, 0, 0, w, hgt);
  if (bmp.close) bmp.close();
  let blob = await new Promise((r) => cv.toBlob(r, 'image/webp', 0.86));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.88)) || blob;
  return { blob: blob || file, width: w, height: hgt };
}

export async function addImage(file, max) {
  const { blob, width, height } = await processImage(file, max);
  const id = uid();
  await db.put('blobs', { id, blob, type: blob.type, width, height, createdAt: Date.now() });
  return { id, width, height };
}

export async function imageUrl(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await db.get('blobs', id);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteBlob(id) {
  if (!id) return;
  await db.remove('blobs', id);
  const u = urlCache.get(id);
  if (u) { URL.revokeObjectURL(u); urlCache.delete(id); }
}

// ---------- search ----------
export function search(q, author) {
  const k = q.trim().toLowerCase();
  if (!k) return [];
  const out = [];
  for (const e of state.entries.values()) {
    const name = (e.name || '').toLowerCase();
    let score = 0;
    if (name.startsWith(k)) score = 4;
    else if (name.includes(k)) score = 3;
    else {
      const hay = [
        e.summary, (e.tags || []).join(' '), plain(e.body), (e.mutations || []).join(' '), e.when,
        author ? plain(e.secret) : '', author ? plain(e.truth) : '',
      ].join(' ').toLowerCase();
      if (hay.includes(k)) score = 1;
    }
    if (score) out.push({ e, score });
  }
  return out.sort((a, b) => b.score - a.score || byName(a.e, b.e)).map((x) => x.e);
}

// ---------- backup ----------
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type) {
  const bin = atob(b64 || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

// Images that some entry or the map still uses.
export function referencedBlobs() {
  const used = new Set();
  for (const e of state.entries.values()) for (const b of e.images || []) used.add(b);
  if (state.map && state.map.baseImage) used.add(state.map.baseImage);
  return used;
}

// Remove images nothing uses anymore, for example from an edit that was never saved
// because the app was closed. Only images older than a day, so an edit open in
// another window keeps its new images.
export async function cleanupBlobs() {
  const used = referencedBlobs();
  const ids = await db.keys('blobs');
  let removed = 0;
  for (const id of ids) {
    if (used.has(id)) continue;
    const rec = await db.get('blobs', id);
    if (rec && Date.now() - (rec.createdAt || 0) > 86400000) {
      await db.remove('blobs', id);
      removed += 1;
    }
  }
  return removed;
}

export async function exportBackup() {
  const used = referencedBlobs();
  const blobs = (await db.getAll('blobs')).filter((b) => used.has(b.id));
  const images = [];
  for (const b of blobs) {
    images.push({ id: b.id, type: b.type, width: b.width || 0, height: b.height || 0, data: await blobToBase64(b.blob) });
  }
  return {
    app: 'archive', format: 1, exportedAt: new Date().toISOString(),
    settings: state.settings, map: state.map, entries: [...state.entries.values()], images,
  };
}

const KINDS = ['being', 'place', 'event', 'story'];

export function validBackup(obj) {
  if (!obj || obj.app !== 'archive' || !Array.isArray(obj.entries)) return false;
  if (!obj.settings || typeof obj.settings !== 'object' || !Array.isArray(obj.settings.factions)) return false;
  if (!obj.entries.every((e) => e && typeof e.id === 'string' && e.id && KINDS.includes(e.kind))) return false;
  if (obj.images != null && !Array.isArray(obj.images)) return false;
  return (obj.images || []).every((im) => im && typeof im.id === 'string' && typeof im.data === 'string');
}

export async function importBackup(obj) {
  const blobs = (obj.images || []).map((im) => ({
    id: im.id, type: im.type, width: im.width || 0, height: im.height || 0,
    blob: base64ToBlob(im.data, im.type), createdAt: Date.now(),
  }));
  const settings = migrate(structuredClone(obj.settings));
  const map = obj.map && typeof obj.map === 'object' ? { ...emptyMap(), ...obj.map } : emptyMap();
  await db.replaceAll(obj.entries, blobs, [{ key: 'settings', value: settings }, { key: 'map', value: map }]);
  state.settings = settings;
  state.map = map;
  for (const u of urlCache.values()) URL.revokeObjectURL(u);
  urlCache.clear();
  state.entries = new Map(obj.entries.map((e) => [e.id, e]));
  rebuildIndex();
}

export async function markBackup() {
  state.backup = { ...state.backup, lastAt: Date.now() };
  await db.put('meta', { key: 'backup', value: state.backup });
}
