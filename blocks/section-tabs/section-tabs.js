let sectionsWired = false;

function items() {
  return [...document.querySelectorAll('.section-tabs li[data-opens]')].map((el) => ({
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

function update() {
  const all = items();
  const tab = currentTab(all);

  document.querySelectorAll('[data-tab]').forEach((section) => {
    const allowed = section.dataset.tab.split(',').map((t) => t.trim()).filter(Boolean);
    section.classList.toggle('tab-hidden', !allowed.includes(tab));
  });

  all.forEach(({ el, tab: own, activatedBy }) => {
    const selected = own === tab || activatedBy.includes(tab);
    el.classList.toggle('selected', selected);
    el.querySelector('a').setAttribute('aria-current', selected ? 'true' : 'false');
  });
}

export default function decorate(block) {
  const list = document.createElement('ul');
  list.setAttribute('role', 'tablist');

  [...block.children].forEach((row) => {
    const [label, activatedBy] = [...row.children];
    const link = label.querySelector('a[href^="#"]');
    if (!link) return;
    const item = document.createElement('li');
    item.dataset.opens = decodeURIComponent(link.hash.slice(1));
    const declared = activatedBy && activatedBy.textContent.trim();
    item.dataset.activatedBy = declared || item.dataset.opens;
    item.append(...label.childNodes);
    list.append(item);
  });

  block.replaceChildren(list);
  document.documentElement.classList.add('tab-js');

  if (!sectionsWired) {
    sectionsWired = true;
    window.addEventListener('hashchange', update);
  }
  update();
}
