# 🌊 MagnaFlow

**Role-based project & task management for multi-tenant organisations.**

[![Live App](https://img.shields.io/badge/Live%20App-magnaflow--07sep25.web.app-3e30d9?logo=firebase&logoColor=white)](https://magnaflow-07sep25.web.app)
![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.3-06B6D4?logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Spark%20Plan-FFCA28?logo=firebase&logoColor=black)
![Tests](https://img.shields.io/badge/tests-173%20passing-brightgreen)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**🔗 [magnaflow-07sep25.web.app](https://magnaflow-07sep25.web.app)**

MagnaFlow is a multi-tenant task and project manager with a 5-tier role hierarchy, org-scoped Firestore security rules, and a Gantt timeline generated automatically from task dates — no charting library, no separate scheduling step. It runs entirely on **Firebase's free Spark plan**: no Cloud Functions are deployed, so every multi-tenant operation (org provisioning, staff creation, audit logging) is a direct, rules-gated client write, and scheduled work (reminders, cleanup) runs on GitHub Actions instead.

---

## ✨ Features

**Multi-tenant, by construction, not convention.** One organisation's admin can never read or write another organisation's users or tasks — enforced by Firestore security rules and checked by an automated suite (`npm run test:rules`), not just by the UI staying out of the way.

**Five roles, each with its own dashboard:**

| Role | Route | Scope |
|---|---|---|
| Master Admin | `/master` | Provisions/suspends organisations, sets seat limits, views usage stats, an append-only audit log (names resolved, not raw ids), and an error log fed by every unhandled crash in the app |
| Org Admin | `/admin` | Full control of their own organisation — staff, departments, projects, designations, tasks, reports |
| Department Head | `/department` | Owns their department: create/edit/remove staff, reset passwords, add designations, manage tasks — all scoped to the department, with rules that make privilege escalation structurally impossible, not just discouraged |
| Manager | `/manager` | Same powers as a Department Head, scoped to a project instead |
| Staff | `/staff` | Personal dashboard — assigned tasks, status updates, subtasks, comments, and their own Gantt timeline |

Legacy accounts created before this model existed carry role `admin`, treated everywhere as an alias for `org-admin`.

Everyone — including admins, heads and managers — sees the work assigned to *them*, not just the team rollup; that used to be staff-only.

**Other things worth knowing:**

- **Gantt timeline** for every role that has tasks, built from each task's start date and deadline — completed / in-progress / pending / overdue, with a "today" marker.
- **Threaded comments** on tasks, with inline `@mentions` and in-app notifications.
- **Firestore-backed error logging** — a render-time crash is caught, shown as a recoverable screen instead of a blank page, and logged for the Master Admin to see, with no third-party service required.
- **Email is fully server-side.** The browser only ever appends to a `mail_queue` collection; a scheduled GitHub Action drains it through Gmail using a secret the client never sees. Nothing that could send email ever ships to the browser.
- **Firebase Auth cleanup runs on its own.** Removing a staff member queues their orphaned sign-in for deletion; a scheduled Action clears it — the org-admin never touches the Firebase console.
- **Light/dark theme**, a collapsible sidebar that remembers your preference, and a design system built on CSS custom properties rather than one-off Tailwind classes.
- **Code-split per role** — a signed-in user only downloads their own dashboard; heavy one-off libraries (PDF/Excel export) load on demand instead of up front.

---

## 🔥 Firebase Spark plan — what that actually means

This project deliberately stays on **Spark**, Firebase's free tier, which cannot run most Cloud Functions (that needs the pay-as-you-go Blaze plan). Consequences worth knowing before you touch the code:

- **`functions/index.js` is legacy and not deployed.** It predates the current architecture, references a dependency (`@emailjs/nodejs`) this project no longer has, and should not be treated as documentation of anything current. Multi-tenant operations that would naturally be server-side (org provisioning, user creation, usage stats) are instead direct client Firestore writes gated entirely by `firestore.rules`. Scheduled work (reminders, auth cleanup, mail delivery) runs as GitHub Actions, which is why those live in `.github/workflows/` and `scripts/`, not `functions/`.
- **Deliberately absent:** user impersonation (needs the Admin SDK), automatic seat-limit enforcement, and server-side login rate limiting — the login flow calls a rate-limit check but **fails open** if it can't reach one, because a missing check must never lock out every user.
- **A browser can't delete a Firebase Auth account or set another user's password.** Removing a user queues the sign-in for cleanup (`scripts/process-auth-deletions.cjs`, run hourly via `auth-cleanup.yml`) instead of leaving it for a human to find in the console. Password resets go out as a Firebase reset email — nobody, including an admin, ever handles a plaintext password.
- **`storage.rules` exists but Firebase Storage was never enabled on this project.** There is no file-upload feature; nothing depends on it.

---

## 🏗️ Project structure

```
MagnaFlow/
├── .github/workflows/          # Deploy, rules tests, auth cleanup, reminders, queued email — all scheduled work
├── scripts/
│   ├── seed-emulator.cjs       # One account per role — quick local testing
│   ├── seed-scale.cjs          # ~50-person org: 5 depts, 8 projects, edge cases seeded on purpose
│   ├── send-queued-emails.cjs  # Drains mail_queue through Gmail (scheduled)
│   ├── send-daily-reminders.cjs
│   ├── process-auth-deletions.cjs
│   ├── check-secrets.cjs       # Fails the build if a .env.local value leaks into a tracked file
│   ├── backup-firestore.cjs
│   └── lib/mailer.cjs          # Shared Gmail sender + HTML template
├── tests/
│   └── firestore.rules.test.js # Cross-org isolation, privilege escalation, scoped access — 65 tests
├── src/
│   ├── components/
│   │   ├── admin/              # Org-admin & master-admin screens
│   │   ├── shared/              # DashboardLayout, StatCard, ProjectGanttChart, MyTasksPanel, ErrorBoundary
│   │   ├── staff/               # Task detail modals, change-password
│   │   ├── tasks/                # Mentions, comments
│   │   └── ui/                  # Radix UI primitives on a shared token system
│   ├── config/                 # firebase.js, roles.js, roleRoutes.js
│   ├── contexts/                # Auth, Tasks, Designations, Theme
│   ├── lib/                     # errorMessages, reportError, safeUnsubscribe, firestoreRecovery
│   ├── pages/                   # LoginPage, AdminDashboard, StaffDashboard, ScopedDashboard
│   ├── services/                 # Firestore API layer — one file per collection family
│   └── App.jsx                  # Router, lazy-loaded routes per role, ErrorBoundary
├── firestore.rules              # Org-scoped, role-scoped security rules — tested, see tests/
├── firestore.indexes.json
├── firebase.json                # Hosting + cache headers (rules/indexes deployed separately, see below)
├── firebase.test.json           # Minimal Firestore+Auth emulator config for local dev and rules tests
└── .env.example
```

---

## 🛠️ Tech stack

- **Frontend** — React 19, Vite 7, React Router
- **Backend** — Firebase Auth + Firestore (Spark plan — see above)
- **Email** — Gmail via Nodemailer, sent only from a scheduled GitHub Action
- **Charts** — Recharts for reports, a hand-rolled CSS/SVG Gantt for timelines (no chart library dependency there)
- **Styling** — Tailwind CSS + Radix UI, `framer-motion` for animation
- **Testing** — Vitest (108 unit/component tests) + `@firebase/rules-unit-testing` against the Firestore emulator (65 rules tests)

---

## 🚦 Getting started

### Prerequisites
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- **JDK 21+** — only needed for the Firestore emulator (rules tests, local emulator dev). `firebase-tools` v15+ refuses to start on anything older, with a Java-version error that reads like a test failure if you don't know to look for it.

### Install
```bash
git clone <repository-url>
cd MagnaFlow
npm install
```

### Configure
```bash
cp .env.example .env
```
Fill in your Firebase project's web config. These are build-time Vite variables — a missing one produces `Firebase: Error (auth/invalid-api-key)` at runtime, not a build failure, so check them first if a deployed build shows a blank screen.

### Run against your real Firebase project
```bash
npm run dev
```

### Run against a local emulator with realistic seed data
No real Firebase project needed — useful for trying every role without creating real accounts:
```bash
npm run emulators        # starts Firestore + Auth emulators
npm run seed              # one account per role, password Passw0rd!23
# or: npm run seed:scale  # a ~50-person org with edge cases baked in
npm run dev:emulated      # app now points at the emulators
```

### Test
```bash
npm test          # unit/component tests
npm run test:rules # Firestore security rules (spins up the emulator itself)
npm run lint
npm run check:secrets
```

---

## 📦 Deployment & operations

### What CI does automatically
Pushing to `main` runs `firebase-hosting-merge.yml`: secret scan → tests → rules tests → build → deploy **hosting only**. `VITE_FIREBASE_*` values come from GitHub repo **Variables** (not Secrets — this is public client config; the security rules are what actually guard data) and are injected at build time.

`rules-tests.yml` runs the Firestore rules suite on every push/PR as its own check, so a harness problem can't silently block a hosting deploy while a genuine rules regression still shows up red on the commit.

Two more workflows run on a schedule, independent of deploys: **`auth-cleanup.yml`** (hourly — clears orphaned Firebase Auth sign-ins) and **`send-queued-emails.yml`** (drains `mail_queue` through Gmail).

### What you must deploy manually
Firestore rules and indexes are **not** part of CI:
```bash
firebase deploy --only firestore:rules,firestore:indexes --project magnaflow-07sep25
```
Do this after any change to `firestore.rules` or `firestore.indexes.json` — a stale rules deploy is a silent, easy-to-miss gap between what's tested and what's live.

### Staging
```bash
npm run deploy:staging
```
**Talks to the same Firestore project as production.** It's for checking a build before it reaches `main`, not a sandbox for destructive experiments — take a backup first if you're testing anything that writes.

### Backups
Firestore's managed scheduled exports need the Blaze plan, so this project uses a local alternative:
```bash
node scripts/backup-firestore.cjs [--out ./backups] [--key ./service-account.json]
```
Dumps every collection, including nested subcollections, to a timestamped JSON file. `backups/` is gitignored — the dumps contain plaintext user data. Restore is intentionally manual, not automated.

---

## 📄 License
MIT.
