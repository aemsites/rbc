import registerSlot from '../../utils/pzn.js';

// first row names the slot; any rows after it are the default shown until an experience lands
export default function decorate(block) {
  const [nameRow, ...defaults] = [...block.children];
  const name = nameRow?.textContent.trim();
  const cells = defaults.map((row) => row.firstElementChild).filter(Boolean);
  block.replaceChildren(...cells.flatMap((cell) => [...cell.childNodes]));
  if (!name) return;
  block.dataset.pznSlot = name;
  registerSlot(name, block);
}
