const { Client } = require('pg');
require('dotenv').config();

async function backfillPlayerIds() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to Database');

        const res = await client.query("SELECT id FROM users WHERE player_id IS NULL");
        console.log(`Found ${res.rowCount} users with null player_id`);

        for (let row of res.rows) {
            const playerId = 'PLAYER-' + Math.floor(100000 + Math.random() * 900000);
            await client.query("UPDATE users SET player_id = $1 WHERE id = $2", [playerId, row.id]);
        }

        console.log('✅ Backfill complete');

    } catch (e) {
        console.error('❌ Migration failed:', e);
    } finally {
        await client.end();
    }
}

backfillPlayerIds();
