// Inline clean-up shared by every rule: links, buttons, footnotes, icons, images.
// DOM APIs only, so it runs in the browser and in jsdom.
import ICONS from './icons.js';
import PAGES from './pages.js';

export const LIVE = 'https://www.rbcroyalbank.com';
const BY_URL = new Map(PAGES.filter((p) => !p.outOfScope).map((p) => [new URL(p.url).pathname, p]));

export const INLINE = new Set([
  'A', 'STRONG', 'B', 'EM', 'I', 'SUP', 'SUB', 'SPAN', 'BR', 'CODE', 'U', 'SMALL', 'ABBR', 'S', 'DEL',
  'BUTTON', 'LABEL', 'IMG', 'TIME', 'MARK',
]);
const KEEP_ATTRS = {
  A: ['href'], IMG: ['src', 'alt'], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'],
};
const HIDDEN = '.mobile-only, .desktop-hidden, .offscreen, .sr-only, .visually-hidden, [hidden], [aria-hidden="true"]:not(img)';
const REMOVE = 'script, style, noscript, svg, .offscreen, .sr-only, .visually-hidden, .mobile-only, .desktop-hidden, .tooltip-inner, .close-modal, .glider-skip, .carousel-button';
const BLOCKISH = /^(P|LI|UL|OL|H\d|DIV|TABLE|TBODY|THEAD|TR|TD|TH|BLOCKQUOTE|DL|DT|DD)$/;
const LIST_LIKE = /^(UL|OL|TABLE|TBODY|THEAD|TR|DL)$/;

export const isHidden = (el) => el.matches?.(HIDDEN);

export function absolute(href, base) {
  try {
    return new URL(href, base || LIVE).href.replace(/^http:\/\/www\.rbcroyalbank/, 'https://www.rbcroyalbank');
  } catch {
    return href;
  }
}

