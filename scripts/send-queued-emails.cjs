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
const admin = require('firebase-admin');
const { createTransport, sendNotification } = require('./lib/mailer.cjs');

const DRY_RUN = process.argv.includes('--dry-run');

// A single run should never be able to empty a day's Gmail allowance. Anything
// left over is picked up by the next run a few minutes later.
const MAX_PER_RUN = 100;
// After this many failures a message is parked rather than retried forever —
// a permanently bad address would otherwise be attempted on every run.
const MAX_ATTEMPTS = 3;

function buildCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      return admin.credential.cert(JSON.parse(json));
    } catch (error) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON:', error.message);
      process.exit(2);
    }
  }
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }
  console.error(
    'No Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON, or all three of\n' +
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
  );
  process.exit(2);
}

async function main() {
  admin.initializeApp({ credential: buildCredential() });
  const db = admin.firestore();

  const snap = await db
    .collection('mail_queue')
    .where('status', '==', 'pending')
    .orderBy('requestedAt', 'asc')
    .limit(MAX_PER_RUN)
    .get();

  if (snap.empty) {
    console.log('Queue is empty, nothing to send.');
    return;
  }

  console.log(`${snap.size} queued email(s)${DRY_RUN ? ' (dry run, nothing will be sent)' : ''}`);

  if (DRY_RUN) {
    for (const doc of snap.docs) {
      const d = doc.data();
      console.log(`  would send to ${d.to_email} — ${d.notification_type}: ${d.title}`);
    }
    console.log('\nDry run complete. No mail sent, queue untouched.');
    return;
  }

  const transport = createTransport();
  let sent = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    try {
      await sendNotification(transport, data);
      await doc.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        error: admin.firestore.FieldValue.delete(),
      });
      sent += 1;
      console.log(`  sent to ${data.to_email} — ${data.title}`);
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
      console.error(
        `  FAILED for ${data.to_email} (attempt ${attempts}${giveUp ? ', giving up' : ''}): ${error?.message}`
      );
    }
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
  // A single bad address should not turn the whole run red; a run where nothing
  // got through should.
  if (sent === 0 && failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Queue drain failed:', error);
  process.exit(1);
});
