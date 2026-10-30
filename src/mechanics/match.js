// Спецфишки: создание из матчей, цепные срабатывания, комбинации при свапе.
import { analyzeGroup, PosSet, clearable } from './board.js';

export function attachMatch(ctx) {
  const { bus, reg, state } = ctx;
  const pos = (p) => ({ r: p.r, c: p.c });

  // Цепная реакция: seeds — стартовые клетки, skip — спецфишки, которые уже учтены (комбо).
  // Возвращает все задетые клетки (в т.ч. пустые и с препятствиями).
  ctx.expand = (seeds, skip = []) => {
    const all = new PosSet();
    const fired = new PosSet(skip);
    const queue = [...seeds];
    while (queue.length) {
      const p = queue.shift();
      if (all.has(p)) continue;
      all.add(p);
      const tile = ctx.tile(p);
      if (!tile?.special || fired.has(p)) continue;
      fired.add(p);
      const h = reg.specials.get(tile.special);
      if (!h) continue;
      const affected = h.fire(p, tile, ctx);
      bus.emit('special:fired', { at: pos(p), special: tile.special, affected: affected.map(pos) });
      queue.push(...affected);
    }
    return all.values();
  };

  function detectSpecial(group, swap) {
    const info = { ...analyzeGroup(group.cells), group };
    for (const h of reg.detectors()) {
      const res = h.detect(info, ctx);
      if (!res?.anchors?.length) continue;
      const anchors = res.anchors.filter((a) => clearable(ctx.tile(a)));
      if (!anchors.length) continue;
      // Предпочитаем клетку, куда игрок поставил фишку.
      const hit = swap && [swap.to, swap.from].find((s) => anchors.some((a) => a.r === s.r && a.c === s.c));
      return { at: pos(hit ?? anchors[0]), special: h.name };
    }
    return null;
  }

  // match:found — синхронно дописываем payload.keep / payload.extra.
  ctx.onMatch = (payload) => {
    const swap = payload.swap ?? state.lastSwap;
    const groupCells = new PosSet(payload.groups.flatMap((g) => g.cells));
    const spawns = payload.groups.map((g) => detectSpecial(g, swap)).filter(Boolean);

    const seeds = groupCells.values().filter((p) => ctx.tile(p)?.special);
    const affected = ctx.expand(seeds);
    ctx.blast(affected);

    const keep = new PosSet(spawns.map((s) => s.at));
    const extra = affected.filter((p) => !groupCells.has(p) && !keep.has(p) && clearable(ctx.tile(p)));

    // Новые спецфишки ставим после expand, чтобы они не сработали сразу.
    for (const s of spawns) {
      ctx.tile(s.at).special = s.special;
      bus.emit('special:created', { at: s.at, special: s.special });
    }
    payload.keep = [...(payload.keep ?? []), ...keep.values()];
    payload.extra = [...(payload.extra ?? []), ...extra.map(pos)];
  };

  // Ищем обработчик комбо: прямое имя у любой из сторон, затем '*'.
  function findCombo(A, B) {
    const key = (o) => o.special ?? 'tile';
    for (const [X, Y] of [[A, B], [B, A]]) {
      const fn = reg.specials.get(X.special)?.combos?.[key(Y)];
      if (fn) return { fn, X, Y };
    }
    for (const [X, Y] of [[A, B], [B, A]]) {
      const fn = reg.specials.get(X.special)?.combos?.['*'];
      if (fn) return { fn, X, Y };
    }
    return null;
  }

  // Вызывается core перед свапом: спецфишка+спецфишка или радуга+фишка.
  // Возвращает { cells } на очистку или null (обычная логика матчей).
  ctx.resolveSwap = (from, to) => {
    const ta = ctx.tile(from), tb = ctx.tile(to);
    if (!clearable(ta) || !clearable(tb)) return null;
    if (ctx.locked(from) || ctx.locked(to)) return null;
    if (!ta.special && !tb.special) return null;
    const A = { at: pos(from), tile: ta, special: ta.special };
    const B = { at: pos(to), tile: tb, special: tb.special };
    const found = findCombo(A, B);
    if (!found && !(ta.special && tb.special)) return null;

    let seeds = [from, to], skip = [];
    if (found) {
      seeds = [from, to, ...found.fn(found.X, found.Y, ctx, pos(to))];
      skip = [from, to];
      const affected = seeds.map(pos);
      bus.emit('special:fired', { at: pos(to), special: `${ta.special ?? 'tile'}+${tb.special ?? 'tile'}`, affected });
    }
    const all = ctx.expand(seeds, skip);
    ctx.blast(all);
    return { cells: all.filter((p) => clearable(ctx.tile(p))).map(pos) };
  };
}
