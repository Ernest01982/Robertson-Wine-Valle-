-- Project Vitis - Relational Master Core Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TENANT DIRECTORY (Wine Farms / Producers)
CREATE TABLE IF NOT EXISTS producers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) UNIQUE NOT NULL,
    bank_account_number VARCHAR(100),
    bank_routing_code VARCHAR(50),
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PRODUCT MASTER CATALOG (Wine Bundles & Ticket Configurations)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producer_id UUID REFERENCES producers(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    item_type VARCHAR(50) CHECK (item_type IN ('ticket', 'wine')),
    base_price DECIMAL(12, 2) NOT NULL,
    stock_allocated INT NOT NULL,
    stock_remaining INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CORE TRANSACTION LEDGER
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producer_id UUID REFERENCES producers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    client_phone VARCHAR(50) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255) NOT NULL,
    shipping_address TEXT,
    quantity_ordered INT NOT NULL,
    gross_charge DECIMAL(12, 2) NOT NULL, -- Total amount sent to payment gateway
    platform_cut DECIMAL(12, 2) NOT NULL, -- Our absolute platform profit
    gateway_cut DECIMAL(12, 2) NOT NULL,  -- Passed through 2.95% card fee
    producer_split DECIMAL(12, 2) NOT NULL, -- Net remainder routed to farm
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'successful', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. OUTBOUND MESSAGING LEDGER (20% Markup Tracking)
CREATE TABLE messaging_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producer_id UUID REFERENCES producers(id) ON DELETE CASCADE, -- NULL if Valley Admin
    template_name VARCHAR(255) NOT NULL,
    message_category VARCHAR(50) CHECK (message_category IN ('marketing', 'utility', 'authentication')),
    meta_base_cost DECIMAL(8, 4) NOT NULL,
    platform_markup DECIMAL(8, 4) NOT NULL,
    total_billed DECIMAL(8, 4) NOT NULL,
    delivery_status VARCHAR(50) DEFAULT 'delivered',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ROW-LEVEL SECURITY POLICY INITIALIZATION
ALTER TABLE producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_ledger ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Rule: Check context mapping to producer's email authentication identifier
CREATE POLICY farm_data_isolation ON transactions 
    FOR ALL USING (producer_id = auth.uid() OR current_setting('app.current_role', true) = 'valley_admin');
