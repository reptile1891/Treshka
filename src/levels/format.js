// Формат LevelDef: символы раскладки, валидатор, сборка пустого поля. См. CONTRACTS.md.
import { CONFIG } from '../shared/config.js';

export const HOLE = '#';
export const EMPTY = '.';
// символ раскладки -> препятствие
export const OBSTACLE_CHARS = {
  i: { kind: 'ice', hp: 1 }, I: { kind: 'ice', hp: 2 },
  c: { kind: 'chain', hp: 1 }, C: { kind: 'chain', hp: 2 },
  x: { kind: 'crate', hp: 1 }, X: { kind: 'crate', hp: 2 },
  s: { kind: 'slime', hp: 1 },
};
export const SPECIALS = ['line_h', 'line_v', 'bomb', 'rainbow', 'plane'];
export const GOAL_KINDS = ['collect', 'clear_obstacle', 'score', 'drop'];
const ITEM_NAME = /^[a-z0-9_]+$/;
export const MIN_SIZE = 4;
export const MAX_SIZE = 12;

const isInt = (n) => Number.isInteger(n);

// Возвращает { ok, errors } — все найденные проблемы, а не только первая.
export function validateLevel(def) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!def || typeof def !== 'object') return { ok: false, errors: ['уровень не объект'] };

  if (!isInt(def.id) || def.id < 1) err('id: целое число ≥ 1');
  if (!isInt(def.moves) || def.moves < 1 || def.moves > 99) err('moves: целое 1..99');

  const types = def.tileTypes;
  const typesOk = Array.isArray(types) && types.length >= 3 && types.length <= CONFIG.tileTypes.length &&
    new Set(types).size === types.length && types.every((t) => isInt(t) && t >= 0 && t < CONFIG.tileTypes.length);
  if (!typesOk) err(`tileTypes: 3..${CONFIG.tileTypes.length} разных id цветов 0..${CONFIG.tileTypes.length - 1}`);

  const kindsPresent = new Set();
  let playable = 0;
  const b = def.board;
  let boardOk = !!b && isInt(b.cols) && isInt(b.rows) &&
    b.cols >= MIN_SIZE && b.cols <= MAX_SIZE && b.rows >= MIN_SIZE && b.rows <= MAX_SIZE;
  if (!boardOk) err(`board: cols/rows — целые ${MIN_SIZE}..${MAX_SIZE}`);
  else if (!Array.isArray(b.layout) || b.layout.length !== b.rows) {
    err('board.layout: массив из rows строк'); boardOk = false;
  } else {
    b.layout.forEach((row, r) => {
      if (typeof row !== 'string' || row.length !== b.cols) return err(`layout[${r}]: строка из ${b.cols} символов`);
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === HOLE) continue;
        playable++;
        if (ch === EMPTY) continue;
        const o = OBSTACLE_CHARS[ch];
        if (o) kindsPresent.add(o.kind); else err(`layout[${r}][${c}]: неизвестный символ «${ch}»`);
      }
    });
    if (playable < 9) err('на поле меньше 9 живых клеток');
  }

  if (b && b.specials !== undefined) {
    if (!Array.isArray(b.specials)) err('board.specials: массив');
    else {
      const seen = new Set();
      b.specials.forEach((s, i) => {
        const at = `specials[${i}]`;
        if (!s || !isInt(s.r) || !isInt(s.c)) return err(`${at}: нужны целые r, c`);
        if (!SPECIALS.includes(s.special)) err(`${at}: special из ${SPECIALS.join(', ')}`);
        if (s.type !== undefined && !(Array.isArray(types) && types.includes(s.type))) err(`${at}: type вне tileTypes`);
        const ch = boardOk ? b.layout[s.r]?.[s.c] : undefined;
        if (boardOk && (ch === undefined || ch === HOLE)) err(`${at}: клетка вне поля или дыра`);
        const key = s.r + ',' + s.c;
        if (seen.has(key)) err(`${at}: клетка занята другой спецфишкой`);
        seen.add(key);
      });
    }
  }

  const items = b?.items;
  if (items !== undefined) {
    if (!Array.isArray(items)) err('board.items: массив');
    else {
      const seen = new Set((b.specials ?? []).map((q) => q?.r + ',' + q?.c));
      items.forEach((it, i) => {
        const at = `items[${i}]`;
        if (!it || !isInt(it.r) || !isInt(it.c)) return err(`${at}: нужны целые r, c`);
        if (typeof it.item !== 'string' || !ITEM_NAME.test(it.item)) err(`${at}: item — имя из a-z, 0-9, _`);
        const key = it.r + ',' + it.c;
        if (seen.has(key)) err(`${at}: клетка занята другим предметом или спецфишкой`);
        seen.add(key);
        if (!boardOk) return;
        const ch = b.layout[it.r]?.[it.c];
        if (ch === undefined || ch === HOLE) return err(`${at}: клетка вне поля или дыра`);
        if (ch !== EMPTY && ch !== 'i' && ch !== 'I') return err(`${at}: предмет можно ставить на пустую клетку или лёд`);
        if (it.r >= b.rows - 1) return err(`${at}: предмет в нижнем ряду — выпадет сразу`);
        for (let r = it.r + 1; r < b.rows; r++) {
          if ('#xX'.includes(b.layout[r][it.c])) return err(`${at}: под предметом дыра или ящик — не спуститься`);
        }
      });
    }
  }

  if (!Array.isArray(def.goals) || def.goals.length === 0) err('goals: нужна хотя бы одна цель');
  else def.goals.forEach((g, i) => {
    const at = `goals[${i}]`;
    if (!g || !GOAL_KINDS.includes(g.kind)) return err(`${at}: kind из ${GOAL_KINDS.join(', ')}`);
    if (!isInt(g.amount) || g.amount < 1) err(`${at}: amount — целое ≥ 1`);
    if (g.kind === 'collect' && !(Array.isArray(types) && types.includes(g.target))) err(`${at}: target — id цвета из tileTypes`);
    if (g.kind === 'clear_obstacle') {
      if (!Object.values(OBSTACLE_CHARS).some((o) => o.kind === g.target)) err(`${at}: неизвестный kind препятствия «${g.target}»`);
      else if (boardOk && !kindsPresent.has(g.target)) err(`${at}: на поле нет препятствия «${g.target}»`);
    }
    if (g.kind === 'drop') {
      if (g.target !== undefined && (typeof g.target !== 'string' || !ITEM_NAME.test(g.target))) err(`${at}: target — имя предмета или не задан (любые)`);
      const have = Array.isArray(items) ? items.filter((it) => g.target === undefined || it?.item === g.target).length : 0;
      if (have < g.amount) err(`${at}: предметов на поле ${have}, нужно ≥ ${g.amount} (core их не досыпает)`);
    }
  });

  const s = def.stars;
  if (!Array.isArray(s) || s.length !== 3 || !s.every((n) => isInt(n) && n > 0) || !(s[0] < s[1] && s[1] < s[2])) {
    err('stars: три целых по возрастанию');
  }
  return { ok: errors.length === 0, errors };
}

// Поле без фишек: клетки с препятствиями и дырами. Фишки и спецфишки (board.specials) ставит core.
export function buildBoard(def) {
  const { cols, rows, layout } = def.board;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const ch = layout[r][c];
      const o = OBSTACLE_CHARS[ch];
      row.push({ tile: null, obstacle: o ? { ...o } : null, hole: ch === HOLE });
    }
    cells.push(row);
  }
  return { cols, rows, cells };
}

// Звёзды по счёту (запасной расчёт, если core не прислал stars).
export function starsForScore(def, score) {
  return def.stars.filter((t) => score >= t).length;
}

// JSON для файлов уровней: раскладка по строке на ряд, цели и спецфишки — по строке на объект.
export function formatLevel(def) {
  return JSON.stringify(def, null, 2)
    .replace(/\[\s*(-?\d+(?:,\s*-?\d+)*)\s*\]/g, (m, a) => `[${a.replace(/\s+/g, ' ')}]`)
    .replace(/\{\s*([^{}[\]]*?)\s*\}/g, (m, a) => `{ ${a.replace(/\s*\n\s*/g, ' ')} }`);
}
