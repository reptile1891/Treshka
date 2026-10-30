// Прогресс игрока: звёзды по уровням и жизни с регенерацией. Хранение — localStorage с версией формата.
export const SAVE_KEY = 'treshka.progress';
export const SAVE_VERSION = 1;

export function freshState(cfg) {
  return { v: SAVE_VERSION, levels: {}, lives: cfg.maxLives, nextAt: null };
}

// Миграции по версиям: migrations[n] переводит формат n -> n+1.
const migrations = {};

export function migrate(raw, cfg) {
  if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.v) || raw.v > SAVE_VERSION) return freshState(cfg);
  let s = raw;
  while (s.v < SAVE_VERSION) s = migrations[s.v] ? migrations[s.v](s) : freshState(cfg);
  const lives = Number.isInteger(s.lives) ? Math.min(Math.max(s.lives, 0), cfg.maxLives) : cfg.maxLives;
  const levels = s.levels && typeof s.levels === 'object' ? s.levels : {};
  return { v: SAVE_VERSION, levels, lives, nextAt: Number.isFinite(s.nextAt) ? s.nextAt : null };
}

export function readState(storage, cfg) {
  try {
    const txt = storage.getItem(SAVE_KEY);
    return txt ? migrate(JSON.parse(txt), cfg) : freshState(cfg);
  } catch {
    return freshState(cfg);
  }
}

export function writeState(storage, state) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* квота/приватный режим — играем без сохранения */ }
}

// Начисляет жизни за прошедшее время. Возвращает true, если состояние изменилось.
export function regen(state, now, cfg) {
  const step = cfg.lifeRegenSeconds * 1000;
  const before = state.lives + '|' + state.nextAt;
  if (state.lives >= cfg.maxLives) {
    state.lives = cfg.maxLives;
    state.nextAt = null;
  } else {
    // нет таймера или часы переведены назад — таймер стартует заново
    if (state.nextAt == null || state.nextAt > now + step) state.nextAt = now + step;
    while (state.lives < cfg.maxLives && now >= state.nextAt) {
      state.lives++;
      state.nextAt += step;
    }
    if (state.lives >= cfg.maxLives) state.nextAt = null;
  }
  return before !== state.lives + '|' + state.nextAt;
}

export function spendLife(state, now, cfg) {
  if (state.lives <= 0) return false;
  if (state.lives >= cfg.maxLives) state.nextAt = now + cfg.lifeRegenSeconds * 1000;
  state.lives--;
  return true;
}

export function addLives(state, n, cfg) {
  state.lives = Math.min(cfg.maxLives, state.lives + n);
  if (state.lives >= cfg.maxLives) state.nextAt = null;
}

// Фиксирует результат уровня, хранит лучшие звёзды и счёт.
export function recordResult(state, id, stars, score) {
  const prev = state.levels[id] ?? { stars: 0, best: 0 };
  state.levels[id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score) };
}
