import { getProduct, offerLegalPage } from '../../utils/products.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import { trackProduct } from '../../scripts/ecommerce-analytics.js';
import { createElement, escapeHtml, safeUrl } from '../../utils/dom.js';
import {
  footnoteSup, stripRefs, refIds, resolveRefLinks,
} from '../../utils/footnotes.js';

const wrap = (html) => `<div>${html}</div>`;
const line = (...cells) => `<div>${cells.map(wrap).join('')}</div>`;

// a header row of product links becomes the tagline, product and offer rows
async function renderProductHeader(block) {
  const first = block.firstElementChild;
  if (!first) return undefined;
  const links = [...first.children].slice(1).map((c) => c.querySelector('a[href*="/products/"]'));
  if (!links.length || links.some((a) => !a || a.closest('div').textContent.trim() !== a.textContent.trim())) return undefined;
  const [products, ph] = await Promise.all([Promise.all(links.map((a) => getProduct(a.getAttribute('href')))), fetchLocalPlaceholders()]);
  if (products.some((p) => !p)) return undefined;
  const monthlyFee = (ph.monthlyFee || 'Monthly Fee').toLowerCase();
  const taglines = line('', ...products.map((p) => `<p>${escapeHtml(p.tagline)}</p>`));
  const cards = line('', ...products.map((p) => {
    const apply = p.applyUrl ? `<p class="button-wrapper"><a class="button primary" href="${safeUrl(p.applyUrl)}">${escapeHtml(ph.openNow || 'Open Now')}</a></p>` : '';
    return `<h3><a href="${safeUrl(p.productPage)}">${escapeHtml(p.name)}</a></h3><p><strong>${escapeHtml(p.fees[0]?.displayValue)}</strong> ${escapeHtml(monthlyFee)}${footnoteSup(p.fees[0]?.footnotes, p.productPage)}</p>${apply}`;
  }));
  const offers = line('', ...products.map((p) => {
    if (!p.offerBadge) return '';
    const href = p.offerDetailsUrl || p.productPage;
    // the badge is already a link, so the marker sits beside it rather than inside
    return `<p><a href="${safeUrl(href)}" target="_blank" rel="noopener">${escapeHtml(stripRefs(p.offerBadge).replace(/^\+\s*/, ''))}</a>${footnoteSup(refIds(p.offerBadge), offerLegalPage(p))}</p>`;
  }));
  first.insertAdjacentHTML('beforebegin', taglines + cards + offers);
  first.remove();
  await resolveRefLinks(block);
  return products;
}

const MOBILE_COLUMNS = 2;

function columnName(table, col) {
  const cell = table.querySelector(`.account-comparison-products [data-col="${col}"]`)
    || table.querySelector(`.account-comparison-head [data-col="${col}"]`);
  return (cell?.querySelector('h3, h4, a')?.textContent || cell?.textContent || '').trim() || `${col}`;
}

// narrow screens show the row label above the values, so only two accounts fit side by side
function buildPicker(block, table, productCols, ph) {
  const chosen = [1, Math.min(2, productCols)];

  const apply = () => {
    const shown = chosen.slice(0, MOBILE_COLUMNS);
    block.style.setProperty('--account-comparison-columns', shown.length);
    table.querySelectorAll('[data-col]').forEach((cell) => {
      const index = shown.indexOf(Number(cell.dataset.col));
      cell.classList.toggle('account-comparison-hidden', index < 0);
      if (index < 0) delete cell.dataset.pos;
      else cell.dataset.pos = index;
    });
  };

  if (productCols > MOBILE_COLUMNS) {
    const names = Array.from({ length: productCols }, (_, i) => columnName(table, i + 1));
    const label = ph.chooseAnAccount || 'Choose an account';
    const picker = createElement('fieldset', { class: 'account-comparison-picker' });
    picker.append(createElement('legend', {}, label));
    const selects = chosen.map((value, slot) => {
      const select = createElement('select', { 'aria-label': `${label} ${slot + 1}` });
      names.forEach((name, i) => select.append(createElement('option', { value: i + 1 }, name)));
      select.value = String(value);
      picker.append(select);
      return select;
    });
    selects.forEach((select, slot) => {
      select.addEventListener('change', () => {
        const next = Number(select.value);
        const other = 1 - slot;
        // picking the account already in the other slot swaps them rather than showing it twice
        if (chosen[other] === next) chosen[other] = chosen[slot];
        chosen[slot] = next;
        selects.forEach((s, i) => { s.value = String(chosen[i]); });
        apply();
      });
    });
    block.prepend(picker);
  }
  apply();
}

export default async function decorate(block) {
  const products = await renderProductHeader(block);
  const rows = [...block.children];
  const cols = Math.max(...rows.map((row) => row.children.length));
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  table.role = 'table';
  thead.role = 'rowgroup';
  tbody.role = 'rowgroup';
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
    tr.role = 'row';

    if (cells.length === 1) {
      groups += 1;
      tr.className = 'account-comparison-group';
      const th = document.createElement('th');
      th.colSpan = cols;
      th.scope = 'colgroup';
      th.role = 'columnheader';
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
      // the mobile layout changes display, which drops native table semantics
      if (header) el.role = 'columnheader';
      else el.role = c === 0 ? 'rowheader' : 'cell';
      if (c === 0 && !el.textContent.trim()) el.dataset.empty = '';
      if (c > 0) {
        if (el.colSpan > 1) el.dataset.span = '';
        else el.dataset.col = c;
      }
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
  if (cols > 2) buildPicker(block, table, cols - 1, await fetchLocalPlaceholders());
  if (products) {
    // The structured header renders taglines in thead, then products in the first body row.
    const productRow = tbody.firstElementChild;
    productRow.querySelectorAll(':scope > td').forEach((cell, index) => {
      if (products[index]) {
        trackProduct(cell, products[index], {
          list: block, listTarget: productRow, index,
        });
      }
    });
  }
}
