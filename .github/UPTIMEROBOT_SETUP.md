# 🔔 UptimeRobot Monitoring Setup Guide

## Purpose

Set up free monitoring and alerts to ensure MagnaFlow reminder system stays healthy.

---

## Why UptimeRobot?

- **Free Tier**: 50 monitors, 5-minute checks
- **Redundancy**: Backup to cron-job.org
- **Alerts**: Email notifications if system fails
- **Health Monitoring**: Regular checks ensure system is responsive

---

## Setup Steps

### Step 1: Create Account

1. Go to: https://uptimerobot.com
2. Click "Sign Up" (free)
3. Use: admin@magnetar.in (or your preferred email)
4. Verify email

### Step 2: Add Monitor

1. Click "+ Add New Monitor"
2. **Monitor Type**: HTTP(s)
3. **Friendly Name**: MagnaFlow Reminder Health Check
4. **URL**: 
   ```
   https://magnaflow-07sep25.web.app/cron-trigger.html?token=MgF-7x9K2pL4qR8vN3mB6cT1yE5wH0zA&health=true
   ```
5. **Monitoring Interval**: 5 minutes (free tier)
6. Click "Create Monitor"

### Step 3: Configure Alerts

1. Go to "My Settings" → "Alert Contacts"
2. Add email: admin@magnetar.in (or notify: pankaj@, dhaval@, tejas@magnetar.in)
3. Verify email address
4. Configure alert preferences:
   - **Alert When**: Down, Up (recovery notification)
   - **Send Alert After**: 1 check (immediate)

### Step 4: Verify Setup

1. Wait 5 minutes for first check
2. Should show "Up" status with 200 OK response
3. Check email for welcome/confirmation

---

## Expected Responses

### Healthy System
```
HTTP Status: 200 OK
Response contains: "status": "healthy"
```

### Unhealthy System
```
HTTP Status: 200 OK
Response contains: "status": "unhealthy"
```

### System Down
```
HTTP Status: 500 or timeout
No response
```

---

## Alert Configuration

### Email Template Example

**Subject**: [UptimeRobot] MagnaFlow Reminder Health Check is DOWN

**Body**:
```
Monitor: MagnaFlow Reminder Health Check
Status: DOWN
URL: https://magnaflow-07sep25.web.app/cron-trigger.html?token=...&health=true
Reason: Connection timeout / HTTP error
Time: [Timestamp]

Action Required:
1. Check health endpoint manually
2. Review Firestore logs
3. Execute rollback if needed
```

---

## Recommended Monitors

### Monitor 1: Health Check (Primary)
- **URL**: `...cron-trigger.html?token=...&health=true`
- **Interval**: 5 minutes
- **Purpose**: System health verification
- **Alert**: Immediate

### Monitor 2: Main App (Secondary)
- **URL**: `https://magnaflow-07sep25.web.app`
- **Interval**: 5 minutes
- **Purpose**: Hosting availability
- **Alert**: After 2 failures (10 minutes)

### Monitor 3: Firebase (Optional)
- **URL**: `https://firestore.googleapis.com`
- **Interval**: 15 minutes
- **Purpose**: Firebase service status
- **Alert**: After 3 failures

---

## Maintenance

### Weekly
- Review uptime percentage (should be >99%)
- Check for any downtime incidents
- Verify alerts working (test by pausing monitor)

### Monthly
- Review alert history
- Adjust monitoring intervals if needed
- Update contact emails if team changes

---

## Troubleshooting

### False Positives

If monitor shows DOWN but system is working:
1. Check if Firebase quota exceeded
2. Verify token in URL is correct
3. Test health endpoint manually
4. Check UptimeRobot status page

### Missing Alerts

If system down but no alert:
1. Verify email address in Alert Contacts
2. Check spam folder
3. Test alert by pausing/unpausing monitor
4. Verify UptimeRobot account active

---

## Integration with Existing Cron

### Current Setup
- **cron-job.org**: 8:00 AM IST daily (sends reminders)
- **UptimeRobot**: Every 5 minutes (health check only)

### How They Work Together

1. **cron-job.org**:
   - Triggers actual reminder sending
   - Runs once per day
   - Uses standard URL (no `&health=true`)

2. **UptimeRobot**:
   - Monitors system health continuously
   - Does NOT send reminders (uses `&health=true`)
   - Provides alerts if system goes down

### No Conflicts
- Health check URL doesn't send emails
- Different parameters ensure separation
- Both services can run simultaneously

---

## Cost

### Free Tier Includes:
- 50 monitors
- 5-minute interval
- 2 months of logs
- Email alerts
- Public status pages

### Upgrade Options (Optional):
- **Pro Plan** ($7/month):
  - 1-minute intervals
  - SMS alerts
  - More monitors
  - Longer log retention

**Recommendation**: Free tier is sufficient for this use case

---

## Alternative: Simple Status Page

If you don't want external service, create internal monitor:

### Option A: Daily Manual Check
1. Bookmark health check URL
2. Check once daily at 8:05 AM
3. Verify "healthy" status

### Option B: Browser Extension
1. Install "Check My Links" or similar
2. Add health check URL
3. Get notifications in browser

### Option C: Firebase Monitoring
1. Enable Firebase Performance Monitoring
2. Track cron-trigger.html page loads
3. View in Firebase Console

**Recommendation**: UptimeRobot provides best balance of automation and simplicity

---

## Security Note

The health check URL includes security token but:
- Only returns status information
- Does NOT send emails
- Does NOT modify data
- Safe to monitor externally

Token is needed to:
- Prevent unauthorized access
- Match production endpoint behavior
- Ensure consistent security

---

## Success Criteria

UptimeRobot setup is successful when:

- ✅ Monitor shows "Up" status consistently
- ✅ Alerts received when system truly down
- ✅ No false positives (>99% uptime)
- ✅ Email alerts delivered promptly
- ✅ Health check returns valid JSON

---

## Quick Reference

### Health Check URL
```
https://magnaflow-07sep25.web.app/cron-trigger.html?token=MgF-7x9K2pL4qR8vN3mB6cT1yE5wH0zA&health=true
```

### UptimeRobot Dashboard
```
https://uptimerobot.com/dashboard
```

### Expected Response
```json
{
  "status": "healthy",
  "checks": {
    "firebase": {"status": "ok"},
    "lastExecution": {"status": "ok"},
    "emailQuota": {"status": "ok", "count": X, "limit": 200}
  }
}
```

---

**Setup Time**: 5 minutes
**Cost**: Free
**Benefit**: 24/7 monitoring with instant alerts
**Recommendation**: HIGHLY RECOMMENDED for production systems
