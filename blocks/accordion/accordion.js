function buildItem(row) {
  const summary = document.createElement('summary');
  summary.className = 'accordion-item-label';
  summary.append(...row.children[0].childNodes);

  const body = row.children[1] || document.createElement('div');
  body.className = 'accordion-item-body';

  const details = document.createElement('details');
  details.className = 'accordion-item';
  details.append(summary, body);
  return details;
}

export default function decorate(block) {
  const rows = [...block.children];
  const toggleAt = rows.findIndex((row) => row.children.length === 1);
  const more = toggleAt < 0 ? null : document.createElement('div');

  rows.forEach((row, i) => {
    if (i === toggleAt) return;
    const item = buildItem(row);
    if (more && i > toggleAt) {
      more.append(item);
      row.remove();
    } else {
      row.replaceWith(item);
    }
  });

  if (!more) return;

  more.className = 'accordion-more';
  more.id = `accordion-more-${Math.random().toString(36).slice(2, 8)}`;
  more.hidden = true;

  const toggle = document.createElement('button');
  toggle.className = 'accordion-toggle';
  toggle.type = 'button';
  const toggleLabel = document.createElement('span');
  toggleLabel.textContent = rows[toggleAt].textContent.trim();
  toggle.append(toggleLabel);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', more.id);
  toggle.addEventListener('click', () => {
    more.hidden = !more.hidden;
    toggle.setAttribute('aria-expanded', String(!more.hidden));
  });

  rows[toggleAt].replaceWith(toggle, more);
}
