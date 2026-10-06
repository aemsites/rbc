export const PRODUCT_ORIGIN = 'https://main--rbc--aemsites.aem.live';
export const INDEX_PATH = '/products/query-index.json';

const OFFER_FIELDS = ['offerId', 'offerName', 'offerHeadline', 'offerBadge', 'offerEyebrow',
  'offerStartDate', 'offerEndDate', 'offerConditions', 'offerDetailsUrl'];
const PRODUCT_FIELDS = ['name', 'shortName', 'productCode', 'category', 'categoryLabel',
  'persona', 'variantOf', 'sortOrder', 'tagline'];

export function languageForPath(path = '') {
  return path.startsWith('/fr/') ? 'fr' : 'en';
}

export function productURL(path) {
  if (typeof path !== 'string' || !/^\/(?:fr\/)?products\/[a-zA-Z0-9_./-]+$/.test(path)
    || path.includes('//') || path.endsWith('/') || path.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('Invalid product path.');
  }
  return `${PRODUCT_ORIGIN}${path}`;
}

export function offerValue(offer) {
  if (typeof offer.offerName !== 'string' || !offer.offerName.trim()
    || typeof offer.offerId !== 'string' || !offer.offerId.trim()) {
    throw new Error('Offer name and ID are required before this offer can be inserted.');
  }
  if (offer.offerId.includes(':')) throw new Error('Offer IDs cannot contain a colon.');
  if (/[\r\n]/.test(offer.offerName + offer.offerId)) {
    throw new Error('Offer name and ID must be on a single line.');
  }
  return `${offer.offerName.trim()}:${offer.offerId.trim()}`;
}

function stringFields(row, fields) {
  return Object.fromEntries(fields.map((field) => {
    const value = row[field] ?? '';
    if (typeof value !== 'string') throw new Error(`${field} must be text.`);
    return [field, value.trim()];
  }));
}

// Future offer cardinality changes belong in this adapter, not the selection UI.
export function normalizeProduct(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('Invalid product record.');
  }
  productURL(row.path);
  const product = {
    path: row.path,
    language: languageForPath(row.path),
    ...stringFields(row, PRODUCT_FIELDS),
  };
  const offer = Object.fromEntries(OFFER_FIELDS.map((field) => [field, row[field] ?? '']));
  let error = '';
  try {
    stringFields(offer, OFFER_FIELDS);
    offerValue(offer);
  } catch (e) {
    error = e.message;
  }
  product.offers = OFFER_FIELDS.some((field) => offer[field] !== '')
    ? [{ ...offer, error }] : [];
  return product;
}

export async function loadProducts(fetcher = fetch, signal = null) {
  const rows = [];
  let offset = 0;
  let total;
  do {
    const url = offset ? `${INDEX_PATH}?offset=${offset}` : INDEX_PATH;
    // Each page determines the next offset, so pagination must be sequential.
    // eslint-disable-next-line no-await-in-loop
    const response = await fetcher(url, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Product index request failed (${response.status}).`);
    // eslint-disable-next-line no-await-in-loop
    const page = await response.json();
    if (!page || !Array.isArray(page.data)) throw new Error('Product index has no data array.');
    if (page.total !== undefined) {
      if (!Number.isInteger(page.total) || page.total < 0
        || page.offset !== offset || (total !== undefined && total !== page.total)) {
        throw new Error('Product index pagination is invalid or changed. Please refresh.');
      }
      total = page.total;
    } else if (offset) {
      throw new Error('Product index pagination metadata is missing.');
    }
    rows.push(...page.data);
    offset += page.data.length;
    if (total !== undefined && (offset > total || (!page.data.length && offset < total))) {
      throw new Error('Product index pagination did not return the expected records.');
    }
  } while (total !== undefined && offset < total);

  const products = [];
  const warnings = [];
  const paths = new Set();
  rows.forEach((row, index) => {
    try {
      const product = normalizeProduct(row);
      if (paths.has(product.path)) throw new Error('Duplicate product path.');
      paths.add(product.path);
      products.push(product);
    } catch (error) {
      warnings.push(`Record ${index + 1}: ${error.message}`);
    }
  });
  if (rows.length && !products.length) throw new Error(`No valid product records. ${warnings[0]}`);
  return { products, warnings };
}

function searchable(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function matchingItems(products, {
  language = 'en', mode = 'products', query = '', category = '', persona = '',
} = {}) {
  const items = [];
  const search = searchable(query.trim());
  products.filter((product) => product.language === language
    && (!category || product.category === category)
    && (!persona || product.persona === persona))
    .forEach((product) => {
      const offers = mode === 'offers' ? product.offers : [null];
      offers.forEach((offer, index) => {
        const text = [product.name, product.shortName, product.path, product.productCode,
          product.category, product.persona,
          ...(offer ? [offer.offerName, offer.offerId, offer.offerHeadline, offer.offerBadge]
            : product.offers.flatMap((entry) => [entry.offerName, entry.offerId]))].join(' ');
        if (!searchable(text).includes(search)) return;
        items.push({
          key: `${product.path}:${mode}:${index}`,
          product,
          offer,
        });
      });
    });
  return items.sort((a, b) => {
    const order = (Number(a.product.sortOrder) || 0) - (Number(b.product.sortOrder) || 0);
    return order || (a.product.shortName || a.product.name || a.product.path)
      .localeCompare(b.product.shortName || b.product.name || b.product.path, language)
      || a.key.localeCompare(b.key);
  });
}
