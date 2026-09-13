// Texto dos cards desenhado em canvas. Pretext quebra o texto em linhas sem tocar no
// layout do DOM; como a fonte é monoespaçada, cada caractere vira uma célula que a
// chuva e a água conseguem acender. O texto original continua no HTML para leitores de tela.
import {
  STYLES, MONO, TEXT_DECAY, REVEAL_SPEED, NEON, HOT, reduced,
  ASCII_COLS, ASCII_ROWS, ASCII_MAX_WIDTH, ASCII_SIDE_MIN, ASCII_SIDE_GAP,
} from './config.js';
import { view } from './grid.js';

// rects: posição na tela (para desenhar); docRects: posição na página (para a chuva e a água)
export const cardState = { list: [], rects: [], docRects: [] };

const canvas = document.getElementById('glow');
const ctx = canvas.getContext('2d');
const prepCache = new Map();
const widthCache = new Map();
let prepareWithSegments;
let layoutWithLines;

export function initCards(pretext) {
  ({ prepareWithSegments, layoutWithLines } = pretext);
  cardState.list = [...document.querySelectorAll('.txt')].map((el) => ({
    el,
    blocks: [...el.children].map((child) => {
      if (child.tagName === 'PRE') return { kind: 'ascii', text: child.textContent.replace(/\s+$/, '') };
      return {
        kind: /^H\d$/.test(child.tagName) ? 'title' : child.classList.contains('stack') ? 'stack' : 'desc',
        text: child.textContent.trim().replace(/\s+/g, ' '),
      };
    }),
    lines: [],
    total: 0,
    shown: reduced ? Infinity : 0,
  }));
  document.documentElement.classList.add('painted');
}

export function resizeCards() {
  canvas.width = Math.round(view.W * view.dpr);
  canvas.height = Math.round(view.H * view.dpr);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
}

// a fonte web chegou atrasada: as medidas antigas não valem mais
export function clearMeasureCaches() {
  prepCache.clear();
  widthCache.clear();
}

function prepared(text, font) {
  const key = font + '\n' + text;
  let p = prepCache.get(key);
  if (!p) prepCache.set(key, (p = prepareWithSegments(text, font)));
  return p;
}

function charWidth(font) {
  let w = widthCache.get(font);
  if (w === undefined) {
    ctx.font = font;
    widthCache.set(font, (w = ctx.measureText('M').width));
  }
  return w;
}

// quebra o texto de cada card em linhas e ajusta a altura do card no DOM.
// Card largo com arte ASCII: arte à esquerda e texto numa coluna à direita (como a página
// de um app). Card estreito: arte em cima, centralizada.
export function layoutCards() {
  for (const card of cardState.list) {
    const width = card.el.clientWidth;
    const ascii = card.blocks.find((b) => b.kind === 'ascii');
    const texts = card.blocks.filter((b) => b.kind !== 'ascii');
    const side = Boolean(ascii) && width >= ASCII_SIDE_MIN;
    const lines = [];
    let x = 0; // início da coluna atual dentro do card (px)
    let y = 0;
    let total = 0;
    const addLine = (chars, font, lh, cw, rest) => {
      lines.push({ x, y, lh, font, rest, cw, chars, text: chars.join(''),
        energy: new Float32Array(chars.length), hot: false, offset: total });
      total += chars.length;
      y += lh;
    };

    // arte ASCII não quebra linha: fica numa caixa padrão de ASCII_COLS × ASCII_ROWS, com a
    // fonte do tamanho que faz a caixa caber. Arte maior que a caixa não é cortada: só essa
    // encolhe mais. Devolve a largura da caixa em px.
    const addAscii = (block, center) => {
      const s = STYLES.ascii;
      const rows = block.text.split('\n').map((row) => Array.from(row.trimEnd()));
      while (rows.length && !rows[0].length) rows.shift();
      while (rows.length && !rows[rows.length - 1].length) rows.pop();
      const longest = Math.max(1, ...rows.map((row) => row.length));
      const cols = Math.max(ASCII_COLS, longest);
      const unit = charWidth(`${s.weight} 100px ${MONO}`) / 100; // largura de 1 caractere por px de fonte
      const size = Math.max(4, Math.min(s.size, Math.min(width, ASCII_MAX_WIDTH) / cols / unit));
      const cw = unit * size;
      const lh = size * s.lineHeight;
      // espaços à esquerda: centralizam a caixa no card (se pedido) e a arte dentro da caixa
      const boxOffset = center ? Math.max(0, Math.floor((width / cw - cols) / 2)) : 0;
      const indent = Array(boxOffset + Math.floor((cols - longest) / 2)).fill(' ');
      const padRows = Math.max(0, ASCII_ROWS - rows.length);
      y += Math.floor(padRows / 2) * lh;
      for (const row of rows) addLine(row.length ? indent.concat(row) : row, `${s.weight} ${size}px ${MONO}`, lh, cw, s.rest);
      y += Math.ceil(padRows / 2) * lh;
      return cols * cw;
    };

    let artBottom = 0;
    let textWidth = width;
    if (side) {
      const artWidth = addAscii(ascii, false);
      artBottom = y;
      x = Math.ceil(artWidth + ASCII_SIDE_GAP);
      y = 0;
      textWidth = width - x;
    } else if (ascii) {
      addAscii(ascii, true);
      if (texts.length) y += STYLES.ascii.gap;
    }

    texts.forEach((block, i) => {
      const s = STYLES[block.kind];
      const cw = charWidth(s.font);
      for (const line of layoutWithLines(prepared(block.text, s.font), textWidth, s.lh).lines) {
        addLine(Array.from(line.text.trimEnd()), s.font, s.lh, cw, s.rest);
      }
      if (i < texts.length - 1) y += s.gap;
    });

    card.lines = lines;
    card.total = total;
    card.el.style.height = `${Math.max(artBottom, y)}px`;
    // destaque e links do card acompanham a coluna de texto
    const article = card.el.closest('.card');
    if (article) {
      article.classList.toggle('side', side);
      article.style.setProperty('--side-offset', `${side ? x : 0}px`);
    }
  }
}

