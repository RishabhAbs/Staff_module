const router  = require('express').Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const uploadDir = path.join(__dirname, '../../../../uploads/documents');
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

// GET /api/documents  — list all
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.*, s.name AS staff_name, u.name AS uploaded_by_name
      FROM documents d
      LEFT JOIN staff s ON s.id = d.staff_id
      LEFT JOIN staff u ON u.id = d.uploaded_by
      ORDER BY d.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/documents/employee/:staffId — docs for one employee
router.get('/employee/:staffId', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*, u.name AS uploaded_by_name FROM documents d
       LEFT JOIN staff u ON u.id = d.uploaded_by
       WHERE d.staff_id = ? ORDER BY d.created_at DESC`,
      [req.params.staffId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/documents  — upload new doc (supports multiple files)
router.post('/', auth, upload.array('files', 20), async (req, res) => {
  try {
    const { name, category, doc_type, staff_id, gst_number, renewal_date, notes } = req.body;
    const uploadedFiles = req.files || [];
    // Use first file for main file_path/file_name; store all paths in JSON
    const file_path = uploadedFiles[0] ? `/uploads/documents/${uploadedFiles[0].filename}` : null;
    const file_name = uploadedFiles[0] ? uploadedFiles[0].originalname : null;
    const all_files = uploadedFiles.length > 0
      ? JSON.stringify(uploadedFiles.map(f => ({ path: `/uploads/documents/${f.filename}`, name: f.originalname, size: f.size })))
      : null;
    const [result] = await db.query(
      `INSERT INTO documents (name, category, doc_type, staff_id, file_path, file_name, gst_number, renewal_date, notes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category || 'Company', doc_type || 'company',
       staff_id || null, all_files || file_path, file_name,
       gst_number || null, renewal_date || null, notes || null,
       req.user?.id || null]
    );
    const [rows] = await db.query('SELECT * FROM documents WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/documents/:id
router.put('/:id', auth, upload.array('files', 20), async (req, res) => {
  try {
    const { name, category, doc_type, staff_id, gst_number, renewal_date, notes } = req.body;
    const fields = { name, category, doc_type, gst_number: gst_number || null, renewal_date: renewal_date || null, notes: notes || null, staff_id: staff_id || null };
    if (req.files?.length) {
      const uploadedFiles = req.files;
      fields.file_path = JSON.stringify(uploadedFiles.map(f => ({ path: `/uploads/documents/${f.filename}`, name: f.originalname, size: f.size })));
      fields.file_name = uploadedFiles[0].originalname;
    }
    const keys = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
    await db.query(`UPDATE documents SET ${keys} WHERE id = ?`, [...Object.values(fields), req.params.id]);
    const [rows] = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/documents/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT file_path FROM documents WHERE id = ?', [req.params.id]);
    if (rows[0]?.file_path) {
      const abs = path.join(__dirname, '../../../../', rows[0].file_path);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
    await db.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
