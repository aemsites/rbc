import decorate from './footer.js';

jest.mock('../fragment/fragment.js', () => ({
  loadFragment: jest.fn().mockResolvedValue(null),
}));

describe('footer decorate', () => {
  test('resolves without throwing when loadFragment returns null', async () => {
    const block = document.createElement('div');
    await expect(decorate(block)).resolves.toBeUndefined();
  });
});
