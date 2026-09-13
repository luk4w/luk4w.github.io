// Grade de letras do tamanho da página inteira (rola junto com ela). Cada célula tem
// um caractere, um tom de base e uma energia (brilho) que volta ao normal com o tempo.
import { CELL, GLYPHS, GRID_DECAY, BAND_BUF, GRID_FONT, BG, NEON, HOT_COLORS } from './config.js';

// tela e rolagem, atualizados a cada frame
export const view = { W: 0, H: 0, dpr: 1, sy: 0, vTop: 0, vBot: 0 };

export const grid = {
  cols: 0,
  rows: 0,
  glyphs: [],
  shade: new Float32Array(0),
  energy: new Float32Array(0),
  inHot: new Uint8Array(0),
  hot: [], // índices das letras acesas
  // letras mexidas pela água neste frame: deslocamento e brilho da onda
  stamp: new Uint32Array(0),
  dispX: new Float32Array(0),
  dispY: new Float32Array(0),
  wave: new Float32Array(0),
  touched: [],
  frameId: 0,
};

const canvas = document.getElementById('rain');
const ctx = canvas.getContext('2d');
// faixa da página perto da tela, pré-desenhada com as letras em repouso
const band = document.createElement('canvas');
const bandCtx = band.getContext('2d');
let bandTop = -1;
let bandRows = 0;

export const pick = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
const cellX = (i) => (i % grid.cols) * CELL + CELL / 2;
const cellY = (i) => ((i / grid.cols) | 0) * CELL + CELL / 2;

export function resizeGrid() {
  canvas.width = Math.round(view.W * view.dpr);
  canvas.height = Math.round(view.H * view.dpr);
  bandTop = -1;
}

// keep: a página só ficou mais alta (mesmas colunas), então as letras existentes ficam
export function allocateGrid(c, r, keep) {
  const n = c * r;
  const oldN = keep ? grid.cols * grid.rows : 0;
  const glyphs = new Array(n);
  const shade = new Float32Array(n);
  const energy = new Float32Array(n);
  const inHot = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (i < oldN) {
      glyphs[i] = grid.glyphs[i];
      shade[i] = grid.shade[i];
      energy[i] = grid.energy[i];
      inHot[i] = grid.inHot[i];
    } else {
      glyphs[i] = Math.random() < 0.7 ? pick() : '';
      shade[i] = glyphs[i] ? 0.04 + Math.random() * 0.1 : 0;
    }
  }
  Object.assign(grid, {
    cols: c,
    rows: r,
    glyphs,
    shade,
    energy,
    inHot,
    stamp: new Uint32Array(n),
    dispX: new Float32Array(n),
    dispY: new Float32Array(n),
    wave: new Float32Array(n),
    touched: [],
  });
  if (!keep) grid.hot = [];
  bandTop = -1;
}

// pré-desenha só a faixa da página perto da tela; refaz quando a rolagem sai dela
export function ensureBand() {
  const top = Math.floor(view.sy / CELL);
  const need = Math.ceil(view.H / CELL) + 1;
  if (bandTop >= 0 && band.width === canvas.width && top >= bandTop && top + need <= bandTop + bandRows) return;
  const { cols, rows, glyphs, shade } = grid;
  bandRows = need + BAND_BUF * 2;
  bandTop = Math.max(0, top - BAND_BUF);
  band.width = canvas.width;
  band.height = Math.round(bandRows * CELL * view.dpr);
  bandCtx.setTransform(view.dpr, 0, 0, view.dpr, 0, -bandTop * CELL * view.dpr);
  bandCtx.font = GRID_FONT;
  bandCtx.textAlign = 'center';
  bandCtx.textBaseline = 'middle';
  bandCtx.globalAlpha = 1;
  bandCtx.fillStyle = BG;
  bandCtx.fillRect(0, bandTop * CELL, view.W + CELL, bandRows * CELL);
  bandCtx.fillStyle = NEON;
  const end = Math.min(rows, bandTop + bandRows);
  for (let row = bandTop; row < end; row++) {
    for (let c = 0; c < cols; c++) {
      const i = row * cols + c;
      if (!glyphs[i]) continue;
      bandCtx.globalAlpha = shade[i];
      bandCtx.fillText(glyphs[i], c * CELL + CELL / 2, row * CELL + CELL / 2);
    }
  }
}

// redesenha uma letra na faixa (quando o caractere é trocado)
function paintCell(i) {
  const row = (i / grid.cols) | 0;
  if (row < bandTop || row >= bandTop + bandRows) return;
  const x = (i % grid.cols) * CELL;
  const y = row * CELL;
  bandCtx.globalAlpha = 1;
  bandCtx.fillStyle = BG;
  bandCtx.fillRect(x, y, CELL, CELL);
  if (!grid.glyphs[i]) return;
  bandCtx.fillStyle = NEON;
  bandCtx.globalAlpha = grid.shade[i];
  bandCtx.fillText(grid.glyphs[i], x + CELL / 2, y + CELL / 2);
}

