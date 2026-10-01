// Imports live RBC pages into DA HTML under content/, keeping each page's existing metadata.
//   node tools/importer/import.mjs <live URL | DA path>...   import specific pages
//   node tools/importer/import.mjs --remaining               every in-scope EN page except protected ones
// Options: --force (overwrite protected pages and existing modals), --metadata-only (only fill metadata gaps),
//          --refresh (refetch live HTML), --out <dir> (write somewhere other than content/),
//          --intro hero|columns (how a copy | photo first section is authored; default hero)
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import PAGES from './pages.js';
import transform from './transform.js';
import daPath from './paths.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const OUT = option('out') || new URL('../../content', import.meta.url).pathname;
const CACHE = '/tmp/rbc-import-cache';

// hand-built pages (the pilot) and pages being built by hand, plus their translations
const PROTECTED_EN = [
  '/bank-accounts', '/bank-accounts/chequing-accounts', '/bank-accounts/savings-accounts',
  '/bank-accounts/new-bank-accounts-offers-canada', '/bank-accounts/chequing-accounts/compare-chequing-accounts',
  '/bank-accounts/chequing-accounts/signature-no-limit-banking', '/bank-accounts/chequing-accounts/day-to-day-banking',
  '/bank-accounts/chequing-accounts/find-chequing-account', '/bank-accounts/savings-accounts/high-interest-savings-account',
  '/bank-accounts/savings-accounts/savings-interest-calculator', '/new-to-canada', '/new-to-canada/financial-advisors',
  '/new-to-canada/glossary-financial-terms', '/bank-accounts/savings-accounts/compare-savings-accounts',
  '/bank-accounts/youth-student-banking/budget-calculator',
];
const protectedGroups = new Set(PAGES.filter((p) => PROTECTED_EN.includes(p.path)).map((p) => p.group));
const isProtected = (page) => protectedGroups.has(page.group);

function resolve(arg) {
  const path = arg.startsWith('http') ? daPath(arg) : arg.replace(/\/$/, '') || '/';
  return PAGES.find((p) => p.path === path) || (arg.startsWith('http') ? { url: arg, path, lang: 'EN' } : null);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const toClass = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const picture = (src, alt = '') => `<picture><source srcset="${src}"><source srcset="${src}" media="(min-width: 600px)"><img src="${src}" alt="${esc(alt)}" loading="lazy"></picture>`;

function html(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll?.('img').forEach((i) => {
    const t = clone.ownerDocument.createElement('template');
    t.innerHTML = picture(i.getAttribute('src'), i.getAttribute('alt') || '');
    i.replaceWith(t.content);
  });
  if (clone.nodeType === 3) return esc(clone.textContent);
  return clone.tagName === 'IMG' ? picture(node.getAttribute('src'), node.getAttribute('alt') || '') : clone.outerHTML;
}

// cell content: block-level children as-is, inline runs wrapped in <p>
function cellHtml(td) {
  let out = '';
  let run = '';
  const flush = () => { if (run.trim()) out += `<p>${run.trim()}</p>`; run = ''; };
  td.childNodes.forEach((n) => {
    if (n.nodeType === 1 && /^(P|H\d|UL|OL|TABLE|BLOCKQUOTE|PRE|DIV|IMG)$/.test(n.tagName)) { flush(); out += html(n); } else run += html(n);
  });
  flush();
  return out;
}

function tableToDiv(table) {
  const [head, ...rows] = [...table.rows];
  const name = head.textContent.trim();
  const [, base, variants = ''] = name.match(/^([^(]+?)\s*(?:\(([^)]*)\))?$/);
  const cls = [toClass(base), ...variants.split(',').map((v) => toClass(v.trim())).filter(Boolean)].join(' ');
  return `<div class="${cls}">${rows.map((tr) => `<div>${[...tr.cells].map((td) => `<div>${cellHtml(td)}</div>`).join('')}</div>`).join('')}</div>`;
}

function toDA(main) {
  const sections = [[]];
  [...main.childNodes].forEach((n) => {
    if (n.nodeName === 'HR') sections.push([]);
    else if (n.nodeName === 'TABLE') sections.at(-1).push(tableToDiv(n));
    else if (n.nodeType === 1) sections.at(-1).push(html(n));
  });
  return sections.filter((s) => s.length).map((s) => `<div>${s.join('')}</div>`).join('');
}

const wrap = (body) => `\n<body>\n  <header></header>\n  <main>${body}</main>\n  <footer></footer>\n</body>\n`;

function metadataRows(doc) {
  const blockEl = doc.querySelector('main .metadata');
  return new Map(blockEl ? [...blockEl.children].map((r) => [r.children[0]?.textContent.trim().toLowerCase(), r.children[1]?.innerHTML.trim() || '']) : []);
}

const ldItems = (value) => { try { return [].concat(JSON.parse(value)); } catch { return []; } };

// existing rows win; live fills gaps; live JSON-LD types the page doesn't have yet are added (#17)
function mergeMetadata(existing, live) {
  const merged = new Map(existing);
  const added = [];
  Object.entries(live).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    const cell = value.getAttribute ? picture(value.getAttribute('src')) : `<p>${esc(String(value))}</p>`;
    if (key === 'json-ld' && merged.has(key)) {
      const current = ldItems(new JSDOM(merged.get(key)).window.document.body.textContent);
      const types = new Set(current.map((d) => d['@type']));
      const extra = ldItems(value).filter((d) => !types.has(d['@type']));
      if (!extra.length || !current.length) return;
      const all = [...current, ...extra];
      merged.set(key, `<p>${esc(JSON.stringify(all))}</p>`);
      added.push(`json-ld +${extra.map((d) => d['@type']).join('+')}`);
      return;
    }
    if (!merged.has(key)) { merged.set(key, cell); added.push(key); }
  });
  const bare = merged.get('image')?.match(/^<img[^>]*src="([^"]+)"[^>]*>$/);
  if (bare) { merged.set('image', picture(bare[1])); added.push('image as <picture>'); }
  return { merged, added };
}

