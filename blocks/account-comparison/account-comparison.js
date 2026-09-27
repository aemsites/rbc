export default function decorate(block) {
  const rows = [...block.children];
  const cols = Math.max(...rows.map((row) => row.children.length));
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  table.append(thead, tbody);

  const toggleGroup = (tr, open) => {
    let next = tr.nextElementSibling;
    while (next && !next.classList.contains('account-comparison-group')) {
      next.hidden = !open;
      next = next.nextElementSibling;
    }
  };

  let groups = 0;
  rows.forEach((row, i) => {
    const cells = [...row.children];
    const tr = document.createElement('tr');

    if (cells.length === 1) {
      groups += 1;
      tr.className = 'account-comparison-group';
      const th = document.createElement('th');
      th.colSpan = cols;
      th.scope = 'colgroup';
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-expanded', String(groups <= 2));
      button.append(...cells[0].childNodes);
      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        toggleGroup(tr, open);
      });
      th.append(button);
      tr.append(th);
      tbody.append(tr);
      return;
    }

    const header = i === 0;
    cells.forEach((cell, c) => {
      const el = document.createElement(header || c === 0 ? 'th' : 'td');
      el.scope = header ? 'col' : 'row';
      el.append(...cell.childNodes);
      if (!header && c > 0 && cells.length < cols) el.colSpan = cols - cells.length + 1;
      tr.append(el);
    });
    if (header) {
      tr.className = 'account-comparison-head';
      thead.append(tr);
    } else {
      if (!groups && tr.querySelector('a.button')) tr.className = 'account-comparison-products';
      tbody.append(tr);
    }
  });

  tbody.querySelectorAll('.account-comparison-group').forEach((tr) => {
    toggleGroup(tr, tr.querySelector('button').getAttribute('aria-expanded') === 'true');
  });

  block.replaceChildren(table);
}