// acende uma letra; com brilho forte ela às vezes troca de caractere
export function lightCell(i, a, scramble = 0.3) {
  const { glyphs, energy, inHot } = grid;
  if (!glyphs[i] || energy[i] >= a) return;
  if (a > 0.5 && energy[i] < 0.2 && Math.random() < scramble) {
    glyphs[i] = pick();
    paintCell(i);
  }
  energy[i] = a;
  if (!inHot[i]) {
    inHot[i] = 1;
    grid.hot.push(i);
  }
}

export function markTouched(i) {
  if (grid.stamp[i] === grid.frameId) return;
  grid.stamp[i] = grid.frameId;
  grid.touched.push(i);
  grid.dispX[i] = 0;
  grid.dispY[i] = 0;
  grid.wave[i] = 0;
}

export function beginFrame() {
  grid.frameId++;
  grid.touched.length = 0;
}

// brilho circular com queda suave (coordenadas da página)
export function touchGrid(cx, cy, R, a, scramble) {
  const top = Math.max(view.vTop, Math.floor((cy - R) / CELL));
  const bottom = Math.min(view.vBot, Math.floor((cy + R) / CELL));
  const left = Math.max(0, Math.floor((cx - R) / CELL));
  const right = Math.min(grid.cols - 1, Math.floor((cx + R) / CELL));
  for (let row = top; row <= bottom; row++) {
    for (let c = left; c <= right; c++) {
      const d = Math.hypot(c * CELL + CELL / 2 - cx, row * CELL + CELL / 2 - cy);
      if (d < R) lightCell(row * grid.cols + c, a * (1 - d / R), scramble);
    }
  }
}

// o brilho volta suavemente até o tom original de cada letra (sem "pulo" para o escuro)
function cellStyle(base, e) {
  if (e < 0.4) {
    ctx.fillStyle = NEON;
    ctx.globalAlpha = Math.min(1, base + (e / 0.4) * (1 - base));
  } else {
    ctx.globalAlpha = 1;
    ctx.fillStyle = HOT_COLORS[Math.min(15, (((e - 0.4) / 0.6) * 16) | 0)];
  }
}

export function drawGrid(dt) {
  const { glyphs, shade, energy, inHot, hot, stamp, dispX, dispY, wave, touched, frameId } = grid;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.drawImage(band, 0, Math.round((view.sy - bandTop * CELL) * view.dpr), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  // daqui em diante desenha em coordenadas da página
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, -view.sy * view.dpr);
  ctx.font = GRID_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // apaga da faixa estática as letras que a água está mexendo
  ctx.fillStyle = BG;
  for (const i of touched) ctx.fillRect(cellX(i) - CELL / 2, cellY(i) - CELL / 2, CELL, CELL);

  // remove as que já voltaram ao normal
  let n = 0;
  for (let j = 0; j < hot.length; j++) {
    const i = hot[j];
    if (energy[i] < 0.01) {
      energy[i] = 0;
      inHot[i] = 0;
      continue;
    }
    hot[n++] = i;
  }
  hot.length = n;

  // acesas e paradas: primeiro as fortes com brilho, depois as fracas
  ctx.shadowColor = NEON;
  for (const glowing of [true, false]) {
    ctx.shadowBlur = glowing ? 10 : 0;
    for (let j = 0; j < n; j++) {
      const i = hot[j];
      if (stamp[i] === frameId || (energy[i] >= 0.45) !== glowing) continue;
      const row = (i / grid.cols) | 0;
      if (row < view.vTop || row > view.vBot) continue;
      cellStyle(shade[i], energy[i]);
      ctx.fillText(glyphs[i], cellX(i), cellY(i));
    }
  }

  // letras na água: deslocadas pela inclinação e mais claras onde ela inclina mais
  for (const i of touched) {
    const base = Math.min(0.95, shade[i] + wave[i] * 1.1);
    ctx.shadowBlur = energy[i] >= 0.45 || base > 0.55 ? 8 : 0;
    cellStyle(base, energy[i]);
    const ox = Math.max(-9, Math.min(9, dispX[i]));
    const oy = Math.max(-9, Math.min(9, dispY[i]));
    ctx.fillText(glyphs[i], cellX(i) + ox, cellY(i) + oy);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  const keep = Math.exp(-GRID_DECAY * dt);
  for (let j = 0; j < n; j++) energy[hot[j]] *= keep;
}
