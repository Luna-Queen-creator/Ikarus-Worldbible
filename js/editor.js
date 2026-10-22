// Text box with # links: typing # shows matching entries in a bar above the keyboard.
import { h } from './ui.js';
import { state, byName, kindNoun } from './model.js';

let active = null;

const bar = () => document.getElementById('suggest');

export function linkEditor({ value = '', rows = 6, placeholder = '', session, selfId, onInput, id }) {
  const ta = h('textarea', { class: 'in ta', rows: String(rows), placeholder, id, spellcheck: 'true' });
  ta.value = value;

  // Grow with the text, so long stories scroll the page instead of a small box.
  const grow = () => {
    if (!ta.isConnected) {
      if (!ta.dataset.seen) return;
      window.removeEventListener('resize', grow);
      return;
    }
    ta.dataset.seen = '1';
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
  };
  requestAnimationFrame(grow);
  window.addEventListener('resize', grow);

  const update = () => {
    const pos = ta.selectionStart;
    if (pos !== ta.selectionEnd) { hide(); return; }
    const before = ta.value.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const line = before.slice(lineStart);
    const count = (line.match(/#/g) || []).length;
    if (count % 2 === 1) {
      const hashPos = lineStart + line.lastIndexOf('#');
      const q = ta.value.slice(hashPos + 1, pos);
      if (q.length <= 40 && !/^\s/.test(q)) { show(ta, q, hashPos, pos, session, selfId); return; }
    }
    if (active && active.ta === ta) hide();
  };

  ta.addEventListener('input', () => { if (onInput) onInput(ta.value); grow(); update(); });
  ta.addEventListener('click', update);
  ta.addEventListener('keyup', (e) => { if (/^(Arrow|Home|End)/.test(e.key)) update(); });
  ta.addEventListener('blur', () => {
    setTimeout(() => { if (active && active.ta === ta && document.activeElement !== ta) hide(); }, 250);
  });
  return ta;
}

function show(ta, q, start, end, session, selfId) {
  const el = bar();
  if (!el) return;
  active = { ta, start, end, session };
  const k = q.toLowerCase();
  const starts = [];
  const inside = [];
  for (const e of state.entries.values()) {
    if (!e.name || e.kind === 'story' || e.id === selfId) continue;
    const n = e.name.toLowerCase();
    if (!k || n.startsWith(k)) starts.push(e);
    else if (n.includes(k)) inside.push(e);
  }
  const list = [...starts.sort(byName), ...inside.sort(byName)].slice(0, 12);
  el.replaceChildren();
  if (!list.length) {
    el.append(h('span', { class: 'sg-empty' }, q
      ? `Nothing called “${q}” yet. Close it with # and create it later from the link.`
      : 'Nothing to link yet. Create some entries first.'));
  }
  for (const e of list) {
    el.append(h('button', {
      type: 'button', class: 'sg',
      onpointerdown: (ev) => ev.preventDefault(),
      onmousedown: (ev) => ev.preventDefault(),
      onclick: () => pick(e),
    }, h('span', { class: 'sg-n' }, e.name), h('span', { class: 'sg-k' }, kindNoun(e))));
  }
  el.hidden = false;
  place();
}

function pick(e) {
  if (!active) return;
  const { ta, start, end, session } = active;
  ta.setRangeText(`#${e.name}# `, start, end, 'end');
  session.set(e.name.trim().toLowerCase(), e.id);
  hide();
  ta.focus();
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

export function hide() {
  const el = bar();
  if (el) el.hidden = true;
  active = null;
}

function place() {
  const el = bar();
  const vv = window.visualViewport;
  if (!el || !vv) return;
  const offset = window.innerHeight - vv.height - vv.offsetTop;
  el.style.transform = `translateY(${-Math.max(0, offset)}px)`;
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', place);
  window.visualViewport.addEventListener('scroll', place);
}
