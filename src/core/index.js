// Модуль "core". Контракт: см. CONTRACTS.md
// Движок синхронный: свайп -> матчи -> очистка -> гравитация -> каскады, события идут по порядку.
// Canvas и анимации здесь не трогаем — представление слушает события.
import { cloneBoard, cloneTile } from './board.js';
import { createRng } from './rng.js';
import { generateBoard, shuffleBoard } from './generate.js';
import { findMatches, findMove, hasMove, canSwap, swapTiles, hasSpecial } from './match.js';
import { applyGravity } from './gravity.js';

const POINTS_PER_TILE = 10;
const key = (r, c) => r * 1000 + c;

export function init(game) {
  const { bus } = game;
  let S = null; // состояние текущего уровня

  const goalIndex = (goal) => {
    let i = S.level.goals.indexOf(goal);
    if (i < 0) i = S.level.goals.findIndex((g) => g.kind === goal?.kind && g.target === goal?.target);
    return i;
  };

  function startLevel(level) {
    const types = Array.isArray(level.tileTypes)
      ? level.tileTypes
      : Array.from({ length: level.tileTypes ?? game.config.tileTypes.length }, (_, i) => i);
    const rng = createRng(level.seed ?? 1);
    const ids = { n: 0 };
    const board = generateBoard(level, types, rng, ids);
    S = {
      level, types, rng, ids, board,
      score: 0,
      movesLeft: level.moves,
      goals: new Map(), // индекс цели -> current
      over: false,
      busy: false,
      collecting: false, // идёт match:found: ловим special:created / special:fired
      keep: new Set(),
      extra: [],
    };
    bus.emit('level:start', { board: cloneBoard(board), level });
    bus.emit('moves:changed', { left: S.movesLeft });
    bus.emit('score:changed', { score: 0, delta: 0 });
  }

  // Спецфишка, созданная mechanics во время match:found, остаётся на поле.
  bus.on('special:created', ({ at, special }) => {
    if (!S?.collecting) return;
    const tile = S.board.cells[at.r]?.[at.c]?.tile;
    if (!tile) return;
    tile.special = special;
    S.keep.add(key(at.r, at.c));
  });

  // Клетки спецфишки добавляются к очистке текущего шага.
  bus.on('special:fired', ({ affected }) => {
    if (S?.collecting) S.extra.push(...affected);
  });

  bus.on('goal:progress', ({ goal, current }) => {
    if (!S) return;
    const i = goalIndex(goal);
    if (i >= 0) S.goals.set(i, current);
  });

  bus.on('level:load', ({ level }) => startLevel(level));
  bus.on('input:swap', ({ from, to }) => trySwap(from, to));

  function addScore(delta) {
    S.score += delta;
    bus.emit('score:changed', { score: S.score, delta });
    S.level.goals.forEach((goal) => {
      if (goal.kind === 'score') bus.emit('goal:progress', { goal, current: S.score });
    });
  }

  function clearStep(groups, chain, trigger) {
    S.keep = new Set();
    S.extra = [];
    S.collecting = true;
    bus.emit('match:found', { groups, chain, trigger });
    S.collecting = false;

    const toClear = new Map();
    const add = (p) => {
      const k = key(p.r, p.c);
      if (S.keep.has(k) || toClear.has(k)) return;
      const tile = S.board.cells[p.r]?.[p.c]?.tile;
      if (tile) toClear.set(k, { r: p.r, c: p.c, type: tile.type });
    };
    for (const g of groups) g.cells.forEach(add);
    S.extra.forEach(add);
    if (!toClear.size) return false;

    const cells = [...toClear.values()];
    for (const p of cells) S.board.cells[p.r][p.c].tile = null;
    bus.emit('tiles:cleared', { cells, chain });
    addScore(cells.length * POINTS_PER_TILE * chain);

    const { moves, spawned } = applyGravity(S.board, S.types, S.rng, S.ids);
    if (moves.length || spawned.length) {
      bus.emit('tiles:fell', {
        moves: moves.map((m) => ({ ...m, tile: cloneTile(m.tile) })),
        spawned: spawned.map((s) => ({ to: s.to, tile: cloneTile(s.tile) })),
      });
    }
    return true;
  }

  function resolve(swap, trigger) {
    let chain = 0;
    for (;;) {
      const first = chain === 0;
      const groups = findMatches(S.board, first ? swap : []);
      if (!groups.length && !(first && trigger)) break;
      chain++;
      if (!clearStep(groups, chain, first ? trigger : null)) break;
    }
    if (!hasMove(S.board) && shuffleBoard(S.board, S.types, S.rng)) {
      bus.emit('board:shuffled', { board: cloneBoard(S.board) });
    }
    bus.emit('board:settled', { board: cloneBoard(S.board) });
  }

  function goalsDone() {
    const { goals, stars } = S.level;
    if (!goals?.length) return S.score >= (stars?.[0] ?? Infinity);
    return goals.every((g, i) => (S.goals.get(i) ?? 0) >= g.amount);
  }

  function checkOutcome() {
    if (goalsDone()) {
      S.over = true;
      const stars = Math.max(1, (S.level.stars ?? []).filter((s) => S.score >= s).length);
      bus.emit('level:won', { score: S.score, stars, movesLeft: S.movesLeft });
    } else if (S.movesLeft <= 0) {
      S.over = true;
      bus.emit('level:failed', { score: S.score });
    }
  }

  function trySwap(from, to) {
    if (!S || S.over || S.busy || S.movesLeft <= 0) return false;
    if (!canSwap(S.board, from, to)) {
      bus.emit('swap:done', { from, to, valid: false });
      return false;
    }
    swapTiles(S.board, from, to);
    const special = hasSpecial(S.board, from) || hasSpecial(S.board, to);
    if (!special && !findMatches(S.board).length) {
      swapTiles(S.board, from, to); // откат: ход не тратится
      bus.emit('swap:done', { from, to, valid: false });
      return false;
    }
    S.busy = true;
    S.movesLeft--;
    bus.emit('swap:done', { from, to, valid: true });
    bus.emit('moves:changed', { left: S.movesLeft });
    try {
      resolve([from, to], special ? { from, to } : null);
    } finally {
      S.busy = false;
    }
    checkOutcome();
    return true;
  }

  game.modules.core = {
    startLevel,
    trySwap,
    getBoard: () => (S ? cloneBoard(S.board) : null),
    hint: () => (S && !S.over ? findMove(S.board) : null),
  };
}
