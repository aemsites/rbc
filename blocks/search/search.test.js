import decorate from './search.js';

jest.mock('../../utils/search-suggest.js', () => ({ __esModule: true, default: jest.fn() }));

describe('decorate', () => {
  test('builds a <form> with a search input inside the block', async () => {
    const block = document.createElement('div');
    await decorate(block);
    expect(block.querySelector('form')).not.toBeNull();
    expect(block.querySelector('input[type="search"]')).not.toBeNull();
  });

  test('form has method="get"', async () => {
    const block = document.createElement('div');
    await decorate(block);
    const form = block.querySelector('form');
    expect(form.method).toBe('get');
  });

  test('search input has role="combobox" and aria-autocomplete="list"', async () => {
    const block = document.createElement('div');
    await decorate(block);
    const input = block.querySelector('input[type="search"]');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
  });
});
