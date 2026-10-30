import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, level, setBoard, baseBoard, matchBoard, types } from './helpers.mjs';

const start = (over, opts) => {
  const game = makeGame(opts);
  game.bus.emit('level:load', { level: level(over) });
  return game;
};
const collect = (game, names) => {
  const out = [];
  for (const n of names) game.bus.on(n, (p) => out.push([n, p]));
  return out;
};
const noMatchesFiller = [
  '012012', '120120', '201201', '012012', '120120', '201201',
];

test('level:load -> level:start с живой доской, getBoard — та же доска', () => {
  const game = makeGame();
  let started;
  game.bus.on('level:start', (p) => { started = p; });
  game.bus.emit('level:load', { level: level() });
  assert.ok(started.board === game.modules.core.getBoard());
  assert.equal(started.board.cells[0][0].hole, false);
});

test('невалидный свап откатывается, ход не тратится', () => {
  const game = start();
  setBoard(game, noMatchesFiller);
  const ev = collect(game, ['swap:done', 'moves:changed', 'match:found']);
  const before = JSON.stringify(types(game.modules.core.getBoard()));
  assert.equal(game.modules.core.trySwap({ r: 2, c: 2 }, { r: 2, c: 3 }), false);
  assert.equal(JSON.stringify(types(game.modules.core.getBoard())), before);
  assert.deepEqual(ev.map((e) => e[0]), ['swap:done']);
  assert.equal(ev[0][1].valid, false);
});

test('валидный свап: порядок событий, ход списан, счёт, board:settled', () => {
  const game = start();
  matchBoard(game);
  const names = ['swap:done', 'moves:changed', 'match:found', 'tiles:cleared', 'tiles:fell', 'score:changed', 'turn:end', 'board:settled'];
  const ev = collect(game, names);
  assert.equal(game.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 }), true);
  const seq = ev.map((e) => e[0]);
  assert.equal(seq[0], 'swap:done'); assert.equal(ev[0][1].valid, true);
  assert.equal(seq[1], 'moves:changed'); assert.equal(ev[1][1].left, 9);
  const mf = ev.find((e) => e[0] === 'match:found')[1];
  assert.equal(mf.chain, 1);
  assert.equal(mf.groups.length, 1);
  assert.deepEqual(mf.swap, { from: { r: 0, c: 2 }, to: { r: 1, c: 2 } });
  assert.deepEqual(mf.trigger, mf.swap);
  assert.ok(Array.isArray(mf.keep) && Array.isArray(mf.extra));
  // tiles:cleared до tiles:fell
  assert.ok(seq.indexOf('tiles:cleared') < seq.indexOf('tiles:fell'));
  assert.ok(seq.indexOf('swap:done') < seq.indexOf('match:found'));
  // turn:end -> board:settled в конце, после каскадов
  assert.equal(seq.at(-1), 'board:settled');
  assert.ok(seq.lastIndexOf('turn:end') < seq.lastIndexOf('board:settled'));
  const score = ev.filter((e) => e[0] === 'score:changed').reduce((s, e) => s + e[1].delta, 0);
  assert.ok(score >= 30);
});

test('после хода доска полна и без матчей, есть ход', () => {
  const game = start({ board: { cols: 8, rows: 8, layout: Array(8).fill('........') }, moves: 200 });
  const core = game.modules.core;
  for (let i = 0; i < 100; i++) {
    const m = core.hint();
    if (!m) break;
    core.trySwap(m.from, m.to);
    const b = core.getBoard();
    assert.ok(b.cells.every((row) => row.every((c) => c.tile)), 'пустая клетка');
    assert.ok(core.hint(), 'нет хода после settle');
  }
});

test('подсказка эмитит hint:show и ход действительно валиден', () => {
  const game = start();
  const ev = collect(game, ['hint:show', 'swap:done']);
  const m = game.modules.core.hint();
  assert.equal(ev[0][0], 'hint:show');
  assert.deepEqual(ev[0][1].cells, [m.from, m.to]);
  assert.equal(game.modules.core.trySwap(m.from, m.to), true);
});