const metadataBlock = (rows) => `<div class="metadata">${[...rows].map(([k, v]) => `<div><div><p>${k}</p></div><div>${v}</div></div>`).join('')}</div>`;

async function fetchLive(url) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${toClass(new URL(url).pathname) || 'home'}.html`);
  if (!flag('refresh') && existsSync(file)) return readFileSync(file, 'utf8');
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) rbc-eds-import' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  writeFileSync(file, text);
  return text;
}

const words = (t) => new Set(t.toLowerCase().match(/[a-z]{4,}/g) || []);
// textContent glues adjacent elements ("Features</h2><p>Earn" -> "FeaturesEarn"), so join text nodes
const textOf = (node) => {
  const walker = node.ownerDocument.createTreeWalker(node, 4);
  const parts = [];
  while (walker.nextNode()) parts.push(walker.currentNode.textContent);
  return parts.join(' ');
};

// share of the live page's words found in the page plus the modals/fragments it links to
function coverage(liveDoc, out) {
  const live = liveDoc.querySelector('main')?.cloneNode(true);
  if (!live) return null;
  live.querySelectorAll('script, style, noscript, .nav-bar, .offscreen, .sr-only, .mobile-only').forEach((n) => n.remove());
  const a = words(textOf(live));
  const linked = [...out.matchAll(/href="(\/(?:modals|fragments)\/[^"#]+)"/g)]
    .map(([, p]) => join(OUT, `${p}.html`)).filter(existsSync).map((f) => readFileSync(f, 'utf8'));
  const b = words([out, ...linked].map((h) => textOf(new JSDOM(h).window.document.body)).join(' '));
  return Math.round(([...a].filter((w) => b.has(w)).length / (a.size || 1)) * 100);
}

async function importPage(page) {
  const file = join(OUT, `${page.path === '/' ? 'index' : page.path}.html`);
  const existing = existsSync(file) ? new JSDOM(readFileSync(file, 'utf8')).window.document : null;
  const liveHtml = await fetchLive(page.url);
  const { document } = new JSDOM(liveHtml, { url: page.url, virtualConsole: new VirtualConsole() }).window;
  const liveCoverageDoc = new JSDOM(liveHtml, { virtualConsole: new VirtualConsole() }).window.document;
  if (document.querySelector('.wp-block-rbc-single-article-header') && !flag('force')) {
    return `${page.path}: article page, skipped until #35`;
  }
  const {
    main, meta, modals, fragments, report,
  } = transform(document, { url: page.url, options: { intro: option('intro') || 'hero' } });
  const { merged, added } = mergeMetadata(existing ? metadataRows(existing) : new Map(), meta);

  let body;
  if (flag('metadata-only')) {
    if (!existing) return `${page.path}: no existing page`;
    const mainEl = existing.querySelector('main');
    mainEl.querySelector('.metadata')?.remove();
    const last = mainEl.lastElementChild || mainEl.appendChild(existing.createElement('div'));
    last.insertAdjacentHTML('beforeend', metadataBlock(merged));
    body = mainEl.innerHTML;
  } else {
    main.lastElementChild.remove();
    body = toDA(main).replace(/<\/div>$/, `${metadataBlock(merged)}</div>`);
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, wrap(body));

  const modalNotes = flag('metadata-only') ? [] : [...modals, ...fragments].map(({ element, path }) => {
    const modalFile = join(OUT, `${path}.html`);
    if (existsSync(modalFile) && !flag('force')) return `${path} exists, kept`;
    mkdirSync(dirname(modalFile), { recursive: true });
    writeFileSync(modalFile, wrap(toDA(element)));
    return `${path} written`;
  });
  const cov = flag('metadata-only') ? null : coverage(liveCoverageDoc, body);
  return [
    `${page.path}${cov !== null ? `  text coverage ${cov}%` : ''}`,
    added.length && `  metadata added: ${added.join(', ')}`,
    report.todos.length && `  TODO blocks: ${report.todos.join(', ')}`,
    report.tooltips && `  tooltips dropped (#31): ${report.tooltips}`,
    modalNotes.length && `  modals/fragments: ${modalNotes.join(', ')}`,
    report.notes.length && `  notes: ${report.notes.join(', ')}`,
  ].filter(Boolean).join('\n');
}

const targets = flag('remaining')
  ? PAGES.filter((p) => p.lang === 'EN' && !p.outOfScope)
  : args.filter((a, i) => !a.startsWith('--') && !['--out', '--intro'].includes(args[i - 1])).map((a) => resolve(a) || a);

for (const page of targets) {
  if (typeof page === 'string') { console.log(`${page}: not in pages.json`); continue; }
  if (isProtected(page) && !flag('force') && !flag('metadata-only')) { console.log(`${page.path}: protected, skipped (--force to overwrite)`); continue; }
  try {
    console.log(await importPage(page));
  } catch (e) {
    console.log(`${page.path}: FAILED ${e.message}`);
    if (flag('debug')) console.log(e.stack);
  }
}
