import { createOptimizedPicture } from '../../scripts/aem.js';
import { getProduct } from '../../utils/products.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import { rateSpan } from '../../utils/rates.js';

function longDate(iso) {
  return new Intl.DateTimeFormat(document.documentElement.lang || 'en-CA', { dateStyle: 'long' })
    .format(new Date(`${iso}T12:00:00`));
}

const picture = (src, alt) => createOptimizedPicture(src, alt, false, [{ width: '750' }]).outerHTML;
const cell = (html) => `<div>${html}</div>`;
const row = (...cells) => `<div>${cells.map(cell).join('')}</div>`;

// the rail an author would otherwise write row by row, built from the product record
function railRows(product, ph) {
  const rows = [];
  if (product.cardImage) {
    rows.push(row(picture(product.cardImage, product.cardImageAlt), `<p>${product.categoryLabel}</p>`));
  }
  if (product.offerHeadline) {
    const image = product.offerImage ? picture(product.offerImage, product.offerImageAlt) : '';
    const ends = product.offerEndDate ? `${ph.offerEnds || 'Offer ends'} ${longDate(product.offerEndDate)}. ` : '';
    const details = product.offerDetailsUrl ? `<p><a href="${product.offerDetailsUrl}" target="_blank" rel="noopener">${ph.viewOfferDetails || 'View Offer Details'}</a></p>` : '';
    rows.push(row(`<p>${product.offerEyebrow || ph.offer || 'Offer'}</p>`, `${image}<p>${product.offerHeadline}</p><p>${ends}${product.offerConditions || ''}</p>${details}`));
  }
  if (product.rateFallbackValue) {
    const value = product.rateRateCode
      ? rateSpan(product.rateRateCode, product.rateFallbackValue) : product.rateFallbackValue;
    rows.push(row(`<p>${product.rateLabel}</p>`, `<p>${value}</p>`));
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

// once the rail scrolls away, a bar with the page title keeps its apply button in reach;
// it lives on body because the rail's sticky column would trap its z-index
function stickyBar(block, ph) {
  const apply = block.querySelector('.product-rail-cta a.button');
  const title = document.querySelector('main h1');
  if (!apply || !title) return;
  const bar = document.createElement('div');
  bar.className = 'product-rail-bar';
  bar.innerHTML = `<p class="product-rail-bar-title" aria-hidden="true">${title.textContent}</p>
    <p class="button-wrapper"><a class="button primary" href="${apply.href}">${ph.openAccount || 'Open Account'}</a></p>`;
  document.body.append(bar);
  const section = block.closest('.section');
  new IntersectionObserver(([entry]) => {
    bar.classList.toggle('visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
  }).observe(section);
}

export default async function decorate(block) {
  const ph = await fetchLocalPlaceholders();
  const link = block.querySelector('a[href*="/products/"]');
  if (link && block.textContent.trim() === link.textContent.trim()) {
    const product = await getProduct(link.getAttribute('href'));
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
  stickyBar(block, ph);
}
