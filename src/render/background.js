// Анимированный фон с параллаксом: градиент + слои плавающих мягких пятен и искр.
import { buildBlob } from './art.js';

const N = 22;
const bx = new Float32Array(N), by = new Float32Array(N), bs = new Float32Array(N),
  bsp = new Float32Array(N), bph = new Float32Array(N), bl = new Float32Array(N), bc = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  bx[i] = Math.random(); by[i] = Math.random();
  bs[i] = 0.12 + Math.random() * 0.3; bsp[i] = 0.01 + Math.random() * 0.025;
  bph[i] = Math.random() * 6.28; bl[i] = Math.random(); bc[i] = i % 3;
}

let grad = null, blobs = [], W = 0, H = 0;
export const parallax = { x: 0, y: 0, tx: 0, ty: 0 }; // -0.5..0.5

export function resizeBg(theme, w, h, dpr) {
  W = w; H = h;
  grad = document.createElement('canvas');
  grad.width = Math.ceil(w * dpr); grad.height = Math.ceil(h * dpr);
  const g = grad.getContext('2d');
  const lg = g.createLinearGradient(0, 0, grad.width * 0.3, grad.height);
  lg.addColorStop(0, theme.bg[0]); lg.addColorStop(1, theme.bg[1]);
  g.fillStyle = lg; g.fillRect(0, 0, grad.width, grad.height);
  blobs = theme.blobs.map((c) => buildBlob(c, 128));
}

export function drawBg(g, t, dt) {
  parallax.x += (parallax.tx - parallax.x) * Math.min(1, dt * 4);
  parallax.y += (parallax.ty - parallax.y) * Math.min(1, dt * 4);
  g.globalAlpha = 1;
  g.drawImage(grad, 0, 0, W, H);
  const m = Math.min(W, H);
  for (let i = 0; i < N; i++) {
    const l = 0.3 + bl[i] * 0.7;
    const x = ((bx[i] + t * bsp[i] * 0.4 + 1) % 1) * (W + 200) - 100 - parallax.x * 90 * l;
    const y = ((by[i] - t * bsp[i] + 1) % 1) * (H + 200) - 100 - parallax.y * 90 * l + Math.sin(t * 0.6 + bph[i]) * 14;
    const r = bs[i] * m * (0.5 + l * 0.6);
    g.globalAlpha = 0.16 + 0.18 * l;
    g.drawImage(blobs[bc[i]], x - r, y - r, r * 2, r * 2);
  }
  // искорки
  g.fillStyle = '#fff';
  for (let i = 0; i < N; i++) {
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + bph[i] * 3);
    g.globalAlpha = 0.15 + 0.5 * tw * bl[i];
    const x = ((bph[i] * 7.3) % 1) * W - parallax.x * 40 * bl[i], y = ((bx[i] * 13.7) % 1) * H - parallax.y * 40 * bl[i];
    g.fillRect(x, y, 2 + bl[i] * 2, 2 + bl[i] * 2);
  }
  g.globalAlpha = 1;
}
