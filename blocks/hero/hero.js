import { createOptimizedPicture } from '../../scripts/aem.js';
import { createElement } from '../../utils/dom.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';

const contentImages = (block, sel) => [...block.querySelectorAll(sel)]
  .filter((el) => !el.closest('span.icon'));

const PLAY_ICON = '<svg viewBox="0 0 80 81" aria-hidden="true" focusable="false"><path fill="currentColor" d="M40 .625c-22.091 0-40 17.909-40 40s17.909 40 40 40 40-17.909 40-40-17.909-40-40-40zM40 77.5c-20.333 0-36.875-16.542-36.875-36.875S19.667 3.75 40 3.75s36.875 16.542 36.875 36.875S60.333 77.5 40 77.5zm11.894-35.903L35.406 51.72a.875.875 0 01-1.333-.745v-20.11a.875.875 0 011.328-.748l16.488 9.988a.875.875 0 01.005 1.493z"/></svg>';

function normalizeImage(block) {
  const [img] = contentImages(block, 'img');
  if (!img) return;
  if (img.closest('picture')) {
    img.loading = 'eager';
    return;
  }
  img.replaceWith(createOptimizedPicture(img.src, img.alt, true));
}

// plays once over the whole hero, then fades to reveal the image, copy and a replay button
function introVideo(block) {
  const source = block.querySelector('a[href$=".mp4"]');
  if (!source) return;
  const captions = block.querySelector('a[href$=".vtt"]');
  const content = block.querySelector(':scope > div');

  const video = createElement('video', {
    src: source.href, muted: '', playsinline: '', preload: 'auto',
  });
  // the attribute alone doesn't mute a script-created video for autoplay
  video.muted = true;
  if (captions) {
    const track = createElement('track', {
      kind: 'captions', src: captions.href, srclang: document.documentElement.lang || 'en', default: '',
    });
    video.append(track);
    track.addEventListener('load', () => { track.track.mode = 'showing'; });
  }

  const skip = createElement('button', { type: 'button', class: 'hero-video-skip' }, 'Skip video');
  fetchLocalPlaceholders().then((ph) => { if (ph.skipVideo) skip.textContent = ph.skipVideo; });

  const layer = createElement('div', { class: 'hero-video' }, [video, skip]);

  const play = createElement('button', { type: 'button', class: 'button secondary hero-video-play' }, source.textContent.trim());
  play.insertAdjacentHTML('afterbegin', PLAY_ICON);

  const sourceP = source.closest('p');
  const ctas = [...block.querySelectorAll('p.button-wrapper')].find((p) => p !== sourceP);
  if (ctas) {
    ctas.append(play);
    sourceP.remove();
  } else {
    sourceP.className = 'button-wrapper';
    sourceP.replaceChildren(play);
  }
  captions?.closest('p')?.remove();

  const show = (playing) => {
    block.classList.toggle('video-playing', playing);
    content.inert = playing;
  };
  const end = () => {
    if (!block.classList.contains('video-playing')) return;
    const hadFocus = layer.contains(document.activeElement);
    video.pause();
    show(false);
    if (hadFocus) play.focus({ preventScroll: true });
  };
  const start = () => {
    show(true);
    video.currentTime = 0;
    video.play().then(() => skip.focus({ preventScroll: true })).catch(end);
  };
  video.addEventListener('ended', end);
  video.addEventListener('error', end);
  skip.addEventListener('click', end);
  play.addEventListener('click', start);

  block.classList.add('hero-intro');
  block.prepend(layer);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  show(true);
  // blocked autoplay (low power mode, data saver) falls back to the image and copy
  video.play().catch(() => show(false));
}

// a picture after the heading opens an offer box that runs to its first link line
function offerBox(block) {
  const heading = block.querySelector('.hero-copy > :is(h1, h2, h3, h4)');
  const isPicture = (p) => p.matches('p:has(> :is(picture, img):only-child)');
  let start = heading?.nextElementSibling;
  while (start && !isPicture(start)) start = start.nextElementSibling;
  if (!start) return;
  const group = [start];
  for (let p = start.nextElementSibling; p && !p.classList.contains('button-wrapper'); p = p.nextElementSibling) {
    group.push(p);
    if (p.querySelector('a')) break;
  }
  const box = createElement('div', { class: 'hero-offer' });
  start.before(box);
  box.append(...group);
}

function removeEmpty(node, stop) {
  let current = node;
  while (current && current !== stop && !current.childElementCount && !current.textContent.trim()) {
    const parent = current.parentElement;
    current.remove();
    current = parent;
  }
}

function arrange(block) {
  const row = block.firstElementChild;
  if (!row) return;
  const columns = row.children.length > 1;
  const [picture] = contentImages(block, 'picture');
  if (picture) {
    const parent = picture.parentElement;
    picture.remove();
    removeEmpty(parent, row);
  }

  const [copy = createElement('div'), ...extra] = [...row.children];
  extra.forEach((cell) => {
    copy.append(...cell.childNodes);
    cell.remove();
  });
  copy.classList.add('hero-copy');
  row.append(copy);
  if (!picture) return;

  if (block.classList.contains('split') || columns) {
    row.append(createElement('div', { class: 'hero-media' }, picture));
    if (!block.classList.contains('split')) block.classList.add('hero-columns');
    return;
  }
  block.prepend(picture);
  block.classList.add('hero-backdrop');
}

export default function decorate(block) {
  normalizeImage(block);
  arrange(block);
  offerBox(block);
  introVideo(block);

  block.querySelectorAll('p > em:only-child').forEach((em) => {
    if (em.textContent.trim() === em.parentElement.textContent.trim()) em.parentElement.classList.add('hero-note');
  });

  // a line with part of it in <em>: the tagline under the buttons, <em> in the accent font
  block.querySelectorAll('p:has(> em):not(.hero-note, .button-wrapper)').forEach((p) => {
    if (!p.querySelector('a')) p.classList.add('hero-tagline');
  });

  const eyebrow = block.querySelector('h1, h2, h3, h4, h5, h6')?.previousElementSibling;
  if (eyebrow?.tagName === 'P' && !eyebrow.querySelector('a, picture, img')) {
    eyebrow.classList.add('hero-eyebrow');
  }
}
