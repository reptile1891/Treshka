// Генерация поля без готовых матчей и с гарантией хода; перемешивание.
import { createEmptyBoard, isStatic, isMovable, newTile, pickType } from './board.js';
import { findMatches, hasMove } from './match.js';

function fill(board, types, rng, ids) {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const cell = board.cells[r][c];
      if (!isStatic(cell)) cell.tile = newTile(pickType(board, r, c, types, rng), ids);
    }
  }
}

export function generateBoard(level, types, rng, ids) {
  const { cols, rows, layout } = level.board;
  let board;
  for (let attempt = 0; attempt < 100; attempt++) {
    board = createEmptyBoard(cols, rows, layout);
    fill(board, types, rng, ids);
    if (hasMove(board)) break;
  }
  return board;
}

// Перемешивает подвижные фишки; true, если получилось поле без матчей и с ходом.
export function shuffleBoard(board, types, rng) {
  const pos = [];
  board.cells.forEach((row, r) => row.forEach((cell, c) => { if (isMovable(cell)) pos.push({ r, c }); }));
  const ok = () => findMatches(board).length === 0 && hasMove(board);
  const tiles = pos.map((p) => board.cells[p.r][p.c].tile);
  for (let attempt = 0; attempt < 100; attempt++) {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    pos.forEach((p, i) => { board.cells[p.r][p.c].tile = tiles[i]; });
    if (ok()) return true;
  }
  // Запасной путь: перераздать типы тем же фишкам.
  for (let attempt = 0; attempt < 100; attempt++) {
    for (const p of pos) {
      const tile = board.cells[p.r][p.c].tile;
      tile.type = pickType(board, p.r, p.c, types, rng);
    }
    if (ok()) return true;
  }
  return false;
}
