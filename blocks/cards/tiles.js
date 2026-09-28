import { loadCSS } from '../../scripts/aem.js';

const THEMES = ['white', 'cool-white', 'light-blue', 'grey', 'yellow', 'blue', 'navy', 'blue-gradient', 'light-gradient'];
const WIDTHS = ['narrow', 'wide', 'art-center'];

loadCSS(`${window.hlx.codeBasePath}/blocks/cards/tiles.css`);

// row = content | image | theme; with two cells, a bare picture is the image, words mean theme
export default function decorateTile(item) {
  const cells = [...item.children];
  const [content] = cells;
  let [, image, theme] = cells;
  if (cells.length === 2) {
    const words = /[a-z]/i.test(cells[1].textContent);
    image = words ? null : cells[1];
    theme = words ? cells[1] : null;
  }
  content.className = 'tile-content';
  if (image) {
    image.className = 'tile-image';
    if (!image.querySelector('picture, img')) image.remove();
  }
  if (theme) {
    const words = theme.textContent.toLowerCase().split(/[^a-z-]+/);
    words.filter((w) => THEMES.includes(w) || WIDTHS.includes(w) || w === 'light')
      .forEach((w) => item.classList.add(`tile-${w}`));
    if (words.includes('dark')) item.classList.add('tile-scrim');
    if (theme.querySelector('picture, img')) {
      theme.className = 'tile-background';
      theme.querySelectorAll('p:not(:has(picture, img))').forEach((p) => p.remove());
      item.classList.add('tile-photo');
      if (!words.some((w) => THEMES.includes(w) || w === 'light')) item.classList.add('tile-scrim');
    } else {
      theme.remove();
    }
  }
  content.querySelectorAll('h2, h3, h4, h5, h6').forEach((heading) => {
    const title = document.createElement('p');
    title.className = `tile-title ${heading.tagName.toLowerCase()}`;
    if (heading.id) title.id = heading.id;
    title.append(...heading.childNodes);
    heading.replaceWith(title);
  });
  const first = content.firstElementChild;
  if (first?.tagName === 'P' && first.children.length === 1 && first.firstElementChild.tagName === 'EM') {
    first.className = 'tile-pill';
  }
  item.classList.add('tile');
}
