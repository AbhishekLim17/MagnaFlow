# Low Priority Task Progressive Escalation System

## Overview

The MagnaFlow reminder system now includes **progressive escalation** for Low priority tasks. This addresses the gap where Low priority tasks received no reminders even if significantly overdue, which could cause future business problems.

## Why This Was Needed

**Original Problem:**
- Low priority tasks got NO reminders, even if 30+ days overdue
- Created risk of forgotten tasks blocking future work
- User confirmed: "if it is low priority but its overdue then it may cause problem in the future work right?"

**Real-World Impact:**
- System migration delayed because forgotten Low task blocks deployment
- Client commitments forgotten, damaging relationships
- Compliance issues from overlooked requirements
- Technical debt accumulation

## How It Works

### Three-Tier Escalation System

#### Tier 1: 7-13 Days Overdue
- **Frequency:** Weekly (Monday only)
- **Badge:** 📌 Low Priority - Overdue
- **Color:** Gray (#6b7280)
- **Purpose:** Gentle reminder that task is overdue but not urgent
- **Email count:** ~4 per month (saves quota vs daily)

#### Tier 2: 14-29 Days Overdue
- **Frequency:** Weekly (Monday only)
- **Badge:** ⚠️ Low Priority - Aging
- **Color:** Orange (#f97316)
- **Purpose:** Warning that task is becoming old, needs attention soon
- **Email count:** ~4 per month

#### Tier 3: 30+ Days Overdue
- **Frequency:** Daily
- **Badge:** 🚨 ATTENTION REQUIRED - Critical Age
- **Color:** Red (#dc2626)
- **Purpose:** Urgent alert - task critically overdue, likely forgotten
- **Email count:** Daily until resolved

### Grace Period (0-6 Days)
- **Frequency:** None
- **Purpose:** Allow flexibility, no reminder for minor delays

## Benefits

### 1. **Prevents Forgotten Tasks**
Tasks aren't ignored indefinitely just because they're Low priority. After 30 days, system escalates to daily reminders.

### 2. **Email Quota Efficiency**
Weekly sends (Tiers 1-2) save email quota:
- Daily for 30 days = 30 emails
- Weekly for 30 days = 4 emails
- **Savings:** 26 emails per task per month

### 3. **Respects Priority Hierarchy**
- Critical: Always daily reminders
- Medium: Deadline-based (approaching or overdue)
- High: Overdue only
- Low: Time-based progressive escalation (least aggressive)

### 4. **Reduces Notification Fatigue**
Weekly reminders for 7-29 days prevent daily spam while maintaining accountability.

### 5. **Clear Visual Progression**
Gray → Orange → Red badge progression signals increasing urgency.

### 6. **No Automatic Changes**
Read-only approach - reminders suggest actions but don't modify task data. Admin maintains full control.

## Technical Implementation

### Code Changes Made

1. **getTaskUrgency() Function** (`public/cron-trigger.html` lines 350-370)
   - Added Low priority tier detection with 3 urgency levels
   - Returns urgency object with `weeklyOnly: true` flag for Tiers 1-2

2. **Monday Filtering** (`public/cron-trigger.html` lines 565-575)
   ```javascript
   const isMonday = new Date().getDay() === 1;
   
   if (urgency.weeklyOnly && !isMonday) {
     return; // Skip weekly Low tasks if not Monday
   }
   ```

3. **Email Template Updates** (`public/cron-trigger.html` lines 687-720)
   - Added Low priority badge detection
   - Updated email titles: "Weekly Task Review", "Aging Tasks Review", "ATTENTION REQUIRED"
   - Color-coded based on tier

4. **Firestore Logging** (`public/cron-trigger.html` lines 750-763)
   - Added tracking for `lowOverdueWeeklyCount`, `lowAgingWeeklyCount`, `lowCriticalAgeCount`
   - Visible in reminder_logs collection

## Operational Notes

### Quota Impact
- **Before:** Only Critical/Medium/High sent reminders
- **After:** Low priority adds reminders, but weekly sends minimize impact
- **Expected:** 4 emails/month per Low task (Tiers 1-2), daily for Tier 3
- **Monitoring:** Email quota tracking warns at 150, blocks at 195

### Rollback Capability
If Low priority reminders cause issues, can be disabled via feature flag:
```javascript
FEATURE_FLAGS.HYBRID_URGENCY_ENABLED = false
```
This rollback takes 30 seconds, reverts to Critical-only reminders (original behavior).

### Testing with Bypass Mode
To test Low priority detection:
1. Create test Low priority task in Firestore
2. Set dueDate to 10 days ago (for Tier 1), 20 days ago (Tier 2), or 40 days ago (Tier 3)
3. Access: `https://magnaflow-07sep25.web.app/cron-trigger.html?token=MgF-7x9K2pL4qR8vN3mB6cT1yE5wH0zA&bypass=true`
4. Verify correct tier detection and email formatting

## Example Scenarios

### Scenario 1: Minor Delay (3 days overdue)
- **Action:** None (grace period)
- **Reasoning:** Allow flexibility for minor delays

### Scenario 2: Moderate Delay (10 days overdue)
- **Tier:** 1 (Weekly gray badge)
- **Email:** Monday only - "📌 Low Priority - Overdue by 10 day(s)"
- **Reasoning:** Gentle reminder without overwhelming user

### Scenario 3: Aging Task (20 days overdue)
- **Tier:** 2 (Weekly orange badge)
- **Email:** Monday only - "⚠️ Low Priority - Aging by 20 day(s)"
- **Reasoning:** Warning that task needs attention soon

### Scenario 4: Forgotten Task (40 days overdue)
- **Tier:** 3 (Daily red badge)
- **Email:** Daily - "🚨 ATTENTION REQUIRED - Critically overdue by 40 day(s)"
- **Reasoning:** Task likely forgotten, needs immediate attention

## Related Documentation

- `.github/OPERATIONS_MANUAL.md` - Full operational procedures
- `.github/ROLLBACK_PROCEDURE.md` - Emergency rollback procedures
- `.github/mistakes.md` - Historical context and lessons learned
- `.github/PRODUCTION_CERTIFICATION.md` - System readiness assessment

## Success Metrics

**How to measure effectiveness:**
1. Reduction in 30+ day overdue Low priority tasks
2. No increase in "notification fatigue" complaints
3. Email quota stays under 150/month (75% threshold)
4. Low priority tasks completed before reaching Tier 3 (30+ days)

**Expected outcome:**
Low priority tasks addressed within 7-29 days (weekly reminders sufficient), rarely reaching 30+ days (daily reminders).

---

**Deployed:** December 1, 2025  
**Production Status:** Live at https://magnaflow-07sep25.web.app  
**Security:** Token-protected, read-only operation  
**Rollback Time:** 30 seconds (feature flag disable)
