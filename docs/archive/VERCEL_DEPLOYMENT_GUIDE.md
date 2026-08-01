# Vercel Deployment Guide - Automatic 8 AM Reminders

## ✅ What's Been Set Up:

### Files Created:
1. **`/api/send-reminders.js`** - Vercel serverless function that sends daily reminders
2. **`vercel.json`** - Cron configuration (runs at 8:00 AM IST daily)
3. **`package.json`** - Updated with required dependencies

---

## 🚀 Deployment Steps:

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Deploy Project
```bash
cd a:\Alpha\WORK\Magnetar\MagnaFlow
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account
- **Link to existing project?** → No (first time)
- **Project name?** → magnaflow (or your choice)
- **Directory?** → ./ (current directory)
- **Override settings?** → No

### Step 4: Set Environment Variables

Go to Vercel Dashboard: https://vercel.com/dashboard

1. Select your project
2. Go to **Settings** → **Environment Variables**
3. Add these variables (for **Production**, **Preview**, and **Development**):

```
FIREBASE_PROJECT_ID = magnaflow-07sep25
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-xxxxx@magnaflow-07sep25.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----
EMAILJS_PUBLIC_KEY = sLvBE12fOqa4zsra-
EMAILJS_PRIVATE_KEY = <set EMAILJS_PRIVATE_KEY as a repository secret>
EMAILJS_SERVICE_ID = service_itwo1ee
EMAILJS_TEMPLATE_ID = template_mwmmgmi
CRON_SECRET = YOUR_RANDOM_SECRET_STRING_HERE
```

**Important Notes:**
- For `FIREBASE_PRIVATE_KEY`: Keep the `\n` characters (they represent newlines)
- For `CRON_SECRET`: Generate a random string like `abc123xyz789secretkey`

---

## 🔑 Get Firebase Admin Credentials:

### Option A: From Firebase Console
1. Go to: https://console.firebase.google.com/project/magnaflow-07sep25/settings/serviceaccounts/adminsdk
2. Click **Generate New Private Key**
3. Download the JSON file
4. Extract these values:
   - `project_id` → FIREBASE_PROJECT_ID
   - `client_email` → FIREBASE_CLIENT_EMAIL
   - `private_key` → FIREBASE_PRIVATE_KEY

### Option B: I'll Help You Get It
Run this command and share the output (I'll help extract the values):
```bash
firebase projects:list
```

---

## ⏰ Cron Schedule Explained:

**Current Setting:** `30 2 * * *`
- This means: **2:30 AM UTC = 8:00 AM IST**

Cron Format: `minute hour day month dayOfWeek`
- `30` = 30th minute
- `2` = 2 AM (UTC)
- `*` = Every day
- `*` = Every month
- `*` = Every day of week

**IST is UTC+5:30**, so:
- 2:30 AM UTC = 8:00 AM IST ✅

---

## 🧪 Testing the Cron Job:

### Manual Test (Before Production):
After deploying, you can test the endpoint manually:

```bash
curl -X POST https://your-project.vercel.app/api/send-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Daily reminders sent",
  "total": 5,
  "sent": 5,
  "failed": 0
}
```

---

## 📊 Monitoring:

### View Logs in Vercel:
1. Go to Vercel Dashboard
2. Select your project
3. Click **Logs** tab
4. Filter by `/api/send-reminders`

### View in Firestore:
Check the `reminder_logs` collection:
- Document ID = Date (YYYY-MM-DD)
- Shows: total tasks, sent count, execution time, results

---

## 🎯 How It Works:

```
8:00 AM IST (2:30 AM UTC)
        ↓
Vercel Cron Triggers
        ↓
/api/send-reminders runs
        ↓
Checks: "Already sent today?"
        ↓
    [YES] → Skip
        ↓
    [NO] → Query Firestore for critical tasks
        ↓
   Send emails (500ms delay between each)
        ↓
   Save log to Firestore
        ↓
   Return success response
```

---

## ✅ Advantages of This Solution:

- ✅ **100% Automatic** - Runs at 8 AM every day without needing anyone to login
- ✅ **100% FREE** - Vercel free tier includes cron jobs
- ✅ **Reliable** - Never misses a day
- ✅ **Logged** - Every execution tracked in Firestore
- ✅ **Secure** - Authorization token required
- ✅ **Professional** - Real scheduled jobs, not dependent on user logins

---

## 🔒 Security:

The cron endpoint is protected by:
1. **Authorization Header**: Must include `Bearer YOUR_CRON_SECRET`
2. **Environment Variables**: Credentials stored securely in Vercel
3. **HTTPS Only**: All communication encrypted

---

## 📝 Next Steps:

1. ✅ Get Firebase Admin credentials
2. ✅ Deploy to Vercel
3. ✅ Add environment variables
4. ✅ Test the endpoint manually
5. ✅ Wait for 8 AM tomorrow to verify automatic execution
6. ✅ Check logs in Vercel and Firestore

---

## 🆘 Need Help?

If you encounter issues:
1. Check Vercel logs for errors
2. Verify all environment variables are set
3. Test the endpoint manually
4. Check Firestore `reminder_logs` collection

**Let me know when you're ready to deploy, and I'll guide you through each step!** 🚀
