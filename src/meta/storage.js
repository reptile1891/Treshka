// Сохранение в localStorage: версия формата + миграции. Без localStorage работает в памяти.
export const VERSION = 1;
const KEY = 'treshka.meta';

export function defaultState(cfg) {
  return {
    v: VERSION,
    coins: cfg.economy.startCoins,
    boosters: { ...cfg.economy.startBoosters },
    stats: { totals: {}, bestStars: {} },
    daily: { last: null, streak: 0 },
    wheel: { day: null, used: 0 },
    quests: { day: null, list: [] },
    achievements: {}, // id -> { tier: сколько ступеней получено, unlocked: сколько открыто }
    events: {},       // 'id-год' -> { progress, claimed }
    purchases: {},
  };
}

// migrations[n] переводит формат n-1 -> n. Добавляя версию, поднимите VERSION и допишите шаг.
const migrations = {
  1: (s) => s, // v0 (без версии) -> v1: недостающие поля добираются из defaultState
};

function merge(base, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return base;
  const out = { ...base };
  for (const k of Object.keys(data)) {
    out[k] = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], data[k]) : data[k];
  }
  return out;
}

export function migrate(raw) {
  let s = raw;
  for (let v = s.v ?? 0; v < VERSION; v++) s = { ...migrations[v + 1](s), v: v + 1 };
  return s;
}

export function createStorage(cfg, backend = globalThis.localStorage) {
  let mem = null;
  const read = () => { try { return backend?.getItem(KEY) ?? mem; } catch { return mem; } };
  return {
    load() {
      const base = defaultState(cfg);
      const text = read();
      if (!text) return base;
      try { return merge(base, migrate(JSON.parse(text))); } catch { return base; } // битое сохранение -> с нуля
    },
    save(state) {
      const text = JSON.stringify(state);
      mem = text;
      try { backend?.setItem(KEY, text); } catch { /* квота/приватный режим: остаёмся в памяти */ }
    },
    clear() { mem = null; try { backend?.removeItem(KEY); } catch { /* ничего */ } },
  };
}
