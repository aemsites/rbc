/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: RBC My Money Matters article sections.
 *
 * Source layout (verified in migration-work/cleaned.html and the raw HTML of all four
 * savings-account articles): the article header (.wp-block-rbc-single-article-header) sits
 * outside the body; the body (.entry-content) nests its content in layout wrappers
 * (section.wp-block-rbc-section-block > .wp-block-rbc-section-inner-block, div.flex >
 * div.flex-item). Special units live at varying depths inside those wrappers:
 *   tldr   .block-wpr.top-line-blue whose heading is "TLDR"
 *   cta    any other .block-wpr.top-line-blue ("Savings Calculator")
 *   promo  .block-wpr.bg-light-blue (what-is page) /
 *          .wp-block-group.has-rbc-bright-blue-tint-4-background-color (types page, same promo)
 *   faq    .inner-section-cool-white (accordion), or on the what-is page a plain
 *          h2 "Frequently asked questions..." + h3/p Q&A up to the legal collapsible
 *   legal  .wp-block-rbc-rbc-default-collapsible
 *
 * beforeTransform (all elements still exist, parsers have not run):
 *   1. flatten the layout wrappers inside .entry-content,
 *   2. move the H1 + hero image to the top of .entry-content (section 1),
 *   3. rewrite tldr / cta / promo into flat default content,
 *   4. on the what-is page wrap the plain FAQ into .inner-section-cool-white > .accordion >
 *      .accordion-panel markup (same shape as the other pages) so the accordion parser
 *      (.inner-section-cool-white .accordion) handles it,
 *   5. insert <hr> section breaks + a marker div where each Section Metadata block goes.
 *   Section/metadata markers are siblings of the units, never inside an element a parser
 *   replaces, so they survive parsing.
 * afterTransform: replace markers with Section Metadata blocks, then normalise <hr>
 * (no leading/trailing/duplicate breaks after cleanup removed share/topic leftovers).
 *
 * Section styles come from payload.template.sections (by name); background colours are not
 * in the page-templates schema, so they are hardcoded here.
 */

const H = { before: 'beforeTransform', after: 'afterTransform' };
const META_ATTR = 'data-excat-section-meta';

const DEFAULT_STYLES = { tldr: 'callout', 'cta-callout': 'callout, center', promo: 'center', faq: null };
const BACKGROUNDS = { faq: '#f5f8f9', promo: '#edf7fc' };

const SEL = {
  header: '.wp-block-rbc-single-article-header',
  entry: '.entry-content',
  topLine: '.block-wpr.top-line-blue',
  promo: '.block-wpr.bg-light-blue, .wp-block-group.has-rbc-bright-blue-tint-4-background-color',
  faq: '.inner-section-cool-white',
  legal: '.wp-block-rbc-rbc-default-collapsible',
  // pure layout wrappers inside .entry-content
  wrapper: 'section.wp-block-rbc-section-block, div.wp-block-rbc-section-inner-block:not(.inner-section-cool-white), div.flex, div.flex-item',
  // non-authorable leftovers removed by the cleanup transformer; never start a section
  noise: '.socials-block, .social-links, [class*="social-block"], .related-topics-links, .wp-block-tk-spacer, .wp-block-spacer, #start-sticky, #mobileStickyNav',
};

function text(el) {
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
}

function sectionStyle(payload, name) {
  const sections = (payload && payload.template && payload.template.sections) || [];
  const s = sections.find((x) => x.name === name);
  if (s && s.style) return s.style;
  return DEFAULT_STYLES[name] || null;
}

function heading(el) {
  return el.querySelector('h1, h2, h3, h4, h5, h6');
}

function isTldr(el) {
  return el.matches(SEL.topLine) && /^(tldr|tlpl)$/i.test(text(heading(el)));
}

function classify(el) {
  if (el.nodeType !== 1) return null;
  if (el.matches(SEL.topLine)) return isTldr(el) ? 'tldr' : 'cta-callout';
  if (el.matches(SEL.promo)) return 'promo';
  if (el.matches(SEL.faq)) return 'faq';
  if (el.matches(SEL.legal)) return 'legal';
  return null;
}

function isNoise(node) {
  if (node.nodeType === 3) return !node.textContent.trim();
  if (node.nodeType !== 1) return true;
  if (/^(STYLE|SCRIPT|NOSCRIPT|LINK|TEMPLATE)$/.test(node.tagName)) return true;
  if (node.matches(SEL.noise)) return true;
  if (node.tagName === 'P') {
    const t = node.textContent.replace(/[ \s]/g, '');
    if (!t && !node.querySelector('img, picture, a')) return true;
    if (/^(share this article|partager cet article)$/i.test(text(node))) return true;
  }
  if (node.tagName === 'DIV' && !node.textContent.trim() && !node.querySelector('img, picture, table, iframe')) return true;
  return false;
}

