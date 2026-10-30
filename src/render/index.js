// Модуль "render". Контракт: см. CONTRACTS.md
// Рисует поле на Canvas: спрайты фишек живут в собственной сетке и анимируются по событиям шины.
import { THEMES } from './theme.js';
import { buildAtlas, obstacleImg, makeIcon, SPECIAL_INDEX } from './art.js';
import { resizeBg, drawBg, parallax } from './background.js';
import { setPalette, burst, floatText, ring, beam, addShake, updateFx, drawFx, shake } from './fx.js';
import { initInput, sel } from './input.js';

const TIMINGS = { swap: 0.18, clear: 0.3, fall: 0.5, shuffle: 0.45, spawn: 0.5 };
const GRAVITY = 70;           // клеток/с²
const FONT = '800 40px "Trebuchet MS", system-ui, sans-serif';
const COMBO = ['', '', 'Отлично!', 'Супер!', 'Потрясающе!', 'Невероятно!'];
const SPECIAL_TEXT = { line_h: 'Полоса!', line_v: 'Полоса!', bomb: 'Бум!', rainbow: 'Радуга!', plane: 'Самолёт!' };
const OBS_COLOR = { ice: 10, crate: 8, chain: 6, slime: 9 };
const HUD_MAX = 128, BOOST_MAX = 96;

