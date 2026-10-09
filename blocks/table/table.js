/*
 * Table Block
 * Recreate a table
 * https://www.hlx.live/developer/block-collection/table
 */
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import swipeTable from '../../utils/table-swipe.js';

function buildCell(rowIndex) {
  const cell = rowIndex ? document.createElement('td') : document.createElement('th');
  if (!rowIndex) cell.setAttribute('scope', 'col');
  return cell;
}

export default async function decorate(block) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  const header = !block.classList.contains('no-header');
  if (header) table.append(thead);
  table.append(tbody);

  [...block.children].forEach((child, i) => {
    const row = document.createElement('tr');
    if (header && i === 0) thead.append(row);
    else tbody.append(row);
    [...child.children].forEach((col) => {
      const cell = buildCell(header ? i : i + 1);
      const align = col.getAttribute('data-align');
      const valign = col.getAttribute('data-valign');
      if (align) cell.style.textAlign = align;
      if (valign) cell.style.verticalAlign = valign;
      cell.innerHTML = col.innerHTML;
      row.append(cell);
    });
  });
  block.innerHTML = '';
  block.append(table);

  // stack: on small screens each row becomes a card, so every value carries its column name
  if (header && block.classList.contains('stack')) {
    const labels = [...thead.querySelectorAll('th')].map((th) => th.textContent.trim());
    tbody.querySelectorAll('tr').forEach((row) => [...row.cells].forEach((cell, i) => {
      if (i && labels[i]) cell.dataset.label = labels[i];
    }));
  }

  if (block.classList.contains('swipe')) {
    const ph = await fetchLocalPlaceholders();
    swipeTable(table, { previous: ph.previousColumn, next: ph.nextColumn });
  }
}
