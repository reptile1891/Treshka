// Экраны: главное меню, карта уровней, пауза, победа, поражение.
import { h, btn, fmt, mmss } from './dom.js';

export function createScreens(game, ui) {
  const { bus } = game;
  const mod = (n) => game.modules[n];
  const out = {};

  // --- общая информация: жизни, монеты ---
  let lives = game.config.maxLives, nextAt = 0, coins = 0;
  const livesV = h('span'), coinsV = h('span');
  const topbar = (left) => {
    const lv = h('div', 'chip', '❤ ', livesV.cloneNode()), cn = h('div', 'chip', '🪙 ', coinsV.cloneNode());
    return h('div', 'topbar', left, h('div', 'row', lv, cn));
  };
  const livesEls = [], coinEls = [];
  function bar(left) {
    const el = topbar(left);
    livesEls.push(el.querySelector('.chip span')); coinEls.push(el.querySelectorAll('.chip span')[1]);
    return el;
  }
  function paintStatus() {
    const t = nextAt > Date.now() && lives < game.config.maxLives ? mmss(nextAt - Date.now()) : '';
    for (const e of livesEls) e.innerHTML = lives + (t ? `<small>${t}</small>` : '');
    for (const e of coinEls) e.textContent = fmt(coins);
  }
  setInterval(() => { if (out.menu.classList.contains('on') || out.map.classList.contains('on')) paintStatus(); }, 1000);
  bus.on('lives:changed', (p) => { lives = p.lives; nextAt = p.nextAt ?? 0; paintStatus(); });
  bus.on('coins:changed', (p) => { coins = p.coins; paintStatus(); });

  // --- меню ---
  const logo = h('div', 'logo');
  [...'Трешка'].forEach((ch, i) => { const s = h('span', null, ch); s.style.animationDelay = i * 0.12 + 's'; logo.append(s); });
  const gems = h('div', 'gems');
  function paintGems() {
    gems.replaceChildren();
    for (let i = 0; i < 6; i++) {
      const src = mod('render')?.icon('tile', i); if (!src) continue;
      const im = h('img'); im.src = src; im.alt = ''; im.style.animationDelay = i * 0.15 + 's'; gems.append(im);
    }
  }
  const themeBtn = btn('', 'ghost', () => {
    const r = mod('render'); const list = r.themes();
    const i = list.findIndex((t) => t.name === r.getTheme());
    r.setTheme(list[(i + 1) % list.length].name);
  });
  let muted = false;
  const soundBtn = btn('', 'ghost', () => { muted = !muted; mod('audio')?.mute?.(muted); paintOpts(); });
  function paintOpts() {
    const r = mod('render');
    const cur = r?.themes().find((t) => t.name === r.getTheme());
    themeBtn.textContent = '🎨 ' + (cur?.title ?? 'Тема');
    soundBtn.textContent = muted ? '🔇 Звук выкл' : '🔊 Звук вкл';
  }
  out.menu = h('section', 'screen menu', bar(null), logo, gems,
    h('div', 'col', btn('Играть', 'green big', () => ui.showScreen('map')), h('div', 'row', themeBtn, soundBtn)));

  // --- карта ---
  const scroll = h('div', 'scroll');
  out.map = h('section', 'screen map', bar(btn('←', 'ghost round', () => ui.showScreen('menu'))), h('h2', null, 'Выбор уровня'), scroll);

  function paintMap() {
    const lv = mod('levels');
    let list = [];
    try { list = lv?.list?.() ?? []; } catch { /* модуль уровней ещё не готов */ }
    let prog = {};
    try { prog = lv?.progress?.() ?? {}; } catch { /* то же */ }
    const maxOpen = prog.unlocked ?? prog.current ?? 1;
    if (!list.length) list = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 })); // заглушка, пока нет данных
    scroll.replaceChildren();
    let cur = null;
    list.forEach((it, i) => {
      const id = it.id ?? i + 1;
      const stars = it.stars ?? prog.stars?.[id] ?? 0;
      const open = it.unlocked ?? id <= maxOpen;
      const n = h('button', 'node' + (!open ? ' lock' : stars ? ' done' : ' cur'), open ? String(id) : '🔒');
      n.type = 'button';
      if (open && stars) n.append(h('div', 'st', '★'.repeat(stars) + '☆'.repeat(3 - stars)));
      if (open) n.addEventListener('click', () => lv?.loadLevel?.(id));
      if (open && !stars) cur = n;
      const wrap = h('div', 'nw', n);
      wrap.style.transform = `translateX(${Math.round(Math.sin(i * 0.9) * 14)}vw)`;
      scroll.append(wrap);
    });
    const target = cur ?? scroll.lastElementChild?.firstElementChild;
    requestAnimationFrame(() => target?.scrollIntoView({ block: 'center' }));
  }
  // --- пауза ---
  const pTheme = btn('', 'ghost', () => themeBtn.click()), pSound = btn('', 'ghost', () => soundBtn.click());
  out.pause = h('section', 'screen modal', h('div', 'panel',
    h('h2', null, 'Пауза'),
    h('div', 'col',
      btn('Продолжить', 'green', () => ui.showScreen('game')),
      btn('Заново', 'blue', () => ui.restart()),
      h('div', 'row', pTheme, pSound),
      btn('В меню', 'ghost', () => ui.showScreen('map')))));
  const syncOpts = () => { pTheme.textContent = themeBtn.textContent; pSound.textContent = soundBtn.textContent; };

  // --- победа / поражение ---
  const starEls = [h('span', null, '★'), h('span', null, '★'), h('span', null, '★')];
  const winScore = h('div', 'score');
  const winNext = btn('Дальше', 'green', () => ui.nextLevel());
  out.win = h('section', 'screen modal', h('div', 'panel win',
    h('h2', null, 'Победа!'), h('div', 'bigstars', ...starEls), winScore,
    h('div', 'col', winNext, btn('Заново', 'blue', () => ui.restart()), btn('Карта', 'ghost', () => ui.showScreen('map')))));
  const loseScore = h('div', 'score');
  out.lose = h('section', 'screen modal', h('div', 'panel',
    h('h2', null, 'Не получилось'), h('div', null, 'Ходы закончились'), loseScore,
    h('div', 'col', btn('Ещё раз', 'green', () => ui.restart()), btn('Карта', 'ghost', () => ui.showScreen('map')))));

  out.showWin = ({ score, stars }) => {
    winScore.textContent = 'Счёт: ' + fmt(score);
    starEls.forEach((s) => s.classList.remove('lit'));
    for (let i = 0; i < stars; i++) setTimeout(() => starEls[i].classList.add('lit'), 350 + i * 330);
  };
  out.showLose = ({ score }) => { loseScore.textContent = 'Счёт: ' + fmt(score); };

  out.onShow = (name) => {
    if (name === 'map') { paintMap(); }
    if (name === 'menu') paintGems();
    paintOpts(); syncOpts(); paintStatus();
  };
  bus.on('theme:changed', () => { paintGems(); paintOpts(); syncOpts(); });
  return out;
}
