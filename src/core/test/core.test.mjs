import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../rng.js';
import { createEmptyBoard, defaultEnv, isWall } from '../board.js';
import { findMatches, findMove, hasMove, canSwap } from '../match.js';
import { applyGravity } from '../gravity.js';
import { generateBoard, shuffleBoard } from '../generate.js';

const fromRows = (rows) => {
  const b = createEmptyBoard(rows[0].length, rows.length);
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '-') b.cells[r][c].tile = { id: r * 10 + c, type: +ch, special: null };
  }));
  return b;
};
const lvl = (layout, cols = layout[0].length) => ({ board: { cols, rows: layout.length, layout } });

test('rng детерминирован и состояние восстанавливается', () => {
  const a = createRng(5), b = createRng(5);
  assert.deepEqual([a.next(), a.next(), a.next()], [b.next(), b.next(), b.next()]);
  const st = a.state; const x = a.next(); a.state = st;
  assert.equal(a.next(), x);
});

test('формы линий 3/4/5', () => {
  const shape = (rows) => findMatches(fromRows(rows)).map((g) => g.shape);
  assert.deepEqual(shape(['000123', '123451', '234512']), ['line3']);
  assert.deepEqual(shape(['0000-1', '1234-2', '2345-3', '3451-4']), ['line4']);
  assert.deepEqual(shape(['00000', '12345', '23451', '34512']), ['line5']);
  const v = findMatches(fromRows(['01', '02', '03', '14']))[0];
  assert.equal(v.dir, 'v'); assert.equal(v.shape, 'line3');
});

test('L и T различаются, квадрат — отдельная форма', () => {
  const g = (rows) => findMatches(fromRows(rows))[0];
  // T: горизонталь 000 сверху, вертикаль уходит из середины
  const t = g(['000', '102', '103', '124']);
  assert.equal(t.shape, 'T'); assert.deepEqual(t.at, { r: 0, c: 1 });
  const l = g(['000', '012', '013', '124']);
  assert.equal(l.shape, 'L'); assert.deepEqual(l.at, { r: 0, c: 0 });
  const sq = g(['0012', '0034', '1234']);
  assert.equal(sq.shape, 'square'); assert.equal(sq.cells.length, 4);
});

test('at предпочитает клетку свайпа', () => {
  const grp = findMatches(fromRows(['000', '123', '234']), [{ r: 0, c: 2 }])[0];
  assert.deepEqual(grp.at, { r: 0, c: 2 });
});

test('предметы (type<0) не матчатся', () => {
  const b = fromRows(['000', '123']);
  b.cells[0].forEach((c) => { c.tile.type = -1; c.tile.item = 'cherry'; });
  assert.equal(findMatches(b).length, 0);
});

test('генерация: без матчей, с ходом, с дырами, детерминированно', () => {
  const layouts = [Array(8).fill('........'), ['#..#..#.', '........', '..xx....', '........', '...ss...', '........', '........', '#......#']];
  for (const layout of layouts) {
    for (let seed = 1; seed <= 40; seed++) {
      const level = lvl(layout);
      const mk = () => generateBoard(level, null, defaultEnv, [0, 1, 2, 3, 4, 5], createRng(seed), { n: 0 });
      const b = mk(), env = defaultEnv(b);
      assert.equal(findMatches(b).length, 0, `seed ${seed}`);
      assert.ok(hasMove(b, env), `seed ${seed}`);
      assert.deepEqual(JSON.stringify(mk()), JSON.stringify(b));
      b.cells.forEach((row, r) => row.forEach((cell, c) => assert.equal(!!cell.tile, !isWall(b, env, r, c))));
    }
  }
});

test('генерация с 3 цветами тоже даёт ход и без матчей', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const b = generateBoard(lvl(Array(5).fill('.....')), null, defaultEnv, [0, 1, 2], createRng(seed), { n: 0 });
    assert.equal(findMatches(b).length, 0);
    assert.ok(hasMove(b, defaultEnv(b)));
  }
});

