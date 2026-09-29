const NAMES = {
  '*': 'asterisk',
  '**': 'double-asterisk',
  '***': 'triple-asterisk',
  '†': 'dagger',
  '††': 'double-dagger',
  '‡': 'ddagger',
  '~': 'tilde',
  '^': 'carat',
  '+': 'plus',
  '&': 'ampersand',
  '&&': 'double-ampersand',
  '®/™': 'trademark',
};

const LABELS = '.disclaimers > div > div:first-child, .disclaimers li[data-label]';

export const normalizeLabel = (text) => text.replace(/\s+/g, '').replace(/\)$/, '');

export function legalId(label, tab = 'default') {
  const name = NAMES[label] || label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return tab === 'default' ? `legal-${name}` : `legal-${tab}-${name}`;
}

const escape = (text) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const samePath = (a, b) => a.replace(/(\.html|\/)$/, '') === b.replace(/(\.html|\/)$/, '');

export function footnoteSup(value, page) {
  const labels = String(value || '').split(',').map(normalizeLabel).filter(Boolean);
  if (!labels.length) return '';
  const here = !page || samePath(page, window.location.pathname);
  const links = labels.map((label) => {
    const text = escape(label);
    return here
      ? `<a class="footnote" data-label="${text}" href="#${legalId(label)}">${text}</a>`
      : `<a href="${escape(page)}#${legalId(label)}" target="_blank" rel="noopener">${text}</a>`;
  });
  return `<sup>${links.join(',')}</sup>`;
}

const isNote = (sup) => sup.parentElement.tagName === 'P' && sup.parentElement.firstChild === sup;

function localNotes(cell) {
  if (!cell) return new Set();
  return new Set([...cell.querySelectorAll('p > sup:first-child')].filter(isNote)
    .map((sup) => normalizeLabel(sup.textContent)));
}

function linkSup(sup, labels, skip) {
  const tokens = sup.textContent.split(',').map(normalizeLabel);
  if (!tokens.some((t) => labels.has(t) && !skip.has(t))) return;
  const parts = tokens.map((token) => {
    if (!labels.has(token) || skip.has(token)) return token;
    const a = document.createElement('a');
    a.href = `#${legalId(token)}`;
    a.className = 'footnote';
    a.dataset.label = token;
    a.textContent = token;
    return a;
  });
  sup.replaceChildren(...parts.flatMap((p, i) => (i ? [',', p] : [p])));
}

function reveal(li) {
  li.closest('details').open = true;
  li.scrollIntoView({ behavior: 'smooth', block: 'center' });
  li.focus({ preventScroll: true });
  // lazy images above can load mid-scroll and push the row back out of view
  window.addEventListener('scrollend', () => {
    const { top, bottom } = li.getBoundingClientRect();
    if (top < 0 || bottom > window.innerHeight) li.scrollIntoView({ block: 'center' });
  }, { once: true });
}

// tabbed pages repeat labels per tab, so resolve against the rows the visitor can see
function visibleRow(label) {
  return [...document.querySelectorAll(`.disclaimers li[data-label="${CSS.escape(label)}"]`)]
    .find((li) => !li.closest('.tab-hidden'));
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('a.footnote');
  const li = link && visibleRow(link.dataset.label);
  if (!li) return;
  e.preventDefault();
  reveal(li);
});

export function revealLegalHash() {
  const { hash, search } = window.location;
  const legacy = new URLSearchParams(search).get('legal');
  const id = legacy ? `legal-${legacy}` : hash.slice(1);
  const li = id.startsWith('legal-') ? document.getElementById(id) : null;
  if (li?.closest('.disclaimers')) reveal(li);
}

function isOtherPageLegal(a) {
  const url = new URL(a.href, window.location);
  const legal = url.hash.startsWith('#legal-') || url.searchParams.has('legal');
  return legal && url.pathname !== window.location.pathname;
}

export default function linkFootnotes(root) {
  root.querySelectorAll('sup a[href], a[href]:has(> sup)').forEach((a) => {
    if (!isOtherPageLegal(a)) return;
    a.target = '_blank';
    a.rel = 'noopener';
  });

  const labels = new Set([...root.querySelectorAll(LABELS), ...document.querySelectorAll(LABELS)]
    .map((el) => el.dataset.label || normalizeLabel(el.textContent)));
  if (!labels.size) return;
  root.querySelectorAll('sup').forEach((sup) => {
    if (sup.closest('.disclaimers, a') || sup.querySelector('a') || isNote(sup)) return;
    linkSup(sup, labels, localNotes(sup.closest('.block > div > div, .default-content-wrapper')));
  });
}
