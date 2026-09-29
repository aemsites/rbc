import { createOptimizedPicture, toClassName } from '../../scripts/aem.js';
import decorateTile, { tileWords } from './tiles.js';
import { getProduct, getProducts, monthlyFees } from '../../utils/products.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import { rateSpan } from '../../utils/rates.js';
import { footnoteSup } from '../../utils/footnotes.js';

function button(text, href, kind) {
  return `<p class="button-wrapper"><a class="button ${kind}" href="${href}">${text}</a></p>`;
}

function link(text, href) {
  return href ? `<a href="${href}">${text}</a>` : text;
}

// offers always live on a campaign page, so they open in a new tab
function offerLink(product, text) {
  return product.offerDetailsUrl ? `<a href="${product.offerDetailsUrl}" target="_blank" rel="noopener">${text}</a>` : text;
}

function priceLine(product, ph) {
  const {
    regular, rebate, regularFootnotes, rebateFootnotes,
  } = monthlyFees(product);
  if (!regular) return '';
  const per = (value) => (value.startsWith('$') ? ph.perMonth || '/mo' : '');
  const sup = (value) => footnoteSup(value, product.productPage);
  let line = `<strong>${regular}</strong>${per(regular)}${sup(regularFootnotes)}`;
  if (rebate) line += ` <em>${ph.or || 'or'}</em> <strong>${rebate}</strong>${per(rebate)} ${ph.withTheValueProgram || 'with the Value Program'}${sup(rebateFootnotes)}`;
  return `<p>${line}</p>`;
}

// the body markup an author would otherwise write by hand, built from the product record
function productBody(product, ph, variant) {
  const sup = (value) => footnoteSup(value, product.productPage);
  const rate = product.rateFallbackValue
    ? `<li>${product.rateLabel}: ${product.rateRateCode ? rateSpan(product.rateRateCode, product.rateFallbackValue) : product.rateFallbackValue}${sup(product.rateFootnotes)}</li>` : '';
  const highlights = product.highlights.map((h) => `<li>${link(h.text, h.url)}${sup(h.footnotes)}</li>`).join('') + rate;
  const note = product.note ? `<p>${product.note}${sup(product.noteFootnotes)}</p>` : '';
  const [fee] = product.fees;
  const feeSup = sup(fee?.footnotes);
  if (variant === 'compact') {
    return `<h3>${product.name}</h3><p>${fee?.label || ''}${feeSup} <strong>${fee?.displayValue || ''}</strong></p>
      <p><a href="${product.productPage}">${ph.viewAccount || 'View Account'}</a></p>`;
  }
  if (variant === 'picture') {
    return `<p>${product.categoryLabel}</p><h3><a href="${product.productPage}">${product.name}</a></h3>
      <p>${ph.monthlyFee || 'Monthly Fee'}${feeSup}: ${fee?.displayValue || ''}</p>${note}<ul>${highlights}</ul>
      <p class="button-wrapper"><a class="button primary" href="${product.productPage}">${ph.learnMore || 'Learn More'}</a>${product.applyUrl ? ` <a class="button secondary" href="${product.applyUrl}">${ph.openAccount || 'Open Account'}</a>` : ''}</p>`;
  }
  return `<p>${product.categoryLabel}</p><h3>${product.name}</h3><p>${product.tagline}</p><ul>${highlights}</ul>
    ${note}${product.offerBadge ? `<p><em>${offerLink(product, product.offerBadge)}${footnoteSup(product.offerFootnotes, product.offerDetailsUrl || product.productPage)}</em></p>` : ''}${priceLine(product, ph)}
    ${product.applyUrl ? button(ph.openAccount || 'Open Account', product.applyUrl, 'primary') : ''}
    <p><a href="${product.productPage}">${ph.viewMoreAccountBenefits || 'View More Account Benefits'}</a></p>`;
}

const FILTER_KEYS = ['category', 'persona'];

// `category | chequing, youth` and `persona | student` rows expand into one row per matching record
async function expandFilterRows(block) {
  const rows = [...block.children].filter((row) => row.children.length === 2
    && FILTER_KEYS.includes(row.firstElementChild.textContent.trim().toLowerCase()));
  if (!rows.length) return;
  const words = (cell) => cell.textContent.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  const filter = Object.fromEntries(rows.map((row) => [
    words(row.firstElementChild)[0], words(row.lastElementChild),
  ]));
  const wanted = (p) => (!filter.category || filter.category.includes(p.category))
    && (filter.persona ? filter.persona.includes(p.persona) : !p.variantOf);
  const products = (await getProducts()).filter(wanted);
  rows[0].before(...products.map((p) => {
    const row = document.createElement('div');
    row.innerHTML = `<div><a href="${p.path}">${p.path}</a></div>`;
    return row;
  }));
  rows.forEach((row) => row.remove());
}

