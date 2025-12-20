# EmailJS Template Setup for @Mention Notifications

## Template Information
- **Template ID**: `template_mention` (needs to be created)
- **Service ID**: `service_itwo1ee` (existing)
- **User ID**: `hQcLVOWsSrnSqnRWY` (existing)

## Template Parameters

The following parameters will be sent from the application:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `to_email` | Recipient's email address | john@magnetar.com |
| `to_name` | Recipient's display name | John Doe |
| `mentioned_by` | Name of user who mentioned | Jane Smith |
| `task_title` | Title of the task | Complete Q4 Report |
| `comment_text` | The comment text with @mention | @john can you review this? |
| `task_link` | Direct link to task | https://magnaflow-07sep25.web.app/tasks/task123 |
| `timestamp` | When comment was posted | 12/7/2025, 10:30:45 PM |

## Suggested Email Template (HTML)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: #f9f9f9;
    }
    .header {
      background: #4CAF50;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background: white;
      padding: 30px;
      border-radius: 0 0 5px 5px;
    }
    .comment-box {
      background: #f5f5f5;
      border-left: 4px solid #4CAF50;
      padding: 15px;
      margin: 20px 0;
      font-style: italic;
    }
    .button {
      display: inline-block;
      background: #4CAF50;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>💬 You were mentioned in a comment</h2>
    </div>
    <div class="content">
      <p>Hi {{to_name}},</p>
      
      <p><strong>{{mentioned_by}}</strong> mentioned you in a comment on:</p>
      
      <h3>📋 {{task_title}}</h3>
      
      <div class="comment-box">
        {{comment_text}}
      </div>
      
      <p style="text-align: center;">
        <a href="{{task_link}}" class="button">View Task & Reply</a>
      </p>
      
      <p style="font-size: 12px; color: #666;">
        Posted at: {{timestamp}}
      </p>
      
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      
      <p style="font-size: 14px; color: #666;">
        This is an automated notification from MagnaFlow Task Management System.
        To stop receiving these notifications, please update your preferences in your account settings.
      </p>
    </div>
    
    <div class="footer">
      <p>© 2025 Magnetar · MagnaFlow Task Management</p>
    </div>
  </div>
</body>
</html>
```

## Suggested Email Template (Plain Text)

```
Hi {{to_name}},

{{mentioned_by}} mentioned you in a comment on:

Task: {{task_title}}

Comment:
"{{comment_text}}"

View task and reply:
{{task_link}}

Posted at: {{timestamp}}

---
This is an automated notification from MagnaFlow Task Management System.
© 2025 Magnetar · MagnaFlow Task Management
```

## Setup Instructions

1. **Login to EmailJS Dashboard**
   - Go to: https://dashboard.emailjs.com/
   - Login with your credentials

2. **Create New Template**
   - Click "Email Templates" in sidebar
   - Click "Create New Template"
   - Template ID: `template_mention`
   - Template Name: "Task Mention Notification"

3. **Configure Template**
   - Subject: `{{mentioned_by}} mentioned you in "{{task_title}}"`
   - HTML Content: Paste the HTML template above
   - Plain Text: Paste the plain text template above

4. **Test Template**
   - Use "Test" button in EmailJS dashboard
   - Fill in sample values for all parameters
   - Send test email to verify formatting

5. **Update Service if Needed**
   - Existing service: `service_itwo1ee`
   - Verify service is connected to your email provider
   - Ensure monthly quota is sufficient (currently 189/200 emails remaining)

## Integration Notes

- The template is already integrated in `src/services/notificationService.js`
- Function: `sendEmailNotification()`
- Automatically called when user is @mentioned in a comment
- EmailJS API endpoint: `https://api.emailjs.com/api/v1.0/email/send`
- Rate limit: 200 emails per month (consider upgrading if needed)

## Testing

1. Create the template in EmailJS dashboard
2. Login to MagnaFlow as any user
3. Open `test-comment-services.html` to verify structure
4. Post a comment with @mention on a real task
5. Verify mentioned user receives email
6. Check email formatting and all links work

## Security Considerations

- ✅ Email only sent if user successfully authenticated
- ✅ Only mentioned users receive notifications (no spam)
- ✅ Self-mentions filtered out (users can't notify themselves)
- ✅ Rate limiting at EmailJS level prevents abuse
- ✅ Task links are direct and secure (Firebase Auth required)

## Future Enhancements

- [ ] Add email preference settings (allow users to opt-out)
- [ ] Group multiple mentions into digest email
- [ ] Add notification preview before sending
- [ ] Track email open rates (EmailJS Pro feature)
- [ ] Add unsubscribe link in footer
