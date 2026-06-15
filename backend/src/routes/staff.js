const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../middleware/auth');

const PROFILE_FIELDS = `
  id, name, username, role, status, email, phone, created_at,
  two_fa_secret as twoFaSecret, two_fa_setup as twoFaSetup,
  employee_id, department, designation, employment_type, date_of_joining,
  work_location, company_phone,
  date_of_birth, gender, marital_status, nationality, blood_group,
  personal_email, current_address, permanent_address,
  emergency_contact_name, emergency_contact_rel, emergency_contact_phone,
  father_name, mother_name, spouse_name, family_mobile,
  pan_number, aadhaar_number, passport_number, uan_number, pf_number, esic_number,
  highest_qualification, specialization,
  prev_company, prev_designation, total_experience, last_drawn_salary,
  bank_name, account_holder, account_number, ifsc_code, branch_name,
  phones, personal_emails, emergency_contacts, previous_employments, bank_details, salary_details, shift, permissions, checkin_policy
`;

// GET /api/staff
router.get('/', auth, async (req, res) => {
  const [rows] = await db.query(`SELECT ${PROFILE_FIELDS} FROM staff ORDER BY created_at DESC`);
  const users = rows.map(u => ({ ...u, number: u.phone, twoFaSetup: !!u.twoFaSetup }));
  res.json(users);
});

