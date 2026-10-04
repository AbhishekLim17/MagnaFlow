# Google and Microsoft sign-in

MagnaFlow can show **Continue with Google** and **Continue with Microsoft** on the sign-in page.
Both are free on the Spark plan (plain Firebase Authentication, no Identity Platform upgrade).
They are **off** until you do the console steps below and set one build variable.

There is still no self sign-up: a provider only signs someone into a login an admin already
created. An address nobody in MagnaFlow uses is refused, and the account Firebase creates
for it in that moment is deleted again.

## 1. Google (about 2 minutes)

1. Firebase console → project `magnaflow-07sep25` → **Authentication → Sign-in method → Add new provider → Google**.
2. Enable it, choose the support email, **Save**.

## 2. Microsoft (about 10 minutes, needs an Azure account; free)

1. <https://portal.azure.com> → **Microsoft Entra ID → App registrations → New registration**.
   - Name: `MagnaFlow`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: platform **Web**, `https://magnaflow-07sep25.firebaseapp.com/__/auth/handler`
2. Copy the **Application (client) ID**.
3. **Certificates & secrets → New client secret**, copy its **Value** (shown once).
   Secrets expire (24 months at most): put a reminder in the calendar to renew it.
4. Firebase console → **Authentication → Sign-in method → Add new provider → Microsoft**:
   paste the client ID and the secret value, **Save**.

## 3. Check the domains and the linking setting

- **Authentication → Settings → Authorized domains** must list every address the app is served
  from (`magnaflow-07sep25.web.app`, `magnaflow-07sep25.firebaseapp.com`, any custom domain).
- **Authentication → Settings → User account linking**: keep **Link accounts that use the same email**
  (the default). MagnaFlow relies on one login per address.

## 4. Switch the buttons on

GitHub → repository **Settings → Secrets and variables → Actions → Variables → New repository variable**:

| Name | Value |
|---|---|
| `VITE_SIGNIN_PROVIDERS` | `google`, `microsoft`, or `google,microsoft` |

The next deploy (push to `main`) shows the buttons. Remove the variable to hide them again;
connected accounts stay connected and simply go unused.
For a local build put the same line in `.env.local`.

## How people use it

- **Their Google address is their MagnaFlow email** (Gmail or Google Workspace): Continue with Google
  signs them straight in.
  Note: Google is authoritative for those addresses, so if the MagnaFlow login's email was never
  verified, Firebase drops the password from that login at the first Google sign-in. Their account
  and data are untouched; they sign in with Google from then on. An admin's "reset password" link
  gives them a password again.
- **Any other case** (Microsoft, or a Google account with a different address): Continue with … asks
  them to sign in with their password **once**, then connects that account for next time.
  They can also connect it from inside the app: the key icon in the header → **Password and sign-in →
  Connected accounts → Connect**.
- A connected account can be disconnected there too, as long as another way in remains.

## What does not change

- The Firestore rules are the same: a sign-in with no MagnaFlow profile has no access to anything
  (`isSignedIn()` needs `users/{uid}`).
- Deactivated accounts and suspended organizations are refused exactly as with a password.
- Emails still go to the address on the MagnaFlow profile, not to the provider's address.

## Trying it locally

The Auth emulator fakes both providers, no console setup needed: `.env.emulated` already sets
`VITE_SIGNIN_PROVIDERS=google,microsoft`. Run the emulators, `npm run seed`, `npm run dev:emulated`,
and use **Continue with Google**: the emulator's window lets you type any address (use a seeded one,
e.g. `staff@demo.test`, to sign in as that person).
