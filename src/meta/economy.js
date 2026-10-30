// Монеты, инвентарь бустеров, выдача наград.
export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function daysBetween(a, b) {
  const t = (k) => Date.UTC(...k.split('-').map((x, i) => (i === 1 ? x - 1 : +x)));
  return Math.round((t(b) - t(a)) / 86400000);
}

export function createEconomy({ bus, state, save, cfg, maxLives }) {
  const cap = cfg.economy.coinCap;
  const int = (n) => Math.floor(Number(n));

  function addCoins(n) {
    n = int(n);
    const gain = Math.min(n, cap - state.coins);
    if (!(gain > 0)) return state.coins;
    state.coins += gain;
    save();
    bus.emit('coins:changed', { coins: state.coins, delta: gain });
    return state.coins;
  }

  function spend(n) {
    n = int(n);
    if (!(n > 0) || state.coins < n) return false;
    state.coins -= n;
    save();
    bus.emit('coins:changed', { coins: state.coins, delta: -n });
    return true;
  }

  function addBooster(kind, n = 1) {
    n = int(n);
    if (!(n > 0)) return;
    state.boosters[kind] = (state.boosters[kind] ?? 0) + n;
    save();
    bus.emit('inventory:changed', { kind, count: state.boosters[kind] });
  }

  function useBooster(kind) {
    if (!(state.boosters[kind] > 0)) return false;
    state.boosters[kind] -= 1;
    save();
    bus.emit('inventory:changed', { kind, count: state.boosters[kind] });
    return true;
  }

  // Выдаёт награду целиком и сообщает UI.
  function grant(reward, source) {
    const out = { source, coins: 0, boosters: {}, lives: 0 };
    if (reward.coins) { addCoins(reward.coins); out.coins = int(reward.coins); }
    for (const [kind, n] of Object.entries(reward.boosters ?? {})) { addBooster(kind, n); out.boosters[kind] = n; }
    if (reward.lives) {
      out.lives = reward.lives === 'fill' ? maxLives : int(reward.lives);
      bus.emit('lives:grant', { amount: out.lives });
    }
    bus.emit('reward:granted', out);
    return out;
  }

  // Награда за победу: считаем и выдаём. multiplier — сезонный бонус к монетам.
  function rewardLevelWin(levelId, { stars = 0, movesLeft = 0 }, multiplier = 1) {
    const r = cfg.levelRewards;
    const best = state.stats.bestStars[levelId];
    const first = best === undefined;
    const improved = first ? stars : Math.max(0, stars - best);
    if (first || stars > best) state.stats.bestStars[levelId] = stars;
    let coins = r.win + r.perStar * stars + (first ? r.firstClear : 0) + r.perStarImproved * (first ? 0 : improved);
    coins += Math.min(r.maxMoveBonus, r.perMoveLeft * Math.max(0, movesLeft));
    return { reward: grant({ coins: Math.round(coins * multiplier) }, 'level'), first, newStars: improved };
  }

  return { addCoins, spend, addBooster, useBooster, grant, rewardLevelWin, coins: () => state.coins, inventory: () => ({ ...state.boosters }) };
}
