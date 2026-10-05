import {
  getProduct, monthlyFees, pickHighlights, keyList, isPrice,
} from '../../utils/products.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import { trackProduct, selectProduct } from '../../scripts/ecommerce-analytics.js';
import { footnoteSup, expandRefs, resolveRefLinks } from '../../utils/footnotes.js';

let pickerCount = 0;

function detail(product, keys, ph) {
  const {
    regular, rebate, regularFootnotes, rebateFootnotes,
  } = monthlyFees(product);
  const sup = (value) => footnoteSup(value, product.productPage);
  const rebateLine = rebate
    ? `<span>${ph.or || 'or'} ${rebate}${ph.perMonth || '/mo'} ${ph.withTheValueProgram || 'with the Value Program'}${sup(rebateFootnotes)}</span>` : '';
  const includes = pickHighlights(product, keys)
    .map((h) => `<li>${expandRefs(h.text, product.productPage)}</li>`).join('');
  return `
    <div class="product-picker-head">
      <p class="product-picker-name">${product.name}</p>
      <p class="product-picker-price"><span>${ph.monthlyFee || 'Monthly fee'}</span><strong>${regular}${sup(regularFootnotes)}</strong>${rebateLine}</p>
    </div>
    ${includes ? `<p class="product-picker-includes">${ph.includes || 'Includes:'}</p><ul>${includes}</ul>` : ''}
    <p class="button-wrapper"><a class="button" href="${product.applyUrl}">${ph.openAccount || 'Open Account'}</a></p>`;
}

// optional intro row, then one row per /products/ link with optional claim keys;
// picking an account swaps the detail card
export default async function decorate(block) {
  pickerCount += 1;
  const rows = [...block.children];
  const intro = rows.find((row) => !row.querySelector('a[href*="/products/"]'));
  const refs = rows.filter((row) => row.querySelector('a[href*="/products/"]'))
    .map((row) => [row.querySelector('a[href*="/products/"]').getAttribute('href'), keyList(row.children[1])]);
  const [ph, ...found] = await Promise.all([
    fetchLocalPlaceholders(), ...refs.map(([href]) => getProduct(href)),
  ]);
  const keys = new Map(found.map((product, i) => [product, refs[i][1]]));
  const products = found.filter(Boolean);
  if (!products.length) return;

  const list = document.createElement('div');
  const tracking = new Map();
  list.className = 'product-picker-list';
  if (intro) {
    intro.className = 'product-picker-intro';
    intro.replaceChildren(...intro.firstElementChild.childNodes);
    list.append(intro);
  }
  const listTitle = intro?.querySelector('h2, h3')?.textContent.trim();
  const group = document.createElement('div');
  group.className = 'product-picker-options';
  group.setAttribute('role', 'radiogroup');
  const card = document.createElement('div');
  card.className = 'product-picker-detail';
  card.setAttribute('aria-live', 'polite');

  products.forEach((product, i) => {
    const { regular } = monthlyFees(product);
    const per = isPrice(regular) ? ph.perMonth || '/mo' : '';
    const option = document.createElement('label');
    option.className = 'product-picker-option';
    option.innerHTML = `<input type="radio" name="product-picker-${pickerCount}" value="${product.slug}"${i ? '' : ' checked'}>
      <span class="product-picker-tagline">${product.tagline || ''}</span>
      <span class="product-picker-option-name">${product.name}</span>
      <span class="product-picker-option-price">${regular}${per}</span>`;
    option.querySelector('input').addEventListener('change', () => {
      card.innerHTML = detail(product, keys.get(product), ph);
      trackProduct(card, product, { index: i });
      selectProduct(option);
      resolveRefLinks(card);
    });
    tracking.set(option, product);
    group.append(option);
  });
  group.setAttribute('aria-label', intro?.querySelector('h2, h3')?.textContent || ph.chooseAnAccount || 'Choose an account');
  list.append(group);
  card.innerHTML = detail(products[0], keys.get(products[0]), ph);
  block.replaceChildren(list, card);
  await resolveRefLinks(card);
  tracking.forEach((product, option) => trackProduct(option, product, {
    list: block, listTarget: group, listTitle, index: [...group.children].indexOf(option),
  }));
  trackProduct(card, products[0]);
}
