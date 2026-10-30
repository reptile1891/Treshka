// Встроенные механики. Новая механика = новый файл с register(api) и строка здесь.
import * as line from './specials/line.js';
import * as bomb from './specials/bomb.js';
import * as rainbow from './specials/rainbow.js';
import * as plane from './specials/plane.js';
import * as obstacles from './obstacles/all.js';
import * as boosters from './boosters/all.js';
import * as goals from './goals/all.js';

export function registerBuiltins(api) {
  for (const m of [line, bomb, rainbow, plane, obstacles, boosters, goals]) m.register(api);
}
