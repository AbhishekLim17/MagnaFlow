# 🔄 Emergency Rollback Procedure

## Quick Reference

**CRITICAL**: If reminders stop working, follow this procedure immediately.

---

## Option 1: Feature Flag Rollback (30 seconds)

### Fastest rollback - disables hybrid features without redeployment

1. Open `public/cron-trigger.html` in VS Code
2. Find line ~118 (FEATURE_FLAGS section):
```javascript
const FEATURE_FLAGS = {
  HYBRID_URGENCY_ENABLED: true,  // Set to false to rollback to Critical-only
  EMAIL_QUOTA_WARNING: true,     // Warn when approaching EmailJS limit
  HEALTH_CHECK_MODE: false       // Set true for health check endpoint
};
```

3. Change `HYBRID_URGENCY_ENABLED` to `false`:
```javascript
const FEATURE_FLAGS = {
  HYBRID_URGENCY_ENABLED: false,  // ⚠️ ROLLBACK ACTIVE
  EMAIL_QUOTA_WARNING: true,
  HEALTH_CHECK_MODE: false
};
```

4. Save file

5. Rebuild and deploy:
```powershell
cd "a:\Alpha\WORK\Magnetar\MagnaFlow"
npm run build
firebase deploy --only hosting
```

6. Wait 1-2 minutes for deployment

7. **Test immediately**:
```
https://magnaflow-07sep25.web.app/cron-trigger.html?token=MgF-7x9K2pL4qR8vN3mB6cT1yE5wH0zA&bypass=true
```

**Result**: System returns to Critical-only reminders (proven stable)

---

## Option 2: Git Rollback (5 minutes)

### Complete rollback to last stable version

1. Check git history:
```powershell
cd "a:\Alpha\WORK\Magnetar\MagnaFlow"
git log --oneline -10
```

2. Find commit BEFORE hybrid approach (look for "Add hybrid urgency logic" or similar)

3. Rollback to that commit:
```powershell
git revert <commit-hash> --no-commit
git commit -m "EMERGENCY ROLLBACK: Revert to Critical-only reminders"
```

4. Rebuild and deploy:
```powershell
npm run build
firebase deploy --only hosting
```

5. **Test immediately** (same URL as above)

---

## Option 3: Manual File Restore (10 minutes)

### If git history is unclear

1. Backup current file:
```powershell
Copy-Item "public\cron-trigger.html" "public\cron-trigger.html.backup"
```

2. Restore from this known-good version:

The critical-only logic is:
```javascript
function getTaskUrgency(task) {
  const priority = (task.priority || '').toLowerCase();
  const status = (task.status || '').toLowerCase();

  if (status === 'completed') return null;

  if (priority === 'critical') {
    return {
      category: 'critical',
      urgencyLevel: '🔴 CRITICAL',
      color: '#ef4444',
      icon: '🔴',
      reason: 'Critical Priority',
      sortOrder: 1
    };
  }

  return null; // Only Critical tasks get reminders
}
```

3. Replace the entire `getTaskUrgency()` function with above

4. Remove deadline checking in task filtering (lines ~460-480):
```javascript
// Simple critical-only filter
const tasksNeedingReminders = allTasks.filter(task => {
  const priority = (task.priority || '').toLowerCase();
  return priority === 'critical';
});
```

5. Rebuild and deploy

---

## Verification Checklist

After any rollback, verify:

- [ ] Cron trigger URL loads without errors
- [ ] Test with `&bypass=true` shows "Critical: 1" (your current task)
- [ ] Email received with only Critical tasks
- [ ] No errors in browser console
- [ ] Firestore reminder_logs updated correctly
- [ ] Email quota tracking still works

---

## Emergency Contacts

If rollback fails:

1. **Check Firestore Rules**: Ensure `reminder_logs` and `system_monitoring` collections allow public read/write
2. **Check EmailJS**: Service status at https://dashboard.emailjs.com
3. **Check Firebase**: Hosting status at https://console.firebase.google.com/project/magnaflow-07sep25/hosting

---

## Health Check

After rollback, verify system health:

```
https://magnaflow-07sep25.web.app/cron-trigger.html?token=MgF-7x9K2pL4qR8vN3mB6cT1yE5wH0zA&health=true
```

Should show:
```json
{
  "status": "healthy",
  "checks": {
    "firebase": { "status": "ok" },
    "lastExecution": { "status": "ok" },
    "emailQuota": { "status": "ok" }
  }
}
```

---

## Prevention

To avoid future emergency rollbacks:

1. Always test with `&bypass=true` first
2. Monitor first 3 days after deployment
3. Check reminder_logs daily for anomalies
4. Keep feature flags for easy rollback
5. Document all changes in `.github/mistakes.md`

---

## Success Indicators

System is stable when:

- ✅ Emails sent daily at 8:00 AM IST
- ✅ reminder_logs updated in Firestore
- ✅ No error emails from cron-job.org
- ✅ Critical tasks showing in emails
- ✅ CC emails received by 3 managers

---

## Notes

- Feature flag rollback is NON-DESTRUCTIVE (preserves new code)
- Git rollback is REVERSIBLE (can re-apply later)
- Manual file restore is LAST RESORT (risk of errors)
- Always test with bypass mode after rollback
- Document rollback reason in `.github/mistakes.md`

---

**Last Updated**: November 30, 2025
**System Version**: Hybrid Urgency with Feature Flags
**Stable Fallback**: Critical-only (proven in production)
