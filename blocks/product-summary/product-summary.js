import { createOptimizedPicture } from '../../scripts/aem.js';
import { decorateIcons } from '../../scripts/scripts.js';
import { createElement, fragment, safeUrl } from '../../utils/dom.js';
import {
  cardStats, getProduct, isCreditCard, monthlyFees, offerCells, pickHighlights,
} from '../../utils/products.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import { trackProduct, isProductDetail } from '../../scripts/ecommerce-analytics.js';
import { expandRefs, footnoteSup, resolveRefLinks } from '../../utils/footnotes.js';

const button = (text, href) => createElement('p', { class: 'button-wrapper' }, createElement('a', { class: 'button primary', href: safeUrl(href) }, text));

function featureList(rows) {
  return createElement('ul', { class: 'product-summary-features' }, rows.map((row) => createElement('li', {}, [...row.firstElementChild.childNodes])));
}

function accountSummary(product, ph, features) {
  const {
    regular, rebate, regularFootnotes, rebateFootnotes,
  } = monthlyFees(product);
  const per = ph.perMonth || '/mo';
  const sup = (value) => fragment(footnoteSup(value, product.productPage));
  const rebateLine = rebate ? createElement('p', { class: 'product-summary-rebate' }, [
    `${ph.or || 'or'} ${rebate}${per} ${ph.withTheValueProgram || 'with the Value Program'}`, sup(rebateFootnotes),
  ]) : null;
  return [
    createElement('div', { class: 'product-summary-head' }, [
      createElement('h2', {}, product.name),
      createElement('div', { class: 'product-summary-price' }, [
        createElement('p', {}, [createElement('strong', {}, regular), regular.startsWith('$') ? per : '', sup(regularFootnotes)]),
        rebateLine,
      ]),
    ]),
    featureList(features),
    button(ph.openAccount || 'Open Account', product.applyUrl),
    createElement('p', { class: 'product-summary-more link-wrapper' }, createElement('a', { href: safeUrl(product.productPage) }, ph.viewMoreAccountBenefits || 'View More Account Benefits')),
  ];
}

// credit card: name, annual fee, rates, income note and benefits beside the card art and its offer
function cardSummary(product, ph, features, background) {
  const [fee] = product.fees;
  const highlights = features.length ? featureList(features) : createElement(
    'ul',
    { class: 'product-summary-features' },
    pickHighlights(product).map((h) => createElement('li', {}, [
      h.icon ? createElement('span', { class: `icon icon-${h.icon}` }) : null,
      createElement('p', {}, fragment(expandRefs(h.text, product.productPage))),
    ])),
  );
  const offer = offerCells(product, ph, { disclose: true });
  const external = /^https?:/.test(product.productPage) ? { target: '_blank', rel: 'noopener' } : {};
  const body = createElement('div', { class: 'product-summary-body' }, [
    createElement('div', { class: 'product-summary-head' }, [
      createElement('h2', {}, product.name),
      product.tagline ? createElement('p', {}, createElement('strong', {}, product.tagline)) : null,
    ]),
    fee ? createElement('p', { class: 'product-summary-fee' }, [
      createElement('span', {}, fee.label),
      createElement('strong', {}, [fee.displayValue, fragment(footnoteSup(fee.footnotes, product.productPage))]),
    ]) : null,
    cardStats(product, 'product-summary-stats'),
    product.note ? createElement('p', { class: 'product-summary-note' }, fragment(expandRefs(product.note, product.productPage))) : null,
    highlights,
    product.applyUrl ? button(ph.applyNow || 'Apply Now', product.applyUrl) : null,
    createElement('p', { class: 'product-summary-more link-wrapper' }, createElement('a', { href: safeUrl(product.productPage), ...external }, ph.seeAllCardDetails || 'See All Card Details')),
  ]);
  const art = createElement('div', { class: 'product-summary-art' }, [
    background ? createElement('div', { class: 'product-summary-background' }, background) : null,
    product.cardImage ? createOptimizedPicture(product.cardImage, product.cardImageAlt, false, [{ width: '750' }]) : null,
    offer ? createElement('div', { class: 'product-summary-offer offer-box' }, fragment(offer.join(''))) : null,
  ]);
  decorateIcons(body);
  return [body, art];
}

// first row links a /products/ record; a row holding only a picture sits behind the card art,
// and the remaining rows are the authored features
export default async function decorate(block) {
  const [first, ...rows] = [...block.children];
  const link = first?.querySelector('a[href*="/products/"]');
  if (!link) return;
  const [product, ph] = await Promise.all([getProduct(link.getAttribute('href')), fetchLocalPlaceholders()]);
  if (!product) return;

  const isBackground = (row) => row.querySelector('picture, img') && !row.textContent.trim();
  const background = rows.find(isBackground)?.querySelector('picture, img');
  const features = rows.filter((row) => !isBackground(row));
  const card = isCreditCard(product);
  block.classList.toggle('credit-card', card);
  block.replaceChildren(...(card
    ? cardSummary(product, ph, features, background) : accountSummary(product, ph, features)));
  await resolveRefLinks(block);
  trackProduct(block, product, {
    detail: isProductDetail() && !document.querySelector('main .product-rail'),
  });
}