// a row holding only a link to /products/... is filled in from the product index
async function renderProductRows(block) {
  await expandFilterRows(block);
  const rows = [...block.children].filter((row) => {
    const a = row.querySelector('a[href*="/products/"]');
    return a && row.textContent.trim() === a.textContent.trim();
  });
  if (!rows.length) return;
  const ph = await fetchLocalPlaceholders();
  const variant = ['compact', 'picture'].find((word) => block.classList.contains(word));
  await Promise.all(rows.map(async (row) => {
    const product = await getProduct(row.querySelector('a').getAttribute('href'));
    if (!product) { row.remove(); return; }
    const body = document.createElement('div');
    body.innerHTML = productBody(product, ph, variant);
    row.replaceChildren(body);
    if (variant === 'picture' && product.image) {
      const image = document.createElement('div');
      image.append(createOptimizedPicture(product.image, product.imageAlt));
      row.append(image);
    }
  }));
}

function decorateProduct(li) {
  const body = li.querySelector('.cards-card-body');
  const heading = body?.querySelector('.cards-card-title');
  if (!heading) return;

  const category = heading.previousElementSibling;
  const tagline = heading.nextElementSibling;
  const head = document.createElement('div');
  head.className = 'cards-product-head';
  head.append(heading);
  if (tagline?.tagName === 'P' && !tagline.querySelector('a, strong, em, picture')) head.append(tagline);
  body.prepend(head);

  if (category?.tagName === 'P' && !category.querySelector('a, picture')) {
    li.dataset.category = toClassName(category.textContent);
    head.dataset.category = category.textContent.trim();
    category.className = 'cards-product-category';
    head.after(category);
  }

  body.querySelectorAll(':scope > p').forEach((p) => {
    const strong = p.querySelector(':scope > strong');
    const last = p.lastElementChild?.textContent.trim();
    const endsInValue = strong && p.textContent.trim().endsWith(last);
    if (strong && (/\d/.test(p.textContent) || endsInValue)) p.classList.add('cards-product-price');
    else if (p.children.length === 1 && p.firstElementChild.tagName === 'EM') p.classList.add('cards-product-badge');
  });
}

let detailCount = 0;

// expandable: the row's third cell opens as a panel over the whole grid, as on rbcroyalbank.com
function decorateDetail(li, detail, ph) {
  detailCount += 1;
  detail.className = 'cards-card-detail';
  detail.id = `cards-card-detail-${detailCount}`;
  detail.hidden = true;
  const heading = li.querySelector('h2, h3, h4, h5, h6');
  const title = document.createElement('p');
  title.className = 'cards-card-detail-title';
  title.textContent = heading?.textContent || '';
  const icon = li.querySelector('.cards-card-image')?.cloneNode(true);
  const iconButton = (className, label) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.setAttribute('aria-label', `${label}: ${title.textContent}`);
    return el;
  };
  const open = iconButton('cards-card-open', ph.showDetails || 'Show details');
  const close = iconButton('cards-card-close', ph.close || 'Close');
  open.setAttribute('aria-expanded', 'false');
  open.setAttribute('aria-controls', detail.id);
  detail.prepend(...[close, icon, title].filter(Boolean));
  const toggle = (show) => {
    detail.hidden = !show;
    open.setAttribute('aria-expanded', show);
    (show ? close : open).focus();
  };
  open.addEventListener('click', () => toggle(true));
  close.addEventListener('click', () => toggle(false));
  detail.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
  li.append(open, detail);
}

export default async function decorate(block) {
  if (block.classList.contains('tinted-alternate')) block.classList.add('tinted');
  if (block.classList.contains('product')) await renderProductRows(block);
  const expandable = block.classList.contains('expandable');
  const ph = expandable ? await fetchLocalPlaceholders() : {};
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    const detail = expandable && li.children.length > 2 ? li.lastElementChild : null;
    detail?.remove();
    if (block.classList.contains('tile')) {
      decorateTile(li, tileWords(block));
      ul.append(li);
      return;
    }
    [...li.children].forEach((div) => {
      const media = div.querySelector('picture, img, .icon');
      const only = div.children.length === 1 && media && !div.textContent.trim();
      div.className = only ? 'cards-card-image' : 'cards-card-body';
    });
    if (detail) decorateDetail(li, detail, ph);
    ul.append(li);
  });
  ul.querySelectorAll('.cards-card-image img').forEach((img) => {
    if (img.closest('.icon') || new URL(img.src).origin !== window.location.origin) return;
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    (img.closest('picture') || img).replaceWith(optimized);
  });
  if (block.classList.contains('yellow-eyebrow')) {
    ul.querySelectorAll(':scope > li').forEach((li) => {
      const eyebrow = li.querySelector('.cards-card-body > p:first-child:not(:has(a, picture))');
      if (!eyebrow?.nextElementSibling?.matches('h2, h3, h4, h5, h6')) return;
      eyebrow.className = 'cards-card-eyebrow';
      li.prepend(eyebrow);
    });
  }
  ul.querySelectorAll('h2, h3, h4, h5, h6').forEach((heading) => {
    const title = document.createElement('p');
    title.className = `cards-card-title ${heading.tagName.toLowerCase()}`;
    if (heading.id) title.id = heading.id;
    title.append(...heading.childNodes);
    heading.replaceWith(title);
  });
  block.replaceChildren(ul);

  if (block.classList.contains('product')) ul.querySelectorAll(':scope > li').forEach(decorateProduct);
}
