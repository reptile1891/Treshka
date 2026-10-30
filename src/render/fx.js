// Эффекты: частицы, всплывающие тексты, кольца, лучи, тряска. Всё в предвыделенных пулах.
const NP = 700, NT = 10, NR = 24, NB = 24;

const p = {
  x: new Float32Array(NP), y: new Float32Array(NP), vx: new Float32Array(NP), vy: new Float32Array(NP),
  life: new Float32Array(NP), max: new Float32Array(NP), size: new Float32Array(NP),
  ci: new Uint8Array(NP), kind: new Uint8Array(NP), // kind 0 круг, 1 искра (квадрат)
  head: 0,
};
// Палитра частиц: цвета фишек темы + белый + акцент (индексы выставляет setPalette).
let palette = ['#fff'];

const texts = [];
for (let i = 0; i < NT; i++) texts.push({ s: '', x: 0, y: 0, t: 1, dur: 1, size: 1, color: '#fff', big: false });
let textHead = 0;

const rings = [];
for (let i = 0; i < NR; i++) rings.push({ x: 0, y: 0, t: 1, dur: 1, r: 0, ci: 0 });
let ringHead = 0;

const beams = [];
for (let i = 0; i < NB; i++) beams.push({ x1: 0, y1: 0, x2: 0, y2: 0, t: 1, dur: 1, w: 0, ci: 0 });
let beamHead = 0;

export const shake = { amp: 0, x: 0, y: 0 };

export function setPalette(colors) { palette = colors; }

export function burst(x, y, ci, n, speed, size) {
  for (let k = 0; k < n; k++) {
    const i = p.head; p.head = (p.head + 1) % NP;
    const a = Math.random() * 6.2832, v = speed * (0.35 + Math.random() * 0.8);
    p.x[i] = x; p.y[i] = y; p.vx[i] = Math.cos(a) * v; p.vy[i] = Math.sin(a) * v - speed * 0.25;
    p.max[i] = p.life[i] = 0.45 + Math.random() * 0.45;
    p.size[i] = size * (0.5 + Math.random() * 0.7);
    p.ci[i] = ci; p.kind[i] = Math.random() < 0.4 ? 1 : 0;
  }
}

export function floatText(s, x, y, color, size, dur = 1.1, big = false) {
  const t = texts[textHead]; textHead = (textHead + 1) % NT;
  t.s = s; t.x = x; t.y = y; t.t = 0; t.dur = dur; t.size = size; t.color = color; t.big = big;
}

export function ring(x, y, r, ci, dur = 0.5) {
  const o = rings[ringHead]; ringHead = (ringHead + 1) % NR;
  o.x = x; o.y = y; o.r = r; o.ci = ci; o.t = 0; o.dur = dur;
}

export function beam(x1, y1, x2, y2, w, ci, dur = 0.35) {
  const o = beams[beamHead]; beamHead = (beamHead + 1) % NB;
  o.x1 = x1; o.y1 = y1; o.x2 = x2; o.y2 = y2; o.w = w; o.ci = ci; o.t = 0; o.dur = dur;
}

export function addShake(a) { if (a > shake.amp) shake.amp = a; }

export function updateFx(dt) {
  for (let i = 0; i < NP; i++) {
    if (p.life[i] <= 0) continue;
    p.life[i] -= dt;
    p.vy[i] += 900 * dt;
    p.vx[i] *= 1 - 1.5 * dt;
    p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt;
  }
  for (let i = 0; i < NT; i++) if (texts[i].t < 1) texts[i].t += dt / texts[i].dur;
  for (let i = 0; i < NR; i++) if (rings[i].t < 1) rings[i].t += dt / rings[i].dur;
  for (let i = 0; i < NB; i++) if (beams[i].t < 1) beams[i].t += dt / beams[i].dur;
  if (shake.amp > 0.2) {
    shake.amp *= Math.exp(-dt * 9);
    shake.x = (Math.random() * 2 - 1) * shake.amp; shake.y = (Math.random() * 2 - 1) * shake.amp;
  } else { shake.amp = 0; shake.x = shake.y = 0; }
}

export function drawFx(g, font) {
  for (let i = 0; i < NB; i++) {
    const b = beams[i]; if (b.t >= 1) continue;
    const k = 1 - b.t;
    g.globalAlpha = k; g.lineCap = 'round';
    g.strokeStyle = '#fff'; g.lineWidth = b.w * k * 0.5;
    g.beginPath(); g.moveTo(b.x1, b.y1); g.lineTo(b.x2, b.y2); g.stroke();
    g.strokeStyle = palette[b.ci]; g.globalAlpha = k * 0.55; g.lineWidth = b.w * k * 1.4;
    g.stroke();
  }
  for (let i = 0; i < NR; i++) {
    const o = rings[i]; if (o.t >= 1) continue;
    const e = 1 - (1 - o.t) * (1 - o.t);
    g.globalAlpha = 1 - o.t; g.strokeStyle = palette[o.ci]; g.lineWidth = 3 + 10 * (1 - o.t);
    g.beginPath(); g.arc(o.x, o.y, o.r * e, 0, 6.2832); g.stroke();
  }
  for (let i = 0; i < NP; i++) {
    const l = p.life[i]; if (l <= 0) continue;
    g.globalAlpha = Math.min(1, (l / p.max[i]) * 1.4);
    g.fillStyle = palette[p.ci[i]];
    const s = p.size[i] * (0.4 + 0.6 * (l / p.max[i]));
    if (p.kind[i]) g.fillRect(p.x[i] - s, p.y[i] - s, s * 2, s * 2);
    else { g.beginPath(); g.arc(p.x[i], p.y[i], s, 0, 6.2832); g.fill(); }
  }
  g.globalAlpha = 1;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (let i = 0; i < NT; i++) {
    const t = texts[i]; if (t.t >= 1) continue;
    const pop = t.t < 0.15 ? 0.5 + (t.t / 0.15) * 0.7 : t.t < 0.25 ? 1.2 - (t.t - 0.15) * 2 : 1;
    const y = t.y - (t.big ? 30 : 70) * t.t;
    g.globalAlpha = t.t > 0.7 ? (1 - t.t) / 0.3 : 1;
    g.font = font; g.save(); g.translate(t.x, y); g.scale(pop * t.size, pop * t.size);
    g.lineWidth = 8; g.strokeStyle = 'rgba(40,10,70,0.85)'; g.strokeText(t.s, 0, 0);
    g.fillStyle = t.color; g.fillText(t.s, 0, 0); g.restore();
  }
  g.globalAlpha = 1;
}
