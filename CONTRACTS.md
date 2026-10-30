# Контракты между модулями

Модули общаются **только** через `game.bus` (события) и публичный API в `game.modules.<имя>`.
Прямые импорты между папками `src/<модуль>` запрещены; общий код живёт в `src/shared`.

## Жизненный цикл
`main.js` вызывает `init(game)` у каждого модуля, затем эмитит `game:ready`.
`game = { bus, config, canvas, modules }`.

## Модель данных
```
Board  = { cols, rows, cells: Cell[rows][cols] }   // cells[r][c], r=0 сверху
Cell   = { tile: Tile|null, obstacle: Obstacle|null, hole: boolean }   // hole — клетки нет, фишки туда не попадают и не падают через неё
Tile   = { id, type: 0..5, special: null|'line_h'|'line_v'|'bomb'|'rainbow'|'plane' }
Obstacle = { kind: 'ice'|'chain'|'crate'|'slime'|..., hp }
Goal   = { kind: 'collect'|'clear_obstacle'|'score'|'drop', target, amount }
LevelDef = { id, board: {cols, rows, layout, specials?}, moves, goals: Goal[], stars: [s1,s2,s3], tileTypes }
```

### LevelDef (JSON в `data/levels/NNN.json`)
- `board.layout` — массив `rows` строк по `cols` символов, `layout[r][c]`, r=0 сверху:
  `.` обычная клетка, `#` дыра (hole), `i`/`I` лёд hp 1/2, `c`/`C` цепь hp 1/2, `x`/`X` ящик hp 1/2, `s` слизь hp 1.
- `board.specials` (необязательно) — заранее выставленные спецфишки `[{r,c,special,type?}]`, на клетках без дыры.
- `tileTypes` — id используемых цветов (подмножество `0..5`), 3–6 штук. `moves` — число ходов.
- `stars` — пороги счёта для 1/2/3 звёзд, строго по возрастанию. Победа определяется целями, звёзды — счётом.
- Цели: `collect` — `target`=id цвета; `clear_obstacle` — `target`=kind, `amount`=сколько снять суммарно
  (для слизи, которая растёт, может быть больше стартового числа клеток); `score` — без `target`;
  `drop` — `target`='item', зарезервировано (в уровнях пока не используется).
- Загрузчик отдаёт `LevelDef` как есть; готовое поле без фишек строит `levels.buildBoard(levelDef)`.

## События (payload)
| Событие | Кто эмитит | Payload |
|---|---|---|
| `game:ready` | main | — |
| `level:load` | levels | `{ level: LevelDef }` |
| `level:start` | core | `{ board, level }` |
| `input:swap` | ui/render | `{ from:{r,c}, to:{r,c} }` |
| `input:booster` | ui | `{ kind, at?:{r,c} }` |
| `swap:done` | core | `{ from, to, valid }` |
| `match:found` | core | `{ groups:[{cells,type,shape}], chain }` |
| `special:created` | mechanics | `{ at, special }` |
| `special:fired` | mechanics | `{ at, special, affected:[{r,c}] }` |
| `tiles:cleared` | core | `{ cells:[{r,c,type}], chain }` |
| `obstacle:damaged` | mechanics | `{ at, kind, hp }` |
| `tiles:fell` | core | `{ moves:[{from,to,tile}], spawned:[{to,tile}] }` |
| `board:settled` | core | `{ board }` |
| `board:shuffled` | core | `{ board }` |
| `score:changed` | core | `{ score, delta }` |
| `moves:changed` | core | `{ left }` |
| `goal:progress` | mechanics | `{ goal, current }` |
| `level:won` | core | `{ score, stars, movesLeft }` |
| `level:failed` | core | `{ score }` |
| `lives:changed` | levels | `{ lives, nextAt }` (`nextAt` — мс epoch до следующей жизни, `null` если жизни полные) |
| `coins:changed` | meta | `{ coins, delta }` |
| `sfx:play` | любой | `{ name, volume? }` |

Новые события добавляйте в эту таблицу тем же коммитом.

## Публичные API
- `core`: `startLevel(levelDef)`, `trySwap(from,to)`, `getBoard()`, `hint()`
- `mechanics`: `registerSpecial(name, handler)`, `registerObstacle(kind, handler)`, `useBooster(kind, at)`
- `levels`: `loadLevel(id, {force?})` → `Promise<LevelDef|null>` (null: нет уровня, он закрыт или нет жизней; `force` обходит проверки),
  `list()` → `[{id, name, node:{x,y}, stars, best, unlocked}]` (`node` — координаты на карте мира, 0..1; y=0 сверху, первый уровень внизу),
  `progress()` → `{lives, maxLives, nextAt, stars, completed, total, nextId}`, `buildBoard(levelDef)`, `addLife(n?)`, `ready` (Promise: индекс уровней загружен).
  Жизнь списывается по `level:failed`; `levels` сам слушает `level:won`/`level:failed` и сохраняет прогресс в localStorage
- `render`: `setTheme(theme)`
- `ui`: `showScreen(name)`
- `audio`: `setVolume(kind, v)`, `mute(bool)`
- `meta`: `addCoins(n)`, `spend(n)`, `inventory()`

Смена сигнатуры публичного API или payload события — только с обновлением этого файла.
