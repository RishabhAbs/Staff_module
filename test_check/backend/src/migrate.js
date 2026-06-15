const db = require('./db');
const bcrypt = require('bcryptjs');

// Adds a column only if it doesn't already exist
async function addColumnIfMissing(conn, table, column, definition) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (rows[0].cnt === 0) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`  + Added column ${table}.${column}`);
  }
}

async function migrate() {
  console.log('Running database migrations...');
  const conn = await db.getConnection();
  try {

    // ── staff ──────────────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        name          VARCHAR(100) NOT NULL,
        username      VARCHAR(50)  NOT NULL UNIQUE,
        password      VARCHAR(255) NOT NULL,
        role          ENUM('admin','user') DEFAULT 'user',
        email         VARCHAR(100),
        phone         VARCHAR(20),
        status        ENUM('active','inactive') DEFAULT 'active',
        two_fa_secret VARCHAR(64),
        two_fa_setup  TINYINT(1) DEFAULT 0,
        last_lat      DECIMAL(10,8),
        last_lng      DECIMAL(11,8),
        last_seen     DATETIME,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await addColumnIfMissing(conn, 'staff', 'email',              'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'phone',              'VARCHAR(20)');
    await addColumnIfMissing(conn, 'staff', 'two_fa_secret',      'VARCHAR(64)');
    await addColumnIfMissing(conn, 'staff', 'two_fa_setup',       'TINYINT(1) DEFAULT 0');
    await addColumnIfMissing(conn, 'staff', 'last_lat',           'DECIMAL(10,8)');
    await addColumnIfMissing(conn, 'staff', 'last_lng',           'DECIMAL(11,8)');
    await addColumnIfMissing(conn, 'staff', 'last_seen',          'DATETIME');
    // Extended profile fields
    await addColumnIfMissing(conn, 'staff', 'employee_id',        'VARCHAR(50)');
    await addColumnIfMissing(conn, 'staff', 'department',         'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'designation',        'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'employment_type',    'VARCHAR(50)');
    await addColumnIfMissing(conn, 'staff', 'date_of_joining',    'DATE');
    await addColumnIfMissing(conn, 'staff', 'work_location',      'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'company_phone',      'VARCHAR(20)');
    // Personal details
    await addColumnIfMissing(conn, 'staff', 'date_of_birth',      'DATE');
    await addColumnIfMissing(conn, 'staff', 'gender',             'VARCHAR(20)');
    await addColumnIfMissing(conn, 'staff', 'marital_status',     'VARCHAR(20)');
    await addColumnIfMissing(conn, 'staff', 'nationality',        'VARCHAR(50)');
    await addColumnIfMissing(conn, 'staff', 'blood_group',        'VARCHAR(10)');
    await addColumnIfMissing(conn, 'staff', 'personal_email',     'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'current_address',    'TEXT');
    await addColumnIfMissing(conn, 'staff', 'permanent_address',  'TEXT');
    await addColumnIfMissing(conn, 'staff', 'emergency_contact_name', 'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'emergency_contact_rel',  'VARCHAR(50)');
    await addColumnIfMissing(conn, 'staff', 'emergency_contact_phone','VARCHAR(20)');
    // Family details
    await addColumnIfMissing(conn, 'staff', 'father_name',        'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'mother_name',        'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'spouse_name',        'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'family_mobile',      'VARCHAR(20)');
    // Identity & compliance
    await addColumnIfMissing(conn, 'staff', 'pan_number',         'VARCHAR(20)');
    await addColumnIfMissing(conn, 'staff', 'aadhaar_number',     'VARCHAR(20)');
    await addColumnIfMissing(conn, 'staff', 'passport_number',    'VARCHAR(20)');
    await addColumnIfMissing(conn, 'staff', 'uan_number',         'VARCHAR(20)');
    await addColumnIfMissing(conn, 'staff', 'pf_number',          'VARCHAR(20)');
    await addColumnIfMissing(conn, 'staff', 'esic_number',        'VARCHAR(20)');
    // Educational details
    await addColumnIfMissing(conn, 'staff', 'highest_qualification', 'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'specialization',     'VARCHAR(100)');
    // Previous employment
    await addColumnIfMissing(conn, 'staff', 'prev_company',       'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'prev_designation',   'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'total_experience',   'VARCHAR(50)');
    await addColumnIfMissing(conn, 'staff', 'last_drawn_salary',  'VARCHAR(50)');
    // Bank details
    await addColumnIfMissing(conn, 'staff', 'bank_name',          'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'account_holder',     'VARCHAR(100)');
    await addColumnIfMissing(conn, 'staff', 'account_number',     'VARCHAR(50)');
    await addColumnIfMissing(conn, 'staff', 'ifsc_code',          'VARCHAR(20)');
    await addColumnIfMissing(conn, 'staff', 'branch_name',        'VARCHAR(100)');

    // Dynamic Array Fields (JSON)
    await addColumnIfMissing(conn, 'staff', 'phones',               'JSON');
    await addColumnIfMissing(conn, 'staff', 'personal_emails',      'JSON');
    await addColumnIfMissing(conn, 'staff', 'emergency_contacts',   'JSON');
    await addColumnIfMissing(conn, 'staff', 'previous_employments', 'JSON');
    await addColumnIfMissing(conn, 'staff', 'bank_details',         'JSON');
    // ── attendance ─────────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        staff_id     INT NOT NULL,
        date         DATE NOT NULL,
        check_in     TIME,
        check_out    TIME,
        check_in_lat DECIMAL(10,8),
        check_in_lng DECIMAL(11,8),
        address      VARCHAR(255),
        status       ENUM('present','absent','late_comer','half_day','early_leave','sunday','holiday') DEFAULT 'absent',
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_staff_date (staff_id, date),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      )
    `);
    await addColumnIfMissing(conn, 'attendance', 'check_in_lat', 'DECIMAL(10,8)');
    await addColumnIfMissing(conn, 'attendance', 'check_in_lng', 'DECIMAL(11,8)');
    await addColumnIfMissing(conn, 'attendance', 'address',      'VARCHAR(255)');

    // ── holidays ───────────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id   INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        date DATE NOT NULL UNIQUE
      )
    `);

    // ── leave_requests ─────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        staff_id   INT NOT NULL,
        from_date  DATE NOT NULL,
        to_date    DATE NOT NULL,
        reason     TEXT,
        type       VARCHAR(50),
        status     ENUM('pending','approved','rejected') DEFAULT 'pending',
        admin_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      )
    `);
    await addColumnIfMissing(conn, 'leave_requests', 'type',       'VARCHAR(50)');
    await addColumnIfMissing(conn, 'leave_requests', 'admin_note', 'TEXT');

    // ── location_history ───────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS location_history (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        staff_id    INT NOT NULL,
        latitude    DECIMAL(10,8) NOT NULL,
        longitude   DECIMAL(11,8) NOT NULL,
        accuracy    FLOAT,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      )
    `);
    await addColumnIfMissing(conn, 'location_history', 'accuracy', 'FLOAT');

    // ── seed default admin ─────────────────────────────────────────────────────
    const hashed = await bcrypt.hash('admin123', 10);
    const [admins] = await conn.query("SELECT id FROM staff WHERE username = 'admin'");
    if (!admins[0]) {
      await conn.query(
        `INSERT INTO staff (name, username, password, role, status) VALUES ('Admin', 'admin', ?, 'admin', 'active')`,
        [hashed]
      );
      console.log('Default admin created (username: admin, password: admin123)');
    } else {
      await conn.query(
        `UPDATE staff SET password = ?, role = 'admin', status = 'active' WHERE username = 'admin'`,
        [hashed]
      );
      console.log('Admin password refreshed');
    }

    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = migrate;
