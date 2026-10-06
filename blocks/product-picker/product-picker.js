import {
  getProduct, monthlyFees, pickHighlights, keyList, isPrice,
} from '../../utils/products.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import { footnoteSup, expandRefs, resolveRefLinks } from '../../utils/footnotes.js';
import { escapeHtml, safeUrl } from '../../utils/dom.js';

let pickerCount = 0;

function detail(product, keys, ph) {
  const {
    regular, rebate, regularFootnotes, rebateFootnotes,
  } = monthlyFees(product);
  const sup = (value) => footnoteSup(value, product.productPage);
  const rebateLine = rebate
    ? `<span>${escapeHtml(ph.or || 'or')} ${escapeHtml(rebate)}${escapeHtml(ph.perMonth || '/mo')} ${escapeHtml(ph.withTheValueProgram || 'with the Value Program')}${sup(rebateFootnotes)}</span>` : '';
  const includes = pickHighlights(product, keys)
    .map((h) => `<li>${expandRefs(escapeHtml(h.text), product.productPage)}</li>`).join('');
  return `
    <div class="product-picker-head">
      <p class="product-picker-name">${escapeHtml(product.name)}</p>
      <p class="product-picker-price"><span>${escapeHtml(ph.monthlyFee || 'Monthly fee')}</span><strong>${escapeHtml(regular)}${sup(regularFootnotes)}</strong>${rebateLine}</p>
    </div>
    ${includes ? `<p class="product-picker-includes">${escapeHtml(ph.includes || 'Includes:')}</p><ul>${includes}</ul>` : ''}
    <p class="button-wrapper"><a class="button" href="${safeUrl(product.applyUrl)}">${escapeHtml(ph.openAccount || 'Open Account')}</a></p>`;
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
  list.className = 'product-picker-list';
  if (intro) {
    intro.className = 'product-picker-intro';
    intro.replaceChildren(...intro.firstElementChild.childNodes);
    list.append(intro);
  }
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
    option.innerHTML = `<input type="radio" name="product-picker-${pickerCount}" value="${escapeHtml(product.slug)}"${i ? '' : ' checked'}>
      <span class="product-picker-tagline">${escapeHtml(product.tagline || '')}</span>
      <span class="product-picker-option-name">${escapeHtml(product.name)}</span>
      <span class="product-picker-option-price">${escapeHtml(regular)}${escapeHtml(per)}</span>`;
    option.querySelector('input').addEventListener('change', () => {
      card.innerHTML = detail(product, keys.get(product), ph);
      resolveRefLinks(card);
    });
    group.append(option);
  });
  group.setAttribute('aria-label', intro?.querySelector('h2, h3')?.textContent || ph.chooseAnAccount || 'Choose an account');
  list.append(group);
  card.innerHTML = detail(products[0], keys.get(products[0]), ph);
  block.replaceChildren(list, card);
  await resolveRefLinks(card);
}
