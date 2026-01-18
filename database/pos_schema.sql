-- ============================================================================
-- UNIVERSAL POS SYSTEM - PostgreSQL Database Schema
-- Version: 1.0.0
-- Compatible with: PostgreSQL 14+, Supabase
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CUSTOM TYPES (ENUMS)
-- ============================================================================

-- Item types
CREATE TYPE item_type AS ENUM ('product', 'service', 'bundle');

-- Transaction statuses
CREATE TYPE transaction_status AS ENUM ('draft', 'pending', 'completed', 'cancelled', 'refunded');

-- Payment statuses
CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid', 'refunded');

-- Work order statuses
CREATE TYPE work_order_status AS ENUM ('pending', 'in_progress', 'waiting_parts', 'completed', 'cancelled', 'delivered');

-- Stock movement types
CREATE TYPE stock_movement_type AS ENUM ('in', 'out', 'transfer', 'adjustment', 'sale', 'return', 'work_order');

-- Cash movement types
CREATE TYPE cash_movement_type AS ENUM ('opening', 'sale', 'expense', 'deposit', 'withdrawal', 'adjustment', 'closing');

-- Journal entry types
CREATE TYPE journal_entry_type AS ENUM ('debit', 'credit');

-- Account types for chart of accounts
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Branches / Locations
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    tax_id VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role Permissions (Many-to-Many)
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- Users (integrates with Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE, -- Reference to Supabase auth.users
    branch_id UUID REFERENCES branches(id),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    pin_code VARCHAR(10), -- For quick POS login
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Roles (Many-to-Many)
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id), -- Optional: role per branch
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_id, branch_id)
);

-- ============================================================================
-- CATALOG TABLES
-- ============================================================================

-- Units of Measurement
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories (Self-referencing for hierarchy)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items (Products, Services, Bundles)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id),
    type item_type NOT NULL DEFAULT 'product',
    sku VARCHAR(50) UNIQUE,
    barcode VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT,
    
    -- Pricing
    cost_price DECIMAL(15,2) DEFAULT 0,
    selling_price DECIMAL(15,2) NOT NULL,
    min_price DECIMAL(15,2), -- Minimum allowed selling price
    
    -- Tax
    tax_rate DECIMAL(5,2) DEFAULT 0,
    is_tax_inclusive BOOLEAN DEFAULT FALSE,
    
    -- Inventory settings (for products)
    track_inventory BOOLEAN DEFAULT TRUE,
    min_stock_level DECIMAL(15,3) DEFAULT 0,
    max_stock_level DECIMAL(15,3),
    reorder_point DECIMAL(15,3) DEFAULT 0,
    
    -- Flags
    is_active BOOLEAN DEFAULT TRUE,
    is_sellable BOOLEAN DEFAULT TRUE,
    is_purchasable BOOLEAN DEFAULT TRUE,
    allow_decimal_qty BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    tags TEXT[],
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Item Variants (Size, Color, etc.)
CREATE TABLE item_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    sku VARCHAR(50) UNIQUE,
    barcode VARCHAR(50) UNIQUE,
    name VARCHAR(100) NOT NULL, -- e.g., "Red - Large"
    
    -- Pricing overrides
    cost_price DECIMAL(15,2),
    selling_price DECIMAL(15,2),
    
    -- Variant attributes
    attributes JSONB DEFAULT '{}', -- {"color": "Red", "size": "L"}
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bundle Items (Items inside a bundle)
CREATE TABLE bundle_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bundle_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES item_variants(id) ON DELETE SET NULL,
    quantity DECIMAL(15,3) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bundle_id, item_id, variant_id)
);

-- Price Lists (for different customer groups, promotions)
CREATE TABLE price_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price List Items
CREATE TABLE price_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES item_variants(id) ON DELETE CASCADE,
    price DECIMAL(15,2) NOT NULL,
    min_qty DECIMAL(15,3) DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(price_list_id, item_id, variant_id, min_qty)
);

-- ============================================================================
-- INVENTORY TABLES
-- ============================================================================

-- Warehouses
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, code)
);

