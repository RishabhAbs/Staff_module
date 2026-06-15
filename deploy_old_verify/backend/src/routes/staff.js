const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/staff
router.get('/', auth, async (req, res) => {
  const [rows] = await db.query('SELECT id, name, username, role, status, email, phone, created_at FROM staff ORDER BY created_at DESC');
  res.json(rows);
});

// GET /api/staff/:id
router.get('/:id', auth, async (req, res) => {
  const [rows] = await db.query('SELECT id, name, username, role, status, email, phone FROM staff WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Not found' });
  res.json(rows[0]);
});

// POST /api/staff/create
router.post('/create', auth, async (req, res) => {
  const { name, username, password, role = 'user', email, phone } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO staff (name, username, password, role, email, phone, status) VALUES (?, ?, ?, ?, ?, ?, "active")',
      [name, username, hashed, role, email || null, phone || null]
    );
    res.json({ id: result.insertId, name, username, role, status: 'active' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Username already exists' });
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/staff/:id
router.put('/:id', auth, async (req, res) => {
  const { name, email, phone, status, role } = req.body;
  await db.query('UPDATE staff SET name=?, email=?, phone=?, status=?, role=? WHERE id=?',
    [name, email, phone, status, role, req.params.id]);
  res.json({ message: 'Updated' });
});

// DELETE /api/staff/:id
router.delete('/:id', auth, async (req, res) => {
  await db.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

module.exports = router;
