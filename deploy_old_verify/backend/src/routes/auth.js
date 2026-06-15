const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM staff WHERE username = ? AND status = "active"', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    // If 2FA not set up, return tempToken for setup flow
    if (!user.two_fa_secret) {
      const secret = speakeasy.generateSecret({ name: `ABS Staff (${username})` });
      await db.query('UPDATE staff SET two_fa_secret = ?, two_fa_setup = 0 WHERE id = ?', [secret.base32, user.id]);
      const qr = await qrcode.toDataURL(secret.otpauth_url);
      const tempToken = jwt.sign({ id: user.id, setup: true }, process.env.JWT_SECRET, { expiresIn: '10m' });
      return res.json({ requiresSetup: true, tempToken, qrCode: qr, userId: user.id });
    }

    if (!user.two_fa_setup) {
      const qr = await qrcode.toDataURL(
        speakeasy.otpauthURL({ secret: user.two_fa_secret, label: `ABS Staff (${username})`, encoding: 'base32' })
      );
      const tempToken = jwt.sign({ id: user.id, setup: true }, process.env.JWT_SECRET, { expiresIn: '10m' });
      return res.json({ requiresSetup: true, tempToken, qrCode: qr, userId: user.id });
    }

    // 2FA set up — require OTP
    const tempToken = jwt.sign({ id: user.id, pre2fa: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
    res.json({ requires2FA: true, tempToken, userId: user.id });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// POST /api/auth/verify-2fa
router.post('/verify-2fa', async (req, res) => {
  const { tempToken, userId, code } = req.body;
  try {
    jwt.verify(tempToken, process.env.JWT_SECRET);
    const [rows] = await db.query('SELECT * FROM staff WHERE id = ?', [userId]);
    const user = rows[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = speakeasy.totp.verify({ secret: user.two_fa_secret, encoding: 'base32', token: code, window: 2 });
    if (!valid) return res.status(400).json({ message: 'Invalid code. Please try again.' });

    await db.query('UPDATE staff SET two_fa_setup = 1 WHERE id = ?', [userId]);

    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role, status: user.status } });
  } catch (err) {
    console.error('verify-2fa error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// GET /api/auth/profile
router.get('/profile', authMiddleware, async (req, res) => {
  const [rows] = await db.query('SELECT id, name, username, role, status, email, phone FROM staff WHERE id = ?', [req.user.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Not found' });
  res.json(rows[0]);
});

module.exports = router;
