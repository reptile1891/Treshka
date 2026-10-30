// Гравитация и спавн. Фишки падают внутри сегментов колонки между неподвижными клетками;
// новые появляются только в верхнем сегменте (начинающемся с ряда 0).
import { isStatic, newTile } from './board.js';

export function applyGravity(board, types, rng, ids) {
  const moves = [];
  const spawned = [];
  const { rows, cols, cells } = board;
  for (let c = 0; c < cols; c++) {
    let bottom = rows - 1;
    while (bottom >= 0) {
      if (isStatic(cells[bottom][c])) { bottom--; continue; }
      let top = bottom;
      while (top > 0 && !isStatic(cells[top - 1][c])) top--;
      let write = bottom;
      for (let r = bottom; r >= top; r--) {
        const tile = cells[r][c].tile;
        if (!tile) continue;
        if (r !== write) {
          cells[write][c].tile = tile;
          cells[r][c].tile = null;
          moves.push({ from: { r, c }, to: { r: write, c }, tile });
        }
        write--;
      }
      if (top === 0) {
        for (let r = write; r >= 0; r--) {
          const tile = newTile(types[rng.int(types.length)], ids);
          cells[r][c].tile = tile;
          spawned.push({ to: { r, c }, tile });
        }
      }
      bottom = top - 1;
    }
  }
  return { moves, spawned };
}
