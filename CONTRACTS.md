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
LevelDef = { id, board: {cols, rows, layout, specials?, items?}, moves, goals: Goal[], stars: [s1,s2,s3], tileTypes, seed? }
// tileTypes: число типов или массив id; seed — для детерминированного ГСЧ (по умолчанию 1)
// layout: массив строк по rows, символ на клетку: '.' пусто, '#' дыра, 'i' лёд, 'c' цепь, 'x' ящик, 's' слизь.
//   Дыры и ящики (hp>0) неподвижны: фишки не падают через них; цепь не даёт двигать фишку.
```

### LevelDef (JSON в `data/levels/NNN.json`)
- `board.layout` — массив `rows` строк по `cols` символов, `layout[r][c]`, r=0 сверху:
  `.` обычная клетка, `#` дыра (hole), `i`/`I` лёд hp 1/2, `c`/`C` цепь hp 1/2, `x`/`X` ящик hp 1/2, `s` слизь hp 1.
- `board.specials` (необязательно) — заранее выставленные спецфишки `[{r,c,special,type?}]`, на клетках без дыры.
- `board.items` (для цели `drop`) — предметы на старте `[{r,c,item}]`: `item` — имя (`cherry`…), клетка пустая или со льдом,
  не в нижнем ряду, под ней в колонке нет дыр и ящиков. **Core ставит их на доску после заполнения цветами**
  (`tile = {type:-1, special:null, item}`): `buildBoard` возвращает поле без фишек, предметы туда не попадают.
- `tileTypes` — id используемых цветов (подмножество `0..5`), 3–6 штук. `moves` — число ходов.
- `stars` — пороги счёта для 1/2/3 звёзд, строго по возрастанию. Победа определяется целями, звёзды — счётом.
- Цели: `collect` — `target`=id цвета; `clear_obstacle` — `target`=kind, `amount`=сколько снять суммарно
  (для слизи, которая растёт, может быть больше стартового числа клеток); `score` — без `target`;
  `drop` — `target`=имя предмета (без `target` — любые), `amount` ≤ числа таких предметов в `board.items` (валидатор проверяет).
- Загрузчик отдаёт `LevelDef` как есть; готовое поле без фишек строит `levels.buildBoard(levelDef)`.

## События (payload)
| Событие | Кто эмитит | Payload |
|---|---|---|
| `game:ready` | main | — |
| `level:load` | levels | `{ level: LevelDef }` |
| `level:start` | core | `{ board, level }` |
| `input:swap` | ui/render | `{ from:{r,c}, to:{r,c} }` |
| `input:booster` | ui | `{ kind, at?:{r,c} }` |
| `swap:done` | core | `{ from, to, valid, turnId? }` — `turnId` только у валидного свапа |
| `match:found` | core | `{ groups:[{cells,type,shape,dir,at}], chain, step, turnId, swap:{from,to}\|null, trigger, keep:[], extra:[] }` — mechanics синхронно дописывает `keep` (клетки, где остаётся новая спецфишка — не очищать) и `extra` (доп. клетки с фишками для очистки спецэффектами)
| `special:created` | mechanics | `{ at, special }` |
| `special:fired` | mechanics | `{ at, special, affected:[{r,c}] }` — для комбо `special` = `'a+b'` (напр. `'bomb+line_h'`, `'rainbow+tile'`) |
| `tiles:cleared` | core | `{ cells:[{r,c,type}], chain, step, turnId }` |
| `obstacle:damaged` | mechanics | `{ at, kind, hp }` |
| `obstacle:spawned` | mechanics | `{ at, kind, hp, from? }` (напр. слизь расползлась из `from`; фишка в клетке удалена) |
| `booster:used` | mechanics | `{ kind, at? }` — бустер реально применён (meta списывает здесь) |
| `item:dropped` | mechanics | `{ item, at }` |
| `goals:complete` | mechanics | — все цели выполнены; победу (`level:won`) объявляет core, когда доска успокоилась |
| `turn:end` | core | `{ board, clear:[], dirty:false, turnId }` — см. ниже |
| `clear:request` | mechanics | `{ cells:[{r,c}], source, rejected? }` |
| `moves:add` | mechanics | `{ n, rejected? }` |
| `shuffle:request` | mechanics | `{ rejected? }` |
| `tiles:fell` | core | `{ moves:[{from,to,tile}], spawned:[{to,tile}], step, turnId }` |
| `board:settled` | core | `{ board, turnId }` |
| `board:shuffled` | core | `{ board, turnId }` |
| `input:rejected` | core | `{ kind:'swap'\|'hint'\|'clear'\|'moves'\|'shuffle', reason, from?, to? }` — `reason`: `animating` (render занят), `busy` (core в ходе), `over` (игра окончена), `no_level`, `no_moves`, `invalid`, `no_shuffle` |
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
| `music:play` | любой | `{ name: 'menu'\|'game'\|'win', fade? }` |

