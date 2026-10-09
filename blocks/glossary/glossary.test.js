import decorate from './glossary.js';

function makeBlock(rows) {
  const block = document.createElement('div');
  rows.forEach(([letter, ...defs]) => {
    const row = document.createElement('div');
    const labelCell = document.createElement('div');
    labelCell.textContent = letter;
    row.append(labelCell);
    defs.forEach((text) => {
      const cell = document.createElement('div');
      cell.textContent = text;
      row.append(cell);
    });
    block.append(row);
  });
  return block;
}

describe('glossary decorate', () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
    });
    global.ResizeObserver = class {
      observe() {}

      disconnect() {}
    };
    global.requestAnimationFrame = jest.fn();
  });

  test('smoke: does not throw with valid word entries', async () => {
    const block = makeBlock([['A', 'Apple - a fruit']]);
    await expect(decorate(block)).resolves.toBeUndefined();
  });

  test('3 A-rows: nav and enabled letter button appear in block', async () => {
    const block = makeBlock([
      ['A', 'Alpha - first Greek letter'],
      ['A', 'Ant - small insect'],
      ['A', 'Arc - curved line'],
    ]);
    document.body.append(block);
    await decorate(block);

    const nav = block.querySelector('.glossary-nav');
    expect(nav).toBeTruthy();

    // The 'A' button should have aria-controls pointing to its section
    const enabledButton = block.querySelector('button.glossary-letter[aria-controls]');
    expect(enabledButton).toBeTruthy();
    expect(enabledButton.textContent).toBe('A');

    block.remove();
  });
});
