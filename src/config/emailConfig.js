// EmailJS Configuration - Using environment variables for security
export const EMAIL_CONFIG = {
  SERVICE_ID: import.meta.env.VITE_EMAILJS_SERVICE_ID,
  TEMPLATE_ID: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
  PUBLIC_KEY: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
  // Private key should only be used server-side, but included for cron trigger
  PRIVATE_KEY: import.meta.env.VITE_EMAILJS_PRIVATE_KEY,
  ADMIN_EMAILS: import.meta.env.VITE_ADMIN_EMAILS || 'pankaj@magnetar.in,dhaval@magnetar.in,tejas@magnetar.in'
};
