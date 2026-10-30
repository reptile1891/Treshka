// Процедурная графика: фишки, спецфишки, препятствия рисуются один раз в офскрин-канвасы (атлас).
// В кадре остаётся только drawImage — без градиентов и аллокаций.
import { shade, alpha } from './theme.js';

export const SPECIALS = [null, 'line_h', 'line_v', 'bomb', 'plane', 'rainbow'];
export const SPECIAL_INDEX = { line_h: 1, line_v: 2, bomb: 3, plane: 4, rainbow: 5 };
export const OBSTACLE_KINDS = ['ice', 'chain', 'crate', 'slime'];

function mk(px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  return c;
}

// Контур формы: у каждого цвета своя форма (доступность для дальтоников).
function shapePath(g, type, cx, cy, r) {
  g.beginPath();
  switch (type) {
    case 0: g.arc(cx, cy, r, 0, Math.PI * 2); break; // круг
    case 1: { // скруглённый квадрат
      const s = r * 0.92, k = r * 0.34;
      g.moveTo(cx - s + k, cy - s);
      g.arcTo(cx + s, cy - s, cx + s, cy + s, k);
      g.arcTo(cx + s, cy + s, cx - s, cy + s, k);
      g.arcTo(cx - s, cy + s, cx - s, cy - s, k);
      g.arcTo(cx - s, cy - s, cx + s, cy - s, k);
      break;
    }
    case 2: // звезда
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.52 : r * 1.08;
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      break;
    case 3: // треугольник
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
        g.lineTo(cx + Math.cos(a) * r * 1.12, cy + Math.sin(a) * r * 1.12 + r * 0.14);
      }
      break;
    case 4: // ромб
      g.moveTo(cx, cy - r * 1.08); g.lineTo(cx + r * 0.88, cy);
      g.lineTo(cx, cy + r * 1.08); g.lineTo(cx - r * 0.88, cy);
      break;
    default: // шестиугольник
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.lineTo(cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02);
      }
  }
  g.closePath();
}

