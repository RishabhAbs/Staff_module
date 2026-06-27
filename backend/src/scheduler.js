const db = require('./db');

// Finds reminders due TOMORROW that are assigned to a user and not yet processed,
// then: (1) creates a task for the assignee, (2) sends a "do this tomorrow"
// notification, (3) marks the reminder as processed (task_created=1).
// Idempotent — safe to run repeatedly.
async function processDueReminders() {
  try {
    const [rows] = await db.query(`
      SELECT r.*, s.name AS assignee_name
      FROM reminders r
      LEFT JOIN staff s ON s.id = r.assigned_to
      WHERE r.assigned_to IS NOT NULL
        AND r.is_done = 0
        AND r.task_created = 0
        AND DATE(r.next_trigger) = DATE(DATE_ADD(NOW(), INTERVAL 1 DAY))
    `);

    for (const r of rows) {
      try {
        // 1. Create a task for the assignee, due on the reminder date
        const dueDate = String(r.next_trigger).slice(0, 10); // YYYY-MM-DD
        const [taskRes] = await db.query(
          `INSERT INTO tasks (title, description, assigned_to, due_date, priority, status, created_by)
           VALUES (?, ?, ?, ?, 'medium', 'pending', ?)`,
          [r.title, r.note || null, r.assigned_to, dueDate, r.staff_id]
        );

        // 2. Notify the assignee
        await db.query(
          `INSERT INTO notifications (type, message, staff_id, link) VALUES (?, ?, ?, ?)`,
          ['reminder_due', `Reminder: "${r.title}" is due tomorrow (${dueDate}).`, r.assigned_to, '/tasks']
        );

        // 3. Mark processed + link the task
        await db.query('UPDATE reminders SET task_created = 1, task_id = ? WHERE id = ?', [taskRes.insertId, r.id]);

        console.log(`[scheduler] Reminder #${r.id} "${r.title}" → task #${taskRes.insertId} for staff #${r.assigned_to}`);
      } catch (inner) {
        console.error(`[scheduler] Failed processing reminder #${r.id}:`, inner.message);
      }
    }
    if (rows.length) console.log(`[scheduler] Processed ${rows.length} reminder(s) due tomorrow.`);
  } catch (e) {
    console.error('[scheduler] processDueReminders error:', e.message);
  }
}

// Start the hourly check (and run once shortly after boot)
function startScheduler() {
  const HOUR = 60 * 60 * 1000;
  setTimeout(processDueReminders, 30 * 1000); // first run 30s after startup
  setInterval(processDueReminders, HOUR);
  console.log('[scheduler] Reminder scheduler started (hourly).');
}

module.exports = { startScheduler, processDueReminders };
