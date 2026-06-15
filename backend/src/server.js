require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
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
app.use('/api/shifts',       require('./routes/shifts'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/ledgers',     require('./routes/ledgers'));
app.use('/api/items',       require('./routes/items'));
app.use('/api/orders',         require('./routes/orders'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/tasks',          require('./routes/tasks'));
app.use('/api/reminders',      require('./routes/reminders'));
app.use('/api/documents',      require('./routes/documents'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve frontend static files safely (bypasses Apache 403 rules)
const path = require('path');
const frontendPath = path.join(__dirname, '../');
const fs = require('fs');

// Automatically fix permissions of frontend files recursively
function fixPermissions(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return;
    const stats = fs.statSync(dirPath);
    if (stats.isDirectory()) {
      fs.chmodSync(dirPath, 0o755);
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        fixPermissions(path.join(dirPath, file));
      }
    } else {
      fs.chmodSync(dirPath, 0o644);
    }
  } catch (err) {
    console.error(`Failed to fix permissions for ${dirPath}:`, err.message);
  }
}

const expoPath = path.join(frontendPath, '_expo');
const assetsPath = path.join(frontendPath, 'assets');
fixPermissions(expoPath);
fixPermissions(assetsPath);

console.log('--- CPANEL DIAGNOSTICS START ---');
if (fs.existsSync(expoPath)) {
  console.log('[_expo] directory exists. Scanning recursively:');
  const scan = (dir, prefix = '') => {
    try {
      const files = fs.readdirSync(dir);
      files.forEach(f => {
        const full = path.join(dir, f);
        const isDir = fs.statSync(full).isDirectory();
        console.log(`${prefix}├── ${f} [${isDir ? 'DIR' : 'FILE'}]`);
        if (isDir) scan(full, prefix + '│   ');
      });
    } catch (err) {
      console.log('Error scanning:', err.message);
    }
  };
  scan(expoPath);
} else {
  console.log('[_expo] directory does not exist at:', expoPath);
}
console.log('--- CPANEL DIAGNOSTICS END ---');


// Log key paths on startup so we can diagnose path issues in pm2 logs
const indexHtmlPath = path.join(frontendPath, 'index.html');
console.log('[PATHS] frontendPath :', frontendPath);
console.log('[PATHS] index.html   :', fs.existsSync(indexHtmlPath) ? 'EXISTS ✓' : 'NOT FOUND ✗');

// Serve static frontend directories
app.use('/_expo',  express.static(path.join(frontendPath, '_expo')));
app.use('/assets', express.static(path.join(frontendPath, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// favicon — return 204 if file missing (avoids 500 crash)
app.get('/favicon.ico', (req, res) => {
  const p = path.join(frontendPath, 'favicon.ico');
  if (!fs.existsSync(p)) return res.status(204).end();
  res.sendFile(p);
});

// metadata
app.get('/metadata.json', (req, res) => {
  const p = path.join(frontendPath, 'metadata.json');
  if (!fs.existsSync(p)) return res.status(404).end();
  res.sendFile(p);
});

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/backend/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(indexHtmlPath, (err) => {
    if (err) {
      console.error('[SPA] sendFile failed:', err.message, '| path:', indexHtmlPath);
      res.status(500).send(`App failed to load. Path: ${indexHtmlPath} | Error: ${err.message}`);
    }
  });
});

const PORT = process.env.PORT || 3001;

// Run migrations then start server
migrate()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`ABS Staff backend running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start server due to migration error:', err.message);
    process.exit(1);
  });
