# Product decisions and next work

## Source and event context

Built from the WhatsApp export, SupplyX pitch deck, stack screenshots, whiteboard,
and two organiser emails supplied by Siyolise. The original Base44 page could not
be loaded during implementation, so this UI is original and provisional.

The newer organiser email gives 25 September 2026 at 15:00 through 27 September
at 15:30, with registration from 14:00. It supersedes the earlier times. The
organisers emphasise practical use, business sense, security, design, and working
towards TRL 4. The complete judging rubric is not supplied. A local prototype
alone does not establish a TRL certification or readiness for real transactions.
Quantum is described as 5 bonus points in the email, not a required core feature.

## Implemented assumptions, to confirm with the team

- One profile represents one shop or supplier. Team memberships come later.
- One auction contains one exact product/pack in one named area.
- A coordinator selects requests manually; there is no geospatial matching yet.
- Bids are private full-batch delivered totals including taxes and delivery.
- Suppliers may revise bids until close. Latest revision timestamp breaks equal
  price ties, then bid UUID. An admin chooses when to execute the award after close.
- The lowest delivered total wins. A submitted bid is treated as supplier commitment;
  award creates a confirmed order without a second supplier acceptance step.
- There is no shop price cap or post-award acceptance yet. Consequently this is a
  demonstration workflow only, not authority to commit real shops to purchases.
- Costs are split by quantity using largest-remainder integer-cent allocation.
- Admin sees bids only after the deadline; other suppliers never see them.
- No bids means no award. The auction remains closed without an order; reopening,
  expiry and releasing requests need a defined policy and endpoints.
- Receipt is tracked per shop; partial receipt, rejected goods and refunds are deferred.
- Commission is zero/unimplemented. The deck’s proposed up-to-15% is not hard-coded.
- Reference prices are seeded examples, not live market prices or guaranteed savings.

## Schema map

users → requests → allocations → auctions → bids → orders
products → requests and auctions
users (suppliers) → bids
events records the authenticated actor for mutations

Each allocation links a shop request to one auction, preserving ownership,
quantity, monetary share and receipt status. A request can be allocated only once.
A composite foreign key ensures the winning bid belongs to its order’s auction.
Rows are locked during batching, bidding, award and fulfilment updates. Transactions
protect changes from partial failure. The private database schema is accessed only
through Express. A future browser-direct Supabase design will need explicit RLS
policies; do not expose these tables directly as they stand.

## Ordered work breakdown

| Priority | Work                                                        | Suggested owner     | Completion evidence                                               |
| -------- | ----------------------------------------------------------- | ------------------- | ----------------------------------------------------------------- |
| 1        | Review provisional auction, payment and acceptance rules    | Bistro + Siyolise   | Written agreement, including no-bid and cancellation paths        |
| 2        | Review schema; introduce numbered migrations                | Bistro              | Schema applied to a shared development Supabase project           |
| 3        | Real sign-in + approved business onboarding                 | Siyolise + frontend | Real shop/supplier sessions; no client-controlled role escalation |
| 4        | Replace/adapt starter screens using this API contract       | Wandile + Ngwako    | Two shops complete the full flow with a supplier                  |
| 5        | Price acceptance and cancellation/rejection/no-bid recovery | Backend + product   | Requests never get stuck and no unapproved spend is committed     |
| 6        | Geographic grouping                                         | Backend + database  | Valid locations and documented service radius/area policy         |
| 7        | Reference price source and fee model                        | Bistro              | Comparable pack prices with dates, source and fee treatment       |
| 8        | Deployment hardening and real database test                 | Backend             | Verified permissions, TLS, rate limits, backups and workflow      |
| 9        | Demo rehearsal and user feedback                            | Everyone            | Retailer can complete task; explain measurable benefit            |

Payments need a provider and confirmed money-flow rules before implementation.
No escrow, pooled wallet or actual charge is implied by the current schema.
Quantum/AI exploration must not displace the procurement workflow; do not claim
technology that the app does not implement.

## Verification performed

The automated suite runs the Express HTTP endpoints against an isolated in-memory
PGlite database. It checks ownership, role validation, invalid input, mixed-product
rollback, duplicate allocation protection, blind bids, closing times, repeat awards,
exact monetary allocation, dispatch ownership, independent receipts and rollback.
The React/Vite production build is checked separately. Live Supabase auth and remote
PostgreSQL integration remain unverified until project credentials are configured.

## Latest proposed changes — not implemented yet

After the starter was built, Siyolise clarified that shops choose quantities against
a published reference price, rather than entering their own target prices. The
starter already displays sample reference prices and has no buyer price field.
Still to implement: snapshot the reference price on each request; compare final
all-inclusive cost with that snapshot; show net savings; require shop acceptance
before confirming an order; handle declines and offers with no savings. Current
auction awards still create confirmed orders immediately. Do not mistake the
proposed acceptance workflow for functionality already present.
