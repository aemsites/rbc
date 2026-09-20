import {
  getMetadata,
  loadHeader,
  loadFooter,
  decorateIcons,
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
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
    buildWidgetAutoBlocks(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

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
      if (a.querySelector('img')) return false;
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
      const { pathname } = new URL(background, window.location.href);
      section.style.backgroundImage = `url('${pathname}?width=2000&format=webply&optimize=medium')`;
      section.style.backgroundSize = 'cover';
      section.style.backgroundPosition = 'center';
    } else {
      section.style.background = background;
    }
    section.classList.add('colored-background');
    section.classList.add(isDarkBackground(background) ? 'dark-background' : 'light-background');
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
const iconCache = new Map();

/**
 * Replaces the <img> the boilerplate inserts with an inline <svg>, so icons can take their
 * colour from CSS. aem.js is vendored, so this runs as a second pass over the same spans.
 * @param {Element} span The span.icon holding the image
 */
async function inlineIcon(span) {
  const img = span.querySelector(':scope > img');
  if (!img) return;
  const { src } = img;
  if (!iconCache.has(src)) {
    iconCache.set(src, fetch(src)
      .then((resp) => (resp.ok ? resp.text() : ''))
      .catch(() => ''));
  }
  const markup = await iconCache.get(src);
  if (!markup || !span.contains(img)) return;
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').querySelector('svg');
  if (!svg || svg.querySelector('parsererror')) return;
  svg.querySelectorAll('script').forEach((node) => node.remove());
  svg.querySelectorAll('*').forEach((node) => {
    [...node.attributes]
      .filter((attr) => attr.name.toLowerCase().startsWith('on'))
      .forEach((attr) => node.removeAttribute(attr.name));
  });
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  img.replaceWith(svg);
}

/**
 * Inlines every authored icon in the element.
 * @param {Element} element The container element
 */
function inlineIcons(element) {
  element.querySelectorAll('span.icon').forEach(inlineIcon);
}

// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  inlineIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateSectionBackgrounds(main);
  decorateBlocks(main);
  decorateButtons(main);
}

function reserveHeaderHeight(header) {
  if (!header) return;
  const mode = getMetadata('header');
  if (mode === 'none') header.classList.add('nav-none');
  else if (mode === 'campaign') header.classList.add('nav-campaign');
  else if (getMetadata('section-nav')) header.classList.add('nav-has-section');
  if (mode !== 'none' && getMetadata('breadcrumb')) header.classList.add('nav-has-breadcrumb');
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
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
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

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('body > header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  import('./consent-check.js');
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