-- Inventory (Stock per Warehouse)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES item_variants(id) ON DELETE CASCADE,
    
    quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(15,3) NOT NULL DEFAULT 0, -- Reserved for orders
    available_quantity DECIMAL(15,3) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    
    avg_cost DECIMAL(15,4) DEFAULT 0, -- Weighted average cost
    last_restock_at TIMESTAMPTZ,
    last_sold_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(warehouse_id, item_id, variant_id)
);

-- Stock Movements (Audit trail for all inventory changes)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    item_id UUID NOT NULL REFERENCES items(id),
    variant_id UUID REFERENCES item_variants(id),
    
    movement_type stock_movement_type NOT NULL,
    reference_type VARCHAR(50), -- 'transaction', 'transfer', 'adjustment', 'work_order'
    reference_id UUID,
    
    quantity DECIMAL(15,3) NOT NULL, -- Positive for in, negative for out
    unit_cost DECIMAL(15,4),
    
    quantity_before DECIMAL(15,3) NOT NULL,
    quantity_after DECIMAL(15,3) NOT NULL,
    
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Transfers (Between warehouses)
CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_number VARCHAR(50) NOT NULL UNIQUE,
    from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    
    status VARCHAR(20) DEFAULT 'draft', -- draft, in_transit, completed, cancelled
    notes TEXT,
    
    transferred_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    received_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Transfer Items
CREATE TABLE stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    variant_id UUID REFERENCES item_variants(id),
    
    quantity_sent DECIMAL(15,3) NOT NULL,
    quantity_received DECIMAL(15,3),
    unit_cost DECIMAL(15,4),
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Adjustments
CREATE TABLE stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_number VARCHAR(50) NOT NULL UNIQUE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    
    reason VARCHAR(50) NOT NULL, -- 'count', 'damage', 'expiry', 'loss', 'found', 'other'
    notes TEXT,
    
    status VARCHAR(20) DEFAULT 'draft', -- draft, approved, cancelled
    
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Adjustment Items
CREATE TABLE stock_adjustment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    variant_id UUID REFERENCES item_variants(id),
    
    quantity_before DECIMAL(15,3) NOT NULL,
    quantity_after DECIMAL(15,3) NOT NULL,
    quantity_diff DECIMAL(15,3) GENERATED ALWAYS AS (quantity_after - quantity_before) STORED,
    unit_cost DECIMAL(15,4),
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CUSTOMER TABLES
-- ============================================================================

-- Customer Groups
CREATE TABLE customer_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    discount_rate DECIMAL(5,2) DEFAULT 0,
    price_list_id UUID REFERENCES price_lists(id),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES customer_groups(id) ON DELETE SET NULL,
    code VARCHAR(20) UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    
    -- Address
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    
    -- Business info
    company_name VARCHAR(200),
    tax_id VARCHAR(50),
    
    -- Credit
    credit_limit DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0, -- Positive = customer owes
    
    -- Loyalty
    loyalty_points INTEGER DEFAULT 0,
    
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRANSACTION TABLES (POS)
-- ============================================================================

-- Payment Methods
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'cash', 'card', 'transfer', 'ewallet', 'credit'
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (Sales, Returns)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    customer_id UUID REFERENCES customers(id),
    cash_session_id UUID, -- Will reference cash_sessions
    
    transaction_number VARCHAR(50) NOT NULL UNIQUE,
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'sale', -- 'sale', 'return', 'exchange'
    reference_id UUID REFERENCES transactions(id), -- For returns/exchanges
    
    -- Timestamps
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Totals
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Payment
    paid_amount DECIMAL(15,2) DEFAULT 0,
    change_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Status
    status transaction_status DEFAULT 'draft',
    payment_status payment_status DEFAULT 'pending',
    
    notes TEXT,
    
    -- Staff
    created_by UUID REFERENCES users(id),
    cashier_id UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Transaction Items
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    variant_id UUID REFERENCES item_variants(id),
    
    -- Pricing at time of sale
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    cost_price DECIMAL(15,2) DEFAULT 0,
    
    -- Discounts
    discount_amount DECIMAL(15,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    
    -- Tax
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Totals
    subtotal DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
    
    amount DECIMAL(15,2) NOT NULL,
    reference_number VARCHAR(100), -- Card approval, transfer ref, etc.
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction Holds (Park transactions)
CREATE TABLE transaction_holds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    customer_id UUID REFERENCES customers(id),
    
    hold_number VARCHAR(50) NOT NULL UNIQUE,
    hold_name VARCHAR(100),
    
    items JSONB NOT NULL, -- Snapshot of items
    totals JSONB NOT NULL, -- Snapshot of totals
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- ============================================================================
-- WORK ORDER TABLES (Workshop/Service)
-- ============================================================================

-- Technicians
CREATE TABLE technicians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    specialization TEXT[],
    hourly_rate DECIMAL(15,2) DEFAULT 0,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, code)
);

