const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
};

const ASSET_TYPES = ['SIM Card', 'Laptop', 'Mobile Phone', 'Tablet', 'ID Card', 'Vehicle', 'Key', 'Uniform', 'Other'];

// GET /api/assets/types — return predefined asset types
router.get('/types', auth, (req, res) => res.json(ASSET_TYPES));

// GET /api/assets — list all assets (admin sees all, user sees own)
router.get('/', auth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const q = isAdmin
      ? `SELECT a.*, s.name AS assigned_to_name
         FROM assets a
         LEFT JOIN staff s ON a.assigned_to = s.id
         ORDER BY a.created_at DESC`
      : `SELECT a.*, s.name AS assigned_to_name
         FROM assets a
         LEFT JOIN staff s ON a.assigned_to = s.id
         WHERE a.assigned_to = ?
         ORDER BY a.created_at DESC`;
    const [rows] = isAdmin ? await db.query(q) : await db.query(q, [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/assets — create asset (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  const { asset_type, asset_name, identifier, assigned_to, issued_date, return_date, status, remarks } = req.body;
  if (!asset_type || !asset_name) return res.status(400).json({ error: 'Asset type and name are required.' });
  try {
    const [result] = await db.query(
      `INSERT INTO assets (asset_type, asset_name, identifier, assigned_to, issued_date, return_date, status, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [asset_type, asset_name, identifier || null, assigned_to || null, issued_date || null, return_date || null, status || 'issued', remarks || null, req.user.id]
    );
    res.json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/assets/:id — update asset (admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { asset_type, asset_name, identifier, assigned_to, issued_date, return_date, status, remarks } = req.body;
  try {
    await db.query(
      `UPDATE assets SET asset_type=?, asset_name=?, identifier=?, assigned_to=?, issued_date=?, return_date=?, status=?, remarks=? WHERE id=?`,
      [asset_type, asset_name, identifier || null, assigned_to || null, issued_date || null, return_date || null, status || 'issued', remarks || null, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/assets/:id — delete asset (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM assets WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
