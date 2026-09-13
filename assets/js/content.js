// Monta as seções e os cards da página a partir de um arquivo de texto
// (<main data-content="content/arquivo.txt">). O formato está explicado no topo
// de cada arquivo em content/.

// campos que um card aceita; text e ascii podem ocupar várias linhas
const FIELD = /^(title|text|stack|stat|link|ascii|wide)\s*=\s?(.*)$/;
const HEADER = /^\[(section|card)\]\s*(.*)$/;

export function parseContent(src) {
  const sections = [];
  let section = null;
  let card = null;
  let open = null; // campo de várias linhas em andamento: { key, lines }

  const newSection = (title) => {
    section = { title, wide: false, cards: [] };
    sections.push(section);
    card = null;
  };

  const close = () => {
    if (!open) return;
    const { key, lines } = open;
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    while (lines.length && !lines[0].trim()) lines.shift();
    if (key === 'ascii') {
      card.ascii = lines.join('\n');
    } else {
      // linha vazia separa parágrafos
      card.text = lines.join('\n').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    }
    open = null;
  };

  for (const raw of src.replace(/\r\n?/g, '\n').split('\n')) {
    const header = raw.match(HEADER);
    const field = raw.match(FIELD);
    if (open && !header && !field) {
      open.lines.push(raw.replace(/\s+$/, ''));
      continue;
    }
    close();

    if (header) {
      if (header[1] === 'section') {
        newSection(header[2].trim());
      } else {
        if (!section) newSection('');
        card = { title: '', text: [], stack: '', ascii: '', stats: [], links: [] };
        section.cards.push(card);
      }
      continue;
    }
    if (!field) continue; // linha vazia ou comentário (#)

    const key = field[1];
    const value = field[2].trim();
    if (key === 'wide') {
      if (section) section.wide = /^(sim|true|1)$/i.test(value);
    } else if (!card) {
      continue;
    } else if ((key === 'text' || key === 'ascii') && !value) {
      open = { key, lines: [] };
    } else if (key === 'text') {
      card.text = [value];
    } else if (key === 'link') {
      const [label, url] = value.split('|').map((s) => s.trim());
      if (url) card.links.push({ label, url });
    } else if (key === 'stat') {
      card.stats = value.split('|').map((s) => s.trim()).filter(Boolean);
    } else {
      card[key] = value; // title, stack, ascii de uma linha
    }
  }
  close();
  return sections;
}

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

// "**5 mil+** downloads" -> <b>5 mil+</b> downloads
const withBold = (text) => text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 ? el('b', {}, part) : part));

function renderCard(c) {
  const txt = el('div', { class: 'txt' });
  if (c.ascii) txt.append(el('pre', { class: 'ascii', role: 'img', 'aria-label': `arte ASCII: ${c.title}` }, c.ascii));
  if (c.title) txt.append(el('h3', {}, c.title));
  for (const p of c.text) txt.append(el('p', {}, p));
  if (c.stack) txt.append(el('p', { class: 'stack' }, c.stack));

  const card = el('article', { class: 'card' }, txt);
  if (c.stats.length) card.append(el('div', { class: 'stat' }, ...c.stats.map((s) => el('span', {}, ...withBold(s)))));
  if (c.links.length) card.append(el('div', { class: 'links' }, ...c.links.map((l) => el('a', { href: l.url }, l.label))));
  return card;
}

export function renderContent(main, sections) {
  // seção sem nenhum card não aparece (ex.: todos os cards dela foram removidos)
  main.replaceChildren(...sections.filter((s) => s.cards.length).map((s) => {
    const section = el('section', {});
    if (s.title) section.append(el('h2', {}, s.title));
    section.append(el('div', { class: s.wide ? 'grid wide' : 'grid' }, ...s.cards.map(renderCard)));
    return section;
  }));
}

export async function loadContent() {
  const main = document.querySelector('main[data-content]');
  if (!main) return;
  try {
    const res = await fetch(main.dataset.content);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderContent(main, parseContent(await res.text()));
  } catch (err) {
    console.warn('conteúdo não carregou', err);
    main.append(el('p', { class: 'content-error' }, 'Não foi possível carregar os projetos. Veja em github.com/luk4w.'));
  }
}
