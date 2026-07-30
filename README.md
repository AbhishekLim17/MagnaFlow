# 🌊 MagnaFlow - Role-Based Project & Task Management

![React](https://img.shields.io/badge/React-19.2-blue.svg)
![Vite](https://img.shields.io/badge/Vite-7.2-purple.svg)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.3-cyan.svg)
![Firebase](https://img.shields.io/badge/Firebase-Spark%20Plan-orange.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

MagnaFlow is a multi-tenant project and task management system with a 5-tier role hierarchy, org-scoped Firestore security rules, and a task Gantt chart generated automatically from task dates. It runs entirely on the **Firebase Spark (free) plan** — no Cloud Functions are deployed, so every multi-tenant operation (org provisioning, staff creation, audit logging) is a direct, rules-gated client write.

---

## 🚀 Key Features

* **🏢 Multi-Tenant Organizations** — Firestore security rules enforce that one organization's admin can never read or write another organization's users or tasks. Verified by an automated test suite (`npm run test:rules`), not just by convention.
* **🔐 5-Tier Role-Based Access Control**, each with its own dashboard and route:
  * **Master Admin** (`/master`) — provisions and suspends organizations, sets seat limits, views usage stats and an append-only audit log.
  * **Org Admin** (`/admin`) — full control of their own organization: staff, departments, projects, designations, tasks, reports.
  * **Department Head** (`/department`) — tasks and staff scoped to their department; can create staff and manage tasks within it.
  * **Manager** (`/manager`) — same as Department Head, scoped to a project instead.
  * **Staff** (`/staff`) — personal dashboard: view assigned tasks, update status, complete subtasks, comment.
  * Legacy accounts created before this model existed carry role `admin`, treated everywhere as an alias for `org-admin`.
* **📊 Project Gantt Chart** — every task has a start date and deadline; org-admins, managers and department heads see their project's tasks rendered as a timeline (completed / in-progress / pending / overdue, with a "today" marker) with no separate charting setup.
* **💬 Comments & Mention System** — threaded task discussions with inline `@mentions`, in-app and email notifications.
* **📎 Attachments — built but not enabled.** `attachmentService.js` and `AttachmentUploader.jsx` exist and `storage.rules` is written, but **Firebase Storage has never been set up on the project** and the uploader is not wired into any screen. Enable Storage in the Firebase console and mount the uploader before treating this as a feature.
* **🚨 Critical Alert Pipeline** — a scheduled Cloud Function (`sendDailyCriticalTaskReminders`) emails staff about overdue critical tasks daily at 8 AM IST. This is the one Cloud Function still deployed — see "Firebase Plan" below.
* **🧯 Error Boundary** — a render-time crash shows a recoverable "Something went wrong" screen instead of a blank page.
* **📉 Code-Split Bundle** — dashboards are lazy-loaded per role; the main JS bundle is ~262 kB (gzip ~83 kB), down from ~1.4 MB before splitting, since a signed-in user only downloads their own role's dashboard.

---

## 🔥 Firebase Plan & what that means

This project intentionally runs on **Spark**, Firebase's free tier, which cannot deploy most Cloud Functions (it needs the pay-as-you-go Blaze plan for that). Two consequences worth knowing before you touch the code:

* **`functions/index.js` contains working code that is mostly *not deployed*.** `provisionOrg`, `suspendOrg`, `impersonateUser`, `deleteUserAccount`, `checkSeatLimit`, and `computeUsageStats` all exist in that file but cannot run on this plan. The equivalent operations are implemented as direct client Firestore writes instead (see `src/services/organizationService.js`), gated by `firestore.rules` rather than server code. Only the scheduled reminder email function is actually live.
* **Deliberately absent capabilities**: user impersonation (needs the Admin SDK), automatic seat-limit enforcement, scheduled usage-stat computation, and server-side login rate limiting. The login flow calls a rate-limit check but **fails open** if it can't reach a Cloud Function — a missing function must never be able to lock out every user.
* The client cannot delete a Firebase Auth account, so deleting a user leaves their sign-in behind (their email stays reserved). This is tracked in the `userDeletions` collection and surfaced in **Staff Management** as a "needs manual cleanup" list — filtered so it never suggests deleting an email that's since been reused by an active account.

If you upgrade to Blaze, deploy `functions/` and wire the client back up to the callables in `organizationService.js` — the server-side versions are already written and were working before this constraint was adopted.

---

## 🏗️ Project Structure

```
MagnaFlow/
├── functions/                        # Cloud Functions (mostly undeployed — see above)
│   └── index.js                      # Reminder email (live) + org/user admin ops (not deployed)
├── scripts/
│   ├── backup-firestore.cjs          # Dumps all collections (incl. subcollections) to timestamped JSON
│   └── send-daily-reminders.js
├── tests/
│   └── firestore.rules.test.js       # Rules tests: cross-org isolation, privilege escalation, scoped access
├── src/
│   ├── components/
│   │   ├── admin/                    # Org-admin & master-admin dashboards, staff/task/report management
│   │   ├── shared/                   # DashboardLayout, StatCard, ProjectGanttChart, ErrorBoundary, States
│   │   ├── staff/                    # Task detail modals, change-password panel
│   │   ├── tasks/                    # Attachment uploaders, mention inputs, comments
│   │   └── ui/                       # Radix-UI primitives
│   ├── config/
│   │   ├── firebase.js               # Firebase initialization & exports (db, auth, storage)
│   │   ├── roles.js                  # Canonical role name constants
│   │   └── roleRoutes.js             # role → home route map
│   ├── contexts/                     # AuthContext, TasksContext, DesignationsContext
│   ├── pages/                        # LoginPage, AdminDashboard, StaffDashboard, ScopedDashboard
│   ├── services/                     # Firestore API layer (userService, taskService, organizationService, …)
│   ├── utils/                        # Input sanitization, validation
│   ├── App.jsx                       # Router, lazy-loaded routes per role, ErrorBoundary
│   └── index.css
├── firestore.rules                   # Org-scoped, role-scoped security rules (tested — see tests/)
├── firestore.indexes.json
├── storage.rules
├── firebase.json                     # Real Firebase config (hosting/storage/functions)
├── firebase.test.json                # Minimal Firestore-only config used by the rules tests
├── vite.config.js                    # Manual chunking + prod console-log stripping
└── .env.example
```

---

## 🛠️ Tech Stack

* **Frontend**: React 19, Vite 7, React Router
* **Backend**: Firebase Auth + Firestore + Storage (Spark plan — see above)
* **Charts**: Recharts (reports) + a small hand-rolled CSS/SVG Gantt (no chart library dependency)
* **Styling**: Tailwind CSS + Radix UI primitives, `framer-motion` for animation
* **Testing**: Vitest + `@firebase/rules-unit-testing` against the Firestore emulator
* **Email**: EmailJS (`@emailjs/browser` / `@emailjs/nodejs`)

---

## 🚦 Getting Started

### 1. Prerequisites
* Node.js 18+
* Firebase CLI (`npm install -g firebase-tools`)
* **JDK 21+** — only needed to run the rules tests locally. The Firestore emulator is a Java process and `firebase-tools` v15+ refuses to start on anything older, with a Java-version error that reads like a test failure.

### 2. Installation
```bash
git clone <repository-url>
cd MagnaFlow
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
```
Fill in your Firebase project's config values (`.env` is gitignored). These are build-time Vite variables — a missing one produces `Firebase: Error (auth/invalid-api-key)` at runtime, not a build failure, so double-check them if the deployed app shows a blank screen.

### 4. Running Locally
```bash
npm run dev
```

### 5. Running Tests
```bash
npm run test:rules   # Firestore security-rules tests (needs JDK 11+)
npm run lint
```

---

## 📊 Deployment & Operations

### What CI does automatically
Pushing to `main` triggers `.github/workflows/firebase-hosting-merge.yml`, which builds and deploys **hosting only**. `VITE_FIREBASE_*` values are pulled from GitHub repo **Variables** (not Secrets — they're client-side config, not sensitive) and injected at build time.

`.github/workflows/rules-tests.yml` runs the Firestore rules tests on every push/PR to `main` as a separate check, so a harness problem can't block a hosting deploy, but a genuine rules regression still shows up red on the commit.

### What you must deploy manually
Firestore rules and indexes are **not** part of the CI workflow:
```bash
firebase deploy --only firestore:rules,firestore:indexes --project <your-project-id>
```
Do this after any change to `firestore.rules` or `firestore.indexes.json` — CI will not do it for you, and a stale rules deploy is a silent, easy-to-miss gap between what's tested and what's live.

### Backups
Firestore's managed scheduled exports need the Blaze plan and a Cloud Storage bucket, so this project uses a local alternative:
```bash
node scripts/backup-firestore.cjs [--out ./backups] [--key ./service-account.json]
```
Dumps every collection (including nested subcollections like `organizations/{id}/departments`) to a timestamped JSON file. `backups/` is gitignored — the dumps contain user data in plain text, so keep them somewhere private. Restore is intentionally not automated; treat overwriting production from a snapshot as a manual, considered act.

---

## 📄 License
This project is licensed under the MIT License.
