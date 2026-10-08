import { createElement } from './dom.js';

const isToggle = (el) => el?.tagName === 'P' && el.children.length === 1
  && el.firstElementChild.matches('a[href="#more"]')
  && el.textContent.trim() === el.firstElementChild.textContent.trim();

export default function decorateDisclosures(main) {
  main.querySelectorAll('a[href="#more"]').forEach((a) => {
    const toggle = a.parentElement;
    if (!isToggle(toggle)) return;
    const body = [];
    let next = toggle.nextElementSibling;
    while (next && !isToggle(next) && !/^H\d$/.test(next.tagName)) {
      body.push(next);
      next = next.nextElementSibling;
    }
    const summary = createElement('summary', null, a.textContent.trim());
    toggle.replaceWith(createElement('details', { class: 'disclosure' }, [summary, ...body]));
  });
}
