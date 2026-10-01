// Page metadata from the live <head>, following the pilot conventions:
// title, description, keywords, image, breadcrumb-title, json-ld, hreflang-*, lang.
import PAGES from './pages.js';
import { LIVE, absolute, img } from './inline.js';

const HREFLANG = {
  EN: 'hreflang-en-ca', FR: 'hreflang-fr-ca', SC: 'hreflang-zh-hans', TC: 'hreflang-zh-hant',
};
const LANG = { FR: 'fr-CA' };

const pageFor = (url) => {
  const { pathname } = new URL(url);
  return PAGES.find((p) => new URL(p.url).pathname === pathname);
};

// breadcrumb items point at the EDS URL of in-scope pages, without trailing slashes (as the pilot)
function normaliseItem(item) {
  if (typeof item !== 'string') return item;
  const page = pageFor(absolute(item));
  return page ? `${LIVE}${page.path === '/' ? '' : page.path}` : item.replace(/\/$/, '');
}

function jsonLd(doc, report) {
  return [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
    // live JSON-LD has raw newlines/tabs inside strings
    const text = [...s.textContent].map((c) => (c.charCodeAt(0) < 32 ? ' ' : c)).join('');
    try { return JSON.parse(text); } catch { report?.push('unparseable json-ld'); return null; }
  }).filter(Boolean).map((data) => {
    if (data['@type'] !== 'BreadcrumbList') return data;
    data.itemListElement?.forEach((li) => { li.item = normaliseItem(li.item); });
    return data;
  });
}

export default function pageMetadata(doc, url, report) {
  const meta = {};
  const content = (sel) => doc.head.querySelector(sel)?.getAttribute('content')?.trim();
  const title = doc.querySelector('title')?.textContent.trim();
  if (title) meta.title = title;
  if (content('meta[name="description"]')) meta.description = content('meta[name="description"]');
  const ogImage = content('meta[property="og:image"]');
  if (ogImage) meta.image = img(doc, ogImage);
  if (content('meta[name="keywords"]')) meta.keywords = content('meta[name="keywords"]');

  const page = pageFor(url);
  PAGES.filter((p) => page && p.group === page.group && p.lang !== page.lang && !p.outOfScope)
    .forEach((p) => { meta[HREFLANG[p.lang]] = p.path; });
  if (page && LANG[page.lang]) meta.lang = LANG[page.lang];

  const ld = jsonLd(doc, report);
  const crumbs = ld.find((d) => d['@type'] === 'BreadcrumbList')?.itemListElement;
  if (crumbs?.length) meta['breadcrumb-title'] = crumbs[crumbs.length - 1].name;
  if (ld.length) meta['json-ld'] = JSON.stringify(ld.length === 1 ? ld[0] : ld);
  return meta;
}
