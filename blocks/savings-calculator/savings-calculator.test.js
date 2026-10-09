import { project, axisTicks } from './savings-calculator.js';

describe('project', () => {
  test('project(1000, 0, 12, 1, 0) returns 1 result with deposits = 1000 and value = 1000', () => {
    const result = project(1000, 0, 12, 1, 0);
    expect(result).toHaveLength(1);
    expect(result[0].deposits).toBe(1000);
    expect(result[0].value).toBe(1000);
  });

  test('project(0, 100, 12, 2, 0) returns 2 results with accumulating deposits', () => {
    const result = project(0, 100, 12, 2, 0);
    expect(result).toHaveLength(2);
    // 12 monthly contributions of 100 per year
    expect(result[0].deposits).toBe(1200);
    expect(result[1].deposits).toBe(2400);
  });

  test('with rate > 0 value exceeds deposits', () => {
    const result = project(1000, 100, 12, 5, 3);
    expect(result).toHaveLength(5);
    const last = result[result.length - 1];
    expect(last.value).toBeGreaterThan(last.deposits);
  });

  test('project(0, 0, 12, 0, 0) returns empty array for 0 years', () => {
    const result = project(0, 0, 12, 0, 0);
    expect(result).toHaveLength(0);
  });
});

describe('axisTicks', () => {
  // tick must be one of 1, 2, 2.5, 5, or 10 multiplied by a power of 10
  function isValidTick(tick) {
    if (!tick) return false;
    const mag = 10 ** Math.floor(Math.log10(tick));
    const normalized = tick / mag;
    return [1, 2, 2.5, 5, 10].some((m) => Math.abs(m - normalized) < 0.0001);
  }

  test('axisTicks(1000) returns a valid tick and max >= 1000', () => {
    const { tick, max } = axisTicks(1000);
    expect(isValidTick(tick)).toBe(true);
    expect(max).toBeGreaterThanOrEqual(1000);
  });

  test('axisTicks(50000) returns a valid tick and max >= 50000', () => {
    const { tick, max } = axisTicks(50000);
    expect(isValidTick(tick)).toBe(true);
    expect(max).toBeGreaterThanOrEqual(50000);
  });

  test('axisTicks(150) returns a valid tick and max >= 150', () => {
    const { tick, max } = axisTicks(150);
    expect(isValidTick(tick)).toBe(true);
    expect(max).toBeGreaterThanOrEqual(150);
  });

  test('axisTicks(0) treats 0 as 1 and returns a valid tick', () => {
    const { tick, max } = axisTicks(0);
    expect(isValidTick(tick)).toBe(true);
    expect(max).toBeGreaterThan(0);
  });

  test('max / tick is between 5 and 8 for typical values', () => {
    [1000, 50000, 150].forEach((value) => {
      const { tick, max } = axisTicks(value);
      const gridlines = max / tick;
      expect(gridlines).toBeGreaterThanOrEqual(5);
      expect(gridlines).toBeLessThanOrEqual(8);
    });
  });
});
