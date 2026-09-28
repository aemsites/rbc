const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();

export default function decorate(block) {
  const form = document.createElement('form');
  form.className = 'account-filter-form';

  [...block.children].forEach((row) => {
    const [label, ...options] = [...row.children];
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.append(...label.childNodes);
    fieldset.append(legend);
    options.forEach((option) => {
      const text = option.querySelector('p')?.textContent.trim() || option.firstChild?.textContent.trim();
      const products = [...option.querySelectorAll('li')].map((li) => norm(li.textContent));
      const field = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = norm(legend.textContent);
      input.dataset.products = JSON.stringify(products);
      field.append(input, ` ${text}`);
      fieldset.append(field);
    });
    form.append(fieldset);
  });

  block.replaceChildren(form);

  // the comparison block builds its table after this one decorates, so resolve it on each change
  form.addEventListener('change', () => {
    const table = block.closest('.section')?.querySelector('.account-comparison table');
    if (!table) return;
    const products = [...table.querySelectorAll('.account-comparison-products td')]
      .map((td) => norm(td.querySelector('a:not(.button), h3, h4')?.textContent || td.textContent));
    const checked = [...form.querySelectorAll('input:checked')];
    const wanted = checked.map((input) => JSON.parse(input.dataset.products));
    const allowed = products.map((name) => wanted.every((list) => list.includes(name)));
    [...table.querySelectorAll('thead th')].slice(1).forEach((th, i) => {
      th.classList.toggle('account-comparison-match', checked.length > 0 && allowed[i]);
    });
  });
}
