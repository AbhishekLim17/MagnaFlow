# 📊 MagnaFlow Reminder System - Operations Manual

## Daily Operations

### Morning Check (8:05 AM IST)

After the 8:00 AM cron execution, verify:

1. **Check Email**
   - Verify reminder email received (if Critical tasks exist)
   - Confirm CC emails sent to pankaj@, dhaval@, tejas@magnetar.in
   - Check email formatting looks correct

2. **Check Firestore Logs**
   - Navigate to: Firebase Console → Firestore → `reminder_logs`
   - Find today's document (format: YYYY-MM-DD)
   - Verify fields:
     ```
     timestamp: [Today 08:00]
     totalTasks: [Number]
     criticalCount: [Number]
     overdueCount: [Number]  
     approachingCount: [Number]
     remindersSent: [Number]
     results: [Array of send results]
     ```

3. **Check Email Quota**
   - Navigate to: Firestore → `system_monitoring` → `email_quota`
   - Current month count should increment
   - Warning if > 150 emails

---

## Weekly Operations

### Monday Morning

1. **Review Last Week's Logs**
   ```
   - Total reminders sent
   - Any failed deliveries
   - Email quota usage
   - Execution times
   ```

2. **Check for Anomalies**
   - Sudden spike in task count
   - Repeated failures
   - Long execution times (>30s)

3. **Review System Health**
   ```
   https://magnaflow-07sep25.web.app/cron-trigger.html?token=MgF-7x9K2pL4qR8vN3mB6cT1yE5wH0zA&health=true
   ```

---

## Monthly Operations

### First Day of Month

1. **Email Quota Reset**
   - EmailJS quota resets automatically
   - Verify `system_monitoring/email_quota` shows new month
   - Previous month count archived

2. **Performance Review**
   - Average execution time
   - Email delivery success rate
   - Task volume trends
   - User feedback

3. **Cleanup Old Logs** (Optional)
   - Keep last 90 days of `reminder_logs`
   - Archive older logs if needed

---

## Monitoring Endpoints

### Health Check
```
URL: https://magnaflow-07sep25.web.app/cron-trigger.html?token=MgF-7x9K2pL4qR8vN3mB6cT1yE5wH0zA&health=true

Returns:
{
  "status": "healthy" | "unhealthy",
  "timestamp": "ISO date",
  "checks": {
    "firebase": { "status": "ok" | "error" },
    "lastExecution": { "status": "ok" | "warning" },
    "emailQuota": { "status": "ok" | "critical", "count": X, "limit": 200 }
  },
  "featureFlags": { ... }
}
```

### Manual Test (Bypass Daily Limit)
```
URL: https://magnaflow-07sep25.web.app/cron-trigger.html?token=MgF-7x9K2pL4qR8vN3mB6cT1yE5wH0zA&bypass=true

⚠️ USE SPARINGLY - Sends real emails and counts toward quota
```

---

## Alert Thresholds

### Email Quota
- **Green** (< 150): Normal operation
- **Yellow** (150-195): Warning logged, no action needed
- **Red** (≥ 195): System pauses reminders, manual intervention required

### Execution Time
- **Normal**: < 10 seconds
- **Acceptable**: 10-30 seconds  
- **Warning**: 30-60 seconds (logged)
- **Critical**: > 60 seconds (potential timeout)

### Task Volume
- **Typical**: 1-10 tasks needing reminders
- **High**: 10-50 tasks
- **Unusual**: > 50 tasks (investigate for data issues)

---

## Troubleshooting

### No Email Received

1. **Check if cron ran**
   - Visit: https://cron-job.org (login required)
   - Verify last execution showed 200 OK

2. **Check Firestore logs**
   - `reminder_logs/[today]` exists?
   - `remindersSent` > 0?

3. **Check email quota**
   - `system_monitoring/email_quota`
   - Count < 200?

4. **Check for Critical tasks**
   - Firestore → `tasks` collection
   - Filter: priority = "Critical", status ≠ "Completed"
   - Any results?

5. **Test manually**
   - Use bypass URL
   - Check browser console for errors

### Email Quota Exceeded

**Immediate Action**:
1. Check `system_monitoring/email_quota`
2. Verify it's accurate (not a bug)
3. If accurate:
   - Wait until next month (automatic reset)
   - OR upgrade EmailJS plan
   - OR manually reset for emergency

**Prevention**:
- Monitor weekly trends
- Reduce unnecessary reminders
- Consider batch notifications

### Reminders Not Sending (Feature Working)

If system works but no reminders:
- **Most likely**: No Critical/Urgent tasks exist ✅
- Check task priorities and deadlines
- Verify Medium tasks have due dates set
- Confirm tasks not marked Completed

---

## Feature Flags

Located in: `public/cron-trigger.html` line ~118

### HYBRID_URGENCY_ENABLED
```javascript
true  = Critical + Medium (deadline-based) + High (overdue)
false = Critical only (original behavior)
```

**When to disable**:
- Hybrid logic causing issues
- Too many false positives
- Need to revert quickly

### EMAIL_QUOTA_WARNING
```javascript
true  = Monitor and warn about email usage
false = No quota monitoring
```

**When to disable**:
- EmailJS plan upgraded (higher limit)
- Monitoring causing performance issues

