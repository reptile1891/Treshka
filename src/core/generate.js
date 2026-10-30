// Генерация поля без готовых матчей и с гарантией хода; перемешивание.
import { createEmptyBoard, isWall, isMovable, newTile, pickType } from './board.js';
import { findMatches, hasMove } from './match.js';

function fill(board, env, types, rng, ids) {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      board.cells[r][c].tile = isWall(board, env, r, c) ? null : newTile(pickType(board, r, c, types, rng), ids);
    }
  }
}

// Предметы из board.items [{r,c,item}]: type -1, не матчатся и не бьются обычными матчами.
function placeItems(board, list = []) {
  for (const it of list) {
    const tile = board.cells[it.r]?.[it.c]?.tile;
    if (!tile) continue;
    tile.type = -1;
    tile.special = null;
    tile.item = it.item;
  }
}

// Спецфишки из board.specials; тип меняем, только если это не создаёт матч.
function placeSpecials(board, list = []) {
  for (const s of list) {
    const tile = board.cells[s.r]?.[s.c]?.tile;
    if (!tile || tile.type < 0) continue; // на предмет спецфишку не ставим
    tile.special = s.special;
    if (s.type !== undefined && s.type !== tile.type) {
      const old = tile.type;
      tile.type = s.type;
      if (findMatches(board).length) tile.type = old;
    }
  }
}

// empty — готовая доска без фишек (levels.buildBoard); makeEnv(board) -> env.
export function generateBoard(level, empty, makeEnv, types, rng, ids) {
  let board = empty ?? createEmptyBoard(level.board.cols, level.board.rows, level.board.layout);
  const template = JSON.stringify(board);
  for (let attempt = 0; attempt < 100; attempt++) {
    if (attempt) board = JSON.parse(template);
    fill(board, makeEnv(board), types, rng, ids);
    placeItems(board, level.board.items); // до проверки хода: предметы режут возможные матчи
    if (hasMove(board, makeEnv(board))) break;
  }
  placeSpecials(board, level.board.specials);
  return board;
}

// Перемешивает подвижные фишки (препятствия остаются на местах). true — получилось поле без матчей и с ходом.
export function shuffleBoard(board, env, types, rng) {
  const pos = [];
  board.cells.forEach((row, r) => row.forEach((_, c) => { if (isMovable(board, env, r, c)) pos.push({ r, c }); }));
  const ok = () => findMatches(board).length === 0 && hasMove(board, env);
  const tiles = pos.map((p) => board.cells[p.r][p.c].tile);
  for (let attempt = 0; attempt < 100; attempt++) {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    pos.forEach((p, i) => { board.cells[p.r][p.c].tile = tiles[i]; });
    if (ok()) return true;
  }
  // Запасной путь: перераздать цвета обычным фишкам (спецфишки и предметы не трогаем).
  for (let attempt = 0; attempt < 100; attempt++) {
    for (const p of pos) {
      const tile = board.cells[p.r][p.c].tile;
      if (tile.type >= 0) tile.type = pickType(board, p.r, p.c, types, rng);
    }
    if (ok()) return true;
  }
  return false;
}
