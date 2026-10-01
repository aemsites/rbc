/* eslint-disable */
/* global WebImporter */
/**
 * Parser for table. Base: table (existing EDS block, authored as "Table (striped)").
 * Source: https://www.rbcroyalbank.com/bank-accounts/savings-accounts/*.html (article template)
 *
 * Source shapes (verified in block-context/table/source.html + instances/*.html):
 *   table.wp-block-rbc-responsive-table-block (table-wpr / table-swipe): thead > tr > th + tbody > tr > td
 *   table.wp-block-rbc-stackable-table-block.row-stack: tbody only, first row = header
 *     (leading empty corner td, th/td with <strong>)
 *   table.wp-block-rbc-stackable-table-block.col-stack: tbody only, first row = header
 *   The matched element is normally the <table> itself; a wrapper div holding one is handled too.
 *
 * Output: one block row per <tr> (header row first), one cell per column, inline formatting kept.
 *
 * Tables nested inside FAQ answers (accordion panels / collapsibles) stay plain HTML tables
 * inside the accordion's answer cell, so they are left untouched here.
 */
const NESTED_IN = '.accordion, .accordion-panel, .wp-block-rbc-rbc-collapsible-accordion, .collapse-inner, .wp-block-rbc-rbc-default-collapsible, td, th';

// Mobile-only duplicate labels some stackable/responsive tables inject into cells.
const MOBILE_LABELS = '.mobile-only, .tablesaw-cell-label, .table-stack-label, .stack-label, [class*="cell-label"]';

export default function parse(element, { document }) {
  const table = element.tagName === 'TABLE' ? element : element.querySelector('table');
  if (!table) return;

  // Nested in an accordion answer (or already inside a generated block table): keep as plain table.
  if ((table.parentElement && table.parentElement.closest(NESTED_IN))) return;

  const rows = [...table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr')];
  if (!rows.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const grid = rows.map((tr) => [...tr.children].filter((c) => c.tagName === 'TD' || c.tagName === 'TH'));
  const cols = Math.max(...grid.map((r) => r.reduce((n, c) => n + (parseInt(c.getAttribute('colspan'), 10) || 1), 0)));

  const cells = grid.map((sourceCells) => {
    const row = [];
    sourceCells.forEach((c) => {
      c.querySelectorAll(MOBILE_LABELS).forEach((l) => l.remove());
      const cell = document.createElement('div');
      // trim whitespace-only text nodes at the edges, keep inline markup (strong, a, sup, br)
      [...c.childNodes].forEach((n) => cell.append(n));
      row.push(cell);
      const span = parseInt(c.getAttribute('colspan'), 10) || 1;
      for (let i = 1; i < span; i += 1) row.push('');
    });
    while (row.length < cols) row.push('');
    return row;
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'Table (striped)', cells });
  element.replaceWith(block);
}
