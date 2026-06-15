const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/leave
router.get('/', auth, async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const [rows] = isAdmin
    ? await db.query('SELECT l.*, s.name as staff_name FROM leave_requests l JOIN staff s ON l.staff_id = s.id ORDER BY l.created_at DESC')
    : await db.query('SELECT * FROM leave_requests WHERE staff_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(rows);
});

// POST /api/leave/apply
router.post('/apply', auth, async (req, res) => {
  const { from_date, to_date, reason, type } = req.body;
  const [result] = await db.query(
    'INSERT INTO leave_requests (staff_id, from_date, to_date, reason, type, status) VALUES (?, ?, ?, ?, ?, "pending")',
    [req.user.id, from_date, to_date, reason, type]
  );
  res.json({ id: result.insertId, status: 'pending' });
});

// PUT /api/leave/:id  (admin approve/reject)
router.put('/:id', auth, async (req, res) => {
  const { status } = req.body;
  await db.query('UPDATE leave_requests SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ message: 'Updated' });
});

module.exports = router;
