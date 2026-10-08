import { createOptimizedPicture, loadCSS } from '../../scripts/aem.js';
import { decorateIcons } from '../../scripts/scripts.js';
import { createElement, fragment, safeUrl } from '../../utils/dom.js';
import {
  cardStats, isCreditCard, monthlyFees, offerCells,
} from '../../utils/products.js';
import { footnoteSup } from '../../utils/footnotes.js';

loadCSS(`${window.hlx.codeBasePath}/blocks/cards/featured.css`);

function feeBox(product, ph) {
  const [fee] = product.fees;
  if (!fee) return null;
  const sup = (ids) => fragment(footnoteSup(ids, product.productPage));
  const { rebate, rebateFootnotes } = monthlyFees(product);
  const rebateLine = rebate && !isCreditCard(product)
    ? createElement('span', {}, [`${ph.or || 'or'} ${rebate} ${ph.withTheValueProgram || 'with the Value Program'}`, sup(rebateFootnotes)])
    : null;
  return createElement('p', { class: 'cards-featured-fee' }, [
    createElement('span', {}, fee.label),
    createElement('strong', {}, [fee.displayValue, sup(fee.footnotes)]),
    rebateLine,
  ]);
}

// extra content in a product row: a picture replaces the card art, a lone link the button,
// and the rest the tagline
export function rowExtras(cell, link) {
  const extras = [...cell.children].filter((el) => !el.contains(link));
  const picture = extras.find((el) => el.querySelector('picture, img'));
  const cta = extras.find((el) => el.textContent.trim() === el.querySelector('a')?.textContent.trim());
  return {
    picture: picture?.querySelector('picture, img'),
    cta: cta?.querySelector('a'),
    lines: extras.filter((el) => el !== cta && el !== picture),
  };
}

export function featuredArt(product, label, picture) {
  const art = picture || (product.cardImage
    && createOptimizedPicture(product.cardImage, product.cardImageAlt, false, [{ width: '600' }]));
  if (!art) return null;
  return createElement('div', { class: 'cards-featured-art' }, [
    art,
    label ? createElement('p', { class: 'cards-featured-label' }, label) : null,
  ]);
}

function applyButton(product, ph, cta, ctaText) {
  const href = cta?.getAttribute('href') || product.applyUrl;
  if (!href) return null;
  const fallback = isCreditCard(product) ? ph.applyNow || 'Apply Now' : ph.openAccount || 'Open Account';
  const text = cta?.textContent.trim() || ctaText || fallback;
  return createElement('p', { class: 'button-wrapper' }, createElement('a', { class: 'button primary', href: safeUrl(href) }, text));
}

export default function featuredBody(product, ph, highlights, {
  cta, lines = [], ctaText, banded = false, offer: showOffer = true, button = true,
} = {}) {
  const offer = showOffer && offerCells(product, ph);
  const tagline = lines.length ? lines : [product.tagline && createElement('p', {}, product.tagline)];
  const external = /^https?:/.test(product.productPage) ? { target: '_blank', rel: 'noopener' } : {};
  const more = isCreditCard(product)
    ? ph.seeAllCardDetails || 'See All Card Details' : ph.viewAccountBenefits || 'View Account Benefits';
  // banded: tagline and name in a coloured band across the top, the fee under it
  const head = banded
    ? [createElement('div', { class: 'cards-featured-band' }, [...tagline, createElement('h3', {}, product.name)]), feeBox(product, ph)]
    : [
      createElement('div', { class: 'cards-featured-head' }, [createElement('h3', {}, product.name), feeBox(product, ph)]),
      createElement('div', { class: 'cards-featured-tagline' }, tagline),
    ];
  const body = createElement('div', { class: 'cards-card-body' }, [
    ...head,
    offer ? createElement('div', { class: 'cards-featured-offer offer-box' }, fragment(offer.join(''))) : null,
    createElement('ul', {}, highlights.map(({ icon, html }) => createElement('li', {}, [
      icon ? createElement('span', { class: `icon icon-${icon}` }) : null,
      createElement('span', {}, fragment(html)),
    ]))),
    createElement('p', { class: 'link-wrapper' }, createElement('a', { href: safeUrl(product.productPage), ...external }, more)),
    cardStats(product, 'cards-featured-stats'),
    button ? applyButton(product, ph, cta, ctaText) : null,
  ]);
  decorateIcons(body);
  return body;
}
