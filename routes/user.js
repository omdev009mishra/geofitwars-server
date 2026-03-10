const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/profile', async (req, res) => {
    try {
        const userId = req.query.userId;
        console.log(`[Profile] Fetching profile for userId: ${userId}`);

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Basic UUID format validation to prevent Postgres crash
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            console.error(`[Profile] Invalid UUID format: ${userId}`);
            return res.status(400).json({ error: 'Invalid userId format. Must be a valid UUID.' });
        }

        const result = await db.query(
            `SELECT u.id as "userId", u.username, u.level, u.energy, 
             u.distance_run as "distanceRun", 
             u.territories_count as "territoriesCount", 
             u.total_area as "totalArea", 
             u.rank, u.avatar, u.player_id as "playerId", u.email,
             u.created_at as "joinDate",
             k.id as "kingdomId", k.name as "kingdomName", k.emblem as "kingdomEmblem"
             FROM users u
             LEFT JOIN kingdoms k ON u.kingdom_id = k.id
             WHERE u.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            console.warn(`[Profile] User not found: ${userId}`);
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('[Profile] Fetch Error:', err);
        res.status(500).json({
            error: 'Server error retrieving profile.',
            details: err.message
        });
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
        await db.query(
            `UPDATE users SET username = $1, avatar = $2 WHERE id = $3`,
            [username.trim(), avatarValue, userId]
        );

        const result = await db.query(
            `SELECT u.id as "userId", u.username, u.level, u.energy, 
             u.distance_run as "distanceRun", 
             u.territories_count as "territoriesCount", 
             u.total_area as "totalArea", 
             u.rank, u.avatar, u.player_id as "playerId", u.email,
             u.created_at as "joinDate",
             k.id as "kingdomId", k.name as "kingdomName", k.emblem as "kingdomEmblem"
             FROM users u
             LEFT JOIN kingdoms k ON u.kingdom_id = k.id
             WHERE u.id = $1`,
            [userId]
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

// GET /user/nearby
// Retrieve users located closely to you dynamically based on the geometries. 
// For GeofitWars, we use the `territories` location column
router.get('/nearby', async (req, res) => {
    try {
        const { lat, lng } = req.query;
        let radius = parseInt(req.query.radius) || 5000;

        if (!lat || !lng) {
            return res.status(400).json({ error: 'Latitude and Longitude required' });
        }

        // Search for distinct users who own turf within this radius
        const result = await db.query(
            `SELECT DISTINCT u.id, u.username as name, u.email, u.avatar as "profileImage", u.is_online as "isOnline",
                ST_Y(t.location::geometry) as lat, ST_X(t.location::geometry) as lng
             FROM users u
             JOIN territories t ON u.id = t.owner_id
             WHERE ST_DWithin(t.location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)`,
            [lng, lat, radius]
        );

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Nearby API Error:', err);
        res.status(500).json({ error: 'Server error retrieving nearby users.' });
    }
});

// GET /user/search
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: 'Query string required.' });

        const result = await db.query(
            `SELECT id as "userId", username as name, avatar as "profileImage"
             FROM users 
             WHERE username ILIKE $1
             LIMIT 20`,
            [`%${q}%`]
        );

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Search API Error:', err);
        res.status(500).json({ error: 'Server error searching users.' });
    }
});

module.exports = router;
