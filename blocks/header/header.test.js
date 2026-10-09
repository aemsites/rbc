import decorate from './header.js';

jest.mock('../fragment/fragment.js', () => ({
  loadFragment: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../scripts/scripts.js', () => ({
  decorateIcons: jest.fn(),
  decorateMain: jest.fn(),
  decorateExternalLinks: jest.fn(),
}));

describe('header decorate', () => {
  test('smoke: resolves without throwing when loadFragment returns null', async () => {
    const block = document.createElement('div');
    await expect(decorate(block)).resolves.toBeUndefined();
  });
});
