// scripts/migrate-to-multitenant.js
// Section 5 — One-off migration script
// Run with Admin SDK (NOT client SDK): node scripts/migrate-to-multitenant.js
// 1. Run against emulator first
// 2. Verify user count and task count match before running against prod
// 3. Do NOT delete flat collections until new Firestore rules are live

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // keep out of git

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function migrate() {
  console.log('🚀 Starting multi-tenant migration...');

  // ── 1. Create the root organization ──────────────────────────────────────
  const orgRef = await db.collection('organizations').add({
    name: 'Magnetar',
    plan: 'enterprise',
    status: 'active',
    seatLimit: 999,
    storageQuotaMB: 50000,
    billingEmail: '',
    ccEmails: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('✅ Organization created:', orgRef.id);

  // ── 2. Create default department ─────────────────────────────────────────
  const deptRef = await db
    .collection(`organizations/${orgRef.id}/departments`)
    .add({ name: 'General', createdAt: admin.firestore.FieldValue.serverTimestamp() });
  console.log('✅ Department created:', deptRef.id);

  // ── 3. Create default project ─────────────────────────────────────────────
  const projRef = await db
    .collection(`organizations/${orgRef.id}/projects`)
    .add({
      name: 'General',
      departmentId: deptRef.id,
      memberUserIds: [],
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  console.log('✅ Project created:', projRef.id);

  // ── 4. Backfill all existing users ────────────────────────────────────────
  const users = await db.collection('users').get();
  console.log(`📋 Migrating ${users.size} users...`);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let count = 0;

  for (const u of users.docs) {
    batch.update(u.ref, {
      orgId: orgRef.id,
      departmentIds: [deptRef.id],
      projectIds: [projRef.id],
    });
    count++;
    if (count % BATCH_SIZE === 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`  ✅ Committed ${count} users`);
    }
  }
  if (count % BATCH_SIZE !== 0) await batch.commit();
  console.log(`✅ All ${users.size} users migrated`);

  // ── 5. Copy flat tasks → organizations/{orgId}/tasks/{taskId} ─────────────
  const tasks = await db.collection('tasks').get();
  console.log(`📋 Migrating ${tasks.size} tasks...`);

  for (const t of tasks.docs) {
    await db.doc(`organizations/${orgRef.id}/tasks/${t.id}`).set({
      ...t.data(),
      departmentId: deptRef.id,
      projectId: projRef.id,
    });
  }
  console.log(`✅ All ${tasks.size} tasks copied to subcollection`);

  console.log('\n─────────────────────────────────────────────────────────');
  console.log('✅ Migration complete. BEFORE deleting flat collections:');
  console.log(`   users.count expected  : ${users.size}`);
  console.log(`   tasks.count expected  : ${tasks.size}`);
  console.log('   Run a count query to verify, then delete old flat data.');
  console.log('─────────────────────────────────────────────────────────\n');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
