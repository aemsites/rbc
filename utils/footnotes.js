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
const REF = /\[\[([^\]]+)\]\]/g;
const splitIds = (value) => String(value || '').split(',').map((id) => id.trim()).filter(Boolean);

// a disclaimer's number differs per page (and per tab), so records name it by id and
// resolveRefLinks numbers it from the list the marker's own tab shows
export function footnoteSup(value, page) {
  const links = splitIds(value)
    .map((id) => `<a data-ref="${escape(id)}"${page ? ` data-page="${escape(page)}"` : ''}></a>`);
  return links.length ? `<sup>${links.join(',')}</sup>` : '';
}

// record text carries markers inline, e.g. "Debits[[debit-count]]: 1 per month"
export const expandRefs = (text, page) => String(text || '')
  .replace(REF, (_, ids) => footnoteSup(ids, page));
export const stripRefs = (text) => String(text || '').replace(REF, '').trim();
export const refIds = (text) => [...String(text || '').matchAll(REF)].map(([, ids]) => ids).join(',');

const tabsOf = (el) => (el.closest('[data-tab]')?.dataset.tab || '').split(',')
  .map((t) => t.trim()).filter(Boolean);

function localLabel(id, tabs) {
  const lists = [...document.querySelectorAll('.disclaimers')].filter((list) => {
    const own = tabsOf(list);
    return !tabs.length || !own.length || own.some((t) => tabs.includes(t));
  });
  const row = lists.map((list) => list.querySelector(`li[data-id="${CSS.escape(id)}"]`)
    || [...list.children].find((r) => r.children[2]?.textContent.trim() === id)).find(Boolean);
  if (!row) return '';
  return row.dataset.label || normalizeLabel(row.firstElementChild.textContent);
}

const remote = new Map();

function remoteLabels(page) {
  if (!remote.has(page)) {
    remote.set(page, fetch(`${page}.plain.html`)
      .then((resp) => (resp.ok ? resp.text() : ''))
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const rows = [...doc.querySelectorAll('.disclaimers > div')].filter((r) => r.children[2]);
        return new Map(rows.map((r) => [
          r.children[2].textContent.trim(), normalizeLabel(r.firstElementChild.textContent),
        ]));
      })
      .catch(() => new Map()));
  }
  return remote.get(page);
}

// numbers each placeholder from its tab's list; ids this page doesn't list link to the row
// on the record's own page, in a new tab, with that page's number
export async function resolveRefLinks(root) {
  const pending = [...root.querySelectorAll('a[data-ref]')];
  const sups = new Set(pending.map((a) => a.closest('sup')).filter(Boolean));
  await Promise.all(pending.map(async (a) => {
    const { ref: id, page } = a.dataset;
    const local = localLabel(id, tabsOf(a));
    if (local) {
      a.className = 'footnote';
      a.dataset.label = local;
      a.href = `#${legalId(local)}`;
      a.textContent = local;
    } else {
      const remoteLabel = page && !samePath(page, window.location.pathname)
        ? (await remoteLabels(page)).get(id) : '';
      if (!remoteLabel) {
        // eslint-disable-next-line no-console
        console.warn(`disclaimer "${id}" is not listed on ${page || 'this page'}`);
        a.remove();
        return;
      }
      a.href = `${page}#${legalId(remoteLabel)}`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = remoteLabel;
    }
    delete a.dataset.ref;
    delete a.dataset.page;
  }));
  sups.forEach((sup) => {
    const links = [...sup.querySelectorAll('a')];
    if (!links.length) sup.remove();
    else sup.replaceChildren(...links.flatMap((a, i) => (i ? [',', a] : [a])));
  });
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

function expandAuthoredRefs(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent.includes('[[') && !node.parentElement.closest('.disclaimers')) nodes.push(node);
  }
  nodes.forEach((node) => {
    const template = document.createElement('template');
    template.innerHTML = expandRefs(escape(node.textContent));
    node.replaceWith(template.content);
  });
  if (nodes.length) resolveRefLinks(root);
}

export default function linkFootnotes(root) {
  expandAuthoredRefs(root);
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
