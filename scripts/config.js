// config blocks: rows are `key | value`; the template holds the defaults on [data-key] elements
export default function applyConfig(block, template) {
  const config = {};
  [...block.children].forEach((row) => {
    const [key, value] = row.children;
    if (key && value) config[key.textContent.trim().toLowerCase()] = value;
  });
  block.innerHTML = template;
  block.querySelectorAll('[data-key]').forEach((el) => {
    const value = config[el.dataset.key];
    if (!value) return;
    const link = value.querySelector('a');
    if (el.tagName === 'A' && link) {
      el.href = link.href;
      el.textContent = link.textContent;
      return;
    }
    const single = value.children.length === 1 && value.firstElementChild.tagName === 'P';
    el.innerHTML = single ? value.firstElementChild.innerHTML : value.innerHTML;
  });
  return Object.fromEntries(Object.entries(config).map(([k, v]) => [k, v.textContent.trim()]));
}
