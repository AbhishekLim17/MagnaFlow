import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testCronLogic() {
  console.log('\n🔍 TESTING CRON LOGIC LOCALLY...\n');

  try {
    // 1. Check tasks collection
    console.log('📋 Fetching all tasks...');
    const tasksSnapshot = await db.collection('tasks').get();
    console.log(`✅ Found ${tasksSnapshot.size} total tasks\n`);

    // 2. Check for critical tasks
    const tasks = [];
    tasksSnapshot.forEach(doc => {
      const task = { id: doc.id, ...doc.data() };
      tasks.push(task);
      console.log(`Task: ${task.title}`);
      console.log(`  Priority: ${task.priority || 'not set'}`);
      console.log(`  Status: ${task.status || 'not set'}`);
      console.log(`  Assigned to: ${task.assignedTo || 'unassigned'}`);
      console.log(`  Due date: ${task.dueDate || 'not set'}`);
      console.log('---');
    });

    // 3. Check for users
    console.log('\n👥 Fetching all users...');
    const usersSnapshot = await db.collection('users').get();
    console.log(`✅ Found ${usersSnapshot.size} total users\n`);

    usersSnapshot.forEach(doc => {
      const user = doc.data();
      console.log(`User: ${user.name || 'No name'}`);
      console.log(`  Email: ${user.email || 'No email'}`);
      console.log(`  Role: ${user.role || 'No role'}`);
      console.log('---');
    });

    // 4. Filter tasks by urgency (simulate cron logic)
    console.log('\n🔥 CHECKING URGENCY (Simulating cron logic)...\n');
    
    const criticalTasks = tasks.filter(t => 
      (t.priority || '').toLowerCase() === 'critical' && 
      (t.status || '').toLowerCase() !== 'completed'
    );
    
    console.log(`Critical tasks found: ${criticalTasks.length}`);
    criticalTasks.forEach(t => {
      console.log(`  - ${t.title} (${t.priority})`);
    });

    // 5. Check reminder logs
    console.log('\n📊 Checking recent reminder logs...');
    const logsSnapshot = await db.collection('reminder_logs')
      .orderBy('timestamp', 'desc')
      .limit(3)
      .get();

    if (logsSnapshot.empty) {
      console.log('⚠️ No reminder logs found!');
    } else {
      logsSnapshot.forEach(doc => {
        const log = doc.data();
        console.log(`\nDate: ${log.date}`);
        console.log(`Total tasks: ${log.totalTasks || 0}`);
        console.log(`Emails sent: ${log.remindersSent || 0}`);
        console.log(`Critical: ${log.criticalCount || 0}`);
      });
    }

    // 6. Summary
    console.log('\n\n🎯 SUMMARY:');
    console.log(`Total tasks in database: ${tasks.length}`);
    console.log(`Critical tasks: ${criticalTasks.length}`);
    console.log(`Total users: ${usersSnapshot.size}`);
    console.log(`\n${criticalTasks.length > 0 ? '✅ SHOULD send emails' : '❌ NO emails should be sent (no urgent tasks)'}`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testCronLogic();
