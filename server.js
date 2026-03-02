require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/geofitwars'
});

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_geofit_wars';

// ==========================================
//                 ROUTES
// ==========================================

// 1. Register
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }

    // Check duplicates
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }

    // Hash password & insert
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await pool.query(
      `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)`,
      [username, email, passwordHash]
    );

    res.status(201).json({ message: 'User registered successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// 2. Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find User
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid login credentials.' });
    }

    const user = userResult.rows[0];

    // Verify Password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid login credentials.' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Generate token (expires in 30 days)
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      token,
      userId: user.id,
      username: user.username,
      energy: user.energy,
      level: user.level
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// 3. Get /me (Auth Middleware)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

app.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userResult = await pool.query(
      'SELECT id as "userId", username, email, level, energy, territories, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(200).json(userResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching profile.' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GeofitWars Auth Backend running on port ${PORT}`);
});
