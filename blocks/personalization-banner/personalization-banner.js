import { loadFragment } from '../fragment/fragment.js';
import {
  DEFAULT_SEGMENT,
  SEGMENT_EVENT,
  resolveSegment,
  setSegment,
} from '../../scripts/personalization.js';

// ponytail: spike-only segment switcher, behind ?pdebug. Delete once real tabs emit SEGMENT_EVENT.
function addDebugSwitcher(block, segments) {
  if (!new URLSearchParams(window.location.search).has('pdebug')) return;
  const bar = document.createElement('div');
  bar.className = 'personalization-banner-debug';
  segments.forEach((segment) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = segment;
    button.addEventListener('click', () => setSegment(segment));
    bar.append(button);
  });
  block.append(bar);
}

export default async function decorate(block) {
  const sources = new Map();
  [...block.children].forEach((row) => {
    const segment = row.children[0]?.textContent.trim();
    const cell = row.children[1];
    if (!segment || !cell) return;
    const link = cell.querySelector('a[href]');
    sources.set(segment, link
      ? { path: new URL(link.href, window.location).pathname }
      : { node: cell });
  });

  const frame = document.createElement('div');
  frame.className = 'personalization-banner-frame';
  block.replaceChildren(frame);

  const loaded = new Map();
  function nodeFor(segment) {
    const source = sources.get(segment);
    if (!source) return Promise.resolve(null);
    if (source.node) return Promise.resolve(source.node);
    if (!loaded.has(segment)) loaded.set(segment, loadFragment(source.path));
    return loaded.get(segment);
  }

  async function show(segment) {
    const node = (await nodeFor(segment)) || (await nodeFor(DEFAULT_SEGMENT));
    if (!node) return;
    frame.replaceChildren(...node.cloneNode(true).childNodes);
    block.dataset.segment = sources.has(segment) ? segment : DEFAULT_SEGMENT;
  }

  await show(await resolveSegment());

  window.addEventListener(SEGMENT_EVENT, (event) => show(event.detail));
  addDebugSwitcher(block, [...sources.keys()]);

  const whenIdle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1000));
  whenIdle(() => sources.forEach((source, segment) => source.path && nodeFor(segment)));
}
