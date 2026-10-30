// Бустеры. apply(at, ctx) → true, если применён (иначе не списывается).
import { clearable } from '../../board.js';

export function register(api) {
  // Молот: бьёт одну клетку (фишку или стену-препятствие).
  api.registerBooster('hammer', {
    needsTarget: true,
    apply(at, ctx) {
      if (!clearable(ctx.tile(at)) && !ctx.blocked(at)) return false;
      return ctx.strike([at], 'hammer');
    },
  });

  // Цветовая бомба: убирает все фишки цвета выбранной фишки.
  api.registerBooster('colorbomb', {
    needsTarget: true,
    apply(at, ctx) {
      const tile = ctx.tile(at);
      return clearable(tile) && ctx.strike(ctx.ofType(tile.type), 'colorbomb');
    },
  });

  api.registerBooster('shuffle', { apply: (at, ctx) => ctx.shuffle() });

  api.registerBooster('moves', { amount: 5, apply: (at, ctx) => ctx.addMoves(ctx.reg.boosters.get('moves').amount) });
}
