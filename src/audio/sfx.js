// Синтез эффектов. Каждый эффект — функция (p) => void, p = { ctx, t, out, v, chain }.
import { getCtx, getBus, isRunning, takeVoice, freeVoice } from './engine.js';

let noiseBuf = null;
function noise(ctx) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

// Один голос: осциллятор с огибающей и (опц.) скольжением высоты.
function tone(p, { type = 'sine', f, f2, at = 0, dur = 0.15, vol = 0.3, attack = 0.005 }) {
  if (!takeVoice()) return;
  const { ctx, out } = p;
  const t = p.t + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const a = vol * p.v;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(a, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.onended = () => { freeVoice(); g.disconnect(); };
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Шумовой всплеск через фильтр (взрывы, хруст льда, шорох).
function burst(p, { at = 0, dur = 0.3, vol = 0.3, ftype = 'lowpass', f = 1200, f2, q = 1 }) {
  if (!takeVoice()) return;
  const { ctx, out } = p;
  const t = p.t + at;
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  const fl = ctx.createBiquadFilter();
  fl.type = ftype;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * p.v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(out);
  s.onended = () => { freeVoice(); g.disconnect(); };
  s.start(t);
  s.stop(t + dur + 0.02);
}

const hz = (semi) => 440 * 2 ** ((semi - 9) / 12); // 0 = C4
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const arp = (p, notes, step, o = {}) =>
  notes.forEach((n, i) => tone(p, { f: hz(n), at: i * step, ...o }));

export const SFX = {
  select: (p) => tone(p, { type: 'triangle', f: 660, f2: 880, dur: 0.09, vol: 0.25 }),
  swap: (p) => {
    tone(p, { type: 'sine', f: 330, f2: 520, dur: 0.12, vol: 0.25 });
    burst(p, { ftype: 'bandpass', f: 1500, dur: 0.08, vol: 0.06 });
  },
  invalid: (p) => {
    tone(p, { type: 'square', f: 200, f2: 150, dur: 0.12, vol: 0.14 });
    tone(p, { type: 'square', f: 180, f2: 130, at: 0.13, dur: 0.16, vol: 0.14 });
  },
  // Высота растёт с каскадом: каждый шаг цепочки — на ступень пентатоники выше.
  match: (p) => {
    const base = PENTA[Math.min(Math.max(p.chain - 1, 0), PENTA.length - 1)];
    arp(p, [base, base + 4, base + 7], 0.05, { type: 'triangle', dur: 0.2, vol: 0.22 });
  },
  clear: (p) => {
    const n = PENTA[Math.min(Math.max(p.chain - 1, 0), PENTA.length - 1)] + 12;
    tone(p, { type: 'sine', f: hz(n), dur: 0.12, vol: 0.12 });
    burst(p, { ftype: 'highpass', f: 4000, dur: 0.06, vol: 0.05 });
  },
  special_create: (p) => {
    arp(p, [7, 12, 16, 19, 24], 0.045, { type: 'sine', dur: 0.25, vol: 0.2 });
    tone(p, { type: 'sawtooth', f: 300, f2: 1200, dur: 0.3, vol: 0.06 });
  },
  line: (p) => {
    burst(p, { ftype: 'bandpass', f: 400, f2: 5000, dur: 0.35, vol: 0.28, q: 2 });
    tone(p, { type: 'sawtooth', f: 200, f2: 900, dur: 0.3, vol: 0.1 });
  },
  bomb: (p) => {
    burst(p, { f: 2500, f2: 80, dur: 0.6, vol: 0.5 });
    tone(p, { type: 'sine', f: 120, f2: 35, dur: 0.5, vol: 0.5 });
  },
  rainbow: (p) => {
    arp(p, [0, 4, 7, 12, 16, 19, 24, 28], 0.04, { type: 'sine', dur: 0.3, vol: 0.18 });
    burst(p, { ftype: 'highpass', f: 3000, dur: 0.5, vol: 0.08 });
  },
  plane: (p) => {
    tone(p, { type: 'sawtooth', f: 180, f2: 700, dur: 0.5, vol: 0.1 });
    burst(p, { ftype: 'bandpass', f: 800, f2: 2500, dur: 0.5, vol: 0.12, q: 3 });
  },
  ice: (p) => {
    burst(p, { ftype: 'highpass', f: 5000, dur: 0.12, vol: 0.25 });
    tone(p, { type: 'sine', f: 2400, f2: 1600, dur: 0.1, vol: 0.1 });
  },
  chain: (p) => {
    for (let i = 0; i < 3; i++) {
      tone(p, { type: 'square', f: 1800 + i * 300, f2: 900, at: i * 0.04, dur: 0.06, vol: 0.08 });
    }
    burst(p, { ftype: 'bandpass', f: 3000, dur: 0.15, vol: 0.12, q: 4 });
  },
  crate: (p) => {
    burst(p, { f: 900, f2: 200, dur: 0.18, vol: 0.4 });
    tone(p, { type: 'triangle', f: 160, f2: 70, dur: 0.15, vol: 0.3 });
  },
  slime: (p) => tone(p, { type: 'sine', f: 300, f2: 120, dur: 0.2, vol: 0.25 }),
  booster: (p) => {
    tone(p, { type: 'sawtooth', f: 150, f2: 900, dur: 0.35, vol: 0.12 });
    arp(p, [12, 19, 24], 0.07, { type: 'sine', at: 0.2, dur: 0.25, vol: 0.2 });
  },
  coin: (p) => {
    tone(p, { type: 'square', f: 988, dur: 0.07, vol: 0.12 });
    tone(p, { type: 'square', f: 1319, at: 0.07, dur: 0.25, vol: 0.12 });
  },
  shuffle: (p) => burst(p, { ftype: 'bandpass', f: 600, f2: 3000, dur: 0.4, vol: 0.2, q: 1.5 }),
  fall: (p) => tone(p, { type: 'sine', f: 240, f2: 180, dur: 0.05, vol: 0.1 }),
  win: (p) => arp(p, [0, 4, 7, 12, 16, 19, 24], 0.1, { type: 'triangle', dur: 0.5, vol: 0.25 }),
  fail: (p) => arp(p, [7, 5, 2, -5], 0.2, { type: 'triangle', dur: 0.5, vol: 0.22 }),
  click: (p) => tone(p, { type: 'triangle', f: 700, f2: 500, dur: 0.05, vol: 0.2 }),
  star: (p) => arp(p, [12, 16, 19], 0.06, { type: 'sine', dur: 0.4, vol: 0.2 }),
};

const lastPlayed = new Map();

// Играет эффект. Игнорирует неизвестные имена и частые повторы (<30 мс).
export function playSfx(name, { volume = 1, chain = 1 } = {}) {
  const fn = SFX[name];
  const ctx = getCtx();
  if (!fn || !isRunning()) return;
  const now = ctx.currentTime;
  if (now - (lastPlayed.get(name) ?? -1) < 0.03) return;
  lastPlayed.set(name, now);
  fn({ ctx, t: now + 0.005, out: getBus('sfx'), v: Math.min(1, Math.max(0, volume)), chain });
}
