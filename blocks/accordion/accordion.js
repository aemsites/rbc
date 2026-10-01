import { createElement } from '../../utils/dom.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import swipeTable from '../../utils/table-swipe.js';

// a table in an answer arrives as plain rows; its first row is the header, as in the table block
function promoteHeader(table) {
  const first = table.rows[0];
  if (!first || table.tHead) return;
  [...first.cells].forEach((cell) => {
    if (cell.tagName === 'TH') return;
    cell.replaceWith(createElement('th', { scope: 'col' }, [...cell.childNodes]));
  });
  table.createTHead().append(first);
}

function buildItem(row) {
  const summary = document.createElement('summary');
  summary.className = 'accordion-item-label';
  summary.append(...row.children[0].childNodes);

  const body = row.children[1] || document.createElement('div');
  body.className = 'accordion-item-body';

  const details = document.createElement('details');
  details.className = 'accordion-item';
  details.append(summary, body);
  return details;
}

export default async function decorate(block) {
  const rows = [...block.children];
  const toggleAt = rows.findIndex((row) => row.children.length === 1);
  const more = toggleAt < 0 ? null : document.createElement('div');

  rows.forEach((row, i) => {
    if (i === toggleAt) return;
    const item = buildItem(row);
    if (more && i > toggleAt) {
      more.append(item);
      row.remove();
    } else {
      row.replaceWith(item);
    }
  });

  if (block.classList.contains('split')) {
    [block, more].filter(Boolean).forEach((parent) => {
      const cols = [0, 1].map(() => Object.assign(document.createElement('div'), { className: 'accordion-col' }));
      [...parent.querySelectorAll(':scope > .accordion-item')].forEach((item, i) => cols[i % 2].append(item));
      parent.prepend(...cols);
    });
  }

  // swipe: tables in answers page through their columns when they don't all fit the panel
  const tables = [...block.querySelectorAll('.accordion-item-body table')];
  tables.forEach(promoteHeader);
  if (tables.length && block.classList.contains('swipe')) {
    const ph = await fetchLocalPlaceholders();
    const labels = { previous: ph.previousColumn, next: ph.nextColumn };
    tables.forEach((table) => swipeTable(table, labels));
  }

  if (!more) return;

  more.className = 'accordion-more';
  more.id = `accordion-more-${Math.random().toString(36).slice(2, 8)}`;
  more.hidden = true;

  const toggle = document.createElement('button');
  toggle.className = 'accordion-toggle';
  toggle.type = 'button';
  const toggleLabel = document.createElement('span');
  toggleLabel.textContent = rows[toggleAt].textContent.trim();
  toggle.append(toggleLabel);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', more.id);
  toggle.addEventListener('click', () => {
    more.hidden = !more.hidden;
    toggle.setAttribute('aria-expanded', String(!more.hidden));
  });

  rows[toggleAt].replaceWith(toggle, more);
}
