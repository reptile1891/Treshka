// Радуга из 5 в ряд. Сама по себе (цепочкой) чистит самый частый цвет;
// при свапе с фишкой — весь цвет этой фишки; с другой спецфишкой — превращает цвет в такие спецфишки.
function rainbowCombo(a, b, ctx) {
  if (b.special === 'rainbow') return ctx.all();
  const cells = ctx.ofType(b.tile.type);
  if (!b.special) return [a.at, ...cells];
  const names = b.special.startsWith('line_') ? ['line_h', 'line_v'] : [b.special];
  return [a.at, ...cells.flatMap((p, i) => ctx.fireAs(names[i % names.length], p, b.tile))];
}

export function register(api) {
  api.registerSpecial('rainbow', {
    priority: 40,
    detect(info) {
      const run = info.runs.find((r) => r.cells.length >= 5);
      if (!run) return null;
      return { anchors: [run.cells[Math.floor(run.cells.length / 2)], ...run.cells] };
    },
    fire(at, tile, ctx) {
      const type = ctx.mostCommonType();
      return type == null ? [at] : [at, ...ctx.ofType(type)];
    },
    combos: { '*': rainbowCombo },
  });
}