test('победа только после тихого turn:end и по goals:complete', () => {
  const game = start({ goals: [{ kind: 'score', amount: 20 }], moves: 5 });
  matchBoard(game);
  const ev = collect(game, ['turn:end', 'level:won', 'level:failed', 'goals:complete']);
  game.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 });
  const seq = ev.map((e) => e[0]);
  assert.ok(seq.includes('goals:complete'));
  assert.equal(seq.filter((n) => n === 'level:won').length, 1);
  assert.equal(seq.at(-1), 'level:won');
  const won = ev.find((e) => e[0] === 'level:won')[1];
  assert.ok(won.stars >= 1 && won.score >= 30 && won.movesLeft === 4);
  // после победы свапы не принимаются
  assert.equal(game.modules.core.trySwap({ r: 3, c: 0 }, { r: 3, c: 1 }), false);
});

test('поражение: ходы кончились, цели не выполнены', () => {
  const game = start({ moves: 1 });
  matchBoard(game);
  const ev = collect(game, ['level:failed', 'level:won']);
  game.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 });
  assert.deepEqual(ev.map((e) => e[0]), ['level:failed']);
});

test('turn:end: clear и dirty обрабатываются, повторный turn:end приходит', () => {
  const game = start();
  matchBoard(game);
  let calls = 0;
  game.bus.on('turn:end', (p) => {
    calls++;
    if (calls === 1) { p.clear.push({ r: 5, c: 0 }); }
  });
  const cleared = collect(game, ['tiles:cleared']);
  game.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 });
  assert.ok(calls >= 2);
  assert.ok(cleared.some((e) => e[1].cells.some((c) => c.r === 5 && c.c === 0)));
  const b = game.modules.core.getBoard();
  assert.ok(b.cells.every((row) => row.every((c) => c.tile)));
});

test('dirty без clear пересчитывает гравитацию и повторяет turn:end', () => {
  const game = start();
  matchBoard(game);
  let calls = 0;
  game.bus.on('turn:end', (p) => { calls++; if (calls === 1) { p.board.cells[4][4].tile = null; p.dirty = true; } });
  game.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 });
  assert.ok(calls >= 2);
  assert.ok(game.modules.core.getBoard().cells[4][4].tile);
});

test('clear:request: ставит rejected вне idle, чистит клетки после emit', async () => {
  const game = start();
  const core = game.modules.core;
  const cleared = collect(game, ['tiles:cleared', 'board:settled']);
  const req = { cells: [{ r: 3, c: 3 }, { r: 3, c: 4 }], source: 'test' };
  game.bus.emit('clear:request', req);
  assert.notEqual(req.rejected, true);
  assert.equal(cleared.length, 0, 'очистка начинается после возврата из emit');
  // пока занят — отклоняет и свапы, и новые запросы
  const req2 = { cells: [] };
  game.bus.emit('clear:request', req2);
  assert.equal(req2.rejected, true);
  assert.equal(core.trySwap({ r: 0, c: 0 }, { r: 0, c: 1 }), false);
  await Promise.resolve();
  assert.equal(cleared[0][0], 'tiles:cleared');
  assert.equal(cleared.at(-1)[0], 'board:settled');
  assert.ok(core.getBoard().cells.every((row) => row.every((c) => c.tile)));
});

test('clear:request с пустым cells просто пересчитывает доску и шлёт turn:end', async () => {
  const game = start();
  const ev = collect(game, ['turn:end']);
  game.bus.emit('clear:request', { cells: [] });
  await Promise.resolve();
  assert.equal(ev.length >= 1, true);
});

test('moves:add, shuffle:request и rejected после конца игры', () => {
  const game = start({ moves: 1 });
  const moves = collect(game, ['moves:changed']);
  const add = { n: 5 };
  game.bus.emit('moves:add', add);
  assert.notEqual(add.rejected, true);
  assert.equal(moves.at(-1)[1].left, 6);
  const sh = {};
  const shuffled = collect(game, ['board:shuffled']);
  game.bus.emit('shuffle:request', sh);
  assert.notEqual(sh.rejected, true);
  assert.equal(shuffled.length, 1);
  // ход не потрачен
  assert.equal(moves.at(-1)[1].left, 6);
  // игра окончена -> rejected
  const g2 = start({ moves: 1 });
  matchBoard(g2);
  g2.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 }); // level:failed
  const a2 = { n: 5 }, s2 = {}, c2 = { cells: [] };
  g2.bus.emit('moves:add', a2); g2.bus.emit('shuffle:request', s2); g2.bus.emit('clear:request', c2);
  assert.ok(a2.rejected && s2.rejected && c2.rejected);
});

