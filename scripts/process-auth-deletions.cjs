#!/usr/bin/env node
/**
 * Deletes the leftover Firebase Auth accounts of users who were removed from
 * the portal.
 *
 * Why this exists: the app runs on the Firebase Spark plan, so there are no
 * Cloud Functions, and a browser client cannot delete another user's Auth
 * account — only the Admin SDK can. Removing someone from Staff Management
 * therefore deleted their Firestore profile but left their sign-in behind,
 * keeping their email address reserved and requiring a manual trip to the
 * Firebase console every time. This script closes that loop from CI.
 *
 * Contract: the app records each removal in `userDeletions/{uid}` with
 * `authCleanupDone: false`. This reads that queue, deletes the matching Auth
 * accounts, and marks each record done.
 *
 * Usage:
 *   node scripts/process-auth-deletions.cjs            # delete for real
 *   node scripts/process-auth-deletions.cjs --dry-run  # report only
 *
 * Credentials: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 * (as used by the other CI scripts), or a local service-account key file.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DRY_RUN = process.argv.includes('--dry-run');

function initAdmin() {
  // Prefer explicit env credentials (how CI supplies them).
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // GitHub secrets store newlines escaped.
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    return;
  }

  // Fall back to a local key file (see scripts/backup-firestore.cjs).
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const dirs = [
    process.env.MAGNAFLOW_SERVICE_ACCOUNT ? path.dirname(path.resolve(process.env.MAGNAFLOW_SERVICE_ACCOUNT)) : null,
    home ? path.join(home, '.magnaflow-secrets') : null,
    path.resolve(__dirname, '..'),
  ].filter(Boolean);

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const match = fs.readdirSync(dir).find((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'));
    if (match) {
      admin.initializeApp({ credential: admin.credential.cert(require(path.join(dir, match))) });
      return;
    }
  }

  console.error(
    'No credentials found. Set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY,\n' +
    'or place a service-account key in ~/.magnaflow-secrets/.'
  );
  process.exit(1);
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const auth = admin.auth();

  const pending = await db.collection('userDeletions').where('authCleanupDone', '==', false).get();

  if (pending.empty) {
    console.log('Nothing to clean up.');
    return { deleted: 0, skipped: 0, alreadyGone: 0 };
  }

  // Emails currently belonging to a live profile. A removed user may have been
  // re-added since (rehired, or the address reused) — deleting that sign-in
  // would lock out an ACTIVE user, so those records are skipped, not deleted.
  const users = await db.collection('users').get();
  const activeEmails = new Set(
    users.docs.map((d) => (d.data().email || '').toLowerCase()).filter(Boolean)
  );

  let deleted = 0, skipped = 0, alreadyGone = 0, failed = 0;

  for (const doc of pending.docs) {
    const rec = doc.data();
    const email = (rec.email || '').toLowerCase();
    const label = email || doc.id;

    if (!email) {
      console.warn(`SKIP ${doc.id}: record has no email`);
      skipped++;
      continue;
    }

    if (activeEmails.has(email)) {
      console.log(`SKIP ${label}: email is back in active use — not touching that sign-in`);
      if (!DRY_RUN) {
        await doc.ref.update({
          authCleanupDone: true,
          completedAt: admin.firestore.Timestamp.now(),
          resolvedNote: 'email back in active use (rehired) — auth account intentionally kept',
        });
      }
      skipped++;
      continue;
    }

    try {
      // Resolve by email rather than trusting the stored uid: if the account
      // was recreated, the uid will have changed.
      const authUser = await auth.getUserByEmail(email);

      if (DRY_RUN) {
        console.log(`WOULD DELETE ${label} (uid ${authUser.uid})`);
        deleted++;
        continue;
      }

      await auth.deleteUser(authUser.uid);
      await doc.ref.update({
        authCleanupDone: true,
        completedAt: admin.firestore.Timestamp.now(),
        resolvedNote: 'auth account deleted automatically',
      });
      console.log(`DELETED ${label}`);
      deleted++;
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log(`OK ${label}: auth account already gone`);
        if (!DRY_RUN) {
          await doc.ref.update({
            authCleanupDone: true,
            completedAt: admin.firestore.Timestamp.now(),
            resolvedNote: 'auth account already removed',
          });
        }
        alreadyGone++;
      } else {
        // Leave the record pending so the next run retries it.
        console.error(`FAILED ${label}: ${err.code || err.message}`);
        failed++;
      }
    }
  }

  console.log(
    `\n${DRY_RUN ? '[dry run] ' : ''}deleted: ${deleted}, skipped: ${skipped}, ` +
    `already gone: ${alreadyGone}, failed: ${failed}`
  );

  // Fail the CI job on unexpected errors so they're visible.
  if (failed > 0) process.exitCode = 1;
  return { deleted, skipped, alreadyGone, failed };
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error('Auth cleanup failed:', err);
    process.exit(1);
  });
