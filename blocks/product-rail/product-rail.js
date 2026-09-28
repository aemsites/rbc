import { getProduct } from '../../utils/products.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';

function longDate(iso) {
  return new Intl.DateTimeFormat(document.documentElement.lang || 'en-CA', { dateStyle: 'long' })
    .format(new Date(`${iso}T12:00:00`));
}

const cell = (html) => `<div>${html}</div>`;
const row = (...cells) => `<div>${cells.map(cell).join('')}</div>`;

// the rail an author would otherwise write row by row, built from the product record
function railRows(product, ph) {
  const rows = [];
  if (product.cardImage) {
    rows.push(row(`<picture><img src="${product.cardImage}" alt="${product.cardImageAlt || ''}" loading="lazy"></picture>`, `<p>${product.categoryLabel}</p>`));
  }
  if (product.offerHeadline) {
    const image = product.offerImage ? `<picture><img src="${product.offerImage}" alt="${product.offerImageAlt || ''}" loading="lazy"></picture>` : '';
    const ends = product.offerEndDate ? `${ph.offerEnds || 'Offer ends'} ${longDate(product.offerEndDate)}. ` : '';
    const details = product.offerDetailsUrl ? `<p><a href="${product.offerDetailsUrl}" target="_blank" rel="noopener">${ph.viewOfferDetails || 'View Offer Details'}</a></p>` : '';
    rows.push(row(`<p>${product.offerEyebrow || ph.offer || 'Offer'}</p>`, `${image}<p>${product.offerHeadline}</p><p>${ends}${product.offerConditions || ''}</p>${details}`));
  }
  product.fees.forEach((fee) => {
    const label = fee.detailUrl ? `<a href="${fee.detailUrl}">${fee.label}</a>` : fee.label;
    rows.push(row(`<p>${label}${fee.footnotes ? `<sup>${fee.footnotes}</sup>` : ''}</p>`, `<p>${fee.displayValue}</p>`));
  });
  if (product.feeDisclaimer) {
    const details = product.feeDetailsUrl ? ` <a href="${product.feeDetailsUrl}">${ph.viewFeeDetails || 'View the fee details'}</a>.` : '';
    rows.push(row(`<p>${product.feeDisclaimer}${details}</p>`));
  }
  const apply = product.applyUrl ? `<p class="button-wrapper"><a class="button primary" href="${product.applyUrl}">${ph.openAccountOnline || 'Open Account Online'}</a></p>` : '';
  rows.push(row(`${apply}<p><a href="#legal-disclaimers">${ph.viewLegalDisclaimers || 'View legal disclaimers'}</a></p>`));
  return rows.join('');
}

export default async function decorate(block) {
  const link = block.querySelector('a[href*="/products/"]');
  if (link && block.textContent.trim() === link.textContent.trim()) {
    const [product, ph] = await Promise.all([getProduct(link.getAttribute('href')), fetchLocalPlaceholders()]);
    if (product) block.innerHTML = railRows(product, ph);
  }
  [...block.children].forEach((r) => {
    const [first, second] = [...r.children];
    if (!second) {
      r.className = r.querySelector('a.button') ? 'product-rail-cta' : 'product-rail-note';
      return;
    }
    if (first.querySelector('picture') && !first.textContent.trim()) {
      r.className = 'product-rail-image';
      second.className = 'product-rail-category';
      return;
    }
    if (second.querySelector('picture, a') || second.children.length > 1 || second.textContent.trim().length > 60) {
      r.className = 'product-rail-offer';
      first.className = 'product-rail-eyebrow';
      return;
    }
    r.className = 'product-rail-fee';
  });
}
