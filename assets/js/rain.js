// Chuva estilo Matrix: colunas de caracteres caindo com a ponta acesa. O rastro
// esmaecendo até o tom de repouso vem do decaimento da energia em drawGrid.
import { CELL, MAX_STREAMS, AMBIENT, reduced } from './config.js';
import { grid, view, lightCell } from './grid.js';
import { cardState, visibleChars, light } from './cards.js';

let streams = [];
let ambientTimer = 0.3;

export function resetRain() {
  streams = [];
}

function spawnStream(col, y, strength, travel) {
  if (col < 0 || col >= grid.cols || streams.length >= MAX_STREAMS) return;
  streams.push({ col, y, start: y, travel, strength, speed: 220 + Math.random() * 280 });
  const row = Math.floor(y / CELL);
  if (row >= 0 && row < grid.rows) lightCell(row * grid.cols + col, strength, 0.6);
}

export function stepRain(dt) {
  if (AMBIENT && !reduced) {
    ambientTimer -= dt;
    if (ambientTimer <= 0) {
      spawnStream((Math.random() * grid.cols) | 0, view.sy - CELL, 0.45 + Math.random() * 0.3, view.H + CELL * 2);
      ambientTimer = 0.15 + Math.random() * 0.5;
    }
  }

  const { list, docRects } = cardState;
  for (let j = streams.length - 1; j >= 0; j--) {
    const s = streams[j];
    const y0 = s.y;
    const y1 = (s.y = y0 + s.speed * dt);
    const done = (y1 - s.start) / s.travel;
    // perde força só no último quarto do percurso
    const a = s.strength * (done < 0.75 ? 1 : Math.max(0, 1 - (done - 0.75) / 0.25));

    // letras cujo centro a ponta atravessou neste frame
    const r0 = Math.max(0, Math.ceil((y0 - CELL / 2) / CELL));
    const r1 = Math.min(grid.rows - 1, Math.ceil((y1 - CELL / 2) / CELL) - 1);
    for (let row = r0; row <= r1; row++) lightCell(row * grid.cols + s.col, a, 0.6);

    // a chuva passa por cima do texto dos cards também
    const hx = s.col * CELL + CELL / 2;
    for (let k = 0; k < list.length; k++) {
      const r = docRects[k];
      if (!r || hx < r.left || hx > r.right || y1 < r.top || y0 > r.bottom) continue;
      const card = list[k];
      for (const line of card.lines) {
        const cy = r.top + line.y + line.lh / 2;
        if (cy < y0 || cy >= y1) continue;
        const vis = visibleChars(card, line);
        const idx = Math.floor((hx - r.left - line.x) / line.cw);
        // a letra embaixo da gota acende inteira; as vizinhas, pela metade
        for (let d = -1; d <= 1; d++) {
          if (idx + d >= 0 && idx + d < vis) light(line, idx + d, d ? a * 0.5 : a);
        }
      }
    }

    if (done >= 1) streams.splice(j, 1);
  }
}
