// HUD (ходы, счёт, цели, звёзды) и панель бустеров.
import { h, fmt } from './dom.js';

const BOOSTERS = [
  { kind: 'hammer', icon: '🔨', label: 'Молоток', target: true },
  { kind: 'shuffle', icon: '🔀', label: 'Мешать' },
  { kind: 'extra_moves', icon: '➕', label: '+5 ходов' },
  { kind: 'hint', icon: '💡', label: 'Подсказка', free: true },
];

const GOAL_ICON = { score: '★', drop: '⬇' };

export function createHud(game, ui) {
  const { bus } = game;
  const render = () => game.modules.render;

  // --- HUD ---
  const pauseBtn = h('button', 'btn ghost round', '❚❚'); pauseBtn.type = 'button';
  pauseBtn.addEventListener('click', () => ui.showScreen('pause'));
  const movesV = h('b', null, '0'), scoreV = h('b', null, '0');
  const movesBox = h('div', 'box', movesV, h('i', null, 'Ходы'));
  const scoreBox = h('div', 'box', scoreV, h('i', null, 'Счёт'));
  const coinsV = h('span', null, '0');
  const goalsEl = h('div', 'goals');
  const fill = h('div', 'fill');
  const marks = [h('span', 'm', '★'), h('span', 'm', '★'), h('span', 'm', '★')];
  const stars = h('div', 'stars', fill, ...marks);
  const hud = h('div', 'hud',
    h('div', 'r1', pauseBtn, h('div', 'grow', movesBox, scoreBox), h('div', 'chip', '🪙 ', coinsV)),
    h('div', 'r2', goalsEl, stars));

  // --- бустеры ---
  const boostBar = h('div', 'boosters');
  const els = new Map();
  let armed = null;
  const toast = h('div', 'toast');
  let toastT = 0;
  const say = (msg) => { toast.textContent = msg; toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 1600); };

  function arm(kind) {
    armed = kind;
    for (const [k, e] of els) e.classList.toggle('armed', k === kind);
    bus.emit('booster:armed', { kind });
  }

  for (const b of BOOSTERS) {
    const n = h('span', 'n');
    const e = h('button', 'boost', b.icon, h('small', null, b.label), n);
    e.type = 'button';
    e.addEventListener('click', () => {
      if (b.free) { game.modules.core?.hint?.(); return; }
      const inv = game.modules.meta?.inventory?.();
      if (inv && typeof inv[b.kind] === 'number' && inv[b.kind] <= 0) { say('Бустер закончился'); return; }
      if (b.target) { if (armed === b.kind) arm(null); else { arm(b.kind); say('Выберите клетку'); } return; }
      arm(null);
      bus.emit('input:booster', { kind: b.kind });
    });
    els.set(b.kind, e); e._n = n;
    boostBar.append(e);
  }

  function refreshInventory() {
    const inv = game.modules.meta?.inventory?.();
    for (const b of BOOSTERS) {
      const n = els.get(b.kind)._n;
      if (b.free || !inv || typeof inv[b.kind] !== 'number') { n.style.display = 'none'; continue; }
      n.style.display = ''; n.textContent = inv[b.kind];
    }
  }

  // --- состояние уровня ---
  let level = null, goalEls = [], thresholds = [1, 2, 3];

  function setLevel(lv) {
    if (!lv) return;
    level = lv; arm(null);
    thresholds = lv.stars ?? [1, 2, 3];
    movesV.textContent = lv.moves ?? 0; movesBox.classList.remove('low');
    scoreV.textContent = '0';
    setScore(0);
    goalsEl.replaceChildren(); goalEls = [];
    (lv.goals ?? []).forEach((gl) => {
      const img = h('img');
      let icon = null;
      if (gl.kind === 'collect') icon = render()?.icon('tile', gl.target);
      else if (gl.kind === 'clear_obstacle') icon = render()?.icon('obstacle', gl.target, 2);
      const lead = icon ? Object.assign(img, { src: icon, alt: '' }) : h('span', null, GOAL_ICON[gl.kind] ?? '★');
      const val = h('span', null, String(gl.amount));
      const e = h('div', 'goal', lead, val);
      e._val = val; e._goal = gl; e._img = icon ? lead : null;
      goalsEl.append(e); goalEls.push(e);
    });
    refreshInventory();
  }

  function setScore(s) {
    scoreV.textContent = fmt(s);
    const max = thresholds[2] || 1;
    fill.style.width = Math.min(100, (s / max) * 100) + '%';
    marks.forEach((m, i) => {
      m.style.left = Math.min(100, ((thresholds[i] ?? max) / max) * 100) + '%';
      m.classList.toggle('lit', s >= (thresholds[i] ?? Infinity));
    });
  }

  bus.on('level:load', ({ level: lv }) => setLevel(lv));
  bus.on('level:start', ({ level: lv }) => setLevel(lv ?? level));
  bus.on('score:changed', ({ score }) => setScore(score));
  bus.on('moves:changed', ({ left }) => { movesV.textContent = left; movesBox.classList.toggle('low', left <= 3); });
  bus.on('coins:changed', ({ coins }) => { coinsV.textContent = fmt(coins); });
  bus.on('goal:progress', ({ goal, current }) => {
    let i = goalEls.findIndex((e) => e._goal === goal);
    if (i < 0) i = goalEls.findIndex((e) => e._goal.kind === goal.kind && e._goal.target === goal.target);
    const e = goalEls[i];
    if (!e) return;
    const left = Math.max(0, e._goal.amount - current);
    e._val.textContent = left ? String(left) : '';
    e.classList.toggle('done', !left);
    e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump');
  });
  bus.on('input:booster', () => { arm(null); setTimeout(refreshInventory, 50); });
  bus.on('theme:changed', () => {
    for (const e of goalEls) {
      const gl = e._goal;
      if (e._img) e._img.src = render().icon(gl.kind === 'collect' ? 'tile' : 'obstacle', gl.target, 2);
    }
  });
  bus.on('ui:screen', ({ name }) => { if (name !== 'game') arm(null); });

  return { hud, boostBar, toast, say, refreshInventory, get level() { return level; } };
}
