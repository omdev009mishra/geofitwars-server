const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to PG Database');

        console.log('Creating kingdoms table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS kingdoms (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name TEXT UNIQUE NOT NULL,
                emblem TEXT DEFAULT '👑',
                leader_id UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ Kingdoms table created');

        console.log('Adding kingdom_id column to users table...');
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS kingdom_id UUID REFERENCES kingdoms(id) ON DELETE SET NULL;");
        console.log('✅ Users table successfully updated with kingdom_id');

        // Also add kingdom_id mapping to schema.sql file for future reference
    } catch (e) {
        console.error('❌ Migration failed:', e);
    } finally {
        await client.end();
    }
}

migrate();
