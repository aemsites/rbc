import { toClassName } from '../../scripts/aem.js';
import { watchStuck } from '../../utils/dom.js';

let count = 0;
let sectionsWired = false;
let clickedTop = null;

function sectionItems() {
  return [...document.querySelectorAll('.tabs.sections [data-opens]')].map((el) => ({
    el,
    tab: el.dataset.opens,
    activatedBy: el.dataset.activatedBy.split(',').map((t) => t.trim()).filter(Boolean),
  }));
}

function currentTab(all) {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  const key = hash || document.body.dataset.preselect;
  if (!key) return 'default';
  if (all.some((i) => i.tab === key)) return key;
  const claimed = all.find((i) => i.activatedBy.includes(key));
  return claimed ? claimed.tab : 'default';
}

function updateSections() {
  const all = sectionItems();
  const tab = currentTab(all);
  const revealed = [];
  document.querySelectorAll('[data-tab]').forEach((section) => {
    const allowed = section.dataset.tab.split(',').map((t) => t.trim()).filter(Boolean);
    const hidden = !allowed.includes(tab);
    if (!hidden && section.classList.contains('tab-hidden')) revealed.push(section);
    section.classList.toggle('tab-hidden', hidden);
  });
  // a tab keyed `scroll` brings content it reveals above the strip into view
  if (clickedTop !== null) {
    revealed.find((s) => s.getBoundingClientRect().bottom <= clickedTop)?.scrollIntoView({ behavior: 'smooth' });
    clickedTop = null;
  }
  all.forEach(({ el, tab: own, activatedBy }) => {
    const selected = own === tab || activatedBy.includes(tab);
    el.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.tabs.sections.nested').forEach((nested) => {
    nested.hidden = !nested.querySelector('[aria-selected="true"]');
  });
}

// sticky: once the strip scrolls past the top it is fixed there; the wrapper keeps its height
function stickStrip(block) {
  const wrapper = block.parentElement;
  watchStuck(wrapper, (above) => {
    const stuck = above && block.offsetParent !== null;
    wrapper.style.minHeight = stuck ? `${block.offsetHeight}px` : '';
    block.classList.toggle('tabs-stuck', stuck);
  });
}

function decorateSectionTabs(block, tablist) {
  [...block.children].forEach((row) => {
    const [label, activatedBy] = [...row.children];
    const link = label.querySelector('a[href^="#"]');
    if (!link) return;
    link.className = 'tabs-tab';
    link.setAttribute('role', 'tab');
    link.dataset.opens = decodeURIComponent(link.hash.slice(1));
    const keys = (activatedBy?.textContent || '').split(',').map((k) => k.trim()).filter(Boolean);
    if (keys.includes('scroll')) link.dataset.scroll = '';
    link.dataset.activatedBy = keys.filter((k) => k !== 'scroll').join(',') || link.dataset.opens;
    const icon = label.querySelector('.icon');
    if (icon) link.prepend(icon, ' ');
    link.addEventListener('click', () => { clickedTop = 'scroll' in link.dataset ? link.getBoundingClientRect().top : null; });
    tablist.append(link);
  });
  block.replaceChildren(tablist);
  document.documentElement.classList.add('tab-js');
  if (block.classList.contains('sticky')) stickStrip(block);
  if (!sectionsWired) {
    sectionsWired = true;
    window.addEventListener('hashchange', updateSections);
    document.addEventListener('pzn:preselect', updateSections);
  }
  updateSections();
}

function decoratePanelTabs(block, tablist) {
  count += 1;
  const numbered = block.classList.contains('numbered');
  const tabs = [...block.children].map((child) => child.firstElementChild);
  tabs.forEach((tab, i) => {
    const id = `${count}-${toClassName(tab.textContent)}`;
    const tabpanel = block.children[i];
    tabpanel.className = 'tabs-panel';
    tabpanel.id = `tabpanel-${id}`;
    const heading = tabpanel.querySelector('h2, h3, h4, h5, h6');
    if (heading && numbered) {
      const number = document.createElement('span');
      number.className = 'tabs-number';
      number.textContent = i + 1;
      heading.prepend(number, ' ');
    }
    const image = tabpanel.children[1]?.lastElementChild;
    if (image?.matches('p:has(> picture:only-child, > img:only-child)')) image.className = 'tabs-panel-image';
    tabpanel.setAttribute('aria-hidden', !!i);
    tabpanel.setAttribute('aria-labelledby', `tab-${id}`);
    tabpanel.setAttribute('role', 'tabpanel');

    const button = document.createElement('button');
    button.className = 'tabs-tab';
    button.id = `tab-${id}`;
    button.append(...tab.childNodes);
    button.setAttribute('aria-controls', `tabpanel-${id}`);
    button.setAttribute('aria-selected', !i);
    button.setAttribute('role', 'tab');
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => {
      block.querySelectorAll('[role=tabpanel]').forEach((panel) => panel.setAttribute('aria-hidden', true));
      tablist.querySelectorAll('.tabs-tab').forEach((btn) => btn.setAttribute('aria-selected', false));
      tabpanel.setAttribute('aria-hidden', false);
      button.setAttribute('aria-selected', true);
    });
    tablist.append(button);
    tab.remove();
  });
  block.prepend(tablist);
}

export default function decorate(block) {
  const tablist = document.createElement('div');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');
  if (block.classList.contains('sections')) decorateSectionTabs(block, tablist);
  else decoratePanelTabs(block, tablist);
}
