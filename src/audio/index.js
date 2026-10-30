// Модуль "audio": синтез звуков и музыки на Web Audio API, без внешних файлов.
// Подписан на события шины; также принимает прямой sfx:play { name, volume }.
import { installUnlock, setVolume, mute, getSettings } from './engine.js';
import { playSfx, SFX } from './sfx.js';
import { playMusic, stopMusic } from './music.js';

const SPECIAL_SFX = { line_h: 'line', line_v: 'line', bomb: 'bomb', rainbow: 'rainbow', plane: 'plane' };
const OBSTACLE_SFX = { ice: 'ice', chain: 'chain', crate: 'crate', slime: 'slime' };

export function init(game) {
  const { bus } = game;
  installUnlock();

  const api = {
    setVolume,
    mute,
    getSettings,
    play: playSfx,
    playMusic,
    stopMusic,
    sfxNames: () => Object.keys(SFX),
  };
  game.modules.audio = api;

  bus.on('sfx:play', ({ name, volume } = {}) => playSfx(name, { volume }));
  bus.on('music:play', ({ name, fade } = {}) => playMusic(name, { fade }));
  bus.on('input:swap', () => playSfx('swap'));
  bus.on('swap:done', ({ valid }) => { if (valid === false) playSfx('invalid'); });
  bus.on('match:found', ({ chain = 1 } = {}) => playSfx('match', { chain }));
  bus.on('tiles:cleared', ({ chain = 1 } = {}) => playSfx('clear', { chain }));
  bus.on('special:created', () => playSfx('special_create'));
  bus.on('special:fired', ({ special } = {}) => playSfx(SPECIAL_SFX[special] ?? 'bomb'));
  bus.on('obstacle:damaged', ({ kind } = {}) => playSfx(OBSTACLE_SFX[kind] ?? 'crate'));
  bus.on('input:booster', () => playSfx('booster'));
  bus.on('board:shuffled', () => playSfx('shuffle'));
  bus.on('coins:changed', ({ delta = 0 } = {}) => { if (delta > 0) playSfx('coin'); });

  // Музыка по состоянию игры
  bus.on('game:ready', () => playMusic('menu'));
  bus.on('level:start', () => playMusic('game'));
  bus.on('level:won', () => {
    playMusic('win');
    playSfx('win');
  });
  bus.on('level:failed', () => {
    stopMusic(1.5);
    playSfx('fail');
  });
}
