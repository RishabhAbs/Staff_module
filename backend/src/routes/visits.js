const router  = require('express').Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/visits');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
};

function distMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// GET /api/visits/lookup?name=  — auto-fill details for a known customer
router.get('/lookup', auth, async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.json(null);
  try {
    const [[row]] = await db.query('SELECT * FROM visit_customers WHERE customer_name = ? LIMIT 1', [name]);
    res.json(row || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/visits/nearby?lat=&lng=&radius=  — other parties near a point
router.get('/nearby', auth, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Number(req.query.radius) || 2000;
  if (!isFinite(lat) || !isFinite(lng)) return res.json([]);
  try {
    const [rows] = await db.query(
      'SELECT id, customer_name, gst_number, phone, dealer_name, category, latitude, longitude FROM visit_customers WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
    );
    const near = rows
      .map(r => ({ ...r, distance: Math.round(distMetres(lat, lng, Number(r.latitude), Number(r.longitude))) }))
      .filter(r => r.distance <= radius && r.distance > 0)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 50);
    res.json(near);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/visits  — punch a visit
router.post('/', auth, upload.single('shop_photo'), async (req, res) => {
  try {
    const {
      customer_name, gst_number, phone, dealer_name, category,
      address, district, state, pin_no, contact_person, alternative_no, email, pan_no,
      visit_status, comment, latitude, longitude,
    } = req.body;
    if (!customer_name?.trim()) return res.status(400).json({ error: 'Customer name is required.' });
    const lat = latitude ? Number(latitude) : null;
    const lng = longitude ? Number(longitude) : null;
    const photo = req.file ? `/uploads/visits/${req.file.filename}` : null;

    const [[existing]] = await db.query('SELECT id FROM visit_customers WHERE customer_name = ?', [customer_name.trim()]);
    let customerId;
    if (existing) {
      customerId = existing.id;
      await db.query(
        `UPDATE visit_customers SET gst_number=COALESCE(NULLIF(?,''), gst_number),
           phone=COALESCE(NULLIF(?,''), phone), dealer_name=COALESCE(NULLIF(?,''), dealer_name),
           category=COALESCE(NULLIF(?,''), category),
           address=COALESCE(NULLIF(?,''), address), district=COALESCE(NULLIF(?,''), district),
           state=COALESCE(NULLIF(?,''), state), pin_no=COALESCE(NULLIF(?,''), pin_no),
           contact_person=COALESCE(NULLIF(?,''), contact_person), alternative_no=COALESCE(NULLIF(?,''), alternative_no),
           email=COALESCE(NULLIF(?,''), email), pan_no=COALESCE(NULLIF(?,''), pan_no),
           latitude=COALESCE(?, latitude), longitude=COALESCE(?, longitude)
         WHERE id=?`,
        [gst_number || '', phone || '', dealer_name || '', category || '',
         address || '', district || '', state || '', pin_no || '',
         contact_person || '', alternative_no || '', email || '', pan_no || '',
         lat, lng, customerId]
      );
    } else {
      const [r] = await db.query(
        `INSERT INTO visit_customers (customer_name, gst_number, phone, dealer_name, category,
           address, district, state, pin_no, contact_person, alternative_no, email, pan_no,
           latitude, longitude, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [customer_name.trim(), gst_number || null, phone || null, dealer_name || null, category || null,
         address || null, district || null, state || null, pin_no || null,
         contact_person || null, alternative_no || null, email || null, pan_no || null,
         lat, lng, req.user.id]
      );
      customerId = r.insertId;
    }

    const [log] = await db.query(
      `INSERT INTO visit_logs (customer_id, customer_name, gst_number, phone, dealer_name, category,
         address, district, state, pin_no, contact_person, alternative_no, email, pan_no,
         visit_status, comment, latitude, longitude, shop_photo, salesperson_id, salesperson_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, customer_name.trim(), gst_number || null, phone || null, dealer_name || null, category || null,
       address || null, district || null, state || null, pin_no || null,
       contact_person || null, alternative_no || null, email || null, pan_no || null,
       visit_status || null, comment || null, lat, lng, photo, req.user.id, req.user.name || null]
    );

    if (lat != null && lng != null) {
      await db.query('UPDATE staff SET last_lat=?, last_lng=?, last_seen=NOW() WHERE id=?', [lat, lng, req.user.id]);
    }

    const [[row]] = await db.query('SELECT * FROM visit_logs WHERE id=?', [log.insertId]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/visits/mine  — current user's visit history
router.get('/mine', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM visit_logs WHERE salesperson_id = ? ORDER BY visited_at DESC LIMIT 200', [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/visits/my-customers  — distinct customers the current user has visited
router.get('/my-customers', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT customer_name,
              MAX(visited_at) AS last_visited,
              COUNT(*) AS visit_count,
              SUBSTRING_INDEX(GROUP_CONCAT(gst_number     ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS gst_number,
              SUBSTRING_INDEX(GROUP_CONCAT(phone          ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS phone,
              SUBSTRING_INDEX(GROUP_CONCAT(dealer_name    ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS dealer_name,
              SUBSTRING_INDEX(GROUP_CONCAT(category       ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS category,
              SUBSTRING_INDEX(GROUP_CONCAT(address        ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS address,
              SUBSTRING_INDEX(GROUP_CONCAT(district       ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS district,
              SUBSTRING_INDEX(GROUP_CONCAT(state          ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS state,
              SUBSTRING_INDEX(GROUP_CONCAT(pin_no         ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS pin_no,
              SUBSTRING_INDEX(GROUP_CONCAT(contact_person ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS contact_person,
              SUBSTRING_INDEX(GROUP_CONCAT(alternative_no ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS alternative_no,
              SUBSTRING_INDEX(GROUP_CONCAT(email          ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS email,
              SUBSTRING_INDEX(GROUP_CONCAT(pan_no         ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS pan_no
       FROM visit_logs
       WHERE salesperson_id = ?
       GROUP BY customer_name
       ORDER BY last_visited DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/visits/my-customer?name=  — current user's visits to one customer
router.get('/my-customer', auth, async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.json([]);
  try {
    const [rows] = await db.query(
      'SELECT * FROM visit_logs WHERE salesperson_id = ? AND customer_name = ? ORDER BY visited_at DESC',
      [req.user.id, name]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/visits/all  — admin: every visit
router.get('/all', auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM visit_logs ORDER BY visited_at DESC LIMIT 1000');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/visits/by-staff/:id  — admin: one salesperson's visits
router.get('/by-staff/:id', auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM visit_logs WHERE salesperson_id = ? ORDER BY visited_at DESC LIMIT 300', [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/visits/by-staff/:id/customers?date=YYYY-MM-DD  — admin: distinct customers a salesperson visited (optionally on one date)
router.get('/by-staff/:id/customers', auth, adminOnly, async (req, res) => {
  const date = (req.query.date || '').trim();
  const params = [req.params.id];
  let dateClause = '';
  if (date) { dateClause = ' AND DATE(visited_at) = ?'; params.push(date); }
  try {
    const [rows] = await db.query(
      `SELECT customer_name,
              MAX(visited_at) AS last_visited,
              COUNT(*) AS visit_count,
              SUBSTRING_INDEX(GROUP_CONCAT(gst_number     ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS gst_number,
              SUBSTRING_INDEX(GROUP_CONCAT(phone          ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS phone,
              SUBSTRING_INDEX(GROUP_CONCAT(dealer_name    ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS dealer_name,
              SUBSTRING_INDEX(GROUP_CONCAT(category       ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS category,
              SUBSTRING_INDEX(GROUP_CONCAT(address        ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS address,
              SUBSTRING_INDEX(GROUP_CONCAT(district       ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS district,
              SUBSTRING_INDEX(GROUP_CONCAT(state          ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS state,
              SUBSTRING_INDEX(GROUP_CONCAT(pin_no         ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS pin_no,
              SUBSTRING_INDEX(GROUP_CONCAT(contact_person ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS contact_person,
              SUBSTRING_INDEX(GROUP_CONCAT(alternative_no ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS alternative_no,
              SUBSTRING_INDEX(GROUP_CONCAT(email          ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS email,
              SUBSTRING_INDEX(GROUP_CONCAT(pan_no         ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS pan_no
       FROM visit_logs
       WHERE salesperson_id = ?${dateClause}
       GROUP BY customer_name
       ORDER BY last_visited DESC`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/visits/by-staff/:id/customer?name=  — admin: a salesperson's visits to one customer
router.get('/by-staff/:id/customer', auth, adminOnly, async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.json([]);
  try {
    const [rows] = await db.query(
      'SELECT * FROM visit_logs WHERE salesperson_id = ? AND customer_name = ? ORDER BY visited_at DESC',
      [req.params.id, name]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/visits/by-staff/:id/customer  — admin: edit a salesperson's customer (their logs + master)
router.put('/by-staff/:id/customer', auth, adminOnly, async (req, res) => {
  const {
    original_name, customer_name, gst_number, phone, dealer_name, category,
    address, district, state, pin_no, contact_person, alternative_no, email, pan_no,
  } = req.body;
  const orig = (original_name || '').trim();
  const name = (customer_name || '').trim();
  if (!orig) return res.status(400).json({ error: 'Original customer name is required.' });
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });
  try {
    const vals = [
      name, gst_number || null, phone || null, dealer_name || null, category || null,
      address || null, district || null, state || null, pin_no || null,
      contact_person || null, alternative_no || null, email || null, pan_no || null,
    ];

    // Master first — a rename collision throws before any log is touched
    await db.query(
      `UPDATE visit_customers SET customer_name=?, gst_number=?, phone=?, dealer_name=?, category=?,
         address=?, district=?, state=?, pin_no=?, contact_person=?, alternative_no=?, email=?, pan_no=?
       WHERE customer_name=?`,
      [...vals, orig]
    );

    await db.query(
      `UPDATE visit_logs SET customer_name=?, gst_number=?, phone=?, dealer_name=?, category=?,
         address=?, district=?, state=?, pin_no=?, contact_person=?, alternative_no=?, email=?, pan_no=?
       WHERE salesperson_id=? AND customer_name=?`,
      [...vals, req.params.id, orig]
    );

    res.json({ success: true, message: 'Customer updated successfully.' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A customer with that name already exists.' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/visits/by-staff/:id/customer?name=  — admin: remove a salesperson's customer (all their visits)
router.delete('/by-staff/:id/customer', auth, adminOnly, async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });
  try {
    const [r] = await db.query('DELETE FROM visit_logs WHERE salesperson_id=? AND customer_name=?', [req.params.id, name]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No visits found for this customer.' });
    res.json({ success: true, deleted: r.affectedRows, message: 'Customer removed.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/visits/customer  — current user edits one of their customers (all their logs + master)
router.put('/customer', auth, async (req, res) => {
  const {
    original_name, customer_name, gst_number, phone, dealer_name, category,
    address, district, state, pin_no, contact_person, alternative_no, email, pan_no,
  } = req.body;
  const orig = (original_name || '').trim();
  const name = (customer_name || '').trim();
  if (!orig) return res.status(400).json({ error: 'Original customer name is required.' });
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });
  try {
    const vals = [
      name, gst_number || null, phone || null, dealer_name || null, category || null,
      address || null, district || null, state || null, pin_no || null,
      contact_person || null, alternative_no || null, email || null, pan_no || null,
    ];

    // Update master first — if renaming collides with another customer, this throws before logs change
    await db.query(
      `UPDATE visit_customers SET customer_name=?, gst_number=?, phone=?, dealer_name=?, category=?,
         address=?, district=?, state=?, pin_no=?, contact_person=?, alternative_no=?, email=?, pan_no=?
       WHERE customer_name=?`,
      [...vals, orig]
    );

    // Update this salesperson's visit logs for that customer
    await db.query(
      `UPDATE visit_logs SET customer_name=?, gst_number=?, phone=?, dealer_name=?, category=?,
         address=?, district=?, state=?, pin_no=?, contact_person=?, alternative_no=?, email=?, pan_no=?
       WHERE salesperson_id=? AND customer_name=?`,
      [...vals, req.user.id, orig]
    );

    res.json({ success: true, message: 'Customer updated successfully.' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A customer with that name already exists.' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/visits/customer?name=  — current user removes a customer (all their visits to it)
router.delete('/customer', auth, async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });
  try {
    const [r] = await db.query('DELETE FROM visit_logs WHERE salesperson_id=? AND customer_name=?', [req.user.id, name]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No visits found for this customer.' });
    res.json({ success: true, deleted: r.affectedRows, message: 'Customer removed from your list.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/visits/:id  — edit a visit
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const {
      customer_name, gst_number, phone, dealer_name, category,
      address, district, state, pin_no, contact_person, alternative_no, email, pan_no,
      visit_status, comment,
    } = req.body;
    if (!customer_name?.trim()) return res.status(400).json({ error: 'Customer name is required.' });

    await db.query(
      `UPDATE visit_logs SET customer_name = ?, gst_number = ?, phone = ?, dealer_name = ?, category = ?,
         address = ?, district = ?, state = ?, pin_no = ?, contact_person = ?, alternative_no = ?,
         email = ?, pan_no = ?, visit_status = ?, comment = ? WHERE id = ?`,
      [customer_name.trim(), gst_number || null, phone || null, dealer_name || null, category || null,
       address || null, district || null, state || null, pin_no || null, contact_person || null,
       alternative_no || null, email || null, pan_no || null, visit_status || null, comment || null,
       req.params.id]
    );

    // Also optionally update the customer record in visit_customers if it exists
    const [[log]] = await db.query('SELECT * FROM visit_logs WHERE id = ?', [req.params.id]);
    if (log && log.customer_id) {
      await db.query(
        `UPDATE visit_customers SET customer_name = ?, gst_number = ?, phone = ?, dealer_name = ?, category = ?,
           address = ?, district = ?, state = ?, pin_no = ?, contact_person = ?, alternative_no = ?,
           email = ?, pan_no = ? WHERE id = ?`,
        [customer_name.trim(), gst_number || null, phone || null, dealer_name || null, category || null,
         address || null, district || null, state || null, pin_no || null, contact_person || null,
         alternative_no || null, email || null, pan_no || null, log.customer_id]
      );
    }

    res.json({ success: true, message: 'Visit updated successfully.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/visits/:id  — delete a visit
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM visit_logs WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Visit not found.' });
    res.json({ success: true, message: 'Visit deleted successfully.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
