// EmailJS configuration.
//
// The service id, template id and public key are hardcoded on purpose. EmailJS
// designs these three to be public — they are compiled into the browser bundle
// on every build, so anyone can read them out of the deployed JavaScript no
// matter where we keep them. Holding them in environment variables bought no
// secrecy and cost an outage: the VITE_EMAILJS_* repository variables were
// never set, so production shipped with all three undefined, initializeEmailJS
// bailed out, and nothing the app tried to email was going out at all.
//
// The env vars still win when set, so another EmailJS account can be pointed at
// without a code change.
//
// The private key is deliberately absent and must stay that way. Anything
// prefixed VITE_ is inlined into the bundle and served to every visitor, and
// that key grants send rights on the account. Server-side sending reads
// EMAILJS_PRIVATE_KEY from the environment in scripts/send-daily-reminders.cjs.
export const EMAIL_CONFIG = {
  SERVICE_ID: import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_itwo1ee',
  TEMPLATE_ID: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_mwmmgmi',
  PUBLIC_KEY: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'sLvBE12fOqa4zsra-',
  ADMIN_EMAILS: import.meta.env.VITE_ADMIN_EMAILS || '',
};
