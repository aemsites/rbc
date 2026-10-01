import { getMetadata, toClassName } from '../../scripts/aem.js';
import { createElement } from '../../utils/dom.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';

const TOPIC_BASE = 'https://www.rbcroyalbank.com/en-ca/my-money-matters/topic/';
// calibrated against the stated read times on the source articles
const WORDS_PER_MINUTE = 185;
const DESKTOP = window.matchMedia('(width >= 900px)');
const OFF = ['off', 'false', 'no', 'none'];

const list = (value) => value.split(',').map((v) => v.trim()).filter(Boolean);
const topicLink = (topic, cls) => createElement('a', { class: cls, href: `${TOPIC_BASE}${toClassName(topic)}/` }, topic);

function formatDate(value) {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  const lang = document.documentElement.lang || 'en-CA';
  return new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(date);
}

function readTime(sections) {
  const authored = parseInt(getMetadata('read-time'), 10);
  if (authored > 0) return authored;
  const words = sections.reduce((n, s) => n + s.textContent.split(/\s+/).filter(Boolean).length, 0);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function buildDateLine(sections, ph) {
  const parts = [];
  const date = getMetadata('publication-date');
  if (date) parts.push(`${ph.published || 'Published'} ${formatDate(date)}`);
  parts.push(`${readTime(sections)} ${ph.minRead || 'Min Read'}`);
  return createElement('p', { class: 'article-date' }, parts.join(' • '));
}

function pageUrl() {
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  const url = new URL(canonical || window.location.href);
  url.hash = '';
  url.search = '';
  return url.href;
}

function buildShare(ph) {
  const url = pageUrl();
  const title = document.querySelector('main h1')?.textContent.trim() || document.title;
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const newWindow = ph.opensInNewWindow || 'opens in a new window';
  const links = [
    ['x', 'X', `https://x.com/intent/tweet?text=${t}&url=${u}`],
    ['facebook', 'Facebook', `https://www.facebook.com/sharer.php?u=${u}`],
    ['linkedin', 'LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
  ].map(([key, label, href]) => createElement('li', {}, createElement('a', {
    class: `article-share-${key}`, href, target: '_blank', rel: 'noopener', 'aria-label': `${ph.shareOn || 'Share on'} ${label} (${newWindow})`,
  }, label)));

  const body = `${ph.shareEmailBody || 'I thought you might be interested in this article from RBC:'} ${url}`;
  links.push(createElement('li', {}, createElement('a', {
    class: 'article-share-email', href: `mailto:?subject=${t}&body=${encodeURIComponent(body)}`,
  }, ph.email || 'Email')));

  const copyLabel = ph.copyUrl || 'Copy URL';
  const copy = createElement('button', { type: 'button', class: 'article-share-copy' }, copyLabel);
  const status = createElement('span', { class: 'article-share-status', role: 'status' });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      copy.textContent = ph.copied || 'Copied';
      status.textContent = ph.linkCopied || 'Link copied to clipboard';
      setTimeout(() => { copy.textContent = copyLabel; status.textContent = ''; }, 2000);
    } catch { /* clipboard blocked; the address bar still has the link */ }
  });
  links.push(createElement('li', {}, [copy, status]));

  return createElement('ul', { class: 'article-share', 'aria-label': ph.shareThisArticle || 'Share This Article' }, links);
}

