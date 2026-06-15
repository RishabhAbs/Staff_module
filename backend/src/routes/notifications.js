const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// GET notifications for current user
router.get('/', auth, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      [rows] = await db.query(`
        SELECT n.*, s.name as staff_name
        FROM notifications n
        LEFT JOIN staff s ON s.id = n.staff_id
        ORDER BY n.is_read ASC, n.created_at DESC
        LIMIT 50
      `);
    } else {
      [rows] = await db.query(`
        SELECT n.*, s.name as staff_name
        FROM notifications n
        LEFT JOIN staff s ON s.id = n.staff_id
        WHERE n.staff_id = ?
        ORDER BY n.is_read ASC, n.created_at DESC
        LIMIT 50
      `, [req.user.id]);
    }
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET unread count for current user
router.get('/count', auth, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      [[result]] = await db.query('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');
    } else {
      [[result]] = await db.query('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0 AND staff_id = ?', [req.user.id]);
    }
    res.json({ count: result.count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mark all as read for current user
router.put('/read-all', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      await db.query('UPDATE notifications SET is_read = 1');
    } else {
      await db.query('UPDATE notifications SET is_read = 1 WHERE staff_id = ?', [req.user.id]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mark single as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
