// Реестры расширений: спецфишки, препятствия, бустеры, цели.
// Новая механика = новый файл с registerX(...) и строка в builtin/index.js.
export function createRegistry() {
  const specials = new Map();
  const obstacles = new Map();
  const boosters = new Map();
  const goals = new Map();
  let byPriority = null;
  const goalListeners = [];

  return {
    specials, obstacles, boosters, goals,

    registerSpecial(name, handler) {
      specials.set(name, { priority: 0, ...handler, name });
      byPriority = null;
    },
    registerObstacle(kind, handler) {
      obstacles.set(kind, { hp: 1, blocksTile: false, locksSwap: false, damageBy: [], ...handler, kind });
    },
    registerBooster(kind, handler) {
      boosters.set(kind, { needsTarget: false, ...handler, kind });
    },
    registerGoal(kind, handler) {
      goals.set(kind, { events: {}, ...handler, kind });
      for (const fn of goalListeners) fn(handler);
    },

    // Спецфишки с detect, от старшей к младшей.
    detectors() {
      byPriority ??= [...specials.values()].filter((s) => s.detect).sort((a, b) => b.priority - a.priority);
      return byPriority;
    },
    onGoalRegistered(fn) { goalListeners.push(fn); },
  };
}
