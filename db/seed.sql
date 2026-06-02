-- Project Vitis - Database Seeding Script
-- IMPORTANT: This script requires the schema to exist first.

-- 1. Create Mock Producers
-- Using the exact UUID from the frontend dashboard mock login for the first farm
INSERT INTO producers (id, farm_name, contact_email, bank_account_number, bank_routing_code)
VALUES 
('123e4567-e89b-12d3-a456-426614174000', 'Springfield Estate', 'sales@springfield.test', '1234567890', 'ABSA'),
('987fcdeb-51a2-43d7-9012-345678901234', 'Graham Beck', 'info@grahambeck.test', '0987654321', 'FNB')
ON CONFLICT (id) DO NOTHING;

-- 2. Create Mock Products
INSERT INTO products (id, producer_id, sku, title, item_type, base_price, stock_allocated, stock_remaining)
VALUES 
('11111111-1111-1111-1111-111111111111', '123e4567-e89b-12d3-a456-426614174000', 'SPRING-WINE-6', 'Springfield Life from Stone 6-Pack', 'wine', 900.00, 100, 95),
('22222222-2222-2222-2222-222222222222', '123e4567-e89b-12d3-a456-426614174000', 'SPRING-TIX-SAT', 'Saturday Wine Festival Pass', 'ticket', 150.00, 500, 480),
('33333333-3333-3333-3333-333333333333', '987fcdeb-51a2-43d7-9012-345678901234', 'GB-MCC-3', 'Graham Beck Brut MCC 3-Pack', 'wine', 650.00, 50, 8)
ON CONFLICT (id) DO NOTHING;

-- 3. Create Mock Transactions (Simulating the financial splits)
-- Wine Purchase (R900 base, platform cut = floor(900/200)*6 = 24. Gateway cut = 2.95%)
INSERT INTO transactions (id, producer_id, product_id, client_phone, client_name, client_email, shipping_address, quantity_ordered, gross_charge, platform_cut, gateway_cut, producer_split, payment_status)
VALUES 
(uuid_generate_v4(), '123e4567-e89b-12d3-a456-426614174000', '11111111-1111-1111-1111-111111111111', '27821234567', 'John Doe', 'john@test.com', '123 Long St, Cape Town', 1, 927.36, 24.00, 27.36, 876.00, 'successful'),
-- Wine Purchase (R900 * 2 = 1800 base, platform cut = floor(1800/200)*6 = 54)
(uuid_generate_v4(), '123e4567-e89b-12d3-a456-426614174000', '11111111-1111-1111-1111-111111111111', '27831234568', 'Jane Smith', 'jane@test.com', '45 Main Rd, Paarl', 2, 1854.71, 54.00, 54.71, 1746.00, 'successful'),
-- Ticket Purchase (R150 * 2 = 300 base, platform cut = R10 * 2 = 20)
(uuid_generate_v4(), '123e4567-e89b-12d3-a456-426614174000', '22222222-2222-2222-2222-222222222222', '27841234569', 'Alice Jones', 'alice@test.com', 'NA', 2, 329.73, 20.00, 9.73, 300.00, 'successful'),
-- Ticket Purchase (R150 * 4 = 600 base, platform cut = R10 * 4 = 40)
(uuid_generate_v4(), '123e4567-e89b-12d3-a456-426614174000', '22222222-2222-2222-2222-222222222222', '27841234569', 'Mark Taylor', 'mark@test.com', 'NA', 4, 659.45, 40.00, 19.45, 600.00, 'successful'),
-- Other Farm Wine Purchase (R650 * 1 = 650 base, platform cut = floor(650/200)*6 = 18)
(uuid_generate_v4(), '987fcdeb-51a2-43d7-9012-345678901234', '33333333-3333-3333-3333-333333333333', '27851234570', 'Bob Miller', 'bob@test.com', '78 Oak St, Stellenbosch', 1, 669.76, 18.00, 19.76, 632.00, 'successful')
ON CONFLICT (id) DO NOTHING;
