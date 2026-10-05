import { describe, test, expect } from 'vitest';
import { parseDuration, formatMinutes, durationProblem, rateFor, labourCost, estimatedHours, parseEstimate } from './timeTracking';

describe('parseDuration', () => {
  test('the ways people write time', () => {
    expect(parseDuration('1.5')).toBe(90);
    expect(parseDuration('1,5')).toBe(90);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('90m')).toBe(90);
    expect(parseDuration('2h')).toBe(120);
    expect(parseDuration('1h 30m')).toBe(90);
    expect(parseDuration(' 45 min ')).toBe(45);
  });

  test('anything else is not a duration', () => {
    for (const bad of ['', 'abc', '1:75', '-1', '1.5.2']) expect(parseDuration(bad)).toBeNull();
  });
});

test('formatMinutes', () => {
  expect(formatMinutes(90)).toBe('1h 30m');
  expect(formatMinutes(45)).toBe('45m');
  expect(formatMinutes(120)).toBe('2h');
  expect(formatMinutes(0)).toBe('0m');
});

test('durationProblem', () => {
  expect(durationProblem(null)).toMatch(/Enter the time/);
  expect(durationProblem(0)).toMatch(/more than zero/);
  expect(durationProblem(24 * 60 + 1)).toMatch(/24 hours/);
  expect(durationProblem(30)).toBeNull();
});

describe('labour cost', () => {
  const rates = { defaultRate: 500, people: { lead: 1200, intern: 0 } };

  test("a person's own rate, else the default", () => {
    expect(rateFor(rates, 'lead')).toBe(1200);
    expect(rateFor(rates, 'intern')).toBe(0);
    expect(rateFor(rates, 'someone')).toBe(500);
    expect(rateFor(null, 'someone')).toBe(0);
  });

  test('adds up time and cost per person, biggest first', () => {
    const r = labourCost([
      { userId: 'lead', userName: 'Lee', minutes: 90 },
      { userId: 'dev', userName: 'Dev', minutes: 240 },
      { userId: 'lead', userName: 'Lee', minutes: 30 },
    ], rates);
    expect(r.minutes).toBe(360);
    expect(r.cost).toBe(2000 + 2400);
    expect(r.byPerson.map((p) => [p.userId, p.minutes, p.cost])).toEqual([['dev', 240, 2000], ['lead', 120, 2400]]);
  });
});

test('estimates', () => {
  expect(estimatedHours([{ estimateHours: 4 }, { estimateHours: 2.5 }, { estimateHours: 8, status: 'cancelled' }, {}])).toBe(6.5);
  expect(parseEstimate('')).toBeNull();
  expect(parseEstimate('2,6')).toBe(2.5);
  expect(parseEstimate('-3')).toBeNull();
  expect(parseEstimate('99999')).toBe(10000);
});
