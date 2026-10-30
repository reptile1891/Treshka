// Ввод мышью и касанием: свайп и тап-тап. Эмитит input:swap / input:booster.
export const sel = { on: false, r: 0, c: 0 };

export function initInput(game, api) {
  const canvas = game.canvas, bus = game.bus;
  const cell = { r: 0, c: 0 };
  let drag = null, wasSelected = false;

  const pos = (e) => {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!api.enabled()) return;
    const [x, y] = pos(e);
    if (!api.hit(x, y, cell)) { sel.on = false; return; }
    canvas.setPointerCapture?.(e.pointerId);
    const armed = api.armed();
    if (armed) {
      bus.emit('input:booster', { kind: armed, at: { r: cell.r, c: cell.c } });
      bus.emit('booster:armed', { kind: null });
      return;
    }
    if (sel.on && Math.abs(sel.r - cell.r) + Math.abs(sel.c - cell.c) === 1) {
      bus.emit('input:swap', { from: { r: sel.r, c: sel.c }, to: { r: cell.r, c: cell.c } });
      sel.on = false; drag = null; return;
    }
    wasSelected = sel.on && sel.r === cell.r && sel.c === cell.c;
    sel.on = true; sel.r = cell.r; sel.c = cell.c;
    drag = { r: cell.r, c: cell.c, x, y };
  });

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = pos(e);
    api.onMove(x, y);
    if (!drag) return;
    const dx = x - drag.x, dy = y - drag.y, th = api.cellSize() * 0.4;
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    const horiz = Math.abs(dx) > Math.abs(dy);
    const to = { r: drag.r + (horiz ? 0 : Math.sign(dy)), c: drag.c + (horiz ? Math.sign(dx) : 0) };
    if (to.r >= 0 && to.c >= 0 && to.r < api.rows() && to.c < api.cols()) {
      bus.emit('input:swap', { from: { r: drag.r, c: drag.c }, to });
    }
    sel.on = false; drag = null;
  });

  const end = () => {
    if (drag && wasSelected) sel.on = false; // повторный тап снимает выделение
    drag = null; wasSelected = false;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
