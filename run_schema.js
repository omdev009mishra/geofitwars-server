require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('✅ Connected to PG Database at', process.env.DATABASE_URL.split('@')[1]);

        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema.sql...');
        await client.query(schemaSql);

        console.log('✅ Schema executed successfully! Tables are now created.');

    } catch (e) {
        console.error('❌ Failed to execute schema:', e);
    } finally {
        await client.end();
    }
}

runSchema();
