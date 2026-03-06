require('dotenv').config();
const { Client } = require('pg');

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to PG Database');

        // Check if provider column exists before adding it
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' and column_name='provider';
        `);

        if (res.rowCount === 0) {
            console.log('Adding new social columns to users table...');
            await client.query("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;");
            await client.query("ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'local';");
            await client.query("ALTER TABLE users ADD COLUMN provider_id TEXT;");
            await client.query("ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT false;");
            console.log('✅ Users table successfully altered');
        } else {
            console.log('Users table already contains social columns. Skipping.');
        }

        console.log('Creating Friends table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS friends (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
                recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
                status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(requester_id, recipient_id)
            );
        `);
        console.log('✅ Friends table successfully created');

    } catch (e) {
        console.error('❌ Migration failed:', e);
    } finally {
        await client.end();
    }
}

migrate();
