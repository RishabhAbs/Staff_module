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
