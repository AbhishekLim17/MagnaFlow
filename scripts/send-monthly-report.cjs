/**
 * Monthly performance report: on the 1st, each org admin gets last month's numbers for their
 * organization: tasks finished (and on time), started, overdue now, time logged, who finished
 * most and per project (src/lib/monthlyReport.js).
 *
 * Suspended organizations are skipped; deactivated people and anyone who turned the report
 * off in their email settings are not sent it.
 *
 *   node scripts/send-monthly-report.cjs [--dry-run]
 */
const path = require('path');
const { pathToFileURL } = require('url');
const admin = require('firebase-admin');
const { initAdmin } = require('./lib/admin.cjs');
const { createTransport, sendNotification } = require('./lib/mailer.cjs');
const { APP_URL, EMAIL_RE } = require('./lib/tenant.cjs');

const DRY_RUN = process.argv.includes('--dry-run');
const lib = (name) => import(pathToFileURL(path.join(__dirname, '..', 'src', 'lib', name)).href);

async function main() {
  initAdmin();
  const db = admin.firestore();
  const { monthlyReport, previousMonth, reportRows, reportSummary } = await lib('monthlyReport.js');
  const { wantsEmail } = await lib('notificationPrefs.js');
  const month = previousMonth(new Date());
  let transport = null;
  let sent = 0;
  let failed = 0;

  const orgs = (await db.collection('organizations').get()).docs.filter((d) => d.data().status !== 'suspended');
  for (const org of orgs) {
    const people = (await db.collection('users').where('orgId', '==', org.id).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const admins = people.filter((u) => ['org-admin', 'admin'].includes(u.role) && u.status !== 'inactive'
      && EMAIL_RE.test(String(u.email || '')) && wantsEmail(u.notificationPrefs, 'monthly_report'));
    if (admins.length === 0) continue;

    const [tasks, entries, projects] = await Promise.all([
      db.collection('tasks').where('orgId', '==', org.id).get(),
      db.collection('time_entries').where('orgId', '==', org.id).where('date', '>=', month.fromDay).where('date', '<=', month.toDay).get(),
      db.collection('organizations').doc(org.id).collection('projects').get(),
    ]);
    const report = monthlyReport({
      tasks: tasks.docs.map((d) => d.data()),
      entries: entries.docs.map((d) => d.data()),
      projects: projects.docs.map((d) => ({ id: d.id, ...d.data() })),
      people,
    }, month);
    if (report.created === 0 && report.completed === 0 && report.overdueNow === 0) continue; // a quiet org gets no mail

    for (const u of admins) {
      const mail = {
        type: 'monthly_report',
        to_email: u.email,
        to_name: u.name || u.email,
        cc_email: '',
        notification_type: 'Monthly report',
        notification_icon: '📈',
        title: `${org.data().name || 'Your organisation'}: ${month.label}`,
        message: reportSummary(report, month.label),
        rows: reportRows(report),
        button_text: 'Open reports',
        button_link: APP_URL,
        footer_text: 'Sent on the 1st of every month to org admins. Turn it off in Email settings.',
      };
      if (DRY_RUN) { console.log(`  would send to ${u.email}: ${mail.message}`); continue; }
      try {
        transport ||= createTransport();
        await sendNotification(transport, mail);
        sent += 1;
        await db.collection('email_logs').add({
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          type: 'monthly_report', recipient: u.email, orgId: org.id, status: 'sent', source: 'monthly_report',
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
  console.error('Monthly report failed:', error);
  process.exit(1);
});
