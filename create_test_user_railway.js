const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function createTestUser() {
    const client = new Client({
        connectionString: 'postgres://postgres:D2cD1ggDa5C6e3g222g3CFFdadg3bgAA@trolley.proxy.rlwy.net:55747/railway'
    });

    try {
        await client.connect();

        const username = 'TestPlayer';
        const email = 'test@geofitwars.com';
        const rawPassword = 'password123';
        const playerId = 'PLAYER-999999';

        const salt = await bcrypt.genSalt(10);
        const hashedPw = await bcrypt.hash(rawPassword, salt);

        const query = `
            INSERT INTO users (username, email, password_hash, player_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;

        const res = await client.query(query, [username, email, hashedPw, playerId]);
        console.log('✅ Test User created successfully');

    } catch (e) {
        console.error('❌ Failed to create test user:', e.message);
    } finally {
        await client.end();
    }
}

createTestUser();
