import { createElement } from './dom.js';

/**
 * Pages a table's columns like a carousel, with arrows and dots, once they don't all fit at
 * their natural width; a table that fits shows whole, without controls. Columns are re-fitted
 * whenever the table's width changes, including when a collapsed panel holding it opens.
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

  // column widths: short values stay on one line, prose wraps down to a readable width
  const measure = () => {
    rows.forEach((row) => [...row.cells].forEach((cell) => { cell.hidden = false; }));
    const columnWidths = (mode) => {
      wrapper.classList.add(mode);
      const width = (i) => Math.max(0, ...rows.map((row) => row.cells[i]?.offsetWidth || 0));
      const result = Array.from({ length: count }, (_, i) => width(i));
      wrapper.classList.remove(mode);
      return result;
    };
    const natural = columnWidths('table-swipe-measure');
    const narrowest = columnWidths('table-swipe-measure-min');
    const readable = 12 * parseFloat(getComputedStyle(table).fontSize);
    widths = natural.map((w, i) => Math.min(w, Math.max(narrowest[i], readable)));
  };

  const fit = () => {
    const available = wrapper.clientWidth;
    if (!available) return;
    measure();
    // the widest run of neighbouring columns that fits decides how many show at once
    const runFits = (span) => widths.some((_, i) => i + span <= count
      && widths.slice(i, i + span).reduce((sum, w) => sum + w, 0) <= available);
    visible = count;
    while (visible > 1 && !runFits(visible)) visible -= 1;
    start = Math.min(start, count - visible);
    show();
  };

  const go = (step) => { start = Math.max(0, Math.min(count - visible, start + step)); show(); };
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));

  // a horizontal swipe or drag across the table pages one column; vertical drags still scroll
  let drag = null;
  const begin = (x, y) => { drag = controls.hidden ? null : { x, y }; };
  const end = (x, y) => {
    if (!drag) return;
    const dx = x - drag.x;
    const dy = y - drag.y;
    drag = null;
    if (Math.abs(dx) >= 30 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };
  table.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) begin(e.touches[0].clientX, e.touches[0].clientY);
    else drag = null;
  }, { passive: true });
  table.addEventListener('touchend', (e) => end(e.changedTouches[0].clientX, e.changedTouches[0].clientY));
  table.addEventListener('touchcancel', () => { drag = null; });
  table.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch' && e.isPrimary) begin(e.clientX, e.clientY); });
  table.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') end(e.clientX, e.clientY); });
  new ResizeObserver(fit).observe(wrapper);
}
