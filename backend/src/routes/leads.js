const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
};

// statuses considered "closed" — leads disappear from both working sections
const CLOSED_STATUSES = ['Cancelled', 'Joined', 'Closed'];

async function logAction(leadId, staffId, action, note) {
  try {
    await db.query(
      'INSERT INTO lead_logs (lead_id, staff_id, action, note) VALUES (?,?,?,?)',
      [leadId, staffId || null, action, note || null]
    );
  } catch (_) { /* logging must never break the request */ }
}

// Shared SELECT with handler name joined in
const LEAD_SELECT = `
  SELECT l.*, s.name AS handled_by_name
  FROM leads l
  LEFT JOIN staff s ON s.id = l.handled_by
`;

// GET /api/leads?section=unalloted|pending&handler=&type=&search=
router.get('/', auth, async (req, res) => {
  try {
    const section = (req.query.section || 'unalloted').toLowerCase();
    const handler = req.query.handler ? Number(req.query.handler) : null;
    const type    = (req.query.type || '').trim();
    const search  = (req.query.search || '').trim();

    const where  = [];
    const params = [];

    if (section === 'unalloted') {
      where.push('l.handled_by IS NULL');
      where.push(`l.status NOT IN (${CLOSED_STATUSES.map(() => '?').join(',')})`);
      params.push(...CLOSED_STATUSES);
    } else { // pending
      where.push('l.handled_by IS NOT NULL');
      where.push(`l.status NOT IN (${CLOSED_STATUSES.map(() => '?').join(',')})`);
      params.push(...CLOSED_STATUSES);
    }

    if (handler) { where.push('l.handled_by = ?'); params.push(handler); }
    if (type)    { where.push('l.lead_type = ?');  params.push(type); }
    if (search) {
      where.push('(l.company LIKE ? OR l.contact_person LIKE ? OR l.mobile LIKE ? OR l.remark LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const sql = `${LEAD_SELECT} WHERE ${where.join(' AND ')} ORDER BY l.created_at ASC`;
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/leads/types — distinct lead types for the filter dropdown
router.get('/types', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DISTINCT lead_type FROM leads WHERE lead_type IS NOT NULL AND lead_type <> '' ORDER BY lead_type"
    );
    res.json(rows.map(r => r.lead_type));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const ITEM_KINDS = ['requirement', 'correction', 'update'];

// GET /api/leads/:id/items?kind=requirement|correction|update
router.get('/:id/items', auth, async (req, res) => {
  try {
    const where  = ['li.lead_id = ?'];
    const params = [req.params.id];
    const kind = (req.query.kind || '').toLowerCase();
    if (ITEM_KINDS.includes(kind)) { where.push('li.kind = ?'); params.push(kind); }
    const [rows] = await db.query(
      `SELECT li.*, s.name AS created_by_name
       FROM lead_items li LEFT JOIN staff s ON s.id = li.created_by
       WHERE ${where.join(' AND ')} ORDER BY li.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/leads/:id/items — add a requirement / correction / update
router.post('/:id/items', auth, async (req, res) => {
  try {
    const { description, deadline, amount } = req.body;
    const kind = ITEM_KINDS.includes((req.body.kind || '').toLowerCase())
      ? req.body.kind.toLowerCase() : 'requirement';
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required.' });
    const [[lead]] = await db.query('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    const [result] = await db.query(
      `INSERT INTO lead_items (lead_id, kind, description, deadline, amount, created_by)
       VALUES (?,?,?,?,?,?)`,
      [
        req.params.id, kind, description.trim(),
        deadline || null, (amount === '' || amount == null) ? null : amount, req.user.id,
      ]
    );
    await logAction(req.params.id, req.user.id, `added ${kind}`, description.trim());
    const [[item]] = await db.query(
      `SELECT li.*, s.name AS created_by_name
       FROM lead_items li LEFT JOIN staff s ON s.id = li.created_by WHERE li.id = ?`,
      [result.insertId]
    );
    res.status(201).json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/leads/:id — single lead with its activity log
router.get('/:id', auth, async (req, res) => {
  try {
    const [[lead]] = await db.query(`${LEAD_SELECT} WHERE l.id = ?`, [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    const [logs] = await db.query(
      `SELECT ll.*, s.name AS staff_name
       FROM lead_logs ll LEFT JOIN staff s ON s.id = ll.staff_id
       WHERE ll.lead_id = ? ORDER BY ll.created_at DESC`,
      [req.params.id]
    );
    res.json({ ...lead, logs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/leads — add a new lead
router.post('/', auth, async (req, res) => {
  try {
    const {
      company, contact_person, mobile, email, lead_type, remark,
      handled_by, status, next_followup_at,
    } = req.body;
    if (!mobile?.trim() && !company?.trim()) {
      return res.status(400).json({ error: 'Company or mobile is required.' });
    }
    const [result] = await db.query(
      `INSERT INTO leads
         (company, contact_person, mobile, email, lead_type, remark, handled_by, status, next_followup_at, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        company?.trim() || null, contact_person?.trim() || null, mobile?.trim() || null,
        email?.trim() || null, lead_type?.trim() || null, remark?.trim() || null,
        handled_by || null, status || (handled_by ? 'In Progress' : 'Open'),
        next_followup_at || null, req.user.id,
      ]
    );
    await logAction(result.insertId, req.user.id, 'created', remark || null);
    const [[lead]] = await db.query(`${LEAD_SELECT} WHERE l.id = ?`, [result.insertId]);
    res.status(201).json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/leads/:id — edit lead details
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      company, contact_person, mobile, email, lead_type, remark,
      status, handled_by, next_followup_at,
    } = req.body;
    const [[existing]] = await db.query('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Lead not found.' });
    await db.query(
      `UPDATE leads SET
         company = ?, contact_person = ?, mobile = ?, email = ?, lead_type = ?,
         remark = ?, status = COALESCE(?, status), handled_by = ?, next_followup_at = ?
       WHERE id = ?`,
      [
        company?.trim() || null, contact_person?.trim() || null, mobile?.trim() || null,
        email?.trim() || null, lead_type?.trim() || null, remark?.trim() || null,
        status || null, handled_by ?? null, next_followup_at || null, req.params.id,
      ]
    );
    await logAction(req.params.id, req.user.id, 'updated', remark || null);
    const [[lead]] = await db.query(`${LEAD_SELECT} WHERE l.id = ?`, [req.params.id]);
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/leads/:id/pick — claim an unalloted lead
router.post('/:id/pick', auth, async (req, res) => {
  try {
    const [[lead]] = await db.query('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    if (lead.handled_by) return res.status(409).json({ error: 'Lead already assigned.' });
    await db.query(
      "UPDATE leads SET handled_by = ?, status = 'In Progress', last_contact_at = NOW() WHERE id = ?",
      [req.user.id, req.params.id]
    );
    await logAction(req.params.id, req.user.id, 'picked', null);
    const [[updated]] = await db.query(`${LEAD_SELECT} WHERE l.id = ?`, [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/leads/:id/cancel — cancel a lead
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const { note } = req.body || {};
    const [[lead]] = await db.query('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    await db.query("UPDATE leads SET status = 'Cancelled' WHERE id = ?", [req.params.id]);
    await logAction(req.params.id, req.user.id, 'cancelled', note || null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/leads/:id/join — mark a lead as joined / won
router.post('/:id/join', auth, async (req, res) => {
  try {
    const { note } = req.body || {};
    const [[lead]] = await db.query('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    await db.query("UPDATE leads SET status = 'Joined', last_contact_at = NOW() WHERE id = ?", [req.params.id]);
    await logAction(req.params.id, req.user.id, 'joined', note || null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/leads/:id/transfer — reassign to another staff member (admin)
router.post('/:id/transfer', auth, adminOnly, async (req, res) => {
  try {
    const { handled_by, note } = req.body || {};
    if (!handled_by) return res.status(400).json({ error: 'Target staff is required.' });
    const [[lead]] = await db.query('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    await db.query(
      "UPDATE leads SET handled_by = ?, status = 'In Progress' WHERE id = ?",
      [handled_by, req.params.id]
    );
    await logAction(req.params.id, req.user.id, 'transferred', note || null);
    const [[updated]] = await db.query(`${LEAD_SELECT} WHERE l.id = ?`, [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/leads/:id — admin hard delete
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM leads WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM lead_logs WHERE lead_id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
