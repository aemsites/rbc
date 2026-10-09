import decorate from './table.js';

function buildBlock(rows) {
  const block = document.createElement('div');
  rows.forEach((cells) => {
    const row = document.createElement('div');
    cells.forEach((text) => {
      const cell = document.createElement('div');
      cell.textContent = text;
      row.append(cell);
    });
    block.append(row);
  });
  return block;
}

describe('decorate', () => {
  test('wraps content in a <table> element', async () => {
    const block = buildBlock([['H1', 'H2'], ['A', 'B'], ['C', 'D']]);
    await decorate(block);
    expect(block.querySelector('table')).not.toBeNull();
  });

  test('first row cells become <th scope="col">', async () => {
    const block = buildBlock([['Header 1', 'Header 2'], ['A', 'B'], ['C', 'D']]);
    await decorate(block);
    const ths = block.querySelectorAll('th');
    expect(ths).toHaveLength(2);
    ths.forEach((th) => expect(th.getAttribute('scope')).toBe('col'));
  });

  test('subsequent row cells become <td>', async () => {
    const block = buildBlock([['H1', 'H2'], ['Row1A', 'Row1B'], ['Row2A', 'Row2B']]);
    await decorate(block);
    const tds = block.querySelectorAll('td');
    expect(tds).toHaveLength(4);
  });

  test('header row goes into <thead>, data rows go into <tbody>', async () => {
    const block = buildBlock([['H1', 'H2'], ['A', 'B']]);
    await decorate(block);
    expect(block.querySelector('thead tr th')).not.toBeNull();
    expect(block.querySelector('tbody tr td')).not.toBeNull();
  });

  test('no-header class puts all rows as <td> in <tbody>', async () => {
    const block = buildBlock([['A', 'B'], ['C', 'D']]);
    block.classList.add('no-header');
    await decorate(block);
    expect(block.querySelector('thead')).toBeNull();
    const tds = block.querySelectorAll('td');
    expect(tds).toHaveLength(4);
  });
});
