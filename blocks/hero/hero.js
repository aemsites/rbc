import fetchLocalPlaceholders from '../../utils/placeholders.js';

const contentImages = (block, sel) => [...block.querySelectorAll(sel)]
  .filter((el) => !el.closest('span.icon'));

const PLAY_ICON = '<svg viewBox="0 0 80 81" aria-hidden="true" focusable="false"><path fill="currentColor" d="M40 .625c-22.091 0-40 17.909-40 40s17.909 40 40 40 40-17.909 40-40-17.909-40-40-40zM40 77.5c-20.333 0-36.875-16.542-36.875-36.875S19.667 3.75 40 3.75s36.875 16.542 36.875 36.875S60.333 77.5 40 77.5zm11.894-35.903L35.406 51.72a.875.875 0 01-1.333-.745v-20.11a.875.875 0 011.328-.748l16.488 9.988a.875.875 0 01.005 1.493z"/></svg>';

function normalizeImage(block) {
  const [img] = contentImages(block, 'img');
  if (!img) return;
  img.loading = 'eager';
  if (img.closest('picture')) return;
  const picture = document.createElement('picture');
  img.replaceWith(picture);
  picture.append(img);
}

// plays once over the whole hero, then fades to reveal the image, copy and a replay button
function introVideo(block) {
  const source = block.querySelector('a[href$=".mp4"]');
  if (!source) return;
  const captions = block.querySelector('a[href$=".vtt"]');
  const content = block.querySelector(':scope > div');

  const video = document.createElement('video');
  video.src = source.href;
  video.muted = true;
  video.setAttribute('muted', '');
  video.playsInline = true;
  video.preload = 'auto';
  if (captions) {
    const track = document.createElement('track');
    track.kind = 'captions';
    track.src = captions.href;
    track.srclang = document.documentElement.lang || 'en';
    track.default = true;
    video.append(track);
    // default is ignored when the track is added after src
    track.addEventListener('load', () => { track.track.mode = 'showing'; });
  }

  // autoplay runs 15s; WCAG 2.2.2 needs a way to stop it
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'hero-video-skip';
  skip.textContent = 'Skip video';
  fetchLocalPlaceholders().then((ph) => { if (ph.skipVideo) skip.textContent = ph.skipVideo; });

  const layer = document.createElement('div');
  layer.className = 'hero-video';
  layer.append(video, skip);

  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'button secondary hero-video-play';
  play.innerHTML = PLAY_ICON;
  play.append(source.textContent.trim());

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

export default function decorate(block) {
  normalizeImage(block);

  const backdrop = block.classList.contains('background');
  if (backdrop && !block.classList.contains('light')) block.closest('.section')?.classList.add('dark-background');

  const row = block.firstElementChild;
  if (row && row.children.length > 1 && !backdrop) {
    block.classList.add('hero-split');
  } else {
    const [picture] = contentImages(block, 'picture');
    if (picture) {
      const wrapper = picture.parentElement;
      block.prepend(picture);
      if (!wrapper.childElementCount && !wrapper.textContent.trim()) wrapper.remove();
    }
  }

  introVideo(block);

  block.querySelectorAll('p > em:only-child').forEach((em) => {
    if (em.textContent.trim() === em.parentElement.textContent.trim()) em.parentElement.classList.add('hero-note');
  });

  // a line with part of it in <em>: the tagline under the buttons, <em> in the accent font
  block.querySelectorAll('p:has(> em):not(.hero-note, .button-wrapper)').forEach((p) => {
    if (!p.querySelector('a')) p.classList.add('hero-tagline');
  });

  const eyebrow = block.querySelector('h1, h2, h3, h4, h5, h6')?.previousElementSibling;
  if (eyebrow?.tagName === 'P' && !eyebrow.querySelector('a, picture')) {
    eyebrow.classList.add('hero-eyebrow');
  }
}