// highlights the link for the last heading scrolled past the top third of the viewport
function trackActive(nav, headings) {
  const links = [...nav.querySelectorAll('a')];
  let frame;
  const update = () => {
    frame = null;
    const line = window.innerHeight / 3;
    let index = 0;
    headings.forEach((h, i) => {
      // sections stay hidden until loaded; their headings report a top of 0
      if (h.getClientRects().length && h.getBoundingClientRect().top < line) index = i;
    });
    links.forEach((a, i) => (i === index ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
  };
  window.addEventListener('scroll', () => { frame = frame || requestAnimationFrame(update); }, { passive: true });
  update();
}

function buildToc(sections, ph) {
  // callouts (TLDR, CTAs) are asides, not chapters of the article
  const headings = sections.filter((s) => !s.classList.contains('callout'))
    .flatMap((s) => [...s.querySelectorAll(':scope > .default-content-wrapper > h2')]);
  if (headings.length < 2) return null;

  const items = headings.map((h) => {
    h.id = h.id || toClassName(h.textContent);
    return createElement('li', {}, createElement('a', { href: `#${h.id}` }, h.textContent.trim()));
  });
  const label = ph.onThisPage || 'On this page';
  const details = createElement('details', {}, [
    createElement('summary', {}, label),
    createElement('ul', {}, items),
  ]);
  // always expanded beside the article, a collapsed jump menu above it on mobile
  const sync = () => { details.open = DESKTOP.matches; };
  DESKTOP.addEventListener('change', sync);
  sync();
  details.addEventListener('click', (e) => {
    if (e.target.closest('a') && !DESKTOP.matches) details.open = false;
  });

  const nav = createElement('nav', { class: 'article-toc', 'aria-label': label }, details);
  trackActive(nav, headings);
  return nav;
}

function decorateHeader(header, sections, ph, options) {
  const content = header.querySelector('.default-content-wrapper') || header.firstElementChild;
  const h1 = header.querySelector('h1');
  if (!content || !h1) return null;
  header.classList.add('article-header');

  const category = getMetadata('category');
  if (options.category && category) h1.before(topicLink(category, 'article-category'));

  const author = getMetadata('author');
  if (options.byline && author) {
    h1.after(createElement('p', { class: 'article-byline' }, `${ph.by || 'By'} ${author}`));
  }

  const picture = content.querySelector('picture');
  const image = picture?.closest('p') || picture;
  image?.classList.add('article-image');
  const text = createElement('div', { class: 'article-header-text' });
  text.append(...[...content.children].filter((el) => el !== image));
  content.prepend(text);

  const meta = createElement('div', { class: 'article-meta' }, buildDateLine(sections, ph));
  header.append(meta);
  return meta;
}

function buildEnd(ph) {
  const children = [
    createElement('p', { class: 'article-end-title' }, createElement('strong', {}, ph.shareThisArticle || 'Share This Article')),
    buildShare(ph),
  ];
  const topics = list(getMetadata('topics'));
  if (topics.length) {
    children.push(createElement('div', { class: 'article-topics' }, [
      createElement('p', {}, ph.topics || 'Topics:'),
      ...topics.map((t) => topicLink(t, 'article-topic')),
    ]));
  }
  return createElement('div', { class: 'section article-end' }, createElement('div', {}, children));
}

/**
 * Shared article layout: header details, share links, an "on this page" rail and the
 * closing share/topics strip. Everything here is derived from metadata and headings, so
 * authors only write the article.
 * @param {Element} main the main element
 * @param {object} [options] what this flavour of article shows
 */
export async function decorateArticle(main, options = {}) {
  const opts = {
    category: true, byline: true, endShare: true, shareInRail: true, ...options,
  };
  const ph = await fetchLocalPlaceholders();
  const all = [...main.querySelectorAll(':scope > .section')];
  const header = all.find((s) => s.querySelector('h1'));
  if (!header) return;
  const sections = all.slice(all.indexOf(header) + 1);

  const meta = decorateHeader(header, sections, ph, opts);
  sections.forEach((s) => s.classList.add('article-body'));

  if (opts.endShare) {
    const end = buildEnd(ph);
    end.classList.add('article-body');
    (sections.at(-1) || header).after(end);
    sections.push(end);
  }

  const toc = OFF.includes(getMetadata('toc').toLowerCase()) ? null : buildToc(sections, ph);
  if (!toc) {
    main.classList.add('article-single');
    meta?.append(buildShare(ph));
    return;
  }

  const railContent = [toc];
  if (opts.shareInRail) railContent.unshift(buildShare(ph));
  else meta?.append(buildShare(ph));
  const rail = createElement('aside', { class: 'section article-rail' }, createElement('div', {}, railContent));
  const first = all.indexOf(header) + 2;
  rail.style.setProperty('--rail-row', first);
  rail.style.setProperty('--rail-span', sections.length);
  // the jump menu reads first on mobile, right under the title
  header.after(rail);
  main.classList.add('article-has-rail');
}

export default async function decorate(main) {
  await decorateArticle(main);
}
