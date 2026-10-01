import { createElement } from '../../utils/dom.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';

let glossaryCount = 0;

function trackCurrentGroup(block, nav, groups, select) {
  const desktop = window.matchMedia('(width >= 769px)');
  const title = document.querySelector('main > .section.sticky-title');
  const stickyTitle = title && !title.contains(block) ? title : null;
  const listeners = new AbortController();
  let offset = 275;
  let stickyTop = 0;
  let frame = 0;
  let observer;

  const update = () => {
    frame = 0;
    if (!block.isConnected) {
      listeners.abort();
      observer.disconnect();
      return;
    }
    const navTop = nav.getBoundingClientRect().top;
    nav.classList.toggle('glossary-stuck', desktop.matches
      && block.getBoundingClientRect().top < stickyTop - 1
      && Math.abs(navTop - stickyTop) <= 1);
    let current;
    groups.forEach((group) => {
      if (group.section.getBoundingClientRect().top <= offset + 1) current = group;
    });
    const last = groups[groups.length - 1];
    const lastRect = last.section.getBoundingClientRect();
    const atBottom = window.scrollY + window.innerHeight
      >= document.documentElement.scrollHeight - 1;
    if (atBottom && lastRect.top < window.innerHeight && lastRect.bottom > 0) current = last;
    select(current?.button);
  };
  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };
  const refresh = () => {
    stickyTop = desktop.matches && stickyTitle ? stickyTitle.getBoundingClientRect().height : 0;
    const height = desktop.matches ? nav.getBoundingClientRect().height : 0;
    block.style.setProperty('--glossary-sticky-top', `${stickyTop}px`);
    block.style.setProperty('--glossary-nav-height', `${height}px`);
    offset = parseFloat(getComputedStyle(groups[0].section).scrollMarginTop);
    schedule();
  };
  observer = new ResizeObserver(refresh);
  observer.observe(block);
  observer.observe(nav);
  if (stickyTitle) observer.observe(stickyTitle);
  window.addEventListener('scroll', schedule, { passive: true, signal: listeners.signal });
  window.addEventListener('resize', refresh, { passive: true, signal: listeners.signal });
  refresh();
}

export default async function decorate(block) {
  const groups = new Map();
  const incompleteRows = [];
  glossaryCount += 1;
  const prefix = `glossary-${glossaryCount}`;

  [...block.children].forEach((row) => {
    if (!row.textContent.trim() && !row.querySelector('picture, img')) return;

    const [label, ...cells] = row.children;
    const letter = label?.textContent.trim().toUpperCase();
    const hasDefinitions = cells.some((cell) => cell.textContent.trim() || cell.querySelector('picture, img'));
    if (!/^[A-Z]$/.test(letter) || !hasDefinitions) {
      // eslint-disable-next-line no-console
      console.warn('Glossary rows need an A-Z letter and definitions; preserving incomplete row.', row);
      incompleteRows.push(row);
      return;
    }

    if (!groups.has(letter)) {
      const heading = createElement('h2', { id: `${prefix}-${letter.toLowerCase()}-heading` }, letter);
      const definitions = createElement('div', { class: 'glossary-definitions' });
      const section = createElement('section', {
        class: 'glossary-group',
        id: `${prefix}-${letter.toLowerCase()}`,
        'aria-labelledby': heading.id,
        tabindex: '-1',
      }, [heading, definitions]);
      groups.set(letter, { section, definitions });
    }
    cells.forEach((cell) => groups.get(letter).definitions.append(...cell.childNodes));
  });

  if (!groups.size) {
    block.replaceChildren(...incompleteRows);
    return;
  }

  const placeholders = await fetchLocalPlaceholders();
  const list = createElement('ul', { class: 'glossary-alphabet' });
  const nav = createElement('nav', {
    class: 'glossary-nav',
    'aria-label': placeholders.glossaryNavigation || 'Glossary navigation',
  }, list);
  let currentButton;
  const select = (button) => {
    if (currentButton === button) return;
    currentButton?.removeAttribute('aria-current');
    button?.setAttribute('aria-current', 'location');
    currentButton = button;
  };

  [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].forEach((letter) => {
    const group = groups.get(letter);
    const button = createElement('button', {
      type: 'button',
      class: 'glossary-letter',
      'aria-controls': group?.section.id,
      disabled: group ? null : '',
    }, letter);

    if (group) {
      group.button = button;
      button.addEventListener('click', () => {
        select(button);
        group.section.focus({ preventScroll: true });
        group.section.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
          block: 'start',
        });
      });
    }
    list.append(createElement('li', null, button));
  });

  const orderedGroups = [...groups.keys()].sort().map((letter) => groups.get(letter));
  block.replaceChildren(nav, ...orderedGroups.map((group) => group.section), ...incompleteRows);
  trackCurrentGroup(block, nav, orderedGroups, select);
}
