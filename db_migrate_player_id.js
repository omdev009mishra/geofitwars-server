const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to PG Database');

        console.log('Adding player_id column to users table...');
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS player_id TEXT UNIQUE;");
        console.log('✅ Users table successfully updated with player_id');

    } catch (e) {
        console.error('❌ Migration failed:', e);
    } finally {
        await client.end();
    }
}

migrate();