test('бустеры mechanics через core: shuffle, extra moves, hammer', async () => {
  const game = start({ moves: 3 });
  const mech = game.modules.mechanics;
  assert.equal(mech.useBooster('shuffle'), true);
  assert.equal(mech.useBooster('moves'), true);
  const moves = collect(game, ['moves:changed']);
  mech.useBooster('moves');
  assert.equal(moves.at(-1)[1].left, 13);
  const ev = collect(game, ['tiles:cleared']);
  assert.equal(mech.useBooster('hammer', { r: 2, c: 2 }), true);
  await Promise.resolve();
  assert.ok(ev[0][1].cells.some((c) => c.r === 2 && c.c === 2));
});

test('перемешивание сохраняет препятствия на местах', () => {
  const lay = ['......', '..i...', '..c...', '..x...', '......', '......'];
  const game = start({ board: { cols: 6, rows: 6, layout: lay }, goals: [{ kind: 'score', amount: 99999 }] });
  const b = game.modules.core.getBoard();
  const obs = () => JSON.stringify(b.cells.map((r) => r.map((c) => c.obstacle)));
  const before = obs();
  game.bus.emit('shuffle:request', {});
  assert.equal(obs(), before);
  assert.equal(b.cells[3][2].tile, null); // ящик — стена
});

test('ящик: стена для гравитации, после разрушения клетка заполняется', async () => {
  const lay = ['......', '......', '..x...', '......', '......', '......'];
  const game = start({ board: { cols: 6, rows: 6, layout: lay }, goals: [{ kind: 'clear_obstacle', target: 'crate', amount: 1 }] });
  const b = game.modules.core.getBoard();
  assert.equal(b.cells[2][2].tile, null);
  // молот по ящику
  const ev = collect(game, ['obstacle:damaged', 'level:won']);
  assert.equal(game.modules.mechanics.useBooster('hammer', { r: 2, c: 2 }), true);
  await Promise.resolve();
  assert.equal(b.cells[2][2].obstacle, null);
  assert.ok(b.cells[2][2].tile, 'клетка освободилась и заполнена');
  assert.ok(ev.some((e) => e[0] === 'obstacle:damaged' && e[1].hp === 0));
  assert.equal(ev.at(-1)[0], 'level:won');
});

test('спецфишка из линии 4: создаётся и остаётся на поле', () => {
  const game = start();
  baseBoard(game, [[0, 0, 0], [0, 1, 0], [0, 2, 1], [0, 3, 0], [1, 2, 0]]);
  const ev = collect(game, ['special:created', 'match:found']);
  game.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 });
  const created = ev.find((e) => e[0] === 'special:created');
  assert.ok(created, 'ожидали special:created');
  const at = created[1].at;
  const mf = ev.find((e) => e[0] === 'match:found')[1];
  assert.equal(mf.groups[0].shape, 'line4');
  assert.ok(mf.keep.some((p) => p.r === at.r && p.c === at.c));
});

test('квадрат 2x2: матч и самолётик', () => {
  const game = start();
  baseBoard(game, [[0, 1, 0], [2, 2, 0]]);
  const ev = collect(game, ['match:found', 'special:created']);
  assert.equal(game.modules.core.trySwap({ r: 0, c: 1 }, { r: 1, c: 1 }), true);
  const mf = ev.find((e) => e[0] === 'match:found')[1];
  assert.equal(mf.groups[0].shape, 'square');
  assert.equal(ev.find((e) => e[0] === 'special:created')[1].special, 'plane');
});

test('комбо спецфишек: resolveSwap вызывается, swap:done раньше tiles:cleared, ход тратится', () => {
  const game = start();
  const b = baseBoard(game);
  b.cells[0][0].tile.special = 'line_h';
  b.cells[0][1].tile.special = 'line_v';
  const ev = collect(game, ['swap:done', 'tiles:cleared', 'special:fired', 'moves:changed']);
  assert.equal(game.modules.core.trySwap({ r: 0, c: 0 }, { r: 0, c: 1 }), true);
  const seq = ev.map((e) => e[0]);
  assert.ok(seq.indexOf('swap:done') < seq.indexOf('tiles:cleared'));
  assert.ok(seq.includes('special:fired'));
  const cl = ev.find((e) => e[0] === 'tiles:cleared')[1];
  assert.ok(cl.cells.length >= 11); // крест: ряд + столбец
});

