// Процедурная фоновая музыка: спокойные циклы с плавными переходами.
import { getCtx, getBus, isRunning, onUnlock } from './engine.js';

const hz = (semi) => 440 * 2 ** ((semi - 9) / 12); // 0 = C4
const MAJ = [0, 2, 4, 7, 9];
const MIN = [0, 3, 5, 7, 10];

// Треки: аккорды (корень в полутонах от C4, тип), темп, лад мелодии, плотность нот.
const TRACKS = {
  menu: {
    bpm: 72, scale: MAJ, density: 0.35, octave: 12,
    chords: [[0, 'M'], [-3, 'm'], [-7, 'M'], [-5, 'M']], // C Am F G
  },
  game: {
    bpm: 92, scale: MAJ, density: 0.5, octave: 12,
    chords: [[0, 'M'], [-7, 'M'], [-3, 'm'], [-5, 'M']], // C F Am G
  },
  win: {
    bpm: 100, scale: MAJ, density: 0.6, octave: 12,
    chords: [[0, 'M'], [-5, 'M'], [-7, 'M'], [0, 'M']],
  },
};
const TRIADS = { M: [0, 4, 7], m: [0, 3, 7] };

let current = null; // { name, gain, step, next, timer }
const STEPS_PER_BAR = 8; // восьмые

function note(out, { type, f, t, dur, vol, attack = 0.02 }) {
  const ctx = getCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.onended = () => g.disconnect();
  o.start(t);
  o.stop(t + dur + 0.05);
}

function playStep(tr, state, i, t, out) {
  const spb = 60 / tr.bpm / 2; // секунд на восьмую
  const bar = Math.floor(i / STEPS_PER_BAR);
  const s = i % STEPS_PER_BAR;
  const [root, kind] = tr.chords[bar % tr.chords.length];
  const triad = TRIADS[kind];
  if (s === 0) {
    // Пэд: аккорд на весь такт
    for (const n of triad) {
      note(out, { type: 'sine', f: hz(root + n), t, dur: spb * 8, vol: 0.05, attack: 0.4 });
    }
    note(out, { type: 'triangle', f: hz(root - 12), t, dur: spb * 4, vol: 0.09 }); // бас
  }
  if (s === 4) note(out, { type: 'triangle', f: hz(root - 12 + triad[2]), t, dur: spb * 3, vol: 0.05 });
  // Арпеджио/мелодия: редкие ноты, привязанные к аккорду и ладу
  if (s % 2 === 0 && state.rand() < tr.density) {
    const pool = state.rand() < 0.6 ? triad.map((n) => root + n) : tr.scale.map((n) => n);
    const n = pool[Math.floor(state.rand() * pool.length)] + tr.octave;
    note(out, { type: 'sine', f: hz(n), t, dur: spb * 3, vol: 0.06, attack: 0.01 });
  }
}

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tick(c) {
  const ctx = getCtx();
  const tr = TRACKS[c.name];
  const spb = 60 / tr.bpm / 2;
  while (c.next < ctx.currentTime + 0.4) {
    playStep(tr, c, c.step, c.next, c.gain);
    c.step++;
    c.next += spb;
  }
}

function fadeOut(c, sec) {
  const ctx = getCtx();
  clearInterval(c.timer);
  c.gain.gain.cancelScheduledValues(ctx.currentTime);
  c.gain.gain.setValueAtTime(c.gain.gain.value, ctx.currentTime);
  c.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + sec);
  setTimeout(() => c.gain.disconnect(), sec * 1000 + 800); // даём доиграть хвостам
}

let wanted = null;

// Включает трек с кроссфейдом. До разблокировки контекста запоминает желаемый.
export function playMusic(name, { fade = 1.5, loop = true } = {}) {
  if (!TRACKS[name]) return;
  wanted = name;
  onUnlock(() => {
    if (wanted !== name || current?.name === name) return;
    const ctx = getCtx();
    if (current) fadeOut(current, fade);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fade);
    gain.connect(getBus('music'));
    const c = { name, gain, step: 0, next: ctx.currentTime + 0.1, rand: rng(name.length * 7919) };
    c.timer = setInterval(() => tick(c), 100);
    current = c;
    tick(c);
  });
}

export function stopMusic(fade = 1) {
  wanted = null;
  if (current && isRunning()) fadeOut(current, fade);
  current = null;
}

export const currentTrack = () => current?.name ?? null;
