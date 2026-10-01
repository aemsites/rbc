/* eslint-disable */
/* global WebImporter */

// Metadata the source pages don't expose (alternate-language paths, breadcrumb JSON-LD),
// carried over from the previously published pages, keyed by document path.
const LEGACY_METADATA = {
  "/bank-accounts/savings-accounts/how-does-interest-work-on-a-savings-account": {
    "hreflang-fr-ca": "/fr/comptes-bancaires/comptes-depargne/fonctionnement-des-interets-sur-un-compte-depargne",
    "json-ld": "{\"@context\":\"https://schema.org\",\"@type\":\"BreadcrumbList\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"Personal\",\"item\":\"https://www.rbcroyalbank.com\"},{\"@type\":\"ListItem\",\"position\":2,\"name\":\"Bank Accounts\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts\"},{\"@type\":\"ListItem\",\"position\":3,\"name\":\"Savings Accounts\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts/savings-accounts\"},{\"@type\":\"ListItem\",\"position\":4,\"name\":\"How Does Interest Work on a Savings Account?\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts/savings-accounts/how-does-interest-work-on-a-savings-account\"}]}"
  },
  "/bank-accounts/savings-accounts/how-to-choose-the-best-savings-account-for-me": {
    "hreflang-fr-ca": "/fr/comptes-bancaires/comptes-depargne/choisir-le-meilleur-compte-depargne-pour-moi",
    "json-ld": "{\"@context\":\"https://schema.org\",\"@type\":\"BreadcrumbList\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"Personal\",\"item\":\"https://www.rbcroyalbank.com\"},{\"@type\":\"ListItem\",\"position\":2,\"name\":\"Bank Accounts\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts\"},{\"@type\":\"ListItem\",\"position\":3,\"name\":\"Savings Accounts\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts/savings-accounts\"},{\"@type\":\"ListItem\",\"position\":4,\"name\":\"How to Choose the Best Savings Account for Me\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts/savings-accounts/how-to-choose-the-best-savings-account-for-me\"}]}"
  },
  "/bank-accounts/savings-accounts/what-are-the-different-types-of-savings-accounts-in-canada": {
    "hreflang-fr-ca": "/fr/comptes-bancaires/comptes-depargne/quels-sont-les-differents-types-de-compte-depargne-au-canada",
    "json-ld": "{\"@context\":\"https://schema.org\",\"@type\":\"BreadcrumbList\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"Personal\",\"item\":\"https://www.rbcroyalbank.com\"},{\"@type\":\"ListItem\",\"position\":2,\"name\":\"Bank Accounts\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts\"},{\"@type\":\"ListItem\",\"position\":3,\"name\":\"Savings Accounts\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts/savings-accounts\"},{\"@type\":\"ListItem\",\"position\":4,\"name\":\"What Are the Different Types of Savings Accounts in Canada?\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts/savings-accounts/what-are-the-different-types-of-savings-accounts-in-canada\"}]}"
  },
  "/bank-accounts/savings-accounts/what-is-a-savings-account-and-how-do-i-use-it": {
    "hreflang-fr-ca": "/fr/comptes-bancaires/comptes-depargne/quest-ce-quun-compte-depargne-et-comment-lutiliser",
    "json-ld": "{\"@context\":\"https://schema.org\",\"@type\":\"BreadcrumbList\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"Personal\",\"item\":\"https://www.rbcroyalbank.com\"},{\"@type\":\"ListItem\",\"position\":2,\"name\":\"Bank Accounts\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts\"},{\"@type\":\"ListItem\",\"position\":3,\"name\":\"Savings Accounts\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts/savings-accounts\"},{\"@type\":\"ListItem\",\"position\":4,\"name\":\"What is a Savings Account and How Do I Use It?\",\"item\":\"https://www.rbcroyalbank.com/bank-accounts/savings-accounts/what-is-a-savings-account-and-how-do-i-use-it\"}]}"
  },
  "/new-to-canada/international-students/article/how-to-find-the-best-bank-account-for-international-students": {
    "hreflang-fr-ca": "/nouveaux-arrivants/etudiants-etrangers/article/trouver-le-meilleur-compte-bancaire-pour-etudiant-etranger",
    "hreflang-zh-hans": "https://www.rbcroyalbank.com/sc/new-to-canada/international-students/article/how-to-find-the-best-bank-account-for-international-students.html",
    "hreflang-zh-hant": "https://www.rbcroyalbank.com/tc/new-to-canada/international-students/article/how-to-find-the-best-bank-account-for-international-students.html",
    "json-ld": "{\"@context\":\"https://schema.org\",\"@type\":\"BreadcrumbList\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"Personal\",\"item\":\"https://www.rbcroyalbank.com/personal.html\"},{\"@type\":\"ListItem\",\"position\":2,\"name\":\"Newcomers to Canada\",\"item\":\"https://www.rbcroyalbank.com/new-to-canada\"},{\"@type\":\"ListItem\",\"position\":3,\"name\":\"Studying in Canada\",\"item\":\"https://www.rbcroyalbank.com/new-to-canada/international-students\"},{\"@type\":\"ListItem\",\"position\":4,\"name\":\"How to Find the Best Bank Account for International Students?\",\"item\":\"https://www.rbcroyalbank.com/new-to-canada/international-students/article/how-to-find-the-best-bank-account-for-international-students\"}]}"
  }
};

