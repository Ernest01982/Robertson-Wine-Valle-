require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/db/index');

async function initializeDatabase() {
    console.log("Connecting to Supabase...");
    
    try {
        // 1. Read and Execute Schema
        console.log("Applying schema...");
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await db.query(schemaSql);
        console.log("✅ Schema applied successfully.");

        // 2. Read and Execute Seed Data
        console.log("Applying seed data...");
        const seedPath = path.join(__dirname, 'seed.sql');
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await db.query(seedSql);
        console.log("✅ Mock data seeded successfully.");

    } catch (error) {
        console.error("❌ Database Initialization Failed:", error);
    } finally {
        // Close the connection pool
        await db.pool.end();
        console.log("Disconnected from Supabase.");
    }
}

initializeDatabase();
