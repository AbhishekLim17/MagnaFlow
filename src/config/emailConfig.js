// Client-side email settings.
//
// There is no sending credential here any more, and there should never be one
// again. The browser only appends to the `mail_queue` collection; a scheduled
// GitHub Action delivers through Gmail using a secret the client never sees.
// This previously held an EmailJS private key behind a VITE_ prefix, which
// inlines a value into the bundle and serves it to every visitor.
export const EMAIL_CONFIG = {
  // Addresses copied on assignment and critical-task notifications.
  CC_EMAILS: import.meta.env.VITE_CC_EMAILS || '',
};
