# Historical Mistakes Log - MagnaFlow

This file tracks mistakes made during MagnaFlow development to prevent repetition and improve future solutions.

> **Note:** This is project-specific. Universal mistakes are tracked in `a:\Alpha\WORK\.github-global\mistakes.md`

---

_Add new entries below this line. Never delete old entries._

---

## [Feb 1, 2026] - Sentry Error Monitoring Implementation

**Problem:**
- Production errors happening but no visibility
- Had to rely on users reporting issues
- No way to track error frequency or patterns
- Missing user context when debugging
- Performance bottlenecks not identified

**Root Cause:**
No error monitoring system in place. Treating MagnaFlow as a development project rather than a production system requiring observability.

**Solution:**
Implemented Sentry error monitoring with comprehensive features:
1. Installed `@sentry/react` package
2. Created `src/config/sentry.js` with initialization logic
3. Integrated ErrorBoundary in App.jsx with custom UI
4. Added user context tracking (email, role, user ID)
5. Implemented performance monitoring for Firebase queries
6. Configured session replay (10% sample, 100% on errors)
7. Added breadcrumb tracking for user actions
8. Set up environment variables for DSN configuration

**Lesson:**
1. **Implement monitoring from day 1** - errors are inevitable, visibility is essential
2. **Production-only tracking** - avoid noise in development
3. **User context is critical** - knowing who hit an error speeds up debugging
4. **Performance monitoring included** - identify slow queries early
5. **Session replay invaluable** - see exactly what user did before error
6. **Free tier sufficient** for small/medium apps (5K errors/month)
7. **DSN is not secret** - safe to include in client code

**Related Files:**
- `src/config/sentry.js` (configuration and utilities)
- `src/main.jsx` (initialization)
- `src/App.jsx` (ErrorBoundary integration)
- `.env.production` (DSN configuration)
- `SENTRY_SETUP.md` (complete setup guide)

---

## [Jan 4, 2026] - Dashboard Counts Not Updating in Real-Time

**Problem:**
- After fixing the "0/0" bug, subtask counts showed initially (e.g., "0/1")
- But when user added more subtasks, the dashboard badge didn't update to "0/2"
- Had to refresh entire page to see new counts
- Task details modal showed correct counts, but dashboard cards were stale

**Root Cause:**
Dashboard was using `useSubtaskCountStatic` and `useCommentCountStatic` which only fetch counts once on component mount. When subtasks or comments were added via the task details modal, the dashboard cards had no way to know about the changes because they weren't listening for real-time updates.

**Solution:**
- Replaced `useSubtaskCountStatic` with `useSubtaskCount` (real-time)
- Replaced `useCommentCountStatic` with `useCommentCount` (real-time)
- These hooks use `onSnapshot()` to listen for Firestore changes instantly
- Dashboard badges now update automatically without page refresh

**Lesson:**
1. **Use real-time hooks for UI elements that display live data** - dashboards need instant updates
2. **Static hooks are only for** initial page loads or non-critical data
3. **Test the full user flow** - adding data from one component should update counts in another
4. **Real-time listeners are essential** when multiple components show the same data
5. **Document which hooks are static vs real-time** in code comments

**Related Files:**
- `src/components/admin/TaskManagementNew.jsx` (switched to real-time hooks)
- `src/hooks/useSubtaskCount.js` (real-time with onSnapshot)
- `src/hooks/useCommentCount.js` (real-time with onSnapshot)

---

## [Jan 4, 2026] - Subtask Count Display Showing 0/0

**Problem:**
- Dashboard task cards showed "0/0" for subtasks even when subtasks existed
- Task details modal correctly showed subtask count (e.g., "0/1 completed")
- Issue was invisible to users until they opened task details

**Root Cause:**
Firestore query in `useSubtaskCount.js` and `useSubtaskCountStatic.js` was filtering for `where('deleted', '==', false)`, but subtasks don't have a `deleted` field. Subtasks use hard deletion (`deleteDoc`) rather than soft deletion with a flag. This caused the query to return 0 results every time.

