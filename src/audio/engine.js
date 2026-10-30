// Ядро звука: AudioContext, шины громкости, лимит голосов, настройки.
const STORE_KEY = 'treshka.audio';
const MAX_VOICES = 24;

const settings = { music: 0.5, sfx: 0.8, muted: false };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(STORE_KEY)) ?? {});
} catch { /* нет localStorage или битый JSON — берём умолчания */ }

let ctx = null;
let master, musicBus, sfxBus;
let voices = 0;
const unlockHooks = [];

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

function applyGains() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.03);
  musicBus.gain.setTargetAtTime(settings.music, t, 0.03);
  sfxBus.gain.setTargetAtTime(settings.sfx, t, 0.03);
}

function create() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor(); // защита от клиппинга при каскадах
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus.connect(master);
  sfxBus.connect(master);
  master.connect(comp).connect(ctx.destination);
  applyGains();
}

// Браузер разрешает звук только после жеста: создаём/возобновляем контекст на первом.
export function installUnlock() {
  const events = ['pointerdown', 'keydown', 'touchend'];
  const handler = () => {
    if (!ctx) create();
    if (!ctx) return;
    ctx.resume?.().then(() => {
      if (ctx.state !== 'running') return;
      events.forEach((e) => window.removeEventListener(e, handler, true));
      unlockHooks.splice(0).forEach((fn) => fn());
    });
  };
  events.forEach((e) => window.addEventListener(e, handler, true));
}

export const onUnlock = (fn) => (isRunning() ? fn() : unlockHooks.push(fn));
export const isRunning = () => !!ctx && ctx.state === 'running';
export const getCtx = () => ctx;
export const getBus = (kind) => (kind === 'music' ? musicBus : sfxBus);
export const getSettings = () => ({ ...settings });

export function setVolume(kind, v) {
  if (kind !== 'music' && kind !== 'sfx') return;
  settings[kind] = Math.min(1, Math.max(0, Number(v) || 0));
  applyGains();
  save();
}

export function mute(flag = true) {
  settings.muted = !!flag;
  applyGains();
  save();
}

// Резервирует голос; false — лимит исчерпан. release вызывать по окончании звука.
export function takeVoice() {
  if (voices >= MAX_VOICES) return false;
  voices++;
  return true;
}
export const freeVoice = () => { voices = Math.max(0, voices - 1); };