/** Unwrap layout wrappers until special units / content are direct children of entry. */
function flatten(entry) {
  let changed = true;
  while (changed) {
    changed = false;
    [...entry.children].forEach((child) => {
      if (child.matches(SEL.wrapper) && !classify(child)) {
        child.replaceWith(...child.childNodes);
        changed = true;
      }
    });
  }
}

function linkParagraph(doc, a, strong) {
  const p = doc.createElement('p');
  const link = doc.createElement('a');
  link.setAttribute('href', a.getAttribute('href'));
  link.textContent = text(a);
  if (strong) {
    const s = doc.createElement('strong');
    s.append(link);
    p.append(s);
  } else {
    p.append(link);
  }
  return p;
}

function textParagraphs(unit) {
  return [...unit.querySelectorAll('p')].filter((p) => !p.querySelector('a') && p.textContent.replace(/[ \s]/g, ''));
}

function rewriteTldr(doc, unit) {
  const h3 = doc.createElement('h3');
  h3.textContent = text(heading(unit)) || 'TLDR';
  const ul = doc.createElement('ul');
  [...unit.querySelectorAll('li')]
    .filter((li) => !li.parentElement.closest('li'))
    .forEach((li) => {
      li.querySelectorAll(':scope > p').forEach((p) => p.replaceWith(...p.childNodes));
      li.removeAttribute('class');
      ul.append(li);
    });
  return [h3, ul];
}

function rewriteCta(doc, unit) {
  const nodes = [];
  const h = heading(unit);
  if (h) nodes.push(h);
  nodes.push(...textParagraphs(unit));
  const btn = unit.querySelector('a.btn') || unit.querySelector('a[href]');
  if (btn) nodes.push(linkParagraph(doc, btn, true));
  return nodes;
}

function rewritePromo(doc, unit) {
  const nodes = [];
  const h = heading(unit);
  if (h) nodes.push(h);
  nodes.push(...textParagraphs(unit));
  [...unit.querySelectorAll('a[href]')].forEach((a, i) => nodes.push(linkParagraph(doc, a, i === 0)));
  return nodes;
}

/**
 * what-is page: plain h2 FAQ + h3/p pairs -> .inner-section-cool-white > .accordion.
 * The French page's heading is "FAQ sur les comptes d’épargne".
 */
function wrapPlainFaq(doc, entry) {
  if (entry.querySelector(SEL.faq)) return;
  const start = [...entry.children].find((el) => /^H[23]$/.test(el.tagName)
    && /frequently asked questions|^faq(\s|$)|questions (fréquemment posées|fréquentes)/i.test(text(el)));
  if (!start) return;

  const range = [];
  let node = start.nextSibling;
  while (node) {
    if (node.nodeType === 1 && (classify(node) || node.tagName === 'H2')) break;
    range.push(node);
    node = node.nextSibling;
  }
  if (!range.some((n) => n.nodeType === 1 && n.tagName === 'H3')) return;

  const wrapper = doc.createElement('div');
  wrapper.className = 'inner-section-cool-white';
  const accordion = doc.createElement('div');
  accordion.className = 'accordion';
  start.before(wrapper);
  wrapper.append(start, accordion);

  let inner = null;
  range.forEach((n) => {
    if (n.nodeType === 1 && n.tagName === 'H3') {
      const panel = doc.createElement('div');
      panel.className = 'accordion-panel';
      const button = doc.createElement('button');
      button.className = 'collapse-toggle collapsed';
      const q = doc.createElement('div');
      q.innerHTML = n.innerHTML;
      button.append(q);
      const content = doc.createElement('div');
      content.className = 'collapse-content collapse';
      inner = doc.createElement('div');
      inner.className = 'collapse-inner';
      content.append(inner);
      panel.append(button, content);
      accordion.append(panel);
      n.remove();
    } else if (inner && !isNoise(n)) {
      inner.append(n);
    } else if (n.nodeType === 1 && isNoise(n)) {
      n.remove();
    } else if (inner) {
      inner.append(n);
    }
  });
}

function marker(doc, name) {
  const div = doc.createElement('div');
  div.setAttribute(META_ATTR, name);
  return div;
}