**Solution:**
- Removed `where('deleted', '==', false)` clause from both hooks
- Added explanatory comments: "Subtasks use hard deletion (deleteDoc), not soft deletion"
- Verified subtaskService.js only uses `deleteDoc()` for deletion

**Lesson:**
1. **Verify data schema before writing queries** - don't assume fields exist
2. **Check actual service implementation** - see how data is created/deleted
3. **Distinguish between hard and soft deletion patterns** in data model
4. **Test with actual data** - the bug was only visible when subtasks existed
5. **Add comments explaining deletion strategy** to prevent future mistakes

**Related Files:**
- `src/hooks/useSubtaskCount.js` (real-time)
- `src/hooks/useSubtaskCountStatic.js` (one-time fetch)
- `src/services/subtaskService.js` (uses deleteDoc)

---

## [Nov 30, 2025] - Production Readiness Assessment - Operational Maturity Gaps

**Problem:**
System was deployed to production for live business use (Magnetar company) but lacked operational maturity:
- No monitoring/alerting for failures
- No rollback capability if issues arose  
- No email quota management (could silently fail at 200/month limit)
- No health check endpoint
- Feature changes deployed without safety nets
- Treated like development project, not business-critical system

**Impact:**
- System worked technically but one failure could disrupt entire company
- No way to detect failures automatically
- No quick recovery if hybrid urgency logic caused issues
- Could hit EmailJS quota and stop reminders without warning
- Required manual log checking in Firestore to verify operation

**Root Cause:**
Focused on feature completion over operational excellence. Didn't implement proper DevOps practices for a production system.

**Solution:**

1. **Added Feature Flags for Instant Rollback:**
   ```javascript
   const FEATURE_FLAGS = {
     HYBRID_URGENCY_ENABLED: true,  // Set false to rollback to Critical-only
     EMAIL_QUOTA_WARNING: true,     // Monitor EmailJS quota
     HEALTH_CHECK_MODE: false       // Enable for diagnostics
   };
   ```
   - Can disable hybrid features without redeployment (30 second rollback)
   - Preserves new code while reverting behavior
   - Non-destructive rollback strategy

2. **Implemented Email Quota Monitoring:**
   ```javascript
   async function checkEmailQuota(db) {
     // Tracks monthly email count
     // Warns at 150/200 (75%)
     // Blocks at 195/200 (97.5%) with clear error message
   }
   ```
   - Prevents silent failures when quota exceeded
   - Proactive warnings before hitting limit
   - Saves quota stats to `system_monitoring/email_quota` collection

3. **Created Health Check Endpoint:**
   ```
   URL: ...cron-trigger.html?token=...&health=true
   Returns JSON with Firebase status, last execution, email quota
   ```
   - Can verify system status without sending emails
   - Suitable for UptimeRobot/monitoring services
   - Exposes feature flag states for transparency

4. **Enhanced Error Tracking:**
   - Execution time monitoring (warns if >60 seconds)
   - Leveled logging (INFO, WARN, ERROR, SUCCESS)
   - Feature flag status in logs
   - Execution metrics saved to Firestore

5. **Created Production Documentation:**
   - `.github/ROLLBACK_PROCEDURE.md` - Emergency recovery steps
   - `.github/OPERATIONS_MANUAL.md` - Daily/weekly/monthly operations
   - `.github/UPTIMEROBOT_SETUP.md` - Free monitoring setup guide
   - All procedures tested and validated

6. **Updated Firestore Rules:**
   ```javascript
   match /system_monitoring/{docId} {
     allow read, write, create, update: if true;  // For email quota tracking
   }
   ```

**Lesson:**
- **Production systems require operational maturity, not just technical functionality**
- Feature flags essential for non-disruptive rollbacks
- Monitoring/alerting should be built-in from day one
- Document operations procedures before deployment
- "Works now" ≠ "Production ready"
- Business-critical systems need redundancy, monitoring, and documented recovery procedures
- Email quota limits are real constraints requiring proactive management

