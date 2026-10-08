import { createElement, labelKind, watchStuck } from '../utils/dom.js';
import { decorateRateCode, decorateRates } from '../utils/rates.js';
import linkFootnotes, { revealLegalHash } from '../utils/footnotes.js';
import decorateTooltips from '../utils/tooltips.js';
import decorateDisclosures from '../utils/disclosures.js';
import fetchLocalPlaceholders from '../utils/placeholders.js';
import {
  getMetadata,
  loadHeader,
  loadFooter,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  buildBlock,
} from './aem.js';

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Turns a paragraph holding only an .mp4 link in default content into a video block.
 * @param {Element} main The container element
 */
function buildVideoAutoBlocks(main) {
  main.querySelectorAll(':scope > div > p > a[href*=".mp4"]').forEach((link) => {
    const p = link.parentElement;
    if (p.textContent.trim() !== link.textContent.trim() || p.children.length !== 1) return;
    p.replaceWith(buildBlock('video', { elems: [link] }));
  });
}

/**
 * Turns `/widgets/...` links into widget blocks.
 * @param {Element} main The container element
 */
function buildWidgetAutoBlocks(main) {
  const widgetLinks = [...main.querySelectorAll('a[href*="/widgets/"]')];
  widgetLinks.forEach((link) => {
    if (link.closest('.widget')) return;
    const newLink = link.cloneNode(true);
    const widgetBlock = buildBlock('widget', { elems: [newLink] });
    const p = link.closest('p');
    if (
      p
      && p.querySelectorAll('a').length === 1
      && p.querySelector('a') === link
      && p.textContent.trim() === link.textContent.trim()
    ) {
      p.replaceWith(widgetBlock);
    } else {
      link.replaceWith(widgetBlock);
    }
  });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            // an inline link (e.g. in a column) takes the fragment's content, not its sections
            const content = [...frag.children].flatMap((section) => [...section.children]);
            const host = fragment.parentElement.tagName === 'P' ? fragment.parentElement : fragment;
            host.replaceWith(...content);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
    buildWidgetAutoBlocks(main);
    buildVideoAutoBlocks(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

const imageLink = (a) => [...a.querySelectorAll('img')].some((img) => !img.closest('span.icon'));

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
  });

  main.querySelectorAll('p').forEach((p) => {
    const links = [...p.querySelectorAll('a[href]')];
    if (!links.length) return;

    const probe = p.cloneNode(true);
    probe.querySelectorAll('a[href]').forEach((a) => a.remove());
    if (probe.textContent.trim()) return;

    const buttons = links.filter((a) => {
      if (imageLink(a)) return false;
      const text = a.textContent.trim();
      try {
        if (new URL(a.href).href === new URL(text, window.location).href) return false;
      } catch { /* continue */ }

      const wrapper = a.closest('em, strong');
      if (!wrapper) return false;
      const inner = wrapper.cloneNode(true);
      inner.querySelectorAll('a[href]').forEach((link) => link.remove());
      return !inner.textContent.trim();
    });
    if (!buttons.length && !links.some(imageLink)) p.classList.add('link-wrapper');
    if (buttons.length !== links.length) return;

    const variants = new Map(buttons.map((a) => {
      const strong = a.closest('strong');
      const em = a.closest('em');
      if (strong && em) return [a, 'accent'];
      return [a, strong ? 'primary' : 'secondary'];
    }));

    p.className = 'button-wrapper';
    buttons.forEach((a) => { a.className = `button ${variants.get(a)}`; });
    p.querySelectorAll('em, strong').forEach((w) => w.replaceWith(...w.childNodes));
  });
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i;
const HEX_RE = /#[0-9a-f]{3,8}/gi;

function hexLuminance(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, '$&$&') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function isDarkBackground(color) {
  const hexes = String(color).match(HEX_RE);
  if (!hexes) return false;
  return hexes.reduce((sum, h) => sum + hexLuminance(h), 0) / hexes.length < 0.5;
}

