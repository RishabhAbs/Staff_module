const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM items ORDER BY name ASC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const { name, code, unit, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Item name is required.' });
  try {
    const [r] = await db.query('INSERT INTO items (name, code, unit, description) VALUES (?, ?, ?, ?)',
      [name.trim(), code?.trim() || null, unit?.trim() || null, description?.trim() || null]);
    res.json({ id: r.insertId, name: name.trim(), code, unit, description });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Item name already exists.' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const { name, code, unit, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Item name is required.' });
  try {
    await db.query('UPDATE items SET name=?, code=?, unit=?, description=? WHERE id=?',
      [name.trim(), code?.trim() || null, unit?.trim() || null, description?.trim() || null, req.params.id]);
    res.json({ success: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Item name already exists.' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  try {
    await db.query('DELETE FROM items WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
