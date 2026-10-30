// Ежедневная награда с серией входов, колесо удачи и сезонные ивенты.
import { dayKey, daysBetween } from './economy.js';

export function createDaily({ state, save, cfg, economy, now, track }) {
  const len = cfg.rewards.length;
  // Серия «жива», если пропущено не больше graceDays дней
  const alive = (today) => state.daily.last && daysBetween(state.daily.last, today) <= 1 + cfg.graceDays;

  function status() {
    const today = dayKey(now());
    const streak = alive(today) ? state.daily.streak : 0;
    return {
      canClaim: state.daily.last !== today,
      streak,
      nextReward: cfg.rewards[streak % len],
      rewards: cfg.rewards,
    };
  }

  function claim() {
    const today = dayKey(now());
    if (state.daily.last === today) return { ok: false, error: 'already_claimed' };
    const streak = alive(today) ? state.daily.streak + 1 : 1;
    state.daily.last = today;
    state.daily.streak = streak;
    const reward = economy.grant(cfg.rewards[(streak - 1) % len], 'daily');
    save();
    track('dailyClaims', 1);
    return { ok: true, streak, reward };
  }

  return { status, claim };
}

export function createWheel({ state, save, cfg, economy, now, rng, track }) {
  const used = () => (state.wheel.day === dayKey(now()) ? state.wheel.used : 0);
  const left = () => Math.max(0, cfg.freeSpinsPerDay - used());

  function spin() {
    if (left() <= 0) return { ok: false, error: 'no_spins' };
    const total = cfg.prizes.reduce((s, p) => s + p.weight, 0);
    let roll = rng() * total;
    const prize = cfg.prizes.find((p) => (roll -= p.weight) < 0) ?? cfg.prizes[cfg.prizes.length - 1];
    state.wheel = { day: dayKey(now()), used: used() + 1 };
    const reward = economy.grant(prize.reward, 'wheel');
    save();
    track('wheelSpins', 1);
    return { ok: true, prizeId: prize.id, prizeIndex: cfg.prizes.indexOf(prize), reward };
  }

  return { spinsLeft: left, prizes: () => cfg.prizes.map(({ id, reward }) => ({ id, reward })), spin };
}

export function createSeasonal({ state, save, cfg, economy, now }) {
  const md = (d) => dayKey(d).slice(5);
  const inRange = (e, m) => (e.from <= e.to ? m >= e.from && m <= e.to : m >= e.from || m <= e.to);
  // Ключ ивента включает год старта, чтобы цель можно было получить в каждом сезоне
  function key(e, d) {
    const y = e.from > e.to && md(d) <= e.to ? d.getFullYear() - 1 : d.getFullYear();
    return `${e.id}-${y}`;
  }

  function active() {
    const d = now();
    return cfg.filter((e) => inRange(e, md(d))).map((e) => {
      const st = state.events[key(e, d)] ?? { progress: 0, claimed: false };
      return { id: e.id, title: e.title, to: e.to, coinMultiplier: e.coinMultiplier ?? 1, goal: { ...e.goal, progress: Math.min(st.progress, e.goal.target), claimed: st.claimed } };
    });
  }

  const multiplier = () => active().reduce((m, e) => Math.max(m, e.coinMultiplier), 1);

  function onStat(stat, n) {
    const d = now();
    for (const e of cfg) {
      if (!inRange(e, md(d)) || e.goal.stat !== stat) continue;
      const st = (state.events[key(e, d)] ??= { progress: 0, claimed: false });
      st.progress += n;
    }
    save();
  }

  function claim(id) {
    const e = cfg.find((x) => x.id === id);
    const d = now();
    if (!e || !inRange(e, md(d))) return { ok: false, error: 'not_active' };
    const st = state.events[key(e, d)];
    if (!st || st.progress < e.goal.target) return { ok: false, error: 'not_ready' };
    if (st.claimed) return { ok: false, error: 'already_claimed' };
    st.claimed = true;
    return { ok: true, reward: economy.grant(e.goal.reward, 'event') };
  }

  return { active, multiplier, onStat, claim };
}
