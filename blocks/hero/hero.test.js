import decorate from './hero.js';

function makeBlock(...rows) {
  const block = document.createElement('div');
  rows.forEach((cells) => {
    const row = document.createElement('div');
    cells.forEach((content) => {
      const cell = document.createElement('div');
      if (typeof content === 'string') {
        cell.innerHTML = content;
      } else {
        cell.append(content);
      }
      row.append(cell);
    });
    block.append(row);
  });
  return block;
}

describe('hero decorate', () => {
  test('smoke: block with heading and paragraph does not throw', () => {
    const block = makeBlock(['<h1>Test heading</h1><p>Some text</p>']);
    expect(() => decorate(block)).not.toThrow();
  });

  test('block with picture in second cell gets a hero-media element', () => {
    const picture = document.createElement('picture');
    const block = makeBlock(
      ['<h1>Test heading</h1>'],
      // second row is not needed; picture in a second *cell* of the first row triggers columns
    );
    // Rebuild: one row, two cells — text cell and picture cell
    block.innerHTML = '';
    const row = document.createElement('div');
    const textCell = document.createElement('div');
    textCell.innerHTML = '<h1>Test heading</h1>';
    const mediaCell = document.createElement('div');
    mediaCell.append(picture);
    row.append(textCell, mediaCell);
    block.append(row);

    decorate(block);

    expect(block.querySelector('.hero-media')).toBeTruthy();
  });
});
