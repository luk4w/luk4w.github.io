// Todos os ajustes do efeito ficam aqui. As cores vêm das variáveis do CSS,
// então cada página pode ter seu próprio tema (ex.: data-theme="orange").

// ---------- grade de letras ----------
export const CELL = 18; // tamanho de cada letra da grade (px)
export const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEF<>{}=+*';
export const GRID_DECAY = 2.2; // quanto maior, mais rápido uma letra acesa volta ao normal
export const BAND_BUF = 16; // linhas pré-desenhadas acima e abaixo da tela

// ---------- chuva ----------
export const AMBIENT = true; // chuva de fundo
export const MAX_STREAMS = 260;

// ---------- água ----------
export const WATER_HZ = 20; // passos da simulação por segundo (mais = ondas mais rápidas)
export const WATER_SUB = 2; // células de água por letra, em cada direção (1 = 18px, 2 = 9px, 3 = 6px): mais = rastro mais fino e mais pesado
export const WATER_DAMP = 0.985; // quanto a água segura o movimento (mais perto de 1 = ondas duram mais)
export const WATER_MARGIN = 12; // linhas simuladas além da tela
export const WATER_EDGE = 128; // células de letra perto das bordas que absorvem a onda (em vez de rebater)
export const MOUSE_DEPTH = 1.1; // quanto o cursor afunda a água embaixo dele
export const MOUSE_RADIUS = 0.5; // largura do "dedo" na água (em células de letra)
export const CLICK_FORCE = 5; // força do pingo do clique
export const CLICK_RADIUS = 4; // tamanho do pingo (em células de letra)
export const REFRACT = 12; // quanto a inclinação da água desloca as letras (px)
export const SHINE = 2.2; // quanto a inclinação da água acende as letras
export const CALM = 0.06; // inclinação mínima para a letra reagir (ondinhas menores são ignoradas)

// ---------- cursor ----------
export const HOVER_RADIUS = 12; // brilho parado em volta do cursor (px)
export const HOVER_GLOW = 1; // 0 a 1

// ---------- texto dos cards ----------
export const TEXT_DECAY = 2.4; // quanto maior, mais rápido o brilho do texto apaga
export const REVEAL_SPEED = 160; // caracteres por segundo no efeito "digitando"
export const ASCII_REVEAL_TIME = 0.5; // segundos para a arte ASCII se desenhar inteira, qualquer que seja o tamanho
// caixa padrão da arte ASCII, em caracteres: todas as artes usam a mesma escala e altura
// (menores ficam centralizadas). 80×40 fica quase quadrado no card; 60×30 tem letras maiores
export const ASCII_COLS = 80;
export const ASCII_ROWS = 40;
export const ASCII_MAX_WIDTH = 320; // px: a arte não estica além disso
export const ASCII_SIDE_MIN = 600; // px: card com pelo menos essa largura põe a arte à esquerda e o texto ao lado
export const ASCII_SIDE_GAP = 28; // px entre a arte e o texto nesse caso

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- tema (lido do CSS) ----------
const css = getComputedStyle(document.documentElement);
const cssVar = (name) => css.getPropertyValue(name).trim();
const rgbVar = (name) => cssVar(name).split(',').map(Number);

export const MONO = cssVar('--mono');
const neon = rgbVar('--neon-rgb');
const hot = rgbVar('--hot-rgb');

export const GRID_FONT = `500 14px ${MONO}`;
export const BG = cssVar('--bg');
export const NEON = `rgb(${neon})`;
export const HOT = `rgb(${hot})`;
// neon -> quase branco, para as letras mais acesas
export const HOT_COLORS = Array.from({ length: 16 }, (_, k) => {
  const u = k / 15;
  return `rgb(${neon.map((v, i) => Math.round(v + (hot[i] - v) * u))})`;
});
export const STYLES = {
  title: { font: `700 17px ${MONO}`, lh: 24, rest: cssVar('--text-title'), gap: 8 },
  desc: { font: `400 14px ${MONO}`, lh: 22, rest: cssVar('--text-desc'), gap: 10 },
  stack: { font: `500 12px ${MONO}`, lh: 18, rest: cssVar('--text-stack'), gap: 10 },
  // arte ASCII: a fonte diminui até a caixa ASCII_COLS × ASCII_ROWS caber no card (no máximo size)
  ascii: { font: `500 12px ${MONO}`, weight: 500, size: 12, lineHeight: 1.15, rest: cssVar('--text-ascii'), gap: 14 },
};
