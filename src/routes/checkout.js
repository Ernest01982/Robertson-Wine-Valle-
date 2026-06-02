/**
 * Project Vitis - Split Payout Calculation & Ozow Gateway Dispatch Module
 * Designed for immediate deployment within the Antigravity Express server runtime environment.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

/**
 * Core Financial Apportionment Utility
 * Runs calculations on incoming payloads prior to gateway token injection
 */
function calculateFinancialApportionment(basePrice, itemType, quantity) {
    const rawSubtotal = basePrice * quantity;
    let platformCut = 0;

    if (itemType === 'ticket') {
        // Consumer settles the R10.00 flat fee per ticket purchase unit
        platformCut = 10.00 * quantity;
        const subtotalWithPlatform = rawSubtotal + platformCut;
        
        // Apply 2.95% gateway adjustment to total checkout cost
        const grossCharge = parseFloat((subtotalWithPlatform / (1 - 0.0295)).toFixed(2));
        const gatewayCut = parseFloat((grossCharge - subtotalWithPlatform).toFixed(2));
        const producerSplit = rawSubtotal;

        return { grossCharge, platformCut, gatewayCut, producerSplit };
        
    } else if (itemType === 'wine') {
        // Producer settles platform fee at R6.00 per R200.00 increment spent
        const tieredIncrements = Math.floor(rawSubtotal / 200);
        platformCut = tieredIncrements * 6.00;
        
        // Apply 2.95% gateway adjustment to total checkout cost
        const grossCharge = parseFloat((rawSubtotal / (1 - 0.0295)).toFixed(2));
        const gatewayCut = parseFloat((grossCharge - rawSubtotal).toFixed(2));
        const producerSplit = parseFloat((rawSubtotal - platformCut).toFixed(2));

        return { grossCharge, platformCut, gatewayCut, producerSplit };
    }
    throw new Error("Invalid item structural profile classification.");
}

/**
 * WhatsApp Flow Inbound Webhook Endpoint
 * Listens for completed Flow payloads originating from the user terminal
 */
router.post('/api/vitis/flow-checkout', async (req, res) => {
    try {
        const { venue_id, product_id, item_type, quantity, customer_name, customer_email, delivery_address, phone_number } = req.body;
        
        // 1. Fetch live product baseline price from PostgreSQL matrix
        const { rows } = await db.query('SELECT base_price FROM products WHERE id = $1', [product_id]);
        if (rows.length === 0) {
            return res.status(404).json({status: "error", message: "Product not found"});
        }
        const basePrice = parseFloat(rows[0].base_price);
        
        // 2. Process financial split data structures
        const monetaryBreakdown = calculateFinancialApportionment(basePrice, item_type, parseInt(quantity));
        
        // 3. Persist transaction record into database as 'pending'
        const insertResult = await db.query(`
            INSERT INTO transactions 
            (product_id, client_phone, client_name, client_email, shipping_address, quantity_ordered, gross_charge, platform_cut, gateway_cut, producer_split, payment_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
            RETURNING id
        `, [
            product_id, phone_number, customer_name, customer_email, delivery_address, quantity,
            monetaryBreakdown.grossCharge, monetaryBreakdown.platformCut, monetaryBreakdown.gatewayCut, monetaryBreakdown.producerSplit
        ]);
        
        const transactionId = insertResult.rows[0].id;
        
        // 4. Generate Ozow Instant EFT Payload with SHA512 Cryptographic Hash
        const siteCode = process.env.OZOW_SITE_CODE || 'VITIS-MOCK-SITE';
        const privateKey = process.env.OZOW_PRIVATE_KEY || 'VITIS-MOCK-PRIVATE-KEY';
        const countryCode = 'ZA';
        const currencyCode = 'ZAR';
        const amount = monetaryBreakdown.grossCharge.toFixed(2);
        const transactionReference = transactionId;
        const bankReference = `VITIS-${transactionId.substring(0, 8)}`;
        const cancelUrl = 'https://robertsonwinevalley.com/cancel';
        const errorUrl = 'https://robertsonwinevalley.com/error';
        const successUrl = 'https://robertsonwinevalley.com/success';
        const notifyUrl = 'https://api.yourdomain.com/api/vitis/ozow-webhook';
        const isTest = 'true';

        // Ozow Hash sequence requirements (strict ordering)
        const hashString = `${siteCode}${countryCode}${currencyCode}${amount}${transactionReference}${bankReference}${cancelUrl}${errorUrl}${successUrl}${notifyUrl}${isTest}${privateKey}`;
        const hashCheck = crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
        
        // Pre-populating user data for seamless 1-click checkout
        const secureCheckoutUrl = `https://pay.ozow.com/?siteCode=${siteCode}&countryCode=${countryCode}&currencyCode=${currencyCode}&amount=${amount}&transactionReference=${transactionReference}&bankReference=${bankReference}&cancelUrl=${encodeURIComponent(cancelUrl)}&errorUrl=${encodeURIComponent(errorUrl)}&successUrl=${encodeURIComponent(successUrl)}&notifyUrl=${encodeURIComponent(notifyUrl)}&isTest=${isTest}&hashCheck=${hashCheck}&customer=${encodeURIComponent(customer_name)}&emailAddress=${encodeURIComponent(customer_email)}&phoneNumber=${encodeURIComponent(phone_number)}`;
        
        return res.status(200).json({
            status: "success",
            checkout_url: secureCheckoutUrl,
            breakdown: monetaryBreakdown
        });
        
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

module.exports = {
    router,
    calculateFinancialApportionment
};
