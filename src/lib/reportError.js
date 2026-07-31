// One place to handle a failure: tell the user, tell the console, and — when
// it looks like a real defect — record it where a master admin can see it.
//
// Previously each catch block did its own thing: 25 of them piped
// `error.message` straight into a toast, so users saw raw Firebase text and
// nobody found out that anything had failed at all.

import { toast } from '@/components/ui/use-toast';
import { logError } from '@/services/errorLogService';
import { isExpectedError, toUserMessage } from '@/lib/errorMessages';

// An error needs longer on screen than a confirmation: it is unexpected, it is
// usually longer to read, and the user may need to act on it.
export const ERROR_TOAST_DURATION = 9000;

/**
 * Report a failure to the user and to diagnostics.
 *
 * @param {unknown} error       the caught error
 * @param {Object}  [options]
 * @param {string}  [options.title]    headline, e.g. 'Could not save task'
 * @param {string}  [options.fallback] message for an unrecognised error
 * @param {boolean} [options.silent]   skip the toast (still logged)
 * @param {Object}  [options.context]  extra fields for the error log
 * @returns {string} the message shown, so callers can reuse it inline
 */
export const reportError = (error, options = {}) => {
  const { title = 'Something went wrong', fallback, silent = false, context = {} } = options;
  const description = toUserMessage(error, fallback);

  console.error(`❌ ${title}:`, error);

  // Expected failures — a wrong password, a denied write, being offline — are
  // normal operation, not defects. Logging them would bury genuine faults.
  if (!isExpectedError(error)) {
    try {
      logError(error, { ...context, title });
    } catch {
      // Diagnostics must never take precedence over showing the user the
      // message they are waiting for.
    }
  }

  if (!silent) {
    toast({ title, description, variant: 'destructive', duration: ERROR_TOAST_DURATION });
  }

  return description;
};
