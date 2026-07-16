# MAGNAFLOW BUILD SPEC — execute top to bottom. No section skipped. Check items off as completed.

## 0. BUG FIXES (blocking — do before anything else)

**0.1 `src/config/firebase.js`** — add:
```js
import { getStorage } from 'firebase/storage';
export const storage = getStorage(app);
```

**0.2 `src/pages/StaffDashboard.jsx` L246-247** — replace:
```js
(task.description || '').toLowerCase().includes(searchQuery.toLowerCase())
```
Grep repo for `.description.toLowerCase()` — apply same guard everywhere it appears (confirmed also at `TasksContext.jsx` L284-285; check `AdminDashboard.jsx`).

**0.3 `src/services/taskService.js` L186-187** — wrap:
```js
if (updatedTask.assignedTo) {
  const userDoc = await getDoc(doc(db, 'users', updatedTask.assignedTo));
  const userData = userDoc.exists() ? userDoc.data() : null;
  // proceed only if userData
}
```

**0.4 `src/utils/rateLimiter.js`** — replace in-memory `Map` with Firestore-backed or Cloud Function-gated limiter.
- Collection: `login_attempts/{emailHash}` → `{count, blockedUntil, windowStart}`
- Check/increment via `httpsCallable` Cloud Function `checkLoginRateLimit(email)` before `signInWithEmailAndPassword`.
- Do not trust client-side counters for security decisions.

**0.5 `src/services/userService.js` `deleteUser`** — add Cloud Function:
```js
// functions/index.js
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  if (context.auth?.token?.role !== 'master-admin' && context.auth?.token?.role !== 'org-admin')
    throw new functions.https.HttpsError('permission-denied', 'not authorized');
  await admin.auth().deleteUser(data.uid);
  await admin.firestore().doc(`users/${data.uid}`).delete();
});
```
Call from client: `httpsCallable(functions, 'deleteUserAccount')({ uid })`.

**0.6 `src/services/notificationService.js` L208-210** — delete raw `fetch` EmailJS call; route through existing `EMAIL_CONFIG` / `emailService.js` send function only.

