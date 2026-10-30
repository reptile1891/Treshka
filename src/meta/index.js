// Модуль "meta": экономика, магазин, ежедневные награды, колесо, ивенты, задания, достижения.
// Контракт: см. CONTRACTS.md. Баланс — в config.js, сохранение — в storage.js.
import { META_CONFIG } from './config.js';
import { createStorage } from './storage.js';
import { createEconomy } from './economy.js';
import { createShop } from './shop.js';
import { createDaily, createWheel, createSeasonal } from './daily.js';
import { createQuests, createAchievements } from './quests.js';

export { NullPaymentProvider } from './shop.js';

// opts нужны только для подмены в проверках: { storage, now, rng, cfg }
export function init(game, opts = {}) {
  const { bus } = game;
  const cfg = opts.cfg ?? META_CONFIG;
  const storage = opts.storage ?? createStorage(cfg);
  const now = opts.now ?? (() => new Date());
  const rng = opts.rng ?? Math.random;
  const state = storage.load();
  const save = () => storage.save(state);
  const maxLives = game.config.maxLives;

  // Жизнями владеет levels; здесь только последнее известное значение, чтобы не продавать лишнее
  let currentLives = null;
  const lives = { full: () => currentLives !== null && currentLives >= maxLives };

  const economy = createEconomy({ bus, state, save, cfg, maxLives });
  const ctx = { bus, state, save, economy, now };

  // Единая точка учёта прогресса: max=true — рекорд, а не сумма
  function track(stat, n, max = false) {
    const t = state.stats.totals;
    t[stat] = max ? Math.max(t[stat] ?? 0, n) : (t[stat] ?? 0) + n;
    quests.onStat(stat, n, max);
    achievements.onStat(stat);
    seasonal.onStat(stat, max ? 0 : n);
  }

  const shop = createShop({ ...ctx, cfg: cfg.shop, lives });
  const daily = createDaily({ ...ctx, cfg: cfg.daily, track });
  const wheel = createWheel({ ...ctx, cfg: cfg.wheel, rng, track });
  const seasonal = createSeasonal({ ...ctx, cfg: cfg.seasonal });
  const quests = createQuests({ ...ctx, cfg: cfg.quests });
  const achievements = createAchievements({ ...ctx, cfg: cfg.achievements });

  // --- события игры ---
  let levelId = null;
  const onLevel = ({ level }) => { levelId = level?.id ?? levelId; };
  bus.on('level:load', onLevel);
  bus.on('level:start', onLevel);
  bus.on('lives:changed', ({ lives: n }) => { currentLives = n; });
  bus.on('tiles:cleared', ({ cells }) => track('tilesCleared', cells.length));
  bus.on('match:found', ({ chain }) => { if (chain > 0) track('bestChain', chain, true); });
  bus.on('special:created', () => track('specialsCreated', 1));
  bus.on('level:failed', () => track('levelsFailed', 1));
  bus.on('level:won', (res) => {
    const { newStars } = economy.rewardLevelWin(levelId, res, seasonal.multiplier());
    track('levelsWon', 1);
    if (newStars > 0) track('starsEarned', newStars); // повтор уровня звёзд не фармит
  });

  game.modules.meta = {
    // контракт
    addCoins: economy.addCoins,
    spend: economy.spend,
    inventory: economy.inventory,
    // экономика
    coins: economy.coins,
    addBooster: economy.addBooster,
    useBooster: (kind) => {
      const ok = economy.useBooster(kind);
      if (ok) track('boostersUsed', 1);
      return ok;
    },
    shop,       // catalog(), buy(id) -> Promise<{ok,error?}>, setPaymentProvider(p)
    daily,      // status(), claim()
    wheel,      // spinsLeft(), prizes(), spin()
    events: seasonal, // active(), claim(id)
    quests,     // list(), claim(id)
    achievements, // list(), claim(id)
    resetSave() { storage.clear(); }, // сотрёт сохранение; вступает в силу после перезагрузки
  };
}
