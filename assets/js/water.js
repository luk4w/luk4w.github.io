// Água: uma simulação de ondas numa grade mais fina que a das letras (WATER_SUB).
// O cursor e o clique só afundam a água; as ondas, o rastro e o assentamento saem da
// física. Cada letra se desloca pela inclinação da água embaixo dela e acende onde ela inclina.
import {
  CELL, WATER_HZ, WATER_SUB, WATER_DAMP, WATER_MARGIN, WATER_EDGE,
  MOUSE_DEPTH, MOUSE_RADIUS, CLICK_FORCE, CLICK_RADIUS, REFRACT, SHINE, CALM, reduced,
} from './config.js';
import { grid, view, markTouched, touchGrid } from './grid.js';
import { cardState, visibleChars, light, touchCards } from './cards.js';

const WCELL = CELL / WATER_SUB;

const pool = {
  cols: 0,
  rows: 0,
  h: new Float32Array(0), // altura da água agora
  prev: new Float32Array(0), // e no passo anterior
  edgeCol: new Float32Array(0), // absorção por coluna (bordas esquerda e direita)
  acc: 0,
  active: false,
};

// keep: a página só ficou mais alta (mesma largura), então dá para copiar o começo
export function allocateWater(c, r, keep) {
  const cols = c * WATER_SUB;
  const rows = r * WATER_SUB;
  const h = new Float32Array(cols * rows);
  const prev = new Float32Array(cols * rows);
  if (keep) {
    h.set(pool.h.subarray(0, Math.min(pool.h.length, h.length)));
    prev.set(pool.prev.subarray(0, Math.min(pool.prev.length, prev.length)));
  }
  Object.assign(pool, {
    cols,
    rows,
    h,
    prev,
    edgeCol: Float32Array.from({ length: cols }, (_, k) => edgeAbsorb(Math.min(k, cols - 1 - k) / WATER_SUB)),
  });
}

// 1 longe da borda; perto dela a onda perde um pouco mais de força a cada passo,
// então ela morre na beirada em vez de voltar. dist em células de letra; o expoente
// compensa os passos extras da grade fina para absorver o mesmo por segundo.
function edgeAbsorb(dist) {
  const t = Math.min(1, dist / WATER_EDGE);
  return Math.pow(1 - (1 - t) * (1 - t) * 0.15, 1 / WATER_SUB);
}

// chama fn(i, d) para cada célula de água a menos de R px de (x, y)
function forWaterCells(x, y, R, fn) {
  const top = Math.max(1, Math.floor((y - R) / WCELL));
  const bottom = Math.min(pool.rows - 2, Math.floor((y + R) / WCELL));
  const left = Math.max(1, Math.floor((x - R) / WCELL));
  const right = Math.min(pool.cols - 2, Math.floor((x + R) / WCELL));
  for (let row = top; row <= bottom; row++) {
    for (let c = left; c <= right; c++) {
      const d = Math.hypot(c * WCELL + WCELL / 2 - x, row * WCELL + WCELL / 2 - y);
      if (d < R) fn(row * pool.cols + c, d);
    }
  }
}

// afunda a água em volta de (x, y); raio em células de letra
function disturb(x, y, radius, force) {
  const R = radius * CELL;
  forWaterCells(x, y, R, (i, d) => {
    const f = 1 - d / R;
    pool.h[i] -= force * f * f;
  });
  pool.active = true;
}

// o cursor não bate na água (isso abriria um anel a cada frame, como cliques):
// ele afunda a superfície até uma profundidade fixa, sem dar velocidade. Parado forma
// uma covinha; andando de (x0,y0) a (x1,y1), a água em volta forma o rastro sozinha.
export function press(x0, y0, x1, y1) {
  // nunca menor que uma célula de água, senão o dedo "some" entre as células
  const R = Math.max(MOUSE_RADIUS * CELL, WCELL * 0.75);
  const sink = (i, d) => {
    const q = 1 - (d / R) ** 2;
    const target = -MOUSE_DEPTH * q * q;
    if (pool.h[i] > target) pool.h[i] = target;
    if (pool.prev[i] > target) pool.prev[i] = target;
  };
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (WCELL * 0.5)));
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    forWaterCells(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, R, sink);
  }
  pool.active = true;
}

// o pingo do clique: afunda a água e acende o ponto onde bateu
export function splash(x, y) {
  disturb(x, y, CLICK_RADIUS, CLICK_FORCE);
  touchGrid(x, y, CELL * 2, 1, 0.3);
  touchCards(x, y, CELL * 2, 1);
}

