/* eslint-disable */
/* global WebImporter */
/**
 * Parser for accordion. Base: accordion (existing EDS block "Accordion").
 * Source: https://www.rbcroyalbank.com/bank-accounts/savings-accounts/*.html (article template FAQ)
 *
 * Source shapes (verified in block-context/accordion/source.html + instances/*.html):
 *   div.wp-block-rbc-rbc-collapsible-accordion.accordion
 *     > div.wp-block-rbc-rbc-collapsible-panel > div.accordion-panel
 *   div.accordion > div.accordion-panel          (types page; what-is page via rbc-sections)
 *   each panel: button.collapse-toggle > div (question)
 *               + div.collapse-content > div.collapse-inner (answer)
 *
 * Iteration keys on the block-level div.accordion-panel (present in every shape), with
 * .wp-block-rbc-rbc-collapsible-panel as fallback — never on the <button>.
 *
 * Output: one row per panel: [question text, answer content]. Answer tables stay plain HTML
 * <table>s (classes stripped so the table parser does not turn them into blocks).
 * The FAQ heading is a sibling of the matched element and stays default content.
 */
function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function ownerAccordion(el) {
  return el.parentElement && el.parentElement.closest('.accordion, .wp-block-rbc-rbc-collapsible-accordion');
}

export default function parse(element, { document }) {
  const root = element;
  // panels that belong to this accordion (not to an accordion nested in an answer)
  let panels = [...root.querySelectorAll('.accordion-panel')].filter((p) => ownerAccordion(p) === root);
  if (!panels.length) panels = [...root.querySelectorAll('.accordion-panel')];
  if (!panels.length) panels = [...root.querySelectorAll('.wp-block-rbc-rbc-collapsible-panel')];

  const cells = [];
  let swipe = false;
  panels.forEach((panel) => {
    const toggle = panel.querySelector('.collapse-toggle, button, h2, h3, h4');
    const question = clean(toggle && toggle.textContent);
    const inner = panel.querySelector('.collapse-inner') || panel.querySelector('.collapse-content');
    if (!question && !inner) return;

    const answer = document.createElement('div');
    if (inner) {
      // unwrap layout wrappers (div.flex > div.flex-item) around answer content
      inner.querySelectorAll('div.flex, div.flex-item').forEach((w) => w.replaceWith(...w.childNodes));
      // nested data tables: keep as plain tables
      inner.querySelectorAll('table').forEach((t) => {
        // Tablesaw swipe tables page their columns: the block's swipe option does the same
        if (/\btable-swipe\b|tablesaw-swipe/.test(t.className)) swipe = true;
        t.querySelectorAll('.mobile-only, .tablesaw-cell-label').forEach((n) => n.remove());
        t.removeAttribute('class');
        t.removeAttribute('id');
        t.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
      });
      answer.append(...inner.childNodes);
    }
    cells.push([question, answer]);
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: swipe ? 'Accordion (swipe)' : 'Accordion', cells });
  element.replaceWith(block);
}
