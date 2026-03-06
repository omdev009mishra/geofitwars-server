const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');

// Middleware to protect friend routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // For GeofitWars, some requests were updated to pass userId in query params.
    // For SocialConnect, we expect standard Authorization headers. 
    // We'll support both for smooth migration.
    const token = authHeader?.split(' ')[1];

    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
            req.user = user;
            next();
        });
    } else if (req.query.userId || req.body.userId) {
        // Fallback for migrated routes (NOT ideal for security, but maps to existing GeofitWars flow temporarily)
        req.user = { userId: req.query.userId || req.body.userId };
        next();
    } else {
        return res.status(401).json({ error: 'Authentication required.' });
    }
};

// GET /list
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await db.query(`
            SELECT u.id, u.username as name, u.email, u.avatar as "profileImage", u.is_online as "isOnline"
            FROM friends f
            JOIN users u ON (f.requester_id = u.id OR f.recipient_id = u.id)
            WHERE (f.requester_id = $1 OR f.recipient_id = $1)
            AND u.id != $1
            AND f.status = 'accepted'
        `, [userId]);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching friends.' });
    }
});

// GET /pending
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await db.query(`
            SELECT f.id as "_id", u.username as name, u.avatar as "profileImage"
            FROM friends f
            JOIN users u ON f.requester_id = u.id
            WHERE f.recipient_id = $1 AND f.status = 'pending'
        `, [userId]);

        // Map to format Android expects: Map<String, Any> with a nested "requester"
        const mapped = result.rows.map(row => ({
            _id: row._id,
            requester: {
                name: row.name,
                profileImage: row.profileImage
            }
        }));

        res.status(200).json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching pending requests.' });
    }
});

// POST /request
router.post('/request', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { recipientId } = req.body;

        if (!recipientId || userId === recipientId) {
            return res.status(400).json({ error: 'Invalid recipient ID.' });
        }

        await db.query(`
            INSERT INTO friends (requester_id, recipient_id, status)
            VALUES ($1, $2, 'pending')
            ON CONFLICT (requester_id, recipient_id) DO NOTHING
        `, [userId, recipientId]);

        res.status(200).json({ message: 'Request sent.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error sending request.' });
    }
});

// PUT /respond
router.put('/respond', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { requestId, action } = req.body; // action: accept or reject

        if (action === 'accept') {
            await db.query(`
                UPDATE friends SET status = 'accepted' WHERE id = $1 AND recipient_id = $2
            `, [requestId, userId]);
        } else if (action === 'reject') {
            await db.query(`
                DELETE FROM friends WHERE id = $1 AND recipient_id = $2
            `, [requestId, userId]);
        } else {
            return res.status(400).json({ error: 'Invalid action.' });
        }

        res.status(200).json({ message: `Request ${action}ed.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error responding to request.' });
    }
});

// DELETE /:friendId
router.delete('/:friendId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { friendId } = req.params;

        await db.query(`
            DELETE FROM friends 
            WHERE(requester_id = $1 AND recipient_id = $2)
               OR(requester_id = $2 AND recipient_id = $1)
                `, [userId, friendId]);

        res.status(200).json({ message: 'Friend removed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error removing friend.' });
    }
});

module.exports = router;
