import { parseDurationMs } from './duration.util';

describe('parseDurationMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['12h', 43_200_000],
    ['7d', 604_800_000],
  ])('parses %s', (input, expected) => {
    expect(parseDurationMs(input)).toBe(expected);
  });

  it.each(['', '15', 'm15', '1.5h', '10w'])('rejects invalid input %p', (input) => {
    expect(() => parseDurationMs(input)).toThrow(/Invalid duration/);
  });
});