/**
 * Transformer: RBC Royal Bank (My Money Matters article) cleanup + page metadata.
 *
 * All selectors verified against migration-work/cleaned.html (rendered DOM) and the raw
 * server HTML of the four savings-account articles:
 *   header, footer                                     site chrome
 *   #sticky-wrapper.sticky-wrapper > .nav-bar > nav.breadcrumb-wpr
 *   section.home-map > ... > aside.callout-inner      "Find a Branch or ATM Near You"
 *   #onetrust-consent-sdk                              cookie banner
 *   .grecaptcha-badge                                  recaptcha
 *   .social-block-wpr-tablet-only / .social-block-column-wpr / .socials-block / .social-links /
 *   .centered-template-social-section                  share lists
 *   .wp-block-rbc-rbc-blocks-toc-for-mmm, .rbc-blocks-toc-for-mmm-*, .floating-side-nav (TOC rail)
 *   #mobileStickyNav                                   TOC mobile dropdown
 *   .related-topics-links                              topics (captured into metadata)
 *   .wp-block-rbc-single-article-header .btn.topic / p.author-text / p.cover-pub-line
 *                                                      pill / byline / date (captured into metadata)
 *   hr.mobile-only (inside the article header)         decorative rule, would become a section break
 *   .wp-block-tk-spacer, .wp-block-spacer, #unsticky, #start-sticky, .to-top, .high-contrast-test
 *
 * beforeTransform: capture metadata (needs the article header, topics, TOC and
 * head data before anything is removed), build the Metadata block, drop header-only bits,
 * convert ul.numbered-list -> ol (before parsers so accordion/table cells get it too).
 * afterTransform: remove site chrome / widgets, empty paragraphs, h- ids, absolutise images,
 * make the custom Metadata block the only one (strip head tags the default rule reads).
 */

const H = { before: 'beforeTransform', after: 'afterTransform' };
const ORIGIN = 'https://www.rbcroyalbank.com';
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

function getDoc(element, payload) {
  return (payload && payload.document) || element.ownerDocument || document;
}

function text(el) {
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
}

function metaContent(doc, selector) {
  const el = doc.querySelector(selector);
  return el ? (el.getAttribute('content') || '').trim() : '';
}

function absUrl(href) {
  try {
    return new URL(href, ORIGIN).href;
  } catch (e) {
    return href;
  }
}

/** Site-relative path for rbcroyalbank.com links (strip .html and trailing /index). */
function sitePath(href) {
  if (!href) return '';
  let u;
  try {
    u = new URL(href, ORIGIN);
  } catch (e) {
    return href;
  }
  if (!/(^|\.)rbcroyalbank\.com$/i.test(u.hostname) && !/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) {
    return u.href;
  }
  let p = u.pathname.replace(/\.html?$/i, '').replace(/\/index$/i, '').replace(/\/+$/, '');
  if (!p) p = '/';
  return p;
}