// GET /api/staff/:id
router.get('/:id', auth, async (req, res) => {
  const [rows] = await db.query(`SELECT ${PROFILE_FIELDS} FROM staff WHERE id = ?`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Not found' });
  res.json({ ...rows[0], number: rows[0].phone, twoFaSetup: !!rows[0].twoFaSetup });
});

// POST /api/staff/create
router.post('/create', auth, async (req, res) => {
  const {
    name, username, password, role = 'user', email, phone, number, twoFaSecret,
    employee_id, department, designation, employment_type, date_of_joining, work_location, company_phone,
    date_of_birth, gender, marital_status, nationality, blood_group, personal_email,
    current_address, permanent_address, emergency_contact_name, emergency_contact_rel, emergency_contact_phone,
    father_name, mother_name, spouse_name, family_mobile,
    pan_number, aadhaar_number, passport_number, uan_number, pf_number, esic_number,
    highest_qualification, specialization,
    prev_company, prev_designation, total_experience, last_drawn_salary,
    bank_name, account_holder, account_number, ifsc_code, branch_name,
    phones, personal_emails, emergency_contacts, previous_employments, bank_details, salary_details, shift, permissions, checkin_policy,
  } = req.body;
  const phoneVal = phone || number || null;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(`
      INSERT INTO staff (
        name, username, password, role, email, phone, status, two_fa_secret, two_fa_setup,
        employee_id, department, designation, employment_type, date_of_joining, work_location, company_phone,
        date_of_birth, gender, marital_status, nationality, blood_group, personal_email,
        current_address, permanent_address, emergency_contact_name, emergency_contact_rel, emergency_contact_phone,
        father_name, mother_name, spouse_name, family_mobile,
        pan_number, aadhaar_number, passport_number, uan_number, pf_number, esic_number,
        highest_qualification, specialization,
        prev_company, prev_designation, total_experience, last_drawn_salary,
        bank_name, account_holder, account_number, ifsc_code, branch_name,
        phones, personal_emails, emergency_contacts, previous_employments, bank_details, salary_details, shift, permissions, checkin_policy
      ) VALUES (
        ?,?,?,?,?,?,'active',?,0,
        ?,?,?,?,?,?,?,
        ?,?,?,?,?,?,
        ?,?,?,?,?,
        ?,?,?,?,
        ?,?,?,?,?,?,
        ?,?,
        ?,?,?,?,
        ?,?,?,?,?,
        ?,?,?,?,?,?,?,?,?
      )`,
      [
        name, username, hashed, role, email || null, phoneVal, twoFaSecret || null,
        employee_id||null, department||null, designation||null, employment_type||null, date_of_joining||null, work_location||null, company_phone||null,
        date_of_birth||null, gender||null, marital_status||null, nationality||null, blood_group||null, personal_email||null,
        current_address||null, permanent_address||null, emergency_contact_name||null, emergency_contact_rel||null, emergency_contact_phone||null,
        father_name||null, mother_name||null, spouse_name||null, family_mobile||null,
        pan_number||null, aadhaar_number||null, passport_number||null, uan_number||null, pf_number||null, esic_number||null,
        highest_qualification||null, specialization||null,
        prev_company||null, prev_designation||null, total_experience||null, last_drawn_salary||null,
        bank_name||null, account_holder||null, account_number||null, ifsc_code||null, branch_name||null,
        phones ? JSON.stringify(phones) : null,
        personal_emails ? JSON.stringify(personal_emails) : null,
        emergency_contacts ? JSON.stringify(emergency_contacts) : null,
        previous_employments ? JSON.stringify(previous_employments) : null,
        bank_details ? JSON.stringify(bank_details) : null,
        salary_details ? JSON.stringify(salary_details) : null,
        shift || 'day',
        permissions ? JSON.stringify(permissions) : JSON.stringify({ checkin_outside: false }),
        checkin_policy || 'always',
      ]
    );
    res.json({ id: result.insertId, name, username, role, status: 'active', phone: phoneVal, number: phoneVal, twoFaSecret: twoFaSecret || null, twoFaSetup: false, permissions: permissions || { checkin_outside: false }, checkin_policy: checkin_policy || 'always' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Username already exists' });
    console.error('create staff error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// PUT /api/staff/:id
router.put('/:id', auth, async (req, res) => {
  const {
    name, email, phone, number, status, role,
    employee_id, department, designation, employment_type, date_of_joining, work_location, company_phone,
    date_of_birth, gender, marital_status, nationality, blood_group, personal_email,
    current_address, permanent_address, emergency_contact_name, emergency_contact_rel, emergency_contact_phone,
    father_name, mother_name, spouse_name, family_mobile,
    pan_number, aadhaar_number, passport_number, uan_number, pf_number, esic_number,
    highest_qualification, specialization,
    prev_company, prev_designation, total_experience, last_drawn_salary,
    bank_name, account_holder, account_number, ifsc_code, branch_name,
    password,
    phones, personal_emails, emergency_contacts, previous_employments, bank_details, salary_details, shift, permissions, checkin_policy,
  } = req.body;
  const phoneVal = phone || number || null;
  try {
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      await db.query('UPDATE staff SET password=? WHERE id=?', [hashed, req.params.id]);
    }
    await db.query(`
      UPDATE staff SET
        name=?, email=?, phone=?, status=?, role=?,
        employee_id=?, department=?, designation=?, employment_type=?, date_of_joining=?, work_location=?, company_phone=?,
        date_of_birth=?, gender=?, marital_status=?, nationality=?, blood_group=?, personal_email=?,
        current_address=?, permanent_address=?, emergency_contact_name=?, emergency_contact_rel=?, emergency_contact_phone=?,
        father_name=?, mother_name=?, spouse_name=?, family_mobile=?,
        pan_number=?, aadhaar_number=?, passport_number=?, uan_number=?, pf_number=?, esic_number=?,
        highest_qualification=?, specialization=?,
        prev_company=?, prev_designation=?, total_experience=?, last_drawn_salary=?,
        bank_name=?, account_holder=?, account_number=?, ifsc_code=?, branch_name=?,
        phones=?, personal_emails=?, emergency_contacts=?, previous_employments=?, bank_details=?, salary_details=?, shift=?, permissions=?, checkin_policy=?
      WHERE id=?`,
      [
        name, email||null, phoneVal, status, role,
        employee_id||null, department||null, designation||null, employment_type||null, date_of_joining||null, work_location||null, company_phone||null,
        date_of_birth||null, gender||null, marital_status||null, nationality||null, blood_group||null, personal_email||null,
        current_address||null, permanent_address||null, emergency_contact_name||null, emergency_contact_rel||null, emergency_contact_phone||null,
        father_name||null, mother_name||null, spouse_name||null, family_mobile||null,
        pan_number||null, aadhaar_number||null, passport_number||null, uan_number||null, pf_number||null, esic_number||null,
        highest_qualification||null, specialization||null,
        prev_company||null, prev_designation||null, total_experience||null, last_drawn_salary||null,
        bank_name||null, account_holder||null, account_number||null, ifsc_code||null, branch_name||null,
        phones ? JSON.stringify(phones) : null,
        personal_emails ? JSON.stringify(personal_emails) : null,
        emergency_contacts ? JSON.stringify(emergency_contacts) : null,
        previous_employments ? JSON.stringify(previous_employments) : null,
        bank_details ? JSON.stringify(bank_details) : null,
        salary_details ? JSON.stringify(salary_details) : null,
        shift || 'day',
        permissions ? JSON.stringify(permissions) : JSON.stringify({ checkin_outside: false }),
        checkin_policy || 'always',
        req.params.id,
      ]
    );
    res.json({ message: 'Updated' });
  } catch (err) {
    console.error('update staff error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// PUT /api/staff/:id/2fa
router.put('/:id/2fa', auth, async (req, res) => {
  const { setup, secret } = req.body;
  if (secret !== undefined) {
    await db.query('UPDATE staff SET two_fa_secret=?, two_fa_setup=0 WHERE id=?', [secret, req.params.id]);
  } else {
    await db.query('UPDATE staff SET two_fa_setup=? WHERE id=?', [setup ? 1 : 0, req.params.id]);
  }
  res.json({ message: 'Updated' });
});

// DELETE /api/staff/:id
router.delete('/:id', auth, async (req, res) => {
  await db.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

module.exports = router;
