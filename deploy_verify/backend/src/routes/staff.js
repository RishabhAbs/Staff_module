const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/staff
router.get('/', auth, async (req, res) => {
  const [rows] = await db.query(`
    SELECT id, name, username, role, status, email, phone, created_at,
           two_fa_secret as twoFaSecret, two_fa_setup as twoFaSetup
    FROM staff ORDER BY created_at DESC
  `);
  const users = rows.map(u => ({
    ...u,
    number: u.phone,
    twoFaSetup: !!u.twoFaSetup,
  }));
  res.json(users);
});

// GET /api/staff/:id
router.get('/:id', auth, async (req, res) => {
  const [rows] = await db.query('SELECT id, name, username, role, status, email, phone FROM staff WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Not found' });
  res.json(rows[0]);
});

// POST /api/staff/create
router.post('/create', auth, async (req, res) => {
  const { name, username, password, role = 'user', email, phone, number, twoFaSecret } = req.body;
  const phoneVal = phone || number || null;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO staff (name, username, password, role, email, phone, status, two_fa_secret, two_fa_setup) VALUES (?, ?, ?, ?, ?, ?, "active", ?, 0)',
      [name, username, hashed, role, email || null, phoneVal, twoFaSecret || null]
    );
    res.json({
      id: result.insertId, name, username, role, status: 'active',
      phone: phoneVal, number: phoneVal,
      twoFaSecret: twoFaSecret || null, twoFaSetup: false,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Username already exists' });
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/staff/:id
router.put('/:id', auth, async (req, res) => {
  const { name, email, phone, number, status, role } = req.body;
  const phoneVal = phone || number || null;
  await db.query(
    'UPDATE staff SET name=?, email=?, phone=?, status=?, role=? WHERE id=?',
    [name, email || null, phoneVal, status, role, req.params.id]
  );
  res.json({ message: 'Updated' });
});

// PUT /api/staff/:id/2fa — mark 2FA as verified/reset
router.put('/:id/2fa', auth, async (req, res) => {
  const { setup, secret } = req.body;
  if (secret !== undefined) {
    // Reset: store new secret, mark unsetup
    await db.query('UPDATE staff SET two_fa_secret=?, two_fa_setup=0 WHERE id=?', [secret, req.params.id]);
  } else {
    await db.query('UPDATE staff SET two_fa_setup=? WHERE id=?', [setup ? 1 : 0, req.params.id]);
  }
  res.json({ message: 'Updated' });
});

// DELETE /api/staff/:id
router.delete('/:id', auth, async (req, res) => {
  await db.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

module.exports = router;
