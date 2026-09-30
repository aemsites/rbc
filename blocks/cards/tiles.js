import { loadCSS } from '../../scripts/aem.js';

const THEMES = [
  'white', 'cool-white', 'light-blue', 'grey', 'yellow', 'blue', 'navy', 'blue-gradient', 'light-gradient',
  'teal', 'maroon', 'purple', 'red', 'violet',
];
const WIDTHS = ['narrow', 'wide', 'art-center', 'art-right', 'art-top', 'art-top-center', 'art-inset'];
const WORDS = new Set([...THEMES, ...WIDTHS, 'light', 'dark']);

loadCSS(`${window.hlx.codeBasePath}/blocks/cards/tiles.css`);

export const tileWords = (block) => [...block.classList].filter((word) => WORDS.has(word));

// row = content | art. A picture ending the content cell is the background; words in the
// art cell replace the block's words for that row (the carousel's per-tile colours).
export default function decorateTile(item, blockWords = []) {
  const [content, ...rest] = [...item.children];
  const isPicture = (el) => el && el.matches('p:has(> :is(picture, img):only-child), picture, img');
  const [art] = rest.flatMap((cell) => [...cell.children].filter(isPicture));
  const background = isPicture(content.lastElementChild) ? content.lastElementChild : null;
  const text = rest.map((cell) => cell.textContent.toLowerCase()).join(' ');
  const rowWords = text.split(/[^a-z-]+/).filter((w) => WORDS.has(w));
  const words = rowWords.length ? rowWords : blockWords;
  rest.forEach((cell) => cell.remove());
  [[art, 'tile-image'], [background, 'tile-background']].forEach(([picture, className]) => {
    if (!picture) return;
    const cell = document.createElement('div');
    cell.className = className;
    cell.append(picture);
    item.append(cell);
  });

  content.className = 'tile-content';
  const theme = [...words].reverse().find((w) => THEMES.includes(w));
  if (theme) item.classList.add(`tile-${theme}`);
  words.filter((w) => WIDTHS.includes(w)).forEach((w) => item.classList.add(`tile-${w}`));
  const light = [...words].reverse().find((w) => w === 'light' || w === 'dark') === 'light';
  if (light) item.classList.add('tile-light');
  if (background) {
    item.classList.add('tile-photo');
    if (words.includes('dark') || (!theme && !light)) item.classList.add('tile-scrim');
  }

  content.querySelectorAll('h2, h3, h4, h5, h6').forEach((heading) => {
    const title = document.createElement('p');
    title.className = `tile-title ${heading.tagName.toLowerCase()}`;
    if (heading.id) title.id = heading.id;
    title.append(...heading.childNodes);
    heading.replaceWith(title);
  });
  const first = content.firstElementChild;
  const em = first?.tagName === 'P' && !first.classList.contains('tile-title') && first.firstElementChild;
  if (em?.tagName === 'EM' && first.textContent.trim() === em.textContent.trim()) first.className = 'tile-pill';
  item.classList.add('tile');
}
