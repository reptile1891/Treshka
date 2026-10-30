// Урон препятствиям. Источники: 'clear' (очищена фишка в клетке),
// 'adjacent' (очищена соседняя клетка), 'blast' (спецфишка/бустер задел клетку).
import { neighbors4, PosSet } from './board.js';

export function attachDamage(ctx) {
  const { bus, reg, state } = ctx;

  ctx.damage = (p, amount, source) => {
    const cell = ctx.cell(p);
    const ob = cell?.obstacle;
    if (!ob) return false;
    const h = reg.obstacles.get(ob.kind);
    if (!h || !h.damageBy.includes(source)) return false;
    ob.hp = Math.max(0, (ob.hp ?? h.hp) - amount);
    if (ob.hp === 0) {
      cell.obstacle = null;
      state.turn.destroyed.push(ob.kind);
    }
    bus.emit('obstacle:damaged', { at: { r: p.r, c: p.c }, kind: ob.kind, hp: ob.hp });
    if (ob.hp === 0) h.onDestroy?.(p, ob, ctx);
    return true;
  };

  // Спецэффект/бустер задел клетки: бьём препятствия, которым фишка не нужна (ящик, камень).
  ctx.blast = (cells) => {
    for (const p of new PosSet(cells).values()) ctx.damage(p, 1, 'blast');
  };

  // Очищены фишки (tiles:cleared): прямой урон и урон соседям, не больше 1 за пакет.
  ctx.onCleared = (cells) => {
    const adj = new PosSet();
    for (const p of cells) {
      ctx.damage(p, 1, 'clear');
      for (const n of neighbors4(ctx.board(), p.r, p.c)) if (ctx.cell(n).obstacle) adj.add(n);
    }
    for (const n of adj.values()) ctx.damage(n, 1, 'adjacent');
  };

  ctx.createObstacle = (kind, hp) => ({ kind, hp: hp ?? reg.obstacles.get(kind)?.hp ?? 1 });
}
