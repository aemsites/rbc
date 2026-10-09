import {
  normalizeLabel, legalId, footnoteSup, expandRefs, stripRefs, refIds,
} from './footnotes.js';

describe('normalizeLabel', () => {
  test('removes all whitespace', () => expect(normalizeLabel('  *  ')).toBe('*'));
  test('removes trailing )', () => expect(normalizeLabel('1)')).toBe('1'));
  test('collapses internal spaces', () => expect(normalizeLabel('a  b')).toBe('ab'));
  test('leaves a clean label unchanged', () => expect(normalizeLabel('*')).toBe('*'));
  test('does not remove ) that is not trailing', () => expect(normalizeLabel('(1)')).toBe('(1'));
});

describe('legalId', () => {
  test('maps * to "asterisk"', () => expect(legalId('*')).toBe('legal-asterisk'));
  test('maps ** to "double-asterisk"', () => expect(legalId('**')).toBe('legal-double-asterisk'));
  test('maps † to "dagger"', () => expect(legalId('†')).toBe('legal-dagger'));
  test('maps numeric label directly', () => expect(legalId('1')).toBe('legal-1'));
  test('lowercases a word label', () => expect(legalId('MyLabel')).toBe('legal-mylabel'));
  test('replaces non-alphanumeric with hyphens', () => expect(legalId('My Label')).toBe('legal-my-label'));
  test('includes the tab when provided', () => expect(legalId('*', 'visa')).toBe('legal-visa-asterisk'));
  test('"default" tab produces no tab segment', () => expect(legalId('1', 'default')).toBe('legal-1'));
});

describe('footnoteSup', () => {
  test('returns empty string for empty value', () => expect(footnoteSup('')).toBe(''));
  test('returns empty string for null', () => expect(footnoteSup(null)).toBe(''));
  test('returns empty string for undefined', () => expect(footnoteSup(undefined)).toBe(''));

  test('wraps a single id in <sup><a data-ref></sup>', () => {
    const html = footnoteSup('note-1');
    expect(html).toContain('<sup>');
    expect(html).toContain('data-ref="note-1"');
    expect(html).toContain('</sup>');
  });

  test('includes data-page when a page is provided', () => {
    expect(footnoteSup('note-1', '/products/visa')).toContain('data-page="/products/visa"');
  });

  test('creates one anchor per id for comma-separated ids', () => {
    const html = footnoteSup('a, b');
    expect(html).toContain('data-ref="a"');
    expect(html).toContain('data-ref="b"');
  });

  test('escapes special characters in id', () => {
    const html = footnoteSup('"xss"');
    expect(html).not.toContain('"xss"');
    expect(html).toContain('&#34;xss&#34;');
  });
});

describe('expandRefs', () => {
  test('replaces [[id]] with a <sup> placeholder', () => {
    const result = expandRefs('Fee[[note-1]] applies');
    expect(result).toContain('<sup>');
    expect(result).toContain('data-ref="note-1"');
    expect(result).toContain('Fee');
    expect(result).toContain(' applies');
  });

  test('passes page to the generated anchor', () => {
    expect(expandRefs('Text[[id]]', '/products/page')).toContain('data-page="/products/page"');
  });

  test('replaces multiple markers', () => {
    const result = expandRefs('A[[x]] and B[[y]]');
    expect(result).toContain('data-ref="x"');
    expect(result).toContain('data-ref="y"');
  });

  test('returns unchanged string when no markers are present', () => {
    expect(expandRefs('No refs here')).toBe('No refs here');
  });

  test('returns empty string for null', () => expect(expandRefs(null)).toBe(''));
  test('returns empty string for undefined', () => expect(expandRefs(undefined)).toBe(''));
});

describe('stripRefs', () => {
  test('removes a [[...]] marker', () => {
    expect(stripRefs('Fee[[note]] applies')).toBe('Fee applies');
  });

  test('removes multiple markers', () => {
    expect(stripRefs('A[[1]] and B[[2]]')).toBe('A and B');
  });

  test('returns the string unchanged when there are no markers', () => {
    expect(stripRefs('Hello')).toBe('Hello');
  });

  test('returns empty string for empty input', () => expect(stripRefs('')).toBe(''));
  test('returns empty string for null', () => expect(stripRefs(null)).toBe(''));
});

describe('refIds', () => {
  test('extracts a single id', () => expect(refIds('Fee[[note-1]]')).toBe('note-1'));
  test('extracts comma-separated ids from one marker', () => expect(refIds('A[[x, y]]')).toBe('x, y'));
  test('joins ids from multiple markers with commas', () => expect(refIds('A[[x]] B[[y]]')).toBe('x,y'));
  test('returns empty string when there are no markers', () => expect(refIds('Hello')).toBe(''));
  test('returns empty string for empty input', () => expect(refIds('')).toBe(''));
});
