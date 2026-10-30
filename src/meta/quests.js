// Задания дня и достижения. Прогресс приходит из index.js через onStat(stat, n).
import { dayKey } from './economy.js';

function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function createQuests({ bus, state, save, cfg, economy, now }) {
  const def = (id) => cfg.pool.find((q) => q.id === id);

  // Набор на день детерминирован датой: перезапуск игры его не меняет
  function ensure() {
    const day = dayKey(now());
    if (state.quests.day === day) return;
    const pool = [...cfg.pool];
    let seed = hash(day);
    const list = [];
    while (list.length < cfg.perDay && pool.length) {
      seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
      list.push({ id: pool.splice(seed % pool.length, 1)[0].id, progress: 0, claimed: false });
    }
    state.quests = { day, list };
    save();
  }

  function list() {
    ensure();
    return state.quests.list.map((q) => {
      const d = def(q.id);
      return { id: q.id, title: d.title, target: d.target, progress: Math.min(q.progress, d.target), done: q.progress >= d.target, claimed: q.claimed, reward: d.reward };
    });
  }

  function onStat(stat, n, max) {
    ensure();
    for (const q of state.quests.list) {
      const d = def(q.id);
      if (d.stat !== stat || q.claimed) continue;
      const before = q.progress >= d.target;
      q.progress = max ? Math.max(q.progress, n) : q.progress + n;
      if (!before && q.progress >= d.target) bus.emit('quest:completed', { id: q.id });
    }
    save();
  }

  function claim(id) {
    ensure();
    const q = state.quests.list.find((x) => x.id === id);
    const d = q && def(id);
    if (!q) return { ok: false, error: 'unknown_quest' };
    if (q.progress < d.target) return { ok: false, error: 'not_done' };
    if (q.claimed) return { ok: false, error: 'already_claimed' };
    q.claimed = true;
    return { ok: true, reward: economy.grant(d.reward, 'quest') };
  }

  return { list, onStat, claim };
}

export function createAchievements({ bus, state, save, cfg, economy }) {
  const rec = (id) => (state.achievements[id] ??= { unlocked: 0, claimed: 0 });
  const value = (a) => state.stats.totals[a.stat] ?? 0;

  function list() {
    return cfg.map((a) => {
      const r = rec(a.id);
      const next = a.tiers[r.claimed];
      return {
        id: a.id, title: a.title, value: value(a), tiers: a.tiers.length,
        unlocked: r.unlocked, claimed: r.claimed,
        next: next ? { target: next.target, reward: next.reward, ready: r.unlocked > r.claimed } : null,
      };
    });
  }

  function onStat(stat) {
    for (const a of cfg) {
      if (a.stat !== stat) continue;
      const r = rec(a.id);
      while (r.unlocked < a.tiers.length && value(a) >= a.tiers[r.unlocked].target) {
        r.unlocked++;
        bus.emit('achievement:unlocked', { id: a.id });
      }
    }
    save();
  }

  function claim(id) {
    const a = cfg.find((x) => x.id === id);
    if (!a) return { ok: false, error: 'unknown_achievement' };
    const r = rec(id);
    if (r.claimed >= r.unlocked) return { ok: false, error: 'not_ready' };
    const reward = economy.grant(a.tiers[r.claimed].reward, 'achievement');
    r.claimed++;
    save();
    return { ok: true, reward };
  }

  return { list, onStat, claim };
}
