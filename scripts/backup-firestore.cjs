#!/usr/bin/env node
/**
 * Local Firestore backup.
 *
 * Google's managed/scheduled Firestore exports require the Blaze plan and a
 * Cloud Storage bucket. This project runs on Spark, so this script provides a
 * working alternative: it reads every collection with the Admin SDK and writes
 * a timestamped JSON snapshot you can keep off-machine.
 *
 * Usage:
 *   node scripts/backup-firestore.js [--out ./backups] [--key ./service-account.json]
 *
 * The service-account key is a credential — keep it out of git (it is already
 * covered by .gitignore) and store the resulting backups somewhere private,
 * since they contain all user and task data in plain text.
 *
 * Restore is deliberately NOT automated: overwriting production from a snapshot
 * is destructive and should be a considered, manual act.
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { out: './backups', key: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--key') args.key = argv[++i];
  }
  return args;
}

// Look for the key outside the repo first. A service-account key grants full
// admin access to production, so the preferred home is a directory that can
// never be caught by a stray `git add` or an archive of the project folder.
function findServiceAccountKey(explicit) {
  if (explicit) return path.resolve(explicit);
  if (process.env.MAGNAFLOW_SERVICE_ACCOUNT) {
    return path.resolve(process.env.MAGNAFLOW_SERVICE_ACCOUNT);
  }

  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    home ? path.join(home, '.magnaflow-secrets') : null,
    path.resolve(__dirname, '..'), // legacy: repo root (gitignored)
  ].filter(Boolean);

  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const match = fs
      .readdirSync(dir)
      .find((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'));
    if (match) return path.join(dir, match);
  }
  return null;
}

// Firestore Timestamps / GeoPoints / DocumentReferences aren't plain JSON.
// Tag them so a future restore can tell them apart from ordinary values.
function serialize(value) {
  if (value === null || value === undefined) return value;
  if (typeof value?.toDate === 'function') {
    return { __type__: 'timestamp', value: value.toDate().toISOString() };
  }
  if (value?._latitude !== undefined && value?._longitude !== undefined) {
    return { __type__: 'geopoint', latitude: value._latitude, longitude: value._longitude };
  }
  if (typeof value?.path === 'string' && typeof value?.id === 'string') {
    return { __type__: 'reference', path: value.path };
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

async function dumpCollection(colRef) {
  const snapshot = await colRef.get();
  const docs = {};
  for (const docSnap of snapshot.docs) {
    const entry = { data: serialize(docSnap.data()) };
    // Recurse into subcollections (organizations/{id}/departments, /projects…).
    const subcollections = await docSnap.ref.listCollections();
    if (subcollections.length) {
      entry.subcollections = {};
      for (const sub of subcollections) {
        entry.subcollections[sub.id] = await dumpCollection(sub);
      }
    }
    docs[docSnap.id] = entry;
  }
  return docs;
}

async function main() {
  const args = parseArgs(process.argv);

  const keyPath = findServiceAccountKey(args.key);
  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error(
      'Could not find a service-account key.\n' +
      'Pass one explicitly:  node scripts/backup-firestore.js --key path/to/key.json\n' +
      '(Firebase Console → Project settings → Service accounts → Generate new private key)'
    );
    process.exit(1);
  }

  let admin;
  try {
    // Reuse the Admin SDK already installed for Cloud Functions.
    admin = require(path.resolve(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
  } catch {
    try {
      admin = require('firebase-admin');
    } catch {
      console.error('firebase-admin is not installed. Run: npm --prefix functions install');
      process.exit(1);
    }
  }

  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
  const db = admin.firestore();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `firestore-backup-${stamp}.json`);

  const collections = await db.listCollections();
  const backup = { exportedAt: new Date().toISOString(), collections: {} };

  let totalDocs = 0;
  for (const col of collections) {
    const docs = await dumpCollection(col);
    backup.collections[col.id] = docs;
    const count = Object.keys(docs).length;
    totalDocs += count;
    console.log(`  ${col.id}: ${count} document(s)`);
  }

  fs.writeFileSync(outFile, JSON.stringify(backup, null, 2));
  const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`\nBacked up ${totalDocs} document(s) across ${collections.length} collection(s).`);
  console.log(`Written to ${outFile} (${sizeKb} kB)`);
  console.log('\nThis file contains all user and task data — store it somewhere private.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