**Related Files:**
- `public/cron-trigger.html` - Added feature flags, health check, quota monitoring
- `firestore.rules` - Added system_monitoring collection permissions
- `.github/ROLLBACK_PROCEDURE.md` - Emergency recovery documentation
- `.github/OPERATIONS_MANUAL.md` - Ongoing operations guide
- `.github/UPTIMEROBOT_SETUP.md` - External monitoring setup

**Prevention:**
- Use feature flags for all significant features
- Build health check endpoints from start
- Implement quota/rate limit monitoring for external services
- Create rollback procedures BEFORE deploying risky changes
- Document operations before going live
- Test rollback procedures regularly
- Set up external monitoring (UptimeRobot, etc.)
- Treat production deployments with appropriate caution
- Regular operational reviews (daily checks for first week, then weekly)

---

## [Nov 30, 2025] - Automatic Email Reminder System - Multiple Issues

**Problem:**
Daily reminder cron job was not sending emails despite appearing to run successfully. Multiple compounding issues:

1. **Case-Sensitive Priority Filtering**
   - Firestore query used `.where('priority', '==', 'critical')` (lowercase)
   - Actual tasks had `priority: 'Critical'` (capital C)
   - Result: Query returned 0 tasks even though critical tasks existed

2. **Missing Firestore Permissions for Unauthenticated Access**
   - Cron-trigger.html runs without authentication (by design - "backdoor")
   - Firestore rules blocked unauthenticated reads on `tasks` and `users` collections
   - Error: "Missing or insufficient permissions"

3. **reminderLogRef Variable Scope Issue**
   - Variable declared inside `if (!bypassCheck)` block
   - When bypass mode used, variable was undefined
   - Error: "reminderLogRef is not defined" at line 364

4. **Insufficient Permissions for reminder_logs Collection**
   - Rules allowed `write, create` but NOT `read` for unauthenticated users
   - Cron trigger needs to READ existing logs to prevent duplicates
   - Without read access, duplicate prevention failed completely

5. **User Document Read Permission Missing**
   - Rules allowed `list` (get all users) but not individual `read` (get one user)
   - Code tried to fetch individual user documents by ID
   - Error: "Missing or insufficient permissions" when processing users

**Solution:**

1. **Fixed Case-Insensitive Priority Check:**
   ```javascript
   // OLD (broken):
   const tasksQuery = query(
     collection(db, 'tasks'),
     where('priority', '==', 'critical')  // ❌ Case-sensitive
   );
   
   // NEW (working):
   const tasksQuery = collection(db, 'tasks');
   const tasksSnapshot = await getDocs(tasksQuery);
   tasksSnapshot.forEach(taskDoc => {
     const task = taskDoc.data();
     // Case-insensitive check
     if (task.priority?.toLowerCase() === 'critical' && 
         task.status?.toLowerCase() !== 'completed') {
       criticalTasks.push({ id: taskDoc.id, ...task });
     }
   });
   ```

2. **Updated Firestore Rules for Unauthenticated Read Access:**
   ```javascript
   // Tasks collection
   match /tasks/{taskId} {
     allow list: if isAdmin() || !isAuthenticated();  // ✅ Cron can read
   }
   
   // Users collection
   match /users/{userId} {
     allow read: if (isAuthenticated() && isOwner(userId)) || !isAuthenticated();  // ✅ Individual reads
     allow list: if isAdmin() || !isAuthenticated();  // ✅ Cron can list
   }
   
   // Reminder logs collection
   match /reminder_logs/{logId} {
     allow read, write, create: if true;  // ✅ Cron needs read AND write
     allow list: if isAdmin();
   }
   ```

3. **Fixed Variable Scope:**
   ```javascript
   // Moved reminderLogRef declaration OUTSIDE conditional block
   const today = new Date().toISOString().split('T')[0];
   const reminderLogRef = doc(db, 'reminder_logs', today);  // ✅ Available everywhere
   
   if (!bypassCheck) {
     const reminderLogSnap = await getDoc(reminderLogRef);  // Now works
   }
   ```

