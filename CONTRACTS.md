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
Tile   = { id, type: 0..5, special: null|'line_h'|'line_v'|'bomb'|'rainbow'|'plane', item?: string }
         // предмет (для цели drop): type = -1, item = 'cherry'|...; не матчится, не бьётся спецфишками
Obstacle = { kind: 'ice'|'chain'|'crate'|'slime'|'stone'|..., hp }   // hp в событиях: 0 = разрушено
Goal   = { kind: 'collect'|'clear_obstacle'|'score'|'drop', target, amount }
LevelDef = { id, board: {cols, rows, layout, specials?}, moves, goals: Goal[], stars: [s1,s2,s3], tileTypes, seed? }
// tileTypes: число типов или массив id; seed — для детерминированного ГСЧ (по умолчанию 1)
// layout: массив строк по rows, символ на клетку: '.' пусто, '#' дыра, 'i' лёд, 'c' цепь, 'x' ящик, 's' слизь.
//   Дыры и ящики (hp>0) неподвижны: фишки не падают через них; цепь не даёт двигать фишку.
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
| `match:found` | core | `{ groups:[{cells,type,shape}], chain, swap:{from,to}\|null, keep:[], extra:[] }` — mechanics синхронно дописывает `keep` (клетки, где остаётся новая спецфишка — не очищать) и `extra` (доп. клетки с фишками для очистки спецэффектами) | ⚠ TODO интеграции: у core в payload `trigger`, у mechanics `swap`
| `special:created` | mechanics | `{ at, special }` |
| `special:fired` | mechanics | `{ at, special, affected:[{r,c}] }` — для комбо `special` = `'a+b'` (напр. `'bomb+line_h'`, `'rainbow+tile'`) |
| `tiles:cleared` | core | `{ cells:[{r,c,type}], chain }` |
| `obstacle:damaged` | mechanics | `{ at, kind, hp }` |
| `obstacle:spawned` | mechanics | `{ at, kind, hp, from? }` (напр. слизь расползлась из `from`; фишка в клетке удалена) |
| `booster:used` | mechanics | `{ kind, at? }` — бустер реально применён (meta списывает здесь) |
| `item:dropped` | mechanics | `{ item, at }` |
| `goals:complete` | mechanics | — все цели выполнены; победу (`level:won`) объявляет core, когда доска успокоилась |
| `turn:end` | core | `{ board, clear:[], dirty:false }` — см. ниже |
| `clear:request` | mechanics | `{ cells:[{r,c}], source, rejected? }` |
| `moves:add` | mechanics | `{ n, rejected? }` |
| `shuffle:request` | mechanics | `{ rejected? }` |
| `tiles:fell` | core | `{ moves:[{from,to,tile}], spawned:[{to,tile}] }` |
| `board:settled` | core | `{ board }` |
| `board:shuffled` | core | `{ board }` |
| `score:changed` | core | `{ score, delta }` |
| `moves:changed` | core | `{ left }` |
| `goal:progress` | mechanics | `{ goal, current, index, done }` (`goal` — Goal из LevelDef, `current` ≤ amount) |
| `level:won` | core | `{ score, stars, movesLeft }` |
| `level:failed` | core | `{ score }` |
| `lives:changed` | levels | `{ lives, nextAt }` (`nextAt` — мс epoch до следующей жизни, `null` если жизни полные) |
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
- `mechanics`: `registerSpecial(name, handler)`, `registerObstacle(kind, handler)`, `registerBooster(kind, handler)`, `registerGoal(kind, handler)`, `useBooster(kind, at) → bool`,
  `resolveSwap(from, to) → {cells}|null`, `isBlocked(r,c)`, `isLocked(r,c)`, `createObstacle(kind, hp?)`
- `levels`: `loadLevel(id, {force?})` → `Promise<LevelDef|null>` (null: нет уровня, он закрыт или нет жизней; `force` обходит проверки),
  `list()` → `[{id, name, node:{x,y}, stars, best, unlocked}]` (`node` — координаты на карте мира, 0..1; y=0 сверху, первый уровень внизу),
  `progress()` → `{lives, maxLives, nextAt, stars, completed, total, nextId}`, `buildBoard(levelDef)`, `addLife(n?)`, `ready` (Promise: индекс уровней загружен).
  Жизнь списывается по `level:failed`; `levels` сам слушает `level:won`/`level:failed` и сохраняет прогресс в localStorage
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

## Требования механик к core
Слушатели mechanics синхронные: всё, что они меняют на доске, готово к моменту возврата из `emit`.
1. `swap:done` (valid) эмитится до первого `match:found`/`tiles:cleared` этого хода.
2. Перед свапом core вызывает `mechanics.resolveSwap(from,to)`. Не `null` → свап валиден, core чистит `cells` (спецфишки/комбо), иначе обычная логика матчей. Если `isLocked` для from/to — свап запрещён. `resolveSwap` вызывать только когда свап точно будет выполнен: у него есть побочные эффекты (события, урон препятствиям).
3. `match:found`: после `emit` core чистит клетки групп минус `keep` плюс `extra`. Группа 2x2 одного цвета — тоже группа (`shape:'square'`), из неё делается самолётик.
4. `tiles:cleared` эмитится до гравитации: mechanics может снять препятствие (ящик) и освободить клетку.
5. Гравитация/спавн обходят клетки, где `isBlocked(r,c)` (ящик, камень, слизь) — это стены. Фишки с `type<0` (предметы) не матчатся.
6. После успокоения доски core эмитит `turn:end`. Если после `emit` `clear.length` или `dirty` — core чистит `clear`, пересчитывает гравитацию и эмитит `turn:end` снова. Победа/поражение — только после тихого `turn:end`.
7. `clear:request` / `moves:add` / `shuffle:request`: вне хода, ход не тратят; если core занят или игра окончена — ставит `rejected = true`. Решение core принимает синхронно, а саму очистку начинает после возврата из `emit` (mechanics после принятия бьёт ящики/камни). `cells` может быть пустым — тогда core просто пересчитывает доску и эмитит `turn:end`.
8. `shuffle:request`: core сохраняет препятствия на местах и гарантирует наличие хода.

## Расширение mechanics
- Спецфишка: `registerSpecial(name, { priority, detect(info, ctx) → {anchors}|null, fire(at, tile, ctx) → cells, combos:{ [другая]\|'*': (a,b,ctx,pivot) → cells } })`.
- Препятствие: `registerObstacle(kind, { hp, blocksTile, locksSwap, damageBy:['clear'|'adjacent'|'blast'], onTurnEnd(ctx, turn, payload), onDestroy })`.
- Бустер: `registerBooster(kind, { needsTarget, apply(at, ctx) → bool })`.
- Цель: `registerGoal(kind, { init(goal, ctx), defaultAmount(goal, ctx), events:{ [событие]: (goal, state, payload, ctx) → current|undefined } })`.
