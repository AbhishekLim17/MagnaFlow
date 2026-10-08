/**
 * Deliver everything sitting in the `mail_queue` collection through Gmail.
 *
 * The browser queues an email instead of sending one, because a browser cannot
 * speak SMTP and the relay that used to bridge that gap required a sending
 * credential in client code. This job is the other half: it runs in GitHub
 * Actions, where the Gmail App Password is a repository secret.
 *
 * Runs on a schedule and can be triggered by hand with a dry run.
 *
 *   node scripts/send-queued-emails.cjs [--dry-run]
 */
const path = require('path');
const { pathToFileURL } = require('url');
const admin = require('firebase-admin');
const { initAdmin } = require('./lib/admin.cjs');
const { createTransport, sendNotification } = require('./lib/mailer.cjs');
const { createTenantLookup, safeButtonLink } = require('./lib/tenant.cjs');
const { sendClientUpdates, sendRequestUpdates } = require('./lib/clientUpdates.cjs');
const { sendPush } = require('./lib/push.cjs');

const DRY_RUN = process.argv.includes('--dry-run');

// A single run should never be able to empty a day's Gmail allowance. Anything
// left over is picked up by the next run a few minutes later.
const MAX_PER_RUN = 100;
// After this many failures a message is parked rather than retried forever —
// a permanently bad address would otherwise be attempted on every run.
const MAX_ATTEMPTS = 3;

async function main() {
  initAdmin();
  const db = admin.firestore();
  const tenant = createTenantLookup(db);
  // The same rules the settings screen describes.
  const { wantsEmail } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'notificationPrefs.js')).href);

  // Made on first use, so a run with nothing to send needs no mail credentials.
  let transport = null;
  const getTransport = () => (transport ||= createTransport());
  const queue = await drainQueue(db, tenant, getTransport, wantsEmail);

  // Then the client portal: tell the other side about new conversation messages and requests.
  const portalDeps = (source) => ({
    db, admin, tenant, wantsEmail,
    transport: null,
    send: (_unused, mail) => sendNotification(getTransport(), mail),
    dryRun: DRY_RUN,
    log: (mail, orgId, status) => logEmail(db, null, { ...mail, source }, orgId, status),
  });
  const conv = await sendClientUpdates(portalDeps('client_conversation'));
  if (conv.messages) {
    console.log(`Client conversation: ${conv.messages} message(s), sent ${conv.sent}, skipped ${conv.skipped}, failed ${conv.failed}.`);
  }
  const reqs = await sendRequestUpdates(portalDeps('client_request'));
  if (reqs.requests) {
    console.log(`Client requests: ${reqs.requests} update(s), sent ${reqs.sent}, skipped ${reqs.skipped}, failed ${reqs.failed}.`);
  }

  // A single bad address should not turn the whole run red; a run where nothing
  // got through should.
  const sentAll = queue.sent + conv.sent + reqs.sent;
  const failedAll = queue.failed + conv.failed + reqs.failed;
  if (!DRY_RUN && sentAll === 0 && failedAll > 0) process.exit(1);
}

