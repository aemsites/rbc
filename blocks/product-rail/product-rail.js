import { createOptimizedPicture } from '../../scripts/aem.js';
import { getProduct, offerCells } from '../../utils/products.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import { rateSpan } from '../../utils/rates.js';
import {
  footnoteSup, expandRefs, resolveRefLinks, normalizeLabel,
} from '../../utils/footnotes.js';

const picture = (src, alt) => createOptimizedPicture(src, alt, false, [{ width: '750' }]).outerHTML;
const cell = (html) => `<div>${html}</div>`;
const row = (...cells) => `<div>${cells.map(cell).join('')}</div>`;

// the fee note's marker can't reuse a label from the page's legal list (live uses + on savings)
function noteMarker() {
  const taken = new Set([...document.querySelectorAll('.disclaimers > div > div:first-child, .disclaimers li[data-label]')]
    .map((el) => el.dataset.label || normalizeLabel(el.textContent)));
  return ['*', '+', '**'].find((mark) => !taken.has(mark));
}

// the rail an author would otherwise write row by row, built from the product record
function railRows(product, ph) {
  const rows = [];
  if (product.cardImage) {
    rows.push(row(picture(product.cardImage, product.cardImageAlt), `<p>${product.categoryLabel}</p>`));
  }
  const offer = offerCells(product, ph, { disclose: true });
  if (offer) rows.push(row(...offer));
  if (product.rateFallbackValue) {
    const value = product.rateRateCode
      ? rateSpan(product.rateRateCode, product.rateFallbackValue) : product.rateFallbackValue;
    rows.push(row(`<p>${expandRefs(product.rateLabel, product.productPage)}</p>`, `<p>${value}</p>`));
  }
  // the regular fee's marker points at the fee note below, not the legal list
  const note = product.feeDisclaimer ? `<sup>${noteMarker()}</sup>` : '';
  product.fees.forEach((fee, i) => {
    const label = fee.detailUrl ? `<a href="${fee.detailUrl}">${fee.label}</a>` : fee.label;
    rows.push(row(`<p>${label}${i ? '' : note}</p>`, `<p>${fee.displayValue}${footnoteSup(fee.footnotes, product.productPage)}</p>`));
  });
  if (product.feeDisclaimer) {
    const details = product.feeDetailsUrl ? ` <a href="${product.feeDetailsUrl}">${ph.viewFeeDetails || 'View the fee details'}</a>.` : '';
    rows.push(row(`<p>${note} ${product.feeDisclaimer}${details}</p>`));
  }
  const apply = product.applyUrl ? `<p class="button-wrapper"><a class="button primary" href="${product.applyUrl}">${ph.openAccountOnline || 'Open Account Online'}</a></p>` : '';
  rows.push(row(`${apply}<p class="link-wrapper"><a href="#legal-disclaimers">${ph.viewLegalDisclaimers || 'View legal disclaimers'}</a></p>`));
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
  // a record link in the first row builds the rail; rows after it are page copy for above the CTA
  const [lead, ...extra] = [...block.children];
  const link = lead?.querySelector('a[href*="/products/"]');
  if (link && lead.textContent.trim() === link.textContent.trim()) {
    const product = await getProduct(link.getAttribute('href'));
    if (product) {
      block.innerHTML = railRows(product, ph);
      block.lastElementChild.before(...extra);
    }
    await resolveRefLinks(block);
  }
  [...block.children].forEach((r) => {
    const [first, second] = [...r.children];
    if (!second) {
      r.className = r.querySelector('a.button') ? 'product-rail-cta' : 'product-rail-note';
      if (r.querySelector('ul')) r.classList.add('checklist');
      return;
    }
    if (first.querySelector('picture') && !first.textContent.trim()) {
      r.className = 'product-rail-image';
      second.className = 'product-rail-category';
      return;
    }
    // footnote links sit on fee values too, so they don't make a row an offer
    if (second.querySelector('picture, a:not(sup a)') || second.children.length > 1 || second.textContent.trim().length > 60) {
      r.className = 'product-rail-offer';
      first.className = 'product-rail-eyebrow';
      return;
    }
    r.className = 'product-rail-fee';
  });
  stickyBar(block, ph);
}
