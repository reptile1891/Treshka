// Линейные спецфишки: чистят строку (line_h) или столбец (line_v).
// Как в Candy Crush: горизонтальная четвёрка даёт вертикальную линию и наоборот.
const cross = (a, b, ctx, pivot) => [...ctx.row(pivot.r), ...ctx.col(pivot.c)];

export function register(api) {
  for (const [name, orient] of [['line_h', 'h'], ['line_v', 'v']]) {
    api.registerSpecial(name, {
      priority: 10,
      detect(info) {
        const run = info.runs.find((r) => r.cells.length === 4 && r.dir !== orient);
        if (!run) return null;
        const [a, b, c, d] = run.cells;
        return { anchors: [b, c, a, d] };
      },
      fire: (at, tile, ctx) => (orient === 'h' ? ctx.row(at.r) : ctx.col(at.c)),
      combos: { line_h: cross, line_v: cross }, // две линии = крест
    });
  }
}
