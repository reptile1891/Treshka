// Модуль "core". Контракт: см. CONTRACTS.md
// Движок синхронный: свайп -> матчи -> очистка -> гравитация -> каскады -> turn:end, события идут по порядку.
// Canvas и анимации здесь не трогаем — представление слушает события.
// Доска живая (общая с mechanics): getBoard() и payload'ы событий отдают её без копирования.
import { defaultEnv, cloneTile } from './board.js';
import { createRng } from './rng.js';
import { generateBoard, shuffleBoard } from './generate.js';
import { findMatches, findMove, hasMove, canSwap, swapTiles } from './match.js';
import { applyGravity } from './gravity.js';

const POINTS_PER_TILE = 10;
const MAX_TURN_PASSES = 50; // защита от бесконечного turn:end -> clear -> turn:end
const key = (r, c) => r * 1000 + c;

export function init(game) {
  const { bus } = game;
  let S = null; // состояние текущего уровня

  const mech = () => game.modules.mechanics;
  // Стены и цепи определяет mechanics (если он есть), иначе встроенные правила.
  const envFor = (board) => {
    const m = mech();
    return m ? { wall: (r, c) => m.isBlocked(r, c), locked: (r, c) => m.isLocked(r, c) } : defaultEnv(board);
  };
  const env = () => envFor(S.board);

  function startLevel(level) {
    const types = Array.isArray(level.tileTypes)
      ? level.tileTypes
      : Array.from({ length: level.tileTypes ?? game.config.tileTypes.length }, (_, i) => i);
    const rng = createRng(level.seed ?? 1);
    const ids = { n: 0 };
    const empty = game.modules.levels?.buildBoard?.(level) ?? null;
    // При генерации mechanics ещё не видит доску, поэтому используем встроенные правила стен.
    const board = generateBoard(level, empty, defaultEnv, types, rng, ids);
    S = {
      level, types, rng, ids, board,
      score: 0,
      movesLeft: level.moves,
      goalsComplete: false,
      over: false,
      busy: false,
    };
    bus.emit('level:start', { board, level });
    bus.emit('moves:changed', { left: S.movesLeft });
    bus.emit('score:changed', { score: 0, delta: 0 });
  }

  bus.on('level:load', ({ level }) => startLevel(level));
  bus.on('input:swap', ({ from, to }) => trySwap(from, to));
  bus.on('goals:complete', () => { if (S) S.goalsComplete = true; });

  // Внеходовые запросы mechanics: решаем синхронно, очистку начинаем после возврата из emit.
  const idle = () => S && !S.over && !S.busy;

  bus.on('clear:request', (req) => {
    if (!idle()) { req.rejected = true; return; }
    S.busy = true;
    queueMicrotask(() => {
      try {
        clearCells(req.cells ?? [], 1);
        fall(); // mechanics мог снять ящик/камень — освободившиеся клетки заполняем
        settle(0);
      } finally {
        S.busy = false;
      }
      checkOutcome();
    });
  });

  bus.on('moves:add', (req) => {
    if (!idle() || !(req.n > 0)) { req.rejected = true; return; }
    S.movesLeft += req.n;
    bus.emit('moves:changed', { left: S.movesLeft });
  });

  bus.on('shuffle:request', (req) => {
    if (!idle() || !shuffleBoard(S.board, env(), S.types, S.rng)) { req.rejected = true; return; }
    bus.emit('board:shuffled', { board: S.board });
  });

  function addScore(delta) {
    if (!delta) return;
    S.score += delta;
    bus.emit('score:changed', { score: S.score, delta });
  }

  // Убирает фишки из клеток, считает очки. Возвращает число очищенных.
  function clearCells(list, chain) {
    const seen = new Set();
    const cells = [];
    for (const p of list) {
      const k = key(p.r, p.c);
      const tile = S.board.cells[p.r]?.[p.c]?.tile;
      if (seen.has(k) || !tile) continue;
      seen.add(k);
      cells.push({ r: p.r, c: p.c, type: tile.type });
    }
    if (!cells.length) return 0;
    for (const p of cells) S.board.cells[p.r][p.c].tile = null;
    // tiles:cleared идёт до гравитации: mechanics успевает снять препятствия и освободить клетки.
    bus.emit('tiles:cleared', { cells, chain });
    addScore(cells.filter((p) => p.type >= 0).length * POINTS_PER_TILE * chain);
    return cells.length;
  }

  function fall() {
    const { moves, spawned } = applyGravity(S.board, env(), S.types, S.rng, S.ids);
    if (!moves.length && !spawned.length) return;
    bus.emit('tiles:fell', {
      moves: moves.map((m) => ({ ...m, tile: cloneTile(m.tile) })),
      spawned: spawned.map((s) => ({ to: s.to, tile: cloneTile(s.tile) })),
    });
  }

  // Один шаг каскада: match:found -> очистка групп (минус keep, плюс extra) -> гравитация.
  function matchStep(groups, chain, swap) {
    const payload = { groups, chain, swap, trigger: swap, keep: [], extra: [] };
    bus.emit('match:found', payload);
    const keep = new Set(payload.keep.map((p) => key(p.r, p.c)));
    const cells = [...groups.flatMap((g) => g.cells), ...payload.extra].filter((p) => !keep.has(key(p.r, p.c)));
    const n = clearCells(cells, chain);
    fall();
    return n > 0;
  }

  // Каскады до тех пор, пока на доске есть матчи. chain — сколько шагов уже было.
  function cascade(chain, swap) {
    for (;;) {
      const groups = findMatches(S.board, swap ?? []);
      if (!groups.length) return chain;
      chain++;
      const ok = matchStep(groups, chain, swap && chain === 1 ? { from: swap[0], to: swap[1] } : null);
      swap = null;
      if (!ok) return chain;
    }
  }

  // Доска успокаивается: каскады, при необходимости перемешивание, turn:end (тихий — когда никто ничего не просит).
  function settle(chain, swap) {
    cascade(chain, swap);
    for (let pass = 0; pass < MAX_TURN_PASSES; pass++) {
      if (!hasMove(S.board, env()) && shuffleBoard(S.board, env(), S.types, S.rng)) {
        bus.emit('board:shuffled', { board: S.board });
      }
      const payload = { board: S.board, clear: [], dirty: false };
      bus.emit('turn:end', payload);
      if (!payload.clear.length && !payload.dirty) break;
      clearCells(payload.clear, 1);
      fall();
      cascade(0);
    }
    bus.emit('board:settled', { board: S.board });
  }

  function checkOutcome() {
    if (S.over) return;
    const { level } = S;
    if (S.goalsComplete || (!mech() && S.score >= (level.stars?.[0] ?? Infinity))) {
      S.over = true;
      const stars = Math.max(1, (level.stars ?? []).filter((s) => S.score >= s).length);
      bus.emit('level:won', { score: S.score, stars, movesLeft: S.movesLeft });
    } else if (S.movesLeft <= 0) {
      S.over = true;
      bus.emit('level:failed', { score: S.score });
    }
  }

  function trySwap(from, to) {
    if (!S || S.over || S.busy || S.movesLeft <= 0) return false;
    if (game.modules.render?.isBusy?.()) return false; // ждём конца анимаций
    const e = env();
    if (!canSwap(S.board, e, from, to)) {
      bus.emit('swap:done', { from, to, valid: false });
      return false;
    }
    const ta = S.board.cells[from.r][from.c].tile;
    const tb = S.board.cells[to.r][to.c].tile;
    // resolveSwap с побочными эффектами: вызываем только когда это комбо и свап точно состоится.
    const combo = ta.special || tb.special ? mech()?.resolveSwap(from, to) ?? null : null;
    swapTiles(S.board, from, to);
    if (!combo && !findMatches(S.board).length) {
      swapTiles(S.board, from, to); // откат: ход не тратится
      bus.emit('swap:done', { from, to, valid: false });
      return false;
    }
    S.busy = true;
    S.movesLeft--;
    bus.emit('swap:done', { from, to, valid: true });
    bus.emit('moves:changed', { left: S.movesLeft });
    try {
      if (combo) {
        clearCells(combo.cells, 1);
        fall();
        settle(1);
      } else {
        settle(0, [from, to]);
      }
    } finally {
      S.busy = false;
    }
    checkOutcome();
    return true;
  }

  game.modules.core = {
    startLevel,
    trySwap,
    getBoard: () => S?.board ?? null,
    hint() {
      const move = S && !S.over ? findMove(S.board, env()) : null;
      if (move) bus.emit('hint:show', { cells: [move.from, move.to] });
      return move;
    },
  };
}
