const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// Reminders are an admin-only feature
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
};
router.use(auth, adminOnly);

// GET all reminders for current user
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, s.name AS assignee_name
       FROM reminders r
       LEFT JOIN staff s ON s.id = r.assigned_to
       WHERE r.staff_id = ? ORDER BY r.next_trigger ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CREATE reminder
router.post('/', auth, async (req, res) => {
  const { title, note, remind_at, repeat_type } = req.body;
  // Only admins may assign a reminder to another user
  const assigned_to = req.user.role === 'admin' ? (req.body.assigned_to || null) : null;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
  if (!remind_at)     return res.status(400).json({ error: 'Reminder date/time is required.' });
  try {
    const [r] = await db.query(
      `INSERT INTO reminders (staff_id, title, note, remind_at, repeat_type, next_trigger, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, title.trim(), note?.trim() || null, remind_at, repeat_type || 'none', remind_at, assigned_to]
    );
    const [[row]] = await db.query('SELECT * FROM reminders WHERE id=?', [r.insertId]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// UPDATE reminder
router.put('/:id', auth, async (req, res) => {
  const { title, note, remind_at, repeat_type, is_done } = req.body;
  try {
    const fields = [], vals = [];
    if (title       !== undefined) { fields.push('title=?');       vals.push(title); }
    if (note        !== undefined) { fields.push('note=?');        vals.push(note || null); }
    if (remind_at   !== undefined) { fields.push('remind_at=?');   vals.push(remind_at); fields.push('next_trigger=?'); vals.push(remind_at); fields.push('task_created=0'); }
    if (repeat_type !== undefined) { fields.push('repeat_type=?'); vals.push(repeat_type); }
    if (is_done     !== undefined) { fields.push('is_done=?');     vals.push(is_done ? 1 : 0); }
    // Only admins may change the assignee; changing it resets task processing
    if (req.user.role === 'admin' && req.body.assigned_to !== undefined) {
      fields.push('assigned_to=?'); vals.push(req.body.assigned_to || null);
      fields.push('task_created=0');
    }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });
    vals.push(req.params.id, req.user.id);
    await db.query(`UPDATE reminders SET ${fields.join(', ')} WHERE id=? AND staff_id=?`, vals);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE reminder
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM reminders WHERE id=? AND staff_id=?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
