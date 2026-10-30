// Самолётик из квадрата 2x2: бьёт себя и четырёх соседей, затем летит в цель
// (препятствие из целей → нужный цвет → случайная фишка).
import { PosSet } from '../../board.js';

const pattern = (at, ctx) => [at, ...ctx.neighbors(at)];
const withTargets = (cells, n, ctx) => [...cells, ...ctx.pickTargets(n, new PosSet(cells))];

export function register(api) {
  const lineCombo = (a, b, ctx) => {
    const cells = pattern(a.at, ctx);
    return [...cells, ...ctx.pickTargets(1, new PosSet(cells)).flatMap((t) => [...ctx.row(t.r), ...ctx.col(t.c)])];
  };
  api.registerSpecial('plane', {
    priority: 20,
    detect(info) {
      const sq = info.squares[0];
      return sq ? { anchors: sq } : null;
    },
    fire: (at, tile, ctx) => withTargets(pattern(at, ctx), 1, ctx),
    combos: {
      plane: (a, b, ctx) => withTargets([...pattern(a.at, ctx), ...pattern(b.at, ctx)], 3, ctx), // три цели
      bomb: (a, b, ctx) => {
        const cells = pattern(a.at, ctx);
        return [...cells, ...ctx.pickTargets(1, new PosSet(cells)).flatMap((t) => ctx.square(t, 2))];
      },
      line_h: lineCombo,
      line_v: lineCombo,
    },
  });
}
