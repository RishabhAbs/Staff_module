require('dotenv').config();
const express = require('express');
const cors = require('cors');
const migrate = require('./migrate');

const app = express();

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());

// Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/staff',      require('./routes/staff'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leave',      require('./routes/leave'));
app.use('/api/location',   require('./routes/location'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve frontend static files safely (bypasses Apache 403 rules)
const path = require('path');
const frontendPath = path.join(__dirname, '../../');

// Explicitly serve only public directories to prevent exposing /backend
app.use('/expo', express.static(path.join(frontendPath, 'expo')));
app.use('/assets', express.static(path.join(frontendPath, 'assets')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(frontendPath, 'favicon.ico')));
app.get('/metadata.json', (req, res) => res.sendFile(path.join(frontendPath, 'metadata.json')));

// Fallback for SPA
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/backend/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;

// Run migrations then start server
migrate()
  .then(() => {
    app.listen(PORT, () => console.log(`ABS Staff backend running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start server due to migration error:', err.message);
    process.exit(1);
  });
