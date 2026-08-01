// EmailJS configuration.
//
// Only values EmailJS intends to be public live here: the service id, template
// id and public key are designed to be visible in browser code. The private
// key is deliberately absent — anything prefixed VITE_ is inlined into the
// bundle and shipped to every visitor, so a private key must never carry that
// prefix. Server-side sending reads EMAILJS_PRIVATE_KEY from the environment
// in scripts/send-daily-reminders.cjs instead.
export const EMAIL_CONFIG = {
  SERVICE_ID: import.meta.env.VITE_EMAILJS_SERVICE_ID,
  TEMPLATE_ID: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
  PUBLIC_KEY: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
  ADMIN_EMAILS: import.meta.env.VITE_ADMIN_EMAILS || '',
};
