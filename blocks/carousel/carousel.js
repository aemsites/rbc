import fetchLocalPlaceholders from '../../utils/placeholders.js';
import decorateTile, { tileWords } from '../cards/tiles.js';

function updateActiveSlide(slide) {
  const block = slide.closest('.carousel');
  const slideIndex = parseInt(slide.dataset.slideIndex, 10);
  block.dataset.activeSlide = slideIndex;

  block.querySelectorAll('.carousel-slide').forEach((aSlide, idx) => {
    aSlide.setAttribute('aria-hidden', idx !== slideIndex);
    aSlide.querySelectorAll('a').forEach((link) => {
      if (idx !== slideIndex) link.setAttribute('tabindex', '-1');
      else link.removeAttribute('tabindex');
    });
  });

  block.querySelectorAll('.carousel-slide-indicator').forEach((indicator, idx) => {
    const button = indicator.querySelector('button');
    if (idx !== slideIndex) {
      button.removeAttribute('disabled');
      button.removeAttribute('aria-current');
    } else {
      button.setAttribute('disabled', true);
      button.setAttribute('aria-current', true);
    }
  });
}

function showSlide(block, slideIndex = 0) {
  const slides = block.querySelectorAll('.carousel-slide');
  let realSlideIndex = slideIndex < 0 ? slides.length - 1 : slideIndex;
  if (slideIndex >= slides.length) realSlideIndex = 0;
  const activeSlide = slides[realSlideIndex];

  activeSlide.querySelectorAll('a').forEach((link) => link.removeAttribute('tabindex'));
  const track = block.querySelector('.carousel-slides');
  track.scrollTo({
    top: 0,
    left: activeSlide.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft),
    behavior: 'smooth',
  });
}

function bindEvents(block) {
  block.querySelectorAll('.carousel-slide-indicator button').forEach((button) => {
    button.addEventListener('click', (e) => {
      showSlide(block, parseInt(e.currentTarget.parentElement.dataset.targetSlide, 10));
    });
  });

  block.querySelector('.slide-prev').addEventListener('click', () => {
    showSlide(block, parseInt(block.dataset.activeSlide, 10) - 1);
  });
  block.querySelector('.slide-next').addEventListener('click', () => {
    showSlide(block, parseInt(block.dataset.activeSlide, 10) + 1);
  });

  const track = block.querySelector('.carousel-slides');
  const progress = block.querySelector('.carousel-progress > div');
  if (progress) {
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = track;
      progress.style.width = `${((scrollLeft + clientWidth) / scrollWidth) * 100}%`;
    };
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  const single = block.classList.contains('single');
  const slideObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) updateActiveSlide(entry.target);
    });
  }, { threshold: single ? 0.5 : 0.9 });
  block.querySelectorAll('.carousel-slide').forEach((slide) => slideObserver.observe(slide));
}

// the full-bleed single carousel rotates on its own, so it needs a pause control (WCAG 2.2.2)
function autoplay(block, ph) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'slide-pause';
  block.querySelector('nav').append(button);
  let timer;
  const play = (playing) => {
    clearInterval(timer);
    const next = () => showSlide(block, Number(block.dataset.activeSlide || 0) + 1);
    if (playing) timer = setInterval(next, 6000);
    button.setAttribute('aria-label', playing ? ph.pause || 'Pause' : ph.play || 'Play');
    button.classList.toggle('paused', !playing);
  };
  button.addEventListener('click', () => play(button.classList.contains('paused')));
  play(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function createSlide(row, slideIndex, carouselId, tile, words) {
  const slide = document.createElement('li');
  slide.dataset.slideIndex = slideIndex;
  slide.setAttribute('id', `carousel-${carouselId}-slide-${slideIndex}`);
  slide.classList.add('carousel-slide');

  row.querySelectorAll(':scope > div').forEach((column) => {
    const imageOnly = column.children.length === 1 && column.querySelector('picture, img');
    if (!tile) column.classList.add(`carousel-slide-${imageOnly ? 'image' : 'content'}`);
    slide.append(column);
  });
  if (tile) decorateTile(slide, words);

  const labeledBy = slide.querySelector('h1, h2, h3, h4, h5, h6, .tile-title');
  if (labeledBy) slide.setAttribute('aria-labelledby', labeledBy.getAttribute('id'));
  return slide;
}

let carouselId = 0;
export default async function decorate(block) {
  carouselId += 1;
  block.setAttribute('id', `carousel-${carouselId}`);
  const dark = block.classList.contains('dark');
  if (dark) block.classList.add('single');
  const single = block.classList.contains('single');
  const vantage = block.classList.contains('vantage');
  const pill = single && !dark;
  const tiles = vantage || block.classList.contains('tile');
  if (vantage) {
    const lead = block.firstElementChild;
    lead.className = 'carousel-lead';
    lead.replaceChildren(...lead.firstElementChild.childNodes);
  }
  const rows = block.querySelectorAll(':scope > div:not(.carousel-lead)');
  const isSingleSlide = rows.length < 2;

  const placeholders = await fetchLocalPlaceholders();

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', placeholders.carousel || 'Carousel');

  const container = document.createElement('div');
  container.classList.add('carousel-slides-container');

  const slidesWrapper = document.createElement('ul');
  slidesWrapper.classList.add('carousel-slides');
  block.prepend(slidesWrapper);

  let slideIndicators;
  if (!isSingleSlide) {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', placeholders.carouselSlideControls || 'Carousel Slide Controls');
    if (single) {
      slideIndicators = document.createElement('ol');
      slideIndicators.classList.add('carousel-slide-indicators');
      nav.append(slideIndicators);
    } else if (!vantage) {
      const progress = document.createElement('div');
      progress.className = 'carousel-progress';
      progress.append(document.createElement('div'));
      nav.append(progress);
    }
    block.append(nav);

    const slideNavButtons = document.createElement('div');
    slideNavButtons.classList.add('carousel-navigation-buttons');
    slideNavButtons.innerHTML = `
      <button type="button" class="slide-prev" aria-label="${placeholders.previousSlide || 'Previous Slide'}"></button>
      <button type="button" class="slide-next" aria-label="${placeholders.nextSlide || 'Next Slide'}"></button>
    `;
    (!pill && (single || vantage) ? container : nav).append(slideNavButtons);
  }

  rows.forEach((row, idx) => {
    slidesWrapper.append(createSlide(row, idx, carouselId, tiles, tileWords(block)));
    if (slideIndicators) {
      const indicator = document.createElement('li');
      indicator.classList.add('carousel-slide-indicator');
      indicator.dataset.targetSlide = idx;
      indicator.innerHTML = `<button type="button" aria-label="${placeholders.showSlide || 'Show Slide'} ${idx + 1} ${placeholders.of || 'of'} ${rows.length}"></button>`;
      slideIndicators.append(indicator);
    }
    row.remove();
  });

  container.append(slidesWrapper);
  block.prepend(container);
  if (vantage) block.prepend(block.querySelector('.carousel-lead'));

  if (!isSingleSlide) bindEvents(block);
  if (pill && !isSingleSlide) autoplay(block, placeholders);
}
