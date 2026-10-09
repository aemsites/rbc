import applyConfig from '../../scripts/config.js';
import { decorateIcons, getMetadata } from '../../scripts/aem.js';
import { getProduct } from '../../utils/products.js';
import { footnoteSup, expandRefs, resolveRefLinks } from '../../utils/footnotes.js';
import { escapeHtml } from '../../utils/dom.js';

const SHEET = '/fragments/value-calculator.json';
const TABS = { 'fr-CA': 'fr', 'zh-Hans': 'sc', 'zh-Hant': 'tc' };

const TEMPLATE = `
<form class="value-calculator-form">
  <div class="value-calculator-account">
    <p class="value-calculator-label" data-key="account-label"></p>
    <label class="value-calculator-select">
      <span class="value-calculator-sr" data-key="select"></span>
      <select name="account"><option value="" data-key="select"></option></select>
    </label>
    <div class="value-calculator-product">
      <p class="value-calculator-name"></p>
      <p class="value-calculator-price"></p>
    </div>
    <p class="button-wrapper"><a class="button primary" data-key="open"></a></p>
  </div>
  <fieldset>
    <legend class="value-calculator-label" data-key="products-label"></legend>
    <p class="value-calculator-intro" data-key="intro"></p>
    <div class="value-calculator-categories"></div>
  </fieldset>
  <div class="value-calculator-results" aria-live="polite">
    <p class="value-calculator-label" data-key="results-label"></p>
    <div class="value-calculator-fee">
      <span class="icon icon-star-circle"></span>
      <p class="value-calculator-fee-label" data-key="fee-label"></p>
      <p class="value-calculator-amount"><strong class="value-calculator-fee-value"></strong>
        <span><span data-key="rebate-before"></span> <span class="value-calculator-rebate"></span> <span data-key="rebate-after"></span></span></p>
    </div>
    <div class="value-calculator-points">
      <span class="icon icon-diamond"></span>
      <p data-key="points-before"></p>
      <p><strong class="value-calculator-spend"></strong></p>
      <p data-key="points-after"></p>
    </div>
  </div>
</form>`;

// copy sheet: an authored link to a .json replaces the default; tab per page language
async function loadCopy(block) {
  const link = [...block.querySelectorAll('a[href]')]
    .find((a) => new URL(a.href, window.location.href).pathname.endsWith('.json'));
  const path = link ? new URL(link.href, window.location.href).pathname : SHEET;
  [...block.children].find((row) => row.contains(link))?.remove();
  const json = await fetch(path).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const tab = TABS[getMetadata('lang')] || 'data';
  const rows = Array.isArray(json.data) ? json.data : (json[tab] || json.data)?.data || [];
  return Object.fromEntries(rows.filter((r) => r.Key && r.Text)
    .map((r) => [r.Key.trim().toLowerCase(), r.Text]));
}

export const numbers = (text, fallback) => {
  const list = String(text || '').split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  return list.length === fallback.length ? list : fallback;
};

const money = (value) => new Intl.NumberFormat(getMetadata('lang') || 'en-CA', {
  style: 'currency',
  currency: 'CAD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: value % 1 ? 2 : 0,
}).format(value);

export default async function decorate(block) {
  const refs = [...block.querySelectorAll('a[href*="/products/"]')].map((a) => a.getAttribute('href'));
  const copy = await loadCopy(block);
  const config = applyConfig(block, TEMPLATE);
  // block rows (already applied by applyConfig) win over the sheet
  const text = (key) => config[key] ?? copy[key];

  const categoryKeys = Object.keys(copy)
    .filter((key) => /^category-\d+$/.test(key))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  block.querySelector('.value-calculator-categories').append(...categoryKeys.map((key) => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox"> <span data-key="${key}"></span>`;
    return label;
  }));

  block.querySelectorAll('[data-key]').forEach((el) => {
    const { key } = el.dataset;
    if (!(key in config)) {
      // eslint-disable-next-line no-console
      if (!copy[key]) console.warn(`value-calculator: no copy for "${key}" in ${SHEET}`);
      el.innerHTML = copy[key] ?? '';
    }
    el.innerHTML = expandRefs(el.innerHTML);
  });
  // spend per point and rebate for 0-1, 2, and 3+ product categories
  const points = numbers(text('points'), [10, 5, 3]);
  const rebates = numbers(text('rebates'), [0, 6, 12.95]);

  const products = (await Promise.all(refs.map(getProduct))).filter(Boolean);
  const single = products.length === 1;
  block.classList.toggle('single', single);
  const select = block.querySelector('select');
  select.append(...products.map((p, i) => new Option(p.name, i)));
  if (single) {
    block.querySelector('.value-calculator-select').remove();
    block.querySelector('.value-calculator-product').append(block.querySelector('.value-calculator-account .button-wrapper'));
  } else block.querySelector('.value-calculator-product').remove();

  const boxes = [...block.querySelectorAll('.value-calculator-categories input')];
  boxes.forEach((box, i) => { box.name = `category-${i + 1}`; });
  const apply = block.querySelector('.value-calculator-account .button');

  const update = () => {
    const product = single ? products[0] : products[select.value];
    boxes.forEach((box) => { box.disabled = !product; });
    block.classList.toggle('pristine', !product);
    apply.closest('p').hidden = !product?.applyUrl;
    if (product?.applyUrl) apply.href = product.applyUrl;
    const tier = Math.min(Math.max(boxes.filter((b) => b.checked).length - 1, 0), 2);
    const regular = product?.fees[0]?.amount ?? 0;
    const rebate = product ? Math.min(rebates[tier], regular) : 0;
    block.querySelector('.value-calculator-fee-value').textContent = money(regular - rebate);
    block.querySelector('.value-calculator-rebate').textContent = money(rebate);
    block.querySelector('.value-calculator-spend').textContent = money(product ? points[tier] : 0);
  };

  if (single) {
    const [product] = products;
    const fee = product.fees[0];
    block.querySelector('.value-calculator-name').textContent = product.name;
    block.querySelector('.value-calculator-price').innerHTML = `${escapeHtml(fee?.displayValue)}${text('per-month') ?? ''}${footnoteSup(fee?.footnotes, product.productPage)}`;
  }
  block.querySelector('form').addEventListener('change', update);
  block.querySelector('form').addEventListener('submit', (e) => e.preventDefault());
  update();
  decorateIcons(block);
  await resolveRefLinks(block);
}
