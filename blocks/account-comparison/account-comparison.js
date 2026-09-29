import { getProduct } from '../../utils/products.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import {
  footnoteSup, stripRefs, refIds, resolveRefLinks,
} from '../../utils/footnotes.js';

const wrap = (html) => `<div>${html}</div>`;
const line = (...cells) => `<div>${cells.map(wrap).join('')}</div>`;

// a header row of product links becomes the tagline, product and offer rows
async function renderProductHeader(block) {
  const first = block.firstElementChild;
  const links = [...first.children].slice(1).map((c) => c.querySelector('a[href*="/products/"]'));
  if (!links.length || links.some((a) => !a || a.closest('div').textContent.trim() !== a.textContent.trim())) return;
  const [products, ph] = await Promise.all([Promise.all(links.map((a) => getProduct(a.getAttribute('href')))), fetchLocalPlaceholders()]);
  if (products.some((p) => !p)) return;
  const monthlyFee = (ph.monthlyFee || 'Monthly Fee').toLowerCase();
  const taglines = line('', ...products.map((p) => `<p>${p.tagline}</p>`));
  const cards = line('', ...products.map((p) => {
    const apply = p.applyUrl ? `<p class="button-wrapper"><a class="button primary" href="${p.applyUrl}">${ph.openNow || 'Open Now'}</a></p>` : '';
    return `<h3><a href="${p.productPage}">${p.name}</a></h3><p><strong>${p.fees[0]?.displayValue || ''}</strong> ${monthlyFee}${footnoteSup(p.fees[0]?.footnotes, p.productPage)}</p>${apply}`;
  }));
  const offers = line('', ...products.map((p) => {
    if (!p.offerBadge) return '';
    const href = p.offerDetailsUrl || p.productPage;
    // the badge is already a link, so the marker sits beside it rather than inside
    return `<p><a href="${href}" target="_blank" rel="noopener">${stripRefs(p.offerBadge).replace(/^\+\s*/, '')}</a>${footnoteSup(refIds(p.offerBadge), href)}</p>`;
  }));
  first.insertAdjacentHTML('beforebegin', taglines + cards + offers);
  first.remove();
  await resolveRefLinks(block);
}

export default async function decorate(block) {
  await renderProductHeader(block);
  const rows = [...block.children];
  const cols = Math.max(...rows.map((row) => row.children.length));
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  table.append(thead, tbody);

  const toggleGroup = (tr, open) => {
    let next = tr.nextElementSibling;
    while (next && !next.classList.contains('account-comparison-group')) {
      next.hidden = !open;
      next = next.nextElementSibling;
    }
  };

  let groups = 0;
  rows.forEach((row, i) => {
    const cells = [...row.children];
    const tr = document.createElement('tr');

    if (cells.length === 1) {
      groups += 1;
      tr.className = 'account-comparison-group';
      const th = document.createElement('th');
      th.colSpan = cols;
      th.scope = 'colgroup';
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-expanded', String(groups <= 2));
      button.append(...cells[0].childNodes);
      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        toggleGroup(tr, open);
      });
      th.append(button);
      tr.append(th);
      tbody.append(tr);
      return;
    }

    const header = i === 0;
    cells.forEach((cell, c) => {
      const el = document.createElement(header || c === 0 ? 'th' : 'td');
      el.scope = header ? 'col' : 'row';
      el.append(...cell.childNodes);
      if (!header && c > 0 && cells.length < cols) el.colSpan = cols - cells.length + 1;
      tr.append(el);
    });
    if (header) {
      tr.className = 'account-comparison-head';
      thead.append(tr);
    } else {
      if (!groups && tr.querySelector('a.button')) tr.className = 'account-comparison-products';
      tbody.append(tr);
    }
  });

  tbody.querySelectorAll('.account-comparison-group').forEach((tr) => {
    toggleGroup(tr, tr.querySelector('button').getAttribute('aria-expanded') === 'true');
  });

  block.replaceChildren(table);
}
