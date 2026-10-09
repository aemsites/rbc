import {
  isPrice, keyList, pickHighlights, monthlyFees, isCreditCard, offerLegalPage,
} from './products.js';

describe('isPrice', () => {
  test('matches prefix dollar-amount format ($4.99)', () => expect(isPrice('$4.99')).toBe(true));
  test('matches spaced prefix format ($ 10)', () => expect(isPrice('$ 10')).toBe(true));
  test('matches suffix dollar-amount format (4 $)', () => expect(isPrice('4 $')).toBe(true));
  test('matches $0', () => expect(isPrice('$0')).toBe(true));
  test('rejects plain text', () => expect(isPrice('Free')).toBe(false));
  test('rejects empty string', () => expect(isPrice('')).toBe(false));
  test('returns false when called with no argument', () => expect(isPrice()).toBe(false));
});

describe('keyList', () => {
  const cell = (text) => ({ textContent: text });

  test('splits a comma-separated string', () => {
    expect(keyList(cell('a, b, c'))).toEqual(['a', 'b', 'c']);
  });

  test('trims whitespace from each key', () => {
    expect(keyList(cell('  x , y  '))).toEqual(['x', 'y']);
  });

  test('filters out empty entries', () => {
    expect(keyList(cell('a,,b'))).toEqual(['a', 'b']);
  });

  test('returns an empty array for null', () => expect(keyList(null)).toEqual([]));

  test('returns an empty array for an empty textContent', () => {
    expect(keyList(cell(''))).toEqual([]);
  });
});

describe('pickHighlights', () => {
  const highlights = [
    { key: 'a', text: 'Alpha', default: 'true' },
    { key: 'b', text: 'Beta', default: 'false' },
    { key: 'c', text: 'Gamma', default: 'true' },
  ];
  const product = { highlights };

  test('picks highlights in key order when keys are provided', () => {
    expect(pickHighlights(product, ['b', 'a'])).toEqual([highlights[1], highlights[0]]);
  });

  test('omits keys that do not match any highlight', () => {
    expect(pickHighlights(product, ['a', 'missing'])).toEqual([highlights[0]]);
  });

  test('returns only the defaults when no keys are given', () => {
    expect(pickHighlights(product)).toEqual([highlights[0], highlights[2]]);
  });

  test('returns all highlights when there are no defaults and no keys', () => {
    const p = { highlights: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }] };
    expect(pickHighlights(p)).toEqual(p.highlights);
  });

  test('returns an empty array when the key list has no matches', () => {
    expect(pickHighlights(product, ['nonexistent'])).toEqual([]);
  });
});

describe('monthlyFees', () => {
  test('returns the first fee as the regular fee', () => {
    const product = { fees: [{ displayValue: '$10.95', label: 'Monthly', footnotes: '' }] };
    expect(monthlyFees(product).regular).toBe('$10.95');
  });

  test('returns empty regular fee when there are no fees', () => {
    expect(monthlyFees({ fees: [] }).regular).toBe('');
  });

  test('extracts a Value Program fee as the rebate', () => {
    const product = {
      fees: [
        { displayValue: '$10.95', label: 'Monthly Fee', footnotes: '' },
        { displayValue: '$4.00', label: 'Value Program', footnotes: '' },
      ],
    };
    expect(monthlyFees(product).rebate).toBe('$4.00');
  });

  test('strips "as low as" prefix from the rebate value', () => {
    const product = {
      fees: [
        { displayValue: '$10.95', label: 'Monthly', footnotes: '' },
        { displayValue: 'as low as $4.00', label: 'Value Program', footnotes: '' },
      ],
    };
    expect(monthlyFees(product).rebate).toBe('$4.00');
  });

  test('strips French "aussi peu que" prefix from the rebate value', () => {
    const product = {
      fees: [
        { displayValue: '$10.95', label: 'Mensuel', footnotes: '' },
        { displayValue: 'aussi peu que $4.00', label: 'Programme Valeur', footnotes: '' },
      ],
    };
    expect(monthlyFees(product).rebate).toBe('$4.00');
  });

  test('returns empty rebate when there is no Value Program fee', () => {
    const product = { fees: [{ displayValue: '$10.95', label: 'Monthly', footnotes: '' }] };
    expect(monthlyFees(product).rebate).toBe('');
  });

  test('returns footnotes for regular and rebate fees', () => {
    const product = {
      fees: [
        { displayValue: '$10.95', label: 'Monthly', footnotes: 'note-1' },
        { displayValue: '$4.00', label: 'Value Program', footnotes: 'note-2' },
      ],
    };
    const result = monthlyFees(product);
    expect(result.regularFootnotes).toBe('note-1');
    expect(result.rebateFootnotes).toBe('note-2');
  });
});

describe('isCreditCard', () => {
  test('returns true for the credit-card category', () => {
    expect(isCreditCard({ category: 'credit-card' })).toBe(true);
  });

  test('returns false for chequing', () => expect(isCreditCard({ category: 'chequing' })).toBe(false));
  test('returns false for savings', () => expect(isCreditCard({ category: 'savings' })).toBe(false));
});

describe('offerLegalPage', () => {
  test('returns offerDetailsUrl when it is a site-relative path', () => {
    const product = { offerDetailsUrl: '/offers/summer', productPage: '/products/visa' };
    expect(offerLegalPage(product)).toBe('/offers/summer');
  });

  test('returns productPage when offerDetailsUrl is an absolute external URL', () => {
    const product = { offerDetailsUrl: 'https://external.com/offer', productPage: '/products/visa' };
    expect(offerLegalPage(product)).toBe('/products/visa');
  });

  test('returns productPage when offerDetailsUrl is undefined', () => {
    expect(offerLegalPage({ productPage: '/products/visa' })).toBe('/products/visa');
  });
});
