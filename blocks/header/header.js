import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { createElement as el } from '../../utils/dom.js';
import { fetchPlaceholders } from '../../scripts/placeholders.js';

let searchConfig;
function loadSearchConfig() {
  if (!searchConfig) {
    searchConfig = fetch('/config.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => j.public?.searchSuggest || {})
      .catch(() => ({}));
  }
  return searchConfig;
}

// until cors is fixed, use jsonp to fetch. replace with a plain fetch() once that happens
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = `irSuggest${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const script = el('script');
    const cleanup = () => {
      delete window[cb];
      script.remove();
    };
    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('suggest request failed'));
    };
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${cb}`;
    document.head.append(script);
  });
}

async function fetchSuggestions(term) {
  const cfg = await loadSearchConfig();
  if (!cfg.baseEndpoint || term.length < 2) return [];
  const lang = (document.documentElement.lang || 'en').slice(0, 2);
  const interfaceID = cfg.interfaceId?.[lang] ?? cfg.interfaceId?.en;
  if (interfaceID === undefined) return [];
  const params = new URLSearchParams({
    term,
    SESSIONID: '',
    interfaceID,
    _: Date.now(),
  });
  try {
    const data = await jsonp(`${cfg.baseEndpoint}?${params}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const PLACEHOLDER_PREFIX = {
  'fr-CA': '/fr',
  'zh-Hans': '/sc',
  'zh-Hant': '/tc',
};

const ph = {
  currentLob: 'Personal',
  searchAction: 'https://www.rbcroyalbank.com/search-public/index.html',
  searchLabel: 'Ask your question',
  searchToggle: 'Search RBC',
  closeSearch: 'Close search',
  selectLanguage: 'Select language',
  menu: 'Menu',
  closeMenu: 'Close menu',
  lobLabel: 'Lines of business',
  megaLabel: 'Products and solutions',
  sectionLabel: 'Section',
  languageLabel: 'Language',
  promotions: 'Promotions',
  youAreIn: 'You are in',
};

const LANGUAGES = [
  { hreflang: 'en-ca', label: 'Canada - EN', lang: 'en-CA' },
  { hreflang: 'fr-ca', label: 'Canada - FR', lang: 'fr-CA' },
  { hreflang: 'zh-hans', label: '简体中文', lang: 'zh-Hans' },
  { hreflang: 'zh-hant', label: '繁體中文', lang: 'zh-Hant' },
  { key: 'alternate-zh', label: '简体中文', lang: 'zh-Hans' },
  { key: 'alternate-us', label: 'U.S. - EN', lang: 'en-US' },
];

function closeAll(root) {
  root.querySelectorAll('[aria-expanded="true"]').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
  });
}

function wireDropdowns(root) {
  root.querySelectorAll('.nav-dd > button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      closeAll(root);
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  });

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = root.querySelector('[aria-expanded="true"]');
    if (!open) return;
    closeAll(root);
    open.focus();
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) closeAll(root);
  });
}

function dropdown(label, panel) {
  const li = el('li', { class: 'nav-dd nav-item' });
  const btn = el('button', { class: 'nav-action', 'aria-expanded': 'false' }, label);
  panel.classList.add('nav-dd-panel');
  li.append(btn, panel);
  return li;
}

function buildLanguage() {
  const pageLang = document.documentElement.lang;
  const links = new Map([...document.head.querySelectorAll('link[rel="alternate"][hreflang]')]
    .map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]));
  const alternates = LANGUAGES
    .map((l) => ({ ...l, href: l.key ? getMetadata(l.key) : links.get(l.hreflang) }))
    .filter((l) => l.href && l.lang !== pageLang);
  if (!alternates.length) return null;

  const ul = el('ul', { class: 'nav-language-list' });
  const currentLabel = LANGUAGES.find((l) => l.lang === pageLang);
  if (currentLabel) {
    const current = el('li', { class: 'nav-language-current' });
    current.append(el('span', null, currentLabel.label));
    current.setAttribute('aria-current', 'true');
    ul.append(current);
  }

  alternates.forEach(({ href, label, lang }) => {
    const a = el('a', { href, hreflang: lang, lang }, label);
    const li = el('li');
    li.append(a);
    ul.append(li);
  });

  const wrapper = el('div', { class: 'nav-language' });
  const toggle = el('button', {
    class: 'nav-language-toggle',
    type: 'button',
    'aria-label': ph.selectLanguage,
    'aria-expanded': 'false',
  }, (document.documentElement.lang || 'en').slice(0, 2).toUpperCase());
  toggle.addEventListener('click', () => {
    toggle.setAttribute('aria-expanded', toggle.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
  });
  wrapper.append(toggle, ul);
  return wrapper;
}

function buildSearch() {
  const form = el('form', { class: 'nav-search-form' });
  form.method = 'get';
  form.action = ph.searchAction;

  const type = el('input', { type: 'hidden', name: 'type', value: '0' });

  const label = el('label', { class: 'nav-search-label' }, ph.searchLabel);
  label.htmlFor = 'nav-search-input';

  const input = el('input', {
    type: 'search',
    id: 'nav-search-input',
    name: 'question',
    placeholder: ph.searchLabel,
    autocomplete: 'off',
  });

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'nav-search-suggest');

  const suggest = el('ul', { class: 'nav-search-suggest', role: 'listbox', id: 'nav-search-suggest' });
  suggest.hidden = true;

  const searchBrand = el('span', { class: 'nav-search-brand' });
  const field = el('div', { class: 'nav-search-field' }, [input, suggest]);
  const close = el('button', {
    class: 'nav-search-close',
    type: 'button',
    'aria-label': ph.closeSearch,
  });
  form.append(type, label, searchBrand, field, close);

  let active = -1;
  const closeSuggest = () => {
    suggest.replaceChildren();
    suggest.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };
  const renderSuggest = (items) => {
    suggest.replaceChildren();
    if (!items.length) {
      closeSuggest();
      return;
    }
    items.forEach((item, i) => {
      const option = el('li', {
        class: 'nav-search-option',
        role: 'option',
        id: `nav-search-opt-${i}`,
        'aria-selected': 'false',
      }, item.label);
      option.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = item.value;
        form.submit();
      });
      suggest.append(option);
    });
    suggest.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const highlight = () => {
    [...suggest.children].forEach((option, i) => option.setAttribute('aria-selected', i === active ? 'true' : 'false'));
    if (active >= 0) input.setAttribute('aria-activedescendant', suggest.children[active].id);
    else input.removeAttribute('aria-activedescendant');
  };

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const term = input.value.trim();
    if (term.length < 2) {
      closeSuggest();
      return;
    }
    debounce = setTimeout(async () => {
      const items = await fetchSuggestions(term);
      if (input.value.trim() === term) renderSuggest(items);
    }, 200);
  });
  input.addEventListener('keydown', (e) => {
    const options = [...suggest.children];
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault();
      active = (active + 1) % options.length;
      highlight();
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault();
      active = (active - 1 + options.length) % options.length;
      highlight();
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      input.value = options[active].textContent;
      form.submit();
    }
  });

  const wrapper = el('div', { class: 'nav-search' });
  const toggle = el('button', {
    class: 'nav-search-toggle',
    type: 'button',
    'aria-label': ph.searchToggle,
    'aria-expanded': 'false',
  });
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      input.focus();
    } else {
      closeSuggest();
      input.value = '';
      toggle.focus();
    }
  };
  const scrim = el('div', { class: 'nav-search-scrim' });
  scrim.addEventListener('click', () => setOpen(false));
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  close.addEventListener('click', () => setOpen(false));
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
  wrapper.append(toggle, form, scrim);
  return wrapper;
}

function megaItem(li) {
  const a = li.querySelector('a');
  if (!a) return;
  const icon = li.querySelector('span.icon');
  const pill = li.querySelector('strong');

  const rest = li.cloneNode(true);
  rest.querySelectorAll('a, strong, span.icon').forEach((n) => n.remove());
  const desc = rest.textContent.replace(/\s+/g, ' ').trim();

  const text = el('span', { class: 'nav-dd-text' });
  if (pill) {
    pill.className = 'nav-dd-pill';
    text.append(pill);
  }
  const title = el('span', { class: 'nav-dd-title' });
  title.append(...a.childNodes);
  text.append(title);
  if (desc) text.append(el('span', { class: 'nav-dd-desc' }, desc));

  a.classList.add('nav-action');
  a.replaceChildren(...(icon ? [icon, text] : [text]));
  li.replaceChildren(a);
}

function megaList(list) {
  list.classList.add('nav-dd-links');
  [...list.children].forEach(megaItem);
  return list;
}

function sectionPanel(section, heading) {
  const panel = el('div');
  const cols = el('div', { class: 'nav-dd-cols' });
  let col = null;
  let rows = 0;

  [...section.querySelectorAll(':scope > div')].forEach((wrapper) => {
    [...wrapper.children].forEach((child) => {
      if (child === heading) return;
      if (child.tagName === 'H3') {
        col = el('div', { class: 'nav-dd-col' });
        col.append(child);
        cols.append(col);
        return;
      }
      if (child.tagName !== 'UL') return;
      if (!cols.children.length && !col) {
        megaList(child).classList.add('nav-dd-featured');
        panel.append(child);
        return;
      }
      if (!col || col.querySelector('ul')) {
        col = el('div', { class: 'nav-dd-col' });
        col.append(el('h3'));
        cols.append(col);
      }
      col.append(megaList(child));
      rows = Math.max(rows, child.children.length);
    });
  });

  if (cols.children.length) {
    cols.style.setProperty('--cols', cols.children.length);
    cols.style.setProperty('--rows', rows + 1);
    panel.append(cols);
  }
  return panel;
}

function buildSectionNav(fragment) {
  const ul = el('ul', { class: 'nav-section-list nav-list' });

  fragment.querySelectorAll(':scope > .section:not(.mobile)').forEach((section) => {
    const heading = section.querySelector('h2');
    if (!heading) {
      const link = section.querySelector('a');
      if (!link) return;
      const li = el('li', { class: 'nav-section-overview nav-item' });
      link.classList.add('nav-action');
      li.append(link);
      ul.append(li);
      return;
    }
    ul.append(dropdown(heading.textContent, sectionPanel(section, heading)));
  });

  if (!ul.children.length) return null;
  const nav = el('nav', { class: 'nav-section' });
  nav.setAttribute('aria-label', ph.sectionLabel);
  nav.append(ul);
  return nav;
}

function buildNestedNav(source, name, label) {
  const list = source?.querySelector('ul');
  if (!list) return null;
  const ul = el('ul', { class: `nav-${name}-list nav-list` });

  [...list.children].forEach((li) => {
    const sub = li.querySelector(':scope > ul');
    if (!sub) {
      const link = li.querySelector('a');
      if (!link) return;
      link.classList.add('nav-action');
      li.replaceChildren(link);
      li.className = `nav-${name}-link nav-item`;
      ul.append(li);
      return;
    }
    const trigger = li.querySelector(':scope > p, :scope > a');
    const item = dropdown(trigger ? trigger.textContent : '', megaList(sub));
    item.querySelector('.nav-dd-panel').classList.add(`nav-${name}-panel`);
    ul.append(item);
  });

  if (!ul.children.length) return null;
  const nav = el('nav', { class: `nav-${name}` });
  nav.setAttribute('aria-label', label);
  nav.append(ul);
  return nav;
}

function drawerTabs(contact, language) {
  if (!contact && !language) return null;
  const tabs = el('div', { class: 'nav-tabs' });
  const strip = el('div', { class: 'nav-tabs-strip', role: 'tablist' });
  const panels = el('div', { class: 'nav-tabs-panels' });

  const add = (id, label, content) => {
    if (!content) return;
    const selected = !strip.children.length;
    const tab = el('button', {
      class: 'nav-tab',
      type: 'button',
      role: 'tab',
      id: `nav-tab-${id}`,
      'aria-controls': `nav-panel-${id}`,
      'aria-selected': String(selected),
    }, label);
    const panel = el('div', {
      class: 'nav-tab-panel',
      role: 'tabpanel',
      id: `nav-panel-${id}`,
      'aria-labelledby': `nav-tab-${id}`,
    });
    panel.hidden = !selected;
    panel.append(content);
    strip.append(tab);
    panels.append(panel);
  };

  const heading = contact?.querySelector('h1, h2, h3, h4, h5, h6');
  const contactLabel = heading?.textContent.trim();
  heading?.remove();
  add('contact', contactLabel, contact);
  add('language', ph.languageLabel, language);

  strip.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-tab');
    if (!tab) return;
    [...strip.children].forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      panels.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
  });

  tabs.append(strip, panels);
  return tabs;
}

function mobileList(list) {
  const ul = el('ul', { class: 'nav-mobile-list' });
  [...list.children].forEach((li) => {
    const sub = li.querySelector(':scope > ul');
    if (!sub) {
      const link = li.querySelector('a');
      if (link) ul.append(el('li', { class: 'nav-mobile-link' }, link));
      return;
    }
    const trigger = li.querySelector(':scope > p, :scope > a');
    const own = [...li.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent);
    const label = (trigger ? trigger.textContent : own.join(' ')).trim();
    const item = el('li', { class: 'nav-mobile-branch' });
    const btn = el('button', { type: 'button', 'aria-expanded': 'false' }, label);
    item.append(btn, el('div', { class: 'nav-mobile-panel' }, mobileList(sub)));
    ul.append(item);
  });
  return ul;
}

function wireAccordion(nav) {
  nav.querySelectorAll('button[aria-expanded]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      [...btn.closest('ul').children].forEach((li) => {
        li.querySelector(':scope > button[aria-expanded]')?.setAttribute('aria-expanded', 'false');
      });
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  });
}

function buildMobileNav(source, label) {
  const list = source?.querySelector('ul');
  if (!list) return null;
  const ul = mobileList(list);
  if (!ul.children.length) return null;
  const nav = el('nav', { class: 'nav-mobile' });
  nav.setAttribute('aria-label', label);
  nav.append(ul);
  wireAccordion(nav);
  return nav;
}

function wireDrawer(nav, drawer, hamburger, mega, main, tabs) {
  const narrow = window.matchMedia('(width < 769px)');
  const tools = main.querySelector('.tools');

  const top = el('div', { class: 'nav-drawer-top' });
  const close = el('button', {
    class: 'nav-drawer-close',
    type: 'button',
    'aria-label': ph.closeMenu,
  });
  top.append(close);
  drawer.prepend(top);

  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', ph.menu);

  const search = main.querySelector('.nav-search');
  const languageList = nav.querySelector('.nav-language-list');
  const languagePanel = tabs?.querySelector('#nav-panel-language');
  const languageDetails = nav.querySelector('.nav-language');
  const place = () => {
    if (languageList && languagePanel) {
      if (narrow.matches) languagePanel.append(languageList);
      else languageDetails.append(languageList);
    }
    if (mega) {
      if (narrow.matches) drawer.append(mega);
      else main.insertBefore(mega, tools);
    }
    if (search) {
      if (narrow.matches) top.append(search);
      else tools.prepend(search);
    }
  };
  narrow.addEventListener('change', place);
  place();

  const scrim = el('div', { class: 'nav-scrim' });
  scrim.hidden = true;
  nav.append(scrim);

  const setOpen = (open) => {
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    nav.classList.toggle('nav-open', open);
    scrim.hidden = !open;
    document.body.classList.toggle('nav-drawer-open', open);
    (open ? close : hamburger).focus();
  };

  hamburger.addEventListener('click', () => setOpen(!nav.classList.contains('nav-open')));
  close.addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));
  nav.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('nav-open')) setOpen(false);
  });

  // the drawer covers the page, so keep Tab inside it while it is open
  const FOCUSABLE = 'a[href], button:not(:disabled), input, summary, [tabindex]:not([tabindex="-1"])';
  drawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !nav.classList.contains('nav-open')) return;
    const items = [...drawer.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  narrow.addEventListener('change', () => {
    if (!narrow.matches) setOpen(false);
  });
}

export default async function decorate(block) {
  if (getMetadata('header') === 'none') {
    block.closest('header')?.remove();
    return;
  }

  const sectionPath = getMetadata('section-nav');
  if (sectionPath) block.closest('header')?.classList.add('nav-has-section');

  const placeholders = fetchPlaceholders(PLACEHOLDER_PREFIX[getMetadata('lang')] || 'default');

  const navMeta = getMetadata('nav');
  const fragment = await loadFragment(navMeta ? new URL(navMeta, window.location).pathname : '/nav');
  if (!fragment) return;

  Object.assign(ph, await placeholders);

  const pick = (name) => fragment.querySelector(`.${name}`);
  const campaign = getMetadata('header') === 'campaign';

  const nav = el('nav');
  nav.id = 'nav';

  const brand = pick('brand');
  const language = buildLanguage();

  if (campaign) {
    const main = el('div', { class: 'nav-main' });
    if (brand) main.append(brand);
    if (language) main.append(language);
    nav.append(main);
    nav.classList.add('nav-campaign');
    block.replaceChildren(nav);
    return;
  }

  const utilityBand = el('div', { class: 'nav-utility-band' });
  const lob = buildNestedNav(pick('lob'), 'lob', ph.lobLabel);
  if (lob) {
    [...lob.querySelectorAll('a')]
      .find((a) => a.textContent.trim() === ph.currentLob)
      ?.setAttribute('aria-current', 'page');
    const toggle = el('button', {
      class: 'nav-lob-toggle',
      type: 'button',
      'aria-expanded': 'false',
    });
    toggle.append(el('span', { class: 'nav-lob-toggle-prefix' }, ph.youAreIn), el('span', { class: 'current-lob' }, ph.currentLob));
    toggle.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', toggle.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });
    lob.prepend(toggle);
    utilityBand.append(lob);
  }
  const utility = pick('utility');
  utility?.querySelectorAll('ul').forEach((list) => list.classList.add('nav-list'));
  utility?.querySelectorAll('li').forEach((item) => item.classList.add('nav-item'));
  utility?.querySelectorAll('a').forEach((link) => link.classList.add('nav-action'));
  if (utility) utilityBand.append(utility);
  if (language) utilityBand.append(language);

  const main = el('div', { class: 'nav-main' });
  if (brand) main.append(brand);
  const mega = buildNestedNav(pick('mega'), 'mega', ph.megaLabel);
  if (mega) main.append(mega);

  const tools = pick('tools') || el('div', { class: 'tools' });
  tools.prepend(buildSearch());
  const shield = brand?.querySelector('.icon');
  if (shield) tools.querySelector('.nav-search-brand')?.append(shield.cloneNode(true));
  main.append(tools);

  const hamburger = el('button', { class: 'nav-hamburger', type: 'button' });
  hamburger.append(el('span', { class: 'nav-hamburger-label' }, ph.menu));
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-controls', 'nav-drawer');
  main.append(hamburger);

  const promo = [...utilityBand.querySelectorAll('a')]
    .find((a) => a.textContent.trim() === ph.promotions);
  promo?.classList.add('nav-utility-promo');

  const contact = pick('contact');
  const tabs = drawerTabs(contact, language && document.createDocumentFragment());

  const drawer = el('div', { class: 'nav-drawer' });
  drawer.id = 'nav-drawer';
  drawer.append(utilityBand);
  if (tabs) drawer.append(tabs);

  const utilityList = utility?.querySelector('ul');
  const adChoices = utilityList?.querySelector('li');
  if (adChoices) {
    const adLast = el('div', { class: 'utility nav-utility-last' }, el('ul', { class: 'nav-list' }));
    const narrow = window.matchMedia('(width < 769px)');
    const placeAdChoices = () => {
      if (narrow.matches) {
        adLast.firstElementChild.append(adChoices);
        drawer.append(adLast);
      } else {
        utilityList.prepend(adChoices);
        adLast.remove();
      }
    };
    narrow.addEventListener('change', placeAdChoices);
    placeAdChoices();
  }
  nav.append(main, drawer);

  if (sectionPath) {
    const sectionFragment = await loadFragment(new URL(sectionPath, window.location).pathname);
    const sectionNav = sectionFragment && buildSectionNav(sectionFragment);
    if (sectionNav) drawer.append(sectionNav);
    const mobileNav = buildMobileNav(sectionFragment?.querySelector('.mobile'), ph.megaLabel);
    if (mobileNav) drawer.append(mobileNav);
  }

  wireDrawer(nav, drawer, hamburger, mega, main, tabs);
  wireDropdowns(nav);
  block.replaceChildren(nav);
}