export function init(game) {
  const { bus, canvas, config } = game;
  const g = canvas.getContext('2d');

  let theme = THEMES.candy, atlas = null, atlasTimer = 0;
  let dpr = 1, W = 0, H = 0, cell = 48, bx = 0, by = 0, hudH = HUD_MAX, boostH = BOOST_MAX;
  let cols = config.gridCols, rows = config.gridRows;
  let grid = [], obst = [], holes = [];
  const sprites = [], free = [], byId = new Map();
  let backdrop = null, bdMargin = 0;
  let screen = 'menu', showBoard = false, boardAlpha = 0, active = false, finished = false;
  let armed = null, time = 0, nextSyn = -1;
  let lastCx = 0, lastCy = 0;
  const lastType = new Map();
  const hint = { t: 0, r1: -1, c1: -1, r2: -1, c2: -1 };
  const colCount = new Int16Array(32);

  // ---------- Тема и раскладка ----------
  function applyPalette() {
    setPalette([...theme.tiles, '#ffffff', theme.accent, '#c98a4a', '#7be04a', '#9fdcff']);
  }

  function rebuildAtlas() {
    atlas = buildAtlas(theme, Math.max(16, Math.round(cell * dpr)));
  }

  function drawBackdrop() {
    bdMargin = Math.round(cell * 0.14);
    const w = cell * cols + bdMargin * 2, h = cell * rows + bdMargin * 2;
    backdrop = document.createElement('canvas');
    backdrop.width = Math.ceil(w * dpr); backdrop.height = Math.ceil(h * dpr);
    const b = backdrop.getContext('2d');
    b.scale(dpr, dpr);
    const rad = cell * 0.3;
    b.beginPath(); b.roundRect ? b.roundRect(0, 0, w, h, rad) : b.rect(0, 0, w, h);
    b.fillStyle = theme.boardFill; b.fill();
    b.lineWidth = 3; b.strokeStyle = theme.border; b.stroke();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (holes[r]?.[c]) continue;
      b.fillStyle = (r + c) & 1 ? theme.cellA : theme.cellB;
      b.fillRect(bdMargin + c * cell, bdMargin + r * cell, cell, cell);
    }
  }

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    hudH = Math.min(HUD_MAX, H * 0.2); boostH = Math.min(BOOST_MAX, H * 0.16);
    const rs = document.documentElement.style;
    rs.setProperty('--hud-h', hudH + 'px'); rs.setProperty('--boost-h', boostH + 'px');
    const pad = Math.max(10, W * 0.025);
    const availW = W - pad * 2, availH = H - hudH - boostH - pad;
    const old = cell;
    cell = Math.max(16, Math.floor(Math.min(availW / cols, availH / rows)));
    bx = Math.round((W - cell * cols) / 2);
    by = Math.round(hudH + (availH - cell * rows) / 2 + pad * 0.5);
    resizeBg(theme, W, H, dpr);
    drawBackdrop();
    if (!atlas) rebuildAtlas();
    else if (old !== cell) { clearTimeout(atlasTimer); atlasTimer = setTimeout(rebuildAtlas, 120); }
    bus.emit('render:layout', { x: bx, y: by, cell, cols, rows, hudH, boostH });
  }

  function setTheme(t) {
    const next = typeof t === 'string' ? THEMES[t] : t;
    if (!next) return;
    if (typeof t === 'object') THEMES[next.name] = next;
    theme = next; applyPalette(); rebuildAtlas(); resizeBg(theme, W, H, dpr); drawBackdrop();
    bus.emit('theme:changed', { name: theme.name });
  }

  // ---------- Спрайты ----------
  function newSprite() {
    return free.pop() ?? {
      id: 0, type: 0, special: 0, x: 0, y: 0, tx: 0, ty: 0, fx: 0, fy: 0, vy: 0,
      mode: 0, t: 0, dur: 0.2, pp: false, delay: 0, scale: 1, sq: 0, alpha: 1, rot: 0, dying: 0, dt: 0, pop: 0, mark: false,
    };
  }

  function spawn(tile, r, c, startY, delay) {
    const s = newSprite();
    s.id = tile.id ?? nextSyn--; s.type = tile.type | 0;
    s.special = SPECIAL_INDEX[tile.special] ?? 0;
    s.x = s.tx = c; s.y = startY; s.ty = r; s.fx = c; s.fy = startY;
    s.vy = 0; s.mode = startY < r ? 2 : 0; s.t = 0; s.pp = false; s.delay = delay;
    s.scale = 1; s.sq = 0; s.alpha = 1; s.rot = 0; s.dying = 0; s.dt = 0; s.pop = 0;
    sprites.push(s); byId.set(s.id, s);
    return s;
  }

  function kill(s, kind) {
    s.dying = kind; s.dt = 0; s.mode = 0;
    if (byId.get(s.id) === s) byId.delete(s.id);
  }

  function clearAll() {
    for (const s of sprites) free.push(s);
    sprites.length = 0; byId.clear();
    grid = []; obst = []; holes = [];
    for (let r = 0; r < rows; r++) { grid.push(new Array(cols).fill(null)); obst.push(new Array(cols).fill(null)); holes.push(new Array(cols).fill(false)); }
  }

  const px = (c) => bx + (c + 0.5) * cell;
  const py = (r) => by + (r + 0.5) * cell;

  function tweenTo(s, r, c, dur, pp = false) {
    s.fx = s.x; s.fy = s.y; s.tx = c; s.ty = r; s.t = 0; s.dur = dur; s.mode = 1; s.pp = pp;
  }

  // Сверяет сетку спрайтов с моделью поля (по id фишек).
  function reconcile(board, dur) {
    for (const s of sprites) s.mark = false;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c] = null;
    for (let r = 0; r < board.rows; r++) for (let c = 0; c < board.cols; c++) {
      const cl = board.cells[r][c], t = cl.tile, o = cl.obstacle;
      const cur = obst[r][c];
      if (o && (!cur || cur.dying || cur.kind !== o.kind)) obst[r][c] = { kind: o.kind, hp: o.hp, flash: 0, dying: 0, t: 0 };
      else if (o) cur.hp = o.hp;
      else if (cur && !cur.dying) { cur.dying = 1; cur.t = 0; }
      if (!t) continue;
      let s = byId.get(t.id);
      if (!s) { // синтетический спрайт (спецфишка из special:created) подхватываем по месту
        const e = sprites.find((x) => !x.dying && x.id < 0 && Math.round(x.ty) === r && Math.round(x.tx) === c);
        if (e) { byId.delete(e.id); e.id = t.id; byId.set(e.id, e); s = e; }
      }
      if (!s) s = spawn(t, r, c, r - 1, 0), s.alpha = 0, s.pop = 1;
      s.mark = true; s.type = t.type; s.special = SPECIAL_INDEX[t.special] ?? 0;
      grid[r][c] = s;
      if (s.mode === 0 && (Math.abs(s.x - c) > 0.01 || Math.abs(s.y - r) > 0.01)) tweenTo(s, r, c, dur);
      else { s.tx = c; s.ty = r; }
    }
    for (const s of sprites) if (!s.mark && !s.dying) kill(s, 2);
  }

  // ---------- События ----------
  bus.on('level:start', ({ board }) => {
    cols = board.cols; rows = board.rows;
    clearAll(); lastType.clear();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cl = board.cells[r][c];
      holes[r][c] = !cl.tile && !cl.obstacle;
    }
    layout();
    reconcileInitial(board);
    active = true; finished = false; armed = null; sel.on = false; hint.t = 0;
  });

  function reconcileInitial(board) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cl = board.cells[r][c];
      if (cl.obstacle) obst[r][c] = { kind: cl.obstacle.kind, hp: cl.obstacle.hp, flash: 0, dying: 0, t: 0 };
      if (cl.tile) grid[r][c] = spawn(cl.tile, r, c, -rows + r - 1, (rows - r) * 0.035 + c * 0.025);
    }
  }

  bus.on('swap:done', ({ from, to, valid }) => {
    const a = grid[from.r]?.[from.c], b = grid[to.r]?.[to.c];
    if (!a || !b) return;
    if (valid) {
      grid[from.r][from.c] = b; grid[to.r][to.c] = a;
      tweenTo(a, to.r, to.c, TIMINGS.swap); tweenTo(b, from.r, from.c, TIMINGS.swap);
      a.scale = b.scale = 1;
    } else {
      tweenTo(a, to.r, to.c, TIMINGS.swap * 1.6, true); tweenTo(b, from.r, from.c, TIMINGS.swap * 1.6, true);
      addShake(3);
    }
    sel.on = false;
  });

  bus.on('tiles:cleared', ({ cells, chain }) => {
    let sx = 0, sy = 0, n = 0;
    for (const { r, c, type } of cells) {
      const s = grid[r]?.[c];
      lastType.set(r * 64 + c, type);
      if (s) { kill(s, 1); grid[r][c] = null; }
      burst(px(c), py(r), type, 9, cell * 5, cell * 0.08);
      sx += px(c); sy += py(r); n++;
    }
    if (!n) return;
    lastCx = sx / n; lastCy = sy / n;
    const k = cell / 48;
    if (chain >= 2) {
      floatText(COMBO[Math.min(chain, COMBO.length - 1)], bx + cell * cols / 2, by + cell * rows * 0.4, theme.accent, k * (1 + Math.min(chain, 6) * 0.08), 1.3, true);
      addShake(Math.min(2 + chain * 1.5, 10));
    } else if (n >= 5) addShake(2);
  });

  bus.on('score:changed', ({ delta }) => {
    if (delta > 0 && lastCx) floatText('+' + delta, lastCx, lastCy, '#fff', cell / 70, 0.9);
  });

  bus.on('special:created', ({ at, special }) => {
    let s = grid[at.r]?.[at.c];
    const idx = SPECIAL_INDEX[special] ?? 0;
    if (!s || s.dying) {
      s = spawn({ type: lastType.get(at.r * 64 + at.c) ?? 0, special }, at.r, at.c, at.r, 0);
      grid[at.r][at.c] = s;
    }
    s.special = idx; s.pop = 1; s.sq = -0.3;
    ring(px(at.c), py(at.r), cell * 0.9, 7, 0.45);
    burst(px(at.c), py(at.r), 6, 14, cell * 6, cell * 0.07);
  });

  bus.on('special:fired', ({ at, special, affected }) => {
    const x = px(at.c), y = py(at.r), n = affected?.length ?? 0, w = cell * 0.35;
    if (special === 'line_h') beam(bx, y, bx + cols * cell, y, w, 7);
    else if (special === 'line_v') beam(x, by, x, by + rows * cell, w, 7);
    else if (special === 'rainbow' || special === 'plane') {
      for (let i = 0; i < n && i < 20; i++) beam(x, y, px(affected[i].c), py(affected[i].r), w * 0.6, special === 'plane' ? 6 : i % 6, 0.45);
    }
    ring(x, y, cell * (special === 'bomb' ? 2.2 : 1.4), 7, 0.5);
    burst(x, y, 7, 18, cell * 8, cell * 0.09);
    addShake(Math.min(5 + n * 0.5, 14));
    floatText(SPECIAL_TEXT[special] ?? 'Бум!', x, y - cell * 0.6, '#fff', cell / 50, 0.9, true);
  });

  bus.on('obstacle:damaged', ({ at, kind, hp }) => {
    const o = obst[at.r]?.[at.c];
    if (!o) return;
    o.hp = hp; o.flash = 1;
    const x = px(at.c), y = py(at.r), ci = OBS_COLOR[kind] ?? 6;
    if (hp <= 0) { o.dying = 1; o.t = 0; burst(x, y, ci, 16, cell * 6, cell * 0.1); addShake(2.5); }
    else burst(x, y, ci, 7, cell * 4, cell * 0.07);
  });

  bus.on('tiles:fell', ({ moves, spawned }) => {
    const tmp = [];
    for (const m of moves) {
      const s = byId.get(m.tile?.id) ?? grid[m.from.r]?.[m.from.c];
      if (!s) continue;
      if (grid[m.from.r][m.from.c] === s) grid[m.from.r][m.from.c] = null;
      tmp.push(s, m.to);
    }
    for (let i = 0; i < tmp.length; i += 2) {
      const s = tmp[i], to = tmp[i + 1];
      grid[to.r][to.c] = s; s.tx = to.c; s.ty = to.r;
      if (s.y < to.r - 0.001) { s.mode = 2; s.delay = 0; } else if (s.mode !== 2) tweenTo(s, to.r, to.c, 0.15);
    }
    colCount.fill(0);
    for (const sp of spawned) colCount[sp.to.c]++;
    for (const sp of spawned) {
      const s = spawn(sp.tile, sp.to.r, sp.to.c, sp.to.r - colCount[sp.to.c] - 0.2, 0);
      grid[sp.to.r][sp.to.c] = s;
    }
  });

  bus.on('board:settled', ({ board }) => { if (board) reconcile(board, 0.2); });
  bus.on('board:shuffled', ({ board }) => {
    reconcile(board, TIMINGS.shuffle);
    for (const s of sprites) if (!s.dying) s.pop = 1;
    floatText('Перемешивание!', bx + cell * cols / 2, by + cell * rows / 2, '#fff', cell / 50, 1.2, true);
  });
  bus.on('hint:show', ({ cells }) => {
    if (!cells?.length) return;
    hint.r1 = cells[0].r; hint.c1 = cells[0].c;
    hint.r2 = cells[1]?.r ?? -1; hint.c2 = cells[1]?.c ?? -1; hint.t = 1.8;
  });
  bus.on('level:won', () => {
    finished = true;
    for (let i = 0; i < 28; i++) burst(bx + Math.random() * cols * cell, by + cell, i % 8, 5, cell * 8, cell * 0.12);
  });
  bus.on('level:failed', () => { finished = true; });
  bus.on('booster:armed', ({ kind }) => { armed = kind; });
  bus.on('ui:screen', ({ name }) => {
    screen = name; showBoard = name === 'game' || name === 'pause' || name === 'win' || name === 'lose';
    if (name !== 'game') { sel.on = false; armed = null; }
  });

  // ---------- Ввод ----------
  initInput(game, {
    enabled: () => screen === 'game' && active && !finished,
    armed: () => armed,
    cellSize: () => cell,
    rows: () => rows, cols: () => cols,
    hit(x, y, out) {
      const c = Math.floor((x - bx) / cell), r = Math.floor((y - by) / cell);
      if (r < 0 || c < 0 || r >= rows || c >= cols || holes[r]?.[c]) return false;
      out.r = r; out.c = c; return true;
    },
    onMove(x, y) { parallax.tx = x / W - 0.5; parallax.ty = y / H - 0.5; },
  });

  // ---------- Кадр ----------
  const back = (t) => { const c = 1.9, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; }; // easeOutBack

  function update(dt) {
    for (let i = sprites.length - 1; i >= 0; i--) {
      const s = sprites[i];
      if (s.dying) {
        s.dt += dt;
        const lim = s.dying === 1 ? TIMINGS.clear : 0.25;
        if (s.dt >= lim) { sprites[i] = sprites[sprites.length - 1]; sprites.pop(); free.push(s); }
        continue;
      }
      if (s.delay > 0) { s.delay -= dt; continue; }
      if (s.mode === 1) {
        s.t += dt / s.dur;
        const k = s.t >= 1 ? 1 : s.t;
        if (s.pp) { const e = Math.sin(Math.PI * k) * 0.4; s.x = s.fx + (s.tx - s.fx) * e; s.y = s.fy + (s.ty - s.fy) * e; if (k >= 1) { s.x = s.fx; s.y = s.fy; s.tx = s.fx; s.ty = s.fy; } }
        else { const e = back(k); s.x = s.fx + (s.tx - s.fx) * e; s.y = s.fy + (s.ty - s.fy) * e; }
        if (k >= 1) { s.mode = 0; s.x = s.tx; s.y = s.ty; }
      } else if (s.mode === 2) {
        s.vy += GRAVITY * dt; s.y += s.vy * dt;
        s.x += (s.tx - s.x) * Math.min(1, dt * 16);
        if (s.y >= s.ty) {
          s.y = s.ty;
          if (s.vy > 7) { s.sq = Math.min(0.2, s.vy * 0.012); s.vy = -s.vy * 0.22; }
          else { s.vy = 0; s.mode = 0; s.x = s.tx; }
        }
      }
      if (s.sq) { s.sq *= Math.exp(-dt * 11); if (Math.abs(s.sq) < 0.003) s.sq = 0; }
      if (s.pop > 0) s.pop = Math.max(0, s.pop - dt * 3);
      if (s.alpha < 1) s.alpha = Math.min(1, s.alpha + dt * 6);
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const o = obst[r][c]; if (!o) continue;
      if (o.flash > 0) o.flash = Math.max(0, o.flash - dt * 4);
      if (o.dying) { o.t += dt * 4; if (o.t >= 1) obst[r][c] = null; }
    }
    if (hint.t > 0) hint.t -= dt;
    updateFx(dt);
  }

  function put(img, cx, cy, sx, sy, rot, a) {
    const co = Math.cos(rot), si = Math.sin(rot);
    g.globalAlpha = a;
    g.setTransform(dpr * sx * co, dpr * sx * si, -dpr * sy * si, dpr * sy * co, dpr * cx, dpr * cy);
    g.drawImage(img, -cell / 2, -cell / 2, cell, cell);
  }

  function draw(dt) {
    time += dt;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBg(g, time, dt);
    boardAlpha += ((showBoard ? 1 : 0) - boardAlpha) * Math.min(1, dt * 7);
    if (boardAlpha < 0.01 || !atlas) return;
    const ox = shake.x, oy = shake.y;
    g.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
    g.globalAlpha = boardAlpha;
    g.drawImage(backdrop, bx - bdMargin, by - bdMargin, cell * cols + bdMargin * 2, cell * rows + bdMargin * 2);
    g.save();
    g.beginPath(); g.rect(bx - 2, by - 2, cell * cols + 4, cell * rows + 4); g.clip();
    for (let i = 0; i < sprites.length; i++) {
      const s = sprites[i];
      let sc = s.scale, a = s.alpha * boardAlpha;
      if (s.dying) {
        const k = Math.min(1, s.dt / (s.dying === 1 ? TIMINGS.clear : 0.25));
        sc *= s.dying === 1 ? (k < 0.2 ? 1 + k * 1.5 : 1.3 * (1 - (k - 0.2) / 0.8)) : 1 - k;
        a *= s.dying === 1 ? 1 - k * k : 1 - k;
      }
      if (s.pop > 0) sc *= 1 + Math.sin(s.pop * Math.PI) * 0.3;
      if (s.special) sc *= 1 + 0.035 * Math.sin(time * 5 + s.id);
      if (hint.t > 0 && ((Math.round(s.ty) === hint.r1 && Math.round(s.tx) === hint.c1) || (Math.round(s.ty) === hint.r2 && Math.round(s.tx) === hint.c2))) {
        sc *= 1 + 0.12 * Math.abs(Math.sin(time * 7));
      }
      if (sel.on && !s.dying && Math.round(s.ty) === sel.r && Math.round(s.tx) === sel.c) sc *= 1.1 + 0.04 * Math.sin(time * 9);
      const rot = s.special === 5 ? time * 1.4 : sel.on && Math.round(s.ty) === sel.r && Math.round(s.tx) === sel.c ? Math.sin(time * 10) * 0.06 : 0;
      put(atlas.tiles[s.special][s.special === 5 ? 0 : s.type], px(s.x) + ox, py(s.y) + oy, sc * (1 + s.sq), sc * (1 - s.sq), rot, a);
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const o = obst[r][c]; if (!o) continue;
      const j = o.flash > 0 ? Math.sin(o.flash * 30) * o.flash * cell * 0.05 : 0;
      const k = o.dying ? o.t : 0;
      put(obstacleImg(atlas, o.kind, o.hp), px(c) + j + ox, py(r) + oy, 1 + k * 0.35, 1 + k * 0.35, k * 0.3, (1 - k) * boardAlpha);
    }
    if (sel.on) { // рамка выбранной клетки
      g.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
      g.globalAlpha = (0.6 + 0.3 * Math.sin(time * 8)) * boardAlpha;
      g.lineWidth = 3; g.strokeStyle = theme.accent;
      g.strokeRect(bx + sel.c * cell + 2, by + sel.r * cell + 2, cell - 4, cell - 4);
    }
    g.restore();
    g.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
    if (armed) { // подсказка режима бустера
      g.globalAlpha = 0.25 + 0.15 * Math.sin(time * 6); g.fillStyle = theme.accent;
      g.fillRect(bx, by, cell * cols, cell * rows);
    }
    drawFx(g, FONT);
    g.globalAlpha = 1;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw(dt);
    requestAnimationFrame(frame);
  }

  applyPalette();
  clearAll();
  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', layout);
  requestAnimationFrame(frame);

  game.modules.render = {
    setTheme,
    themes: () => Object.keys(THEMES).map((k) => ({ name: k, title: THEMES[k].title ?? k })),
    getTheme: () => theme.name,
    // Иконка для UI: kind 'tile'|'special'|'obstacle', key — тип/имя, hp для препятствий.
    icon: (kind, key, hp = 1) => makeIcon(theme, kind, key, hp),
    timings: TIMINGS,
    // true, пока что-то движется или исчезает — ядро может подождать перед следующим шагом.
    isBusy: () => sprites.some((s) => s.dying || s.mode !== 0 || s.delay > 0),
  };
}
