import fetchLocalPlaceholders from '../../utils/placeholders.js';
import { legalId, normalizeLabel } from '../../utils/footnotes.js';

export default async function decorate(block) {
  const ph = await fetchLocalPlaceholders();
  const tab = block.closest('[data-tab]')?.dataset.tab.split(',')[0].trim() || 'default';

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = ph.legalDisclaimers || 'Legal Disclaimers';

  const list = document.createElement('ul');
  [...block.children].forEach((row) => {
    const [labelCell, textCell, idCell] = [...row.children];

    if (!textCell) {
      const heading = labelCell?.querySelector(':scope > :is(h1, h2, h3, h4, h5, h6):only-child');
      if (heading) {
        summary.textContent = heading.textContent.trim();
      } else if (labelCell?.textContent.trim()) {
        const li = document.createElement('li');
        li.append(...labelCell.childNodes);
        list.append(li);
      }
      return;
    }
    const label = normalizeLabel(labelCell.textContent);
    const li = document.createElement('li');
    li.id = legalId(label, tab);
    li.dataset.label = label;
    if (idCell?.textContent.trim()) li.dataset.id = idCell.textContent.trim();
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
