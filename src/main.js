import { createBus } from './shared/bus.js';
import { CONFIG } from './shared/config.js';
import * as core from './core/index.js';
import * as mechanics from './mechanics/index.js';
import * as levels from './levels/index.js';
import * as render from './render/index.js';
import * as ui from './ui/index.js';
import * as audio from './audio/index.js';
import * as meta from './meta/index.js';

const game = {
  bus: createBus(),
  config: CONFIG,
  canvas: document.getElementById('game'),
  modules: {},
};

// Порядок важен: сначала логика, потом представление.
for (const m of [core, mechanics, levels, meta, render, ui, audio]) m.init(game);

game.bus.emit('game:ready');
window.game = game; // для отладки
