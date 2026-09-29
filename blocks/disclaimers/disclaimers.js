import fetchLocalPlaceholders from '../../utils/placeholders.js';
import { legalId, normalizeLabel } from '../../utils/footnotes.js';

export default async function decorate(block) {
  const ph = await fetchLocalPlaceholders();
  const tab = block.closest('[data-tab]')?.dataset.tab.split(',')[0].trim() || 'default';

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = ph.legalDisclaimers || 'Legal Disclaimers';

  // labels aren't sequential (they skip numbers and include symbols like * and †), so each row
  // carries its own label rather than one derived from position
  const list = document.createElement('ul');
  [...block.children].forEach((row) => {
    const [labelCell, textCell] = [...row.children];
    const label = normalizeLabel(labelCell.textContent);
    const li = document.createElement('li');
    li.id = legalId(label, tab);
    li.dataset.label = label;
    li.tabIndex = -1;
    const marker = document.createElement('span');
    marker.className = 'disclaimers-label';
    marker.textContent = `${label}) `;
    li.append(...textCell.childNodes);
    const first = li.firstElementChild?.tagName === 'P' ? li.firstElementChild : li;
    first.prepend(marker);
    list.append(li);
  });

  details.append(summary, list);
  block.replaceChildren(details);
}
