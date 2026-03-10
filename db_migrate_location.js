const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/geofitwars'
});

async function migrate() {
    try {
        console.log("Enabling PostGIS extension...");
        await pool.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);

        console.log("Adding current_location to users...");
        await pool.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS current_location geography(Point,4326);
        `);
        console.log("Column added.");

        console.log("Creating spatial index on current_location...");
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_users_location
            ON users
            USING GIST (current_location);
        `);
        console.log("Index created.");

        console.log("Migration successful.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        pool.end();
    }
}

migrate();
