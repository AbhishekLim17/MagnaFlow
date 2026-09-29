#!/usr/bin/env node
/**
 * Give legacy designations an orgId.
 *
 * Designations used to be one global collection. The security rules now scope
 * them per organization, so a designation with no orgId becomes invisible to
 * everyone except master-admin. Run this BEFORE deploying the new rules.
 *
 *   node scripts/admin/backfill-designation-org.cjs --key ./service-account.json            # dry run
 *   node scripts/admin/backfill-designation-org.cjs --key ./service-account.json --apply
 *
 * Safety: it only acts when the project has exactly ONE organization (so there
 * is no ambiguity about who owns the legacy titles) and refuses otherwise.
 * Take a backup first: node scripts/backup-firestore.cjs
 */
const admin = require('firebase-admin');
const fs = require('fs');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const keyIdx = argv.indexOf('--key');
// FIRESTORE_EMULATOR_HOST (integration tests) needs no credential.
if (process.env.FIRESTORE_EMULATOR_HOST) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-magnaflow' });
} else {
  if (keyIdx === -1 || !argv[keyIdx + 1]) {
    console.error('Usage: --key <service-account.json> [--apply]');
    process.exit(2);
  }
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(argv[keyIdx + 1], 'utf8'))) });
}
const db = admin.firestore();

async function main() {
  const orgs = await db.collection('organizations').get();
  if (orgs.size !== 1) {
    console.error(`Found ${orgs.size} organizations; this script only handles exactly one. Assign orgIds by hand.`);
    process.exit(1);
  }
  const orgId = orgs.docs[0].id;
  console.log(`Organization: ${orgs.docs[0].data().name} (${orgId})`);

  const snap = await db.collection('designations').get();
  const legacy = snap.docs.filter((d) => d.data().orgId === undefined || d.data().orgId === null);
  console.log(`${legacy.length} of ${snap.size} designations have no orgId.`);
  if (legacy.length === 0) return;

  if (!apply) {
    legacy.forEach((d) => console.log(`  would set orgId on "${d.data().name}" (${d.id})`));
    console.log('\nDry run. Re-run with --apply to write.');
    return;
  }

  for (let i = 0; i < legacy.length; i += 400) {
    const batch = db.batch();
    legacy.slice(i, i + 400).forEach((d) => batch.update(d.ref, { orgId }));
    await batch.commit();
  }
  console.log(`Updated ${legacy.length} designations.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
