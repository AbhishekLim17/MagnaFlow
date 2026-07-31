# 📧 EmailJS Setup Guide for MagnaFlow

This guide will help you set up email notifications for task assignments, completions, and alerts.

---

## 🚀 Step 1: Create EmailJS Account

1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Click **"Sign Up"** (free tier: 200 emails/month)
3. Verify your email address
4. Log in to your dashboard

---

## ⚙️ Step 2: Create Email Service

1. In EmailJS dashboard, click **"Add New Service"**
2. Choose your email provider:
   - **Gmail** (recommended for testing)
   - **Outlook**
   - **Yahoo**
   - Or use their default service
3. Click **"Connect Account"** and authorize access
4. Copy your **Service ID** (looks like: `service_abc123`)

---

## 📝 Step 3: Create Email Templates

Create 4 email templates for different notifications:

### Template 1: Task Assigned Notification

1. Click **"Email Templates"** → **"Create New Template"**
2. **Template Name:** `Task Assigned Notification`
3. **Template Content:**

```
Subject: 🎯 New Task Assigned: {{task_title}}

Hi {{to_name}},

You have been assigned a new task:

📋 Task: {{task_title}}
📝 Description: {{task_description}}
⚡ Priority: {{task_priority}}
📅 Due Date: {{due_date}}
👤 Assigned by: {{assigned_by}}

Please log in to the portal to view details and start working on this task.

🔗 Portal URL: {{portal_url}}

Best regards,
MagnaFlow Team
```

4. Save and copy the **Template ID** (looks like: `template_xyz789`)

### Template 2: Task Completed Notification

1. Create another template
2. **Template Name:** `Task Completed Notification`
3. **Template Content:**

```
Subject: ✅ Task Completed: {{task_title}}

Hi {{to_name}},

A task has been completed:

📋 Task: {{task_title}}
👤 Completed by: {{completed_by}}
📅 Completion Date: {{completion_date}}

Log in to the portal to review the completed task.

🔗 Portal URL: {{portal_url}}

Best regards,
MagnaFlow Team
```

4. Save and copy the **Template ID**

### Template 3: Task Status Changed

1. Create another template
2. **Template Name:** `Task Status Changed`
3. **Template Content:**

```
Subject: 🔄 Task Status Updated: {{task_title}}

Hi {{to_name}},

A task status has been updated:

📋 Task: {{task_title}}
📊 Old Status: {{old_status}}
📊 New Status: {{new_status}}
👤 Changed by: {{changed_by}}

Log in to the portal for more details.

🔗 Portal URL: {{portal_url}}

Best regards,
MagnaFlow Team
```

4. Save and copy the **Template ID**

### Template 4: Critical Task Alert

1. Create another template
2. **Template Name:** `Critical Task Alert`
3. **Template Content:**

```
Subject: 🚨 CRITICAL TASK ALERT: {{task_title}}

Hi {{to_name}},

⚠️ URGENT: You have been assigned a CRITICAL PRIORITY task!

📋 Task: {{task_title}}
📝 Description: {{task_description}}
📅 Due Date: {{due_date}}
👤 Assigned by: {{assigned_by}}

This task requires immediate attention. Please log in to the portal NOW.

🔗 Portal URL: {{portal_url}}

Best regards,
MagnaFlow Team
```

4. Save and copy the **Template ID**

---

## 🔑 Step 4: Get Your Public Key

1. In EmailJS dashboard, click **"Account"** (top right)
2. Go to **"General"** tab
3. Copy your **Public Key** (looks like: `abcdef123456`)

---

## 💻 Step 5: Configure MagnaFlow

Open `src/services/emailService.js` and replace the placeholders:

```javascript
const EMAILJS_CONFIG = {
  serviceId: 'service_abc123', // Your Service ID from Step 2
  templateIds: {
    taskAssigned: 'template_xyz789', // Template 1 ID
    taskCompleted: 'template_abc456', // Template 2 ID
    taskStatusChanged: 'template_def789', // Template 3 ID
    criticalTask: 'template_ghi012', // Template 4 ID
  },
  publicKey: 'abcdef123456', // Your Public Key from Step 4
};
```

---

## ✅ Step 6: Test Email Notifications

1. Save the configuration file
2. Rebuild and deploy: `npm run build` → `firebase deploy`
3. In the portal, try:
   - ✉️ Assign a task to a staff member (check their email)
   - ✉️ Mark a task as completed (check admin email)
   - ✉️ Change task status (check assigned user email)
   - ✉️ Assign a CRITICAL priority task (check user email)

---

## 📊 Email Quota

**Free Tier:**
- ✅ 200 emails/month
- ✅ No credit card required
- ✅ Perfect for small teams

**If you need more:**
- Upgrade to paid plan ($8/month for 1,000 emails)
- Or use SendGrid, AWS SES, etc.

---

## 🐛 Troubleshooting

### Emails not sending?
1. Check browser console for errors
2. Verify Service ID, Template IDs, and Public Key are correct
3. Make sure your email service is connected in EmailJS dashboard
4. Check EmailJS dashboard logs for failed sends

### Template variables not working?
- Make sure variable names in template match exactly: `{{to_name}}` not `{{name}}`
- Variables are case-sensitive

### Gmail blocking emails?
- Enable "Less secure app access" in Gmail settings
- Or use EmailJS's default service instead

---

## 🎉 Done!

Your email notification system is now configured! Users will receive emails for:
- 🎯 New task assignments
- ✅ Task completions
- 🔄 Status changes
- 🚨 Critical task alerts

**Total setup time: ~15 minutes** ⚡

---

## 📞 Need Help?

- EmailJS Docs: https://www.emailjs.com/docs/
- EmailJS Support: https://www.emailjs.com/support/
