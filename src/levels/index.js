// Модуль "levels": загрузка уровней, прогрессия, жизни. Контракт: см. CONTRACTS.md
import { validateLevel, buildBoard, starsForScore } from './format.js';
import { readState, writeState, regen, spendLife, addLives, recordResult } from './progress.js';

const INDEX_URL = new URL('../../data/levels/index.json', import.meta.url);

function pickStorage() {
  try {
    const s = window.localStorage;
    s.getItem('treshka.probe');
    return s;
  } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  }
}

export function init(game) {
  const cfg = game.config;
  const storage = pickStorage();
  const state = readState(storage, cfg);
  const defs = new Map();
  let entries = [];
  let currentId = null;
  let timer = null;

  const save = () => writeState(storage, state);
  const emitLives = () => game.bus.emit('lives:changed', { lives: state.lives, nextAt: state.nextAt });

  // Таймер до следующей жизни; setTimeout ограничен ~24 сутками, нам хватает с запасом.
  function schedule() {
    clearTimeout(timer);
    if (state.nextAt == null) return;
    timer = setTimeout(tick, Math.max(0, state.nextAt - Date.now()) + 50);
  }
  function tick() {
    if (regen(state, Date.now(), cfg)) { save(); emitLives(); }
    schedule();
  }

  const isUnlocked = (i) => i === 0 || (state.levels[entries[i - 1].id]?.stars ?? 0) >= 1;

  function list() {
    return entries.map((e, i) => ({
      id: e.id, name: e.name, node: e.node,
      stars: state.levels[e.id]?.stars ?? 0,
      best: state.levels[e.id]?.best ?? 0,
      unlocked: isUnlocked(i),
    }));
  }

  function progress() {
    regen(state, Date.now(), cfg);
    const next = entries.find((e, i) => isUnlocked(i) && !(state.levels[e.id]?.stars > 0));
    return {
      lives: state.lives, maxLives: cfg.maxLives, nextAt: state.nextAt,
      stars: Object.values(state.levels).reduce((a, l) => a + l.stars, 0),
      completed: entries.filter((e) => state.levels[e.id]?.stars > 0).length,
      total: entries.length,
      nextId: next ? next.id : null, // null — все пройдены
    };
  }

  async function loadLevel(id, { force = false } = {}) {
    await api.ready;
    const i = entries.findIndex((e) => e.id === id);
    if (i < 0) return null;
    if (!force && (!isUnlocked(i) || progress().lives < 1)) return null;
    if (!defs.has(id)) {
      try {
        const res = await fetch(new URL(entries[i].file, INDEX_URL));
        const def = await res.json();
        const { ok, errors } = validateLevel(def);
        if (!ok || def.id !== id) throw new Error(errors.join('; ') || 'id не совпадает с индексом');
        defs.set(id, def);
      } catch (e) {
        console.error(`[levels] уровень ${id} не загружен:`, e);
        return null;
      }
    }
    currentId = id;
    const level = structuredClone(defs.get(id));
    game.bus.emit('level:load', { level });
    return level;
  }

  game.bus.on('level:won', ({ score, stars }) => {
    if (currentId == null) return;
    const def = defs.get(currentId);
    recordResult(state, currentId, Math.max(1, stars ?? starsForScore(def, score)), score);
    save();
  });

  game.bus.on('level:failed', () => {
    if (currentId == null) return;
    if (spendLife(state, Date.now(), cfg)) { save(); emitLives(); schedule(); }
  });

  const api = {
    loadLevel, list, progress, buildBoard,
    addLife(n = 1) { addLives(state, n, cfg); save(); emitLives(); schedule(); },
    ready: fetch(INDEX_URL).then((r) => r.json()).then((idx) => { entries = idx.levels; }).catch((e) => {
      console.error('[levels] нет индекса уровней:', e);
    }),
  };
  game.modules.levels = api;

  game.bus.on('game:ready', () => {
    if (regen(state, Date.now(), cfg)) save();
    emitLives();
    schedule();
  });
}
