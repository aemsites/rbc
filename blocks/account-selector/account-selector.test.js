import { slugFor, guess } from './account-selector.js';

jest.mock('../../utils/dom.js', () => ({
  escapeHtml: jest.fn((s) => String(s)),
  safeUrl: jest.fn((s) => String(s)),
}));

jest.mock('../../utils/products.js', () => ({
  getProduct: jest.fn().mockResolvedValue(null),
  getProducts: jest.fn().mockResolvedValue([]),
  pickHighlights: jest.fn(() => []),
  isPrice: jest.fn(() => false),
}));

jest.mock('../../utils/footnotes.js', () => ({
  footnoteSup: jest.fn(() => ''),
  expandRefs: jest.fn((s) => s),
  resolveRefLinks: jest.fn(),
}));

describe('slugFor', () => {
  test('"VIP Account" → vip-banking', () => {
    expect(slugFor('VIP Account')).toBe('vip-banking');
  });

  test('"vip" (lowercase) → vip-banking', () => {
    expect(slugFor('vip')).toBe('vip-banking');
  });

  test('"Signature No Limit" → signature-no-limit', () => {
    expect(slugFor('Signature No Limit')).toBe('signature-no-limit');
  });

  test('"Sans Limite" → signature-no-limit', () => {
    expect(slugFor('Sans Limite')).toBe('signature-no-limit');
  });

  test('"Day to Day Banking" → day-to-day-banking', () => {
    expect(slugFor('Day to Day Banking')).toBe('day-to-day-banking');
  });

  test('"Compte courant" → day-to-day-banking', () => {
    expect(slugFor('Compte courant')).toBe('day-to-day-banking');
  });

  test('"Advantage Banking" → advantage-banking', () => {
    expect(slugFor('Advantage Banking')).toBe('advantage-banking');
  });

  test('"Avantage" → advantage-banking', () => {
    expect(slugFor('Avantage')).toBe('advantage-banking');
  });

  test('unknown name → undefined', () => {
    expect(slugFor('Unknown Account')).toBeUndefined();
  });
});

describe('guess', () => {
  test('additionalAccounts=Yes → vip-banking (highest priority)', () => {
    expect(guess({
      additionalAccounts: 'Yes',
      creditCardFee: 'Yes',
      safeDepositBox: 'Yes',
      numDebits: 5,
      isStudent: 'No',
      isNewcomer: 'No',
    })).toBe('vip-banking');
  });

  test('creditCardFee=Yes → signature-no-limit', () => {
    expect(guess({
      additionalAccounts: 'No',
      creditCardFee: 'Yes',
      safeDepositBox: 'No',
      numDebits: 5,
      isStudent: 'No',
      isNewcomer: 'No',
    })).toBe('signature-no-limit');
  });

  test('safeDepositBox=Yes → signature-no-limit', () => {
    expect(guess({
      additionalAccounts: 'No',
      creditCardFee: 'No',
      safeDepositBox: 'Yes',
      numDebits: 5,
      isStudent: 'No',
      isNewcomer: 'No',
    })).toBe('signature-no-limit');
  });

  test('numDebits<=12, not student, not newcomer → day-to-day-banking', () => {
    expect(guess({
      additionalAccounts: 'No',
      creditCardFee: 'No',
      safeDepositBox: 'No',
      numDebits: 12,
      isStudent: 'No',
      isNewcomer: 'No',
    })).toBe('day-to-day-banking');
  });

  test('numDebits=0, not student, not newcomer → day-to-day-banking', () => {
    expect(guess({
      additionalAccounts: 'No',
      creditCardFee: 'No',
      safeDepositBox: 'No',
      numDebits: 0,
      isStudent: 'No',
      isNewcomer: 'No',
    })).toBe('day-to-day-banking');
  });

  test('numDebits>12 → advantage-banking', () => {
    expect(guess({
      additionalAccounts: 'No',
      creditCardFee: 'No',
      safeDepositBox: 'No',
      numDebits: 13,
      isStudent: 'No',
      isNewcomer: 'No',
    })).toBe('advantage-banking');
  });

  test('isStudent=Yes with low debits → advantage-banking (not day-to-day)', () => {
    expect(guess({
      additionalAccounts: 'No',
      creditCardFee: 'No',
      safeDepositBox: 'No',
      numDebits: 5,
      isStudent: 'Yes',
      isNewcomer: 'No',
    })).toBe('advantage-banking');
  });

  test('isNewcomer=Yes with low debits → advantage-banking (not day-to-day)', () => {
    expect(guess({
      additionalAccounts: 'No',
      creditCardFee: 'No',
      safeDepositBox: 'No',
      numDebits: 5,
      isStudent: 'No',
      isNewcomer: 'Yes',
    })).toBe('advantage-banking');
  });

  test('no special conditions → advantage-banking as fallback', () => {
    expect(guess({
      additionalAccounts: 'No',
      creditCardFee: 'No',
      safeDepositBox: 'No',
      numDebits: 99,
      isStudent: 'No',
      isNewcomer: 'No',
    })).toBe('advantage-banking');
  });
});
