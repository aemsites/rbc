import decorate from './accordion.js';

/** Build a detached block div from row/cell HTML strings. */
function makeBlock(...rows) {
  const block = document.createElement('div');
  rows.forEach((cells) => {
    const row = document.createElement('div');
    cells.forEach((html) => {
      const cell = document.createElement('div');
      cell.innerHTML = html;
      row.append(cell);
    });
    block.append(row);
  });
  return block;
}

describe('accordion decorate — basic item structure', () => {
  test('converts 2-cell rows into details/summary/body elements', async () => {
    const block = makeBlock(['Question 1', 'Answer 1'], ['Question 2', 'Answer 2']);
    await decorate(block);

    const items = block.querySelectorAll('.accordion-item');
    expect(items).toHaveLength(2);

    const first = items[0];
    expect(first.tagName).toBe('DETAILS');
    expect(first.querySelector('summary.accordion-item-label')).not.toBeNull();
    expect(first.querySelector('summary.accordion-item-label').textContent).toBe('Question 1');
    expect(first.querySelector('.accordion-item-body')).not.toBeNull();
  });

  test('accordion-item-body gets content from the second cell', async () => {
    const block = makeBlock(['Q', '<p>Body text</p>']);
    await decorate(block);

    const body = block.querySelector('.accordion-item-body');
    expect(body.querySelector('p').textContent).toBe('Body text');
  });
});

describe('accordion decorate — single-cell toggle row', () => {
  test('single-cell row becomes a toggle button with aria-expanded=false', async () => {
    const block = makeBlock(['Q1', 'A1'], ['Show more'], ['Q2', 'A2']);
    await decorate(block);

    const toggle = block.querySelector('.accordion-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.querySelector('span').textContent).toBe('Show more');
  });

  test('rows after the toggle row go into an accordion-more div that is hidden', async () => {
    const block = makeBlock(['Q1', 'A1'], ['Show more'], ['Q2', 'A2'], ['Q3', 'A3']);
    await decorate(block);

    const more = block.querySelector('.accordion-more');
    expect(more).not.toBeNull();
    expect(more.hidden).toBe(true);
    expect(more.querySelectorAll('.accordion-item')).toHaveLength(2);
  });

  test('rows before the toggle row remain directly in the block', async () => {
    const block = makeBlock(['Q1', 'A1'], ['Show more'], ['Q2', 'A2']);
    await decorate(block);

    // Q1 is a direct child accordion-item of the block
    const directItems = [...block.querySelectorAll(':scope > .accordion-item')];
    expect(directItems).toHaveLength(1);
    expect(directItems[0].querySelector('summary').textContent).toBe('Q1');
  });

  test('clicking the toggle button reveals and hides accordion-more', async () => {
    const block = makeBlock(['Q1', 'A1'], ['Show more'], ['Q2', 'A2']);
    await decorate(block);

    const toggle = block.querySelector('.accordion-toggle');
    const more = block.querySelector('.accordion-more');

    toggle.click();
    expect(more.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    toggle.click();
    expect(more.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('accordion decorate — split class layout', () => {
  test('distributes items into two .accordion-col divs', async () => {
    const block = makeBlock(['Q1', 'A1'], ['Q2', 'A2'], ['Q3', 'A3'], ['Q4', 'A4']);
    block.classList.add('split');
    await decorate(block);

    const cols = block.querySelectorAll(':scope > .accordion-col');
    expect(cols).toHaveLength(2);
    // items alternate: even indices → col 0, odd indices → col 1
    expect(cols[0].querySelectorAll('.accordion-item')).toHaveLength(2);
    expect(cols[1].querySelectorAll('.accordion-item')).toHaveLength(2);
  });

  test('split with odd number of items puts the extra in col 0', async () => {
    const block = makeBlock(['Q1', 'A1'], ['Q2', 'A2'], ['Q3', 'A3']);
    block.classList.add('split');
    await decorate(block);

    const cols = block.querySelectorAll(':scope > .accordion-col');
    expect(cols[0].querySelectorAll('.accordion-item')).toHaveLength(2);
    expect(cols[1].querySelectorAll('.accordion-item')).toHaveLength(1);
  });
});