test('board.specials ставятся на поле', () => {
  const level = lvl(Array(6).fill('......'));
  level.board.specials = [{ r: 2, c: 3, special: 'bomb' }, { r: 0, c: 0, special: 'rainbow', type: 2 }];
  const b = generateBoard(level, null, defaultEnv, [0, 1, 2, 3], createRng(3), { n: 0 });
  assert.equal(b.cells[2][3].tile.special, 'bomb');
  assert.equal(b.cells[0][0].tile.special, 'rainbow');
});

test('canSwap: соседи, цепь и стены запрещают', () => {
  const b = fromRows(['012', '120', '201']);
  const env = defaultEnv(b);
  assert.ok(canSwap(b, env, { r: 0, c: 0 }, { r: 0, c: 1 }));
  assert.ok(!canSwap(b, env, { r: 0, c: 0 }, { r: 1, c: 1 }));
  assert.ok(!canSwap(b, env, { r: 0, c: 0 }, { r: 0, c: 3 }));
  b.cells[0][1].obstacle = { kind: 'chain', hp: 1 };
  assert.ok(!canSwap(b, env, { r: 0, c: 0 }, { r: 0, c: 1 }));
  b.cells[1][1].hole = true; b.cells[1][1].tile = null;
  assert.ok(!canSwap(b, env, { r: 1, c: 0 }, { r: 1, c: 1 }));
});

test('findMove находит ход, null если ходов нет', () => {
  const b = fromRows(['0100', '2323', '4545', '3232']);
  const env = defaultEnv(b);
  const m = findMove(b, env);
  assert.ok(m && canSwap(b, env, m.from, m.to));
  const dead = fromRows(['0123', '2301', '0123', '2301']);
  assert.equal(findMove(dead, defaultEnv(dead)), null);
});

test('гравитация: падение внутри сегментов, стены не пропускают, спавн в каждом сегменте', () => {
  const b = fromRows(['0-1', '2-3', '---', '4-5']);
  b.cells[1][1].hole = true;
  b.cells[2][0].tile = null;
  const env = defaultEnv(b);
  const { moves, spawned } = applyGravity(b, env, [0, 1, 2], createRng(1), { n: 100 });
  assert.equal(b.cells[1][1].tile, null);
  // колонка 0: 0 и 2 упали на ряды 2,3? (ряд 3 занят 4) -> 2 на ряд 2, 0 на ряд 1, спавн в ряд 0
  assert.equal(b.cells[3][0].tile.type, 4);
  assert.equal(b.cells[2][0].tile.type, 2);
  assert.equal(b.cells[1][0].tile.type, 0);
  assert.ok(b.cells[0][0].tile);
  assert.ok(moves.length >= 2 && spawned.length >= 1);
  // колонка 1: ряд 0 — выше дыры (сегмент из одной клетки), заполняется спавном
  assert.ok(b.cells[0][1].tile);
  assert.equal(b.cells[2][1].tile?.type === undefined, false);
});

test('перемешивание: препятствия на месте, цепь и стены не двигаются, есть ход, нет матчей', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const lay = ['........', '..c.....', '..xx....', '....#...', '........', '........', '........', '........'];
    const b = generateBoard(lvl(lay), null, defaultEnv, [0, 1, 2, 3, 4], createRng(seed), { n: 0 });
    const before = JSON.stringify(b.cells.map((r) => r.map((c) => c.obstacle)));
    const chained = b.cells[1][2].tile.id;
    assert.ok(shuffleBoard(b, defaultEnv(b), [0, 1, 2, 3, 4], createRng(seed + 100)));
    assert.equal(JSON.stringify(b.cells.map((r) => r.map((c) => c.obstacle))), before);
    assert.equal(b.cells[1][2].tile.id, chained);
    assert.equal(findMatches(b).length, 0);
    assert.ok(hasMove(b, defaultEnv(b)));
  }
});
