-- ABS Staff Module — Database Schema
-- Run once: mysql -u abstechnologieso_staff -p abstechnologieso_staff < migrate.sql

CREATE TABLE IF NOT EXISTS staff (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  username            VARCHAR(50)  NOT NULL UNIQUE,
  password            VARCHAR(255) NOT NULL,
  role                ENUM('admin','user') DEFAULT 'user',
  email               VARCHAR(100),
  phone               VARCHAR(20),
  status              ENUM('active','inactive') DEFAULT 'active',
  two_fa_secret       VARCHAR(64),
  two_fa_setup        TINYINT(1) DEFAULT 0,
  last_lat            DECIMAL(10,8),
  last_lng            DECIMAL(11,8),
  last_seen           DATETIME,
  permissions         JSON,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS holidays (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  date  DATE NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  staff_id   INT NOT NULL,
  from_date  DATE NOT NULL,
  to_date    DATE NOT NULL,
  reason     TEXT,
  type       VARCHAR(50),
  status     ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS location_history (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  staff_id    INT NOT NULL,
  latitude    DECIMAL(10,8) NOT NULL,
  longitude   DECIMAL(11,8) NOT NULL,
  accuracy    FLOAT,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- Default admin (password: admin123)
INSERT IGNORE INTO staff (name, username, password, role, status)
VALUES ('Admin', 'admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active');
