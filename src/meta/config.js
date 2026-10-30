// Весь баланс меты в одном месте: цены, награды, расписания.
// Награда = { coins?, boosters?: {kind: n}, lives?: n | 'fill' }.

export const BOOSTERS = {
  hammer: { title: 'Молоток' },
  shuffle: { title: 'Перемешать' },
  bomb: { title: 'Бомба' },
  extra_moves: { title: '+5 ходов' },
};

export const META_CONFIG = {
  economy: {
    startCoins: 50,
    startBoosters: { hammer: 1, shuffle: 1 },
    coinCap: 999999,
  },

  // Награда за победу на уровне
  levelRewards: {
    win: 10,
    perStar: 5,
    firstClear: 15,
    perStarImproved: 10, // за каждую звезду сверх прошлого рекорда
    perMoveLeft: 1,
    maxMoveBonus: 10,
  },

  // Магазин. price.coins — внутриигровая валюта, price.real — реальные деньги (через PaymentProvider).
  shop: {
    items: [
      { id: 'pack_hammer3', kind: 'boosters', title: '3 молотка', give: { boosters: { hammer: 3 } }, price: { coins: 60 } },
      { id: 'pack_shuffle3', kind: 'boosters', title: '3 перемешивания', give: { boosters: { shuffle: 3 } }, price: { coins: 50 } },
      { id: 'pack_bomb2', kind: 'boosters', title: '2 бомбы', give: { boosters: { bomb: 2 } }, price: { coins: 80 } },
      { id: 'pack_moves3', kind: 'boosters', title: '3 × +5 ходов', give: { boosters: { extra_moves: 3 } }, price: { coins: 90 } },
      { id: 'pack_mix', kind: 'boosters', title: 'Набор бустеров', give: { boosters: { hammer: 2, shuffle: 2, bomb: 1, extra_moves: 1 } }, price: { coins: 160 } },
      { id: 'life_1', kind: 'life', title: '1 жизнь', give: { lives: 1 }, price: { coins: 30 } },
      { id: 'life_full', kind: 'life', title: 'Все жизни', give: { lives: 'fill' }, price: { coins: 100 } },
      { id: 'coins_500', kind: 'coins', title: '500 монет', give: { coins: 500 }, price: { real: { amount: 0.99, currency: 'USD' } } },
      { id: 'coins_1500', kind: 'coins', title: '1500 монет', give: { coins: 1500 }, price: { real: { amount: 2.99, currency: 'USD' } } },
      { id: 'coins_4000', kind: 'coins', title: '4000 монет', give: { coins: 4000 }, price: { real: { amount: 6.99, currency: 'USD' } } },
    ],
  },

  // Ежедневная награда: цикл по дням серии, потом повтор
  daily: {
    graceDays: 1, // сколько пропущенных дней серия переживает
    rewards: [
      { coins: 20 },
      { coins: 30 },
      { boosters: { hammer: 1 } },
      { coins: 40 },
      { coins: 50 },
      { boosters: { shuffle: 1 } },
      { coins: 100, boosters: { bomb: 1 } },
    ],
  },

  // Колесо удачи: одно бесплатное вращение в день, покупать вращения нельзя
  wheel: {
    freeSpinsPerDay: 1,
    prizes: [
      { id: 'c10', weight: 30, reward: { coins: 10 } },
      { id: 'c25', weight: 25, reward: { coins: 25 } },
      { id: 'c50', weight: 12, reward: { coins: 50 } },
      { id: 'c150', weight: 3, reward: { coins: 150 } },
      { id: 'hammer', weight: 10, reward: { boosters: { hammer: 1 } } },
      { id: 'shuffle', weight: 10, reward: { boosters: { shuffle: 1 } } },
      { id: 'bomb', weight: 6, reward: { boosters: { bomb: 1 } } },
      { id: 'life', weight: 4, reward: { lives: 1 } },
    ],
  },

  // Сезонные ивенты. Даты 'ММ-ДД' включительно, повторяются каждый год; from > to — переход через Новый год.
  // coinMultiplier — множитель монет за уровни; goal — общая цель ивента (stat считается только во время ивента).
  seasonal: [
    { id: 'winter', title: 'Зимний фестиваль', from: '12-15', to: '01-10', coinMultiplier: 1.5, goal: { stat: 'levelsWon', target: 15, reward: { coins: 150, boosters: { bomb: 2 } } } },
    { id: 'spring', title: 'Весенний цветень', from: '03-01', to: '03-14', coinMultiplier: 1.25, goal: { stat: 'tilesCleared', target: 500, reward: { coins: 100, boosters: { hammer: 2 } } } },
    { id: 'summer', title: 'Жаркое лето', from: '07-01', to: '07-31', coinMultiplier: 1.25, goal: { stat: 'levelsWon', target: 20, reward: { coins: 120, boosters: { shuffle: 3 } } } },
    { id: 'halloween', title: 'Ночь тыкв', from: '10-25', to: '11-02', coinMultiplier: 1.5, goal: { stat: 'levelsWon', target: 10, reward: { coins: 100, boosters: { extra_moves: 2 } } } },
  ],

  // Задания дня: каждый день берётся `perDay` штук из пула
  quests: {
    perDay: 3,
    pool: [
      { id: 'win3', title: 'Выиграть 3 уровня', stat: 'levelsWon', target: 3, reward: { coins: 30 } },
      { id: 'win5', title: 'Выиграть 5 уровней', stat: 'levelsWon', target: 5, reward: { coins: 50 } },
      { id: 'tiles100', title: 'Убрать 100 фишек', stat: 'tilesCleared', target: 100, reward: { coins: 25 } },
      { id: 'tiles300', title: 'Убрать 300 фишек', stat: 'tilesCleared', target: 300, reward: { coins: 45 } },
      { id: 'stars6', title: 'Собрать 6 звёзд', stat: 'starsEarned', target: 6, reward: { coins: 40 } },
      { id: 'specials3', title: 'Создать 3 спецфишки', stat: 'specialsCreated', target: 3, reward: { boosters: { hammer: 1 } } },
      { id: 'chain3', title: 'Сделать цепочку из 3 каскадов', stat: 'bestChain', target: 3, max: true, reward: { coins: 35 } },
    ],
  },

  // Достижения: stat берётся из общей статистики, tiers — пороги
  achievements: [
    { id: 'winner', title: 'Победитель', stat: 'levelsWon', tiers: [{ target: 10, reward: { coins: 50 } }, { target: 50, reward: { coins: 150 } }, { target: 200, reward: { coins: 400 } }] },
    { id: 'cleaner', title: 'Уборщик', stat: 'tilesCleared', tiers: [{ target: 500, reward: { coins: 50 } }, { target: 5000, reward: { coins: 200 } }] },
    { id: 'stargazer', title: 'Звездочёт', stat: 'starsEarned', tiers: [{ target: 30, reward: { coins: 60 } }, { target: 150, reward: { coins: 250 } }] },
    { id: 'maker', title: 'Мастер спецфишек', stat: 'specialsCreated', tiers: [{ target: 25, reward: { boosters: { bomb: 1 } } }, { target: 150, reward: { boosters: { bomb: 3 } } }] },
    { id: 'combo', title: 'Каскадёр', stat: 'bestChain', max: true, tiers: [{ target: 4, reward: { coins: 40 } }, { target: 7, reward: { coins: 120 } }] },
    { id: 'regular', title: 'Постоянный игрок', stat: 'dailyClaims', tiers: [{ target: 7, reward: { coins: 70 } }, { target: 30, reward: { coins: 250 } }] },
  ],
};
