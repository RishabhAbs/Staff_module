const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// POST /api/location/update
router.post('/update', auth, async (req, res) => {
  const { latitude, longitude, accuracy } = req.body;
  await db.query(
    'INSERT INTO location_history (staff_id, latitude, longitude, accuracy, recorded_at) VALUES (?, ?, ?, ?, NOW())',
    [req.user.id, latitude, longitude, accuracy || null]
  );
  // Also update last known location on staff table
  await db.query('UPDATE staff SET last_lat = ?, last_lng = ?, last_seen = NOW() WHERE id = ?', [latitude, longitude, req.user.id]);
  res.json({ message: 'Location updated' });
});

// GET /api/location/history?staffId=&date=
router.get('/history', auth, async (req, res) => {
  const { staffId, date } = req.query;
  const id = staffId || req.user.id;
  const [rows] = await db.query(
    'SELECT * FROM location_history WHERE staff_id = ? AND DATE(recorded_at) = ? ORDER BY recorded_at ASC',
    [id, date]
  );
  res.json(rows);
});

// GET /api/location/all-staff  (admin)
router.get('/all-staff', auth, async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, name, username, last_lat, last_lng, last_seen FROM staff WHERE status = "active" AND last_lat IS NOT NULL'
  );
  res.json(rows);
});

module.exports = router;
