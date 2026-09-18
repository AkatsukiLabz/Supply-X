# SupplyX starter

A working, local foundation for Akatsuki Labs’ collective procurement platform.
React + Vite frontend, Node.js + Express API, and a provisional PostgreSQL schema.

## Run locally

Requires Node.js 22.12+ (tested here with Node 25.6).

```sh
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:3001. No credentials or `.env` are needed for the local demo.
For frontend development, keep the backend running and run `npm run client` in
another terminal; open http://127.0.0.1:5173. Vite proxies `/api` to the backend.

`npm run check` runs the integration tests and builds the frontend.

## What works

- Shop, supplier and admin demo accounts; roles enforced in the API.
- Product catalogue with clearly labelled sample reference prices.
- Shop stock requests, private to that shop and the coordinator.
- Admin combines same-product, same-area requests into timed auctions.
- Suppliers submit or revise private, all-inclusive delivered bids.
- Bids close at the deadline. The coordinator awards the lowest total bid.
- Awarding creates one order and allocates its cost among shops exactly in cents.
- Winning supplier dispatches; each shop confirms its own receipt.
- Order completes only after every participating shop receives its allocation.
- Local data persists under `.data/postgres` across restarts.

The local database is PGlite (embedded PostgreSQL), not a mocked JavaScript array.
The `pg` adapter supports a remote PostgreSQL connection when configured. Live
Supabase connectivity is not tested or configured in this deliverable.

## Try the complete workflow

1. Select Corner Basket → Stock requests → request 5 packs of maize meal.
2. Select Mosh’s Mini Market → request 5 packs of maize meal.
3. Select SupplyX coordinator → Stock requests → select the two requests.
4. Set the bidding window to 1 minute and open the auction.
5. Select Ubuntu Wholesale → Auctions → bid R1,000 for the entire delivered batch.
6. Select Community Cash & Carry → bid R950. Each sees only its own bid.
7. After the deadline, select coordinator → Auctions → Refresh → Award lowest bid.
8. Select Community Cash & Carry → Orders → Mark dispatched.
9. Select each shop → Orders → Confirm receipt. The total order then completes.

The database starts with accounts and products only. Any requests present in the
provided running copy are local test/demo data, not real retailer activity.

## Project layout and handover

| Location                 | Purpose                                          | Suggested team owner |
| ------------------------ | ------------------------------------------------ | -------------------- |
| `server/app.js`          | HTTP routes, validation, error responses         | Siyolise             |
| `server/service.js`      | Procurement business rules and transactions      | Siyolise             |
| `server/auth.js`         | Demo identity / Supabase token verification      | Siyolise             |
| `server/db.js`           | PGlite and PostgreSQL adapters; local seed data  | Siyolise + Bistro    |
| `db/schema.sql`          | Provisional tables, constraints and indexes      | Bistro               |
| `client/src/`            | Replaceable test frontend                        | Wandile + Ngwako     |
| `docs/API.md`            | Frontend/backend contract                        | Shared               |
| `docs/DECISIONS.md`      | Assumptions, unresolved rules and work breakdown | Bistro + team        |
| `tests/workflow.test.js` | Real HTTP + database integration tests           | Backend              |

Keep API responses stable while adjusting internal tables where practical. The
frontend uses the API only; it does not directly depend on the database schema.
This starter uses JavaScript ES modules. TypeScript was not an agreed requirement.

## Moving to Supabase later

1. Review `db/schema.sql` with Bistro. Apply it to a development PostgreSQL/Supabase
   database. It is a baseline, not an upgrade migration system; future changes
   need numbered migrations, not edits to already-applied CREATE statements.
2. Keep `supplyx` PRIVATE: do not add it to Supabase Data API exposed schemas.
   The API checks ownership and role; this version does not use end-user RLS.
3. Use a dedicated backend database login, grant only USAGE on `supplyx` and
   SELECT/INSERT/UPDATE on its tables, and keep credentials on the server.
   The app needs no DELETE or schema ownership privileges. Configure verified TLS
   for the selected provider; do not disable certificate validation.
4. Copy `.env.example` to `.env`, set `AUTH_MODE=supabase`, `DATABASE_URL`, and
   `SUPABASE_URL`. The server refuses a remote database in demo mode.
5. Connect the frontend team’s Supabase login. Send its access token as
   `Authorization: Bearer <token>` to `/api`. The existing dashboard intentionally
   supports demo account switching only; real login UI is a next step.
6. Provision each user in `supplyx.users` with the UUID from Supabase Auth, approved
   role and service area. There is no public registration/role-assignment endpoint.
   Privileged role assignment must remain server/admin controlled.
7. Auth verifies asymmetric Supabase JWTs against the project JWKS, issuer and
   `authenticated` audience. Legacy shared-secret projects need migration or a
   separate auth adapter; they are not silently accepted.
8. Run the same integration flow on the real development database before deployment.

No external account or remote database was changed. No code was pushed to GitHub.

## Prototype limits

This is a local development starter, not a deployed production service. Demo
accounts are intentionally not real authentication; the demo binds to loopback
and refuses `NODE_ENV=production`. Do not tunnel or publicly proxy demo mode.
Before public deployment, add rate limiting, real account onboarding, migration
tracking, monitoring, backup/restore verification and the team’s final fulfilment
and cancellation rules. Use same-origin hosting or an explicit CORS allowlist.

Maps, payment collection, supplier inventory integrations and market-price feeds
are not implemented. Areas are exact text matches; prices are illustrative. No AI
or quantum functionality is claimed. See `docs/DECISIONS.md` for next work.
