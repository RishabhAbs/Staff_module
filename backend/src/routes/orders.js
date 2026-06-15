const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// List all orders
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT o.*, COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get single order with items
router.get('/:id', auth, async (req, res) => {
  try {
    const [[order]] = await db.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const [items] = await db.query('SELECT * FROM order_items WHERE order_id=?', [req.params.id]);
    res.json({ ...order, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create order
router.post('/', auth, async (req, res) => {
  const { customer_name, customer_ledger_id, date, notes, items } = req.body;
  if (!customer_name?.trim()) return res.status(400).json({ error: 'Customer name is required.' });
  if (!items?.length) return res.status(400).json({ error: 'At least one item is required.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Generate order number
    const [[{ cnt }]] = await conn.query('SELECT COUNT(*) as cnt FROM orders');
    const order_number = `ORD-${String(cnt + 1).padStart(4, '0')}`;

    const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 1), 0);

    const [r] = await conn.query(
      'INSERT INTO orders (order_number, customer_name, customer_ledger_id, date, notes, total, created_by) VALUES (?,?,?,?,?,?,?)',
      [order_number, customer_name.trim(), customer_ledger_id || null, date, notes || null, total, req.user.id]
    );
    const order_id = r.insertId;

    for (const item of items) {
      const subtotal = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1);
      await conn.query(
        'INSERT INTO order_items (order_id, item_id, item_name, quantity, price, unit, subtotal) VALUES (?,?,?,?,?,?,?)',
        [order_id, item.item_id || null, item.item_name, parseFloat(item.quantity) || 1, parseFloat(item.price) || 0, item.unit || null, subtotal]
      );
    }

    await conn.commit();
    res.json({ id: order_id, order_number, total });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Update order status
router.put('/:id/status', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const { status } = req.body;
  try {
    await db.query('UPDATE orders SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete order
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM order_items WHERE order_id=?', [req.params.id]);
    await conn.query('DELETE FROM orders WHERE id=?', [req.params.id]);
    await conn.commit();
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