function normaliseBreaks(element) {
  const meaningful = (n) => n && !(n.nodeType === 3 && !n.textContent.trim()) && n.nodeType !== 8;
  const prevMeaningful = (n) => {
    let p = n.previousSibling;
    while (p && !meaningful(p)) p = p.previousSibling;
    return p;
  };
  const nextMeaningful = (n) => {
    let p = n.nextSibling;
    while (p && !meaningful(p)) p = p.nextSibling;
    return p;
  };
  const entry = element.querySelector(SEL.entry);
  const scope = entry || element;
  [...scope.querySelectorAll(':scope > hr')].forEach((hr) => {
    const prev = prevMeaningful(hr);
    const next = nextMeaningful(hr);
    if (!prev || !next || (prev.tagName === 'HR') || (next.tagName === 'HR')) hr.remove();
  });
}

/* ---------------------------------------------------------------------------------------
 * Template "newcomer-article" (verified in migration-work/cleaned.html + raw server HTML):
 *   main > section.banner.html-bnr     .banner-text > h1 + p, .banner-img[data-img] (CSS bg)
 *   main > section > .section-inner > .col-wpr > .col-9    article body
 *          .col-9 > .block-wpr.top-line-blue               TLDR box (h4 + ul > li > p)
 *          (the same section also holds the date/share row and the .col-3 TOC rails)
 *   main > section.disclaimer          legal (left intact for the disclaimers parser)
 * Output: [h1, p, p>img] <hr> [h3 TLDR, ul, Section Metadata callout] <hr> [body] <hr> [legal]
 * ------------------------------------------------------------------------------------- */
const NEWCOMER = 'newcomer-article';
const NC_BREAK_ATTR = 'data-excat-nc-break';
const NC_FALLBACK = {
  'article-title': ['section.banner.html-bnr'],
  tldr: ['.col-9 > .block-wpr.top-line-blue'],
  body: ['.col-9'],
  legal: ['section.disclaimer'],
};

