import decorate from './columns.js';

describe('decorate', () => {
  test('adds columns-2-cols class for a 2-column block', () => {
    const block = document.createElement('div');
    const row = document.createElement('div');
    const col1 = document.createElement('div');
    col1.innerHTML = '<p>Column 1 content</p>';
    const col2 = document.createElement('div');
    col2.innerHTML = '<p>Column 2 content</p>';
    row.append(col1, col2);
    block.append(row);

    decorate(block);

    expect(block.classList.contains('columns-2-cols')).toBe(true);
  });

  test('adds columns-3-cols class for a 3-column block', () => {
    const block = document.createElement('div');
    const row = document.createElement('div');
    ['A', 'B', 'C'].forEach((label) => {
      const col = document.createElement('div');
      col.innerHTML = `<p>${label}</p>`;
      row.append(col);
    });
    block.append(row);

    decorate(block);

    expect(block.classList.contains('columns-3-cols')).toBe(true);
  });

  test('adds columns-img-col class to image-only columns', () => {
    const block = document.createElement('div');
    const row = document.createElement('div');

    const imgCol = document.createElement('div');
    const picture = document.createElement('picture');
    imgCol.append(picture);

    const textCol = document.createElement('div');
    textCol.innerHTML = '<p>Text</p>';

    row.append(imgCol, textCol);
    block.append(row);

    decorate(block);

    expect(imgCol.classList.contains('columns-img-col')).toBe(true);
    expect(textCol.classList.contains('columns-img-col')).toBe(false);
  });
});
