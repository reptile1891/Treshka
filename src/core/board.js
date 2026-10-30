// Модель поля: Board / Cell / Tile из CONTRACTS.md. Чистые функции, без шины и canvas.
// env = { wall(r,c), locked(r,c) } подключает препятствия mechanics; без него — встроенные правила.
const LAYOUT_OBSTACLES = {
  i: ['ice', 1], I: ['ice', 2], c: ['chain', 1], C: ['chain', 2],
  x: ['crate', 1], X: ['crate', 2], s: ['slime', 1],
};
const WALL_KINDS = new Set(['crate', 'stone', 'slime']);

export function defaultEnv(board) {
  const ob = (r, c) => board.cells[r]?.[c]?.obstacle;
  return {
    wall: (r, c) => !!board.cells[r]?.[c]?.hole || (WALL_KINDS.has(ob(r, c)?.kind) && ob(r, c).hp > 0),
    locked: (r, c) => ob(r, c)?.kind === 'chain',
  };
}

// Клетка-стена: дыра или препятствие, блокирующее фишку. Фишки в ней не лежат и через неё не падают.
export const isWall = (board, env, r, c) => !!board.cells[r][c].hole || env.wall(r, c);

// Фишку можно двигать свайпом (есть, не в стене, не в цепи).
export const isMovable = (board, env, r, c) =>
  !!board.cells[r][c].tile && !isWall(board, env, r, c) && !env.locked(r, c);

export const newTile = (type, ids) => ({ id: ++ids.n, type, special: null });

// Пустое поле из layout (запасной вариант, если нет levels.buildBoard).
export function createEmptyBoard(cols, rows, layout = []) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const ch = layout[r]?.[c];
      const o = LAYOUT_OBSTACLES[ch];
      row.push({ tile: null, obstacle: o ? { kind: o[0], hp: o[1] } : null, hole: ch === '#' });
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
      row.map((cell) => ({
        tile: cloneTile(cell.tile), obstacle: cell.obstacle ? { ...cell.obstacle } : null, hole: !!cell.hole,
      })),
    ),
  };
}

const typeAt = (board, r, c) => (r < 0 || c < 0 ? -1 : board.cells[r][c].tile?.type ?? -1);

// Тип, не замыкающий тройку или квадрат 2x2 с уже стоящими слева/сверху фишками.
export function pickType(board, r, c, types, rng) {
  const bad = new Set();
  const l1 = typeAt(board, r, c - 1);
  if (c >= 2 && l1 >= 0 && l1 === typeAt(board, r, c - 2)) bad.add(l1);
  const u1 = typeAt(board, r - 1, c);
  if (r >= 2 && u1 >= 0 && u1 === typeAt(board, r - 2, c)) bad.add(u1);
  if (l1 >= 0 && l1 === u1 && l1 === typeAt(board, r - 1, c - 1)) bad.add(l1);
  const ok = types.filter((t) => !bad.has(t));
  return (ok.length ? ok : types)[rng.int(ok.length || types.length)];
}
