# Контракты между модулями

Модули общаются **только** через `game.bus` (события) и публичный API в `game.modules.<имя>`.
Прямые импорты между папками `src/<модуль>` запрещены; общий код живёт в `src/shared`.

## Жизненный цикл
`main.js` вызывает `init(game)` у каждого модуля, затем эмитит `game:ready`.
`game = { bus, config, canvas, modules }`.

## Модель данных
```
Board  = { cols, rows, cells: Cell[rows][cols] }   // cells[r][c], r=0 сверху
Cell   = { tile: Tile|null, obstacle: Obstacle|null }
Tile   = { id, type: 0..5, special: null|'line_h'|'line_v'|'bomb'|'rainbow'|'plane' }
Obstacle = { kind: 'ice'|'chain'|'crate'|'slime'|..., hp }
Goal   = { kind: 'collect'|'clear_obstacle'|'score'|'drop', target, amount }
LevelDef = { id, board: {cols, rows, layout}, moves, goals: Goal[], stars: [s1,s2,s3], tileTypes, seed? }
// tileTypes: число типов или массив id; seed — для детерминированного ГСЧ (по умолчанию 1)
// layout: массив строк по rows, символ на клетку: '.' пусто, '#' дыра, 'i' лёд, 'c' цепь, 'x' ящик, 's' слизь.
//   Дыры и ящики (hp>0) неподвижны: фишки не падают через них; цепь не даёт двигать фишку.
```

## События (payload)
| Событие | Кто эмитит | Payload |
|---|---|---|
| `game:ready` | main | — |
| `level:load` | levels | `{ level: LevelDef }` |
| `level:start` | core | `{ board, level }` |
| `input:swap` | ui/render | `{ from:{r,c}, to:{r,c} }` |
| `input:booster` | ui | `{ kind, at?:{r,c} }` |
| `swap:done` | core | `{ from, to, valid }` |
| `match:found` | core | `{ groups:[{cells,type,shape,dir,at}], chain, trigger }` |
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
| `lives:changed` | levels | `{ lives, nextAt }` |
| `coins:changed` | meta | `{ coins, delta }` |
| `inventory:changed` | meta | `{ kind, count }` — бустеры |
| `lives:grant` | meta | `{ amount }` — levels добавляет жизни (не выше `maxLives`) |
| `reward:granted` | meta | `{ source, coins, boosters, lives }` — для показа награды в UI |
| `shop:purchased` | meta | `{ id }` |
| `quest:completed` | meta | `{ id }` — задание дня выполнено |
| `achievement:unlocked` | meta | `{ id }` |
| `sfx:play` | любой | `{ name, volume? }` |
| `hint:show` | core | `{ cells:[{r,c},{r,c}] }` — render подсвечивает пару |
| `ui:screen` | ui | `{ name }` — `menu`/`map`/`game`/`pause`/`win`/`lose` |
| `game:pause` | ui | `{ paused }` |
| `booster:armed` | ui/render | `{ kind\|null }` — бустер ждёт клик по клетке |
| `render:layout` | render | `{ x, y, cell, cols, rows, hudH, boostH }` |
| `theme:changed` | render | `{ name }` |

### Уточнения по матчам (core ↔ mechanics)
- `shape`: `line3 | line4 | line5 | L | T`; `dir`: `'h'|'v'|null` (для L/T null); `at` — клетка, где уместно создать спецфишку (клетка свайпа или пересечение L/T).
- `trigger`: `{from,to}` при свайпе с участием спецфишки (иначе `null`), `chain` считается с 1.
- `match:found` обрабатывается синхронно. Пока он идёт, core слушает: `special:created {at, special}` — фишка в `at` получает `special` и не очищается; `special:fired {affected}` — клетки из `affected` добавляются к очистке этого шага.
- Свайп с участием спецфишки считается валидным ходом без обычного матча.
- Цели: core сам эмитит `goal:progress` для `kind:'score'` (порог в `amount`); победа, когда по каждой цели `current >= amount` (без целей — когда счёт >= stars[0]). Очки: 10 за фишку × chain.

Новые события добавляйте в эту таблицу тем же коммитом.

## Публичные API
- `core`: `startLevel(levelDef)`, `trySwap(from,to)`, `getBoard()`, `hint()`
- `mechanics`: `registerSpecial(name, handler)`, `registerObstacle(kind, handler)`, `useBooster(kind, at)`
- `levels`: `loadLevel(id)`, `list()`, `progress()`
- `render`: `setTheme(nameOrObj)`, `themes()`, `getTheme()`, `icon(kind,key,hp?)` → dataURL (`kind`: `tile`/`special`/`obstacle`), `timings`, `isBusy()`
- `ui`: `showScreen(name)`, `toast(msg)`, `current()`
- `audio`: `setVolume(kind, v)`, `mute(bool)`
- `meta`: `addCoins(n)`, `spend(n)`, `inventory()`, `coins()`, `useBooster(kind)` (списывает 1 шт., `false` если нет — UI зовёт перед `input:booster`), `addBooster(kind,n)`; каталог и мета-фичи: `shop`, `daily`, `wheel`, `events`, `quests`, `achievements` (см. `src/meta/index.js`)
- `meta` слушает: `level:start`/`level:load` (id уровня), `level:won`, `level:failed`, `tiles:cleared`, `match:found`, `special:created`, `lives:changed`

Смена сигнатуры публичного API или payload события — только с обновлением этого файла.

## Договорённости визуала
- Клетка с `tile:null` и `obstacle:null` в `level:start` считается дыркой (не рисуется).
- Фишки сопоставляются по стабильному `tile.id`; `tiles:cleared` приходит раньше `special:created`.
- `input:booster`: `hammer` (с `at`), `shuffle`, `extra_moves`. `hint` — вызов `core.hint()` + событие `hint:show`.
- `levels.list()` → `[{id, stars?, unlocked?}]`, `levels.progress()` → `{unlocked, stars:{[id]:n}}`; `meta.inventory()` → `{[kind]: n}`.
- UI запускает уровни через `levels.loadLevel(id)`; HUD берёт данные из `level:load`/`level:start`.
- `render.isBusy()` — true, пока идут анимации; `render.timings` — длительности в секундах для пейсинга ядром.
