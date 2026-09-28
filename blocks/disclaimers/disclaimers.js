import fetchLocalPlaceholders from '../../utils/placeholders.js';

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
    const label = labelCell.textContent.trim();
    const li = document.createElement('li');
    li.id = `legal-${tab}-${label}`;
    const marker = document.createElement('span');
    marker.className = 'disclaimers-label';
    marker.textContent = `${label}) `;
    li.append(marker, ...textCell.childNodes);
    list.append(li);
  });

  details.append(summary, list);
  block.replaceChildren(details);
}
