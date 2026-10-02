// Checks for the "create an account" forms (staff, admins, an organization's first
// admin), so they all say the same thing about the same mistake - next to the field,
// instead of a generic "Please fill in all required fields." toast.
import { passwordProblem } from './password';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const nameProblem = (name) => (String(name ?? '').trim() ? null : 'Enter a name.');

export const emailProblem = (email) => {
  const value = String(email ?? '').trim();
  if (!value) return 'Enter an email address.';
  if (!EMAIL.test(value)) return 'That does not look like an email address (for example name@company.com).';
  return null;
};

/**
 * @returns {{ name?: string, email?: string, password?: string }} one message per field
 *   that is wrong; an empty object means the form can be submitted.
 */
export const validateNewAccount = ({ name, email, password }) => {
  const errors = {};
  const checks = { name: nameProblem(name), email: emailProblem(email), password: passwordProblem(password) };
  for (const [field, problem] of Object.entries(checks)) {
    if (problem) errors[field] = problem;
  }
  return errors;
};

/**
 * Returns a copy of `errors` without the fields whose value changed between `before`
 * and `after`, so an error disappears when the person starts fixing it (and not when
 * they edit some other field).
 */
export const clearEditedErrors = (errors, before, after) => {
  const next = { ...errors };
  for (const field of Object.keys(errors)) {
    if (before?.[field] !== after?.[field]) delete next[field];
  }
  return next;
};
