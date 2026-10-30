// Хелперы доступа к доске. Позиция: { r, c }, r=0 сверху.
export const inBounds = (b, r, c) => r >= 0 && c >= 0 && r < b.rows && c < b.cols;
export const cellAt = (b, r, c) => (inBounds(b, r, c) ? b.cells[r][c] : null);
export const tileAt = (b, r, c) => cellAt(b, r, c)?.tile ?? null;
export const isItem = (t) => !!t && t.type < 0;
// Фишку можно очищать спецэффектами (предметы — нет).
export const clearable = (t) => !!t && t.type >= 0;

export const DIRS4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// Множество позиций с дедупликацией.
export class PosSet {
  constructor(items = []) {
    this.map = new Map();
    for (const p of items) this.add(p);
  }
  static k(p) { return p.r * 1000 + p.c; }
  add(p) { this.map.set(PosSet.k(p), { r: p.r, c: p.c }); return this; }
  has(p) { return this.map.has(PosSet.k(p)); }
  get size() { return this.map.size; }
  values() { return [...this.map.values()]; }
}

export function neighbors4(b, r, c) {
  const out = [];
  for (const [dr, dc] of DIRS4) if (inBounds(b, r + dr, c + dc)) out.push({ r: r + dr, c: c + dc });
  return out;
}

export function allPositions(b) {
  const out = [];
  for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) out.push({ r, c });
  return out;
}

export const rowCells = (b, r) => Array.from({ length: b.cols }, (_, c) => ({ r, c }));
export const colCells = (b, c) => Array.from({ length: b.rows }, (_, r) => ({ r, c }));

// Квадрат (2*rad+1)² вокруг точки, обрезанный по границам.
export function squareCells(b, r, c, rad) {
  const out = [];
  for (let rr = r - rad; rr <= r + rad; rr++)
    for (let cc = c - rad; cc <= c + rad; cc++) if (inBounds(b, rr, cc)) out.push({ r: rr, c: cc });
  return out;
}

export const cellsOfType = (b, type) =>
  allPositions(b).filter((p) => tileAt(b, p.r, p.c)?.type === type);

export function mostCommonType(b, rng = Math.random) {
  const cnt = new Map();
  for (const p of allPositions(b)) {
    const t = tileAt(b, p.r, p.c);
    if (clearable(t)) cnt.set(t.type, (cnt.get(t.type) ?? 0) + 1);
  }
  let best = [], max = 0;
  for (const [type, n] of cnt) {
    if (n > max) { max = n; best = [type]; } else if (n === max) best.push(type);
  }
  return best.length ? best[Math.floor(rng() * best.length)] : null;
}

export function shuffled(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Разбор группы матча: прямые (≥3) по строкам/столбцам и квадраты 2x2.
export function analyzeGroup(cells) {
  const set = new PosSet(cells);
  const runs = [];
  for (const p of set.values()) {
    for (const [dir, dr, dc] of [['h', 0, 1], ['v', 1, 0]]) {
      if (set.has({ r: p.r - dr, c: p.c - dc })) continue; // не начало прямой
      const run = [];
      for (let q = p; set.has(q); q = { r: q.r + dr, c: q.c + dc }) run.push(q);
      if (run.length >= 3) runs.push({ dir, cells: run });
    }
  }
  const squares = [];
  for (const p of set.values()) {
    const sq = [p, { r: p.r, c: p.c + 1 }, { r: p.r + 1, c: p.c }, { r: p.r + 1, c: p.c + 1 }];
    if (sq.every((q) => set.has(q))) squares.push(sq);
  }
  return { set, runs, squares };
}
