const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// Ozow Webhook Endpoint
// Expected to be configured in the Ozow Dashboard to point to https://<your-domain>/api/vitis/ozow-webhook
router.post('/api/vitis/ozow-webhook', async (req, res) => {
    try {
        const payload = req.body;
        
        // Extract values from Ozow payload for hash verification
        const siteCode = payload.SiteCode || '';
        const transactionId = payload.TransactionId || '';
        const transactionReference = payload.TransactionReference || '';
        const amount = payload.Amount || '';
        const status = payload.Status || '';
        const optional1 = payload.Optional1 || '';
        const optional2 = payload.Optional2 || '';
        const optional3 = payload.Optional3 || '';
        const optional4 = payload.Optional4 || '';
        const optional5 = payload.Optional5 || '';
        const currencyCode = payload.CurrencyCode || '';
        const isTest = payload.IsTest !== undefined ? payload.IsTest.toString().toLowerCase() : '';
        const statusMessage = payload.StatusMessage || '';
        const privateKey = process.env.OZOW_PRIVATE_KEY || 'VITIS-MOCK-PRIVATE-KEY';

        // Rebuild hash according to Ozow's strict sequence
        const hashString = `${siteCode}${transactionId}${transactionReference}${amount}${status}${optional1}${optional2}${optional3}${optional4}${optional5}${currencyCode}${isTest}${statusMessage}${privateKey}`;
        const generatedHash = crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();

        // 1. Authenticate the payload originated from Ozow
        if (generatedHash !== payload.Hash?.toLowerCase()) {
            console.error("Ozow Webhook Security Error: Invalid HashCheck provided.");
            return res.status(400).send('Invalid Security Hash');
        }

        // 2. Process Successful Payment Status
        if (status === 'Complete') {
            const updateResult = await db.query(
                `UPDATE transactions 
                 SET payment_status = 'successful', updated_at = NOW() 
                 WHERE id = $1 AND payment_status = 'pending'
                 RETURNING client_phone, product_id`,
                [transactionReference]
            );

            if (updateResult.rows.length > 0) {
                const { client_phone } = updateResult.rows[0];

                // Register an entry in the messaging ledger to trigger the final WhatsApp confirmation
                await db.query(
                    `INSERT INTO messaging_ledger (transaction_id, phone_number, message_type, status)
                     VALUES ($1, $2, 'receipt_sent', 'pending')`,
                    [transactionReference, client_phone]
                );

                console.log(`✅ Ozow Transaction ${transactionReference} fully settled and marked successful.`);
            } else {
                console.log(`⚠️ Ozow Transaction ${transactionReference} not found or already settled.`);
            }
        } else {
            console.log(`ℹ️ Ozow Transaction ${transactionReference} received status update: ${status}`);
        }

        // Always return 200 OK to acknowledge receipt of the webhook back to Ozow servers
        res.status(200).send('OK');

    } catch (error) {
        console.error("Ozow Webhook Processing Error:", error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = { router };
