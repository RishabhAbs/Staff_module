const router = require('express').Router();
const dayjs = require('dayjs');
const db = require('../db');
const auth = require('../middleware/auth');

const OFFICE = {
  checkinStart:  10 * 60,      // 10:00 AM
  halfDayOut:    16 * 60 + 30, // 4:30 PM
  earlyLeaveOut: 18 * 60 + 30, // 6:30 PM
};

function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function checkinStatus(time) {
  const min = toMin(time);
  if (min === null) return 'absent';
  return min > OFFICE.checkinStart ? 'late_comer' : 'present';
}

function checkoutStatus(time, currentStatus) {
  const min = toMin(time);
  if (min === null) return currentStatus;
  if (min < OFFICE.halfDayOut)    return 'half_day';
  if (min < OFFICE.earlyLeaveOut) return 'early_leave';
  return currentStatus;
}

// POST /api/attendance/checkin
router.post('/checkin', auth, async (req, res) => {
  const { latitude, longitude, address } = req.body;
  const today  = dayjs().format('YYYY-MM-DD');
  const time   = dayjs().format('HH:mm:ss');
  const status = checkinStatus(time);
  try {
    const [existing] = await db.query(
      'SELECT id FROM attendance WHERE staff_id = ? AND date = ?',
      [req.user.id, today]
    );
    if (existing[0]) return res.status(400).json({ message: 'Already checked in today' });

    await db.query(
      'INSERT INTO attendance (staff_id, date, check_in, check_in_lat, check_in_lng, address, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, today, time, latitude || null, longitude || null, address || null, status]
    );
    res.json({ message: 'Checked in', time, status });
  } catch (err) {
    console.error('checkin error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// POST /api/attendance/checkout
router.post('/checkout', auth, async (req, res) => {
  const today = dayjs().format('YYYY-MM-DD');
  const time  = dayjs().format('HH:mm:ss');
  try {
    const [rows] = await db.query(
      'SELECT * FROM attendance WHERE staff_id = ? AND date = ?',
      [req.user.id, today]
    );
    if (!rows[0]) return res.status(400).json({ message: 'No check-in found for today' });

    const status = checkoutStatus(time, rows[0].status);
    await db.query(
      'UPDATE attendance SET check_out = ?, status = ? WHERE staff_id = ? AND date = ?',
      [time, status, req.user.id, today]
    );
    res.json({ message: 'Checked out', time, status });
  } catch (err) {
    console.error('checkout error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// GET /api/attendance/my-report?month=YYYY-MM
router.get('/my-report', auth, async (req, res) => {
  const month = req.query.month || dayjs().format('YYYY-MM');
  try {
    const [rows] = await db.query(
      'SELECT * FROM attendance WHERE staff_id = ? AND date LIKE ? ORDER BY date ASC',
      [req.user.id, `${month}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('my-report error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// GET /api/attendance/my-monthly?year=YYYY
router.get('/my-monthly', auth, async (req, res) => {
  const year = req.query.year || dayjs().year();
  try {
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(date,'%Y-%m') as month,
        COUNT(*) as total,
        SUM(status='present') as present,
        SUM(status='absent') as absent,
        SUM(status='half_day') as half_day,
        SUM(status='late_comer') as late_comer,
        SUM(status='early_leave') as early_leave
       FROM attendance WHERE staff_id = ? AND YEAR(date) = ?
       GROUP BY month ORDER BY month`,
      [req.user.id, year]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// GET /api/attendance/report?date=YYYY-MM-DD  (admin — all staff for a date)
router.get('/report', auth, async (req, res) => {
  const date = req.query.date || dayjs().format('YYYY-MM-DD');
  try {
    const [rows] = await db.query(
      `SELECT a.*, s.name, s.username FROM attendance a
       JOIN staff s ON a.staff_id = s.id
       WHERE a.date = ? ORDER BY s.name`,
      [date]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// GET /api/attendance/monthly?userId=&month=  (admin)
router.get('/monthly', auth, async (req, res) => {
  const { userId, month } = req.query;
  try {
    const [rows] = await db.query(
      'SELECT * FROM attendance WHERE staff_id = ? AND date LIKE ? ORDER BY date ASC',
      [userId, `${month}%`]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// POST /api/attendance/force  (admin override)
router.post('/force', auth, async (req, res) => {
  const { staffId, date, status, check_in, check_out } = req.body;
  try {
    await db.query(
      `INSERT INTO attendance (staff_id, date, status, check_in, check_out)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         check_in = COALESCE(VALUES(check_in), check_in),
         check_out = COALESCE(VALUES(check_out), check_out)`,
      [staffId, date, status || 'present', check_in || null, check_out || null]
    );
    res.json({ message: 'Updated' });
  } catch (err) {
    console.error('force error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// GET /api/attendance/holidays?year=
router.get('/holidays', auth, async (req, res) => {
  const year = req.query.year || dayjs().year();
  try {
    const [rows] = await db.query(
      'SELECT * FROM holidays WHERE YEAR(date) = ? ORDER BY date',
      [year]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// POST /api/attendance/holidays
router.post('/holidays', auth, async (req, res) => {
  const { name, date } = req.body;
  try {
    const [result] = await db.query('INSERT INTO holidays (name, date) VALUES (?, ?)', [name, date]);
    res.json({ id: result.insertId, name, date });
  } catch (err) {
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// DELETE /api/attendance/holidays/:id
router.delete('/holidays/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM holidays WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

module.exports = router;
