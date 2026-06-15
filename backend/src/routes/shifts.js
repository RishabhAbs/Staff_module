const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/shifts (All users can fetch available shifts)
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM shifts ORDER BY created_at ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts (Admin only)
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admins only.' });
  }
  const { name, start_time, end_time } = req.body;
  if (!name || !start_time || !end_time) {
    return res.status(400).json({ error: 'All fields (name, start_time, end_time) are required.' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO shifts (name, start_time, end_time) VALUES (?, ?, ?)',
      [name, start_time, end_time]
    );
    res.json({ id: result.insertId, name, start_time, end_time });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shifts/:id (Admin only)
router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admins only.' });
  }
  const { name, start_time, end_time } = req.body;
  if (!name || !start_time || !end_time) {
    return res.status(400).json({ error: 'All fields (name, start_time, end_time) are required.' });
  }
  try {
    await db.query(
      'UPDATE shifts SET name = ?, start_time = ?, end_time = ? WHERE id = ?',
      [name, start_time, end_time, req.params.id]
    );
    res.json({ id: parseInt(req.params.id), name, start_time, end_time });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shifts/:id (Admin only)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admins only.' });
  }
  try {
    await db.query('DELETE FROM shifts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Shift deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
