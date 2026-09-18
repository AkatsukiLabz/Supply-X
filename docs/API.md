# SupplyX API v1 (provisional)

Base: `/api`. JSON request/response bodies. Money uses integer ZAR cents.
IDs are UUIDs, dates ISO timestamps. Quantities count whole catalogue packs.

Local demo: `x-demo-user: <UUID>`. Supabase mode: `Authorization: Bearer <JWT>`.
`GET /api/demo-users` returns sample identities only in demo mode. Never send a
role or shop ID to create a request: the server derives ownership from identity.

| Method | Endpoint                          | Access            | Body / result                                               |
| ------ | --------------------------------- | ----------------- | ----------------------------------------------------------- |
| GET    | `/health`                         | Public            | `{status, mode}`                                            |
| GET    | `/me`                             | Signed in         | `{id,name,role,area}`                                       |
| GET    | `/products`                       | Signed in         | Product array with pack and illustrative reference price    |
| GET    | `/requests`                       | Shop/admin        | Own requests / all for admin; suppliers get empty array     |
| POST   | `/requests`                       | Shop              | `{productId,quantity}` → request (201)                      |
| GET    | `/auctions`                       | Signed in         | Area-eligible suppliers, participating shops, all for admin |
| POST   | `/auctions`                       | Admin             | `{requestIds:[uuid,...],closesAt:ISO}` → auction (201)      |
| POST   | `/auctions/:id/bids`              | Eligible supplier | `{totalCents}` → own bid (201), replaces prior bid          |
| POST   | `/auctions/:id/award`             | Admin             | `{}` → order; only after close; safe to repeat              |
| GET    | `/orders`                         | Signed in         | Own/assigned orders, all for admin; includes allocations    |
| POST   | `/orders/:id/dispatch`            | Winning supplier  | `{}` → `{id,status}`                                        |
| POST   | `/allocations/:requestId/receive` | Owning shop       | `{}` → `{requestId,status}`; safe to repeat                 |

A shop sees only its own order allocations and no collective `total_cents`.
A supplier sees its own bids, never competitors' bids. Admin sees bid prices only
after closing. Shop auction responses have an empty `bids` array.

Sample request:

```json
{ "productId": "20000000-0000-4000-8000-000000000001", "quantity": 5 }
```

Sample bid (R950 for the entire batch including delivery and all charges):

```json
{ "totalCents": 95000 }
```

Sample request response:

```json
{
  "id": "<request UUID>",
  "shop_id": "<authenticated shop UUID>",
  "product_id": "20000000-0000-4000-8000-000000000001",
  "quantity": 5,
  "area": "Centurion",
  "status": "submitted",
  "created_at": "<ISO timestamp>"
}
```

Errors use `{error: "readable message"}`; validation also returns
`details:[{field,message}]`. Status codes: 400 invalid input, 401 invalid identity,
403 wrong role/owner, 404 missing record, 409 invalid transition or conflict,
413 oversized payload, 500 unexpected failure without internal details.

Limits: request quantity 1–10,000; up to 100 unique requests per auction; bid
1–100,000,000 cents. Product/area mismatches reject the whole batch. Deadlines
are enforced by the server; the dashboard needs Refresh after the deadline.

New request submission is not idempotent: do not automatically retry POST
`/requests` after an uncertain network result. Fetch requests first. Add durable
idempotency keys before mobile/offline retry support. Batching cannot allocate
a request twice; awards are idempotent; supplier bids upsert per auction.
