const { Client } = require('pg');
require('dotenv').config();

async function diagnose() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('✅ Connected to Database');

        // 1. Check if kingdoms table exists
        const kingdomsCheck = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'kingdoms')");
        console.log('Kingdoms table exists:', kingdomsCheck.rows[0].exists);

        if (kingdomsCheck.rows[0].exists) {
            const kingdomCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'kingdoms'");
            console.log('Kingdoms columns:', kingdomCols.rows.map(r => r.column_name).join(', '));
        }

        // 2. Check users columns
        const userCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        const cols = userCols.rows.map(r => r.column_name);
        console.log('Users columns:', cols.join(', '));

        const required = ['id', 'username', 'level', 'energy', 'distance_run', 'territories_count', 'total_area', 'rank', 'avatar', 'player_id', 'email', 'created_at', 'kingdom_id'];
        const missing = required.filter(c => !cols.includes(c));

        if (missing.length > 0) {
            console.log('❌ Missing columns in users table:', missing.join(', '));
        } else {
            console.log('✅ All requested columns present in users table.');
        }

        // 3. Test the exact query from user.js (with a placeholder UUID)
        const testUuid = '00000000-0000-0000-0000-000000000000'; // dummy
        console.log('Testing full profile query structure...');
        try {
            await client.query(
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
                [testUuid]
            );
            console.log('✅ Query structure is valid.');
        } catch (e) {
            console.error('❌ Query structure FAILED:', e.message);
        }

    } catch (e) {
        console.error('Diagnostic error:', e);
    } finally {
        await client.end();
    }
}

diagnose();
