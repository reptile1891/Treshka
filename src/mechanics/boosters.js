// Бустеры: useBooster / input:booster и общий strike для бустеров, бьющих по клеткам.
import { clearable } from './board.js';

export function attachBoosters(ctx) {
  const { bus, reg } = ctx;
  const pos = (p) => ({ r: p.r, c: p.c });

  // Ударить по клеткам: спецфишки в зоне срабатывают цепочкой, фишки чистит core.
  ctx.strike = (cells, source) => {
    const all = ctx.expand(cells);
    const req = { cells: all.filter((p) => clearable(ctx.tile(p))).map(pos), source };
    bus.emit('clear:request', req);
    if (req.rejected) return false;
    ctx.blast(all); // core начинает очистку после возврата из emit, так что клетки освободятся вовремя
    return true;
  };

  ctx.addMoves = (n) => {
    const req = { n };
    bus.emit('moves:add', req);
    return !req.rejected;
  };

  ctx.shuffle = () => {
    const req = {};
    bus.emit('shuffle:request', req);
    return !req.rejected;
  };

  ctx.useBooster = (kind, at) => {
    const h = reg.boosters.get(kind);
    if (!h) return false;
    if (h.needsTarget && !(at && ctx.cell(at))) return false;
    if (!h.apply(at, ctx)) return false;
    ctx.state.turn = ctx.freshTurn(); // бустер — не ход игрока
    bus.emit('booster:used', { kind, at: at ? pos(at) : undefined });
    return true;
  };

  bus.on('input:booster', ({ kind, at }) => ctx.useBooster(kind, at));
}
