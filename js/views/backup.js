// Backup and restore: one file with every entry, setting, map and image.
import { h, iconEl, toast, confirmSheet, relDays } from '../ui.js';
import { state, exportBackup, importBackup, validBackup, markBackup } from '../model.js';
import { setTitle } from './parts.js';

const stamp = () => new Date().toISOString().slice(0, 10);
const sizeText = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

async function buildFile() {
  const data = await exportBackup();
  const json = JSON.stringify(data);
  return new File([json], `archive-backup-${stamp()}.json`, { type: 'application/json' });
}

export function renderBackup(main) {
  setTitle('Backup');
  const last = h('p', { class: 'backup-last' });
  const drawLast = () => {
    last.textContent = state.backup.lastAt
      ? `Last backup: ${relDays(state.backup.lastAt)} (${new Date(state.backup.lastAt).toLocaleDateString()}).`
      : 'No backup saved yet.';
  };
  drawLast();

  const saveBtn = h('button', { type: 'button', class: 'btn', id: 'backup-save' }, iconEl('download'), 'Save backup file');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      const file = await buildFile();
      const url = URL.createObjectURL(file);
      const a = h('a', { href: url, download: file.name, hidden: true });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      await markBackup();
      drawLast();
      toast(`Backup saved (${sizeText(file.size)})`);
    } catch {
      toast('The backup couldn’t be created. Try again.');
    } finally {
      saveBtn.disabled = false;
    }
  });

  let shareBtn = null;
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [probe] })) {
      shareBtn = h('button', { type: 'button', class: 'btn ghost' }, iconEl('share'), 'Share backup…');
      shareBtn.addEventListener('click', async () => {
        shareBtn.disabled = true;
        try {
          const file = await buildFile();
          await navigator.share({ files: [file], title: 'Archive backup' });
          await markBackup();
          drawLast();
          toast('Backup shared');
        } catch (err) {
          if (!err || err.name !== 'AbortError') toast('Sharing didn’t work. Use Save backup file instead.');
        } finally {
          shareBtn.disabled = false;
        }
      });
    }
  } catch { /* sharing files not supported */ }

  // No accept filter: some Android file pickers grey out .json files otherwise. The file is checked after picking.
  const fileIn = h('input', { type: 'file', class: 'visually-hidden', id: 'restore-file', tabindex: '-1' });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    fileIn.value = '';
    if (!f) return;
    let obj;
    try { obj = JSON.parse(await f.text()); } catch { toast('That file isn’t an Archive backup.'); return; }
    if (!validBackup(obj)) { toast('That file isn’t an Archive backup.'); return; }
    const n = obj.entries.length;
    const ok = await confirmSheet({
      title: 'Restore this backup?',
      text: `It has ${n} ${n === 1 ? 'entry' : 'entries'}${obj.exportedAt ? ` and was saved on ${new Date(obj.exportedAt).toLocaleDateString()}` : ''}. Everything currently in the app gets replaced.`,
      confirm: 'Replace and restore',
    });
    if (!ok) return;
    try {
      await importBackup(obj);
      toast('Backup restored');
      location.hash = '#/factions';
    } catch (err) {
      toast(err && err.name === 'QuotaExceededError' ? 'Not enough storage on this device to restore it.' : 'Restoring failed. Nothing was changed.');
    }
  });

  const storage = h('p', { class: 'hint' });
  const persistBtn = h('button', { type: 'button', class: 'btn ghost sm', hidden: true }, 'Keep my data safe from cleanup');
  (async () => {
    try {
      const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
      const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
      storage.textContent = `${est ? `Using ${sizeText(est.usage || 0)} on this device. ` : ''}${persisted ? 'Your browser keeps this data safe from automatic cleanup.' : 'Your browser may clear this data if the device runs low on space. Backups protect you.'}`;
      if (!persisted && navigator.storage && navigator.storage.persist) {
        persistBtn.hidden = false;
        persistBtn.addEventListener('click', async () => {
          const ok = await navigator.storage.persist();
          toast(ok ? 'Data is now protected from cleanup' : 'Your browser said no. Installing the app usually helps.');
          if (ok) { persistBtn.hidden = true; storage.textContent = 'Your browser keeps this data safe from automatic cleanup.'; }
        });
      }
    } catch { /* estimate not available */ }
  })();

  main.append(h('div', { class: 'backup' },
    h('section', { class: 'sec' },
      h('h2', { class: 'sec-t' }, 'Save a backup'),
      h('p', {}, 'Archive keeps everything on this device only. A backup file holds all your entries, settings, the map and every image.'),
      last,
      h('div', { class: 'actions' }, saveBtn, shareBtn),
      h('p', { class: 'hint' }, 'Keep the file somewhere safe, like Google Drive or your computer.')),
    h('section', { class: 'sec' },
      h('h2', { class: 'sec-t' }, 'Restore from a backup'),
      h('p', {}, 'Use this on a new phone, or to go back to an older copy. It replaces everything in the app.'),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => fileIn.click() }, iconEl('upload'), 'Choose backup file')),
      fileIn),
    h('section', { class: 'sec' },
      h('h2', { class: 'sec-t' }, 'Storage'),
      storage,
      persistBtn)));
}
