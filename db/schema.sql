-- ============================================================
-- SupplyX Hybrid Database Schema
-- Akatsuki Labs
--
-- Source of truth: Current SupplyX Supabase MVP schema
--
-- Business model:
-- Funded spaza demand -> aggregation -> supplier bidding
-- -> winning bid -> bulk order -> allocation + savings
-- ============================================================


-- ============================================================
-- 1. PROFILES
-- Extends Supabase Auth users
-- ============================================================

create table public.profiles (
    id uuid primary key
        references auth.users(id)
        on delete cascade,

    full_name text not null,

    phone text,

    role text not null
        check (
            role in (
                'spaza_owner',
                'supplier',
                'admin'
            )
        ),

    created_at timestamptz not null default now()
);


-- ============================================================
-- 2. SPAZA SHOPS
-- ============================================================

create table public.spaza_shops (
    id uuid primary key default gen_random_uuid(),

    owner_id uuid not null
        references public.profiles(id)
        on delete cascade,

    shop_name text not null,

    location text,

    created_at timestamptz not null default now()
);


-- ============================================================
-- 3. SUPPLIERS
-- Supplier businesses.
-- Suppliers do NOT own products in the SupplyX catalogue.
-- ============================================================

create table public.suppliers (
    id uuid primary key default gen_random_uuid(),

    owner_id uuid not null
        references public.profiles(id)
        on delete cascade,

    business_name text not null,

    contact_phone text,

    location text,

    created_at timestamptz not null default now()
);


-- ============================================================
-- 4. PRODUCTS
-- General market catalogue.
-- No supplier_id because products do not belong to suppliers.
-- ============================================================

create table public.products (
    id uuid primary key default gen_random_uuid(),

    product_name text not null,

    description text,

    unit text not null,

    market_unit_price numeric(10,2) not null
        check (market_unit_price >= 0),

    created_at timestamptz not null default now(),

    market_price_source text,

    market_price_date date
);


-- ============================================================
-- 5. PURCHASING GROUPS
-- Groups of spaza shops pooling buying power.
-- ============================================================

create table public.purchasing_groups (
    id uuid primary key default gen_random_uuid(),

    group_name text not null,

    created_by uuid not null
        references public.profiles(id)
        on delete cascade,

    target_amount numeric(12,2) not null
        check (target_amount > 0),

    status text not null default 'open'
        check (
            status in (
                'open',
                'funded',
                'ordered',
                'completed',
                'cancelled'
            )
        ),

    created_at timestamptz not null default now()
);


-- ============================================================
-- 6. GROUP MEMBERS
-- Links spaza shops to purchasing groups.
-- ============================================================

create table public.group_members (
    id uuid primary key default gen_random_uuid(),

    group_id uuid not null
        references public.purchasing_groups(id)
        on delete cascade,

    shop_id uuid not null
        references public.spaza_shops(id)
        on delete cascade,

    joined_at timestamptz not null default now(),

    status text not null default 'active'
        check (
            status in (
                'active',
                'left'
            )
        ),

    unique (group_id, shop_id)
);


-- ============================================================
-- 7. REQUESTS
-- Individual product demand from a spaza shop.
--
-- market_unit_price is a snapshot of the market price when
-- the request was created.
--
-- committed_amount represents the full market-value amount
-- that the shop must commit before the request is funded.
-- ============================================================

create table public.requests (
    id uuid primary key default gen_random_uuid(),

    group_member_id uuid not null
        references public.group_members(id)
        on delete cascade,

    product_id uuid not null
        references public.products(id)
        on delete restrict,

    quantity numeric(12,2) not null
        check (quantity > 0),

    market_unit_price numeric(10,2) not null
        check (market_unit_price >= 0),

    committed_amount numeric(12,2) not null
        check (committed_amount > 0),

    status text not null default 'pending_commitment'
        check (
            status in (
                'pending_commitment',
                'funded',
                'batched',
                'ordered',
                'fulfilled',
                'cancelled'
            )
        ),

    created_at timestamptz not null default now()
);


-- ============================================================
-- 8. CONTRIBUTIONS
-- Money committed by a shop toward a specific request.
--
-- MVP rule:
-- One full contribution per request.
-- ============================================================

create table public.contributions (
    id uuid primary key default gen_random_uuid(),

    group_member_id uuid not null
        references public.group_members(id)
        on delete cascade,

    amount numeric(12,2) not null
        check (amount > 0),

    contributed_at timestamptz not null default now(),

    request_id uuid
        references public.requests(id)
        on delete restrict,

    unique (request_id)
);