test('isLocked: свап цепной фишки запрещён и не вызывает resolveSwap', () => {
  const game = start();
  matchBoard(game);
  const b = game.modules.core.getBoard();
  b.cells[0][2].obstacle = { kind: 'chain', hp: 1 };
  let called = 0;
  const orig = game.modules.mechanics.resolveSwap;
  game.modules.mechanics.resolveSwap = (...a) => { called++; return orig(...a); };
  assert.equal(game.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 }), false);
  assert.equal(called, 0);
});

test('resolveSwap не зовётся для обычных фишек', () => {
  const game = start();
  matchBoard(game);
  let called = 0;
  const orig = game.modules.mechanics.resolveSwap;
  game.modules.mechanics.resolveSwap = (...a) => { called++; return orig(...a); };
  game.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 });
  assert.equal(called, 0);
});

test('render.isBusy блокирует ввод', () => {
  const game = start();
  game.modules.render = { isBusy: () => true };
  matchBoard(game);
  assert.equal(game.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 }), false);
  game.modules.render.isBusy = () => false;
  assert.equal(game.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 }), true);
});

test('детерминизм: один seed и одинаковые ходы — одинаковый лог событий', () => {
  const run = () => {
    const game = start({ board: { cols: 8, rows: 8, layout: Array(8).fill('........') }, moves: 30 });
    game.modules.mechanics.setRng(() => 0.5);
    for (let i = 0; i < 15; i++) {
      const m = game.modules.core.hint();
      if (m) game.modules.core.trySwap(m.from, m.to);
    }
    return JSON.stringify([game.log, types(game.modules.core.getBoard())]);
  };
  assert.equal(run(), run());
});

test('без mechanics и без levels: core работает на встроенных правилах', () => {
  const game = start({ board: { cols: 6, rows: 6, layout: ['......', '......', '..x...', '......', '......', '......'] } }, { withMechanics: false, withLevels: false });
  const b = game.modules.core.getBoard();
  assert.equal(b.cells[2][2].tile, null);
  const m = game.modules.core.hint();
  assert.ok(m);
  assert.equal(game.modules.core.trySwap(m.from, m.to), true);
});

test('уровень с дырами: фишки не падают через дыру', () => {
  const lay = ['..##..', '......', '......', '......', '......', '......'];
  const game = start({ board: { cols: 6, rows: 6, layout: lay }, moves: 50 });
  const core = game.modules.core;
  for (let i = 0; i < 20; i++) {
    const m = core.hint(); if (!m) break;
    core.trySwap(m.from, m.to);
    const b = core.getBoard();
    assert.equal(b.cells[0][2].tile, null); assert.equal(b.cells[0][3].tile, null);
    assert.ok(b.cells.every((row) => row.every((c) => c.hole || c.tile)));
  }
});

test('предметы: падают до нижнего ряда и выбывают через turn:end (drop)', () => {
  const game = start({ goals: [{ kind: 'drop', target: 'item', amount: 1 }] });
  const b = matchBoard(game);
  b.cells[4][0].tile = { id: 9001, type: -1, special: null, item: 'cherry' };
  b.cells[5][0].tile = { id: 9002, type: 3, special: null };
  const ev = collect(game, ['item:dropped', 'level:won']);
  // обычный матч в ряду 5? просто делаем ход и ждём падения предмета
  b.cells[5][0].tile = null; // освобождаем низ
  game.modules.core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 });
  assert.ok(ev.some((e) => e[0] === 'item:dropped'));
});

