import { createElement } from './dom.js';

/**
 * Pages a table's columns like a carousel, with arrows and dots. As on the source site, at
 * least one column always waits on the next slide, and on narrow screens fewer columns show
 * when they don't fit at their natural width. Columns are re-fitted whenever the table's
 * width changes, including when a collapsed panel holding it opens.
 * @param {HTMLTableElement} table the table to enhance
 * @param {object} [labels] accessible names for the arrows
 */
export default function swipeTable(table, labels = {}) {
  const rows = [...table.rows];
  const count = Math.max(0, ...rows.map((row) => row.cells.length));
  if (count < 2 || table.closest('.table-swipe')) return;

  const dotItems = Array.from({ length: count }, () => createElement('li', { class: 'table-swipe-dot' }));
  const dots = createElement('ol', { class: 'table-swipe-dots', 'aria-hidden': 'true' }, dotItems);
  const prev = createElement('button', { type: 'button', class: 'table-swipe-prev', 'aria-label': labels.previous || 'Previous column' });
  const next = createElement('button', { type: 'button', class: 'table-swipe-next', 'aria-label': labels.next || 'Next column' });
  const controls = createElement('div', { class: 'table-swipe-controls' }, [dots, prev, next]);
  const wrapper = createElement('div', { class: 'table-swipe' });
  table.before(wrapper);
  wrapper.append(controls, table);

  let widths = [];
  let start = 0;
  let visible = count;

  const show = () => {
    rows.forEach((row) => [...row.cells].forEach((cell, i) => {
      cell.hidden = i < start || i >= start + visible;
    }));
    dotItems.forEach((dot, i) => dot.classList.toggle('active', i >= start && i < start + visible));
    prev.disabled = start === 0;
    next.disabled = start + visible >= count;
    controls.hidden = visible >= count;
  };

  // natural column widths: every column shown, text only wrapping where the author broke it
  const measure = () => {
    rows.forEach((row) => [...row.cells].forEach((cell) => { cell.hidden = false; }));
    wrapper.classList.add('table-swipe-measure');
    const columnWidth = (i) => Math.max(0, ...rows.map((row) => row.cells[i]?.offsetWidth || 0));
    widths = Array.from({ length: count }, (_, i) => columnWidth(i));
    wrapper.classList.remove('table-swipe-measure');
  };

  const fit = () => {
    const available = wrapper.clientWidth;
    if (!available) return;
    measure();
    // the widest run of neighbouring columns that fits decides how many show at once
    const runFits = (span) => widths.some((_, i) => i + span <= count
      && widths.slice(i, i + span).reduce((sum, w) => sum + w, 0) <= available);
    visible = count - 1;
    while (visible > 1 && !runFits(visible)) visible -= 1;
    start = Math.min(start, count - visible);
    show();
  };

  prev.addEventListener('click', () => { start = Math.max(0, start - 1); show(); });
  next.addEventListener('click', () => { start = Math.min(count - visible, start + 1); show(); });
  new ResizeObserver(fit).observe(wrapper);
}