-- Work Orders
CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    technician_id UUID REFERENCES technicians(id),
    transaction_id UUID REFERENCES transactions(id), -- Linked sale
    
    work_order_number VARCHAR(50) NOT NULL UNIQUE,
    
    -- Device/Item info
    device_type VARCHAR(100),
    device_brand VARCHAR(100),
    device_model VARCHAR(100),
    device_serial VARCHAR(100),
    device_condition TEXT,
    device_accessories TEXT[],
    
    -- Problem & Solution
    problem_description TEXT NOT NULL,
    diagnosis TEXT,
    solution TEXT,
    
    -- Scheduling
    received_at TIMESTAMPTZ DEFAULT NOW(),
    estimated_completion TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Costs
    estimated_cost DECIMAL(15,2),
    service_cost DECIMAL(15,2) DEFAULT 0,
    parts_cost DECIMAL(15,2) DEFAULT 0,
    total_cost DECIMAL(15,2) DEFAULT 0,
    
    -- Status
    status work_order_status DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    
    -- Warranty
    warranty_days INTEGER DEFAULT 0,
    warranty_until DATE,
    
    notes TEXT,
    internal_notes TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work Order Items (Parts & Services used)
CREATE TABLE work_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    variant_id UUID REFERENCES item_variants(id),
    
    item_type item_type NOT NULL, -- 'product' for parts, 'service' for labor
    
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    cost_price DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) NOT NULL,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work Order Logs (Status history)
CREATE TABLE work_order_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    
    from_status work_order_status,
    to_status work_order_status NOT NULL,
    
    notes TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CASH & ACCOUNTING TABLES
-- ============================================================================

-- Cash Registers
CREATE TABLE cash_registers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, code)
);

-- Cash Sessions (Shifts)
CREATE TABLE cash_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
    
    session_number VARCHAR(50) NOT NULL UNIQUE,
    
    opened_by UUID NOT NULL REFERENCES users(id),
    closed_by UUID REFERENCES users(id),
    
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    
    opening_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Calculated totals
    cash_sales DECIMAL(15,2) DEFAULT 0,
    card_sales DECIMAL(15,2) DEFAULT 0,
    other_sales DECIMAL(15,2) DEFAULT 0,
    
    cash_in DECIMAL(15,2) DEFAULT 0,
    cash_out DECIMAL(15,2) DEFAULT 0,
    
    expected_amount DECIMAL(15,2) DEFAULT 0,
    actual_amount DECIMAL(15,2),
    difference DECIMAL(15,2), -- Over/Short
    
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed'
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key after cash_sessions is created
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_cash_session 
    FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id);

-- Cash Movements (Within a session)
CREATE TABLE cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cash_session_id UUID NOT NULL REFERENCES cash_sessions(id),
    
    movement_type cash_movement_type NOT NULL,
    reference_type VARCHAR(50), -- 'transaction', 'expense', 'deposit'
    reference_id UUID,
    
    amount DECIMAL(15,2) NOT NULL,
    
    reason TEXT,
    notes TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chart of Accounts
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES accounts(id),
    
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    type account_type NOT NULL,
    
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE, -- System accounts cannot be deleted
    is_active BOOLEAN DEFAULT TRUE,
    
    current_balance DECIMAL(15,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Entries
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id),
    
    entry_number VARCHAR(50) NOT NULL UNIQUE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    reference_type VARCHAR(50), -- 'transaction', 'adjustment', 'manual'
    reference_id UUID,
    
    description TEXT,
    
    total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    is_posted BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES users(id),
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Lines
CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    
    entry_type journal_entry_type NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses (Quick expense tracking)
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    account_id UUID REFERENCES accounts(id),
    cash_session_id UUID REFERENCES cash_sessions(id),
    
    expense_number VARCHAR(50) NOT NULL UNIQUE,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    category VARCHAR(100),
    vendor VARCHAR(200),
    
    amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    
    description TEXT,
    receipt_url TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AUDIT TABLES
