// Мини-хелперы для DOM.
export function h(tag, cls, ...kids) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}

export function btn(text, cls, onClick) {
  const b = h('button', 'btn ' + (cls ?? ''), text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
