// Fundo da página: grade de letras com chuva estilo Matrix e uma simulação de água que
// reage ao cursor e ao clique, mais o texto dos cards desenhado em canvas.
// Ajustes em config.js; cores nas variáveis do CSS; cards em content/*.txt.
import { CELL, GRID_FONT, STYLES, HOVER_RADIUS, HOVER_GLOW, reduced } from './config.js';
import { view, grid, allocateGrid, resizeGrid, ensureBand, beginFrame, touchGrid, drawGrid } from './grid.js';
import { initCards, resizeCards, layoutCards, measureCards, clearMeasureCaches, touchCards, drawText } from './cards.js';
import { resetRain, stepRain } from './rain.js';
import { allocateWater, press, splash, stepWater, applyWater } from './water.js';
import { loadContent } from './content.js';

const PRETEXT_URL = 'https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.9/+esm';

let pointer = null;
let lastMouse = null;

function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.W = innerWidth;
  view.H = innerHeight;
  resizeGrid();
  resizeCards();
  layoutCards();
  ensureGrid();
}

// a grade cobre o documento todo; cresce se a página ficar mais alta
function ensureGrid() {
  const cols = Math.ceil(view.W / CELL) + 1;
  const rows = Math.ceil(Math.max(document.documentElement.scrollHeight, view.H) / CELL) + 2;
  if (cols !== grid.cols) {
    allocateGrid(cols, rows, false);
    allocateWater(cols, rows, false);
    resetRain();
  } else if (rows > grid.rows) {
    allocateGrid(cols, rows, true);
    allocateWater(cols, rows, true);
  }
}

function measure() {
  view.sy = window.scrollY;
  measureCards();
  ensureGrid();
  ensureBand();
  view.vTop = Math.max(0, Math.floor(view.sy / CELL) - 1);
  view.vBot = Math.min(grid.rows - 1, Math.floor((view.sy + view.H) / CELL) + 1);
}

function stepPointer() {
  if (!pointer) {
    lastMouse = null;
    return;
  }
  const x = pointer.x;
  const y = pointer.y + view.sy;
  // rolar a página com o mouse parado também move o "dedo" pela água
  if (!reduced) press(lastMouse ? lastMouse.x : x, lastMouse ? lastMouse.y : y, x, y);
  lastMouse = { x, y };
  touchGrid(x, y, HOVER_RADIUS, HOVER_GLOW, 0.12);
  touchCards(x, y, HOVER_RADIUS * 0.7, 0.6);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  measure();
  beginFrame();
  stepPointer();
  stepRain(dt);
  stepWater(dt);
  applyWater();
  drawGrid(dt);
  drawText(dt);
  requestAnimationFrame(frame);
}

async function start() {
  // os cards entram primeiro: se o Pretext falhar, eles continuam visíveis em HTML
  await loadContent();

  let pretext;
  try {
    pretext = await import(PRETEXT_URL);
  } catch (err) {
    console.warn('Pretext não carregou; o texto fica em HTML', err);
    document.documentElement.classList.add('plain'); // mostra os cards em HTML (o CSS os esconde até o canvas assumir)
    return;
  }

  // mede o texto só com a fonte certa carregada (ou desiste depois de 2s)
  const fonts = [GRID_FONT, ...Object.values(STYLES).map((s) => s.font)].map((f) => document.fonts.load(f));
  await Promise.race([Promise.all(fonts), new Promise((r) => setTimeout(r, 2000))]);

  initCards(pretext);
  resize();
  addEventListener('resize', resize);

  // se a fonte web chegar atrasada, remede tudo
  document.fonts.addEventListener('loadingdone', () => {
    clearMeasureCaches();
    layoutCards();
  });

  let lastWidth = 0;
  new ResizeObserver(([entry]) => {
    const w = entry.contentRect.width;
    if (w !== lastWidth) {
      lastWidth = w;
      layoutCards();
    }
  }).observe(document.querySelector('.wrap'));

  // hover só com mouse (no toque ficaria preso no último ponto); o toque faz o pingo
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') pointer = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  addEventListener('pointerdown', (e) => splash(e.clientX, e.clientY + window.scrollY), { passive: true });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) pointer = null; });
  addEventListener('blur', () => { pointer = null; });

  measure();
  requestAnimationFrame(frame);
}

start();
