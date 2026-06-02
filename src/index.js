require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { router: checkoutRouter } = require('./routes/checkout');
const whatsappRouter = require('./routes/whatsapp');
const dashboardRouter = require('./routes/dashboard');
const { router: ozowRouter } = require('./routes/ozow');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.static('public')); // Serve frontend HTML dashboards

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', version: '1.0.0' });
});

// Mount routes
app.use(checkoutRouter);
app.use(whatsappRouter);
app.use(dashboardRouter);
app.use(ozowRouter);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Project Vitis server is running on port ${PORT}`);
});