function ncQuery(root, payload, name) {
  const sections = (payload && payload.template && payload.template.sections) || [];
  const s = sections.find((x) => x.name === name);
  const selectors = (s && s.selector && s.selector.length) ? s.selector : NC_FALLBACK[name];
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function ncBreak(doc) {
  const hr = doc.createElement('hr');
  hr.setAttribute(NC_BREAK_ATTR, '');
  return hr;
}

function ncBannerImage(doc, banner) {
  const box = banner.querySelector('.banner-img');
  if (!box) return null;
  let src = (box.getAttribute('data-img') || '').trim();
  if (!src) {
    const m = /url\((['"]?)([^'")]+)\1\)/.exec(box.getAttribute('style') || '');
    if (m) src = m[2];
  }
  if (!src) {
    const inner = box.querySelector('img[src]');
    if (inner) src = inner.getAttribute('src');
  }
  if (!src) return null;
  try {
    src = new URL(src, 'https://www.rbcroyalbank.com').href;
  } catch (e) {
    // keep as-is
  }
  const p = doc.createElement('p');
  const img = doc.createElement('img');
  img.setAttribute('src', src);
  p.append(img);
  return p;
}

function newcomerBefore(doc, element, payload) {
  // Section 1: title box -> h1, intro paragraph(s), image.
  const banner = ncQuery(element, payload, 'article-title');
  if (banner) {
    const nodes = [];
    const h1 = banner.querySelector('h1');
    if (h1) {
      h1.removeAttribute('class');
      h1.removeAttribute('id');
      nodes.push(h1);
    }
    const textBox = banner.querySelector('.banner-text') || banner;
    [...textBox.querySelectorAll('p')]
      .filter((p) => p.textContent.replace(/[ \s]/g, ''))
      .forEach((p) => nodes.push(p));
    const imgP = ncBannerImage(doc, banner);
    if (imgP) nodes.push(imgP);
    banner.replaceWith(...nodes);
  }

  // Sections 2 + 3: TLDR callout, then the body column. The rest of the wrapping section
  // (date/share row, TOC rails) is template-generated and dropped.
  const col = ncQuery(element, payload, 'body');
  if (col) {
    const nodes = [];
    const tldr = ncQuery(col, payload, 'tldr') || col.querySelector(':scope > .block-wpr.top-line-blue');
    if (tldr && tldr.parentElement === col) {
      nodes.push(ncBreak(doc), ...rewriteTldr(doc, tldr), marker(doc, 'tldr'));
      tldr.remove();
    }
    const body = [...col.childNodes].filter((n) => n.nodeType !== 8);
    if (body.some((n) => !isNoise(n))) nodes.push(ncBreak(doc), ...body);
    const host = col.closest('section') || col;
    if (nodes.length) host.replaceWith(...nodes);
  }

  // Section 4: legal, kept intact (button.collapse-toggle + .collapse-inner) for the parser.
  const legal = ncQuery(element, payload, 'legal');
  if (legal) legal.before(ncBreak(doc));
}

/** Drop leading / trailing / doubled breaks the newcomer branch inserted. */
function newcomerNormalise(element) {
  const meaningful = (n) => n && n.nodeType !== 8 && !(n.nodeType === 3 && !n.textContent.trim());
  const sib = (n, dir) => {
    let p = n[dir];
    while (p && !meaningful(p)) p = p[dir];
    return p;
  };
  element.querySelectorAll(`hr[${NC_BREAK_ATTR}]`).forEach((hr) => {
    const prev = sib(hr, 'previousSibling');
    const next = sib(hr, 'nextSibling');
    if (!prev || !next || prev.tagName === 'HR' || next.tagName === 'HR') hr.remove();
    else hr.removeAttribute(NC_BREAK_ATTR);
  });
}

export default function transform(hookName, element, payload) {
  const doc = (payload && payload.document) || element.ownerDocument || document;
  const templateSections = (payload && payload.template && payload.template.sections) || [];
  if (templateSections.length < 2) return;
  const isNewcomer = !!(payload && payload.template && payload.template.name === NEWCOMER);

  if (hookName === H.before && isNewcomer) {
    newcomerBefore(doc, element, payload);
  }

  if (hookName === H.before && !isNewcomer) {
    const entry = element.querySelector(SEL.entry);
    if (!entry) return;

    // Source markup closes .entry-content early on some pages (what-is: right after the
    // TLDR; types: before the legal collapsible). Pull the following siblings back in.
    while (entry.nextSibling) entry.append(entry.nextSibling);

    flatten(entry);
    wrapPlainFaq(doc, entry);

    // Section 1: H1 + hero image from the article header.
    const header = element.querySelector(SEL.header);
    const lead = [];
    if (header) {
      const h1 = header.querySelector('h1');
      if (h1) lead.push(h1);
      const img = header.querySelector('.featured-image-wrapper img') || header.querySelector('img');
      if (img) {
        const p = doc.createElement('p');
        p.append(img);
        lead.push(p);
      }
    }

    // Group entry children into sections.
    const groups = [{ name: 'article-title', nodes: lead, content: lead.length > 0 }];
    let current = { name: 'body', nodes: [], content: false };
    [...entry.childNodes].forEach((node) => {
      const kind = classify(node);
      if (kind) {
        if (current.nodes.length) groups.push(current);
        let nodes = [node];
        if (kind === 'tldr') nodes = rewriteTldr(doc, node);
        else if (kind === 'cta-callout') nodes = rewriteCta(doc, node);
        else if (kind === 'promo') nodes = rewritePromo(doc, node);
        if (nodes[0] !== node) node.remove();
        groups.push({ name: kind, nodes, content: true });
        current = { name: 'body', nodes: [], content: false };
      } else {
        current.nodes.push(node);
        if (!isNoise(node)) current.content = true;
      }
    });
    if (current.nodes.length) groups.push(current);

    // Noise-only groups (share/topics leftovers) are folded into the previous section.
    const merged = [];
    groups.forEach((g) => {
      if (!g.content && merged.length) merged[merged.length - 1].nodes.push(...g.nodes);
      else merged.push(g);
    });

    // Rebuild entry: <hr> between sections, metadata marker at the end of styled sections.
    entry.textContent = '';
    merged.forEach((g, i) => {
      if (i > 0 && merged[i - 1].content && g.content) entry.append(doc.createElement('hr'));
      g.nodes.forEach((n) => entry.append(n));
      const style = sectionStyle(payload, g.name);
      if (style || BACKGROUNDS[g.name]) {
        // marker goes right after the section's last content node (before trailing noise)
        const contentNodes = g.nodes.filter((n) => !isNoise(n));
        const last = contentNodes[contentNodes.length - 1];
        if (last && last.parentNode === entry) last.after(marker(doc, g.name));
        else entry.append(marker(doc, g.name));
      }
    });
  }

  if (hookName === H.after) {
    element.querySelectorAll(`[${META_ATTR}]`).forEach((m) => {
      const name = m.getAttribute(META_ATTR);
      const cells = {};
      const style = sectionStyle(payload, name);
      if (style) cells.style = style;
      if (BACKGROUNDS[name]) cells.background = BACKGROUNDS[name];
      if (Object.keys(cells).length) {
        m.replaceWith(WebImporter.Blocks.createBlock(doc, { name: 'Section Metadata', cells }));
      } else {
        m.remove();
      }
    });
    if (isNewcomer) newcomerNormalise(element);
    else normaliseBreaks(element);
  }
}
