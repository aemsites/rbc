import { createOptimizedPicture, getMetadata } from '../scripts/aem.js';
import { expandRefs, footnoteSup } from './footnotes.js';
import {
  createElement, escapeHtml, fragment, safeUrl,
} from './dom.js';

const INDEX = '/products/query-index.json';
// one index holds every language; records live under the language root, e.g. /fr/products/
const ROOTS = { 'fr-CA': '/fr/' };
let cache;

// item cells come back as the structured doc's html: rows of key heading + value
function parseItem(html) {
  const item = {};
  new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild
    .querySelectorAll(':scope > div').forEach((row) => {
      const key = row.querySelector('h3')?.textContent.trim();
      if (key) item[key] = row.lastElementChild.textContent.trim();
    });
  return item;
}

function normalize(row) {
  const product = { ...row };
  product.slug = row.path.split('/').pop();
  product.sortOrder = Number(row.sortOrder) || 0;
  product.highlights = (Array.isArray(row.highlights) ? row.highlights : []).map(parseItem);
  product.fees = (Array.isArray(row.fees) ? row.fees : []).map(parseItem)
    .map((fee) => ({ ...fee, amount: fee.amount === '' ? undefined : Number(fee.amount) }));
  return product;
}

function inPageLanguage(path) {
  const root = ROOTS[getMetadata('lang')];
  return root ? path.startsWith(root) : !Object.values(ROOTS).some((r) => path.startsWith(r));
}

export async function fetchProducts() {
  cache = cache || fetch(INDEX)
    .then((resp) => (resp.ok ? resp.json() : { data: [] }))
    .then(({ data }) => data.filter((row) => inPageLanguage(row.path)).map(normalize)
      .sort((a, b) => a.sortOrder - b.sortOrder))
    .catch(() => []);
  return cache;
}

// ref is a /products/... path, a slug, or a product code
export async function getProduct(ref) {
  const key = String(ref).split('/').pop();
  return (await fetchProducts()).find((p) => p.slug === key || p.productCode === key);
}

export async function getProducts({ category, persona } = {}) {
  return (await fetchProducts()).filter((p) => (!category || p.category === category)
    && (!persona || p.persona === persona));
}

// a block can name the claims it shows; otherwise the record's default claims
export function pickHighlights(product, keys = []) {
  if (keys.length) {
    return keys.map((key) => product.highlights.find((h) => h.key === key)).filter(Boolean);
  }
  const defaults = product.highlights.filter((h) => h.default === 'true');
  return defaults.length ? defaults : product.highlights;
}

export const keyList = (cell) => (cell?.textContent || '').split(',').map((k) => k.trim()).filter(Boolean);

// offer footnotes a page lacks link to the offer's page, or the product page if it's off-site
export const offerLegalPage = (product) => (product.offerDetailsUrl?.startsWith('/')
  ? product.offerDetailsUrl : product.productPage);

function longDate(iso) {
  return new Intl.DateTimeFormat(document.documentElement.lang || 'en-CA', { dateStyle: 'long' })
    .format(new Date(`${iso}T12:00:00`));
}

// label and body cells of a product's current offer, as the rail and featured cards show it
export function offerCells(product, ph, { disclose = false } = {}) {
  if (!product.offerHeadline) return null;
  const image = product.offerImage
    ? createOptimizedPicture(product.offerImage, product.offerImageAlt, false, [{ width: '750' }]).outerHTML : '';
  const ends = product.offerEndDate ? `${escapeHtml(ph.offerEnds || 'Offer ends')} ${escapeHtml(longDate(product.offerEndDate))}. ` : '';
  const offerPage = offerLegalPage(product);
  const label = `<p class="offer-label">${escapeHtml(product.offerEyebrow || ph.offer || 'Offer')}</p>`;
  const headline = `<p>${expandRefs(escapeHtml(product.offerHeadline), offerPage)}</p>`;
  const conditions = `<p>${ends}${expandRefs(escapeHtml(product.offerConditions || ''), offerPage)}</p>`;
  // the rail tucks the conditions and the offer page link behind a "View Offer Details" toggle
  if (disclose) {
    const url = product.offerDetailsUrl;
    const here = url && new URL(url, window.location.href).pathname === window.location.pathname;
    const more = url && !here ? `<p class="link-wrapper"><a href="${safeUrl(url)}" target="_blank" rel="noopener">${escapeHtml(ph.learnMore || 'Learn More')}</a></p>` : '';
    return [
      label,
      `${image}${headline}<details class="disclosure"><summary>${escapeHtml(ph.viewOfferDetails || 'View Offer Details')}</summary>${conditions}${more}</details>`,
    ];
  }
  // rbcroyalbank.com doesn't link off-site offers (e.g. the investments HISA page)
  const details = offerPage === product.offerDetailsUrl ? `<p class="link-wrapper"><a href="${safeUrl(product.offerDetailsUrl)}" target="_blank" rel="noopener">${escapeHtml(ph.viewOfferDetails || 'View Offer Details')}</a></p>` : '';
  return [label, `${image}${headline}${conditions}${details}`];
}

// a dollar amount in either order: "$4" (en) or "4 $" (fr)
export const isPrice = (value = '') => /^\$\s?\d|\d\s?\$/.test(value);

export const zeroPrice = () => new Intl.NumberFormat(getMetadata('lang') || 'en-CA', {
  style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0,
}).format(0);

// the regular monthly fee, and the price with the Value Program rebate when the record has one
export function monthlyFees(product) {
  const [regular] = product.fees;
  const rebate = product.fees.find((fee) => /value program|programme valeur/i.test(fee.label));
  return {
    regular: regular?.displayValue || '',
    rebate: rebate?.displayValue.replace(/^(as low as|aussi peu que)\s+/i, '') || '',
    regularFootnotes: regular?.footnotes || '',
    rebateFootnotes: rebate?.footnotes || '',
  };
}

export const isCreditCard = (product) => product.category === 'credit-card';

// a credit card's fee lines after the annual fee are its rates, shown as a row of label/value pairs
export function cardStats(product, className) {
  if (!isCreditCard(product) || product.fees.length < 2) return null;
  return createElement('dl', { class: className }, product.fees.slice(1).map((fee) => createElement('div', {}, [
    createElement('dt', {}, fee.label),
    createElement('dd', {}, [fee.displayValue, fragment(footnoteSup(fee.footnotes, product.productPage))]),
  ])));
}
