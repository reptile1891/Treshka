// Цели уровня. Виды целей — реестр (builtin/goals/*), здесь только учёт и события.
export function attachGoals(ctx) {
  const { bus, reg, state } = ctx;
  const wired = new Set();

  // Подписываемся на событие один раз, раздаём всем целям, которые его слушают.
  function wire(handler) {
    for (const event of Object.keys(handler.events ?? {})) {
      if (wired.has(event)) continue;
      wired.add(event);
      bus.on(event, (payload) => dispatch(event, payload));
    }
  }

  function setCurrent(g, i, value) {
    const cur = Math.min(g.amount, Math.max(g.current, value));
    if (cur === g.current) return false;
    g.current = cur;
    g.done = cur >= g.amount;
    bus.emit('goal:progress', { goal: g.goal, current: cur, index: i, done: g.done });
    return true;
  }

  function dispatch(event, payload) {
    let changed = false;
    state.goals.forEach((g, i) => {
      const fn = reg.goals.get(g.goal.kind)?.events?.[event];
      const next = fn?.(g.goal, g, payload, ctx);
      if (next !== undefined && setCurrent(g, i, next)) changed = true;
    });
    if (changed && !state.completed && state.goals.every((g) => g.done)) {
      state.completed = true;
      bus.emit('goals:complete');
    }
  }

  reg.onGoalRegistered(wire);
  ctx.wireGoals = () => reg.goals.forEach(wire);

  ctx.goalHints = () => {
    const hints = { types: new Set(), obstacleKinds: new Set() };
    for (const g of state.goals) if (!g.done) reg.goals.get(g.goal.kind)?.hint?.(g.goal, hints);
    return hints;
  };

  ctx.startGoals = (level) => {
    state.completed = false;
    state.goals = (level.goals ?? []).map((goal) => {
      const h = reg.goals.get(goal.kind);
      return { goal, amount: goal.amount ?? h?.defaultAmount?.(goal, ctx) ?? 1, current: 0, done: false };
    });
    state.goals.forEach((g, i) => {
      const init = reg.goals.get(g.goal.kind)?.init?.(g.goal, ctx) ?? 0;
      g.current = -1; // чтобы первый setCurrent отправил начальный прогресс
      setCurrent(g, i, init);
    });
  };
}
