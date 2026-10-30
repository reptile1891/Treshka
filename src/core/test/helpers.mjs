// Общие хелперы тестов: игра с шиной и настоящим mechanics, сборка досок из строк.
import { createBus } from '../../shared/bus.js';
import { CONFIG } from '../../shared/config.js';
import * as core from '../index.js';
import * as mechanics from '../../mechanics/index.js';
import { buildBoard } from '../../levels/format.js';

export function makeGame({ withMechanics = true, withLevels = true } = {}) {
  const game = { bus: createBus(), config: CONFIG, canvas: null, modules: {} };
  core.init(game);
  if (withMechanics) mechanics.init(game);
  if (withLevels) game.modules.levels = { buildBoard };
  const log = [];
  const orig = game.bus.emit;
  game.bus.emit = (type, payload) => { log.push(type); return orig(type, payload); };
  game.log = log;
  return game;
}

export const level = (over = {}) => ({
  id: 1,
  board: { cols: 6, rows: 6, layout: Array(6).fill('......') },
  moves: 10,
  goals: [{ kind: 'score', amount: 100000 }],
  stars: [100, 200, 300],
  tileTypes: [0, 1, 2, 3, 4, 5],
  seed: 7,
  ...over,
});

// Ставит типы из строк цифр ('.' — не трогать, '-' — пусто), сбрасывает спецфишки.
export function setBoard(game, rows) {
  const b = game.modules.core.getBoard();
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '.') return;
    const cell = b.cells[r][c];
    if (ch === '-') { cell.tile = null; return; }
    cell.tile = { id: 1000 + r * 100 + c, type: +ch, special: null };
  }));
  return b;
}

export const types = (b) => b.cells.map((row) => row.map((c) => c.tile?.type ?? -1));

// Детерминированное поле без матчей: type = (r+c)%3, затем патчи [[r,c,type],...].
export function baseBoard(game, patches = []) {
  const b = game.modules.core.getBoard();
  b.cells.forEach((row, r) => row.forEach((cell, c) => {
    if (cell.tile) cell.tile = { id: 1000 + r * 100 + c, type: (r + c) % 3, special: null };
  }));
  for (const [r, c, t] of patches) b.cells[r][c].tile.type = t;
  return b;
}

// Свап (0,2)<->(1,2) даёт тройку нулей в ряду 0.
export const matchBoard = (game) => baseBoard(game, [[0, 0, 0], [0, 1, 0], [0, 2, 1], [1, 2, 0]]);
export const MATCH_SWAP = [{ r: 0, c: 2 }, { r: 1, c: 2 }];
