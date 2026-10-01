import { getProduct, offerCells } from '../../utils/products.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import { expandRefs, resolveRefLinks } from '../../utils/footnotes.js';

export default async function decorate(block) {
  const link = block.querySelector('a[href*="/products/"]');
  if (link && block.textContent.trim() === link.textContent.trim()) {
    const [product, ph] = await Promise.all([getProduct(link.getAttribute('href')), fetchLocalPlaceholders()]);
    const cells = product && offerCells(product, ph);
    if (!cells) {
      block.remove();
      return;
    }
    block.innerHTML = `<div>${cells.map((html) => `<div>${html}</div>`).join('')}</div>`;
  } else {
    // authored offers name disclaimers by id, so a shared fragment numbers them for each page
    block.innerHTML = expandRefs(block.innerHTML);
  }
  const [eyebrow, body] = block.firstElementChild?.children || [];
  eyebrow?.classList.add('offer-eyebrow');
  body?.classList.add('offer-body');
  await resolveRefLinks(block);
}
