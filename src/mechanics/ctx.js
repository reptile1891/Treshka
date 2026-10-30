// Контекст, который получают все обработчики механик.
import {
  cellAt, tileAt, clearable, neighbors4, allPositions, rowCells, colCells, squareCells,
  cellsOfType, mostCommonType, shuffled, PosSet,
} from './board.js';

export function createCtx(game, reg, state) {
  const ctx = {
    game, reg, state, bus: game.bus,
    rng: Math.random,
    board: () => game.modules.core?.getBoard?.() ?? state.board,
    // Подсказки от целей: какие цвета/препятствия сейчас нужны (заполняет goals.js).
    goalHints: () => ({ types: new Set(), obstacleKinds: new Set() }),
  };
  const b = () => ctx.board();

  Object.assign(ctx, {
    cell: (p) => cellAt(b(), p.r, p.c),
    tile: (p) => tileAt(b(), p.r, p.c),
    neighbors: (p) => neighbors4(b(), p.r, p.c),
    row: (r) => (r >= 0 && r < b().rows ? rowCells(b(), r) : []),
    col: (c) => (c >= 0 && c < b().cols ? colCells(b(), c) : []),
    square: (p, rad) => squareCells(b(), p.r, p.c, rad),
    all: () => allPositions(b()),
    ofType: (type) => cellsOfType(b(), type),
    mostCommonType: () => mostCommonType(b(), ctx.rng),

    // Клетка — стена (ящик/камень/слизь): фишки в ней не лежат и не падают.
    blocked(p) {
      const ob = cellAt(b(), p.r, p.c)?.obstacle;
      return !!ob && !!reg.obstacles.get(ob.kind)?.blocksTile;
    },
    // Фишку в клетке нельзя двигать (цепь).
    locked(p) {
      const ob = cellAt(b(), p.r, p.c)?.obstacle;
      return !!ob && !!reg.obstacles.get(ob.kind)?.locksSwap;
    },

    // До n целей для самолётика: препятствия цели → нужные цвета → любые фишки.
    pickTargets(n, exclude = new PosSet()) {
      const hints = ctx.goalHints();
      const free = ctx.all().filter((p) => !exclude.has(p));
      const withTile = free.filter((p) => clearable(ctx.tile(p)));
      const pools = [
        free.filter((p) => {
          const ob = ctx.cell(p).obstacle;
          return ob && (!hints.obstacleKinds.size || hints.obstacleKinds.has(ob.kind));
        }),
        withTile.filter((p) => hints.types.has(ctx.tile(p).type)),
        withTile,
      ];
      const out = new PosSet();
      for (const pool of pools) {
        for (const p of shuffled(pool, ctx.rng)) {
          if (out.size >= n) break;
          out.add(p);
        }
      }
      return out.values();
    },

    // Сработать как спецфишка `name` в точке p (для комбо радуги).
    fireAs(name, p, tile) {
      return reg.specials.get(name)?.fire(p, tile, ctx) ?? [];
    },
  });
  return ctx;
}