function decorateSectionBackgrounds(main) {
  main.querySelectorAll('.section[data-background]').forEach((section) => {
    const { background } = section.dataset;
    if (!background) return;
    if (IMAGE_EXT_RE.test(background)) {
      const imageUrl = new URL(background, window.location.href);
      // white copy on a photo needs a scrim; a bright sky or highlight would swallow it
      const scrim = section.classList.contains('dark-background') ? 'linear-gradient(rgb(0 0 0 / 45%), rgb(0 0 0 / 45%)), ' : '';
      section.style.backgroundImage = `${scrim}url(${imageUrl.href})`;
      section.style.backgroundSize = 'cover';
      section.style.backgroundPosition = section.dataset.backgroundPosition || 'center';
    } else {
      section.style.background = background;
    }
    section.classList.add('colored-background');
    section.classList.add(isDarkBackground(background) ? 'dark-background' : 'light-background');
  });
}

function decorateFocalPoints(main) {
  main.querySelectorAll('img[data-title*="data-focal"], img[title*="data-focal"]').forEach((img) => {
    const value = img.dataset.title || img.title;
    const [x, y] = value.split(':')[1].split(',').map((n) => parseFloat(n));
    img.removeAttribute('data-title');
    img.removeAttribute('title');
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    img.style.objectPosition = `${x}% ${y}%`;
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
const iconCache = new Map();

async function decorateIcon(span) {
  if (span.childElementCount) return;
  const iconName = [...span.classList].find((c) => c.startsWith('icon-'))?.slice(5);
  if (!iconName) return;
  const src = `${window.hlx.codeBasePath}/icons/${iconName}.svg`;
  if (!iconCache.has(src)) {
    iconCache.set(src, fetch(src)
      .then((resp) => (resp.ok ? resp.text() : ''))
      .catch(() => ''));
  }
  const markup = await iconCache.get(src);
  if (!markup || span.childElementCount) return;
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').querySelector('svg');
  if (!svg || svg.querySelector('parsererror')) return;
  const [width, height] = ['width', 'height'].map((attr) => parseFloat(svg.getAttribute(attr)));
  if (!svg.hasAttribute('viewBox') && width && height) svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.querySelectorAll('script').forEach((node) => node.remove());
  svg.querySelectorAll('*').forEach((node) => {
    [...node.attributes]
      .filter((attr) => attr.name.toLowerCase().startsWith('on'))
      .forEach((attr) => node.removeAttribute(attr.name));
  });
  const prefix = iconName;
  svg.querySelectorAll('style').forEach((style) => {
    style.textContent = style.textContent.replace(/\.(-?[_a-zA-Z][\w-]*)/g, `.${prefix}-$1`);
  });
  svg.querySelectorAll('[class]').forEach((node) => {
    node.setAttribute('class', [...node.classList].map((name) => `${prefix}-${name}`).join(' '));
  });
  svg.querySelectorAll('[id]').forEach((node) => { node.id = `${prefix}-${node.id}`; });
  svg.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const ref = /href$/.test(attr.name) ? /^(#)(.+)/ : /(url\(#)([^)]+)/g;
      attr.value = attr.value.replace(ref, `$1${prefix}-$2`);
    });
  });
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  span.append(svg);
}

export function decorateIcons(element) {
  element.querySelectorAll('span.icon').forEach(decorateIcon);
}

// hosts (and their subdomains) that count as the same site, even when served from another origin
const INTERNAL_DOMAINS = ['rbcroyalbank.com'];

