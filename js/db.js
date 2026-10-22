// Local storage for Archive: one IndexedDB database on this device.
// Stores: entries (all world entries), blobs (images), meta (settings, map, backup info).

const DB_NAME = 'archive-world';
const DB_VERSION = 1;
let dbPromise = null;

export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [name, keyPath] of [['entries', 'id'], ['blobs', 'id'], ['meta', 'key']]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Storage is blocked by another open copy of Archive.'));
    });
  }
  return dbPromise;
}

const asPromise = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
});

export async function getAll(store) {
  const db = await openDB();
  return asPromise(db.transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  const db = await openDB();
  return asPromise(db.transaction(store).objectStore(store).get(key));
}

export async function put(store, value) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  return done(tx);
}

export async function putMany(store, values) {
  if (!values.length) return;
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  return done(tx);
}

export async function remove(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  return done(tx);
}

export async function keys(store) {
  const db = await openDB();
  return asPromise(db.transaction(store).objectStore(store).getAllKeys());
}

// Replace all entries, images and the given meta records in one go (used by restore).
// Either everything is written or nothing changes.
export async function replaceAll(entries, blobs, meta = []) {
  const db = await openDB();
  const tx = db.transaction(['entries', 'blobs', 'meta'], 'readwrite');
  const finished = done(tx);
  try {
    const es = tx.objectStore('entries');
    const bs = tx.objectStore('blobs');
    const ms = tx.objectStore('meta');
    es.clear();
    bs.clear();
    for (const e of entries) es.put(e);
    for (const b of blobs) bs.put(b);
    for (const m of meta) ms.put(m);
  } catch (err) {
    // A bad record must not leave a half-cleared database behind.
    try { tx.abort(); } catch { /* already finished */ }
    await finished.catch(() => {});
    throw err;
  }
  return finished;
}
