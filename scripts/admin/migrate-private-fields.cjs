#!/usr/bin/env node
/**
 * Move billing details, the seat counter and project budgets to where the
 * security rules protect them.
 *
 *   organizations/{id}   billingEmail, ccEmails, seatLimit, storageQuotaMB
 *        -> organizations/{id}/private/settings        (org-admin + master-admin)
 *   (new)                seat counter
 *        -> organizations/{id}/meta/seats              (see seatBump in the rules)
 *   projects/{id}        budget, currency, budgetNotes
 *        -> projects/{id}/finance/budget               (org-admin, project manager, dept head)
 *
 * The organization and project documents are readable by every member (clients
 * included), which is why these fields had to move.
 *
 *   node scripts/admin/migrate-private-fields.cjs --key ./sa.json                # dry run
 *   node scripts/admin/migrate-private-fields.cjs --key ./sa.json --apply        # phase 1: copy
 *   node scripts/admin/migrate-private-fields.cjs --key ./sa.json --remove-old   # phase 2: clean up
 *
 * Phase 1 only ever CREATES the new documents (existing ones are left alone), so it
 * is safe to repeat and safe to run while the old app is live: the new app falls
 * back to the legacy fields until phase 2. Run phase 2 only after the new app is
 * deployed and verified, because the old app still reads the legacy fields.
 * Take a backup first: node scripts/backup-firestore.cjs
 */
const admin = require('firebase-admin');
const fs = require('fs');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const removeOld = argv.includes('--remove-old');
const keyIdx = argv.indexOf('--key');
// FIRESTORE_EMULATOR_HOST (integration tests) needs no credential.
if (process.env.FIRESTORE_EMULATOR_HOST) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-magnaflow' });
} else {
  if (keyIdx === -1 || !argv[keyIdx + 1]) {
    console.error('Usage: --key <service-account.json> [--apply | --remove-old]');
    process.exit(2);
  }
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(argv[keyIdx + 1], 'utf8'))) });
}
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const ORG_FIELDS = ['billingEmail', 'ccEmails', 'seatLimit', 'storageQuotaMB'];
const PROJECT_FIELDS = ['budget', 'currency', 'budgetNotes'];
const has = (obj, k) => obj[k] !== undefined;

async function main() {
  const mode = removeOld ? 'REMOVE LEGACY FIELDS' : apply ? 'COPY' : 'DRY RUN';
  console.log(`Mode: ${mode}\n`);
  const orgs = await db.collection('organizations').get();
  let plannedWrites = 0;

  for (const orgDoc of orgs.docs) {
    const org = orgDoc.data();
    const settingsRef = orgDoc.ref.collection('private').doc('settings');
    const seatsRef = orgDoc.ref.collection('meta').doc('seats');
    const [settings, seats, users] = await Promise.all([
      settingsRef.get(),
      seatsRef.get(),
      db.collection('users').where('orgId', '==', orgDoc.id).get(),
    ]);
    console.log(`Organization ${org.name || orgDoc.id} (${orgDoc.id}), ${users.size} user(s)`);

    if (!removeOld) {
      const seatLimit = Number(org.seatLimit ?? 10) || 10;
      if (!settings.exists) {
        console.log('  + private/settings');
        plannedWrites++;
        if (apply) {
          await settingsRef.set({
            seatLimit,
            storageQuotaMB: org.storageQuotaMB ?? 1000,
            billingEmail: org.billingEmail ?? '',
            ccEmails: org.ccEmails ?? [],
          });
        }
      }
      if (!seats.exists) {
        console.log(`  + meta/seats (seatsUsed ${users.size} of ${seatLimit})`);
        plannedWrites++;
        if (apply) await seatsRef.set({ seatsUsed: users.size, seatLimit, lastSeatUid: null });
      }
    } else {
      // Only strip the legacy fields once their replacement is in place.
      const legacy = ORG_FIELDS.filter((k) => has(org, k));
      if (legacy.length && settings.exists) {
        console.log(`  - remove ${legacy.join(', ')} from the organization document`);
        plannedWrites++;
        await orgDoc.ref.update(Object.fromEntries(legacy.map((k) => [k, FieldValue.delete()])));
      } else if (legacy.length) {
        console.log('  ! legacy fields kept: private/settings does not exist yet (run --apply first)');
      }
    }

    const projects = await orgDoc.ref.collection('projects').get();
    for (const p of projects.docs) {
      const data = p.data();
      const financeRef = p.ref.collection('finance').doc('budget');
      const finance = await financeRef.get();
      const legacy = PROJECT_FIELDS.filter((k) => has(data, k));

      if (!removeOld) {
        if (legacy.length && !finance.exists) {
          console.log(`  + finance/budget for project ${data.name || p.id}`);
          plannedWrites++;
          if (apply) {
            await financeRef.set({
              budget: Number(data.budget) || 0,
              currency: data.currency || 'USD',
              budgetNotes: data.budgetNotes || '',
            });
          }
        }
      } else if (legacy.length && finance.exists) {
        console.log(`  - remove ${legacy.join(', ')} from project ${data.name || p.id}`);
        plannedWrites++;
        await p.ref.update(Object.fromEntries(legacy.map((k) => [k, FieldValue.delete()])));
      } else if (legacy.length) {
        console.log(`  ! legacy budget kept on project ${data.name || p.id}: no finance/budget yet`);
      }
    }
  }

  console.log(`\n${plannedWrites} change(s) ${apply || removeOld ? 'made' : 'planned (dry run, nothing written)'}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
