import decorate from './branch-finder.js';

/** Build a minimal detached block for branch-finder: one row with one div cell. */
function makeBlock() {
  const block = document.createElement('div');
  const row = document.createElement('div');
  const cell = document.createElement('div');
  cell.textContent = 'Find a branch near you';
  row.append(cell);
  block.append(row);
  return block;
}

describe('branch-finder decorate — smoke test', () => {
  afterEach(() => jest.restoreAllMocks());

  test('does not throw with a minimal block', async () => {
    const block = makeBlock();
    await expect(decorate(block)).resolves.not.toThrow();
  });

  test('appends a form with branch-finder-form class', async () => {
    const block = makeBlock();
    await decorate(block);
    expect(block.querySelector('form.branch-finder-form')).not.toBeNull();
  });

  test('form targets the RBC maps URL', async () => {
    const block = makeBlock();
    await decorate(block);
    const form = block.querySelector('form');
    expect(form.action).toBe('https://maps.rbcroyalbank.com/');
  });

  test('first child element gets class branch-finder-copy', async () => {
    const block = makeBlock();
    const copy = block.firstElementChild;
    await decorate(block);
    expect(copy.className).toBe('branch-finder-copy');
  });
});