function drawBody(g, s, type, color) {
  const cx = s / 2, cy = s / 2, r = s * 0.37;
  shapePath(g, type, cx, cy, r);
  // тень под фишкой
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = s * 0.06; g.shadowOffsetY = s * 0.035;
  g.fillStyle = shade(color, -0.4); g.fill();
  g.restore();
  const grad = g.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r * 1.25);
  grad.addColorStop(0, shade(color, 0.55));
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, shade(color, -0.38));
  shapePath(g, type, cx, cy, r);
  g.fillStyle = grad; g.fill();
  g.lineJoin = 'round'; g.lineWidth = s * 0.035;
  g.strokeStyle = shade(color, -0.55); g.stroke();
  // блик
  g.save();
  shapePath(g, type, cx, cy, r); g.clip();
  const hl = g.createLinearGradient(0, cy - r, 0, cy);
  hl.addColorStop(0, 'rgba(255,255,255,0.7)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl;
  g.beginPath(); g.ellipse(cx - r * 0.1, cy - r * 0.5, r * 0.62, r * 0.36, -0.25, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath(); g.arc(cx - r * 0.45, cy - r * 0.42, r * 0.09, 0, Math.PI * 2); g.fill();
  g.restore();
}

function arrow(g, cx, cy, len, w, ang) {
  g.save(); g.translate(cx, cy); g.rotate(ang);
  g.beginPath();
  g.moveTo(len, 0); g.lineTo(len * 0.35, -w); g.lineTo(len * 0.35, w); g.closePath();
  g.fill(); g.stroke(); g.restore();
}

function drawSpecial(g, s, special, color) {
  const cx = s / 2, cy = s / 2, u = s / 100;
  g.lineJoin = 'round'; g.lineWidth = 2.5 * u;
  g.fillStyle = '#fff'; g.strokeStyle = shade(color, -0.6);
  if (special === 'line_h' || special === 'line_v') {
    const base = special === 'line_h' ? 0 : Math.PI / 2;
    for (let i = 0; i < 2; i++) arrow(g, cx, cy, 30 * u, 11 * u, base + i * Math.PI);
    g.beginPath(); g.arc(cx, cy, 7 * u, 0, Math.PI * 2); g.fill(); g.stroke();
  } else if (special === 'bomb') {
    g.save();
    g.shadowColor = '#fff'; g.shadowBlur = 10 * u;
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3 * u;
    g.beginPath(); g.arc(cx, cy, 31 * u, 0, Math.PI * 2); g.stroke();
    g.restore();
    const gr = g.createRadialGradient(cx - 6 * u, cy - 7 * u, 2 * u, cx, cy, 22 * u);
    gr.addColorStop(0, '#6a6a7a'); gr.addColorStop(1, '#14141c');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy + 2 * u, 21 * u, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8b5a2b'; g.lineWidth = 4 * u; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx + 8 * u, cy - 16 * u); g.quadraticCurveTo(cx + 18 * u, cy - 28 * u, cx + 24 * u, cy - 26 * u); g.stroke();
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(cx + 25 * u, cy - 27 * u, 5 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(cx - 7 * u, cy - 5 * u, 4.5 * u, 0, Math.PI * 2); g.fill();
  } else if (special === 'plane') {
    g.save(); g.translate(cx, cy); g.rotate(-0.6);
    g.beginPath();
    g.moveTo(32 * u, 0); g.lineTo(-24 * u, -22 * u); g.lineTo(-10 * u, 0); g.lineTo(-24 * u, 22 * u); g.closePath();
    g.fill(); g.stroke();
    g.beginPath(); g.moveTo(32 * u, 0); g.lineTo(-10 * u, 0); g.stroke();
    g.restore();
  }
}

// Радужная фишка: сектора цветов темы.
function drawRainbow(g, s, colors) {
  const cx = s / 2, cy = s / 2, r = s * 0.38, n = colors.length;
  for (let i = 0; i < n; i++) {
    g.beginPath(); g.moveTo(cx, cy);
    g.arc(cx, cy, r, (i * Math.PI * 2) / n, ((i + 1) * Math.PI * 2) / n); g.closePath();
    g.fillStyle = colors[i]; g.fill();
  }
  const gr = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.lineWidth = s * 0.04; g.strokeStyle = '#fff'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.12 : r * 0.38;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

// --- Препятствия (рисуются на весь размер клетки) ---
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function drawIce(g, s, hp) {
  const p = s * 0.04;
  rr(g, p, p, s - 2 * p, s - 2 * p, s * 0.14);
  const gr = g.createLinearGradient(0, 0, s, s);
  const a = 0.28 + 0.12 * hp;
  gr.addColorStop(0, `rgba(235,250,255,${a + 0.2})`); gr.addColorStop(1, `rgba(120,200,255,${a})`);
  g.fillStyle = gr; g.fill();
  g.lineWidth = s * 0.035; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = s * 0.03; g.lineCap = 'round';
  g.beginPath(); g.moveTo(s * 0.2, s * 0.3); g.lineTo(s * 0.4, s * 0.15); g.moveTo(s * 0.18, s * 0.45); g.lineTo(s * 0.26, s * 0.38); g.stroke();
  if (hp <= 2) { // трещины
    g.strokeStyle = 'rgba(60,120,190,0.8)'; g.lineWidth = s * 0.02;
    g.beginPath(); g.moveTo(s * 0.55, s * 0.12); g.lineTo(s * 0.48, s * 0.38); g.lineTo(s * 0.62, s * 0.55); g.lineTo(s * 0.5, s * 0.85); g.stroke();
  }
  if (hp <= 1) {
    g.beginPath(); g.moveTo(s * 0.48, s * 0.38); g.lineTo(s * 0.2, s * 0.6); g.lineTo(s * 0.12, s * 0.8); g.moveTo(s * 0.62, s * 0.55); g.lineTo(s * 0.88, s * 0.5); g.stroke();
  }
}

function drawChain(g, s, hp) {
  const links = 5;
  g.lineCap = 'round';
  for (let k = 0; k < Math.min(2, hp); k++) {
    g.save(); g.translate(s / 2, s / 2); g.rotate(k ? -Math.PI / 4 : Math.PI / 4);
    for (let i = 0; i < links; i++) {
      const x = (i - (links - 1) / 2) * s * 0.2;
      g.beginPath(); g.ellipse(x, 0, s * 0.1, s * 0.055, 0, 0, Math.PI * 2);
      g.lineWidth = s * 0.05; g.strokeStyle = '#4a4f5c'; g.stroke();
      g.lineWidth = s * 0.028; g.strokeStyle = i % 2 ? '#c9ced8' : '#e8ebf2'; g.stroke();
    }
    g.restore();
  }
  // замок
  const cx = s / 2, cy = s / 2;
  g.strokeStyle = '#6b5a1e'; g.lineWidth = s * 0.05;
  g.beginPath(); g.arc(cx, cy - s * 0.07, s * 0.08, Math.PI, 0); g.stroke();
  g.fillStyle = '#ffcc33'; rr(g, cx - s * 0.12, cy - s * 0.06, s * 0.24, s * 0.2, s * 0.04); g.fill();
  g.lineWidth = s * 0.025; g.strokeStyle = '#8a6a14'; g.stroke();
  g.fillStyle = '#6b5a1e'; g.beginPath(); g.arc(cx, cy + s * 0.03, s * 0.03, 0, Math.PI * 2); g.fill();
}

function drawCrate(g, s, hp) {
  const p = s * 0.06;
  rr(g, p, p, s - 2 * p, s - 2 * p, s * 0.08);
  const gr = g.createLinearGradient(0, 0, 0, s);
  gr.addColorStop(0, '#d89a55'); gr.addColorStop(1, '#a8672c');
  g.fillStyle = gr; g.fill();
  g.lineWidth = s * 0.045; g.strokeStyle = '#5e3512'; g.stroke();
  g.lineWidth = s * 0.03; g.strokeStyle = '#7a4719';
  g.beginPath();
  g.moveTo(p, s * 0.36); g.lineTo(s - p, s * 0.36); g.moveTo(p, s * 0.64); g.lineTo(s - p, s * 0.64);
  g.moveTo(p, p); g.lineTo(s - p, s - p); g.moveTo(s - p, p); g.lineTo(p, s - p);
  g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
  g.fillStyle = '#3d2410';
  for (const [x, y] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]]) {
    g.beginPath(); g.arc(s * x, s * y, s * 0.025, 0, Math.PI * 2); g.fill();
  }
  if (hp <= 2) { g.strokeStyle = '#2a1608'; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(s * 0.6, s * 0.1); g.lineTo(s * 0.5, s * 0.3); g.lineTo(s * 0.62, s * 0.42); g.stroke(); }
  if (hp <= 1) { g.beginPath(); g.moveTo(s * 0.2, s * 0.9); g.lineTo(s * 0.34, s * 0.7); g.lineTo(s * 0.28, s * 0.58); g.moveTo(s * 0.75, s * 0.9); g.lineTo(s * 0.66, s * 0.72); g.stroke(); }
}

function drawSlime(g, s, hp) {
  const a = hp > 1 ? 0.8 : 0.6;
  g.beginPath();
  g.moveTo(s * 0.1, s * 0.15);
  g.bezierCurveTo(s * 0.4, s * 0.02, s * 0.7, s * 0.08, s * 0.92, s * 0.18);
  g.bezierCurveTo(s * 1.0, s * 0.5, s * 0.95, s * 0.8, s * 0.82, s * 0.92);
  g.bezierCurveTo(s * 0.7, s * 0.85, s * 0.66, s * 1.0, s * 0.55, s * 0.9);
  g.bezierCurveTo(s * 0.45, s * 1.0, s * 0.32, s * 0.88, s * 0.18, s * 0.92);
  g.bezierCurveTo(s * 0.02, s * 0.7, s * 0.0, s * 0.4, s * 0.1, s * 0.15);
  g.closePath();
  const gr = g.createRadialGradient(s * 0.4, s * 0.35, s * 0.05, s * 0.5, s * 0.5, s * 0.6);
  gr.addColorStop(0, `rgba(190,255,120,${a})`); gr.addColorStop(1, `rgba(70,190,40,${a})`);
  g.fillStyle = gr; g.fill();
  g.lineWidth = s * 0.03; g.strokeStyle = 'rgba(30,110,20,0.8)'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.beginPath(); g.ellipse(s * 0.32, s * 0.28, s * 0.09, s * 0.05, -0.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(s * 0.68, s * 0.6, s * 0.035, 0, Math.PI * 2); g.fill();
}

const OBS_DRAW = { ice: [drawIce, 3], chain: [drawChain, 2], crate: [drawCrate, 3], slime: [drawSlime, 2] };

function drawUnknownObstacle(g, s) {
  rr(g, s * 0.1, s * 0.1, s * 0.8, s * 0.8, s * 0.12);
  g.fillStyle = 'rgba(80,80,100,0.55)'; g.fill();
  g.lineWidth = s * 0.04; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.setLineDash([s * 0.08, s * 0.06]); g.stroke(); g.setLineDash([]);
}

// Собирает атлас под тему и размер клетки в device-пикселях.
export function buildAtlas(theme, px) {
  const tiles = []; // tiles[specialIndex][type]
  for (let si = 0; si < SPECIALS.length; si++) {
    tiles[si] = [];
    if (si === 5) { const c = mk(px); drawRainbow(c.getContext('2d'), px, theme.tiles); tiles[si][0] = c; continue; }
    for (let t = 0; t < theme.tiles.length; t++) {
      const c = mk(px), g = c.getContext('2d');
      drawBody(g, px, t, theme.tiles[t]);
      if (si) drawSpecial(g, px, SPECIALS[si], theme.tiles[t]);
      tiles[si][t] = c;
    }
  }
  const obstacles = {};
  for (const kind of OBSTACLE_KINDS) {
    const [fn, maxHp] = OBS_DRAW[kind];
    obstacles[kind] = [null];
    for (let hp = 1; hp <= maxHp; hp++) { const c = mk(px); fn(c.getContext('2d'), px, hp); obstacles[kind][hp] = c; }
  }
  const unknown = mk(px); drawUnknownObstacle(unknown.getContext('2d'), px);
  return { tiles, obstacles, unknown, px };
}

export function obstacleImg(atlas, kind, hp) {
  const arr = atlas.obstacles[kind];
  if (!arr) return atlas.unknown;
  return arr[Math.max(1, Math.min(arr.length - 1, hp | 0))];
}

// Мягкое пятно для фона.
export function buildBlob(color, px) {
  const c = mk(px), g = c.getContext('2d');
  const gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  gr.addColorStop(0, alpha(color, 0.9)); gr.addColorStop(1, alpha(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, px, px);
  return c;
}

// Иконка для UI в виде dataURL. kind: 'tile' | 'obstacle' | 'special'.
const iconCache = new Map();
export function makeIcon(theme, kind, key, hp = 1, px = 96) {
  const id = `${theme.name}|${kind}|${key}|${hp}`;
  let url = iconCache.get(id);
  if (url) return url;
  const c = mk(px), g = c.getContext('2d');
  if (kind === 'obstacle') {
    const arr = OBS_DRAW[key];
    if (arr) arr[0](g, px, Math.min(hp, arr[1])); else drawUnknownObstacle(g, px);
  } else if (kind === 'special' && key === 'rainbow') {
    drawRainbow(g, px, theme.tiles);
  } else {
    const t = (key | 0) % theme.tiles.length;
    drawBody(g, px, t, theme.tiles[t]);
    if (kind === 'special') drawSpecial(g, px, key, theme.tiles[t]);
  }
  url = c.toDataURL();
  iconCache.set(id, url);
  return url;
}
