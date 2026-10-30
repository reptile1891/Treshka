// Редактор уровней: рисование поля, цели, звёзды, экспорт/импорт JSON.
import { validateLevel, formatLevel, OBSTACLE_CHARS, SPECIALS, GOAL_KINDS, HOLE, EMPTY } from './format.js';
import { CONFIG } from '../shared/config.js';

const $ = (id) => document.getElementById(id);
const BRUSHES = [
  [EMPTY, 'клетка'], [HOLE, 'дыра'],
  ['i', 'лёд'], ['I', 'лёд 2'], ['c', 'цепь'], ['C', 'цепь 2'], ['x', 'ящик'], ['X', 'ящик 2'], ['s', 'слизь'],
  ...SPECIALS.map((s) => ['sp:' + s, s]), ['sp:', 'без спецфишки'],
];
const SP_MARK = { line_h: '↔', line_v: '↕', bomb: '✹', rainbow: '★', plane: '✈' };

let level = {
  id: 1, board: { cols: 8, rows: 8, layout: Array(8).fill(EMPTY.repeat(8)) }, moves: 20,
  goals: [{ kind: 'score', amount: 1000 }], stars: [1000, 1600, 2300], tileTypes: [0, 1, 2, 3, 4],
};
let brush = EMPTY;
let painting = false;

// --- панель инструментов и цвета
$('tools').append(...BRUSHES.map(([ch, label]) => {
  const b = document.createElement('button');
  b.textContent = label; b.dataset.ch = ch;
  b.onclick = () => { brush = ch; markBrush(); };
  return b;
}));
const markBrush = () => [...$('tools').children].forEach((b) => b.classList.toggle('on', b.dataset.ch === brush));
markBrush();

$('colors').append(...CONFIG.tileTypes.map((name, t) => {
  const l = document.createElement('label');
  l.innerHTML = `<input type="checkbox" data-t="${t}"> ${name}`;
  l.firstChild.onchange = () => {
    level.tileTypes = [...$('colors').querySelectorAll('input:checked')].map((i) => +i.dataset.t);
    refresh(false);
  };
  return l;
}));

// --- поле
function paint(r, c) {
  const b = level.board;
  if (brush.startsWith('sp:')) {
    const sp = (b.specials ?? []).filter((s) => !(s.r === r && s.c === c));
    if (brush.length > 3 && b.layout[r][c] !== HOLE) sp.push({ r, c, special: brush.slice(3) });
    if (sp.length) b.specials = sp; else delete b.specials;
  } else {
    const row = b.layout[r];
    b.layout[r] = row.slice(0, c) + brush + row.slice(c + 1);
    if (brush === HOLE && b.specials) b.specials = b.specials.filter((s) => !(s.r === r && s.c === c));
  }
  refresh(false);
}

function drawGrid() {
  const { cols, rows, layout, specials = [] } = level.board;
  const g = $('grid');
  g.style.gridTemplateColumns = `repeat(${cols}, 40px)`;
  g.replaceChildren();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = layout[r][c];
    const o = OBSTACLE_CHARS[ch];
    const d = document.createElement('div');
    d.className = 'cell' + (ch === HOLE ? ' hole' : '') + (o ? ' ' + o.kind : '');
    d.textContent = o ? o.hp : '';
    const s = specials.find((q) => q.r === r && q.c === c);
    if (s) d.insertAdjacentHTML('beforeend', `<span class="sp">${SP_MARK[s.special] ?? '?'}</span>`);
    d.onpointerdown = (e) => { painting = true; paint(r, c); e.preventDefault(); };
    d.onpointerenter = () => { if (painting) paint(r, c); };
    g.append(d);
  }
}
addEventListener('pointerup', () => { painting = false; });

// --- цели
function drawGoals() {
  $('goals').replaceChildren(...level.goals.map((g, i) => {
    const d = document.createElement('div');
    d.className = 'goal';
    const kind = Object.assign(document.createElement('select'), { innerHTML: GOAL_KINDS.map((k) => `<option>${k}</option>`).join('') });
    kind.value = g.kind;
    kind.onchange = () => { g.kind = kind.value; delete g.target; refresh(true); };
    const target = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'target', value: g.target ?? '' });
    target.onchange = () => {
      const v = target.value.trim();
      if (v === '') delete g.target; else g.target = /^\d+$/.test(v) ? +v : v;
      refresh(false);
    };
    const amount = Object.assign(document.createElement('input'), { type: 'number', min: 1, value: g.amount });
    amount.onchange = () => { g.amount = +amount.value; refresh(false); };
    const del = Object.assign(document.createElement('button'), { textContent: '×' });
    del.onclick = () => { level.goals.splice(i, 1); refresh(true); };
    d.append(kind, ' ', target, ' ', amount, del);
    return d;
  }));
}
$('addGoal').onclick = () => { level.goals.push({ kind: 'score', amount: 1000 }); refresh(true); };

// --- поля формы
function readForm() {
  level.id = +$('id').value; level.moves = +$('moves').value;
  level.stars = [+$('s1').value, +$('s2').value, +$('s3').value];
}
for (const id of ['id', 'moves', 's1', 's2', 's3']) $(id).onchange = () => { readForm(); refresh(false); };

function resize() {
  const cols = Math.min(12, Math.max(4, +$('cols').value || 8));
  const rows = Math.min(12, Math.max(4, +$('rows').value || 8));
  const old = level.board.layout;
  level.board.layout = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => old[r]?.[c] ?? EMPTY).join(''));
  level.board.cols = cols; level.board.rows = rows;
  if (level.board.specials) {
    level.board.specials = level.board.specials.filter((s) => s.r < rows && s.c < cols);
    if (!level.board.specials.length) delete level.board.specials;
  }
  refresh(false);
}
$('cols').onchange = $('rows').onchange = resize;

// --- экспорт / импорт
function syncForm() {
  $('id').value = level.id; $('moves').value = level.moves;
  $('cols').value = level.board.cols; $('rows').value = level.board.rows;
  level.stars.forEach((v, i) => { $('s' + (i + 1)).value = v; });
  $('colors').querySelectorAll('input').forEach((i) => { i.checked = level.tileTypes.includes(+i.dataset.t); });
}

function refresh(goalsToo) {
  drawGrid();
  if (goalsToo) drawGoals();
  const { ok, errors } = validateLevel(level);
  const ul = $('errors');
  ul.className = ok ? 'ok' : '';
  ul.replaceChildren(...(ok ? ['Формат корректен'] : errors).map((t) => Object.assign(document.createElement('li'), { textContent: t })));
  $('json').value = formatLevel(level);
}

$('load').onclick = () => {
  try { level = JSON.parse($('json').value); } catch (e) { alert('Не JSON: ' + e.message); return; }
  level.board ??= { cols: 8, rows: 8, layout: [] };
  level.goals ??= [];
  level.stars ??= [0, 0, 0];
  level.tileTypes ??= [];
  syncForm(); refresh(true);
};
$('copy').onclick = () => navigator.clipboard?.writeText($('json').value);
$('download').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([$('json').value + '\n'], { type: 'application/json' }));
  a.download = String(level.id).padStart(3, '0') + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

syncForm(); refresh(true);