-- ============================================================
-- 9. AUCTIONS
-- Supplier-facing procurement opportunity created from
-- aggregated FUNDED requests.
--
-- Market price / buying power are deliberately not stored here
-- because suppliers should not see that information.
-- ============================================================

create table public.auctions (
    id uuid primary key default gen_random_uuid(),

    group_id uuid not null
        references public.purchasing_groups(id)
        on delete restrict,

    product_id uuid not null
        references public.products(id)
        on delete restrict,

    quantity numeric(12,2) not null
        check (quantity > 0),

    closes_at timestamptz not null,

    status text not null default 'open'
        check (
            status in (
                'open',
                'closed',
                'awarded',
                'cancelled'
            )
        ),

    created_at timestamptz not null default now()
);


-- ============================================================
-- 10. AUCTION REQUESTS
-- Shows which funded individual requests were aggregated
-- into a supplier-facing auction.
-- ============================================================

create table public.auction_requests (
    auction_id uuid not null
        references public.auctions(id)
        on delete cascade,

    request_id uuid not null
        references public.requests(id)
        on delete restrict,

    primary key (auction_id, request_id),

    unique (request_id)
);


-- ============================================================
-- 11. BIDS
-- Private supplier offers.
--
-- Suppliers submit a price per unit.
-- Suppliers should not see competitors' bid values.
-- ============================================================

create table public.bids (
    id uuid primary key default gen_random_uuid(),

    auction_id uuid not null
        references public.auctions(id)
        on delete cascade,

    supplier_id uuid not null
        references public.suppliers(id)
        on delete restrict,

    unit_price numeric(10,2) not null
        check (unit_price > 0),

    created_at timestamptz not null default now(),

    unique (auction_id, supplier_id)
);


-- ============================================================
-- 12. BULK ORDERS
-- Successful procurement created from a winning supplier bid.
--
-- SupplyX MVP supplier transaction fee = 10%
-- ============================================================

create table public.bulk_orders (
    id uuid primary key default gen_random_uuid(),

    group_id uuid not null
        references public.purchasing_groups(id)
        on delete restrict,

    supplier_id uuid not null
        references public.suppliers(id)
        on delete restrict,

    subtotal numeric(12,2) not null
        check (subtotal >= 0),

    supplier_fee_rate numeric(5,2) not null default 10.00
        check (
            supplier_fee_rate >= 0
            and supplier_fee_rate <= 100
        ),

    supplier_fee_amount numeric(12,2) not null default 0
        check (supplier_fee_amount >= 0),

    supplier_payout numeric(12,2) not null
        check (supplier_payout >= 0),

    status text not null default 'pending'
        check (
            status in (
                'pending',
                'submitted',
                'accepted',
                'completed',
                'cancelled'
            )
        ),

    created_at timestamptz not null default now(),

    auction_id uuid
        references public.auctions(id)
        on delete restrict,

    winning_bid_id uuid
        references public.bids(id)
        on delete restrict
);


-- ============================================================
-- 13. BULK ORDER ITEMS
-- Retained for order item tracking and future multi-product
-- support.
-- ============================================================

create table public.bulk_order_items (
    id uuid primary key default gen_random_uuid(),

    bulk_order_id uuid not null
        references public.bulk_orders(id)
        on delete cascade,

    product_id uuid not null
        references public.products(id)
        on delete restrict,

    quantity numeric(12,2) not null
        check (quantity > 0),

    unit_price numeric(10,2) not null
        check (unit_price >= 0),

    line_total numeric(12,2) not null
        check (line_total >= 0)
);


-- ============================================================
-- 14. ALLOCATIONS
-- Final cost and savings allocated back to each shop request.
-- ============================================================

create table public.allocations (
    id uuid primary key default gen_random_uuid(),

    bulk_order_id uuid not null
        references public.bulk_orders(id)
        on delete restrict,

    request_id uuid not null
        references public.requests(id)
        on delete restrict,

    quantity numeric(12,2) not null
        check (quantity > 0),

    actual_cost numeric(12,2) not null
        check (actual_cost >= 0),

    savings_amount numeric(12,2) not null
        check (savings_amount >= 0),

    created_at timestamptz not null default now(),

    unique (request_id)
);


-- ============================================================
-- IMPORTANT
--
-- RLS policies and role-based access rules are handled
-- separately.
--
-- Required security rules include:
--
-- 1. Suppliers must not see market_unit_price during bidding.
-- 2. Suppliers must not see competitors' bids.
-- 3. Suppliers may read/update only their own bids.
-- 4. Spaza shops may access only their own requests,
--    contributions and allocations.
-- 5. Admin/service logic controls auction awarding and
--    bulk-order creation.
-- ============================================================