import decorate from './product-summary.js';

jest.mock('../../scripts/scripts.js', () => ({
  decorateIcons: jest.fn(),
  decorateMain: jest.fn(),
  decorateExternalLinks: jest.fn(),
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: jest.fn() });
});
afterEach(() => {
  delete global.fetch;
});

describe('product-summary decorate', () => {
  test('smoke: resolves without throwing when fetch fails', async () => {
    const block = document.createElement('div');
    const row = document.createElement('div');
    const cell = document.createElement('div');
    const a = document.createElement('a');
    a.setAttribute('href', '/products/test-product');
    a.textContent = 'Test Product';
    cell.append(a);
    row.append(cell);
    block.append(row);

    await expect(decorate(block)).resolves.toBeUndefined();
  });
});
