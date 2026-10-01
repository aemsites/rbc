// Live RBC page -> importer document: sections split by <hr>, blocks as tables, Metadata last.
// DOM APIs only, so it runs in helix-importer-ui (import.js) and the Node CLI (import.mjs).
// Mapping rules: ~/Documents/2026-09-30-rbc-import-mapping.md
import {
  INLINE, absolute, bgImage, cleanInline, iconName, img, isHidden, mergeFootnotes,
} from './inline.js';
import pageMetadata from './metadata.js';

const BLOCK_LEAF = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'DL']);
const SKIP = [
  '.nav-bar', '.modal', '.tab-ctrl', '.tabs-prev', '.tabs-next', '.glider-skip', '.carousel-button',
  '.close', '.disclaimer-btn', '.more-toggle', '.product-sticky-wrapper', '.sticky-wrapper',
  '.sticky-nav__custom', '.slideout', 'script', 'style', 'noscript', 'svg', 'footer',
].join(', ');

// live section class -> pilot background value
const BACKGROUNDS = {
  'bg-light-grey': '#f5f8f9',
  'bg-light-blue': '#f5f8f9',
  'bg-color-highlight': '#f5f8f9',
  'section-cool-white': '#f5f8f9',
  'section-light-grey': '#f5f8f9',
  'bg-color-2': '#fafafa',
  'section-grey': '#fafafa',
  'section-help': '#fafafa',
  'bg-gray': '#fafafa',
  'section-pale-blue': '#edf7fc',
  'bg-pale-blue-1': '#edf7fc',
  'bg-pale-blue-2': '#edf7fc',
  'blue-gradient-banner': 'linear-gradient(135deg, #003168 0%, #001a3d 100%)',
};

// identical on many pages: authored once as a fragment
const FRAGMENTS = [
  ['.advantage-block', 'newcomer-advantage'],
  ['.awards-recognition', 'awards'],
  ['.some-additional-help, .contact-us-actions-container', 'need-help'],
  ['.avion-partner-grid', 'avion-partners'],
];

// components waiting on a block issue
const TODOS = [
  ['.steps-container', 37, 'cards-numbered'],
  ['.start-bank-acc-container', 39, 'cards-band'],
  ['.card-details-offer-container', 43, 'credit-card'],
  ['.calc-widget-open-now, .value-program-result', 32, 'value-calculator'],
];

const GRID = '.col-wpr, .grid-wpr, .custom-container, .custom-grid, .custom-grid-wpr, .ways-to-apply-col, .promo-banner';

const colWidth = (el) => Number([...el.classList].map((c) => c.match(/^col-(\d+)$/)?.[1]).find(Boolean) || 0);
const RATIOS = [
  [[8, 4], '70-30'], [[7, 5], '70-30'], [[9, 3], '70-30'],
  [[4, 8], '33-66'], [[5, 7], '40-60'], [[3, 9], '20-80'], [[2, 10], '20-80'],
];

function block(doc, name, rows, sectionMeta) {
  const el = doc.createElement('table');
  const width = Math.max(1, ...rows.map((r) => r.length));
  const th = doc.createElement('th');
  th.colSpan = width;
  th.textContent = name;
  el.insertRow().append(th);
  rows.forEach((cells) => {
    const tr = el.insertRow();
    cells.forEach((cell) => {
      const td = tr.insertCell();
      [].concat(cell).forEach((n) => td.append(typeof n === 'string' ? doc.createTextNode(n) : n));
    });
  });
  // section metadata the block needs (layout, style) rides on the table until sections exist
  if (sectionMeta) el.dataset.sectionMeta = JSON.stringify(sectionMeta);
  return el;
}

const blockName = (name, variants = []) => (variants.length ? `${name} (${variants.join(', ')})` : name);

// blocks can't nest: a block inside another block's cell is reduced to its cell content
function flat(nodes) {
  return nodes.flatMap((n) => (n.tagName === 'TABLE'
    ? [...n.rows].slice(1).flatMap((tr) => [...tr.cells].flatMap((td) => flat([...td.childNodes])))
    : [n]));
}

function cleanClone(node, ctx) {
  const wrap = node.ownerDocument.createElement('div');
  wrap.append(node.cloneNode(true));
  cleanInline(wrap, ctx);
  return [...wrap.childNodes];
}

