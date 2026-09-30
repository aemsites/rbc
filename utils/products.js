const INDEX = '/products/query-index.json';
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

export async function fetchProducts() {
  cache = cache || fetch(INDEX)
    .then((resp) => (resp.ok ? resp.json() : { data: [] }))
    .then(({ data }) => data.map(normalize).sort((a, b) => a.sortOrder - b.sortOrder))
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
