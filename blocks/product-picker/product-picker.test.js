import decorate from './product-picker.js';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: jest.fn() });
});
afterEach(() => {
  delete global.fetch;
});

describe('product-picker decorate', () => {
  test('smoke: resolves without throwing when fetch fails', async () => {
    const block = document.createElement('div');
    const row = document.createElement('div');
    const cell = document.createElement('div');
    const a = document.createElement('a');
    a.setAttribute('href', '/products/test-account');
    a.textContent = 'Test Account';
    cell.append(a);
    const cell2 = document.createElement('div');
    row.append(cell, cell2);
    block.append(row);

    await expect(decorate(block)).resolves.toBeUndefined();
  });
});