async function drainQueue(db, tenant, getTransport, wantsEmail) {
  const snap = await db
    .collection('mail_queue')
    .where('status', '==', 'pending')
    .orderBy('requestedAt', 'asc')
    .limit(MAX_PER_RUN)
    .get();

  if (snap.empty) {
    console.log('Queue is empty, nothing to send.');
    return { sent: 0, failed: 0 };
  }

  console.log(`${snap.size} queued email(s)${DRY_RUN ? ' (dry run, nothing will be sent)' : ''}`);

  let sent = 0;
  let failed = 0;
  let rejected = 0;
  let optedOut = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    // The queue is written by browsers, so nothing in it is trusted. A message
    // is only delivered when it is tied to a real task and its recipient is an
    // active member of that task's organization; the CC list and the button
    // target are replaced with server-side values.
    const verdict = await verify(tenant, data);
    if (!verdict.ok) {
      rejected += 1;
      console.warn(`  REJECTED (${verdict.reason}) for recipient ${data.recipientUid || '(none)'}`);
      if (!DRY_RUN) {
        await doc.ref.update({
          status: 'rejected',
          error: verdict.reason,
          lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      continue;
    }

    // The recipient turned this kind of email off (in-app notifications still happen).
    if (!wantsEmail(verdict.recipient.prefs, data.type)) {
      optedOut += 1;
      console.log(`  skipped (recipient turned off ${data.type || 'this'} emails)`);
      if (!DRY_RUN) {
        await doc.ref.update({
          status: 'skipped',
          error: 'recipient turned this kind of email off',
          lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      continue;
    }

    const payload = {
      ...data,
      to_email: verdict.recipient.email,
      to_name: verdict.recipient.name,
      cc_email: verdict.cc,
      button_link: safeButtonLink(data.button_link),
    };

    if (DRY_RUN) {
      console.log(`  would send to ${payload.to_email} — ${payload.notification_type}: ${payload.title}`);
      continue;
    }

    try {
      await sendNotification(getTransport(), payload);
      // and to the devices they turned push on for (best-effort)
      await sendPush({ db, admin }, data.recipientUid, { title: payload.title, body: payload.message, link: payload.button_link });
      await doc.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        error: admin.firestore.FieldValue.delete(),
      });
      await logEmail(db, doc.id, payload, verdict.orgId, 'sent');
      sent += 1;
      console.log(`  sent to ${payload.to_email} — ${payload.title}`);
    } catch (error) {
      failed += 1;
      const attempts = (data.attempts || 0) + 1;
      const giveUp = attempts >= MAX_ATTEMPTS;
      await doc.ref.update({
        attempts,
        // Parked, not deleted: a failed notification is still a record that
        // someone was supposed to be told something.
        status: giveUp ? 'failed' : 'pending',
        error: String(error?.message || error).slice(0, 500),
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (giveUp) await logEmail(db, doc.id, payload, verdict.orgId, 'failed', error);
      console.error(
        `  FAILED for ${payload.to_email} (attempt ${attempts}${giveUp ? ', giving up' : ''}): ${error?.message}`
      );
    }
  }

  if (DRY_RUN) {
    console.log('\nDry run complete. No mail sent, queue untouched.');
    return { sent: 0, failed: 0 };
  }
  console.log(`\nDone. Sent ${sent}, failed ${failed}, rejected ${rejected}, turned off by the recipient ${optedOut}.`);
  return { sent, failed };
}

async function verify(tenant, data) {
  if (!data.recipientUid) return { ok: false, reason: 'no recipient (legacy queue entry)' };
  if (!data.taskId) return { ok: false, reason: 'no task reference' };
  const task = await tenant.getTask(data.taskId);
  if (!task) return { ok: false, reason: 'task no longer exists' };
  // The address is looked up here, never taken from the browser.
  const recipient = await tenant.resolveRecipient(data.recipientUid, task.orgId);
  if (!recipient) {
    return { ok: false, reason: 'recipient is not an active member of the task organization' };
  }
  return { ok: true, orgId: task.orgId ?? null, cc: await tenant.ccFor(task.orgId), recipient };
}

// The delivery record the browser used to try (and fail, under the rules) to
// write itself. The server is the only party that knows what actually happened.
async function logEmail(db, mailId, data, orgId, status, error) {
  const now = new Date();
  try {
    await db.collection('email_logs').add({
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      type: data.type || 'generic',
      recipient: data.to_email,
      taskId: data.taskId || null,
      orgId: orgId ?? null,
      mailId,
      status,
      monthYear: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      source: data.source || 'manual',
      notificationType: data.notification_type || null,
      error: error ? String(error.message || error).slice(0, 500) : null,
    });
  } catch (logError) {
    console.warn('Could not write email log:', logError?.message);
  }
}

main().catch((error) => {
  console.error('Queue drain failed:', error);
  process.exit(1);
});