const hasText = (el) => el.tagName === 'IMG' || el.textContent.trim() || el.querySelector?.('img');
const visibleChildren = (el) => [...el.children].filter((c) => !isHidden(c) && !c.matches(SKIP));
const isButton = (el) => el.matches('a.btn')
  || (el.matches('strong, em') && el.children.length === 1 && el.firstElementChild.matches('a.btn'));

let RULES;

export function content(el, ctx) {
  const doc = el.ownerDocument;
  const out = [];
  let run = null;
  const flush = () => {
    if (run) mergeFootnotes(run);
    if (run && run.childNodes.length === 1 && run.firstChild.tagName === 'IMG') out.push(run.firstChild);
    else if (run && hasText(run)) out.push(run);
    run = null;
  };
  el.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      if (node.textContent.trim()) {
        run ??= doc.createElement('p');
        run.append(node.textContent.replace(/\s+/g, ' '));
      } else if (run) run.append(' ');
      return;
    }
    if (node.nodeType !== 1 || isHidden(node) || node.matches(SKIP)) return;
    const rule = RULES.find((r) => r.match(node, ctx));
    if (rule) {
      flush();
      out.push(...[].concat(rule.build(node, ctx) || []));
      return;
    }
    if (isButton(node)) {
      flush();
      const p = doc.createElement('p');
      p.append(...cleanClone(node, ctx));
      out.push(p);
      return;
    }
    if (node.tagName === 'BR') {
      if (run) run.append(doc.createElement('br'));
      return;
    }
    if (INLINE.has(node.tagName) && !node.querySelector('p, div, ul, ol, h1, h2, h3, h4, h5, h6, table')) {
      run ??= doc.createElement('p');
      run.append(...cleanClone(node, ctx));
      return;
    }
    if (BLOCK_LEAF.has(node.tagName)) {
      flush();
      const [leaf] = cleanClone(node, ctx);
      if (!leaf || leaf.nodeType !== 1) return;
      if (/^H\d$/.test(leaf.tagName)) leaf.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
      if (hasText(leaf)) out.push(leaf);
      return;
    }
    flush();
    out.push(...content(node, ctx));
  });
  flush();
  out.forEach((n) => { if (n.tagName === 'P') n.innerHTML = n.innerHTML.trim(); });
  return out.filter((n) => n.nodeType !== 1 || n.tagName === 'TABLE' || n.tagName === 'HR' || hasText(n));
}

const visibleImages = (el) => (el.tagName === 'IMG' ? [el] : [...el.querySelectorAll('img')])
  .filter((i) => !i.closest('.mobile-only') && !isHidden(i));
const srcOf = (i) => i.getAttribute('src') || i.getAttribute('data-src') || '';
const isIcon = (i) => i.matches('.icon, [class*="icon-"]') || /\.svg$/i.test(srcOf(i)) || !!iconName(srcOf(i));

// photos beat SVG icons; banners keep their photo as a CSS background
function imageOf(el, { bgFirst = false } = {}) {
  const doc = el.ownerDocument;
  const bg = bgImage(el);
  if (bgFirst && bg) return img(doc, bg);
  const photo = visibleImages(el).find((i) => !isIcon(i));
  if (photo) return img(doc, srcOf(photo), photo.getAttribute('alt') || '');
  return bg ? img(doc, bg) : null;
}

// what a grid item is: a lone photo, an icon with copy, a photo with copy, or copy
function kind(item) {
  const imgs = visibleImages(item);
  const text = item.textContent.trim();
  const photo = imgs.find((i) => !isIcon(i)) || (bgImage(item) && !text ? item : null);
  if (photo && !text) return 'photo-only';
  if (photo) return 'photo';
  if (imgs.length) return 'icon';
  return 'text';
}

function withoutImage(item, image) {
  const clone = item.cloneNode(true);
  if (image) {
    clone.querySelectorAll('img').forEach((i) => { if (absolute(srcOf(i)) === image.src) i.remove(); });
  }
  return clone;
}

