/**
 * Create an element.
 * @param {string} tag the tag for the element
 * @param {object} [props] attributes to apply; `class` accepts a string or an array
 * @param {string|Node|Array<string|Node>} [children] text or nodes to append
 * @returns {Element} the element
 */
export function createElement(tag, props, children) {
  const elem = document.createElement(tag);

  if (props) {
    Object.entries(props).forEach(([name, value]) => {
      if (value === undefined || value === null) return;
      if (name === 'class') {
        const names = Array.isArray(value) ? value : String(value).split(' ');
        elem.classList.add(...names.filter(Boolean));
      } else {
        elem.setAttribute(name, value);
      }
    });
  }

  if (children !== undefined && children !== null) {
    // append() adds strings as text, so this helper can never become an injection point
    [].concat(children)
      .filter((child) => child !== undefined && child !== null && child !== '')
      .forEach((child) => elem.append(child));
  }

  return elem;
}

export default createElement;

export const escapeHtml = (str) => String(str ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const safeUrl = (url) => {
  try {
    const u = new URL(url, window.location.href);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '#';
  } catch {
    return '#';
  }
};

// calls back with true when the element reaches the top of the viewport, false once it is below
export function watchStuck(element, callback) {
  let stuck = null;
  const check = () => {
    const rect = element.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const next = rect.top <= 0;
    if (next !== stuck) {
      stuck = next;
      callback(stuck);
    }
  };
  ['scroll', 'resize', 'hashchange'].forEach((type) => window.addEventListener(type, check, { passive: true }));
  check();
}
