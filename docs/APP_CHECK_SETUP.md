# Enabling App Check

App Check lets Firebase reject requests that did not come from this app running in a real browser. It is the free-plan substitute for server-side login rate limiting: it blunts scripted signup/login floods and bulk reads made with a copied web config.

The code is already in `src/config/firebase.js` and does nothing until you complete these steps. They need the Firebase console, so they cannot be done from the repo.

1. **Create a reCAPTCHA v3 key** at https://www.google.com/recaptcha/admin (type: reCAPTCHA v3; domains: `magnaflow-07sep25.web.app`, `magnaflow-07sep25.firebaseapp.com`). Keep the *secret* key for step 2; the *site* key is public.
2. **Register it in Firebase**: Console -> Build -> App Check -> your web app -> reCAPTCHA v3 -> paste the secret key.
3. **Give the build the site key**: add `VITE_APPCHECK_SITE_KEY=<site key>` as a GitHub Actions variable and pass it in the build steps of `firebase-hosting-merge.yml` (same way as the other `VITE_FIREBASE_*` values). For a local production build put it in `.env.production`.
4. **Ship, then watch**: deploy, and open App Check -> APIs. Firestore and Authentication show the share of *verified* requests. Wait until it is ~100% for a few days.
5. **Enforce**: only then switch Firestore and Authentication to *Enforce*. Enforcing earlier locks out users on old cached bundles.

## Local development

With a site key set, the dev server prints an App Check **debug token** in the browser console on first load. Register it under App Check -> Manage debug tokens. To keep it stable, set `VITE_APPCHECK_DEBUG_TOKEN` in `.env.development.local` (not `.env.local` - `npm run build` refuses secret-looking `VITE_` values in files a production build reads).

The emulator mode (`npm run dev:emulated`) skips App Check entirely.

## Rollback

Switch enforcement off in the console. Nothing in the app needs to change.
