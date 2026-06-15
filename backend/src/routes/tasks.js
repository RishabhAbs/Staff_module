const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/tasks');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename:    (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// List tasks — admin sees all, user sees their own
router.get('/', auth, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      [rows] = await db.query(`
        SELECT t.*, s.name as assigned_name
        FROM tasks t
        LEFT JOIN staff s ON s.id = t.assigned_to
        ORDER BY t.created_at DESC
      `);
    } else {
      [rows] = await db.query(`
        SELECT t.*, s.name as assigned_name
        FROM tasks t
        LEFT JOIN staff s ON s.id = t.assigned_to
        WHERE t.assigned_to = ?
        ORDER BY t.created_at DESC
      `, [req.user.id]);
    }
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create task (admin or user with create_task permission)
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    // Check permission from DB
    const [[staff]] = await db.query('SELECT permissions FROM staff WHERE id=?', [req.user.id]);
    const perms = staff?.permissions ? (typeof staff.permissions === 'string' ? JSON.parse(staff.permissions) : staff.permissions) : {};
    if (!perms.create_task) return res.status(403).json({ error: 'You do not have permission to create tasks.' });
    req.body.assigned_to = req.user.id;
  }
  const { title, description, assigned_to, due_date, priority } = req.body;
  if (!title?.trim())  return res.status(400).json({ error: 'Title is required.' });
  if (!assigned_to)    return res.status(400).json({ error: 'Assigned employee is required.' });
  if (!due_date)       return res.status(400).json({ error: 'Due date is required.' });
  try {
    const [r] = await db.query(
      `INSERT INTO tasks (title, description, assigned_to, due_date, priority, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [title.trim(), description?.trim() || null, assigned_to, due_date, priority || 'medium', req.user.id]
    );
    // notify assigned user
    await db.query(
      `INSERT INTO notifications (type, message, staff_id, link) VALUES (?, ?, ?, ?)`,
      ['task_assigned', `New task assigned: "${title.trim()}"`, assigned_to, '/tasks']
    );
    res.json({ id: r.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update task (admin only)
router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const { title, description, assigned_to, due_date, priority, status } = req.body;
  try {
    const fields = [];
    const values = [];
    if (title       !== undefined) { fields.push('title=?');       values.push(title); }
    if (description !== undefined) { fields.push('description=?'); values.push(description || null); }
    if (assigned_to !== undefined) { fields.push('assigned_to=?'); values.push(assigned_to); }
    if (due_date    !== undefined) { fields.push('due_date=?');    values.push(due_date); }
    if (priority    !== undefined) { fields.push('priority=?');    values.push(priority); }
    if (status      !== undefined) { fields.push('status=?');      values.push(status); }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update.' });
    values.push(req.params.id);
    await db.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id=?`, values);
    // notify on reassign
    if (assigned_to !== undefined) {
      const [[task]] = await db.query('SELECT title FROM tasks WHERE id=?', [req.params.id]);
      await db.query(
        `INSERT INTO notifications (type, message, staff_id, link) VALUES (?, ?, ?, ?)`,
        ['task_assigned', `Task reassigned to you: "${task?.title || ''}"`, assigned_to, '/tasks']
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete task (admin only)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  try {
    await db.query('DELETE FROM tasks WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Employee marks task complete or requests extension
router.put('/:id/action', auth, upload.single('document'), async (req, res) => {
  const { action, completion_note, extension_reason, extension_date } = req.body;
  const documentPath = req.file ? `/uploads/tasks/${req.file.filename}` : null;
  try {
    const [[task]] = await db.query('SELECT * FROM tasks WHERE id=?', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.assigned_to !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not your task.' });

    if (action === 'complete') {
      const fields = [`status='completed'`, `completion_note=?`, `completed_at=NOW()`];
      const vals   = [completion_note || null];
      if (documentPath) { fields.push('document_path=?'); vals.push(documentPath); }
      vals.push(req.params.id);
      await db.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id=?`, vals);
    } else if (action === 'extension') {
      const fields = [`status='extension_requested'`, `extension_reason=?`, `extension_date=?`];
      const vals   = [extension_reason || null, extension_date || null];
      if (documentPath) { fields.push('document_path=?'); vals.push(documentPath); }
      vals.push(req.params.id);
      await db.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id=?`, vals);
    } else {
      return res.status(400).json({ error: 'Invalid action.' });
    }
    res.json({ success: true, document_path: documentPath });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin approves/rejects extension request
router.put('/:id/extension', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const { approved } = req.body;
  try {
    if (approved) {
      await db.query(
        `UPDATE tasks SET status='in_progress', due_date=COALESCE(extension_date, due_date),
         extension_reason=NULL, extension_date=NULL WHERE id=?`,
        [req.params.id]
      );
    } else {
      await db.query(
        `UPDATE tasks SET status='overdue', extension_reason=NULL, extension_date=NULL WHERE id=?`,
        [req.params.id]
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
