// Общие константы. Менять только через PR в main, остальные чаты на них опираются.
export const CONFIG = {
  gridCols: 8,
  gridRows: 8,
  // Базовые цвета фишек (индекс = id типа). Визуал может менять отрисовку, но не количество.
  tileTypes: ['red', 'orange', 'yellow', 'green', 'blue', 'purple'],
  maxLives: 5,
  lifeRegenSeconds: 1800,
};
