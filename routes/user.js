const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/authMiddleware');

// GET /user/profile
// Protected route returning user data
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await db.query(
            'SELECT id as "userId", username, email, level, energy, territories, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Profile Fetch Error:', err);
        res.status(500).json({ error: 'Server error retrieving profile.' });
    }
});

module.exports = router;