**0.7 `src/services/emailService.js` L130` + `notificationService.js`** — replace hardcoded:
```js
cc_email: 'pankaj@magnetar.in, dhaval@magnetar.in, tejas@magnetar.in'
```
with:
```js
cc_email: import.meta.env.VITE_CC_EMAILS // comma-separated, set per deploy
```
Add `VITE_CC_EMAILS=...` to `.env` (not committed) and Vercel env vars. Rotate the EmailJS `user_id`/`service_id`/`template_id` since they're currently in git history.

**0.8 `src/services/userService.js` L113-125** — delete duplicate/contradictory JSDoc block, keep one.

**0.9 `src/services/taskService.js`** — `getTaskStatistics()` — add `cancelled` bucket to output object; ensure `firestore.rules` status enum and app logic match exactly: `['pending', 'in-progress', 'completed', 'cancelled']`.

**0.10 `src/services/taskService.js` L81** — replace unreliable constraint introspection:
```js
// BEFORE (broken): constraints.some(c => c.type === 'orderBy')
// AFTER: track explicitly
let hasOrderBy = false;
const constraints = [];
if (sortField) { constraints.push(orderBy(sortField)); hasOrderBy = true; }
// ...
if (constraints.length > 0 && !hasOrderBy) { /* in-memory sort */ }
```

**0.11 `src/contexts/TasksContext.jsx`** — wrap `loadTasks` in `useCallback`, add to both `useEffect` dep arrays:
```js
const loadTasks = useCallback(async () => { /* ... */ }, [/* real deps */]);
useEffect(() => { if (isAuthenticated && user) loadTasks(); }, [isAuthenticated, user, loadTasks]);
useEffect(() => {
  const handler = () => loadTasks();
  window.addEventListener('taskStatusUpdated', handler);
  return () => window.removeEventListener('taskStatusUpdated', handler);
}, [loadTasks]);
```

**0.12 `src/contexts/AuthContext.jsx` + `LoginPage.jsx`** — don't fire success toast off `login()`'s return value; gate on `isAuthenticated` state changing (subscribe via `useEffect` on `isAuthenticated`), since `onAuthStateChanged` resolves after `login()`.

**0.13 `src/services/subtaskService.js` L110** — break circular import: move shared status-recompute logic into new `src/services/taskStatusUtils.js`; both `taskService.js` and `subtaskService.js` import from it, no dynamic `import()`.

**0.14 `src/utils/validation.js` L119** — fix copy only (logic is already correct: today passes). Change error string to `'Date cannot be in the past'`, only trigger when `inputDate < today`.

**0.15 `src/utils/validation.js` L145** — replace regex:
```js
if (!/^[\p{L}\s'.-]+$/u.test(name))
```

**0.16 `src/services/emailService.js` L329-330** — guard init:
```js
function initializeEmailJS() {
  if (!EMAIL_CONFIG.PUBLIC_KEY) { console.warn('EmailJS not configured — env var missing'); return; }
  emailjs.init(EMAIL_CONFIG.PUBLIC_KEY);
}
```

**0.17 `src/contexts/AuthContext.jsx` `logout` + call sites in `StaffDashboard.jsx`/`AdminDashboard.jsx`** — wrap every `await logout()` call site in try/catch; keep `logout()` itself throwing.

**0.18 `src/services/notificationService.js` `getNotifications`** — add `.limit(limit)` to the Firestore query builder, remove in-memory `.slice()`.

**0.19 `src/services/commentService.js` L181** — replace full-collection `getDocs(usersRef)` mention lookup with dedicated `usernames/{lowercaseUsername} → {uid}` lookup collection, maintained on user create/rename.

**DONE CONDITION for Section 0:** zero console errors on: empty-description task search, critical task with no assignee, page refresh mid-login-attempts, user deletion, comment with @mention. `npm run build` shows no circular-dependency warning.

---

## 1. SCHEMA (final state)

```
organizations/{orgId}
  name: string, plan: 'trial'|'starter'|'pro'|'enterprise'
  status: 'active'|'suspended'|'trial_expired'
  seatLimit: number, storageQuotaMB: number
  trialEndsAt: timestamp, billingEmail: string
  createdAt: timestamp, createdByMasterAdminId: string
  ccEmails: string[]   // replaces hardcoded list, per-org now

organizations/{orgId}/departments/{deptId}
  name: string, headUserId: string, createdAt: timestamp

organizations/{orgId}/projects/{projectId}
  name: string, departmentId: string, memberUserIds: string[]
  status: 'active'|'archived', createdAt: timestamp

organizations/{orgId}/tasks/{taskId}
  ...existing fields..., departmentId: string, projectId: string

users/{uid}
  orgId: string, role: 'master-admin'|'org-admin'|'department-head'|'manager'|'staff'
  departmentIds: string[], projectIds: string[]
  status: 'active'|'inactive'

org_usage_stats/{orgId}   // written by scheduled Cloud Function, read by master dashboard only
  activeUserCount, taskCount, storageUsedMB, lastActivityAt

audit_logs/{logId}
  actorId, action, targetOrgId, targetUserId, timestamp, metadata

login_attempts/{emailHash}
  count, blockedUntil, windowStart

usernames/{lowercaseUsername}
  uid
```

---

## 2. SECURITY RULES (`firestore.rules` — replace entire file)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function me() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
    function isMasterAdmin() { return isSignedIn() && me().role == 'master-admin'; }
    function isOrgMember(orgId) { return isSignedIn() && me().orgId == orgId; }
    function isOrgAdmin(orgId) { return isOrgMember(orgId) && me().role == 'org-admin'; }
    function isDeptMember(orgId, deptId) { return isOrgMember(orgId) && deptId in me().departmentIds; }
    function isProjectMember(orgId, projId) { return isOrgMember(orgId) && projId in me().projectIds; }

    match /organizations/{orgId} {
      allow read: if isOrgMember(orgId) || isMasterAdmin();
      allow write: if isMasterAdmin();

      match /departments/{deptId} {
        allow read: if isDeptMember(orgId, deptId) || isOrgAdmin(orgId) || isMasterAdmin();
        allow write: if isOrgAdmin(orgId) || isMasterAdmin();
      }
      match /projects/{projId} {
        allow read: if isProjectMember(orgId, projId) || isOrgAdmin(orgId) || isMasterAdmin();
        allow write: if isOrgAdmin(orgId) || isMasterAdmin();
      }
      match /tasks/{taskId} {
        allow read: if isOrgAdmin(orgId) || isMasterAdmin()
                     || isProjectMember(orgId, resource.data.projectId)
                     || isDeptMember(orgId, resource.data.departmentId);
        allow create: if isOrgAdmin(orgId) || isMasterAdmin() || isProjectMember(orgId, request.resource.data.projectId);
        allow update, delete: if isOrgAdmin(orgId) || isMasterAdmin()
                     || isProjectMember(orgId, resource.data.projectId);
      }
    }

    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isMasterAdmin() || isOrgAdmin(resource.data.orgId));
      allow write: if isMasterAdmin() || isOrgAdmin(resource.data.orgId) || request.auth.uid == uid;
    }

    match /org_usage_stats/{orgId} { allow read, write: if isMasterAdmin(); }
    match /audit_logs/{logId} { allow read, write: if isMasterAdmin(); }
    match /login_attempts/{doc} { allow read, write: if false; } // Cloud Functions (Admin SDK) only
    match /usernames/{doc} { allow read: if isSignedIn(); allow write: if false; } // maintained server-side
  }
}
```

**Required test:** `@firebase/rules-unit-testing` suite covering: user in org A cannot read org B's tasks; department member cannot read another department's tasks without project membership; non-member cannot read project tasks; org-admin can read all org's own data; master-admin can read everything.

---

## 3. RBAC + ROUTING

```js
// src/config/roleRoutes.js
export const ROLE_HOME_ROUTE = {
  'master-admin': '/master',
  'org-admin': '/admin',
  'department-head': '/department',
  'manager': '/staff',
  'staff': '/staff',
};

// src/App.jsx — replace if/else chain
if (allowedRoles && !allowedRoles.includes(user.role)) {
  return <Navigate to={ROLE_HOME_ROUTE[user.role] ?? '/staff'} replace />;
}
```

| Action | master-admin | org-admin | department-head | manager | staff |
|---|:---:|:---:|:---:|:---:|:---:|
| Create/suspend org | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create department | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create project | ❌ | ✅ | ✅ (own dept) | ❌ | ❌ |
| Assign task | ❌ | ✅ | ✅ | ✅ (own project) | ❌ |
| View task | via impersonation | all in org | own dept | own project | own project |
| Impersonate user | ✅ (audit-logged) | ❌ | ❌ | ❌ | ❌ |

---

## 4. MASTER ADMIN DASHBOARD

**Routes:** `/master`, `/master/orgs/:orgId`, `/master/orgs/new`, `/master/audit-logs`

**Cloud Functions required:**
```js
// functions/index.js
exports.provisionOrg = functions.https.onCall(async (data, ctx) => {
  requireRole(ctx, 'master-admin');
  const orgRef = await admin.firestore().collection('organizations').add({
    name: data.name, plan: data.plan ?? 'trial', status: 'trial',
    seatLimit: data.seatLimit ?? 10, storageQuotaMB: data.storageQuotaMB ?? 1000,
    createdAt: admin.firestore.FieldValue.serverTimestamp(), createdByMasterAdminId: ctx.auth.uid,
  });
  return { orgId: orgRef.id };
});

exports.suspendOrg = functions.https.onCall(async (data, ctx) => {
  requireRole(ctx, 'master-admin');
  await admin.firestore().doc(`organizations/${data.orgId}`).update({ status: 'suspended' });
  await logAudit(ctx.auth.uid, 'suspend_org', data.orgId);
});

exports.impersonateUser = functions.https.onCall(async (data, ctx) => {
  requireRole(ctx, 'master-admin');
  const token = await admin.auth().createCustomToken(data.targetUid, { impersonatedBy: ctx.auth.uid });
  await logAudit(ctx.auth.uid, 'impersonate', null, data.targetUid);
  return { token };
});

exports.checkSeatLimit = functions.firestore.document('users/{uid}').onCreate(async (snap) => {
  const { orgId } = snap.data();
  const org = (await admin.firestore().doc(`organizations/${orgId}`).get()).data();
  const count = (await admin.firestore().collection('users').where('orgId','==',orgId).get()).size;
  if (count > org.seatLimit) { await snap.ref.update({ status: 'inactive', suspendReason: 'seat_limit' }); }
});

exports.computeUsageStats = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const orgs = await admin.firestore().collection('organizations').get();
  for (const org of orgs.docs) {
    const tasks = await admin.firestore().collection(`organizations/${org.id}/tasks`).get();
    const users = await admin.firestore().collection('users').where('orgId','==',org.id).get();
    await admin.firestore().doc(`org_usage_stats/${org.id}`).set({
      activeUserCount: users.size, taskCount: tasks.size,
      lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});

function requireRole(ctx, role) {
  if (ctx.auth?.token?.role !== role) throw new functions.https.HttpsError('permission-denied', 'no');
}
async function logAudit(actorId, action, targetOrgId=null, targetUserId=null) {
  await admin.firestore().collection('audit_logs').add({
    actorId, action, targetOrgId, targetUserId, timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}
```

**UI components to build:** `OrgListTable`, `OrgDetailPanel` (usage + plan + suspend toggle), `ProvisionOrgModal`, `AuditLogTable`, `ImpersonateButton` (calls `impersonateUser`, `signInWithCustomToken`, redirects to org's dashboard, shows persistent "Impersonating X — Exit" banner).

---

## 5. MIGRATION SCRIPT (one-off, run once against prod data)

```js
// scripts/migrate-to-multitenant.js — run with Admin SDK, NOT client SDK
async function migrate() {
  const db = admin.firestore();
  const orgRef = await db.collection('organizations').add({
    name: 'Magnetar', plan: 'enterprise', status: 'active',
    seatLimit: 999, storageQuotaMB: 50000, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const deptRef = await db.collection(`organizations/${orgRef.id}/departments`).add({ name: 'General' });
  const projRef = await db.collection(`organizations/${orgRef.id}/projects`).add({
    name: 'General', departmentId: deptRef.id, memberUserIds: [], status: 'active',
  });

  const users = await db.collection('users').get();
  const batch1 = db.batch();
  users.forEach(u => batch1.update(u.ref, {
    orgId: orgRef.id, departmentIds: [deptRef.id], projectIds: [projRef.id],
  }));
  await batch1.commit();

  const tasks = await db.collection('tasks').get(); // old flat location — adjust if already subcollection
  for (const t of tasks.docs) {
    await db.doc(`organizations/${orgRef.id}/tasks/${t.id}`).set({
      ...t.data(), departmentId: deptRef.id, projectId: projRef.id,
    });
  }
  console.log('Migration complete. Verify counts before deleting old flat collections.');
}
```
Run against emulator first. Verify `users.count === backfilled.count` and `tasks.count` matches before deploying new rules or deleting old flat collections.

---

## 6. FEATURE ADDITIONS (priority order, build only what customers ask for beyond #1-#2)

1. Audit log UI for org-admins (own org only, filtered `audit_logs` query)
2. Org-level `ccEmails` settings screen (replaces 0.7 hardcode)
3. CSV export of tasks/users (org-admin scoped)
4. Onboarding wizard: create dept → invite users → create project (3-step, gates on empty-state)
5. Soft delete: add `deletedAt: timestamp|null` to tasks/projects, filter `where('deletedAt','==',null)` everywhere, add 30-day hard-delete Cloud Function
6. White-label: `organizations/{orgId}.branding = { logoUrl, primaryColor }`, apply via CSS var injection at app root
7. Seat/usage banner: read `org_usage_stats`, show in org-admin nav

---

## 7. INFRA CHECKLIST

- [ ] Code-split routes: `React.lazy(() => import('./pages/MasterDashboard'))`, same for AdminDashboard/StaffDashboard — target <300KB gzip per route chunk
- [ ] GitHub Actions: `on: push main` → `firebase deploy --only firestore:rules,functions` (separate job from Vercel frontend deploy, require review on rules diff)
- [ ] Sentry: `Sentry.init()` in `main.jsx`, wrap `App` in `Sentry.ErrorBoundary`
- [ ] `@firebase/rules-unit-testing` suite in `tests/rules.test.js` — CI-blocking, must pass before merge
- [ ] Rotate all EmailJS/API keys currently in git history; add `.env.example`, confirm `.env` in `.gitignore`
- [ ] Scheduled Cloud Function health check → Slack/email webhook on write-failure spike

---

## DEFINITION OF DONE

- [ ] All Section 0 items checked, build clean, no console errors on listed repro paths
- [ ] Rules test suite green (cross-tenant isolation proven, not assumed)
- [ ] Migration script run against emulator with matching before/after counts
- [ ] Master dashboard can: provision org → invite org-admin → org-admin creates dept/project → staff in that dept sees only that dept's tasks (manually verified end-to-end with 2 test orgs)
- [ ] Impersonation logs to `audit_logs` on every use
- [ ] Bundle per-route <300KB gzip
