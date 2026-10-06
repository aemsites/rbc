import { getMetadata } from '../scripts/aem.js';
import { createElement } from './dom.js';
import fetchLocalPlaceholders, { SHEETS } from './placeholders.js';

let tooltips;
let count = 0;

function fetchTooltips() {
  tooltips = tooltips || fetch('/tooltips.json')
    .then((resp) => (resp.ok ? resp.json() : {}))
    .then((json) => {
      const rows = Array.isArray(json.data)
        ? json.data
        : (json[SHEETS[getMetadata('lang')]] || json.data || {}).data || [];
      return new Map(rows.map((row) => [row.Key, row]));
    })
    .catch(() => new Map());
  return tooltips;
}

async function fill(button, popover, key) {
  const [tips, ph] = await Promise.all([fetchTooltips(), fetchLocalPlaceholders()]);
  const tip = tips.get(key);
  if (!tip) {
    button.replaceWith(button.classList.contains('tooltip-icon') ? '' : button.textContent);
    popover.remove();
    return;
  }
  if (button.classList.contains('tooltip-icon')) {
    button.setAttribute('aria-label', tip.Title || ph.moreInformation || 'More information');
  }
  // tip.Text is authored HTML from the AEM sheet — same trust as page copy.
  // If the sheet authoring pipeline changes to accept untrusted input,
  // sanitize here with DOMPurify.
  popover.innerHTML = `${tip.Title ? `<strong>${tip.Title}</strong> ` : ''}${tip.Text}`;
}

export default function decorateTooltips(main) {
  main.querySelectorAll('a[href^="#tooltip-"]').forEach((a) => {
    count += 1;
    const id = `tooltip-${count}`;
    const key = a.getAttribute('href').slice('#tooltip-'.length);
    const icon = a.textContent.trim() === '?';
    const button = createElement('button', {
      type: 'button',
      class: ['tooltip-trigger', icon && 'tooltip-icon'],
      popovertarget: id,
      style: `anchor-name: --${id}`,
    }, icon ? '' : a.textContent);
    const popover = createElement('span', {
      id, popover: '', role: 'tooltip', class: 'tooltip', style: `position-anchor: --${id}`,
    });
    a.replaceWith(button, popover);
    fill(button, popover, key);
  });
}
