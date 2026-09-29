#!/usr/bin/env node
/**
 * Refuse to build when an env file Vite would load holds something secret.
 *
 * Every VITE_* variable is inlined into the public JavaScript bundle. An EmailJS
 * private key and a cron token were shipped that way once already, sitting in
 * .env.production and .env.local under a VITE_ prefix. This runs before every
 * `npm run build` (prebuild), so a deploy from a developer machine cannot
 * publish one again. CI has no env files and passes trivially.
 *
 * Firebase web config and *_PUBLIC_KEY / *_DSN / *_ID values are public by
 * design and are not flagged.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Files Vite loads for a production build, in any mode.
const FILES = ['.env', '.env.local', '.env.production', '.env.production.local'];
const SUSPECT = /(PRIVATE|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL)/i;

const findings = [];
for (const name of FILES) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && SUSPECT.test(m[1]) && m[2].trim() !== '') findings.push(`${name}: ${m[1]}`);
  }
}

if (findings.length) {
  console.error('\nBuild blocked: secret-looking VITE_ variables would be published in the bundle:\n');
  findings.forEach((f) => console.error('  - ' + f));
  console.error(
    '\nAnything prefixed VITE_ is readable by every visitor. Delete these lines (and rotate the\n' +
      'values if they were ever shipped); keep real secrets in server-side jobs or repository secrets.\n'
  );
  process.exit(1);
}
