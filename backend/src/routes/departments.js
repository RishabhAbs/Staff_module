const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM departments ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Department name is required.' });
  try {
    const [result] = await db.query(
      'INSERT INTO departments (name, description) VALUES (?, ?)',
      [name.trim(), description?.trim() || null]
    );
    res.json({ id: result.insertId, name: name.trim(), description: description?.trim() || null });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Department name already exists.' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Department name is required.' });
  try {
    await db.query(
      'UPDATE departments SET name = ?, description = ? WHERE id = ?',
      [name.trim(), description?.trim() || null, req.params.id]
    );
    res.json({ id: parseInt(req.params.id), name: name.trim(), description: description?.trim() || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  try {
    await db.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
