function normalizeImage(block) {
  const img = block.querySelector('img');
  if (!img) return;
  img.loading = 'eager';
  if (img.closest('picture')) return;
  const picture = document.createElement('picture');
  img.replaceWith(picture);
  picture.append(img);
}

function backgroundVideo(block) {
  const source = block.querySelector('a[href$=".mp4"]');
  if (!source) return;
  const captions = block.querySelector('a[href$=".vtt"]');
  const poster = block.querySelector(':scope > picture img');

  const video = document.createElement('video');
  video.src = source.href;
  video.muted = true;
  video.setAttribute('muted', '');
  video.loop = true;
  video.playsInline = true;
  if (poster) video.poster = poster.src;
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) video.autoplay = true;

  if (captions) {
    const track = document.createElement('track');
    track.kind = 'captions';
    track.src = captions.href;
    track.default = true;
    video.append(track);
  }

  [source, captions].forEach((link) => link?.closest('p')?.remove());
  const layer = block.querySelector(':scope > picture');
  if (layer) layer.replaceWith(video);
  else block.prepend(video);
}

export default function decorate(block) {
  normalizeImage(block);

  const backdrop = block.classList.contains('background');
  if (backdrop) block.closest('.section')?.classList.add('dark-background');

  const row = block.firstElementChild;
  if (row && row.children.length > 1 && !backdrop) {
    block.classList.add('hero-split');
  } else {
    const picture = block.querySelector('picture');
    if (picture) {
      const wrapper = picture.parentElement;
      block.prepend(picture);
      if (!wrapper.childElementCount && !wrapper.textContent.trim()) wrapper.remove();
    }
  }

  backgroundVideo(block);

  const eyebrow = block.querySelector('h1, h2, h3, h4, h5, h6')?.previousElementSibling;
  if (eyebrow?.tagName === 'P' && !eyebrow.querySelector('a, picture')) {
    eyebrow.classList.add('hero-eyebrow');
  }
}