// the icon goes in its own cell: :name: when it's a DA icon, else the live SVG
function iconCell(item) {
  const icon = visibleImages(item)[0];
  if (!icon) return null;
  const name = iconName(srcOf(icon));
  if (!name) return img(item.ownerDocument, srcOf(icon), icon.getAttribute('alt') || '');
  const p = item.ownerDocument.createElement('p');
  p.textContent = `:${name}:`;
  return p;
}

function cards(items, ctx, variants = []) {
  const icons = variants.includes('icons');
  const rows = items.map((item) => {
    const icon = icons ? visibleImages(item)[0] : null;
    const image = icons ? null : imageOf(item);
    const clone = icon ? item.cloneNode(true) : withoutImage(item, image);
    if (icon) clone.querySelector(`img[src="${srcOf(icon)}"]`)?.remove();
    const body = flat(content(clone, ctx));
    const media = icons ? iconCell(item) : image;
    return media ? [media, body] : [body];
  }).filter((r) => r.flat().length);
  return block(items[0].ownerDocument, blockName('Cards', variants), rows);
}

function accordionRows(el, ctx) {
  const panels = [...el.querySelectorAll('.accordion-panel')].filter((p) => !p.parentElement.closest('.accordion-panel'));
  return panels.map((panel) => {
    const q = panel.querySelector('.collapse-toggle, [data-toggle="collapse"], button');
    const a = panel.querySelector('.collapse-inner, .collapse-content, .collapse');
    return [q ? q.textContent.trim().replace(/\s+/g, ' ') : '', a ? flat(content(a, ctx)) : []];
  });
}

const accordion = (el, ctx, sectionMeta) => block(el.ownerDocument, 'Accordion', accordionRows(el, ctx), sectionMeta);

// a grid with accordions in it: copy first, then one accordion with every panel
function faq(el, items, ctx) {
  const intro = items.filter((i) => !i.querySelector('.accordion-panel'));
  const nodes = intro.flatMap((i) => flat(content(i, ctx)));
  const headingBeside = intro.length && items.length === 2;
  return [...nodes, accordion(el, ctx, headingBeside ? { layout: '33-66' } : null)];
}

function columns(items, ctx, variants = []) {
  const cells = items.map((c) => (kind(c) === 'photo-only'
    ? [imageOf(c, { bgFirst: true })].filter(Boolean)
    : content(c, ctx))).filter((c) => c.length);
  // a cell holding a block reads better as a run of content than as columns
  if (cells.length < 2 || cells.some((c) => c.some((n) => n.tagName === 'TABLE'))) return cells.flat();
  const widths = items.filter(hasText).map(colWidth);
  const [a, b] = widths;
  const ratio = cells.length === 2 && RATIOS.find(([[x, y]]) => x === a && y === b)?.[1];
  return block(items[0].ownerDocument, blockName('Columns', [ratio, ...variants].filter(Boolean)), [cells]);
}

// copy | photo as the page's first section: hero split or columns (--intro option)
function twoCell(items, ctx) {
  if (!ctx.intro) return columns(items, ctx);
  ctx.intro = false;
  if (ctx.options.intro === 'columns') return columns(items, ctx);
  const cells = items.map((i) => (kind(i) === 'photo-only' ? [imageOf(i, { bgFirst: true })].filter(Boolean) : flat(content(i, ctx))));
  return block(items[0].ownerDocument, 'Hero', [cells]);
}

function grid(el, ctx) {
  const items = visibleChildren(el).filter(hasText);
  if (items.length < 2) return content(el, ctx);
  if (items.some((i) => i.querySelector('.accordion-panel'))) return faq(el, items, ctx);
  const kinds = items.map(kind);
  if (items.length === 2 && kinds.includes('photo-only')) return twoCell(items, ctx);
  // cards are siblings of the same shape (all or none led by a heading); anything else is columns
  const headed = items.filter((i) => i.querySelector('h2, h3, h4, h5, h6')).length;
  const sameShape = headed === 0 || headed === items.length;
  if (!sameShape) return columns(items, ctx);
  if (kinds.every((k) => k === 'icon')) return cards(items, ctx, ['icons']);
  if (kinds.every((k) => k === 'photo')) return cards(items, ctx);
  if (items.every((i) => i.matches('.block-wpr, .callout') || i.querySelector(':scope > .block-wpr, :scope > .callout'))) {
    return cards(items, ctx);
  }
  return columns(items, ctx);
}

