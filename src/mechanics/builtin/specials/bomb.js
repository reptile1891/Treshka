// Бомба из L/T-матча: взрыв 3x3.
const same = (p, q) => p.r === q.r && p.c === q.c;
// Линия + бомба: три строки и три столбца вокруг точки свапа.
const lineBomb = (a, b, ctx, pivot) =>
  [-1, 0, 1].flatMap((d) => [...ctx.row(pivot.r + d), ...ctx.col(pivot.c + d)]);

export function register(api) {
  api.registerSpecial('bomb', {
    priority: 30,
    detect(info) {
      const hs = info.runs.filter((r) => r.dir === 'h');
      const vs = info.runs.filter((r) => r.dir === 'v');
      const anchors = hs.flatMap((h) => h.cells.filter((p) => vs.some((v) => v.cells.some((q) => same(p, q)))));
      return anchors.length ? { anchors } : null;
    },
    fire: (at, tile, ctx) => ctx.square(at, 1),
    combos: {
      bomb: (a, b, ctx, pivot) => ctx.square(pivot, 2), // две бомбы = 5x5
      line_h: lineBomb,
      line_v: lineBomb,
    },
  });
}
