import { getProduct, monthlyFees } from '../../utils/products.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import { footnoteSup, resolveRefLinks } from '../../utils/footnotes.js';
import { escapeHtml, safeUrl } from '../../utils/dom.js';

// first row links a /products/ record; the remaining rows are the authored feature columns
export default async function decorate(block) {
  const [first, ...features] = [...block.children];
  const link = first?.querySelector('a[href*="/products/"]');
  if (!link) return;
  const [product, ph] = await Promise.all([getProduct(link.getAttribute('href')), fetchLocalPlaceholders()]);
  if (!product) return;

  const {
    regular, rebate, regularFootnotes, rebateFootnotes,
  } = monthlyFees(product);
  const per = ph.perMonth || '/mo';
  const sup = (value) => footnoteSup(value, product.productPage);
  const rebateLine = rebate
    ? `<p class="product-summary-rebate">${escapeHtml(ph.or || 'or')} ${escapeHtml(rebate)}${escapeHtml(per)} ${escapeHtml(ph.withTheValueProgram || 'with the Value Program')}${sup(rebateFootnotes)}</p>` : '';
  const list = document.createElement('ul');
  list.className = 'product-summary-features';
  features.forEach((row) => {
    const li = document.createElement('li');
    li.append(...row.firstElementChild.childNodes);
    list.append(li);
  });

  block.innerHTML = `
    <div class="product-summary-head">
      <h2>${escapeHtml(product.name)}</h2>
      <div class="product-summary-price"><p><strong>${escapeHtml(regular)}</strong>${regular.startsWith('$') ? escapeHtml(per) : ''}${sup(regularFootnotes)}</p>${rebateLine}</div>
    </div>
    <p class="button-wrapper"><a class="button primary" href="${safeUrl(product.applyUrl)}">${escapeHtml(ph.openAccount || 'Open Account')}</a></p>
    <p class="product-summary-more link-wrapper"><a href="${safeUrl(product.productPage)}">${escapeHtml(ph.viewMoreAccountBenefits || 'View More Account Benefits')}</a></p>`;
  block.querySelector('.product-summary-head').after(list);
  await resolveRefLinks(block);
}
