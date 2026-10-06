import { createElement, labelKind } from '../../utils/dom.js';

export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);
  block.style.setProperty('--columns-count', cols.length);

  // authored width ratio, e.g. columns (70-30); ignored unless it matches the column count
  const ratio = [...block.classList].find((c) => /^\d+(-\d+)+$/.test(c));
  if (ratio) {
    const parts = ratio.split('-');
    if (parts.length === cols.length) {
      block.style.setProperty('--columns-ratio', parts.map((n) => `${n}fr`).join(' '));
    }
  }

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture, img');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });

  block.querySelectorAll('p > .icon:only-child').forEach((icon) => {
    if (!icon.parentElement.textContent.replace(icon.textContent, '').trim()) icon.parentElement.classList.add('columns-icon');
  });

  // a label above a heading or link line; a promotional one followed by copy heads an offer box,
  // up to the next heading or button
  block.querySelectorAll('p').forEach((p) => {
    const kind = labelKind(p);
    if (!kind) return;
    const next = p.nextElementSibling;
    const link = next?.querySelector('a');
    const aboveLink = link && next.textContent.trim() === link.textContent.trim();
    if (next?.matches('h2, h3, h4, h5, h6') || aboveLink) {
      p.classList.add('label', `label-${kind}`);
    } else if (kind === 'promo' && next && !next.matches('.button-wrapper')) {
      const box = createElement('div', { class: 'offer-box' });
      p.before(box);
      p.className = 'offer-label';
      let sibling = p;
      while (sibling && !sibling.matches('h2, h3, h4, h5, h6, .button-wrapper')) {
        const following = sibling.nextElementSibling;
        box.append(sibling);
        sibling = following;
      }
    }
  });

  // slide-in: the first column enters from the left, the rest from the right, once in view
  if (block.classList.contains('slide-in')) {
    block.classList.add('slide-in-ready');
    new IntersectionObserver(([entry], observer) => {
      if (!entry.isIntersecting) return;
      block.classList.add('in-view');
      observer.disconnect();
    }, { threshold: 0.25 }).observe(block);
  }
}
