/**
 * Create the next occurrence of every repeating task that has just been finished.
 *
 * A repeating task carries `repeat` (the schedule), `occurrence` and `repeating: true`. When
 * it is completed (or cancelled - "skip this one"), this job creates the next occurrence with
 * the dates moved on by the schedule, the same title, description, assignee, priority,
 * project and checklist (unticked), and marks the finished one `repeating: false` so it is
 * never rolled twice. The assignee is notified through the mail queue like any assignment.
 *
 * It has to run on a server: the person who completes a task is usually its assignee, who
 * is only allowed to change its status, and the new task must keep its original author.
 * Runs hourly from GitHub Actions (.github/workflows/recurring-tasks.yml).
 *
 *   node scripts/roll-recurring-tasks.cjs [--dry-run]
 */
const path = require('path');
const { pathToFileURL } = require('url');
const admin = require('firebase-admin');
const { initAdmin } = require('./lib/admin.cjs');
const { APP_URL } = require('./lib/tenant.cjs');

const DRY_RUN = process.argv.includes('--dry-run');
const FINISHED = new Set(['completed', 'cancelled']);

// Task dates are stored as midnight UTC of the chosen day.
const dayOf = (ts) => (ts && typeof ts.toDate === 'function' ? ts.toDate().toISOString().slice(0, 10) : '');
const stamp = (iso) => (iso ? admin.firestore.Timestamp.fromDate(new Date(`${iso}T00:00:00Z`)) : null);

async function main() {
  initAdmin();
  const db = admin.firestore();
  // The same schedule arithmetic the task form previews with.
  const { nextOccurrence } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'recurrence.js')).href);
  const today = new Date().toISOString().slice(0, 10);

  const snap = await db.collection('tasks').where('repeating', '==', true).get();
  const due = snap.docs.filter((d) => FINISHED.has(d.data().status));
  console.log(`${snap.size} repeating task(s), ${due.length} finished and due to roll${DRY_RUN ? ' (dry run)' : ''}.`);

  let created = 0;
  let skipped = 0;
  for (const finishedDoc of due) {
    const task = finishedDoc.data();
    const next = nextOccurrence(task.repeat, task.occurrence || 0, today);
    if (!next) {
      // No usable schedule (no deadline to count from): stop repeating rather than retry forever.
      console.warn(`  ${finishedDoc.id}: no schedule to follow, repeating switched off`);
      if (!DRY_RUN) await finishedDoc.ref.update({ repeating: false });
      skipped += 1;
      continue;
    }
    const seriesId = task.seriesId || finishedDoc.id;
    // Named by series and due date: each occurrence of a series has its own deadline, so two
    // runs (or a finished task that was reopened and finished again) can never make a second
    // copy of the same occurrence. Editing a task re-bases its schedule on its new dates, which
    // gives new due dates and so new names.
    const nextRef = db.collection('tasks').doc(`${seriesId}_${next.deadline}`);

    if (DRY_RUN) {
      console.log(`  would create "${task.title}" #${next.occurrence}, due ${next.deadline}`);
      continue;
    }

    // In a transaction, so two overlapping runs can never create the same occurrence twice.
    const made = await db.runTransaction(async (tx) => {
      const [fresh, existing] = await Promise.all([tx.get(finishedDoc.ref), tx.get(nextRef)]);
      if (!fresh.exists || fresh.data().repeating !== true) return false;
      if (!existing.exists) {
        const now = admin.firestore.Timestamp.now();
        tx.set(nextRef, {
          title: task.title || '',
          description: task.description || '',
          assignedTo: task.assignedTo || null,
          priority: task.priority || 'medium',
          status: 'pending',
          startDate: stamp(next.startDate),
          deadline: stamp(next.deadline),
          createdBy: task.createdBy || null,
          ...(task.orgId !== undefined && { orgId: task.orgId }),
          ...(task.departmentId !== undefined && { departmentId: task.departmentId }),
          ...(task.projectId !== undefined && { projectId: task.projectId }),
          milestone: Boolean(task.milestone),
          blockedBy: [], // prerequisites belonged to the earlier occurrence
          repeat: task.repeat,
          repeating: true,
          seriesId,
          occurrence: next.occurrence,
          previousId: finishedDoc.id,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      }
      tx.update(finishedDoc.ref, { repeating: false, nextId: nextRef.id });
      return !existing.exists;
    });
    if (!made) {
      skipped += 1;
      continue;
    }
    created += 1;
    console.log(`  created "${task.title}" #${next.occurrence}, due ${next.deadline}`);

    // The checklist comes back unticked.
    const subtasks = await db.collection('subtasks').where('taskId', '==', finishedDoc.id).get();
    if (!subtasks.empty) {
      const batch = db.batch();
      subtasks.docs.forEach((s) => {
        batch.set(db.collection('subtasks').doc(), {
          taskId: nextRef.id,
          title: s.data().title || '',
          completed: false,
          createdBy: s.data().createdBy || task.createdBy || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    // Tell the assignee, through the same queue (and the same checks) as any assignment.
    if (task.assignedTo) {
      await db.collection('mail_queue').add({
        recipientUid: task.assignedTo,
        notification_type: 'Task Assignment',
        notification_icon: '🔁',
        notification_color: '#3e30d9',
        title: task.title || 'Repeating task',
        message: 'A repeating task is due again.',
        detail_1_label: 'Task', detail_1_value: task.title || '',
        detail_2_label: 'Due', detail_2_value: next.deadline,
        button_text: 'View Task Details',
        button_link: APP_URL,
        footer_text: 'This task repeats. The next one is created when this one is completed.',
        status: 'pending',
        attempts: 0,
        requestedBy: task.createdBy || 'system',
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        type: 'task_assigned',
        taskId: nextRef.id,
        source: 'recurring',
      });
    }
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped}.`);
}

main().catch((error) => {
  console.error('Rolling repeating tasks failed:', error);
  process.exit(1);
});
