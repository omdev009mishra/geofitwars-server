const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// POST /auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate
        if (!username || username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ error: 'Valid email is required.' });
        }

        // Check existing
        const existing = await db.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
            [username, email]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Username or email already exists.' });
        }

        // Hash and Insert
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const playerId = 'PLAYER-' + Math.floor(100000 + Math.random() * 900000);

        await db.query(
            `INSERT INTO users (username, email, password_hash, player_id) VALUES ($1, $2, $3, $4)`,
            [username, email, passwordHash, playerId]
        );

        res.status(201).json({ message: 'User registered successfully!' });
    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        // Find User
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid login credentials.' });
        }

        const user = result.rows[0];

        // Verify Password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid login credentials.' });
        }

        // Update last login
        await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // Issue JWT
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(200).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                player_id: user.player_id
            }
        });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// POST /auth/social-login
router.post('/social-login', async (req, res) => {
    try {
        const { provider, providerId, name, email, profileImage } = req.body;

        if (!provider || !providerId || !email) {
            return res.status(400).json({ error: 'Provider, Provider ID, and Email are required.' });
        }

        // 1. Check if user exists by email
        let result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        let user;

        if (result.rows.length > 0) {
            user = result.rows[0];
            // Optionally update provider ID if missing/different, and mark online
            await db.query(
                'UPDATE users SET provider = $1, provider_id = $2, last_login = CURRENT_TIMESTAMP, is_online = true WHERE id = $3',
                [provider, providerId, user.id]
            );
        } else {
            // 2. Create new social user
            const baseUsername = name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : provider + '_user';
            let uniqueUsername = baseUsername;
            let counter = 1;

            // Ensure unique username
            while (true) {
                const dupCheck = await db.query('SELECT id FROM users WHERE username = $1', [uniqueUsername]);
                if (dupCheck.rows.length === 0) break;
                uniqueUsername = `${baseUsername}${counter}`;
                counter++;
            }

            const playerId = 'PLAYER-' + Math.floor(100000 + Math.random() * 900000);
            const insertRes = await db.query(
                `INSERT INTO users (username, email, provider, provider_id, avatar, is_online, player_id)
                 VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING *`,
                [uniqueUsername, email, provider, providerId, profileImage || 'default', playerId]
            );
            user = insertRes.rows[0];
        }

        // Issue JWT
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(200).json({
            token,
            user: {
                id: user.id,
                name: user.username,
                email: user.email,
                profileImage: user.avatar,
                bio: '',
                provider: user.provider,
                isOnline: true,
                lat: null,
                lng: null
            }
        });

    } catch (err) {
        console.error('Social Login Error:', err);
        res.status(500).json({ error: 'Server error during social login.' });
    }
});

module.exports = router;
