// Passwords, in one place: the rule, a generator, and a rough strength rating.
//
// Every place that sets a password used to carry its own rule ("minimum 6" in four
// spots, none in a fifth) and the admin who created an account had to invent a
// password and then somehow pass it on. The generator below gives them a good one in a
// click; the rule and rating are shared so the forms agree.

export const MIN_PASSWORD_LENGTH = 8;

// No 0/O, 1/l/I: a password read out or copied by hand must not be ambiguous.
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?';
const ALL = LOWER + UPPER + DIGITS;

// Unbiased random index below `max` (rejection sampling: `% max` alone favours the
// low values whenever 2^32 is not a multiple of max).
const randomBelow = (max) => {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
};

const pick = (chars) => chars[randomBelow(chars.length)];

/**
 * A random password that always has a lower-case letter, an upper-case letter and a
 * digit (so it passes any reasonable policy), plus a symbol when there is room.
 */
export const generatePassword = (length = 14) => {
  const size = Math.max(MIN_PASSWORD_LENGTH, length);
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  if (size >= 12) chars.push(pick(SYMBOLS));
  while (chars.length < size) chars.push(pick(ALL));
  // Fisher-Yates, so the guaranteed characters are not always at the front.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomBelow(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

/** Why this password is not acceptable, in words a person can act on, or null if it is. */
export const passwordProblem = (password) => {
  const pw = String(password ?? '');
  if (!pw) return 'Enter a password.';
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters (this has ${pw.length}).`;
  }
  return null;
};

const COMMON = ['password', 'passw0rd', 'qwerty', 'letmein', 'welcome', 'admin123', 'iloveyou', 'abc123'];

/**
 * A rough rating for the strength meter. This is guidance, not a gate: only
 * `passwordProblem` can block a form.
 * @returns {{ score: 0|1|2|3, label: string }}
 */
export const passwordStrength = (password, { email = '' } = {}) => {
  const pw = String(password ?? '');
  if (!pw) return { score: 0, label: '' };
  if (pw.length < MIN_PASSWORD_LENGTH) return { score: 0, label: 'Too short' };

  const lower = pw.toLowerCase();
  const local = String(email).split('@')[0].toLowerCase();
  const guessable =
    COMMON.some((c) => lower.includes(c))
    || /^(.)\1+$/.test(pw)                       // aaaaaaaa
    || /^(?:0123|1234|2345|3456|4567|5678|6789)/.test(pw)
    || (local.length >= 3 && lower.includes(local));
  if (guessable) return { score: 1, label: 'Easy to guess' };

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  const points = (pw.length >= 12 ? 2 : pw.length >= 10 ? 1 : 0) + (classes >= 3 ? 1 : 0) + (classes === 4 ? 1 : 0);
  if (points >= 3) return { score: 3, label: 'Strong' };
  if (points >= 1) return { score: 2, label: 'Good' };
  return { score: 1, label: 'Fair' };
};
