// Модель поля: Board / Cell / Tile из CONTRACTS.md. Чистые функции, без шины и canvas.
const OBSTACLE_CHARS = { i: 'ice', c: 'chain', x: 'crate', s: 'slime', '#': 'hole' };

// Неподвижные клетки: дыра и непробитый ящик. Фишки через них не падают.
export const isStatic = (cell) =>
  !!cell.obstacle && (cell.obstacle.kind === 'hole' || (cell.obstacle.kind === 'crate' && cell.obstacle.hp > 0));

// Фишку можно двигать свайпом (не пустая, не в статичной клетке, не в цепи).
export const isMovable = (cell) => !!cell.tile && !isStatic(cell) && cell.obstacle?.kind !== 'chain';

export const newTile = (type, ids) => ({ id: ++ids.n, type, special: null });

export function createEmptyBoard(cols, rows, layout = []) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const kind = OBSTACLE_CHARS[layout[r]?.[c]];
      row.push({ tile: null, obstacle: kind ? { kind, hp: 1 } : null });
    }
    cells.push(row);
  }
  return { cols, rows, cells };
}

export const cloneTile = (t) => (t ? { ...t } : null);

export function cloneBoard(board) {
  return {
    cols: board.cols,
    rows: board.rows,
    cells: board.cells.map((row) =>
      row.map((cell) => ({ tile: cloneTile(cell.tile), obstacle: cell.obstacle ? { ...cell.obstacle } : null })),
    ),
  };
}

const typeAt = (board, r, c) => (r < 0 || c < 0 ? -1 : board.cells[r][c].tile?.type ?? -1);

// Тип, не замыкающий тройку с двумя соседями слева или сверху.
export function pickType(board, r, c, types, rng) {
  const bad = new Set();
  const l1 = typeAt(board, r, c - 1);
  if (c >= 2 && l1 >= 0 && l1 === typeAt(board, r, c - 2)) bad.add(l1);
  const u1 = typeAt(board, r - 1, c);
  if (r >= 2 && u1 >= 0 && u1 === typeAt(board, r - 2, c)) bad.add(u1);
  const ok = types.filter((t) => !bad.has(t));
  return ok[rng.int(ok.length)];
}