### HEALTH_CHECK_MODE
```javascript
false = Normal operation
true  = Always run health check instead of reminders
```

**When to enable**:
- Debugging system status
- Testing without sending emails
- Verifying configuration

---

## Firestore Collections

### `tasks`
- **Access**: Public read (unauthenticated)
- **Purpose**: Source data for reminders
- **Key Fields**: priority, status, dueDate, assignedTo

### `users`
- **Access**: Public read individual docs
- **Purpose**: Get user email addresses
- **Key Fields**: email, name

### `reminder_logs`
- **Access**: Public read/write
- **Purpose**: Track daily executions
- **Document ID**: YYYY-MM-DD format

### `system_monitoring`
- **Access**: Public read/write
- **Purpose**: Operational metrics
- **Documents**:
  - `email_quota`: Monthly email tracking

---

## Email Configuration

### EmailJS Service
- **Service ID**: service_itwo1ee
- **Template ID**: template_mwmmgmi
- **Monthly Quota**: 200 emails (free tier)
- **Dashboard**: https://dashboard.emailjs.com

### Email Template Variables
```javascript
{
  to_email: "user@magnetar.in",
  to_name: "John Doe",
  task_count: 3,
  email_title: "CRITICAL ALERT" | "URGENT REMINDER" | "Daily Reminder",
  email_icon: "🔴" | "⏰" | "🔔",
  email_color: "#dc2626" | "#f59e0b" | "#3b82f6",
  tasks_list: "Formatted task details",
  cc_emails: "pankaj@, dhaval@, tejas@magnetar.in",
  button_link: "https://magnaflow-07sep25.web.app"
}
```

---

## Cron Service

### Provider: cron-job.org
- **Schedule**: Daily at 8:00:07 AM IST
- **URL**: `https://magnaflow-07sep25.web.app/cron-trigger.html?token=...`
- **Expected Response**: 200 OK
- **Dashboard**: https://console.cron-job.org/jobs

### Backup Service Setup (Recommended)

**UptimeRobot** (Free, different time):
1. Create account at uptimerobot.com
2. Add HTTP monitor
3. Set URL to cron endpoint
4. Set interval: Daily at 8:30 AM IST
5. Alert email: admin@magnetar.in

This provides:
- Redundancy if cron-job.org fails
- Health monitoring
- Downtime alerts

---

## Security

### Token Protection
- **Token**: MgF-7x9K2pL4qR8vN3mB6cT1yE5wH0zA
- **Location**: URL parameter only
- **Validation**: Application level (not Firestore rules)
- **Rotation**: Manual (document procedure)

### Firestore Rules
- Public read: tasks, users (read-only)
- Public write: reminder_logs, system_monitoring (write-only)
- Token validation in application code
- No sensitive data exposed

---

## Change Management

### Before Making Changes

1. **Test in bypass mode**
2. **Document in `.github/mistakes.md`**
3. **Update this manual if needed**
4. **Verify rollback procedure works**
5. **Monitor for 3 days after deployment**

### After Making Changes

1. **Test immediately with bypass URL**
2. **Check logs in Firestore**
3. **Verify email received**
4. **Monitor next 3 daily executions**
5. **Document any issues**

---

## Escalation

### Issues Requiring Immediate Action
- No reminders for 2+ consecutive days
- Email quota exceeded unexpectedly
- Cron service shows errors
- Multiple failed email deliveries

### Contact Points
- **Firebase Console**: https://console.firebase.google.com/project/magnaflow-07sep25
- **EmailJS Dashboard**: https://dashboard.emailjs.com
- **Cron Service**: https://console.cron-job.org

### Recovery Steps
1. Check health endpoint
2. Review Firestore logs
3. Test with bypass mode
4. Check email quota
5. Verify Firestore rules
6. Review cron job status
7. If all fails: **Execute rollback procedure**

---

## Performance Benchmarks

### Normal Operation
- **Execution Time**: 3-8 seconds
- **Tasks Scanned**: 10-100
- **Tasks Needing Reminders**: 1-5
- **Emails Sent**: 1-3
- **Success Rate**: 100%

### Red Flags
- Execution > 30 seconds
- Multiple send failures
- Quota spike (>20 emails/day)
- Tasks scanned > 1000
- Health check fails

---

## Maintenance Schedule

### Daily
- ✅ Verify reminders sent (if tasks exist)

### Weekly  
- ✅ Review logs for anomalies
- ✅ Check email quota usage

### Monthly
- ✅ Review performance metrics
- ✅ Archive old logs (>90 days)
- ✅ Test rollback procedure

### Quarterly
- ✅ Security audit
- ✅ Performance optimization review
- ✅ User feedback collection
- ✅ Feature flag assessment

---

## Success Metrics

### Primary KPIs
- **Uptime**: 99.9% (max 1 missed day/year)
- **Email Delivery**: 100% success rate
- **Response Time**: < 10 seconds average
- **User Satisfaction**: No missed critical reminders

### Secondary Metrics
- Email quota utilization
- Task volume trends
- Execution time trends
- Feature flag usage

---

**Document Version**: 1.0
**Last Updated**: November 30, 2025
**Next Review**: January 1, 2026
**Owner**: Magnetar IT Team
