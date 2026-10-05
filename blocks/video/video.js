import { createElement } from '../../utils/dom.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default async function decorate(block) {
  const link = block.querySelector('a[href*=".mp4"]');
  if (!link) return;
  const poster = block.querySelector('img');
  const label = link.textContent.trim();

  const video = createElement('video', {
    src: link.href,
    poster: poster?.currentSrc || poster?.src,
    muted: '',
    loop: '',
    playsinline: '',
    preload: 'metadata',
    'aria-label': label && label !== link.href ? label : null,
  });
  // the attribute alone doesn't mute a script-created video for autoplay
  video.muted = true;

  const ph = await fetchLocalPlaceholders();
  const toggle = createElement('button', { type: 'button', class: 'video-toggle' });
  let paused = reducedMotion();
  const render = () => {
    const playing = !video.paused;
    toggle.setAttribute('aria-label', playing ? ph.pauseVideo || 'Pause video' : ph.playVideo || 'Play video');
    toggle.classList.toggle('is-playing', playing);
  };
  video.addEventListener('play', render);
  video.addEventListener('pause', render);
  toggle.addEventListener('click', () => {
    paused = !video.paused;
    if (paused) video.pause();
    else video.play().catch(render);
  });

  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) video.pause();
    else if (!paused) video.play().catch(render);
  }, { threshold: 0.25 }).observe(video);

  block.replaceChildren(video, toggle);
  render();
}