4. **Added Graceful User Fetch with Fallback:**
   ```javascript
   // Wrapped user fetch in try-catch
   try {
     const userDoc = await getDoc(doc(db, 'users', userId));
     if (userDoc.exists()) {
       const user = userDoc.data();
       userEmail = user.email || userId;
       userName = user.name || user.email || 'User';
     }
   } catch (userError) {
     log(`Could not fetch user details, using task info`);
     // Fallback to email from task if available
   }
   ```

**Lesson:**
- **ALWAYS use case-insensitive comparisons** for user-entered data (priority, status, etc.)
- **Plan Firestore security rules carefully** when implementing unauthenticated access
  - List vs Read permissions are different - both may be needed
  - If code needs to check for existing documents, it needs READ permission
- **Variable scope matters** - declare variables at function level if used in multiple branches
- **Firebase free plan doesn't support Cloud Functions** - use alternatives like:
  - Standalone HTML endpoints (what we used)
  - External cron services (cron-job.org)
  - GitHub Actions
  - Vercel serverless functions
- **Test with production settings** - bypass modes are useful for testing but hide real issues
- **Duplicate prevention requires TWO permissions**: READ (to check) and WRITE (to log)
- **Graceful degradation** - wrap external API calls in try-catch with fallbacks

**Related Files:**
- `public/cron-trigger.html` - Main cron endpoint (lines 200-380)
- `firestore.rules` - Security rules (lines 24-138)
- `functions/index.js` - Attempted Cloud Functions (can't deploy on Spark plan)

---

## [Dec 1, 2025] - Low Priority Task Handling Gap - No Reminders for Overdue Low Priority Tasks

**Problem:**
Low priority tasks received NO reminders even if significantly overdue (30+ days, 60+ days, etc.):
```javascript
// Original logic - LOW priority always returned null
if (priority === 'low') {
  return null; // NO REMINDERS EVER
}
```
This created risk of:
- Tasks forgotten indefinitely
- Dependencies blocking future work
- Technical debt accumulation
- Client relationship damage (forgotten commitments)
- Compliance issues (overlooked requirements)

User validated: "if it is low priority but its overdue then it may cause problem in the future work right?"

**Impact:**
Low priority tasks could become business problems:
- System migration delayed 60 days (forgotten Low priority task blocks production deployment)
- Client documentation promise forgotten (damages relationship)
- Security patch delayed (Low priority → compliance violation)
- "Low priority" ≠ "no consequences", just "not urgent right now"

**Root Cause:**
Reminder logic only considered Critical, Medium approaching (≤2 days), and Medium/High overdue. Assumed Low priority tasks didn't need any accountability mechanism. Didn't consider that "Low priority" tasks can have high impact if ignored long-term.

**Solution:**
Implemented **progressive escalation system** with 3 tiers based on days overdue:

```javascript
// Tier 1: 7-13 days overdue - Weekly reminder (Monday only)
if (daysOverdue >= 7 && daysOverdue <= 13) {
  return {
    category: 'low_overdue_weekly',
    urgencyLevel: '📌 Low Priority - Overdue',
    color: '#6b7280',
    icon: '📌',
    weeklyOnly: true  // Send on Mondays only
  };
}

// Tier 2: 14-29 days overdue - Weekly reminder (Monday only)
if (daysOverdue >= 14 && daysOverdue <= 29) {
  return {
    category: 'low_aging_weekly',
    urgencyLevel: '⚠️ Low Priority - Aging',
    color: '#f97316',
    icon: '⚠️',
    weeklyOnly: true  // Send on Mondays only
  };
}

// Tier 3: 30+ days overdue - Daily reminder
if (daysOverdue >= 30) {
  return {
    category: 'low_critical_age',
    urgencyLevel: '🚨 ATTENTION REQUIRED',
    color: '#dc2626',
    icon: '🚨'
  };
}
```

Added day-of-week check to filter weekly reminders:
```javascript
const isMonday = new Date().getDay() === 1;

if (urgency.weeklyOnly && !isMonday) {
  return; // Skip weekly Low priority tasks if not Monday
}
```

**Benefits:**
- **Grace period (0-6 days):** No reminder, allows flexibility
- **Weekly reminders (7-29 days):** Saves email quota (4/month vs 30/month), reduces noise
- **Daily after 30 days:** Catches truly forgotten tasks before major impact
- **Visual progression:** Gray → Orange → Red (clear urgency signal)
- **Respects priority hierarchy:** Low gets less attention than Critical
- **No data modification:** Read-only approach, admin maintains control
- **Quota efficient:** Weekly sends save 26 emails/month per task vs daily

**Lesson:**
- **Always consider all priority levels** in reminder/notification logic
- **"Low priority" ≠ "ignore forever"** - low urgency ≠ no consequences
- **Progressive escalation** balances accountability with notification fatigue
- **Time-based urgency** works even for low priority items (7 days → 30 days → urgent)
- **Design for long-term impact** not just immediate urgency

**Prevention:**
- When designing urgency/notification systems, map ALL priority levels
- Ask: "What happens if we ignore this for 30/60/90 days?"
- Consider progressive approaches (escalate gradually over time)
- Balance business needs (accountability) with user experience (notification fatigue)
- Use weekly/monthly sends for low urgency items to save quota/reduce noise

**Related Files:**
- `public/cron-trigger.html` - getTaskUrgency() function (lines 288-370)
- `public/cron-trigger.html` - Monday filtering logic (lines 565-575)
- `public/cron-trigger.html` - Email template updates (lines 687-720)
- `public/cron-trigger.html` - Firestore logging with Low counts (lines 750-763)

---

## [Dec 7, 2025] - Task Comments Feature - Successful Day 1 Implementation

**Context:**
Implemented Task Comments & Collaboration feature (Day 1 of 3-day plan) including database schema, security rules, and core services.

**What Went Right:**
- Comprehensive planning with 30-task breakdown created strong foundation
- Firestore security rules designed with least-privilege principle
- All three services (comment, attachment, notification) built with proper error handling
- Input validation at multiple layers (client + Firestore rules)
- Test infrastructure created before UI implementation
- Documentation written alongside code (EMAILJS_MENTION_TEMPLATE.md)
- Security rating 10/10 - no vulnerabilities introduced

**Technical Implementation:**
- Created 3 new Firestore collections (task_comments, task_attachments, comment_notifications)
- Deployed security rules with RBAC (author + admin permissions)
- Built commentService.js (226 lines) with real-time listeners
- Built attachmentService.js (248 lines) with file validation
- Built notificationService.js (212 lines) with EmailJS integration
- File size limits (10MB), file count limits (5 per task), type whitelist enforced
- Soft delete for comments (preserves audit trail)
- Self-mention filtering prevents spam

**Key Design Decisions:**
- Real-time updates via onSnapshot (better UX than polling)
- Soft delete for comments (data integrity for audit)
- Immutable attachments (prevent tampering after upload)
- Progressive file validation (client → service → Firestore rules)
- Batch notifications for multiple @mentions (efficiency)
- EmailJS integration for cross-platform notifications

**Lesson:**
- **Comprehensive planning pays off** - 30-task breakdown prevented scope creep
- **Security by design** - considered auth/validation from Day 1, not retrofit
- **Test infrastructure first** - created test-comment-services.html before UI
- **Document as you go** - EmailJS template guide created alongside code
- **Layered validation** - client, service, Firestore rules all validate independently

**Prevention:**
- When building complex features, create detailed task breakdown FIRST
- Design Firestore security rules alongside collection schema
- Build test infrastructure before production components
- Document integration requirements (like EmailJS template) immediately
- Plan for Day 2-3 before starting Day 1 (holistic view prevents rework)

**Related Files:**
- `src/services/commentService.js` - Comment CRUD operations
- `src/services/attachmentService.js` - File upload/download
- `src/services/notificationService.js` - Notification management
- `firestore.rules` - Security rules for new collections (lines 194-293)
- `public/test-comment-services.html` - Testing infrastructure
- `.github/EMAILJS_MENTION_TEMPLATE.md` - EmailJS setup guide
- `.github/TASK_COMMENTS_DAY1_COMPLETE.md` - Implementation summary

---

