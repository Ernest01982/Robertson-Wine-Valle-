require('dotenv').config();
const db = require('../src/db/index');

async function runMigration() {
    console.log("Connecting to Supabase to run live migration...");
    try {
        // We set the default to TRUE for existing mock data so they don't disappear from the UI
        await db.query(`ALTER TABLE producers ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE;`);
        
        // Ensure new inserts default to false per the schema
        await db.query(`ALTER TABLE producers ALTER COLUMN is_approved SET DEFAULT FALSE;`);
        
        // Remove NOT NULL constraints from banking details for two-step onboarding
        await db.query(`ALTER TABLE producers ALTER COLUMN bank_account_number DROP NOT NULL;`);
        await db.query(`ALTER TABLE producers ALTER COLUMN bank_routing_code DROP NOT NULL;`);

        console.log("✅ Live DB Migration successful: is_approved column added, banking constraints removed.");
    } catch (error) {
        console.error("❌ Live DB Migration failed:", error);
    } finally {
        await db.pool.end();
    }
}

runMigration();