function isExternalLink(a) {
  let url;
  try {
    url = new URL(a.href, window.location.href);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(url.protocol)) return false;
  const host = url.hostname;
  if (host === window.location.hostname) return false;
  return !INTERNAL_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Opens off-site links in a new window, flagging text links (not buttons) with an icon.
 * Safe to run repeatedly, so links that blocks render later can be picked up.
 * @param {Element} element The container to decorate
 */
export function decorateExternalLinks(element) {
  const links = [...element.querySelectorAll('a[href]:not([data-external])')]
    .filter(isExternalLink);
  const icons = [];
  links.forEach((a) => {
    a.dataset.external = '';
    a.target = '_blank';
    const rel = new Set(a.rel.split(/\s+/).filter(Boolean));
    rel.add('noopener');
    a.rel = [...rel].join(' ');

    if (a.matches('.button, .button-wrapper a') || a.querySelector('img, svg, .icon')) return;
    if (!a.textContent.trim()) return;
    // the label lives in aria-label, not text, so link text stays clean for analytics and titles
    const icon = createElement('span', {
      class: 'icon icon-external', role: 'img', 'aria-label': 'opens in a new window',
    });
    a.append(icon);
    icons.push(icon);
    decorateIcon(icon);
  });
  if (!icons.length) return;
  fetchLocalPlaceholders().then((ph) => {
    if (!ph.opensInNewWindow) return;
    icons.forEach((icon) => icon.setAttribute('aria-label', ph.opensInNewWindow));
  });
}

function decorateStickyTitle(main) {
  const section = main.querySelector('.section:has(h1)');
  if (!section || !getMetadata('sticky-title')) return;
  section.classList.add('sticky-title');
  watchStuck(section, (stuck) => section.classList.toggle('is-stuck', stuck));
}

function decorateLabels(main) {
  main.querySelectorAll('.default-content-wrapper > p:has(+ :is(h2, h3))').forEach((p) => {
    const kind = labelKind(p);
    if (kind) p.classList.add('label', `label-${kind}`);
  });
}

export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateStickyTitle(main);
  decorateSectionBackgrounds(main);
  decorateFocalPoints(main);
  decorateBlocks(main);
  decorateLabels(main);
  decorateTooltips(main);
  decorateDisclosures(main);
  decorateButtons(main);
  decorateExternalLinks(main);
  decorateRateCode(main);
  linkFootnotes(main);
}

function reserveHeaderHeight(header) {
  if (!header) return;
  const mode = getMetadata('header');
  if (mode === 'none') header.classList.add('nav-none');
  else if (mode === 'campaign') header.classList.add('nav-campaign');
  else if (getMetadata('section-nav')) header.classList.add('nav-has-section');
  if (mode !== 'none' && getMetadata('breadcrumb')) header.classList.add('nav-has-breadcrumb');
}

async function loadTemplate(main) {
  const template = getMetadata('template');
  if (!template || template === 'style-guide') return;
  const base = `${window.hlx.codeBasePath}/templates/${template}/${template}`;
  try {
    loadCSS(`${base}.css`);
    const mod = await import(`${base}.js`);
    if (mod.default) await mod.default(main);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`template ${template} failed`, e);
  }
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = getMetadata('lang') || 'en-CA';
  decorateTemplateAndTheme();
  reserveHeaderHeight(doc.querySelector('body > header'));
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    await loadTemplate(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  if (window.location.href.includes('/docs/library')) {
    document.body.classList.add('library-page');
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

// links to a /modals/ fragment open it in the modal block
function autolinkModals(element) {
  element.addEventListener('click', async (e) => {
    const origin = e.target.closest('a');
    if (origin && origin.href && origin.href.includes('/modals/')) {
      e.preventDefault();
      const { openModal } = await import(`${window.hlx.codeBasePath}/blocks/modal/modal.js`);
      openModal(origin.href);
    }
  });
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
// a sticky title carries the breadcrumb with it
function adoptBreadcrumb(doc) {
  const title = doc.querySelector('main > .section.sticky-title > div');
  const crumbs = doc.querySelector('header .nav-breadcrumb');
  if (!title || !crumbs) return;
  title.prepend(crumbs);
  doc.querySelector('header').classList.remove('nav-has-breadcrumb');
}

async function loadLazy(doc) {
  autolinkModals(doc);
  loadHeader(doc.querySelector('body > header')).then(() => adoptBreadcrumb(doc));

  const main = doc.querySelector('main');
  import('../utils/pzn.js');
  await loadSections(main);
  decorateExternalLinks(main);
  decorateRates(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();
  revealLegalHash();

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

// GTM is the last thing the page needs; it stays out of the way of consent and personalization
const MARTECH_DELAY_MS = 3000;

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // ?martech=off keeps GTM out of the page entirely, for performance testing
  if (new URLSearchParams(window.location.search).get('martech') !== 'off') import('./gtm.js');
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  // consent gates personalization, so it resolves ahead of the martech delay rather than inside it
  import('./consent-check.js');
  setTimeout(loadDelayed, MARTECH_DELAY_MS);
}

loadPage();
