// Виды целей. Goal = { kind, target, amount }. events: событие → новое значение current.
const countBoard = (ctx, pred) => ctx.all().filter((p) => pred(ctx.cell(p))).length;

export function register(api) {
  // Собрать N фишек цвета target.
  api.registerGoal('collect', {
    events: {
      'tiles:cleared': (goal, st, { cells }) => st.current + cells.filter((c) => c.type === goal.target).length,
    },
    hint: (goal, hints) => hints.types.add(goal.target),
  });

  // Разрушить N препятствий вида target (amount по умолчанию — все на доске).
  api.registerGoal('clear_obstacle', {
    defaultAmount: (goal, ctx) => countBoard(ctx, (c) => c.obstacle?.kind === goal.target),
    events: {
      'obstacle:damaged': (goal, st, { kind, hp }) => (hp === 0 && kind === goal.target ? st.current + 1 : undefined),
    },
    hint: (goal, hints) => hints.obstacleKinds.add(goal.target),
  });

  // Набрать счёт.
  api.registerGoal('score', {
    events: { 'score:changed': (goal, st, { score }) => score },
  });

  // Опустить N предметов вниз (target — имя предмета, без него любые).
  api.registerGoal('drop', {
    defaultAmount: (goal, ctx) => countBoard(ctx, (c) => c.tile?.item && (!goal.target || c.tile.item === goal.target)),
    events: {
      'item:dropped': (goal, st, { item }) => (!goal.target || goal.target === item ? st.current + 1 : undefined),
    },
  });
}
