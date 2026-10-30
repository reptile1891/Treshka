// Поиск матчей, определение форм, проверка ходов. Чистые функции над Board.
import { isStatic, isMovable } from './board.js';

const key = (r, c) => r * 1000 + c;
const same = (a, b) => a.r === b.r && a.c === b.c;
const inBounds = (board, p) => p.r >= 0 && p.c >= 0 && p.r < board.rows && p.c < board.cols;
const typeAt = (board, r, c) => board.cells[r][c].tile?.type ?? -1;

function collectRuns(board) {
  const { rows, cols } = board;
  const runs = [];
  const scan = (outer, inner, at, dir) => {
    for (let o = 0; o < outer; o++) {
      let i = 0;
      while (i < inner) {
        const t = at(o, i);
        let e = i;
        if (t >= 0) while (e + 1 < inner && at(o, e + 1) === t) e++;
        if (t >= 0 && e - i >= 2) {
          const cells = [];
          for (let k = i; k <= e; k++) cells.push(dir === 'h' ? { r: o, c: k } : { r: k, c: o });
          runs.push({ dir, type: t, cells });
        }
        i = e + 1;
      }
    }
  };
  scan(rows, cols, (r, c) => typeAt(board, r, c), 'h');
  scan(cols, rows, (c, r) => typeAt(board, r, c), 'v');
  return runs;
}

function buildGroup(runs, preferred) {
  const seen = new Map();
  for (const run of runs) for (const p of run.cells) seen.set(key(p.r, p.c), p);
  const cells = [...seen.values()].sort((a, b) => a.r - b.r || a.c - b.c);
  const hs = runs.filter((x) => x.dir === 'h');
  const vs = runs.filter((x) => x.dir === 'v');
  const isEnd = (run, p) => same(run.cells[0], p) || same(run.cells[run.cells.length - 1], p);
  let shape, dir = null, at;
  if (hs.length && vs.length) {
    // Форма L/T по точке пересечения; L — если она крайняя в обеих линиях.
    let best = null;
    for (const h of hs) for (const v of vs) for (const p of h.cells) {
      if (!v.cells.some((q) => same(p, q))) continue;
      const isL = isEnd(h, p) && isEnd(v, p);
      if (!best || (!isL && best.isL)) best = { p, isL };
    }
    shape = best.isL ? 'L' : 'T';
    at = best.p;
  } else {
    const run = runs[0];
    const n = run.cells.length;
    shape = n >= 5 ? 'line5' : n === 4 ? 'line4' : 'line3';
    dir = run.dir;
    at = preferred.find((p) => seen.has(key(p.r, p.c))) ?? run.cells[Math.floor((n - 1) / 2)];
  }
  return { cells, type: runs[0].type, shape, dir, at: { r: at.r, c: at.c } };
}

// preferred — клетки свайпа: спецфишка создаётся там, где игрок сделал ход.
export function findMatches(board, preferred = []) {
  const runs = collectRuns(board);
  const parent = runs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map();
  runs.forEach((run, i) => {
    for (const p of run.cells) {
      const k = key(p.r, p.c);
      if (owner.has(k)) parent[find(i)] = find(owner.get(k));
      else owner.set(k, i);
    }
  });
  const comps = new Map();
  runs.forEach((run, i) => {
    const root = find(i);
    if (!comps.has(root)) comps.set(root, []);
    comps.get(root).push(run);
  });
  return [...comps.values()].map((rs) => buildGroup(rs, preferred));
}

export function canSwap(board, a, b) {
  if (!inBounds(board, a) || !inBounds(board, b)) return false;
  if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return false;
  return isMovable(board.cells[a.r][a.c]) && isMovable(board.cells[b.r][b.c]);
}

export function swapTiles(board, a, b) {
  const ca = board.cells[a.r][a.c];
  const cb = board.cells[b.r][b.c];
  [ca.tile, cb.tile] = [cb.tile, ca.tile];
}

// Есть ли тройка через клетку (r,c).
function matchesAt(board, r, c) {
  const t = typeAt(board, r, c);
  if (t < 0) return false;
  const len = (dr, dc) => {
    let n = 0;
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && cc >= 0 && rr < board.rows && cc < board.cols && typeAt(board, rr, cc) === t) {
      n++; rr += dr; cc += dc;
    }
    return n;
  };
  return len(0, -1) + len(0, 1) >= 2 || len(-1, 0) + len(1, 0) >= 2;
}

export const hasSpecial = (board, p) => !!board.cells[p.r][p.c].tile?.special;

// Первый возможный ход (обмен соседних фишек) или null.
export function findMove(board) {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const a = { r, c };
        const b = { r: r + dr, c: c + dc };
        if (!canSwap(board, a, b)) continue;
        if (hasSpecial(board, a) || hasSpecial(board, b)) return { from: a, to: b };
        swapTiles(board, a, b);
        const ok = matchesAt(board, a.r, a.c) || matchesAt(board, b.r, b.c);
        swapTiles(board, a, b);
        if (ok) return { from: a, to: b };
      }
    }
  }
  return null;
}

export const hasMove = (board) => findMove(board) !== null;
export { isStatic };