test('input:rejected: причины busy / animating / over / no_moves, ввод не теряется молча', async () => {
  const game = start({ moves: 1 });
  const rej = collect(game, ['input:rejected']);
  const core = game.modules.core;
  // animating: render занят — свап, hint и все запросы отклоняются с событием
  game.modules.render = { isBusy: () => true };
  assert.equal(core.trySwap({ r: 0, c: 0 }, { r: 0, c: 1 }), false);
  assert.equal(core.hint(), null);
  const reqs = [['clear:request', { cells: [] }], ['moves:add', { n: 1 }], ['shuffle:request', {}]];
  for (const [n, p] of reqs) { game.bus.emit(n, p); assert.equal(p.rejected, true, n); }
  assert.deepEqual(rej.map((e) => [e[1].kind, e[1].reason]), [
    ['swap', 'animating'], ['hint', 'animating'], ['clear', 'animating'], ['moves', 'animating'], ['shuffle', 'animating'],
  ]);
  assert.deepEqual(rej[0][1].from, { r: 0, c: 0 });
  // анимации кончились — всё снова работает
  game.modules.render.isBusy = () => false;
  assert.ok(core.hint());
  // busy: пока core выполняет clear:request
  rej.length = 0;
  game.bus.emit('clear:request', { cells: [] });
  assert.equal(core.trySwap({ r: 0, c: 0 }, { r: 0, c: 1 }), false);
  assert.equal(rej[0][1].reason, 'busy');
  await Promise.resolve();
  // no_moves и over
  matchBoard(game);
  core.trySwap({ r: 0, c: 2 }, { r: 1, c: 2 }); // последний ход -> level:failed
  rej.length = 0;
  assert.equal(core.trySwap({ r: 0, c: 0 }, { r: 0, c: 1 }), false);
  assert.equal(rej[0][1].reason, 'over');
});

test('moves:add с неверным n отклоняется с reason invalid', () => {
  const game = start();
  const rej = collect(game, ['input:rejected']);
  const req = { n: 0 };
  game.bus.emit('moves:add', req);
  assert.equal(req.rejected, true);
  assert.equal(rej[0][1].reason, 'invalid');
});

test('turnId и step: стабильные индексы шагов, шаги растут внутри хода', () => {
  const game = start({ board: { cols: 8, rows: 8, layout: Array(8).fill('........') }, moves: 50 });
  const core = game.modules.core;
  const names = ['swap:done', 'match:found', 'tiles:cleared', 'tiles:fell', 'turn:end', 'board:settled'];
  const ev = collect(game, names);
  for (let i = 0; i < 6; i++) {
    const m = core.hint(); if (!m) break;
    core.trySwap(m.from, m.to);
  }
  const turns = new Map();
  for (const [n, p] of ev) {
    assert.ok(Number.isInteger(p.turnId) && p.turnId >= 1, `${n} без turnId`);
    if (!turns.has(p.turnId)) turns.set(p.turnId, []);
    turns.get(p.turnId).push([n, p]);
  }
  assert.ok(turns.size >= 3);
  for (const [, list] of turns) {
    assert.equal(list[0][0], 'swap:done');
    assert.equal(list.at(-1)[0], 'board:settled');
    const matches = list.filter(([n]) => n === 'match:found').map(([, p]) => p.step);
    // match:found: шаги строго возрастают, начиная с 1; cleared/fell того же шага совпадают с ним
    assert.equal(matches[0], 1);
    assert.deepEqual(matches, [...matches].sort((a, b) => a - b));
    assert.equal(new Set(matches).size, matches.length);
    for (const [n, p] of list) {
      if (n !== 'match:found') continue;
      const cl = list.find(([nn, pp]) => nn === 'tiles:cleared' && pp.step === p.step);
      assert.ok(cl, 'tiles:cleared того же шага');
      assert.equal(cl[1].chain, p.chain);
    }
  }
  // turnId возрастает от хода к ходу
  const ids = [...turns.keys()];
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
});

test('turnId/step: комбо, clear:request и очистка в turn:end — отдельные шаги', async () => {
  const game = start();
  const cl = collect(game, ['tiles:cleared']);
  game.bus.emit('clear:request', { cells: [{ r: 3, c: 3 }] });
  await Promise.resolve();
  assert.equal(cl[0][1].step, 1);
  const first = cl[0][1].turnId;
  baseBoard(game);
  let calls = 0;
  game.bus.on('turn:end', (p) => { if (++calls === 1) p.clear.push({ r: 5, c: 0 }); });
  const b = game.modules.core.getBoard();
  b.cells[0][0].tile.special = 'line_h'; b.cells[0][1].tile.special = 'line_v';
  game.modules.core.trySwap({ r: 0, c: 0 }, { r: 0, c: 1 });
  const mine = cl.filter((e) => e[1].turnId === first + 1).map((e) => e[1].step);
  assert.equal(mine[0], 1); // комбо — шаг 1
  assert.ok(mine.length >= 2 && mine.includes(2), 'очистка из turn:end — следующий шаг');
  assert.equal(new Set(mine).size, mine.length);
});
