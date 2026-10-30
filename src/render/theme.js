// Темы оформления. Цвета фишек — по индексу типа (см. CONFIG.tileTypes).
export const THEMES = {
  candy: {
    name: 'candy', title: 'Конфеты',
    bg: ['#4b2a9a', '#e4559f'],
    blobs: ['#ffd1f0', '#8fd3ff', '#fff2a8'],
    boardFill: 'rgba(40,12,90,0.45)', cellA: 'rgba(255,255,255,0.10)', cellB: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.35)',
    tiles: ['#ff3b5c', '#ff9a1f', '#ffd91f', '#34d65a', '#2fa8ff', '#a74bff'],
    accent: '#ffd23f', text: '#ffffff',
  },
  night: {
    name: 'night', title: 'Ночь',
    bg: ['#0a0f2c', '#2b1b5e'],
    blobs: ['#5b6bff', '#b66bff', '#4de0ff'],
    boardFill: 'rgba(5,8,30,0.6)', cellA: 'rgba(120,140,255,0.12)', cellB: 'rgba(120,140,255,0.04)',
    border: 'rgba(150,170,255,0.4)',
    tiles: ['#ff4d6d', '#ff9f43', '#f9e04b', '#3be29b', '#4dabff', '#c27bff'],
    accent: '#7df9ff', text: '#eef1ff',
  },
  ocean: {
    name: 'ocean', title: 'Океан',
    bg: ['#0b6fb5', '#3fe0c5'],
    blobs: ['#ffffff', '#b7f3ff', '#ffe9a8'],
    boardFill: 'rgba(0,50,90,0.4)', cellA: 'rgba(255,255,255,0.14)', cellB: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.45)',
    tiles: ['#ff4f6a', '#ff9a3c', '#ffe03a', '#2ed67a', '#2a8cff', '#9a5cff'],
    accent: '#fff07a', text: '#ffffff',
  },
};

function parse(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// Смешивание с белым (k>0) или чёрным (k<0), k в [-1..1].
export function shade(hex, k) {
  const [r, g, b] = parse(hex);
  const t = k < 0 ? 0 : 255, a = Math.abs(k);
  const f = (v) => Math.round(v + (t - v) * a);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
export function alpha(hex, a) {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${a})`;
}
