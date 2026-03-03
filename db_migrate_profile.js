const db = require('./config/database');

async function migrate() {
    try {
        console.log('Running User Profile Migration...');

        // Add new columns if they do not exist
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS distance_run DOUBLE PRECISION DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_area DOUBLE PRECISION DEFAULT 0,
            ADD COLUMN IF NOT EXISTS territories_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS rank TEXT DEFAULT 'SOLO_WARRIOR',
            ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT 'default';
        `);

        console.log('Migration successful: User Profile columns added.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