function todo(el, ctx, issue, name) {
  ctx.report.todos.push(`${issue} ${name}`);
  const rows = visibleChildren(el).map((c) => [flat(content(c, ctx))]).filter(([c]) => c.length);
  return block(el.ownerDocument, blockName('TODO', [String(issue), name]), rows.length ? rows : [[flat(content(el, ctx))]]);
}

function fragment(el, ctx, name) {
  const doc = el.ownerDocument;
  if (!ctx.fragments.some((f) => f.name === name)) {
    const main = doc.createElement('main');
    main.append(...content(el, { ...ctx, intro: false }));
    ctx.fragments.push({ name, path: `/fragments/${name}`, element: main });
  }
  const a = doc.createElement('a');
  a.href = `/fragments/${name}`;
  a.textContent = `/fragments/${name}`;
  return block(doc, 'Fragment', [[a]]);
}

function table(el, ctx) {
  const doc = el.ownerDocument;
  const trs = [...el.querySelectorAll('tr')].filter((tr) => tr.closest('table') === el);
  const header = trs[0]?.querySelector('th') && !trs[0].querySelector('td');
  const rows = trs.map((tr) => [...tr.children].map((cell) => {
    const out = flat(content(cell, ctx));
    return out.length ? out : [doc.createTextNode('')];
  }));
  return block(doc, blockName('Table', header ? ['striped'] : ['striped', 'no-header', 'bordered']), rows);
}

function carousel(el, ctx, itemSelector, variants = []) {
  const items = [...el.querySelectorAll(itemSelector)].filter((i) => !i.closest('.mobile-only'));
  if (!items.length) return content(el, ctx);
  return block(el.ownerDocument, blockName('Carousel', variants), items.map((item) => {
    const image = imageOf(item);
    const body = flat(content(withoutImage(item, image), ctx));
    return image ? [image, body] : [body];
  }));
}

// each pane becomes its own section, tied to its tab with section-metadata "tab"
function tabs(el, ctx) {
  const doc = el.ownerDocument;
  const labels = [...el.querySelectorAll('.tab-nav a, .tab-nav button, .tab-nav [role="tab"]')];
  const panes = [...el.querySelectorAll('.tab-pane')];
  const ids = panes.map((p, i) => (p.id || `tab-${i + 1}`).toLowerCase());
  const intro = el.cloneNode(true);
  intro.querySelectorAll('.tab-nav, .tab-content, .tab-pane, .tab-ctrl').forEach((n) => n.remove());
  const out = [...content(intro, ctx)];
  out.push(block(doc, blockName('Tabs', ['sections']), panes.map((p, i) => {
    const a = doc.createElement('a');
    a.href = `#${ids[i]}`;
    a.textContent = labels[i]?.textContent.trim().replace(/\s+/g, ' ') || ids[i];
    return [a, i === 0 ? `${ids[i]}, default` : ids[i]];
  })));
  panes.forEach((pane, i) => {
    const hr = doc.createElement('hr');
    // the first pane also shows before any tab is picked
    hr.dataset.tab = i === 0 ? `${ids[i]}, default` : ids[i];
    out.push(hr, ...content(pane, ctx));
  });
  return out;
}

function videoLinks(el) {
  return [...el.querySelectorAll('video source[src], video[src]')].map((v) => {
    const p = el.ownerDocument.createElement('p');
    const a = el.ownerDocument.createElement('a');
    a.href = absolute(v.getAttribute('src'));
    a.textContent = a.href;
    p.append(a);
    return p;
  });
}

function banner(section, ctx) {
  ctx.intro = false;
  const doc = section.ownerDocument;
  if (section.matches('.html-bnr')) {
    const image = imageOf(section, { bgFirst: true });
    const copy = section.querySelector('.banner-text') || section;
    const body = flat(content(withoutImage(copy, image), ctx));
    return block(doc, blockName('Columns', ['shadow']), [image ? [image, body] : [body]]);
  }
  let image = imageOf(section, { bgFirst: true });
  const og = doc.head?.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (!image && og) image = img(doc, og);
  if (!image) ctx.report.notes.push('hero image not found');
  const clone = withoutImage(section, image);
  clone.querySelectorAll('.bnr-mobile-img, .banner-img-mobile, .banner-img').forEach((n) => n.remove());
  const body = [...flat(content(clone, ctx)), ...videoLinks(section)];
  const dark = section.querySelector('.text-white, .white-text') && !section.matches('.white-gradient');
  if (dark && image) return block(doc, blockName('Hero', ['background']), [[image, body]]);
  return block(doc, 'Hero', [[[image, ...body].filter(Boolean)]]);
}

