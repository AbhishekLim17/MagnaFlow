# MagnaFlow Email System - Deployment Guide

## What Was Fixed

### 1. **Immediate Critical Task Emails** ✅
When a task's priority is changed to "Critical", an immediate email is now automatically sent to:
- **To:** Assigned staff member
- **CC:** Admin team (pankaj@magnetar.in, dhaval@magnetar.in, tejas@magnetar.in)

**File Modified:** `src/services/taskService.js`
- Added import for `sendCriticalTaskAlert`
- Enhanced `updateTask()` function to detect priority changes
- Automatically fetches user email from Firestore and sends alert

### 2. **Daily 8 AM IST Reminders** ✅
Created Cloud Function that runs every day at 8:00 AM IST to send reminders for all critical incomplete tasks.

**Files Created:**
- `functions/index.js` - Cloud Function with scheduled cron job
- `functions/package.json` - Dependencies for Firebase Functions
- `functions/.gitignore` - Ignore node_modules

**Features:**
- Queries all critical tasks where status ≠ completed
- Sends reminder emails to assigned staff + CC admin
- Includes "Days Pending" calculation
- Rate limiting (500ms delay between emails)
- Error logging to Firestore `email_logs` collection
- Manual test trigger available

### 3. **Email Configuration Enhanced** ✅
**File Modified:** `src/config/emailConfig.js`
- Added `ADMIN_EMAILS` constant
- Added comment about private key setup for Cloud Functions

---

## Deployment Steps

### Step 1: Install Cloud Function Dependencies
```powershell
cd a:\Alpha\WORK\Magnetar\MagnaFlow\functions
npm install
```

### Step 2: Configure EmailJS Private Key
You need to get your EmailJS private key and set it in Firebase Functions config:

1. **Get Private Key from EmailJS:**
   - Go to https://dashboard.emailjs.com/admin/account
   - Find your Private Key (different from Public Key)

2. **Set Firebase Config:**
   ```powershell
   firebase functions:config:set emailjs.service_id="service_itwo1ee"
   firebase functions:config:set emailjs.template_id="template_mwmmgmi"
   firebase functions:config:set emailjs.public_key="sLvBE12fOqa4zsra-"
   firebase functions:config:set emailjs.private_key="YOUR_PRIVATE_KEY_HERE"
   ```

3. **Verify Config:**
   ```powershell
   firebase functions:config:get
   ```

### Step 3: Deploy Cloud Function
```powershell
cd a:\Alpha\WORK\Magnetar\MagnaFlow
firebase deploy --only functions
```

This will deploy:
- `sendDailyCriticalTaskReminders` - Scheduled for 8 AM IST daily
- `testDailyCriticalTaskReminders` - HTTP endpoint for manual testing

### Step 4: Test the Cloud Function Manually
After deployment, test immediately without waiting for 8 AM:

```powershell
# Get the function URL from deployment output, then test via browser or curl
# Or use Firebase Console: Functions > testDailyCriticalTaskReminders > Test
```

### Step 5: Monitor Logs
```powershell
firebase functions:log
```

---

## Testing Immediate Critical Emails

1. Open MagnaFlow app: https://magnaflow-07sep25.web.app
2. Create or edit a task
3. Change priority to "Critical"
4. Check the assigned user's email (should receive immediate alert)
5. Check admin emails (should be CC'd)

---

## Email Logs

All email attempts are logged to Firestore collection `email_logs`:
```javascript
{
  type: 'critical_reminder' | 'critical_alert',
  taskId: 'task_id',
  recipientEmail: 'user@example.com',
  status: 'sent' | 'failed',
  timestamp: Timestamp,
  error: null | 'error message'
}
```

---

## Troubleshooting

### Problem: Emails not sending
**Solution:**
1. Check EmailJS dashboard quota (free tier = 200 emails/month)
2. Verify private key is set correctly: `firebase functions:config:get`
3. Check function logs: `firebase functions:log`

### Problem: Function not scheduled
**Solution:**
1. Ensure Cloud Scheduler API is enabled in Google Cloud Console
2. Check Firebase Console > Functions > Scheduled Functions
3. Verify timezone: `Asia/Kolkata`

### Problem: User email not found
**Solution:**
- Verify `users` collection exists in Firestore
- Ensure user documents have `email` field
- Check `assignedTo` field in tasks matches user document ID

---

## Email Rate Limiting

- Free EmailJS tier: **200 emails/month**
- Cloud Function adds 500ms delay between emails to avoid rate limiting
- For 20 critical tasks, total execution time ≈ 10 seconds

---

## Next Steps

1. ✅ Deploy the Cloud Function
2. ✅ Set EmailJS private key in Firebase config
3. ✅ Test immediate critical task emails
4. ✅ Test manual trigger for daily reminders
5. ⏰ Wait for 8:00 AM IST to verify scheduled execution
6. 📊 Monitor email_logs collection for delivery status

---

## Email Template Structure

The EmailJS template (`template_mwmmgmi`) must have these variables:
- `to_email`, `to_name`, `cc_email`
- `notification_type`, `notification_icon`, `notification_color`
- `title`, `message`
- `detail_1_label` through `detail_5_label`
- `detail_1_value` through `detail_5_value`
- `button_text`, `button_link`
- `footer_text`

---

## Support

If issues persist:
1. Check Firebase Console > Functions for errors
2. Review Firestore `email_logs` collection
3. Verify EmailJS dashboard for delivery status
4. Check user has valid email in Firestore `users` collection