// equação de onda discreta: cada célula puxa para a média das vizinhas e perde um
// pouco de energia (WATER_DAMP). Passo fixo para a velocidade não depender do monitor.
export function stepWater(dt) {
  if (!pool.active) return;
  // grade WATER_SUB vezes mais fina: a onda anda menos px por passo, então roda
  // WATER_SUB vezes mais passos, e cada passo perde menos força (mesmo total por segundo)
  const stepDt = 1 / (WATER_HZ * WATER_SUB);
  const damp = Math.pow(WATER_DAMP, 1 / WATER_SUB);
  const { cols, rows, edgeCol } = pool;
  const r0 = Math.max(1, (view.vTop - WATER_MARGIN) * WATER_SUB);
  const r1 = Math.min(rows - 2, (view.vBot + WATER_MARGIN + 1) * WATER_SUB);
  pool.acc = Math.min(pool.acc + dt, 3 / WATER_HZ);
  let stepped = false;
  let peak = 0;
  while (pool.acc >= stepDt) {
    pool.acc -= stepDt;
    stepped = true;
    peak = 0;
    const { h, prev } = pool;
    for (let row = r0; row <= r1; row++) {
      // topo e fim da página e as bordas da faixa simulada também absorvem
      const rowF = damp * edgeAbsorb(Math.min(row - r0, r1 - row, row, rows - 1 - row) / WATER_SUB);
      let i = row * cols + 1;
      for (let c = 1; c < cols - 1; c++, i++) {
        const v = ((h[i - 1] + h[i + 1] + h[i - cols] + h[i + cols]) * 0.5 - prev[i]) * rowF * edgeCol[c];
        prev[i] = v;
        if (v > peak) peak = v;
        else if (-v > peak) peak = -v;
      }
    }
    pool.h = prev;
    pool.prev = h;
  }
  // água parada de novo: zera tudo e para de simular
  if (stepped && peak < 0.003) {
    pool.h.fill(0);
    pool.prev.fill(0);
    pool.active = false;
  }
}

// inclinação da água no ponto (x, y) da página, na escala de uma letra
// (para CALM, SHINE e REFRACT valerem o mesmo com qualquer WATER_SUB)
let slopeX = 0;
let slopeY = 0;
function sampleSlope(x, y) {
  const { cols, rows, h } = pool;
  const c = Math.floor(x / WCELL);
  const row = Math.floor(y / WCELL);
  if (c < 1 || c > cols - 2 || row < 1 || row > rows - 2) {
    slopeX = slopeY = 0;
    return 0;
  }
  const j = row * cols + c;
  slopeX = (h[j + 1] - h[j - 1]) * WATER_SUB;
  slopeY = (h[j + cols] - h[j - cols]) * WATER_SUB;
  return Math.abs(slopeX) + Math.abs(slopeY);
}

// lê a inclinação da água embaixo de cada letra: desloca e acende
export function applyWater() {
  if (!pool.active) return;
  const push = reduced ? 0 : REFRACT;
  const { cols, glyphs, dispX, dispY, wave } = grid;
  const r0 = Math.max(0, view.vTop);
  const r1 = Math.min(grid.rows - 1, view.vBot);
  for (let row = r0; row <= r1; row++) {
    let i = row * cols;
    for (let c = 0; c < cols; c++, i++) {
      if (!glyphs[i]) continue;
      const slope = sampleSlope(c * CELL + CELL / 2, row * CELL + CELL / 2);
      if (slope < CALM) continue;
      markTouched(i);
      // a reação começa do zero no limite CALM, sem degrau
      const k = ((slope - CALM) / slope) * push;
      dispX[i] = slopeX * k;
      dispY[i] = slopeY * k;
      const s = Math.min(1, (slope - CALM) * SHINE);
      wave[i] = s * s; // só a parte mais inclinada brilha forte: bico mais fino
    }
  }

  // texto dos cards: só acende onde a água embaixo está inclinada
  const { list, docRects } = cardState;
  for (let k = 0; k < list.length; k++) {
    const r = docRects[k];
    if (!r || r.bottom < view.sy || r.top > view.sy + view.H) continue;
    const card = list[k];
    for (const line of card.lines) {
      const ly = r.top + line.y + line.lh / 2;
      const vis = visibleChars(card, line);
      for (let i = 0; i < vis; i++) {
        const e = (sampleSlope(r.left + line.x + (i + 0.5) * line.cw, ly) - CALM) * SHINE;
        if (e > 0.15) light(line, i, Math.min(1, e) ** 2);
      }
    }
  }
}