function disclaimers(section, ctx) {
  const rows = [...section.querySelectorAll('.table-row')].map((row) => {
    const [key, text] = [...row.querySelectorAll(':scope > .table-cell')];
    const label = key?.cloneNode(true);
    label?.querySelectorAll('.offscreen, .sr-only').forEach((n) => n.remove());
    return [label?.textContent.trim().replace(/\)$/, '') || '', text ? flat(content(text, ctx)) : []];
  }).filter(([, t]) => t.length);
  if (!rows.length) return content(section, ctx);
  return block(section.ownerDocument, 'Disclaimers', rows);
}

function offer(el, ctx) {
  const cols = el.querySelector('.col-wpr');
  const items = cols ? visibleChildren(cols).filter(hasText) : [];
  if (items.length < 2) return content(el, ctx);
  const cells = items.map((i) => (kind(i) === 'photo-only' ? [imageOf(i)].filter(Boolean) : flat(content(i, ctx))));
  return block(el.ownerDocument, blockName('Columns', ['70-30', 'shadow']), [cells], { style: 'overlap' });
}

RULES = [
  ...TODOS.map(([sel, issue, name]) => ({
    // inside an offer card the same class is just an "Offer" caption box
    match: (el) => el.matches(sel) && !el.closest('.special-offer-container'),
    build: (el, ctx) => todo(el, ctx, issue, name),
  })),
  ...FRAGMENTS.map(([sel, name]) => ({
    match: (el) => el.matches(sel),
    build: (el, ctx) => fragment(el, ctx, name),
  })),
  { match: (el) => el.tagName === 'TABLE', build: table },
  { match: (el) => el.matches('.section-tabs, .tabs-wpr'), build: tabs },
  { match: (el) => el.matches('.accordion'), build: (el, ctx) => accordion(el, ctx) },
  { match: (el) => el.matches('.vantage-carousel'), build: (el, ctx) => carousel(el, ctx, '.vantage-carousel-item', ['vantage']) },
  { match: (el) => el.matches('.glider-wpr'), build: (el, ctx) => (el.closest('[class*="-mobile"]') ? [] : carousel(el, ctx, '.glider-item')) },
  { match: (el) => el.matches('.carousel-wpr'), build: (el, ctx) => carousel(el, ctx, '.carousel-item') },
  { match: (el) => el.matches('.special-offer-container'), build: offer },
  {
    // the live promo banner is a light grey rounded panel
    match: (el) => el.matches('.promo-banner'),
    build: (el, ctx) => [].concat(grid(el, ctx)).map((n) => {
      if (n.tagName === 'TABLE') n.dataset.sectionMeta = JSON.stringify({ background: '#f5f8f9' });
      return n;
    }),
  },
  { match: (el) => el.matches(GRID), build: grid },
  {
    match: (el) => visibleChildren(el).filter((c) => c.matches('.block-wpr, .callout')).length >= 2,
    build: (el, ctx) => cards(visibleChildren(el).filter((c) => c.matches('.block-wpr, .callout')), ctx),
  },
  { match: (el) => el.matches('.callout'), build: (el, ctx) => cards([el], ctx) },
  { match: (el) => el.tagName === 'VIDEO' || el.tagName === 'IFRAME', build: (el) => videoLinks(el.parentElement).slice(0, 1) },
];

const SECTION_RULES = [
  { match: (s) => s.matches('.banner, .lifestyle-banner, .banner-400, .foreign-ca-banner'), build: banner },
  { match: (s) => s.matches('.disclaimer'), build: disclaimers },
];

function sectionMetadata(doc, meta) {
  const rows = Object.entries(meta).filter(([, v]) => v);
  return rows.length ? block(doc, 'Section Metadata', rows) : null;
}

