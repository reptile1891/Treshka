// Модуль "ui". Контракт: см. CONTRACTS.md
// DOM-оверлей поверх канваса: меню, карта, HUD, бустеры, пауза, победа/поражение.
import { h } from './dom.js';
import { createHud } from './hud.js';
import { createScreens } from './screens.js';

// Какие слои видны на каждом экране.
const LAYERS = {
  menu: ['menu'], map: ['map'], game: ['game'],
  pause: ['game', 'pause'], win: ['game', 'win'], lose: ['game', 'lose'],
};
const RESULT_DELAY = 500; // мс после того, как render закончил анимации последнего хода
const RESULT_MAX_WAIT = 8000;

export function init(game) {
  const { bus } = game;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = new URL('./style.css', import.meta.url).href;
  document.head.append(link);

  const root = h('div'); root.id = 'ui';
  document.body.append(root);

  const ui = { current: null };
  const hud = createHud(game, ui);
  const screens = createScreens(game, ui);
  const gameEl = h('section', 'screen game', hud.hud, hud.boostBar, hud.toast);
  const layers = { menu: screens.menu, map: screens.map, game: gameEl, pause: screens.pause, win: screens.win, lose: screens.lose };
  for (const [k, el] of Object.entries(layers)) { if (k !== 'game') el.classList.add(k === 'menu' || k === 'map' ? k : 'modal'); root.append(el); }
  root.prepend(gameEl);
  screens.menu.classList.add('menu'); screens.map.classList.add('map');

  let resultTimer = 0;

  ui.showScreen = (name) => {
    if (!LAYERS[name]) return;
    const prev = ui.current;
    clearTimeout(resultTimer);
    for (const [k, el] of Object.entries(layers)) el.classList.toggle('on', LAYERS[name].includes(k));
    ui.current = name;
    screens.onShow(name);
    if (name === 'game') hud.refreshInventory();
    bus.emit('ui:screen', { name });
    if (name === 'pause' || prev === 'pause') bus.emit('game:pause', { paused: name === 'pause' });
  };

  const levelId = () => hud.level?.id;
  ui.restart = () => { const id = levelId(); if (id != null) game.modules.levels?.loadLevel?.(id); };
  ui.nextLevel = () => {
    const id = levelId();
    if (id == null) { ui.showScreen('map'); return; }
    game.modules.levels?.loadLevel?.(typeof id === 'number' ? id + 1 : id);
  };

  bus.on('level:load', () => ui.showScreen('game'));
  bus.on('level:start', () => { if (ui.current !== 'game') ui.showScreen('game'); });
  // Итоговый экран показываем, когда очередь анимаций render опустела.
  const afterAnimations = (name) => {
    const t0 = performance.now();
    const tick = () => {
      const busy = game.modules.render?.isBusy?.() && performance.now() - t0 < RESULT_MAX_WAIT;
      resultTimer = setTimeout(busy ? tick : () => ui.showScreen(name), busy ? 100 : RESULT_DELAY);
    };
    clearTimeout(resultTimer);
    resultTimer = setTimeout(tick, 100);
  };
  bus.on('level:won', (p) => { screens.showWin(p); afterAnimations('win'); });
  bus.on('level:failed', (p) => { screens.showLose(p); afterAnimations('lose'); });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (ui.current === 'game') ui.showScreen('pause');
    else if (ui.current === 'pause') ui.showScreen('game');
  });

  game.modules.ui = { showScreen: ui.showScreen, toast: hud.say, current: () => ui.current };
  ui.showScreen('menu');
}
