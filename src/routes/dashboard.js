const express = require('express');
const router = express.Router();
const db = require('../db');
const { Parser } = require('json2csv');

// --- ADMIN DASHBOARD ROUTES --- //

router.get('/api/dashboard/admin', async (req, res) => {
    try {
        // Aggregate platform-wide metrics
        const metricsResult = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN p.item_type = 'ticket' THEN t.quantity_ordered ELSE 0 END), 0) AS total_tickets,
                COALESCE(SUM(CASE WHEN p.item_type = 'wine' THEN t.gross_charge ELSE 0 END), 0) AS total_wine_revenue,
                COALESCE(SUM(t.platform_cut), 0) AS total_platform_fees
            FROM transactions t
            JOIN products p ON t.product_id = p.id
            WHERE t.payment_status = 'successful'
        `);

        // Producer Leaderboard
        const leaderboardResult = await db.query(`
            SELECT 
                pr.farm_name,
                COALESCE(SUM(t.gross_charge), 0) AS total_sales,
                COALESCE(SUM(t.quantity_ordered), 0) AS total_items
            FROM producers pr
            LEFT JOIN transactions t ON pr.id = t.producer_id AND t.payment_status = 'successful'
            WHERE pr.is_approved = TRUE
            GROUP BY pr.id, pr.farm_name
            ORDER BY total_sales DESC
        `);

        return res.status(200).json({
            metrics: metricsResult.rows[0],
            leaderboard: leaderboardResult.rows
        });
    } catch (error) {
        console.error("Admin Dashboard Error:", error);
        return res.status(500).json({ status: "error", message: error.message });
    }
});

// Fetch pending producers for Admin Approval Queue
router.get('/api/dashboard/admin/pending', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT id, farm_name, contact_email, created_at 
            FROM producers 
            WHERE is_approved = FALSE
            ORDER BY created_at ASC
        `);
        return res.status(200).json(rows);
    } catch (error) {
        console.error("Pending Producers Error:", error);
        return res.status(500).json({ status: "error", message: error.message });
    }
});

// Approve or Reject a pending producer
router.patch('/api/dashboard/admin/producers/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'approve' or 'reject'

        if (action === 'approve') {
            await db.query(`UPDATE producers SET is_approved = TRUE WHERE id = $1`, [id]);
            return res.status(200).json({ status: "success", message: "Producer approved" });
        } else if (action === 'reject') {
            await db.query(`DELETE FROM producers WHERE id = $1 AND is_approved = FALSE`, [id]);
            return res.status(200).json({ status: "success", message: "Producer rejected and removed" });
        } else {
            return res.status(400).json({ status: "error", message: "Invalid action" });
        }
    } catch (error) {
        console.error("Producer Approval Error:", error);
        return res.status(500).json({ status: "error", message: error.message });
    }
});

// --- TENANT ONBOARDING ROUTES --- //

// Register a new Farm (Step 1: No Banking Details yet)
router.post('/api/dashboard/producers', async (req, res) => {
    try {
        const { farm_name, contact_email } = req.body;
        
        const insertResult = await db.query(`
            INSERT INTO producers (farm_name, contact_email, is_approved)
            VALUES ($1, $2, FALSE)
            RETURNING id
        `, [farm_name, contact_email]);

        return res.status(201).json({
            status: "success",
            message: "Farm registered successfully. Awaiting admin approval.",
            producer_id: insertResult.rows[0].id
        });
    } catch (error) {
        console.error("Producer Registration Error:", error);
        if (error.code === '23505') { // Unique constraint violation (email)
            return res.status(400).json({ status: "error", message: "Email already registered." });
        }
        return res.status(500).json({ status: "error", message: error.message });
    }
});

// Update Banking Details (Step 2: Approved Tenants only)
router.patch('/api/dashboard/tenant/:id/banking', async (req, res) => {
    try {
        const { id } = req.params;
        const { bank_account_number, bank_routing_code } = req.body;

        const updateResult = await db.query(`
            UPDATE producers 
            SET bank_account_number = $1, bank_routing_code = $2 
            WHERE id = $3 AND is_approved = TRUE
            RETURNING id
        `, [bank_account_number, bank_routing_code, id]);

        if (updateResult.rows.length === 0) {
            return res.status(403).json({ status: "error", message: "Farm not found or not approved yet." });
        }

        return res.status(200).json({ status: "success", message: "Banking details updated securely." });
    } catch (error) {
        console.error("Banking Update Error:", error);
        return res.status(500).json({ status: "error", message: error.message });
    }
});

// --- TENANT DASHBOARD ROUTES --- //

// Mocking the RLS context for the tenant by passing their ID. 
// In production, this ID would be extracted from their verified JWT token.
router.get('/api/dashboard/tenant/:producer_id', async (req, res) => {
    try {
        const { producer_id } = req.params;

        // Fetch farm-specific metrics
        const metricsResult = await db.query(`
            SELECT 
                COALESCE(SUM(gross_charge), 0) AS total_sales,
                COALESCE(SUM(platform_cut), 0) AS total_fees_paid,
                COALESCE(SUM(producer_split), 0) AS net_payout
            FROM transactions 
            WHERE producer_id = $1 AND payment_status = 'successful'
        `, [producer_id]);

        // Fetch specific product performance for this farm
        const productsResult = await db.query(`
            SELECT 
                title, 
                item_type,
                stock_allocated, 
                stock_remaining
            FROM products
            WHERE producer_id = $1
        `, [producer_id]);

        return res.status(200).json({
            metrics: metricsResult.rows[0],
            products: productsResult.rows
        });
    } catch (error) {
        console.error("Tenant Dashboard Error:", error);
        return res.status(500).json({ status: "error", message: error.message });
    }
});

router.get('/api/dashboard/tenant/:producer_id/manifest', async (req, res) => {
    try {
        const { producer_id } = req.params;

        const manifestResult = await db.query(`
            SELECT 
                t.client_name, 
                t.client_phone, 
                t.client_email, 
                t.shipping_address, 
                p.title AS product_name, 
                t.quantity_ordered,
                t.payment_status
            FROM transactions t
            JOIN products p ON t.product_id = p.id
            WHERE t.producer_id = $1 AND t.payment_status = 'successful'
            ORDER BY t.created_at DESC
        `, [producer_id]);

        const data = manifestResult.rows;

        if (data.length === 0) {
            return res.status(404).send("No successful transactions found for this tenant.");
        }

        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(data);

        res.header('Content-Type', 'text/csv');
        res.attachment(`shipping_manifest_${producer_id}.csv`);
        return res.send(csv);

    } catch (error) {
        console.error("Manifest Generation Error:", error);
        return res.status(500).json({ status: "error", message: error.message });
    }
});

module.exports = router;
