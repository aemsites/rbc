/* eslint-disable */
/* global WebImporter */
/**
 * Parser for disclaimers. Base: disclaimers (existing custom EDS block "Disclaimers").
 * Source: https://www.rbcroyalbank.com/bank-accounts/savings-accounts/*.html (article template)
 *
 * Source shape (verified in block-context/disclaimers/source.html + instances/*.html):
 *   div.wp-block-rbc-rbc-default-collapsible
 *     > p > button.collapse-toggle > span x2 (same toggle text repeated)
 *     > div.collapse-content > div.collapse-inner > p / ul / ol (legal copy)
 *
 * Also: https://www.rbcroyalbank.com/new-to-canada/... (newcomer-article template), verified in
 * block-context-newcomer/disclaimers/source.html:
 *   section.disclaimer > .section-inner
 *     > p > button.collapse-toggle (plain text label, no spans)
 *     > div#legal-disclaimer.collapse-content > div.collapse-inner > div.table-wpr
 *       > div.table-row (1..n) > div.table-cell (empty) + div.table-cell (legal copy as bare text/inline nodes)
 *
 * Output (single-cell rows only, matching blocks/disclaimers/disclaimers.js):
 *   row 1: <h3>{toggle text}</h3>  (block uses a lone heading to rename the toggle)
 *   rows 2..n: one legal paragraph / list per row, links and formatting kept
 */
function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

/** "XX" -> "X": html2md preprocessing can merge the two adjacent label spans into one. */
function undouble(text) {
  const t = clean(text);
  const compact = t.replace(/\s/g, '');
  if (compact.length % 2 === 0) {
    const half = compact.slice(0, compact.length / 2);
    if (half && half === compact.slice(compact.length / 2)) {
      // return the first half of the original (spaced) string
      let seen = 0;
      for (let i = 0; i < t.length; i += 1) {
        if (!/\s/.test(t[i])) seen += 1;
        if (seen === half.length) return clean(t.slice(0, i + 1));
      }
    }
  }
  return t;
}

export default function parse(element, { document }) {
  const toggle = element.querySelector('.collapse-toggle') || element.querySelector('button');
  let title = '';
  if (toggle) {
    // spans repeat the same label (collapsed/expanded states) — de-duplicate
    // (or are merged into one doubled span by the import pipeline)
    const labels = [...new Set([...toggle.querySelectorAll('span')].map((s) => undouble(s.textContent)).filter(Boolean))];
    title = labels[0] || undouble(toggle.textContent);
  }

  const inner = element.querySelector('.collapse-inner') || element.querySelector('.collapse-content');
  const items = [];
  if (inner) {
    [...inner.children].forEach((child) => {
      if (/^(P|UL|OL|H[1-6]|TABLE|BLOCKQUOTE)$/.test(child.tagName)) {
        if (clean(child.textContent) || child.querySelector('img')) items.push(child);
      } else if (child.tagName === 'DIV' && child.querySelector('.table-cell')) {
        // newcomer-article: div.table-wpr > div.table-row > div.table-cell (label, often empty) + div.table-cell (copy)
        // one row per non-empty cell; bare text / inline nodes get wrapped in a <p>
        [...child.querySelectorAll('.table-cell')]
          .filter((cell) => !cell.querySelector('.table-cell'))
          .filter((cell) => clean(cell.textContent) || cell.querySelector('img'))
          .forEach((cell) => {
            const blocks = [...cell.childNodes].filter((n) => n.nodeType === 1
              && /^(P|UL|OL|H[1-6]|TABLE|BLOCKQUOTE|DIV)$/.test(n.tagName));
            if (!blocks.length) {
              const p = document.createElement('p');
              p.append(...cell.childNodes);
              p.innerHTML = p.innerHTML.trim();
              items.push(p);
              return;
            }
            // mixed content: group runs of inline nodes into <p>, keep block nodes as-is
            const parts = [];
            let run = null;
            [...cell.childNodes].forEach((n) => {
              if (blocks.includes(n)) {
                run = null;
                if (clean(n.textContent) || n.querySelector?.('img')) parts.push(n);
              } else {
                if (!run) { run = document.createElement('p'); parts.push(run); }
                run.append(n);
              }
            });
            // one row per table-cell: all of the cell's parts share a single cell
            const cellParts = parts
              .filter((n) => clean(n.textContent) || n.querySelector?.('img'))
              .map((n) => {
                if (n.tagName === 'P' && !n.parentElement) n.innerHTML = n.innerHTML.trim();
                return n;
              });
            if (cellParts.length) items.push(cellParts.length === 1 ? cellParts[0] : cellParts);
          });
      } else if (child.tagName === 'DIV') {
        // nested wrapper: take its block-level children
        [...child.querySelectorAll(':scope > p, :scope > ul, :scope > ol')]
          .filter((n) => clean(n.textContent))
          .forEach((n) => items.push(n));
      }
    });
  }

  if (!title && !items.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [];
  if (title) {
    const h3 = document.createElement('h3');
    h3.textContent = title;
    cells.push([h3]);
  }
  items.forEach((item) => cells.push([item]));

  const block = WebImporter.Blocks.createBlock(document, { name: 'Disclaimers', cells });
  element.replaceWith(block);
}
