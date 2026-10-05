/**
 * Weekly project summary: every Monday, each org admin gets the health of all their
 * organization's projects, and each department head the projects of their departments,
 * worst first (src/lib/portfolio.js, the same rules as the Portfolio Health page).
 *
 * Suspended organizations are skipped; deactivated people and anyone who turned the
 * summary off in their email settings are not sent it.
 *
 *   node scripts/send-weekly-digest.cjs [--dry-run]
 */
const path = require('path');
const { pathToFileURL } = require('url');
const admin = require('firebase-admin');
const { initAdmin } = require('./lib/admin.cjs');
const { createTransport, sendNotification } = require('./lib/mailer.cjs');
const { APP_URL, EMAIL_RE } = require('./lib/tenant.cjs');

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_ROWS = 25; // projects listed per email; the page has the rest
const lib = (name) => import(pathToFileURL(path.join(__dirname, '..', 'src', 'lib', name)).href);

const firstLine = (s, max = 140) => {
  const line = String(s || '').split('\n').find((l) => l.trim()) || '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

async function orgItems(db, orgId, portfolio) {
  const projects = (await db.collection('organizations').doc(orgId).collection('projects').get()).docs
    .map((d) => ({ id: d.id, ...d.data() }));
  if (projects.length === 0) return [];
  const tasks = (await db.collection('tasks').where('orgId', '==', orgId).get()).docs.map((d) => d.data());
  return Promise.all(projects.map(async (p) => {
    const last = await db.collection('organizations').doc(orgId).collection('projects').doc(p.id)
      .collection('updates').orderBy('createdAt', 'desc').limit(1).get();
    const metrics = portfolio.projectMetrics(tasks.filter((t) => t.projectId === p.id));
    return { ...p, metrics, health: portfolio.projectHealth(metrics, last.empty ? null : last.docs[0].data()) };
  }));
}

function buildDigest(user, items, portfolio) {
  const sorted = portfolio.sortByHealth(items);
  return {
    type: 'weekly_digest',
    to_email: user.email,
    to_name: user.name || user.email,
    cc_email: '',
    notification_type: 'Weekly project summary',
    notification_icon: '📊',
    title: 'Your projects this week',
    message: portfolio.digestSummary(sorted),
    rows: sorted.slice(0, MAX_ROWS).map((i) => ({
      label: i.name || 'Project',
      value: portfolio.digestLine(i) + (i.health.update?.summary ? ` — “${firstLine(i.health.update.summary)}”` : ''),
    })),
    button_text: 'Open portfolio health',
    button_link: APP_URL,
    footer_text: `Sent every Monday to org admins and department heads.${sorted.length > MAX_ROWS ? ` Showing ${MAX_ROWS} of ${sorted.length} projects.` : ''} Turn it off in Email settings.`,
  };
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const portfolio = await lib('portfolio.js');
  const { wantsEmail } = await lib('notificationPrefs.js');
  let transport = null;
  let sent = 0;
  let failed = 0;

  const orgs = (await db.collection('organizations').get()).docs.filter((d) => d.data().status !== 'suspended');
  for (const org of orgs) {
    const items = await orgItems(db, org.id, portfolio);
    if (items.length === 0) continue;
    const people = (await db.collection('users').where('orgId', '==', org.id).get()).docs.map((d) => d.data());
    for (const u of people) {
      if (u.status === 'inactive' || !EMAIL_RE.test(String(u.email || ''))) continue;
      if (!wantsEmail(u.notificationPrefs, 'weekly_digest')) continue;
      const mine = ['org-admin', 'admin'].includes(u.role)
        ? items
        : u.role === 'department-head'
          ? items.filter((i) => i.departmentId && (u.departmentIds || []).includes(i.departmentId))
          : [];
      if (mine.length === 0) continue;
      const mail = buildDigest(u, mine, portfolio);
      if (DRY_RUN) { console.log(`  would send to ${u.email}: ${mail.message}`); continue; }
      try {
        transport ||= createTransport();
        await sendNotification(transport, mail);
        sent += 1;
        await db.collection('email_logs').add({
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          type: 'weekly_digest', recipient: u.email, orgId: org.id, status: 'sent', source: 'weekly_digest',
        }).catch(() => {});
      } catch (error) {
        failed += 1;
        console.error(`  FAILED for ${u.email}: ${error?.message}`);
      }
    }
  }
  console.log(`Done. Sent ${sent}, failed ${failed}.`);
  if (!DRY_RUN && sent === 0 && failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Weekly digest failed:', error);
  process.exit(1);
});
