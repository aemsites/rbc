import { numbers } from './value-calculator.js';

describe('numbers', () => {
  test('parses a comma-separated list of numbers', () => {
    expect(numbers('1,2,3', [0, 0, 0])).toEqual([1, 2, 3]);
  });

  test('trims whitespace around each number', () => {
    expect(numbers('10, 5, 3', [0, 0, 0])).toEqual([10, 5, 3]);
  });

  test('returns fallback when parsed list length does not match fallback length', () => {
    expect(numbers('1,2', [0, 0, 0])).toEqual([0, 0, 0]);
  });

  test('returns fallback when values are non-numeric', () => {
    expect(numbers('a,b,c', [0, 0, 0])).toEqual([0, 0, 0]);
  });

  test('returns fallback for empty string', () => {
    expect(numbers('', [0])).toEqual([0]);
  });

  test('returns fallback for null input', () => {
    expect(numbers(null, [1, 2])).toEqual([1, 2]);
  });

  test('parses float values correctly', () => {
    expect(numbers('1.5,2.5,3.5', [0, 0, 0])).toEqual([1.5, 2.5, 3.5]);
  });
});
