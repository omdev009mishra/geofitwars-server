const express = require('express');
const router = express.Router();
const db = require('../config/database');

// POST /kingdom/create
router.post('/create', async (req, res) => {
    try {
        const userId = req.user?.id; // Assuming auth middleware attaches user
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { name, emblem } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Kingdom name is required' });

        const cleanName = name.trim();
        const safeEmblem = emblem ? emblem.trim() : '👑';

        await db.query('BEGIN');

        // Ensure user is not already in a kingdom
        const userRes = await db.query('SELECT kingdom_id FROM users WHERE id = $1', [userId]);
        if (userRes.rows[0].kingdom_id) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'You are already in a kingdom. Leave it first.' });
        }

        // Create the kingdom
        const kingdomRes = await db.query(
            'INSERT INTO kingdoms (name, emblem, leader_id) VALUES ($1, $2, $3) RETURNING id, name, emblem',
            [cleanName, safeEmblem, userId]
        );
        const newKingdom = kingdomRes.rows[0];

        // Assign user to kingdom
        await db.query('UPDATE users SET kingdom_id = $1 WHERE id = $2', [newKingdom.id, userId]);

        await db.query('COMMIT');
        res.status(201).json(newKingdom);

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Create Kingdom Error:', err);
        if (err.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: 'A kingdom with that name already exists.' });
        }
        res.status(500).json({ error: 'Server error creating kingdom.' });
    }
});

// GET /kingdom/list
router.get('/list', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT k.id, k.name, k.emblem, k.created_at, 
                   (SELECT COUNT(*) FROM users u WHERE u.kingdom_id = k.id) as "memberCount",
                   u.username as "leaderName"
            FROM kingdoms k
            LEFT JOIN users u ON k.leader_id = u.id
            ORDER BY "memberCount" DESC LIMIT 50
        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('List Kingdoms Error:', err);
        res.status(500).json({ error: 'Server error listing kingdoms.' });
    }
});

// POST /kingdom/join
router.post('/join', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { kingdomId } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!kingdomId) return res.status(400).json({ error: 'Kingdom ID is required' });

        await db.query('BEGIN');

        const userRes = await db.query('SELECT kingdom_id FROM users WHERE id = $1', [userId]);
        if (userRes.rows[0].kingdom_id) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'You are already in a kingdom. Leave it first.' });
        }

        const kingdomRes = await db.query('SELECT id FROM kingdoms WHERE id = $1', [kingdomId]);
        if (kingdomRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Kingdom not found.' });
        }

        await db.query('UPDATE users SET kingdom_id = $1 WHERE id = $2', [kingdomId, userId]);

        await db.query('COMMIT');
        res.status(200).json({ message: 'Joined kingdom successfully.' });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Join Kingdom Error:', err);
        res.status(500).json({ error: 'Server error joining kingdom.' });
    }
});

// GET /kingdom/my
router.get('/my', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const userRes = await db.query('SELECT kingdom_id FROM users WHERE id = $1', [userId]);
        const kingdomId = userRes.rows[0]?.kingdom_id;

        if (!kingdomId) {
            return res.status(200).json(null); // Not in a kingdom
        }

        const kingdomRes = await db.query(`
            SELECT k.id, k.name, k.emblem, k.leader_id, u.username as "leaderName", k.created_at
            FROM kingdoms k
            LEFT JOIN users u ON k.leader_id = u.id
            WHERE k.id = $1
        `, [kingdomId]);

        const membersRes = await db.query(`
            SELECT id as "userId", username, rank, level, distance_run as "distanceRun", avatar as "profileImage", is_online as "isOnline", player_id as "playerId"
            FROM users
            WHERE kingdom_id = $1
            ORDER BY distance_run DESC
        `, [kingdomId]);

        const data = kingdomRes.rows[0];
        data.members = membersRes.rows;

        res.status(200).json(data);

    } catch (err) {
        console.error('Get My Kingdom Error:', err);
        res.status(500).json({ error: 'Server error retrieving kingdom.' });
    }
});

// POST /kingdom/leave
router.post('/leave', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        await db.query('BEGIN');

        const userRes = await db.query('SELECT kingdom_id FROM users WHERE id = $1', [userId]);
        const kingdomId = userRes.rows[0]?.kingdom_id;

        if (!kingdomId) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'You are not in a kingdom.' });
        }

        const kingdomRes = await db.query('SELECT leader_id FROM kingdoms WHERE id = $1', [kingdomId]);
        const leaderId = kingdomRes.rows[0]?.leader_id;

        if (leaderId === userId) {
            // Leader is leaving. If there are other members, reassign leadership. Otherwise, delete the kingdom.
            const membersRes = await db.query('SELECT id FROM users WHERE kingdom_id = $1 AND id != $2 LIMIT 1', [kingdomId, userId]);
            if (membersRes.rows.length > 0) {
                const newLeaderId = membersRes.rows[0].id;
                await db.query('UPDATE kingdoms SET leader_id = $1 WHERE id = $2', [newLeaderId, kingdomId]);
            } else {
                await db.query('DELETE FROM kingdoms WHERE id = $1', [kingdomId]);
            }
        }

        // Remove user from kingdom
        await db.query('UPDATE users SET kingdom_id = NULL WHERE id = $1', [userId]);

        await db.query('COMMIT');
        res.status(200).json({ message: 'Left kingdom successfully.' });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Leave Kingdom Error:', err);
        res.status(500).json({ error: 'Server error leaving kingdom.' });
    }
});

module.exports = router;
