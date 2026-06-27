const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// Admin-only guard for write operations
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
};

// GET /api/reminder-masters — all categories with their presets nested (any logged-in user)
router.get('/', auth, async (req, res) => {
  try {
    const [cats]    = await db.query('SELECT * FROM reminder_categories ORDER BY sort_order ASC, id ASC');
    const [presets] = await db.query('SELECT * FROM reminder_presets ORDER BY sort_order ASC, id ASC');
    const byCat = {};
    presets.forEach(p => { (byCat[p.category_id] = byCat[p.category_id] || []).push(p); });
    res.json(cats.map(c => ({ ...c, presets: byCat[c.id] || [] })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Categories ──────────────────────────────────────────────────────────────
router.post('/categories', auth, adminOnly, async (req, res) => {
  const { label, icon, color, sort_order } = req.body;
  if (!label?.trim()) return res.status(400).json({ error: 'Category name is required.' });
  try {
    const [r] = await db.query(
      'INSERT INTO reminder_categories (label, icon, color, sort_order) VALUES (?, ?, ?, ?)',
      [label.trim(), icon || 'pricetag-outline', color || '#475569', sort_order || 0]
    );
    const [[row]] = await db.query('SELECT * FROM reminder_categories WHERE id=?', [r.insertId]);
    res.json(row);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A category with this name already exists.' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/categories/:id', auth, adminOnly, async (req, res) => {
  const { label, icon, color, sort_order } = req.body;
  try {
    const fields = [], vals = [];
    if (label      !== undefined) { fields.push('label=?');      vals.push(label.trim()); }
    if (icon       !== undefined) { fields.push('icon=?');       vals.push(icon); }
    if (color      !== undefined) { fields.push('color=?');      vals.push(color); }
    if (sort_order !== undefined) { fields.push('sort_order=?'); vals.push(sort_order); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });
    vals.push(req.params.id);
    await db.query(`UPDATE reminder_categories SET ${fields.join(', ')} WHERE id=?`, vals);
    const [[row]] = await db.query('SELECT * FROM reminder_categories WHERE id=?', [req.params.id]);
    res.json(row);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A category with this name already exists.' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/categories/:id', auth, adminOnly, async (req, res) => {
  try {
    // presets cascade-delete via FK
    await db.query('DELETE FROM reminder_categories WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Presets (quick-select) ────────────────────────────────────────────────────
router.post('/presets', auth, adminOnly, async (req, res) => {
  const { category_id, title, note, repeat_type, sort_order } = req.body;
  if (!category_id)   return res.status(400).json({ error: 'Category is required.' });
  if (!title?.trim()) return res.status(400).json({ error: 'Preset title is required.' });
  try {
    const [r] = await db.query(
      'INSERT INTO reminder_presets (category_id, title, note, repeat_type, sort_order) VALUES (?, ?, ?, ?, ?)',
      [category_id, title.trim(), note?.trim() || null, repeat_type || 'none', sort_order || 0]
    );
    const [[row]] = await db.query('SELECT * FROM reminder_presets WHERE id=?', [r.insertId]);
    res.json(row);
  } catch (e) {
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Category not found.' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/presets/:id', auth, adminOnly, async (req, res) => {
  const { title, note, repeat_type, sort_order } = req.body;
  try {
    const fields = [], vals = [];
    if (title       !== undefined) { fields.push('title=?');       vals.push(title.trim()); }
    if (note        !== undefined) { fields.push('note=?');        vals.push(note?.trim() || null); }
    if (repeat_type !== undefined) { fields.push('repeat_type=?'); vals.push(repeat_type); }
    if (sort_order  !== undefined) { fields.push('sort_order=?');  vals.push(sort_order); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });
    vals.push(req.params.id);
    await db.query(`UPDATE reminder_presets SET ${fields.join(', ')} WHERE id=?`, vals);
    const [[row]] = await db.query('SELECT * FROM reminder_presets WHERE id=?', [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/presets/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM reminder_presets WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
