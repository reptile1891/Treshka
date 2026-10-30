// Модуль "mechanics": спецфишки, препятствия, бустеры, цели. Контракт: см. CONTRACTS.md
import { createRegistry } from './registry.js';
import { createCtx } from './ctx.js';
import { attachDamage } from './damage.js';
import { attachMatch } from './match.js';
import { attachBoosters } from './boosters.js';
import { attachGoals } from './goals.js';
import { registerBuiltins } from './builtin/index.js';
import { isItem } from './board.js';

const freshTurn = (moved = false) => ({ moved, processed: false, destroyed: [] });

export function init(game) {
  const reg = createRegistry();
  const state = { board: null, lastSwap: null, turn: freshTurn(), goals: [], completed: false };
  const ctx = createCtx(game, reg, state);
  ctx.freshTurn = freshTurn;
  attachDamage(ctx);
  attachMatch(ctx);
  attachBoosters(ctx);
  attachGoals(ctx);
  registerBuiltins(reg);
  ctx.wireGoals();

  const { bus } = game;

  bus.on('level:start', ({ board, level }) => {
    state.board = board;
    state.lastSwap = null;
    state.turn = freshTurn();
    for (const row of board.cells) {
      for (const cell of row) if (cell.obstacle) cell.obstacle.hp ??= reg.obstacles.get(cell.obstacle.kind)?.hp ?? 1;
    }
    ctx.startGoals(level);
  });
  bus.on('board:shuffled', ({ board }) => { state.board = board; });
  bus.on('input:swap', (swap) => { state.lastSwap = swap; });
  bus.on('swap:done', ({ from, to, valid }) => {
    if (!valid) return;
    state.lastSwap = { from, to };
    state.turn = freshTurn(true);
  });
  bus.on('match:found', ctx.onMatch);
  bus.on('tiles:cleared', ({ cells }) => ctx.onCleared(cells));

  // Доска успокоилась: ход-зависимые препятствия (слизь) и предметы у нижней границы.
  bus.on('turn:end', (payload) => {
    payload.clear ??= [];
    if (state.turn.moved && !state.turn.processed) {
      state.turn.processed = true;
      for (const h of reg.obstacles.values()) h.onTurnEnd?.(ctx, state.turn, payload);
    }
    const board = ctx.board();
    const last = board.rows - 1;
    for (let c = 0; c < board.cols; c++) {
      const tile = board.cells[last][c].tile;
      if (!isItem(tile) || !tile.item) continue;
      payload.clear.push({ r: last, c });
      bus.emit('item:dropped', { item: tile.item, at: { r: last, c } });
    }
  });

  game.modules.mechanics = {
    registerSpecial: reg.registerSpecial,
    registerObstacle: reg.registerObstacle,
    registerBooster: reg.registerBooster,
    registerGoal: reg.registerGoal,
    useBooster: ctx.useBooster,
    resolveSwap: ctx.resolveSwap,
    isBlocked: (r, c) => ctx.blocked({ r, c }),
    isLocked: (r, c) => ctx.locked({ r, c }),
    createObstacle: ctx.createObstacle,
    setRng: (fn) => { ctx.rng = fn; }, // для детерминированных тестов
  };
}