-- ============================================================================

-- Audit Log (Automatic change tracking)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],
    
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Logs (User actions / Business events)
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id),
    user_id UUID REFERENCES users(id),
    
    action VARCHAR(100) NOT NULL, -- 'login', 'logout', 'sale_completed', 'refund_issued', etc.
    module VARCHAR(50), -- 'pos', 'inventory', 'work_order', etc.
    
    entity_type VARCHAR(100),
    entity_id UUID,
    
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Core indexes
CREATE INDEX idx_users_branch ON users(branch_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);

-- Catalog indexes
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_barcode ON items(barcode);
CREATE INDEX idx_items_name ON items USING gin(to_tsvector('english', name));
CREATE INDEX idx_item_variants_item ON item_variants(item_id);
CREATE INDEX idx_item_variants_barcode ON item_variants(barcode);
CREATE INDEX idx_bundle_items_bundle ON bundle_items(bundle_id);

-- Inventory indexes
CREATE INDEX idx_warehouses_branch ON warehouses(branch_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_inventory_item ON inventory(item_id);
CREATE INDEX idx_inventory_item_variant ON inventory(item_id, variant_id);
CREATE INDEX idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);

-- Customer indexes
CREATE INDEX idx_customers_group ON customers(group_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers USING gin(to_tsvector('english', name));

-- Transaction indexes
CREATE INDEX idx_transactions_branch ON transactions(branch_id);
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_number ON transactions(transaction_number);
CREATE INDEX idx_transactions_cash_session ON transactions(cash_session_id);
CREATE INDEX idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_item ON transaction_items(item_id);
CREATE INDEX idx_payments_transaction ON payments(transaction_id);
CREATE INDEX idx_payments_method ON payments(payment_method_id);

-- Work order indexes
CREATE INDEX idx_work_orders_branch ON work_orders(branch_id);
CREATE INDEX idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX idx_work_orders_technician ON work_orders(technician_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_number ON work_orders(work_order_number);
CREATE INDEX idx_work_order_items_wo ON work_order_items(work_order_id);

-- Cash & accounting indexes
CREATE INDEX idx_cash_sessions_register ON cash_sessions(cash_register_id);
CREATE INDEX idx_cash_sessions_status ON cash_sessions(status);
CREATE INDEX idx_cash_movements_session ON cash_movements(cash_session_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX idx_expenses_branch ON expenses(branch_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- Audit indexes
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Audit log trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    changed_cols TEXT[];
    old_json JSONB;
    new_json JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);
        
        SELECT array_agg(key) INTO changed_cols
        FROM jsonb_each(new_json) AS n(key, value)
        WHERE n.value IS DISTINCT FROM old_json->n.key;
        
        IF changed_cols IS NOT NULL AND array_length(changed_cols, 1) > 0 THEN
            INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_fields)
            VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', old_json, new_json, changed_cols);
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers
CREATE TRIGGER set_updated_at_branches BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_roles BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_categories BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_items BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_item_variants BEFORE UPDATE ON item_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_warehouses BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_inventory BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_customers BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_transactions BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_work_orders BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_cash_sessions BEFORE UPDATE ON cash_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit triggers (on important tables)
CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_transaction_items AFTER INSERT OR UPDATE OR DELETE ON transaction_items FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_inventory AFTER INSERT OR UPDATE OR DELETE ON inventory FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_work_orders AFTER INSERT OR UPDATE OR DELETE ON work_orders FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_cash_sessions AFTER INSERT OR UPDATE OR DELETE ON cash_sessions FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_cash_movements AFTER INSERT OR UPDATE OR DELETE ON cash_movements FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_journal_entries AFTER INSERT OR UPDATE OR DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================================
-- ROW LEVEL SECURITY (For Supabase)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for backend/admin)
-- These policies allow service_role full access
CREATE POLICY "Service role has full access to branches" ON branches FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role has full access to users" ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role has full access to roles" ON roles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role has full access to permissions" ON permissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role has full access to items" ON items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role has full access to inventory" ON inventory FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role has full access to transactions" ON transactions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role has full access to work_orders" ON work_orders FOR ALL USING (auth.role() = 'service_role');

-- User-based policies (users can only see their branch data)
CREATE POLICY "Users can view their own branch" ON branches 
FOR SELECT USING (
    id IN (SELECT branch_id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "Users can view items" ON items 
FOR SELECT USING (true);

CREATE POLICY "Users can view their branch warehouses" ON warehouses 
FOR SELECT USING (
    branch_id IN (SELECT branch_id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "Users can view their branch inventory" ON inventory 
FOR SELECT USING (
    warehouse_id IN (
        SELECT w.id FROM warehouses w 
        JOIN users u ON u.branch_id = w.branch_id 
        WHERE u.auth_id = auth.uid()
    )
);

CREATE POLICY "Users can view their branch transactions" ON transactions 
FOR SELECT USING (
    branch_id IN (SELECT branch_id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "Users can view their branch work orders" ON work_orders 
FOR SELECT USING (
    branch_id IN (SELECT branch_id FROM users WHERE auth_id = auth.uid())
);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Default roles
INSERT INTO roles (name, description, is_system) VALUES
('Super Admin', 'Full system access', TRUE),
('Branch Manager', 'Full access to branch operations', TRUE),
('Cashier', 'POS and basic operations', TRUE),
('Inventory Staff', 'Inventory management', TRUE),
('Technician', 'Work order management', TRUE),
('Accountant', 'Financial operations', TRUE);

-- Default permissions
INSERT INTO permissions (code, name, module) VALUES
-- Dashboard
('dashboard.view', 'View Dashboard', 'dashboard'),

-- Branch
('branch.view', 'View Branches', 'branch'),
('branch.create', 'Create Branches', 'branch'),
('branch.update', 'Update Branches', 'branch'),
('branch.delete', 'Delete Branches', 'branch'),

-- Users
('user.view', 'View Users', 'user'),
('user.create', 'Create Users', 'user'),
('user.update', 'Update Users', 'user'),
('user.delete', 'Delete Users', 'user'),

-- Products
('item.view', 'View Items', 'item'),
('item.create', 'Create Items', 'item'),
('item.update', 'Update Items', 'item'),
('item.delete', 'Delete Items', 'item'),
('item.price.view', 'View Cost Prices', 'item'),
('item.price.update', 'Update Prices', 'item'),

-- Inventory
('inventory.view', 'View Inventory', 'inventory'),
('inventory.adjust', 'Adjust Inventory', 'inventory'),
('inventory.transfer', 'Transfer Stock', 'inventory'),

-- Customers
('customer.view', 'View Customers', 'customer'),
('customer.create', 'Create Customers', 'customer'),
('customer.update', 'Update Customers', 'customer'),
('customer.delete', 'Delete Customers', 'customer'),

-- POS
('pos.access', 'Access POS', 'pos'),
('pos.discount', 'Apply Discounts', 'pos'),
('pos.discount.max', 'Apply Max Discount', 'pos'),
('pos.refund', 'Process Refunds', 'pos'),
('pos.void', 'Void Transactions', 'pos'),
('pos.hold', 'Hold Transactions', 'pos'),
('pos.open.drawer', 'Open Cash Drawer', 'pos'),

-- Work Orders
('workorder.view', 'View Work Orders', 'workorder'),
('workorder.create', 'Create Work Orders', 'workorder'),
('workorder.update', 'Update Work Orders', 'workorder'),
('workorder.delete', 'Delete Work Orders', 'workorder'),

-- Cash Management
('cash.session.open', 'Open Cash Session', 'cash'),
('cash.session.close', 'Close Cash Session', 'cash'),
('cash.movement', 'Cash In/Out', 'cash'),
('cash.view.all', 'View All Sessions', 'cash'),

-- Reports
('report.sales', 'Sales Reports', 'report'),
('report.inventory', 'Inventory Reports', 'report'),
('report.financial', 'Financial Reports', 'report'),
('report.export', 'Export Reports', 'report'),

-- Settings
('settings.view', 'View Settings', 'settings'),
('settings.update', 'Update Settings', 'settings');

-- Default units
INSERT INTO units (code, name) VALUES
('pcs', 'Pieces'),
('unit', 'Unit'),
('box', 'Box'),
('kg', 'Kilogram'),
('g', 'Gram'),
('l', 'Liter'),
('ml', 'Milliliter'),
('m', 'Meter'),
('cm', 'Centimeter'),
('hr', 'Hour'),
('min', 'Minute'),
('svc', 'Service');

-- Default payment methods
INSERT INTO payment_methods (code, name, type) VALUES
('cash', 'Cash', 'cash'),
('debit', 'Debit Card', 'card'),
('credit', 'Credit Card', 'card'),
('transfer', 'Bank Transfer', 'transfer'),
('qris', 'QRIS', 'ewallet'),
('gopay', 'GoPay', 'ewallet'),
('ovo', 'OVO', 'ewallet'),
('dana', 'DANA', 'ewallet'),
('store_credit', 'Store Credit', 'credit');

-- Default chart of accounts
INSERT INTO accounts (code, name, type, is_system) VALUES
-- Assets
('1000', 'Assets', 'asset', TRUE),
('1100', 'Cash on Hand', 'asset', TRUE),
('1110', 'Cash in Bank', 'asset', TRUE),
('1200', 'Accounts Receivable', 'asset', TRUE),
('1300', 'Inventory', 'asset', TRUE),

-- Liabilities
('2000', 'Liabilities', 'liability', TRUE),
('2100', 'Accounts Payable', 'liability', TRUE),
('2200', 'Tax Payable', 'liability', TRUE),

-- Equity
('3000', 'Equity', 'equity', TRUE),
('3100', 'Owner Equity', 'equity', TRUE),
('3200', 'Retained Earnings', 'equity', TRUE),

-- Revenue
('4000', 'Revenue', 'revenue', TRUE),
('4100', 'Sales Revenue', 'revenue', TRUE),
('4200', 'Service Revenue', 'revenue', TRUE),
('4900', 'Other Revenue', 'revenue', TRUE),

-- Expenses
('5000', 'Expenses', 'expense', TRUE),
('5100', 'Cost of Goods Sold', 'expense', TRUE),
('5200', 'Salary Expense', 'expense', TRUE),
('5300', 'Rent Expense', 'expense', TRUE),
('5400', 'Utilities Expense', 'expense', TRUE),
('5900', 'Other Expense', 'expense', TRUE);

-- Default customer group
INSERT INTO customer_groups (code, name, is_default) VALUES
('general', 'General Customer', TRUE);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Generate transaction number
CREATE OR REPLACE FUNCTION generate_transaction_number(p_branch_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_branch_code TEXT;
    v_date TEXT;
    v_seq INTEGER;
    v_number TEXT;
BEGIN
    SELECT code INTO v_branch_code FROM branches WHERE id = p_branch_id;
    v_date := TO_CHAR(CURRENT_DATE, 'YYMMDD');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(transaction_number FROM LENGTH(v_branch_code) + 8) AS INTEGER)
    ), 0) + 1 INTO v_seq
    FROM transactions 
    WHERE branch_id = p_branch_id 
    AND transaction_date = CURRENT_DATE;
    
    v_number := v_branch_code || '-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Generate work order number
CREATE OR REPLACE FUNCTION generate_work_order_number(p_branch_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_branch_code TEXT;
    v_date TEXT;
    v_seq INTEGER;
    v_number TEXT;
BEGIN
    SELECT code INTO v_branch_code FROM branches WHERE id = p_branch_id;
    v_date := TO_CHAR(CURRENT_DATE, 'YYMMDD');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(work_order_number FROM LENGTH(v_branch_code) + 11) AS INTEGER)
    ), 0) + 1 INTO v_seq
    FROM work_orders 
    WHERE branch_id = p_branch_id 
    AND DATE(received_at) = CURRENT_DATE;
    
    v_number := 'WO-' || v_branch_code || '-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Update inventory function
CREATE OR REPLACE FUNCTION update_inventory(
    p_warehouse_id UUID,
    p_item_id UUID,
    p_variant_id UUID,
    p_quantity DECIMAL,
    p_movement_type stock_movement_type,
    p_reference_type TEXT,
    p_reference_id UUID,
    p_unit_cost DECIMAL,
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_inventory_id UUID;
    v_qty_before DECIMAL;
    v_qty_after DECIMAL;
    v_movement_id UUID;
BEGIN
    -- Get or create inventory record
    SELECT id, quantity INTO v_inventory_id, v_qty_before
    FROM inventory 
    WHERE warehouse_id = p_warehouse_id 
    AND item_id = p_item_id 
    AND COALESCE(variant_id, uuid_nil()) = COALESCE(p_variant_id, uuid_nil());
    
    IF v_inventory_id IS NULL THEN
        v_qty_before := 0;
        INSERT INTO inventory (warehouse_id, item_id, variant_id, quantity)
        VALUES (p_warehouse_id, p_item_id, p_variant_id, 0)
        RETURNING id INTO v_inventory_id;
    END IF;
    
    -- Calculate new quantity
    v_qty_after := v_qty_before + p_quantity;
    
    -- Update inventory
    UPDATE inventory 
    SET quantity = v_qty_after,
        updated_at = NOW()
    WHERE id = v_inventory_id;
    
    -- Record movement
    INSERT INTO stock_movements (
        warehouse_id, item_id, variant_id, movement_type,
        reference_type, reference_id, quantity, unit_cost,
        quantity_before, quantity_after, created_by
    ) VALUES (
        p_warehouse_id, p_item_id, p_variant_id, p_movement_type,
        p_reference_type, p_reference_id, p_quantity, p_unit_cost,
        v_qty_before, v_qty_after, p_user_id
    ) RETURNING id INTO v_movement_id;
    
    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS (Useful aggregations)
-- ============================================================================

-- Inventory summary view
CREATE VIEW v_inventory_summary AS
SELECT 
    i.id AS item_id,
    i.sku,
    i.name AS item_name,
    iv.id AS variant_id,
    iv.name AS variant_name,
    w.id AS warehouse_id,
    w.name AS warehouse_name,
    b.id AS branch_id,
    b.name AS branch_name,
    inv.quantity,
    inv.reserved_quantity,
    inv.available_quantity,
    inv.avg_cost,
    (inv.quantity * inv.avg_cost) AS inventory_value
FROM inventory inv
JOIN items i ON i.id = inv.item_id
LEFT JOIN item_variants iv ON iv.id = inv.variant_id
JOIN warehouses w ON w.id = inv.warehouse_id
JOIN branches b ON b.id = w.branch_id;

-- Daily sales summary view
CREATE VIEW v_daily_sales_summary AS
SELECT 
    t.branch_id,
    t.transaction_date,
    COUNT(*) AS total_transactions,
    SUM(CASE WHEN t.transaction_type = 'sale' THEN 1 ELSE 0 END) AS sales_count,
    SUM(CASE WHEN t.transaction_type = 'return' THEN 1 ELSE 0 END) AS returns_count,
    SUM(CASE WHEN t.transaction_type = 'sale' THEN t.total_amount ELSE 0 END) AS gross_sales,
    SUM(CASE WHEN t.transaction_type = 'return' THEN t.total_amount ELSE 0 END) AS total_returns,
    SUM(CASE WHEN t.transaction_type = 'sale' THEN t.total_amount ELSE -t.total_amount END) AS net_sales,
    SUM(t.discount_amount) AS total_discounts,
    SUM(t.tax_amount) AS total_tax
FROM transactions t
WHERE t.status = 'completed'
GROUP BY t.branch_id, t.transaction_date;

-- Work order summary view
CREATE VIEW v_work_order_summary AS
SELECT 
    wo.branch_id,
    DATE(wo.received_at) AS received_date,
    wo.status,
    COUNT(*) AS order_count,
    SUM(wo.total_cost) AS total_revenue,
    SUM(wo.service_cost) AS total_service,
    SUM(wo.parts_cost) AS total_parts,
    AVG(EXTRACT(EPOCH FROM (wo.completed_at - wo.received_at))/3600)::DECIMAL(10,2) AS avg_completion_hours
FROM work_orders wo
GROUP BY wo.branch_id, DATE(wo.received_at), wo.status;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