function cleanTitle(raw) {
  const t = (raw || '').replace(/[\n\t]/g, '').trim();
  // Source <title> is rendered twice back to back ("XX"); keep a single copy.
  if (t.length % 2 === 0) {
    const half = t.slice(0, t.length / 2);
    if (half && half === t.slice(t.length / 2)) return half.trim();
  }
  return t;
}

/** Minutes from "… • 10 Min Read", kept so the page shows the source's stated read time. */
function parseReadTime(str) {
  const m = /(\d+)\s*min(ute)?s?\s+read/i.exec(str || '');
  return m ? m[1] : '';
}

function parsePublished(str) {
  const m = /Published\s+([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/i.exec(str || '');
  if (!m) return '';
  const idx = MONTHS.findIndex((mo) => mo.startsWith(m[1].toLowerCase().slice(0, 3)));
  if (idx < 0) return '';
  return `${m[3]}-${String(idx + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

function findBreadcrumbList(doc) {
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const n of node) {
        const r = visit(n);
        if (r) return r;
      }
      return null;
    }
    const type = node['@type'];
    if (type === 'BreadcrumbList' || (Array.isArray(type) && type.includes('BreadcrumbList'))) return node;
    if (node['@graph']) return visit(node['@graph']);
    return null;
  };
  for (const s of scripts) {
    try {
      const found = visit(JSON.parse(s.textContent));
      if (found) return found;
    } catch (e) {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

function pagePath(payload) {
  try {
    return new URL(payload.params.originalURL).pathname.replace(/\.html?$/, '').replace(/\/$/, '');
  } catch (e) {
    return '';
  }
}

function buildMetadata(element, doc, payload) {
  const cells = {};
  const header = element.querySelector('.wp-block-rbc-single-article-header');

  const title = cleanTitle(doc.title || text(doc.querySelector('title')));
  if (title) cells.title = title;

  const desc = metaContent(doc, 'meta[name="description"]') || metaContent(doc, 'meta[property="og:description"]');
  if (desc) cells.description = desc;

  let image = metaContent(doc, 'meta[property="og:image"]') || metaContent(doc, 'meta[name="twitter:image"]');
  if (!image && header) {
    const heroImg = header.querySelector('.featured-image-wrapper img, img');
    if (heroImg) image = heroImg.getAttribute('src');
  }
  if (image) {
    const img = doc.createElement('img');
    img.setAttribute('src', absUrl(image.replace(/,\s*$/, '')));
    cells.image = img;
  }

  cells.template = (payload && payload.template && payload.template.name) || 'article';

  if (header) {
    const pill = header.querySelector('.btn.topic a, a.primary-taxonomy');
    if (pill && text(pill)) cells.category = text(pill);

    const byline = header.querySelector('p.author-text');
    if (byline && text(byline)) cells.author = text(byline).replace(/^By\s+/i, '');

    const pub = header.querySelector('p.cover-pub-line');
    const date = parsePublished(text(pub));
    if (date) cells['publication-date'] = date;
    const minutes = parseReadTime(text(pub));
    if (minutes) cells['read-time'] = minutes;
  }

  const topics = [...element.querySelectorAll('.related-topics-links a')].map(text).filter(Boolean);
  if (topics.length) cells.topics = topics.join(', ');

  if (!element.querySelector('.wp-block-rbc-rbc-blocks-toc-for-mmm')) cells.toc = 'off';

  const jsonLd = findBreadcrumbList(doc);

  doc.querySelectorAll('link[rel="alternate"][hreflang]').forEach((link) => {
    const lang = (link.getAttribute('hreflang') || '').toLowerCase();
    const href = link.getAttribute('href');
    if (!href) return;
    if (lang === 'fr-ca' || lang === 'fr') {
      if (!cells['hreflang-fr-ca']) cells['hreflang-fr-ca'] = sitePath(href);
    } else if (lang.startsWith('zh')) {
      if (!cells['alternate-zh']) cells['alternate-zh'] = href;
    } else if (lang === 'en-us' || lang.endsWith('-us')) {
      if (!cells['alternate-us']) cells['alternate-us'] = href;
    }
  });
  // Fallback: header language switcher (a.lang-ch / a.lang-us in cleaned.html).
  const langCh = doc.querySelector('a.lang-ch[href]');
  if (!cells['alternate-zh'] && langCh) cells['alternate-zh'] = langCh.getAttribute('href');
  const langUs = doc.querySelector('a.lang-us[href]');
  if (!cells['alternate-us'] && langUs) cells['alternate-us'] = langUs.getAttribute('href');

  if (jsonLd) cells['json-ld'] = JSON.stringify(jsonLd);

  // The source exposes no hreflang links or breadcrumb JSON-LD; reuse the published values.
  Object.assign(cells, LEGACY_METADATA[pagePath(payload)] || {});

  return WebImporter.Blocks.createBlock(doc, { name: 'Metadata', cells });
}

/* ---------------------------------------------------------------------------------------
 * Template "newcomer-article" (/new-to-canada/international-students/article/*).
 * Selectors verified in migration-work/cleaned.html and the raw server HTML:
 *   main > div.pad-tb-hlf > .nav-bar > nav.breadcrumb-wpr   breadcrumb
 *   section.banner.html-bnr .banner-img[data-img]            title-box image (CSS background)
 *   section > .section-inner > div.grid-wpr.eh-wpr           "Published … • 9 Min Read" (p.disclaimer)
 *                                                            + share row (.table-wpr > a.popup / button)
 *   .col-3.mobile-only > .sticky-side-nav-mob > select#side-nav-mob   mobile TOC
 *   .col-3.desktop-only > #sticky-wrapper > .sticky-side-nav          desktop TOC
 *   h2.anchor                                                 TOC anchor class on headings
 *   section.disclaimer                                        legal (disclaimers parser, kept)
 * ------------------------------------------------------------------------------------- */
const NEWCOMER = 'newcomer-article';

function templateName(payload) {
  return (payload && payload.template && payload.template.name) || '';
}

/** Absolute URL of the title-box image: data-img, else CSS background, else inner img. */
function bannerImageUrl(element) {
  const box = element.querySelector('section.banner.html-bnr .banner-img');
  if (!box) return '';
  let src = (box.getAttribute('data-img') || '').trim();
  if (!src) {
    const m = /url\((['"]?)([^'")]+)\1\)/.exec(box.getAttribute('style') || '');
    if (m) src = m[2];
  }
  if (!src) {
    const img = box.querySelector('img[src]');
    if (img) src = img.getAttribute('src');
  }
  return src ? absUrl(src) : '';
}

/** div.grid-wpr.eh-wpr rows that hold the "Published …" line (+ share links). */
function publishedRows(element) {
  return [...element.querySelectorAll('div.grid-wpr.eh-wpr')]
    .filter((row) => [...row.querySelectorAll('p.disclaimer')].some((p) => /^published\b/i.test(text(p))));
}

function buildNewcomerMetadata(element, doc, payload) {
  const cells = {};

  const title = cleanTitle(doc.title || text(doc.querySelector('title')));
  if (title) cells.title = title;

  const desc = metaContent(doc, 'meta[name="description"]') || metaContent(doc, 'meta[property="og:description"]');
  if (desc) cells.description = desc;

  let image = metaContent(doc, 'meta[property="og:image"]') || metaContent(doc, 'meta[name="twitter:image"]');
  if (image) image = absUrl(image.replace(/,\s*$/, ''));
  else image = bannerImageUrl(element);
  if (image) {
    const img = doc.createElement('img');
    img.setAttribute('src', image);
    cells.image = img;
  }

  cells.template = templateName(payload) || NEWCOMER;

  const pubRow = publishedRows(element)[0];
  const pub = pubRow && [...pubRow.querySelectorAll('p.disclaimer')].find((p) => /^published\b/i.test(text(p)));
  const date = parsePublished(text(pub));
  if (date) cells['publication-date'] = date;
  const minutes = parseReadTime(text(pub));
  if (minutes) cells['read-time'] = minutes;

  // Alternate-language paths / breadcrumb JSON-LD, when the page exposes them.
  const fr = [...doc.querySelectorAll('link[rel="alternate"][hreflang]')]
    .find((l) => /^fr(-ca)?$/i.test(l.getAttribute('hreflang') || '') && l.getAttribute('href'));
  if (fr) cells['hreflang-fr-ca'] = sitePath(fr.getAttribute('href'));
  const jsonLd = findBreadcrumbList(doc);
  if (jsonLd) cells['json-ld'] = JSON.stringify(jsonLd);

  Object.assign(cells, LEGACY_METADATA[pagePath(payload)] || {});

  return WebImporter.Blocks.createBlock(doc, { name: 'Metadata', cells });
}

function isMetadataTable(table) {
  const first = table.querySelector('tr > th, tr > td');
  return !!first && text(first).toLowerCase() === 'metadata';
}

export default function transform(hookName, element, payload) {
  const doc = getDoc(element, payload);

  const isNewcomer = templateName(payload) === NEWCOMER;

  if (hookName === H.before && isNewcomer) {
    // Capture metadata (title box image, "Published …" date) before anything is removed.
    element.append(buildNewcomerMetadata(element, doc, payload));
    // "Published … • 9 Min Read" + share row: now metadata / template-rendered.
    publishedRows(element).forEach((row) => row.remove());
    WebImporter.DOMUtils.remove(element, ['#onetrust-consent-sdk', '.grecaptcha-badge']);
  }

  if (hookName === H.before && !isNewcomer) {
    // 1. Capture page metadata while every source element still exists.
    const metadata = buildMetadata(element, doc, payload);
    element.append(metadata);

    // 1b. Source markup closes .entry-content early on some pages (what-is: right after the
    // TLDR; types: before the legal collapsible), so parser selectors scoped to
    // .entry-content would miss content. Pull the following siblings back in.
    const entry = element.querySelector('.entry-content');
    if (entry) while (entry.nextSibling) entry.append(entry.nextSibling);

    // 2. Article header bits that are now metadata (pill, byline, date) + decorative hr.
    WebImporter.DOMUtils.remove(element, [
      '.wp-block-rbc-single-article-header .btn.topic',
      '.wp-block-rbc-single-article-header p.author-text',
      '.wp-block-rbc-single-article-header p.cover-pub-line',
      '.wp-block-rbc-single-article-header hr.mobile-only',
      '.wp-block-rbc-single-article-header .centered-template-social-section',
    ]);

    // 3. Overlays / widgets that never contain content.
    WebImporter.DOMUtils.remove(element, ['#onetrust-consent-sdk', '.grecaptcha-badge']);

    // 4. ul.numbered-list -> ol (before parsers so block cells get the fix too).
    element.querySelectorAll('ul.numbered-list').forEach((ul) => {
      const ol = doc.createElement('ol');
      while (ul.firstChild) ol.append(ul.firstChild);
      ul.replaceWith(ol);
    });
  }

  if (hookName === H.after) {
    // Site chrome and non-authorable widgets.
    WebImporter.DOMUtils.remove(element, [
      'header',
      '#side-menu-id',
      '.side-menu',
      '#skip-nav',
      '#sticky-wrapper',
      '.sticky-wrapper',
      'nav.breadcrumb-wpr',
      '.nav-bar',
      'footer',
      'section.home-map',
      '.callout-inner',
      '#onetrust-consent-sdk',
      '.grecaptcha-badge',
      '.social-links',
      '.socials-block',
      '[class*="social-block-wpr"]',
      '.social-block-column-wpr',
      '.centered-template-social-section',
      '.floating-side-nav',
      '.wp-block-rbc-rbc-blocks-toc-for-mmm',
      '[class*="rbc-blocks-toc-for-mmm-"]',
      '#mobileStickyNav',
      '.related-topics-links',
      '.wp-block-tk-spacer',
      '.wp-block-spacer',
      '#unsticky',
      '#start-sticky',
      '.to-top',
      '.high-contrast-test',
      'iframe',
      'noscript',
      'script',
      'style',
      'link',
    ]);

    if (isNewcomer) {
      // Date/share row, mobile + desktop TOC (template-generated), emptied breadcrumb wrapper.
      publishedRows(element).forEach((row) => row.remove());
      WebImporter.DOMUtils.remove(element, [
        '.col-3.mobile-only',
        '.sticky-side-nav-mob',
        'select#side-nav-mob',
        '.col-3.desktop-only',
        '.sticky-side-nav',
      ]);
      element.querySelectorAll('div.pad-tb-hlf').forEach((d) => {
        if (!d.textContent.trim() && !d.querySelector('img, picture, table')) d.remove();
      });
      // TOC anchor class on headings.
      element.querySelectorAll('h1.anchor, h2.anchor, h3.anchor, h4.anchor, h5.anchor, h6.anchor').forEach((h) => {
        h.classList.remove('anchor');
        if (!h.getAttribute('class')) h.removeAttribute('class');
      });
    }

    // Leftover article-header bits (in case beforeTransform ran on a different tree).
    WebImporter.DOMUtils.remove(element, [
      '.wp-block-rbc-single-article-header .btn.topic',
      '.wp-block-rbc-single-article-header p.author-text',
      '.wp-block-rbc-single-article-header p.cover-pub-line',
      '.wp-block-rbc-single-article-header hr.mobile-only',
    ]);

    // "Share This Article" heading paragraph.
    element.querySelectorAll('p').forEach((p) => {
      if (/^share this article$/i.test(text(p))) p.remove();
    });

    // Site-relative links point at pages on the new site, which have no .html extension.
    // Absolute www.rbcroyalbank.com links stay as-is: the live site needs the extension.
    element.querySelectorAll('a[href^="/"]:not([href^="//"])').forEach((a) => {
      const href = a.getAttribute('href');
      const [, path, rest = ''] = /^([^?#]*)(.*)$/.exec(href);
      const clean = path.replace(/\.html?$/i, '').replace(/\/index$/i, '') || '/';
      if (clean !== path) a.setAttribute('href', clean + rest);
    });

    // Analytics beacons (1x1 tracking images) are injected into the page body at runtime.
    element.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!/bat\.bing\.com|facebook\.com\/tr|doubleclick\.net|google-analytics\.com|googletagmanager\.com|analytics\./i.test(src)) return;
      const wrapper = img.closest('p') || img.closest('picture') || img;
      if (wrapper.tagName === 'P' && wrapper.querySelectorAll('img').length > 1) img.remove();
      else wrapper.remove();
    });

    // Zero-width spaces from the source CMS end up in headings (and the generated TOC).
    const walker = doc.createTreeWalker(element, 4 /* NodeFilter.SHOW_TEXT */);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (/[​﻿]/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/[​﻿]/g, '');
    }

    // Empty paragraphs (whitespace / &nbsp; only, no media).
    element.querySelectorAll('p').forEach((p) => {
      if (p.closest('table')) return;
      const t = p.textContent.replace(/[ \s]/g, '');
      if (!t && !p.querySelector('img, picture, video, iframe, a')) p.remove();
    });

    // Strip WordPress anchor ids ("h-...") from headings.
    element.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]').forEach((h) => {
      if (/^h-/.test(h.id)) h.removeAttribute('id');
    });

    // Keep images on absolute https://www.rbcroyalbank.com URLs.
    element.querySelectorAll('img[src]').forEach((img) => {
      const src = img.getAttribute('src');
      if (src && !/^(https?:|data:)/i.test(src)) img.setAttribute('src', absUrl(src));
    });

    // Custom Metadata block wins: keep exactly one, at the very end.
    const metaTables = [...element.querySelectorAll('table')].filter(isMetadataTable);
    if (metaTables.length) {
      const keep = metaTables[0];
      metaTables.slice(1).forEach((t) => t.remove());
      element.append(keep);
      // Remove the head tags WebImporter.rules.createMetadata reads, so the default
      // Metadata block is not generated next to ours.
      if (doc.head) {
        doc.head.querySelectorAll('title, meta[name="description"], meta[property^="og:"], meta[name^="og:"], meta[name^="twitter:"], meta[property^="twitter:"]')
          .forEach((m) => m.remove());
      }
    }
  }
}
