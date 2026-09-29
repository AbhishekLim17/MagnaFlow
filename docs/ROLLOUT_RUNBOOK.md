# Rollout runbook: fix/audit-hardening

Everything on the `fix/audit-hardening` branch is tested against the emulators
(lint, unit, 168 rules tests, integration tests for the mail jobs and both
migrations). None of it is live until these steps are run, **in this order**.

You need three things on the machine that runs them:

- a Firebase **service-account key** for `magnaflow-07sep25` (Console -> Project settings
  -> Service accounts -> Generate new private key). Keep the file outside the repo, or
  under a name matching `*firebase-adminsdk*.json` (gitignored). It bypasses security
  rules, so treat it like a password and delete it afterwards.
- the Firebase CLI logged in (`npx firebase login:list`), which it already is here.
- JDK 21 only if you want to re-run the rules tests first.

In the commands below `KEY` is the path to that file.

## 0. Before anything

```bash
git checkout fix/audit-hardening
npm ci && npm run lint && npm test && npm run test:rules && npm run test:integration
```

Then take a backup. It writes every collection to `backups/` (gitignored):

```bash
node scripts/backup-firestore.cjs --key KEY
```

## 1. Give existing designations an organization (BEFORE the rules)

Designations became per-organization. Any without an `orgId` turn invisible once the new
rules are live. This works with the old rules too.

```bash
node scripts/admin/backfill-designation-org.cjs --key KEY            # dry run, read it
node scripts/admin/backfill-designation-org.cjs --key KEY --apply
```

It refuses to run unless the project has exactly one organization.

## 2. Deploy rules and indexes, then merge straight away

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project magnaflow-07sep25
```

Then merge the branch to `main` at once. CI runs lint, unit, rules and integration tests,
builds, and deploys hosting (a few minutes).

*During that window* a browser still running the old bundle will get errors when it queues
an email or adds/removes a user. A page refresh fixes it. Indexes may take a few minutes to
build; until then list queries fall back to unordered reads.

Rollback for this step: `git revert` the merge and redeploy the previous rules
(`git show <old-commit>:firestore.rules > firestore.rules`, then the same deploy command).

## 3. Move the private fields (right after hosting is live)

```bash
node scripts/admin/migrate-private-fields.cjs --key KEY              # dry run
node scripts/admin/migrate-private-fields.cjs --key KEY --apply
```

This only **creates** `private/settings`, `meta/seats` and `finance/budget` documents; it
never overwrites and can be repeated. The app falls back to the old fields until step 6, so
nothing breaks if you pause here. **Seat limits start being enforced as soon as an
organization has a `meta/seats` document.**

## 4. Set the CC list

Master Admin -> the organization -> edit -> *CC on notification emails*. Reminders and
notification emails no longer use the old hardcoded list, so the three Magnetar admin
addresses must be entered here or nobody is copied.

## 5. Smoke test (about ten minutes)

Log in as each role and check:

| As | Check |
|---|---|
| master-admin | Organizations list shows billing email and seat limit; open an org and save (no error). |
| org-admin | Task Management loads; Budget page loads and shows budgets; add a staff member (seat count goes up). |
| manager / department head | Create a task in their project; delete it. |
| staff | My Tasks loads; open a task, add a subtask and a comment; Budget URL is not reachable. |
| client | Client portal shows only the linked project. |
| any | Queue an email (assign a task); within 15 minutes the *Send queued emails* workflow delivers it. Run the workflow by hand with *dry run* to preview. |

Also open the Firebase console -> Firestore -> Rules -> *Monitor* and confirm there are no
bursts of denied reads after the deploy.

## 6. Clean up the legacy fields (a day or two later)

Only after step 5 is clean. This deletes `billingEmail`, `ccEmails`, `seatLimit`,
`storageQuotaMB` from organization documents and `budget`, `currency`, `budgetNotes` from
project documents, and only where the replacement document exists.

```bash
node scripts/admin/migrate-private-fields.cjs --key KEY --remove-old
```

This step is what actually stops staff and clients reading budgets from the project document.
It is not reversible except from the step 0 backup.

## 7. Things only you can do

- **Rotate the EmailJS private key and the cron token.** They are in the repository's git
  history from before they were removed. Removing them from `.env` files does not make them
  safe.
- Delete the service-account key file from this machine.
- Optional: enable App Check (`docs/APP_CHECK_SETUP.md`).
- Optional: remove the unused `VITE_EMAILJS_*` variables from the GitHub Actions workflow files.

## Known limits after rollout

- The rules cap a request at 1000 expression evaluations and do not memoize functions. Keep
  helper functions cheap (see the comment at the top of `firestore.rules`) and check
  `firestore-debug.log` for "maximum of 1000 expressions" after changing rules.
- Seat counting is enforced in the app and rules, but a user created directly in the Firebase
  console (or moved between organizations by master-admin) is not counted until master-admin
  opens the Organizations page, which reconciles the counter.
- Firebase Auth accounts of deleted users still cannot be removed from the browser; they are
  tracked in `userDeletions`.
