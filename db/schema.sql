-- Provisional SupplyX schema v1. The API is the access boundary.
-- Keep this private schema out of Supabase's exposed Data API schemas.
CREATE SCHEMA IF NOT EXISTS supplyx;
CREATE TABLE IF NOT EXISTS supplyx.users (
 id uuid PRIMARY KEY, name text NOT NULL, role text NOT NULL CHECK(role IN ('shop','supplier','admin')),
 area text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supplyx.products (
 id uuid PRIMARY KEY, name text NOT NULL, pack text NOT NULL,
 reference_cents integer NOT NULL CHECK(reference_cents > 0),
 reference_source text NOT NULL, reference_date date NOT NULL
);
CREATE TABLE IF NOT EXISTS supplyx.requests (
 id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES supplyx.users(id),
 product_id uuid NOT NULL REFERENCES supplyx.products(id),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 10000), area text NOT NULL,
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','batched','ordered','received')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supplyx.auctions (
 id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES supplyx.products(id), area text NOT NULL,
 quantity integer NOT NULL CHECK(quantity > 0), closes_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','awarded')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supplyx.allocations (
 request_id uuid PRIMARY KEY REFERENCES supplyx.requests(id),
 auction_id uuid NOT NULL REFERENCES supplyx.auctions(id), quantity integer NOT NULL CHECK(quantity > 0),
 charge_cents integer CHECK(charge_cents >= 0), received_at timestamptz
);
CREATE TABLE IF NOT EXISTS supplyx.bids (
 id uuid PRIMARY KEY, auction_id uuid NOT NULL REFERENCES supplyx.auctions(id),
 supplier_id uuid NOT NULL REFERENCES supplyx.users(id),
 total_cents integer NOT NULL CHECK(total_cents BETWEEN 1 AND 100000000),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(auction_id,supplier_id), UNIQUE(id,auction_id)
);
CREATE TABLE IF NOT EXISTS supplyx.orders (
 id uuid PRIMARY KEY, auction_id uuid NOT NULL UNIQUE REFERENCES supplyx.auctions(id),
 bid_id uuid NOT NULL UNIQUE, FOREIGN KEY(bid_id,auction_id) REFERENCES supplyx.bids(id,auction_id),
 status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','dispatched','completed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supplyx.events (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES supplyx.users(id),
 entity_id uuid NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS requests_owner_idx ON supplyx.requests(shop_id);
CREATE INDEX IF NOT EXISTS allocations_auction_idx ON supplyx.allocations(auction_id);
CREATE INDEX IF NOT EXISTS bids_auction_idx ON supplyx.bids(auction_id);
-- No direct browser access. Use a dedicated server DB login with grants on this
-- schema; never provide that connection string to the browser.
REVOKE ALL ON SCHEMA supplyx FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA supplyx FROM PUBLIC;
