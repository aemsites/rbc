import decorate from './account-comparison.js';

jest.mock('../../utils/products.js', () => ({
  getProduct: jest.fn().mockResolvedValue(null),
  offerLegalPage: jest.fn(() => ''),
}));

jest.mock('../../utils/dom.js', () => ({
  createElement: jest.fn((tag, attrs, children) => {
    const el = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (children != null) el.append(typeof children === 'string' ? children : String(children));
    return el;
  }),
  escapeHtml: jest.fn((s) => String(s)),
  safeUrl: jest.fn((s) => String(s)),
}));

jest.mock('../../utils/footnotes.js', () => ({
  footnoteSup: jest.fn(() => ''),
  stripRefs: jest.fn((s) => s),
  refIds: jest.fn(() => []),
  resolveRefLinks: jest.fn().mockResolvedValue(undefined),
}));

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

describe('account-comparison decorate — smoke test', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
  });

  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test('does not throw with a minimal 2-cell block', async () => {
    const block = makeBlock(['Label', 'Value']);
    await expect(decorate(block)).resolves.not.toThrow();
  });

  test('replaces block content with a table', async () => {
    const block = makeBlock(['Feature', 'Account A'], ['Row 1', 'Yes']);
    await decorate(block);
    expect(block.querySelector('table')).not.toBeNull();
  });
});
