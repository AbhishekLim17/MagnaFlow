# Push notifications and the installable app

## Installable app

Nothing to set up. Chrome, Edge and Android show **Install** (address bar or menu); on an
iPhone use **Share → Add to Home Screen**. The app opens in its own window with the MagnaFlow
icon. It still needs a connection: nothing is cached, so every start loads the current version.

## Push notifications (free on the Spark plan)

Off until you do this once (about 2 minutes):

1. Firebase console → project `magnaflow-07sep25` → **Project settings → Cloud Messaging**.
2. Under **Web configuration → Web Push certificates**, click **Generate key pair**.
3. Copy the **public** key (the long string shown in the table).
4. GitHub → repository **Settings → Secrets and variables → Actions → Variables → New repository
   variable**: name `VITE_FCM_VAPID_KEY`, value the public key. (It is public by design; it is
   not a secret.)
5. The next deploy (push to `main`) shows **Notifications on this device** in the bell's
   **Email settings**.

If the mail job's log ever says a push was skipped with a permission error, open Google Cloud
console → APIs & Services and enable **Firebase Cloud Messaging API** for the project (it is
usually on already).

## How it behaves

- Each person turns it on per device (browser asks for permission). It sends the same things
  their emails do (assignments, mentions, client messages and requests…), following the same
  email settings, from the same 15-minute mail job. The bell in the app is still instant.
- Turning it off, or a device that stops accepting pushes, removes that device.
- On an iPhone, push works only for the app added to the Home Screen (iOS 16.4 or later).
