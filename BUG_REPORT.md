# 🐛 MagnaFlow — Deep Code Inspection Bug Report

**Date:** July 16, 2026  
**Method:** Manual line-by-line code review of all source files  
**Scope:** `src/` (contexts, services, pages, components, utils, config)  
**Total Issues Found:** 22

---

## 🔴 CRITICAL BUGS

---

### BUG-01 · Crash When Task Has No Description During Search
**Severity:** 🔴 CRITICAL — Runtime crash  
**File:** [`StaffDashboard.jsx`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/pages/StaffDashboard.jsx#L246-L247)

```js
// Line 246-247 — task.description can be null/undefined
const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                     task.description.toLowerCase().includes(searchQuery.toLowerCase()); // 💥 CRASH
```

**Root cause:** `task.description` is optional. `createTask()` stores `description: description || ''` but existing tasks in Firestore may have `null` or missing `description` fields.

**Fix:**
```js
(task.description || '').toLowerCase().includes(searchQuery.toLowerCase())
```

---

### BUG-02 · `updateTask` Crash When Task Has No `assignedTo` for Critical Email
**Severity:** 🔴 CRITICAL — Runtime error logged silently  
**File:** [`taskService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/taskService.js#L186-L187)

```js
const userDoc = await getDoc(doc(db, 'users', updatedTask.assignedTo)); // 💥 crashes if assignedTo is null
const userData = userDoc.data(); // userData is undefined if doc doesn't exist
```

**Root cause:** `assignedTo` is optional (`null` by default). If a critical task has no assigned user, `doc(db, 'users', null)` will throw a Firestore error.

**Fix:** Guard with `if (updatedTask.assignedTo)` before the `getDoc` call.

---

### BUG-03 · `TasksContext` `loadTasks` Has Missing Dependency in useEffect
**Severity:** 🔴 CRITICAL — Stale closure causes data not to refresh after role changes  
**File:** [`TasksContext.jsx`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/contexts/TasksContext.jsx#L36-L58)

```js
useEffect(() => {
  if (isAuthenticated && user) loadTasks(); // 'loadTasks' is not in deps!
}, [isAuthenticated, user]);

useEffect(() => {
  window.addEventListener('taskStatusUpdated', handleTaskStatusUpdate);
  return () => window.removeEventListener('taskStatusUpdated', handleTaskStatusUpdate);
}, [isAuthenticated, user]); // 'loadTasks' referenced inside handler not in deps
```

Both effects reference `loadTasks` but do not include it in the dependency array, causing stale closures and potential bugs if the function reference changes.

---

### BUG-04 · `attachmentService.js` Imports `storage` From Firebase But It Is Not Exported
**Severity:** 🔴 CRITICAL — Module fails to load  
**File:** [`attachmentService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/attachmentService.js#L18)

```js
import { storage, db } from '../config/firebase'; // 💥 'storage' is never exported in firebase.js
```

**Root cause:** `firebase.js` exports `auth`, `db`, `secondaryAuth`, and the default app — **not `storage`**. Firebase Storage requires `getStorage()` to be explicitly initialized and exported.

**Fix:** Add to `firebase.js`:
```js
import { getStorage } from 'firebase/storage';
export const storage = getStorage(app);
```

---

## 🟠 HIGH BUGS

---

### BUG-05 · Rate Limiter Is Purely In-Memory — Resets On Every Page Refresh
**Severity:** 🟠 HIGH — Security regression  
**File:** [`rateLimiter.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/utils/rateLimiter.js#L4-L125)

The `RateLimiter` class uses JavaScript `Map` objects (`this.attempts`, `this.blockedIPs`). These are **browser-memory only** — a page refresh or opening a new browser tab completely resets the rate limit counter. An attacker can bypass the 5-attempt block simply by refreshing the page.

**Fix:** Persist attempt data to `localStorage` keyed by email, or move rate limiting server-side (Firebase Functions).

---

### BUG-06 · `firestore.rules` — `isValidTaskData()` Allows Outdated/Invalid Status Values
**Severity:** 🟠 HIGH — Data integrity issue  
**File:** [`firestore.rules`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/firestore.rules#L43-L44)

```
request.resource.data.status in ['pending', 'in-progress', 'completed', 'cancelled']
```

The `taskService.js` `getTaskStatistics()` only counts `pending`, `in-progress`, and `completed` — `cancelled` is accounted for in rules but **not in the app logic**. Tasks with `cancelled` status show up in "Total" counts but not in the breakdown stats.

---

### BUG-07 · Hardcoded Admin Email CC List in Email Service
**Severity:** 🟠 HIGH — Privacy / operational risk  
**File:** [`emailService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/emailService.js#L130)

```js
cc_email: 'pankaj@magnetar.in, dhaval@magnetar.in, tejas@magnetar.in',
```

This CC list is hardcoded in three separate places and also appears in `notificationService.js`. These are real internal email addresses committed to source code. Additionally, they cannot be configured without a code change and redeploy.

**Fix:** Move to environment variables (`VITE_CC_EMAILS`).

---

### BUG-08 · `notificationService.js` `sendEmailNotification` Has Hardcoded Credentials
**Severity:** 🟠 HIGH — Security exposure  
**File:** [`notificationService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/notificationService.js#L208-L210)

```js
service_id: 'service_itwo1ee',
template_id: 'template_mention',
user_id: 'hQcLVOWsSrnSqnRWY',
```

This function uses a **raw `fetch` to the EmailJS API** with hardcoded service/template/user IDs, bypassing `EMAIL_CONFIG` entirely. It uses a different, possibly stale EmailJS config than the rest of the app.

---

### BUG-09 · Double Function Declaration in `userService.js`
**Severity:** 🟠 HIGH — Code clarity / maintenance risk  
**File:** [`userService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/userService.js#L113-L125)

There are **two JSDoc comment blocks** for `createUser` back-to-back (lines 113-118 and 119-125). The first is a leftover from the original version and the two docs are contradictory. While not a runtime crash, this causes code confusion.

---

### BUG-10 · `deleteUser` Does NOT Delete Firebase Auth Account
**Severity:** 🟠 HIGH — Data inconsistency / security risk  
**File:** [`userService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/userService.js#L213-L233)

`deleteUser` only deletes the Firestore document and creates a manual reminder note. The Firebase Auth user **still exists** and can log in even after being "deleted". If that user's Firestore document is gone, `getUserById()` returns `null`, causing `AuthContext` to set `isAuthenticated = false` — but the Auth session may re-authenticate.

**Fix:** Use Firebase Admin SDK (via Cloud Functions) to delete the Auth user on the backend.

---

### BUG-11 · `getFilteredTasks` in `TasksContext` — `description` Null Crash (Same As BUG-01)
**Severity:** 🟠 HIGH — Runtime crash  
**File:** [`TasksContext.jsx`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/contexts/TasksContext.jsx#L284-L285)

```js
t.description.toLowerCase().includes(searchLower) // 💥 crashes if description is null
```

Same null-safety issue as BUG-01, in a different code path (the context-level filter vs. the dashboard-level filter).

---

## 🟡 MEDIUM BUGS

---

### BUG-12 · `AuthContext` Redirect for Non-Admin Roles Is Incomplete
**Severity:** 🟡 MEDIUM — UX / access control gap  
**File:** [`App.jsx`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/App.jsx#L24-L27)

```js
if (allowedRoles && !allowedRoles.includes(user.role)) {
  return <Navigate to={user.role === "admin" ? "/admin" : "/staff"} replace />;
}
```

The app has 6 roles (admin, staff, manager, principal, alpha, master-admin) but the routing logic only handles `admin` and `staff`. A `manager` or `principal` trying to access `/staff` would be redirected to `/staff` (since they're not `admin`), causing an infinite authorization loop or an empty state.

---

### BUG-13 · `reminderService.js` Time Zone Bug
**Severity:** 🟡 MEDIUM — Daily reminders fail for some users  
**File:** [`reminderService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/reminderService.js#L79-L83)

```js
const isAfter8AM = () => {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 8;
};
```

`new Date().getHours()` returns the **browser's local time**, not a fixed server timezone. The "once per day" check key (`YYYY-MM-DD`) is also based on local time. If an admin in a different timezone logs in, the date key could be different from the Firestore key, causing reminders to be re-sent or never sent.

---

### BUG-14 · `getNotifications` in `notificationService.js` Fetches All Then Slices in Memory
**Severity:** 🟡 MEDIUM — Performance / scalability  
**File:** [`notificationService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/notificationService.js#L179-L195)

```js
const snapshot = await getDocs(q); // fetches ALL notifications
const notifications = snapshot.docs.slice(0, limit).map(...); // slices in JS
```

Firestore's `limit()` operator should be used in the query, not in JavaScript. As notifications grow, this will download the entire collection on every call.

**Fix:** Add `.limit(limit)` to the Firestore query.

---

### BUG-15 · `getUserIdsByUsernames` in `commentService.js` Fetches ALL Users
**Severity:** 🟡 MEDIUM — Performance / scalability  
**File:** [`commentService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/commentService.js#L181)

```js
const snapshot = await getDocs(usersRef); // 💥 downloads EVERY user document
```

For `@mention` resolution, the service downloads all Firestore user documents on every comment submission. This scales poorly as users grow.

---

### BUG-16 · `getAllTasks` / `getAllUsers` Sorting Guard Is Incorrect
**Severity:** 🟡 MEDIUM — Sorting fails silently with filters  
**File:** [`taskService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/taskService.js#L81)

```js
if (constraints.length > 0 && !constraints.some(c => c.type === 'orderBy')) {
```

Firestore constraint objects from the `where()` / `orderBy()` functions **do not have a `.type` property** accessible via standard JS — this guard will always evaluate to `true`, meaning the in-memory sort always runs even when `orderBy` was added to the query. The `orderBy` constraint added at line 69 is also incorrectly bypassed.

---

### BUG-17 · `Login` Returns `success: true` But State Update Is Async
**Severity:** 🟡 MEDIUM — UX race condition  
**File:** [`AuthContext.jsx`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/contexts/AuthContext.jsx#L88-L110) + [`LoginPage.jsx`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/pages/LoginPage.jsx#L37-L41)

The `login()` function returns `{ success: true, user: userData }`. The `LoginPage` immediately shows a welcome toast using `result.user.role`. However, the actual state update (`setUser`, `setIsAuthenticated`) happens in the `onAuthStateChanged` listener **asynchronously after** `login()` resolves. Rapid navigation or state-dependent components can encounter a brief moment where `isAuthenticated` is still `false` despite the login being "successful."

---

### BUG-18 · `subtaskService.js` Circular Dependency via Dynamic Import
**Severity:** 🟡 MEDIUM — Hard to trace potential module initialization issue  
**File:** [`subtaskService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/subtaskService.js#L110)

```js
const { updateTask } = await import('./taskService');
```

`taskService.js` statically imports `deleteAllSubtasksForTask` from `subtaskService.js`, and `subtaskService.js` dynamically imports `updateTask` from `taskService.js`. This circular dependency (noted by Vite as a warning during build) can cause import order issues or subtle initialization bugs.

---

## 🔵 LOW / QUALITY ISSUES

---

### BUG-19 · `validateFutureDate` Rejects Today's Date as Invalid
**Severity:** 🔵 LOW — UX friction  
**File:** [`validation.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/utils/validation.js#L119)

```js
if (inputDate < today) {
  return { valid: false, error: 'Date must be in the future' };
}
```

`today` is set at midnight (`00:00:00`), but the comparison logic means selecting **today's date** is valid (since `today` == `today` is not `< today`). However semantically, tasks due "today" should be fine, but the error message says "future" which is misleading.

---

### BUG-20 · `validateName` Regex Rejects Valid Names (Periods, Numbers)
**Severity:** 🔵 LOW — User experience  
**File:** [`validation.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/utils/validation.js#L145)

```js
if (!/^[a-zA-Z\s'-]+$/.test(name)) {
```

This regex rejects names like `"Dr. Smith"` (period) or `"O'Brien Jr."`. It also rejects names with diacritics (`é`, `ñ`, `ü`) common in non-English locales — e.g., the name `"José"` would fail validation.

---

### BUG-21 · `isEmailConfigured()` Does Not Initialize EmailJS Before First Send
**Severity:** 🔵 LOW — First email might silently fail  
**File:** [`emailService.js`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/services/emailService.js#L329-L330)

```js
// Initialize EmailJS on module load
initializeEmailJS();
```

`emailjs.init()` is called at module import time. But `EMAIL_CONFIG.PUBLIC_KEY` comes from `import.meta.env`, which may not yet be populated in SSR/build contexts. If configuration values are missing, `init()` silently fails and all subsequent sends also fail with no clear error.

---

### BUG-22 · `logout()` in `AuthContext` Silently Rethrows but Calling Components Don't Handle It
**Severity:** 🔵 LOW — Unhandled promise rejections  
**File:** [`AuthContext.jsx`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/contexts/AuthContext.jsx#L138-L143) + [`StaffDashboard.jsx`](file:///a:/Alpha/WORK/Magnetar/MagnaFlow/src/pages/StaffDashboard.jsx#L194-L200)

```js
const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error; // rethrows
  }
};
```

The `StaffDashboard.handleLogout()` calls `await logout()` without a try/catch. If Firebase signout fails, an unhandled promise rejection crashes the component silently. `AdminDashboard.handleLogout()` has the same issue.

---

## 📊 Summary

| Severity | Count |
| :--- | :---: |
| 🔴 Critical | 4 |
| 🟠 High | 7 |
| 🟡 Medium | 7 |
| 🔵 Low | 4 |
| **Total** | **22** |

### Priority Fix Order
1. **BUG-04** — `storage` not exported → breaks file uploads for all users
2. **BUG-01 + BUG-11** — null crash on description search → crashes for users without task descriptions
3. **BUG-02** — null crash in critical alert email → silent error on Firestore write
4. **BUG-05** — Rate limiter bypassed on refresh → security hole
5. **BUG-10** — Deleted users can still log in → security hole
6. **BUG-08** — Hardcoded EmailJS credentials → credential rotation impossible without code change
7. **BUG-12** — Manager/Principal routing → locked out users
