#!/usr/bin/env node
/**
 * Fail the build if a value from .env.local appears in a tracked file.
 *
 * This repository is public, and it had already shipped an EmailJS private key
 * four ways: hardcoded in api/daily-reminders.js, in two archived docs, and in
 * public/cron-trigger.html — which Firebase Hosting served to anyone who asked
 * for it. Nothing caught that, because nothing was looking.
 *
 *   npm run check:secrets
 *
 * Values EmailJS and Firebase intend to be public are ignored: Firebase web
 * config and the EmailJS service/template/public keys are compiled into the
 * client bundle by design, and Firestore rules are what actually guard data.
 * Flagging them would train everyone to ignore this check.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env.local');

// Public by design — see above.
const PUBLIC_BY_DESIGN = new Set([
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID',
  'VITE_EMAILJS_SERVICE_ID',
  'VITE_EMAILJS_TEMPLATE_ID',
  'VITE_EMAILJS_PUBLIC_KEY',
  'VITE_SENTRY_DSN',
  'VITE_ADMIN_EMAILS',
]);

const MIN_LENGTH = 12;

if (!fs.existsSync(ENV_FILE)) {
  console.log('check:secrets — no .env.local, nothing to compare against.');
  process.exit(0);
}

const secrets = [];
for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (!match) continue;
  const [, name, rawValue] = match;
  const value = rawValue.trim().replace(/^["']|["']$/g, '');
  if (PUBLIC_BY_DESIGN.has(name) || value.length < MIN_LENGTH) continue;
  secrets.push({ name, value });
}

const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
const findings = [];

for (const file of tracked) {
  let contents;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch {
    continue; // binary or unreadable
  }
  for (const { name, value } of secrets) {
    if (contents.includes(value)) findings.push({ file, name });
  }
}

if (findings.length === 0) {
  console.log(`check:secrets — clean (${secrets.length} secret(s) checked against ${tracked.length} tracked files).`);
  process.exit(0);
}

console.error('\ncheck:secrets — SECRET VALUES FOUND IN TRACKED FILES\n');
for (const { file, name } of findings) console.error(`  ${file}  contains  ${name}`);
console.error(
  '\nRemove the literal and read it from the environment instead.\n' +
    'If it has already been pushed, rotate it — git history keeps it forever.\n'
);
process.exit(1);
