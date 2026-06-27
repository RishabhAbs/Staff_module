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
      CREATE TABLE IF NOT EXISTS notifications (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        type       VARCHAR(50) NOT NULL,
        message    TEXT NOT NULL,
        staff_id   INT,
        link       VARCHAR(255),
        is_read    TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ledgers (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(150) NOT NULL UNIQUE,
        type        VARCHAR(50),
        description VARCHAR(255),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS items (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(150) NOT NULL UNIQUE,
        code        VARCHAR(50),
        unit        VARCHAR(30),
        description VARCHAR(255),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        order_number        VARCHAR(20) NOT NULL UNIQUE,
        customer_name       VARCHAR(150) NOT NULL,
        customer_ledger_id  INT,
        date                DATE NOT NULL,
        notes               TEXT,
        total               DECIMAL(12,2) DEFAULT 0,
        status              ENUM('pending','confirmed','delivered','cancelled') DEFAULT 'pending',
        created_by          INT,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        order_id    INT NOT NULL,
        item_id     INT,
        item_name   VARCHAR(150) NOT NULL,
        quantity    DECIMAL(10,2) DEFAULT 1,
        price       DECIMAL(10,2) DEFAULT 0,
        unit        VARCHAR(30),
        subtotal    DECIMAL(12,2) DEFAULT 0,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

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
    await addColumnIfMissing(conn, 'staff', 'salary_details',       'JSON');
    await addColumnIfMissing(conn, 'staff', 'shift',                'VARCHAR(20) DEFAULT "Day Shift"');
    await addColumnIfMissing(conn, 'staff', 'permissions',          'JSON');
    await addColumnIfMissing(conn, 'staff', 'checkin_policy',       "ENUM('always','never','shift_based') DEFAULT 'always'");

    // ── shifts ─────────────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(100) NOT NULL UNIQUE,
        start_time VARCHAR(20) NOT NULL,
        end_time   VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default shifts
    const [existingShifts] = await conn.query("SELECT COUNT(*) as cnt FROM shifts");
    if (existingShifts[0].cnt === 0) {
      await conn.query(`
        INSERT INTO shifts (name, start_time, end_time) VALUES
        ('Day Shift', '09:00 AM', '05:00 PM'),
        ('Evening Shift', '05:00 PM', '01:00 AM'),
        ('Night Shift', '01:00 AM', '09:00 AM')
      `);
      console.log('  + Seeded default shifts successfully.');
    }

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

    // ── tasks ──────────────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        title            VARCHAR(255) NOT NULL,
        description      TEXT,
        assigned_to      INT NOT NULL,
        created_by       INT,
        due_date         DATE NOT NULL,
        priority         ENUM('low','medium','high') DEFAULT 'medium',
        status           ENUM('pending','in_progress','completed','overdue','extension_requested') DEFAULT 'pending',
        completion_note  TEXT,
        extension_reason TEXT,
        extension_date   DATE,
        document_path    VARCHAR(500),
        completed_at     DATETIME,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE CASCADE
      )
    `);
    await addColumnIfMissing(conn, 'tasks', 'document_path', 'VARCHAR(500)');
    await addColumnIfMissing(conn, 'notifications', 'link', 'VARCHAR(255)');

    // ── documents ─────────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        name           VARCHAR(255) NOT NULL,
        category       VARCHAR(100) NOT NULL DEFAULT 'Company',
        doc_type       ENUM('employee','company') DEFAULT 'company',
        staff_id       INT DEFAULT NULL,
        file_path      VARCHAR(500),
        file_name      VARCHAR(255),
        gst_number     VARCHAR(30),
        renewal_date   DATE,
        notes          TEXT,
        uploaded_by    INT,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
      )
    `);
    await addColumnIfMissing(conn, 'documents', 'gst_number',   'VARCHAR(30)');
    await addColumnIfMissing(conn, 'documents', 'renewal_date', 'DATE');
    await addColumnIfMissing(conn, 'documents', 'notes',        'TEXT');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        staff_id     INT NOT NULL,
        title        VARCHAR(255) NOT NULL,
        note         TEXT,
        remind_at    DATETIME NOT NULL,
        repeat_type  ENUM('none','daily','weekly','monthly','yearly') DEFAULT 'none',
        next_trigger DATETIME NOT NULL,
        is_done      TINYINT(1) DEFAULT 0,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      )
    `);
    // Assignment + task linkage for "notify 1 day before & create task" feature
    await addColumnIfMissing(conn, 'reminders', 'assigned_to',  'INT NULL');
    await addColumnIfMissing(conn, 'reminders', 'task_created', 'TINYINT(1) DEFAULT 0');
    await addColumnIfMissing(conn, 'reminders', 'task_id',      'INT NULL');

    // ── reminder masters (category + quick-select presets) ─────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS reminder_categories (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        label      VARCHAR(100) NOT NULL UNIQUE,
        icon       VARCHAR(50)  NOT NULL DEFAULT 'pricetag-outline',
        color      VARCHAR(20)  NOT NULL DEFAULT '#475569',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS reminder_presets (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL,
        title       VARCHAR(255) NOT NULL,
        note        VARCHAR(255),
        repeat_type ENUM('none','daily','weekly','monthly','yearly') DEFAULT 'none',
        sort_order  INT DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES reminder_categories(id) ON DELETE CASCADE
      )
    `);

    // Seed default categories + presets (one-time, only if table is empty)
    const [catCount] = await conn.query('SELECT COUNT(*) AS cnt FROM reminder_categories');
    if (catCount[0].cnt === 0) {
      const seed = [
        { label: 'Tax & GST', icon: 'receipt-outline', color: '#7C3AED', presets: [
          ['GST Return Filing (GSTR-1)', 'Monthly GSTR-1 due on 11th', 'monthly'],
          ['GST Return Filing (GSTR-3B)', 'Monthly GSTR-3B due on 20th', 'monthly'],
          ['GST Annual Return (GSTR-9)', 'Annual GST return filing due 31 Dec', 'yearly'],
          ['TDS Payment', 'TDS deposit due by 7th of month', 'monthly'],
          ['Advance Tax Payment', 'Quarterly advance tax installment', 'monthly'],
          ['Income Tax Return Filing', 'Annual ITR filing deadline', 'yearly'],
        ]},
        { label: 'Duties & Compliance', icon: 'shield-checkmark-outline', color: '#C2410C', presets: [
          ['Import/Export Duty Payment', 'Customs duty clearance', 'monthly'],
          ['PF / EPF Contribution', 'Employee provident fund due 15th', 'monthly'],
          ['ESI Contribution', 'Employee state insurance due 15th', 'monthly'],
          ['Professional Tax Payment', 'State professional tax due date', 'monthly'],
          ['ROC Annual Filing', 'Annual return filing with ROC', 'yearly'],
          ['Shop Act License Renewal', 'Annual shop & establishment renewal', 'yearly'],
        ]},
        { label: 'Utility Bills', icon: 'flash-outline', color: '#D97706', presets: [
          ['Electricity Bill Payment', 'Monthly electricity bill due', 'monthly'],
          ['Water Bill Payment', 'Monthly/quarterly water charges', 'monthly'],
          ['Internet / Broadband Bill', 'Monthly broadband bill due', 'monthly'],
          ['Telephone / Mobile Bill', 'Monthly phone bill due', 'monthly'],
          ['Generator / Fuel Refill', 'Refill diesel/petrol for generator', 'monthly'],
        ]},
        { label: 'Rent & Lease', icon: 'business-outline', color: '#0369A1', presets: [
          ['Office Rent Payment', 'Monthly office/shop rent due', 'monthly'],
          ['Warehouse Rent Payment', 'Monthly warehouse rent due', 'monthly'],
          ['Equipment Lease Payment', 'Monthly equipment lease installment', 'monthly'],
          ['Vehicle Lease Payment', 'Monthly vehicle lease EMI', 'monthly'],
        ]},
        { label: 'Insurance', icon: 'umbrella-outline', color: '#15803D', presets: [
          ['Business Insurance Renewal', 'Annual business/fire insurance', 'yearly'],
          ['Vehicle Insurance Renewal', 'Annual vehicle insurance renewal', 'yearly'],
          ['Health Insurance Premium', 'Annual health insurance premium', 'yearly'],
          ['Stock / Inventory Insurance', 'Annual stock insurance renewal', 'yearly'],
        ]},
        { label: 'Banking & Finance', icon: 'card-outline', color: '#1D4ED8', presets: [
          ['Bank Loan EMI', 'Monthly loan EMI payment', 'monthly'],
          ['Credit Card Bill Payment', 'Monthly credit card due date', 'monthly'],
          ['CC Limit Renewal', 'Annual cash credit limit renewal', 'yearly'],
          ['Fixed Deposit Maturity', 'FD maturity / renewal date', 'none'],
        ]},
        { label: 'Licences & Renewals', icon: 'document-text-outline', color: '#BE185D', presets: [
          ['Trade License Renewal', 'Annual trade/business license', 'yearly'],
          ['FSSAI License Renewal', 'Annual food safety license', 'yearly'],
          ['Drug License Renewal', 'Annual drug/pharma license', 'yearly'],
          ['Fire NOC Renewal', 'Annual fire safety certificate', 'yearly'],
          ['Domain / Hosting Renewal', 'Annual website domain renewal', 'yearly'],
          ['Software License Renewal', 'Annual software subscription', 'yearly'],
        ]},
      ];
      let order = 0;
      for (const cat of seed) {
        const [r] = await conn.query(
          'INSERT INTO reminder_categories (label, icon, color, sort_order) VALUES (?, ?, ?, ?)',
          [cat.label, cat.icon, cat.color, order++]
        );
        let p = 0;
        for (const [title, note, repeat] of cat.presets) {
          await conn.query(
            'INSERT INTO reminder_presets (category_id, title, note, repeat_type, sort_order) VALUES (?, ?, ?, ?, ?)',
            [r.insertId, title, note, repeat, p++]
          );
        }
      }
      console.log('  + Seeded reminder categories & presets.');
    }

    // ── field-visit customers (master, for auto-fill on repeat visits) ──────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS visit_customers (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(200) NOT NULL,
        gst_number   VARCHAR(30),
        phone        VARCHAR(30),
        dealer_name  VARCHAR(200),
        category     VARCHAR(100),
        address        VARCHAR(255),
        district       VARCHAR(100),
        state          VARCHAR(100),
        pin_no         VARCHAR(15),
        contact_person VARCHAR(150),
        alternative_no VARCHAR(30),
        email          VARCHAR(150),
        pan_no         VARCHAR(20),
        latitude     DECIMAL(10,8),
        longitude    DECIMAL(11,8),
        created_by   INT,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_customer_name (customer_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── field-visit logs (each punch) ───────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS visit_logs (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        customer_id   INT,
        customer_name VARCHAR(200) NOT NULL,
        gst_number    VARCHAR(30),
        phone         VARCHAR(30),
        dealer_name   VARCHAR(200),
        category      VARCHAR(100),
        address        VARCHAR(255),
        district       VARCHAR(100),
        state          VARCHAR(100),
        pin_no         VARCHAR(15),
        contact_person VARCHAR(150),
        alternative_no VARCHAR(30),
        email          VARCHAR(150),
        pan_no         VARCHAR(20),
        visit_status   VARCHAR(50),
        comment        TEXT,
        latitude      DECIMAL(10,8),
        longitude     DECIMAL(11,8),
        shop_photo    VARCHAR(255),
        salesperson_id   INT NOT NULL,
        salesperson_name VARCHAR(200),
        visited_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_salesperson (salesperson_id),
        INDEX idx_visited_at (visited_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── extend visit tables with extended dealer/contact fields (idempotent) ────
    for (const t of ['visit_customers', 'visit_logs']) {
      await addColumnIfMissing(conn, t, 'address',        'VARCHAR(255)');
      await addColumnIfMissing(conn, t, 'district',       'VARCHAR(100)');
      await addColumnIfMissing(conn, t, 'state',          'VARCHAR(100)');
      await addColumnIfMissing(conn, t, 'pin_no',         'VARCHAR(15)');
      await addColumnIfMissing(conn, t, 'contact_person', 'VARCHAR(150)');
      await addColumnIfMissing(conn, t, 'alternative_no', 'VARCHAR(30)');
      await addColumnIfMissing(conn, t, 'email',          'VARCHAR(150)');
      await addColumnIfMissing(conn, t, 'pan_no',         'VARCHAR(20)');
    }
    await addColumnIfMissing(conn, 'visit_logs', 'visit_status', 'VARCHAR(50)');
    await addColumnIfMissing(conn, 'visit_logs', 'comment',      'TEXT');

    // ── leads ───────────────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        company         VARCHAR(200),
        contact_person  VARCHAR(150),
        mobile          VARCHAR(30),
        email           VARCHAR(150),
        lead_type       VARCHAR(50),
        remark          TEXT,
        status          VARCHAR(30) DEFAULT 'Open',
        handled_by      INT NULL,
        last_contact_at DATETIME NULL,
        next_followup_at DATETIME NULL,
        created_by      INT NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await addColumnIfMissing(conn, 'leads', 'email',            'VARCHAR(150)');
    await addColumnIfMissing(conn, 'leads', 'last_contact_at',  'DATETIME NULL');
    await addColumnIfMissing(conn, 'leads', 'next_followup_at', 'DATETIME NULL');

    // lead activity log (for view history / actions trail)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS lead_logs (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        lead_id    INT NOT NULL,
        staff_id   INT NULL,
        action     VARCHAR(50) NOT NULL,
        note       TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // lead items — requirements / corrections / updates entered against a lead
    await conn.query(`
      CREATE TABLE IF NOT EXISTS lead_items (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        lead_id     INT NOT NULL,
        kind        VARCHAR(20) NOT NULL DEFAULT 'requirement',
        description TEXT,
        deadline    DATE NULL,
        amount      DECIMAL(12,2) NULL,
        created_by  INT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── assets ─────────────────────────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        asset_type  VARCHAR(50) NOT NULL,
        asset_name  VARCHAR(200) NOT NULL,
        identifier  VARCHAR(100),
        assigned_to INT,
        issued_date DATE,
        return_date DATE,
        status      VARCHAR(20) DEFAULT 'issued',
        remarks     TEXT,
        created_by  INT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
