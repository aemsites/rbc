import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { createElement as el } from '../../utils/dom.js';

const BAR_BY_LANG = { 'fr-CA': '/fr/footer' };

function buildColumns(fragment) {
  const columns = el('div', { class: 'footer-columns' });
  fragment.querySelectorAll(':scope > .section').forEach((section) => {
    const content = section.querySelector(':scope > div') || section;
    if (!content.querySelector('h2, h3')) return;
    const col = el('div', { class: 'footer-col' });
    col.append(...content.children);
    columns.append(col);
  });
  return columns.children.length ? columns : null;
}

function buildBar(fragment) {
  const source = el('div');
  fragment.querySelectorAll(':scope > .section > div').forEach((group) => {
    source.append(...group.children);
  });

  const left = el('div', { class: 'footer-bar-left' });
  const right = el('div', { class: 'footer-bar-right' });
  source.querySelectorAll('p').forEach((p) => {
    if (p.querySelector('a[href="#skip-nav"]')) {
      p.className = 'footer-totop';
      p.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      right.append(p);
    } else if (p.querySelector('.icon')) {
      p.className = 'footer-social';
      right.append(p);
    } else if (p.querySelector('a')) {
      p.className = 'footer-legal';
      left.append(p);
    } else {
      p.className = 'footer-copyright';
      p.textContent = p.textContent.replace(/(©\s*\d{4})-\d{4}/, `$1-${new Date().getFullYear()}`);
      left.append(p);
    }
  });

  if (!left.children.length && !right.children.length) return null;
  return el('div', { class: 'footer-bar' }, [left, right]);
}

function band(name, child) {
  const wrap = el('div', { class: name });
  wrap.append(el('div', { class: 'footer-inner' }, child));
  return wrap;
}

export default async function decorate(block) {
  block.textContent = '';

  const sectionMeta = getMetadata('footer');
  if (sectionMeta) {
    const fragment = await loadFragment(new URL(sectionMeta, window.location).pathname);
    const columns = fragment && buildColumns(fragment);
    if (columns) block.append(band('footer-columns-band', columns));
  }

  const barPath = BAR_BY_LANG[getMetadata('lang') || document.documentElement.lang] || '/footer';
  const barFragment = await loadFragment(barPath);
  const bar = barFragment && buildBar(barFragment);
  if (bar) block.append(band('footer-bar-band', bar));
}
