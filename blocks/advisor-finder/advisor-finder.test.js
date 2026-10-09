import decorate from './advisor-finder.js';

jest.mock('../modal/modal.js', () => ({
  createModal: jest.fn().mockResolvedValue({ showModal: jest.fn() }),
}));

jest.mock('../../utils/dom.js', () => ({
  escapeHtml: jest.fn((s) => String(s)),
}));

/** Build a minimal detached block for advisor-finder: two rows, each with one div cell. */
function makeBlock() {
  const block = document.createElement('div');

  const introRow = document.createElement('div');
  const introCell = document.createElement('div');
  introCell.textContent = 'Find an advisor';
  introRow.append(introCell);

  const sourceRow = document.createElement('div');
  const sourceCell = document.createElement('div');
  sourceRow.append(sourceCell);

  block.append(introRow, sourceRow);
  return block;
}

describe('advisor-finder decorate — smoke test', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ contacts: { data: [] }, team: { data: [] } }),
    });
  });

  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test('does not throw with a minimal block', async () => {
    const block = makeBlock();
    await expect(decorate(block)).resolves.not.toThrow();
  });

  test('renders a form and a province select inside the block', async () => {
    const block = makeBlock();
    await decorate(block);
    expect(block.querySelector('form.advisor-finder-form')).not.toBeNull();
    expect(block.querySelector('select#advisor-province')).not.toBeNull();
  });
});
