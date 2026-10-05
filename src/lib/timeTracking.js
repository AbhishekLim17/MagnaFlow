// Time logged on tasks, estimates, and what the time costs (labour) for the budget. Pure.
// Entries: time_entries (services/timeService); cost rates: organizations/{org}/finance/rates,
// an hourly rate per person with an organisation-wide default, in the project's currency.

export const MAX_ENTRY_MINUTES = 24 * 60;
export const MAX_ESTIMATE_HOURS = 10000;
export const MAX_NOTE = 500;

/**
 * Hours as people type them: "1.5", "1,5", "1:30", "90m", "2h", "1h 30m". Whole minutes,
 * or null when it is not a duration.
 */
export const parseDuration = (input) => {
  const s = String(input ?? '').trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d+):([0-5]?\d)$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*m(?:in)?$/))) return Math.round(Number(m[1]));
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*h(?:\s*(\d+)\s*m(?:in)?)?$/))) return Math.round(Number(m[1]) * 60) + Number(m[2] || 0);
  if ((m = s.match(/^\d+(?:\.\d+)?$/))) return Math.round(Number(s) * 60);
  return null;
};

/** 90 -> "1h 30m", 45 -> "45m", 120 -> "2h" */
export const formatMinutes = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const min = total % 60;
  if (!h) return `${min}m`;
  return min ? `${h}h ${min}m` : `${h}h`;
};

/** Why a duration cannot be logged, or null. */
export const durationProblem = (minutes) => {
  if (minutes == null) return 'Enter the time, for example 1.5 or 1:30.';
  if (minutes <= 0) return 'Enter more than zero.';
  if (minutes > MAX_ENTRY_MINUTES) return 'One entry can be at most 24 hours.';
  return null;
};

/** A person's hourly cost rate: their own, else the organisation's default, else 0. */
export const rateFor = (rates, uid) => {
  const own = rates?.people?.[uid];
  if (Number.isFinite(Number(own)) && own !== null && own !== '') return Number(own);
  return Number(rates?.defaultRate) || 0;
};

/**
 * Time and its cost, overall and per person.
 * @returns {{ minutes: number, cost: number, byPerson: Array<{ userId, userName, minutes, rate, cost }> }}
 */
export const labourCost = (entries, rates) => {
  const people = new Map();
  for (const e of entries || []) {
    const p = people.get(e.userId) || { userId: e.userId, userName: e.userName || 'Someone', minutes: 0 };
    p.minutes += Number(e.minutes) || 0;
    people.set(e.userId, p);
  }
  const byPerson = [...people.values()]
    .map((p) => {
      const rate = rateFor(rates, p.userId);
      return { ...p, rate, cost: Math.round((p.minutes / 60) * rate * 100) / 100 };
    })
    .sort((a, b) => b.minutes - a.minutes);
  return {
    minutes: byPerson.reduce((n, p) => n + p.minutes, 0),
    cost: Math.round(byPerson.reduce((n, p) => n + p.cost, 0) * 100) / 100,
    byPerson,
  };
};

/** Total estimate of these tasks, in hours (cancelled ones left out). */
export const estimatedHours = (tasks) => (tasks || [])
  .filter((t) => t.status !== 'cancelled')
  .reduce((n, t) => n + (Number(t.estimateHours) || 0), 0);

/** A task's estimate from the form: hours, at most MAX_ESTIMATE_HOURS, or null when empty. */
export const parseEstimate = (value) => {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.round(n * 4) / 4, MAX_ESTIMATE_HOURS); // quarter hours
};
