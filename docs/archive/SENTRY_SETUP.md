# Sentry Setup Guide for MagnaFlow

## ✅ What's Been Implemented

Sentry error monitoring has been successfully integrated into MagnaFlow. Here's what's included:

### Files Created/Modified:
- ✅ `src/config/sentry.js` - Complete Sentry configuration
- ✅ `src/main.jsx` - Sentry initialization
- ✅ `src/App.jsx` - ErrorBoundary integration + user context tracking
- ✅ `.env.local` & `.env.production` - Environment variable setup
- ✅ Package installed: `@sentry/react`

### Features Implemented:
- ✅ Automatic error capturing and reporting
- ✅ User context tracking (email, role, user ID)
- ✅ Custom error boundary with user-friendly UI
- ✅ Performance monitoring for Firebase queries
- ✅ Breadcrumb tracking for user actions
- ✅ Session replay (10% of normal sessions, 100% of error sessions)
- ✅ Development mode bypass (no tracking in dev)
- ✅ Error filtering (browser extensions, timeouts)

---

## 🚀 Next Steps: Complete Sentry Setup

### Step 1: Create Sentry Account (5 minutes)

1. Go to **https://sentry.io**
2. Click "Get Started" and create a free account
3. Choose "React" as your platform
4. Create a new project named "MagnaFlow"

### Step 2: Get Your Sentry DSN

1. After creating the project, you'll see a DSN (Data Source Name)
2. It looks like: `https://examplePublicKey@o0.ingest.sentry.io/0`
3. Copy this DSN

### Step 3: Add DSN to Environment Variables

Update both files with your actual Sentry DSN:

**`.env.local`** (for development):
```env
VITE_SENTRY_DSN=https://your-actual-sentry-dsn@sentry.io/your-project-id
```

**`.env.production`** (for production):
```env
VITE_SENTRY_DSN=https://your-actual-sentry-dsn@sentry.io/your-project-id
```

### Step 4: Test in Development

Even though Sentry is disabled in dev mode, you can force test it:

1. Temporarily modify `src/config/sentry.js`:
   ```javascript
   // Change this line:
   const isProduction = import.meta.env.PROD;
   // To this:
   const isProduction = true; // Force enable for testing
   ```

2. Run dev server:
   ```bash
   npm run dev
   ```

3. Create a test error (add this button somewhere):
   ```jsx
   <button onClick={() => { throw new Error('Test Sentry Error!'); }}>
     Test Error
   </button>
   ```

4. Click the button - error should appear in Sentry dashboard
5. **Remove the test changes** after verification

### Step 5: Deploy to Production

```bash
npm run build
firebase deploy
```

### Step 6: Configure Sentry Alerts (10 minutes)

1. Go to **Sentry Dashboard** > **Alerts**
2. Create "Issue Alert" with these rules:
   - **When**: "An event is seen"
   - **If**: "The issue is first seen"
   - **Then**: "Send a notification via Email"
3. Create another alert:
   - **When**: "An event is seen more than 10 times in 1 hour"
   - **Then**: "Send notification to Email + Slack (optional)"

### Step 7: Set Up Slack Integration (Optional, 5 minutes)

1. Go to **Sentry Dashboard** > **Settings** > **Integrations**
2. Search for "Slack" and click "Install"
3. Connect your workspace
4. Choose channel for alerts (e.g., #magnaflow-errors)

---

## 📊 How to Use Sentry

### View Errors
1. Go to **Sentry Dashboard** > **Issues**
2. You'll see all errors with:
   - Stack traces
   - User context (email, role)
   - Breadcrumbs (what user did before error)
   - Browser info, OS, device

### Performance Monitoring
1. Go to **Performance** tab
2. See slowest Firebase queries
3. Identify performance bottlenecks

### Session Replay
1. Click on any error
2. If session replay captured it, click "Replay" tab
3. Watch exactly what user did before error occurred

---

## 🧪 Testing Sentry Integration

### Test 1: Manual Error
```javascript
import { captureException } from '@/config/sentry';

try {
  // Your code
} catch (error) {
  captureException(error, { context: 'Task creation failed' });
}
```

### Test 2: Breadcrumb Tracking
```javascript
import { addBreadcrumb } from '@/config/sentry';

addBreadcrumb('User clicked Create Task button', 'user', {
  taskTitle: 'New Task'
});
```

### Test 3: Performance Tracking
```javascript
import { measureFirebaseQuery } from '@/config/sentry';

const tasks = await measureFirebaseQuery('fetch-all-tasks', async () => {
  return await getAllTasks();
});
```

---

## 🎯 What Sentry Will Catch

Sentry is now monitoring for:

✅ **JavaScript Errors**
- Unhandled promise rejections
- Runtime errors
- Component render errors

✅ **Network Errors** (except timeouts)
- Failed Firebase requests
- API call failures

✅ **User Context**
- Who encountered the error (email, role)
- What they were doing (breadcrumbs)
- Their environment (browser, OS)

✅ **Performance Issues**
- Slow Firebase queries
- Long component render times
- Network latency

---

## 🔒 Security & Privacy

- ❌ **Sentry DSN is NOT secret** - it's safe to include in client code
- ✅ **No sensitive data captured** - passwords, tokens filtered out
- ✅ **User emails tracked** for context (can be disabled if needed)
- ✅ **Session replay** - only captures 10% of sessions
- ✅ **GDPR compliant** - users can request data deletion

---

## 📈 Expected Results

After deployment, you'll see:

### Week 1:
- Initial errors from production
- Most common issues surface
- Quick fixes deployed

### Week 2:
- Error rate drops as bugs fixed
- Performance bottlenecks identified
- Session replay shows UX issues

### Ongoing:
- Near-zero critical errors
- Immediate alerts for new issues
- Historical data for trends

---

## 💰 Sentry Pricing

**Free Tier Includes:**
- 5,000 errors/month
- 10,000 performance transactions/month
- 50 session replays/month
- 1 team member
- 90-day data retention

**Paid Plans Start at $26/month** (if you exceed free tier)

For MagnaFlow's current usage, **free tier should be sufficient** for 6+ months.

---

## 🆘 Troubleshooting

### "Sentry not capturing errors"
1. Check `.env.production` has correct DSN
2. Verify `VITE_SENTRY_DSN` starts with `https://`
3. Rebuild: `npm run build`
4. Redeploy: `firebase deploy`

### "Too many Sentry errors"
1. Reduce sample rate in `src/config/sentry.js`:
   ```javascript
   tracesSampleRate: 0.05, // From 0.1 to 0.05 (5%)
   ```

### "Want to disable Sentry temporarily"
1. Remove `VITE_SENTRY_DSN` from `.env.production`
2. Rebuild and redeploy

---

## ✅ Current Status

- ✅ Sentry integrated in code
- ⏳ Waiting for Sentry DSN configuration
- ⏳ Waiting for production deployment
- ⏳ Waiting for first errors to be captured

**Once you add the Sentry DSN and deploy, error monitoring will be live!**

---

## 📚 Additional Resources

- **Sentry Docs**: https://docs.sentry.io/platforms/javascript/guides/react/
- **Best Practices**: https://docs.sentry.io/product/best-practices/
- **React Integration**: https://docs.sentry.io/platforms/javascript/guides/react/features/

---

**Need help setting up Sentry? Just ask!**
