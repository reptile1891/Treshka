// Препятствия. damageBy: 'clear' — очищена фишка в клетке, 'adjacent' — очищена соседняя клетка,
// 'blast' — задела спецфишка/бустер. hp — число слоёв (многослойные ящики и т.п.).
import { isItem } from '../../board.js';

export function register(api) {
  // Лёд под фишкой: ломается, когда фишку в клетке очистили.
  api.registerObstacle('ice', { hp: 1, damageBy: ['clear'] });

  // Цепь: фишку нельзя двигать, но можно матчить; ломается как лёд.
  api.registerObstacle('chain', { hp: 1, locksSwap: true, damageBy: ['clear'] });

  // Ящик: стена, бьётся соседними матчами и спецфишками. Слои — через hp.
  api.registerObstacle('crate', { hp: 1, blocksTile: true, damageBy: ['adjacent', 'blast'] });

  // Камень: стена, бьётся только спецфишками и бустерами.
  api.registerObstacle('stone', { hp: 1, blocksTile: true, damageBy: ['blast'] });

  // Слизь: стена; если за ход не разрушена ни одна слизь, расползается в соседнюю клетку.
  api.registerObstacle('slime', {
    hp: 1,
    blocksTile: true,
    damageBy: ['adjacent', 'blast'],
    onTurnEnd(ctx, turn, payload) {
      if (turn.destroyed.includes('slime')) return;
      const options = [];
      for (const from of ctx.all()) {
        if (ctx.cell(from).obstacle?.kind !== 'slime') continue;
        for (const to of ctx.neighbors(from)) {
          const cell = ctx.cell(to);
          if (!cell.obstacle && cell.tile && !isItem(cell.tile)) options.push({ from, to });
        }
      }
      if (!options.length) return;
      const { from, to } = options[Math.floor(ctx.rng() * options.length)];
      const cell = ctx.cell(to);
      cell.tile = null;
      cell.obstacle = ctx.createObstacle('slime');
      ctx.bus.emit('obstacle:spawned', { at: to, kind: 'slime', hp: cell.obstacle.hp, from });
      payload.dirty = true;
    },
  });
}