### Уточнения по матчам (core ↔ mechanics)
- `match:found.groups[i]` = `{cells, type, shape, dir, at}`: `shape` — `line3 | line4 | line5 | L | T | square` (2x2), `dir` — `'h'|'v'|null`, `at` — клетка для спецфишки (клетка свайпа или пересечение L/T). Квадрат 2x2 одного цвета — полноценный матч.
- `swap` = `{from,to}` у первого шага хода (иначе `null`); `trigger` — то же самое, оставлено для совместимости. `chain` с 1. Комбо спецфишек при свапе чистятся без `match:found` (`resolveSwap` → `tiles:cleared` с `chain:1`).
- Доска **живая**: `getBoard()` и `board` в `level:start`/`board:shuffled`/`board:settled`/`turn:end` — один и тот же объект, mechanics меняет его напрямую (препятствия, `special`). Копировать не нужно, но и хранить «снимок» нельзя.
- Очки: 10 за обычную фишку × `chain`; предметы (`type<0`) очков не дают. Цель `score` ведёт mechanics по `score:changed`; core `goal:progress` не эмитит. Победа — по `goals:complete` после тихого `turn:end`; без модуля mechanics — когда счёт ≥ `stars[0]`.
- Гравитация: стены — `hole` и клетки, где `mechanics.isBlocked`. Фишки падают внутри сегментов колонки между стенами; в каждом сегменте пустое место сверху заполняется новыми фишками.
- `swap:done` (valid) для комбо приходит после `special:fired` от `resolveSwap` (core узнаёт о валидности комбо только из его вызова), но до `tiles:cleared`.
- `turnId` растёт с каждым ходом игрока или внеходовым действием (`clear:request`); `step` — номер шага очистки внутри хода с 1 (шаг каскада, комбо, очистка из `turn:end`): `match:found`, `tiles:cleared` и `tiles:fell` одного шага имеют одинаковые `turnId` и `step`. Ядро синхронное и анимаций не ждёт — порядок показа выстраивает render по этим индексам.
- Пока render занят (`render.isBusy()`), core отклоняет `trySwap` (возвращает `false`), `hint()` (`null`) и запросы `clear:request`/`moves:add`/`shuffle:request` (`rejected = true`); во всех случаях эмитится `input:rejected {kind, reason}`. `hint()` при успехе эмитит `hint:show`. `render.timings` ядро не использует: таймеры подсказок и пауз — дело UI/render.
- Внеходовые `clear:request`/`shuffle:request`/`moves:add` — по разделу «Требования механик к core»; очистка по `clear:request` стартует в микротаске после возврата из `emit` (тесты ждут `await Promise.resolve()`).

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
- `audio`: `setVolume(kind, v)` (kind: `music`\|`sfx`, v: 0..1), `mute(bool)`, `getSettings()`, `play(name, {volume, chain})`, `playMusic(name)`, `stopMusic()`
  Имена для `sfx:play`: `select`, `swap`, `invalid`, `match`, `clear`, `special_create`, `line`, `bomb`, `rainbow`, `plane`, `ice`, `chain`, `crate`, `slime`, `booster`, `coin`, `shuffle`, `fall`, `win`, `fail`, `click`, `star`. Звук выбора фишки и клики UI эмитят сами render/ui: `sfx:play {name:'select'|'click'}`.
- `meta`: `addCoins(n)`, `spend(n)`, `inventory()`, `coins()`, `useBooster(kind)` (списывает 1 шт., `false` если нет — UI зовёт перед `input:booster`), `addBooster(kind,n)`; каталог и мета-фичи: `shop`, `daily`, `wheel`, `events`, `quests`, `achievements` (см. `src/meta/index.js`)
- `meta` слушает: `level:start`/`level:load` (id уровня), `level:won`, `level:failed`, `tiles:cleared`, `match:found`, `special:created`, `lives:changed`

Смена сигнатуры публичного API или payload события — только с обновлением этого файла.

## Договорённости визуала
Движок синхронный: все события хода приходят за один тик, поэтому render **не рисует по событию**, а копит их в очередь и проигрывает по шагам. Логическая сетка спрайтов меняется только при проигрывании; для расчётов используются данные из payload'ов (доска живая и к моменту проигрывания уже в конечном состоянии), `board:settled` сверяет сетку по `tile.id`.

Фактический порядок событий одного хода (render на него опирается):
1. Комбо спецфишек: `special:fired` (`special:'a+b'`) приходит **до** `swap:done`. Render рисует обычный свап, затем эффект комбо.
2. `swap:done` → `moves:changed` → `match:found` (внутри него mechanics шлёт `special:fired` цепных спецфишек и `special:created`) → внутри `tiles:cleared` mechanics шлёт `obstacle:damaged` **до** того, как `tiles:cleared` дойдёт до render → `score:changed` → `tiles:fell`.
3. Шаг очереди закрывается на `tiles:cleared`: в него входят накопленные `special:fired`, `special:created`, `obstacle:damaged`, `obstacle:spawned`, `item:dropped`. Воспроизведение: эффекты `special:fired` → исчезновение фишек (группа втягивается в клетку новой спецфишки) и урон препятствиям → превращение `keep`-фишки в спецфишку (`special:created`, фишка не исчезает).
4. События без `tiles:cleared` (слизь на `turn:end`, и т.п.) сбрасываются отдельным шагом на `tiles:fell`/`turn:end`/`board:settled`/`board:shuffled`.
5. `score:changed` после `tiles:cleared` приписывается последнему ещё не начатому шагу («+N» всплывает при очистке).
6. `tiles:fell` — отдельный шаг; следующий шаг не начинается, пока фишки не приземлятся (каскады не накладываются).

Прочее:
- Дыра — `cell.hole` (для старых данных: клетка без фишки и препятствия).
- Фишки сопоставляются по стабильному `tile.id`; предметы (`item`, `type:-1`) рисуются как вишенка.
- `input:booster`: `hammer` (с `at`), `shuffle`, `extra_moves`. `hint` — вызов `core.hint()` + событие `hint:show`.
- `levels.list()` → `[{id, stars?, unlocked?}]`, `levels.progress()` → `{unlocked, stars:{[id]:n}}`; `meta.inventory()` → `{[kind]: n}`.
- UI запускает уровни через `levels.loadLevel(id)`; HUD берёт данные из `level:load`/`level:start`; экран победы/поражения показывается, когда `render.isBusy()` стал false.
- `render.isBusy()` — true, пока очередь не пуста или что-то движется; core по нему отклоняет ввод. `render.timings` — длительности в секундах.

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
