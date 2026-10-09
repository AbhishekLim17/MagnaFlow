# Email-to-task

Forward or send an email to a project's address and it becomes a task in that project,
assigned to you. It runs on the free plan. The 15-minute mail job reads the app's own Gmail
mailbox: the one in the `GMAIL_USER` secret that already sends the notifications.

## How it works

- Each project can have an address on that mailbox, built with Gmail's plus addressing:
  `yourmailbox+<random key>@gmail.com`. Gmail delivers it to the same inbox.
- Every 15 minutes, `scripts/send-queued-emails.cjs` reads the unread mail sent to a plus
  address (`scripts/lib/inbound.cjs`). For each message it checks four things:
  - the key belongs to a project (`inbound_keys/{key}`) of an organisation that is not suspended;
  - Gmail authenticated the sender (SPF or DKIM pass, DMARC not failing), so a forged
    "From" line is not enough;
  - the sender's address belongs to an active member of that organisation;
  - that member may add tasks to the project: an org admin, a member of the project, or the
    head of its department.
- If all four hold, it creates the task:
  - the title is the subject, with any "Fwd:" or "Re:" removed;
  - the description is the new text, without quoted replies or the signature;
  - it is assigned to the sender and dated now.
- The sender then gets a "Task created from your email" message with a link to the task.
- Every message it reads is marked as read, whether or not it became a task. A message read
  twice still makes only one task.

## Turn it on

1. **Gmail:** IMAP is on by default for personal Gmail accounts. If you use Google Workspace,
   enable IMAP in the admin console. The existing App Password (`GMAIL_APP_PASSWORD`) also
   works for IMAP.
2. **GitHub repository variables** (Settings → Secrets and variables → Actions → *Variables*):
   - `INBOUND_EMAIL` = `on`. This makes the mail job read the mailbox.
   - `VITE_INBOUND_MAILBOX` = the Gmail address in `GMAIL_USER`. This makes the app show
     project addresses. It is not a secret.
3. Deploy (push to `main`), so the app is rebuilt with the variable.
4. In **Departments & Projects**, an org admin clicks **Turn on email-in** on a project and
   copies its address. **Turn off** retires that address for good; turning it on again makes
   a new one.

## Limits

- At most 50 messages per run, and only messages under 2 MB are read.
- Attachments are not kept. File storage needs the paid plan.
- Mail from people outside the organisation is ignored. That includes clients: they use
  **Client Requests** in the portal instead.