// in-scope pages link to their DA path, everything else stays an absolute live URL
export function rewriteHref(href, base) {
  if (!href || /^(javascript:|#$)/.test(href)) return null;
  if (/^(#|mailto:|tel:|\/modals\/)/.test(href)) return href;
  const url = new URL(absolute(href, base));
  if (url.hostname !== 'www.rbcroyalbank.com') return url.href;
  const page = BY_URL.get(url.pathname) || BY_URL.get(url.pathname.replace(/index\.html$/, ''));
  return page ? `${page.path}${url.hash}` : url.href;
}

export const iconName = (src) => ICONS[absolute(src)] || null;

export function bgImage(el) {
  const holder = [el, ...el.querySelectorAll('[style]')]
    .find((n) => /url\(/.test(n.getAttribute?.('style') || ''));
  const m = holder?.getAttribute('style').match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
  return m && !/\.svg$/.test(m[1]) ? m[1] : null;
}

export function img(doc, src, alt = '') {
  const el = doc.createElement('img');
  el.src = absolute(src);
  el.alt = alt;
  return el;
}

function unwrap(el) {
  el.replaceWith(...el.childNodes);
}

function rename(el, tag) {
  const replacement = el.ownerDocument.createElement(tag);
  replacement.append(...el.childNodes);
  el.replaceWith(replacement);
}

// <sup><a.scrollto>1</a></sup><sup>,</sup><sup>6</sup> -> <sup>1,6</sup>
function cleanFootnotes(root) {
  root.querySelectorAll('sup').forEach((sup) => {
    sup.querySelectorAll('.offscreen, .sr-only').forEach((n) => n.remove());
    sup.textContent = sup.textContent.replace(/\s+/g, '');
  });
  // eslint-disable-next-line no-use-before-define
  mergeFootnotes(root);
}

export function mergeFootnotes(root) {
  root.querySelectorAll('sup').forEach((sup) => {
    if (!root.contains(sup)) return;
    // live markup puts each ref in its own <sup>, often with whitespace and "," <sup>s between
    const gap = (n) => n?.nodeType === 3 && !n.textContent.trim();
    let next = sup.nextSibling;
    while (next?.nodeName === 'SUP' || (gap(next) && next.nextSibling?.nodeName === 'SUP')) {
      const after = next.nextSibling;
      if (next.nodeName === 'SUP') {
        const sep = /,$/.test(sup.textContent) || /^,/.test(next.textContent) ? '' : ',';
        sup.textContent += sep + next.textContent;
      }
      next.remove();
      next = after;
    }
    sup.textContent = sup.textContent.replace(/,+$/, '');
    if (!sup.textContent) sup.remove();
  });
}

// modal triggers become /modals/ links (the modal block opens them); other buttons keep their text
function cleanButtons(root, ctx) {
  root.querySelectorAll('button').forEach((btn) => {
    const modal = [...btn.classList].find((c) => /^modal-.+_open$/.test(c));
    if (!modal) { unwrap(btn); return; }
    const a = root.ownerDocument.createElement('a');
    a.href = `/modals/${modal.replace(/^modal-/, '').replace(/_open$/, '')}`;
    a.append(...btn.childNodes);
    btn.replaceWith(a);
    ctx.report.modalLinks += 1;
  });
}

// primary buttons are <strong><a>, the rest <em><a>
function cleanLinks(root, ctx) {
  root.querySelectorAll('a').forEach((a) => {
    const modal = [...a.classList].find((c) => /^modal-.+_open$/.test(c));
    if (modal) {
      a.setAttribute('href', `/modals/${modal.replace(/^modal-/, '').replace(/_open$/, '')}`);
      ctx.report.modalLinks += 1;
    }
    const href = rewriteHref(a.getAttribute('href'), ctx.url);
    if ((!href || !a.textContent.trim()) && !a.querySelector('img')) { unwrap(a); return; }
    if (href) a.setAttribute('href', href);
    let kind = null;
    if (a.matches('.btn.primary')) kind = 'STRONG';
    else if (a.matches('.btn')) kind = 'EM';
    if (kind && a.parentElement?.tagName !== kind) {
      const wrap = root.ownerDocument.createElement(kind);
      a.replaceWith(wrap);
      wrap.append(a);
    }
  });
}

function cleanImages(root) {
  root.querySelectorAll('img').forEach((el) => {
    const src = el.getAttribute('src') || el.getAttribute('data-src');
    if (!src) { el.remove(); return; }
    const name = iconName(src);
    if (name) el.replaceWith(root.ownerDocument.createTextNode(`:${name}:`));
    else el.setAttribute('src', absolute(src));
  });
}

// collapse source indentation, drop whitespace between block elements, trim block edges
function normaliseSpace(root) {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  texts.forEach((t) => {
    t.textContent = t.textContent.replace(/\s+/g, ' ');
    const parent = t.parentElement;
    const nextToBlock = [t.previousSibling, t.nextSibling]
      .some((s) => s?.nodeType === 1 && BLOCKISH.test(s.tagName));
    if (!t.textContent.trim() && (nextToBlock || LIST_LIKE.test(parent?.tagName))) {
      t.remove();
      return;
    }
    if (parent && BLOCKISH.test(parent.tagName)) {
      if (t === parent.firstChild) t.textContent = t.textContent.trimStart();
      if (t === parent.lastChild) t.textContent = t.textContent.trimEnd();
    }
  });
}

export function cleanInline(root, ctx) {
  root.querySelectorAll(REMOVE).forEach((n) => {
    if (n.matches('.tooltip-inner')) ctx.report.tooltips += 1;
    n.remove();
  });
  cleanFootnotes(root);
  cleanLinks(root, ctx);
  cleanButtons(root, ctx);
  cleanImages(root);
  root.querySelectorAll('b').forEach((b) => rename(b, 'strong'));
  root.querySelectorAll('i').forEach((i) => rename(i, 'em'));
  root.querySelectorAll('span, label, small, time, mark, abbr, font').forEach(unwrap);
  [root, ...root.querySelectorAll('*')].forEach((el) => {
    const keep = KEEP_ATTRS[el.tagName] || [];
    [...el.attributes].forEach((attr) => {
      if (!keep.includes(attr.name)) el.removeAttribute(attr.name);
    });
  });
  root.querySelectorAll('strong:empty, em:empty, p:empty').forEach((n) => n.remove());
  normaliseSpace(root);
  return root;
}