export function measureCards() {
  cardState.rects = cardState.list.map((c) => c.el.getBoundingClientRect());
  cardState.docRects = cardState.rects.map((r) => ({
    left: r.left,
    right: r.right,
    top: r.top + view.sy,
    bottom: r.bottom + view.sy,
  }));
}

// quantos caracteres da linha o efeito "digitando" já mostrou
export function visibleChars(card, line) {
  return Math.max(0, Math.min(line.chars.length, card.shown - line.offset));
}

export function light(line, i, e) {
  if (line.energy[i] < e) {
    line.energy[i] = e;
    line.hot = true;
  }
}

// brilho circular com queda suave no texto dos cards (coordenadas da página)
export function touchCards(cx, cy, R, a) {
  const { list, docRects } = cardState;
  for (let k = 0; k < list.length; k++) {
    const r = docRects[k];
    if (!r || cx + R < r.left || cx - R > r.right || cy + R < r.top || cy - R > r.bottom) continue;
    const card = list[k];
    for (const line of card.lines) {
      const dy = r.top + line.y + line.lh / 2 - cy;
      if (Math.abs(dy) >= R) continue;
      const vis = visibleChars(card, line);
      const left = r.left + line.x;
      const i0 = Math.max(0, Math.floor((cx - R - left) / line.cw));
      const i1 = Math.min(vis - 1, Math.ceil((cx + R - left) / line.cw));
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(left + (i + 0.5) * line.cw - cx, dy);
        if (d < R) light(line, i, a * (1 - d / R));
      }
    }
  }
}

export function drawText(dt) {
  const { list, rects } = cardState;
  ctx.clearRect(0, 0, view.W, view.H);
  ctx.textBaseline = 'middle';
  const keep = Math.exp(-TEXT_DECAY * dt);

  for (let k = 0; k < list.length; k++) {
    const r = rects[k];
    if (r.bottom < 0 || r.top > view.H) continue;
    const card = list[k];

    // efeito "digitando": cada caractere novo nasce neon
    if (card.shown < card.total) {
      const before = card.shown;
      const speed = Math.max(REVEAL_SPEED, card.total / 2); // nenhum card leva mais de ~2s
      card.shown = Math.min(card.total, before + speed * dt + 1);
      for (const line of card.lines) {
        const a = Math.max(0, Math.floor(before) - line.offset);
        const b = Math.min(line.chars.length, Math.floor(card.shown) - line.offset);
        for (let i = a; i < b; i++) light(line, i, 1);
      }
    }

    for (const line of card.lines) {
      const top = r.top + line.y;
      if (top + line.lh < 0 || top > view.H) continue;
      const vis = visibleChars(card, line);
      if (vis === 0) continue;
      const cy = top + line.lh / 2;

      // a linha inteira no tom de repouso...
      ctx.font = line.font;
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = line.rest;
      const left = r.left + line.x;
      ctx.fillText(vis === line.chars.length ? line.text : line.chars.slice(0, vis).join(''), left, cy);

      // ...e por cima só os caracteres acesos, que vão apagando
      if (!line.hot) continue;
      let hotLine = false;
      ctx.shadowColor = NEON;
      ctx.shadowBlur = 10;
      for (let i = 0; i < vis; i++) {
        const e = line.energy[i];
        if (e < 0.02) {
          line.energy[i] = 0;
          continue;
        }
        hotLine = true;
        ctx.globalAlpha = Math.min(1, e * 1.1);
        ctx.fillStyle = e > 0.9 ? HOT : NEON;
        ctx.fillText(line.chars[i], left + i * line.cw, cy);
        line.energy[i] = e * keep;
      }
      line.hot = hotLine;
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}
