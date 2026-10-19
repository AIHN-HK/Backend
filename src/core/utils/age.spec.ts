import { calculateAge } from './age';

it.each([
  ['2009-10-20', '2026-10-19', 16],
  ['2009-10-19', '2026-10-19', 17],
  ['2008-02-29', '2026-02-28', 17],
  ['2008-02-29', '2026-03-01', 18],
])('calculates completed age for %s on %s', (birth, today, age) => {
  expect(calculateAge(new Date(birth), new Date(today))).toBe(age);
});
it('rejects invalid and future dates', () => {
  expect(() => calculateAge(new Date('invalid'))).toThrow();
  expect(() => calculateAge(new Date('3000-01-01'))).toThrow();
});
