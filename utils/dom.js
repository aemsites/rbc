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