// live grids are often split into rows of 2: back-to-back blocks of the same kind become one block
function mergeAdjacent(nodes) {
  return nodes.reduce((out, n) => {
    const prev = out.at(-1);
    const name = (t) => t?.tagName === 'TABLE' && t.rows[0].textContent.trim();
    if (name(n) && name(n) === name(prev) && !/^(Fragment|TODO)/.test(name(n))) {
      [...n.rows].slice(1).forEach((tr) => prev.tBodies[0].append(tr));
      return out;
    }
    out.push(n);
    return out;
  }, []);
}

// one EDS section per heading-led group: a heading after a block starts a new section
// (taking its eyebrow with it)
function groups(nodes) {
  const out = [[]];
  let hasBlock = false;
  nodes.forEach((n) => {
    if (/^H[1-3]$/.test(n.tagName) && hasBlock) {
      const current = out.at(-1);
      const prev = current.at(-1);
      const eyebrow = prev?.tagName === 'P' && prev.textContent.trim().length < 40 && !prev.querySelector('a') ? current.pop() : null;
      out.push(eyebrow ? [eyebrow] : []);
      hasBlock = false;
    }
    out.at(-1).push(n);
    if (n.tagName === 'TABLE') hasBlock = true;
  });
  return out.filter((g) => g.length);
}

function modals(document, ctx) {
  return [...document.querySelectorAll('div.modal[id]')].map((modal) => {
    const main = modal.ownerDocument.createElement('main');
    main.append(...content(modal.querySelector('.modal-inner') || modal, { ...ctx, intro: false }));
    return { element: main, path: `/modals/${modal.id.replace(/^modal-/, '')}` };
  });
}

export default function transform(document, { url, options = {} }) {
  const doc = document;
  const ctx = {
    url,
    options,
    intro: true,
    fragments: [],
    report: {
      todos: [], tooltips: 0, modalLinks: 0, notes: [],
    },
  };
  const live = doc.querySelector('main') || doc.body;
  const main = doc.createElement('main');
  const sections = [];

  // the live page title sits in the sticky nav bar; pilot pages open with it as a lone H1 section
  const h1 = live.querySelector('.nav-bar h1, section.page-title h1');
  if (h1) sections.push([cleanClone(h1, ctx)[0]]);

  [...live.children].filter((s) => !s.matches(SKIP) && !isHidden(s) && !s.matches('section.page-title')).forEach((section) => {
    const background = [...section.classList].map((c) => BACKGROUNDS[c]).find(Boolean);
    const rule = SECTION_RULES.find((r) => r.match(section))
      || RULES.find((r) => r.match(section, ctx));
    const nodes = [].concat(rule ? rule.build(section, ctx) : content(section, ctx));
    if (nodes.length) ctx.intro = false;

    // tab markers start pane sections; everything else splits into heading-led groups
    const parts = [{ nodes: [], meta: {} }];
    nodes.forEach((n) => {
      if (n.tagName === 'HR' && n.dataset.tab) parts.push({ nodes: [], meta: { tab: n.dataset.tab } });
      else parts.at(-1).nodes.push(n);
    });
    parts.forEach(({ nodes: part, meta }) => {
      (meta.tab ? [mergeAdjacent(part)] : groups(mergeAdjacent(part))).forEach((group) => {
        if (!group.length) return;
        const groupMeta = { ...meta };
        if (background) groupMeta.background = background;
        group.forEach((n) => {
          if (n.dataset?.sectionMeta) {
            Object.assign(groupMeta, JSON.parse(n.dataset.sectionMeta));
            delete n.dataset.sectionMeta;
          }
        });
        const sm = sectionMetadata(doc, groupMeta);
        sections.push(sm ? [...group, sm] : group);
      });
    });
  });

  sections.forEach((nodes, i) => {
    if (i) main.append(doc.createElement('hr'));
    nodes.forEach((n) => main.append(n));
  });

  const meta = pageMetadata(doc, url, ctx.report.notes);
  main.append(block(doc, 'Metadata', Object.entries(meta)));
  return {
    main, meta, modals: modals(doc, ctx), fragments: ctx.fragments, report: ctx.report,
  };
}
