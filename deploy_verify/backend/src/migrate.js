const db = require('./db');
const bcrypt = require('bcryptjs');

async function migrate() {
  console.log('Running database migrations...');
  const conn = await db.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(100) NOT NULL,
        username        VARCHAR(50)  NOT NULL UNIQUE,
        password        VARCHAR(255) NOT NULL,
        role            ENUM('admin','user') DEFAULT 'user',
        email           VARCHAR(100),
        phone           VARCHAR(20),
        status          ENUM('active','inactive') DEFAULT 'active',
        two_fa_secret   VARCHAR(64),
        two_fa_setup    TINYINT(1) DEFAULT 0,
        last_lat        DECIMAL(10,8),
        last_lng        DECIMAL(11,8),
        last_seen       DATETIME,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);


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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id   INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        date DATE NOT NULL UNIQUE
      )
    `);

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

    // Always ensure admin exists with correct bcrypt password
    const hashed = await bcrypt.hash('admin123', 10);
    const [admins] = await conn.query("SELECT id FROM staff WHERE username = 'admin'");
    if (!admins[0]) {
      await conn.query(
        `INSERT INTO staff (name, username, password, role, status) VALUES ('Admin', 'admin', ?, 'admin', 'active')`,
        [hashed]
      );
      console.log('Default admin created (username: admin, password: admin123)');
    } else {
      // Reset admin password to ensure it's a valid bcrypt hash
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
