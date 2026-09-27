import { createOptimizedPicture, toClassName } from '../../scripts/aem.js';
import decorateTile from './tiles.js';

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
    if (p.querySelector('strong') && /\d/.test(p.textContent)) p.classList.add('cards-product-price');
    else if (p.children.length === 1 && p.firstElementChild.tagName === 'EM') p.classList.add('cards-product-badge');
  });
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    if (block.classList.contains('tile')) {
      decorateTile(li);
      ul.append(li);
      return;
    }
    [...li.children].forEach((div) => {
      const media = div.querySelector('picture, img, .icon');
      const only = div.children.length === 1 && media && !div.textContent.trim();
      div.className = only ? 'cards-card-image' : 'cards-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('.cards-card-image img').forEach((img) => {
    if (img.closest('.icon') || new URL(img.src).origin !== window.location.origin) return;
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    (img.closest('picture') || img).replaceWith(optimized);
  });
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
