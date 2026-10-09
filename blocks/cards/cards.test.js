import decorate from './cards.js';

beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
});

describe('decorate', () => {
  test('resolves without throwing for a tile block with content and picture cells', async () => {
    const block = document.createElement('div');
    block.classList.add('cards', 'tile');

    const row = document.createElement('div');

    const cell1 = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.textContent = 'Card Title';
    const p = document.createElement('p');
    p.textContent = 'Some description text';
    cell1.append(h2, p);

    const cell2 = document.createElement('div');
    const picP = document.createElement('p');
    const picture = document.createElement('picture');
    picP.append(picture);
    cell2.append(picP);

    row.append(cell1, cell2);
    block.append(row);

    await decorate(block);

    expect(block.querySelector('ul')).not.toBeNull();
  });
});
