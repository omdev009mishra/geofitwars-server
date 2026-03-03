const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /user/profile
// Public route - pass userId as query param e.g. /user/profile?userId=1
router.get('/profile', async (req, res) => {
    try {
        const userId = req.query.userId;

        const result = await db.query(
            `SELECT id as "userId", username, level, energy, 
             distance_run as "distanceRun", 
             territories_count as "territoriesCount", 
             total_area as "totalArea", 
             rank, avatar, 
             created_at as "joinDate" 
             FROM users WHERE id = $1`,
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

// POST /user/updateProfile
// Public route - pass userId in request body
router.post('/updateProfile', async (req, res) => {
    try {
        const userId = req.body.userId;
        const { username, avatar } = req.body;

        if (!username || !username.trim()) {
            return res.status(400).json({ error: 'Username is required' });
        }

        const avatarValue = avatar ? avatar.trim() : 'default';

        // Update user
        const result = await db.query(
            `UPDATE users 
             SET username = $1, avatar = $2 
             WHERE id = $3 
             RETURNING id as "userId", username, level, energy, 
             distance_run as "distanceRun", 
             territories_count as "territoriesCount", 
             total_area as "totalArea", 
             rank, avatar, 
             created_at as "joinDate"`,
            [username.trim(), avatarValue, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Profile Update Error:', err);
        if (err.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: 'Username already exists.' });
        }
        res.status(500).json({ error: 'Server error updating profile.' });
    }
});

module.exports = router;
