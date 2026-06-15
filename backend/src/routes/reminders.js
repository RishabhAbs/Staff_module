const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// GET all reminders for current user
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM reminders WHERE staff_id = ? ORDER BY next_trigger ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CREATE reminder
router.post('/', auth, async (req, res) => {
  const { title, note, remind_at, repeat_type } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
  if (!remind_at)     return res.status(400).json({ error: 'Reminder date/time is required.' });
  try {
    const [r] = await db.query(
      `INSERT INTO reminders (staff_id, title, note, remind_at, repeat_type, next_trigger)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, title.trim(), note?.trim() || null, remind_at, repeat_type || 'none', remind_at]
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
    if (remind_at   !== undefined) { fields.push('remind_at=?');   vals.push(remind_at); fields.push('next_trigger=?'); vals.push(remind_at); }
    if (repeat_type !== undefined) { fields.push('repeat_type=?'); vals.push(repeat_type); }
    if (is_done     !== undefined) { fields.push('is_done=?');     vals.push(is_done ? 1 : 0); }
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
