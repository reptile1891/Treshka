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
LevelDef = { id, board: {cols, rows, layout}, moves, goals: Goal[], stars: [s1,s2,s3], tileTypes }
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
| `lives:changed` | levels | `{ lives, nextAt }` |
| `coins:changed` | meta | `{ coins, delta }` |
| `sfx:play` | любой | `{ name, volume? }` |
| `music:play` | любой | `{ name: 'menu'\|'game'\|'win', fade? }` |

Новые события добавляйте в эту таблицу тем же коммитом.

## Публичные API
- `core`: `startLevel(levelDef)`, `trySwap(from,to)`, `getBoard()`, `hint()`
- `mechanics`: `registerSpecial(name, handler)`, `registerObstacle(kind, handler)`, `useBooster(kind, at)`
- `levels`: `loadLevel(id)`, `list()`, `progress()`
- `render`: `setTheme(theme)`
- `ui`: `showScreen(name)`
- `audio`: `setVolume(kind, v)` (kind: `music`\|`sfx`, v: 0..1), `mute(bool)`, `getSettings()`, `play(name, {volume, chain})`, `playMusic(name)`, `stopMusic()`

Имена для `sfx:play`: `select`, `swap`, `invalid`, `match`, `clear`, `special_create`, `line`, `bomb`, `rainbow`, `plane`, `ice`, `chain`, `crate`, `slime`, `booster`, `coin`, `shuffle`, `fall`, `win`, `fail`, `click`, `star`. Звук выбора фишки и клики UI эмитят сами render/ui: `sfx:play {name:'select'|'click'}`.
- `meta`: `addCoins(n)`, `spend(n)`, `inventory()`

Смена сигнатуры публичного API или payload события — только с обновлением этого файла.
