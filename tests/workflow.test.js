import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { database, seed, IDS } from "../server/db.js";
import { createApp } from "../server/app.js";
let db,
  server,
  base,
  time = new Date("2030-01-01T12:00:00Z");
before(async () => {
  db = await database();
  await seed(db);
  server = createApp(db, { clock: () => time }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
});
async function call(path, user = IDS.shop, body) {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-demo-user": user } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, data: await r.json() };
}
let first, second, auction, order;
test("requires identity and rejects role escalation / invalid input", async () => {
  assert.equal((await call("/products", null)).status, 401);
  assert.equal(
    (
      await call("/requests", IDS.supplier, {
        productId: IDS.product,
        quantity: 2,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/requests", IDS.shop, {
        productId: IDS.product,
        quantity: -2,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/requests", IDS.shop, {
        productId: IDS.product,
        quantity: 1,
        shopId: IDS.shop2,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/auctions", IDS.shop, {
        requestIds: [IDS.product],
        closesAt: "2030-01-01T13:00:00Z",
      })
    ).status,
    403,
  );
});
test("shop requests are private", async () => {
  first = (
    await call("/requests", IDS.shop, { productId: IDS.product, quantity: 3 })
  ).data;
  second = (
    await call("/requests", IDS.shop2, { productId: IDS.product, quantity: 7 })
  ).data;
  assert.equal((await call("/requests")).data.length, 1);
  assert.equal((await call("/requests", IDS.shop2)).data[0].id, second.id);
  assert.equal((await call("/requests", IDS.supplier)).data.length, 0);
  assert.equal((await call("/requests", IDS.admin)).data.length, 2);
});
test("rejects mixed products atomically", async () => {
  const other = (
    await call("/requests", IDS.shop, {
      productId: "20000000-0000-4000-8000-000000000002",
      quantity: 1,
    })
  ).data;
  const r = await call("/auctions", IDS.admin, {
    requestIds: [first.id, other.id],
    closesAt: "2030-01-01T13:00:00Z",
  });
  assert.equal(r.status, 400);
  assert.equal(
    (await call("/requests")).data.find((x) => x.id === first.id).status,
    "submitted",
  );
});
test("aggregates quantities and prevents duplicate allocations", async () => {
  const input = {
    requestIds: [first.id, second.id],
    closesAt: "2030-01-01T13:00:00Z",
  };
  const r = await call("/auctions", IDS.admin, input);
  assert.equal(r.status, 201);
  auction = r.data;
  assert.equal(auction.quantity, 10);
  assert.equal((await call("/auctions", IDS.admin, input)).status, 409);
  assert.equal(
    (
      await call("/auctions", IDS.admin, {
        ...input,
        requestIds: [first.id, first.id],
      })
    ).status,
    400,
  );
});
test("supplier bids remain blind, including to the admin before close", async () => {
  assert.equal(
    (
      await call(`/auctions/${auction.id}/bids`, IDS.supplier, {
        totalCents: 10001,
      })
    ).status,
    201,
  );
  await call(`/auctions/${auction.id}/bids`, IDS.supplier2, {
    totalCents: 12000,
  });
  const visible = async (u) =>
    (await call("/auctions", u)).data.find((x) => x.id === auction.id).bids;
  assert.equal((await visible(IDS.supplier)).length, 1);
  assert.equal((await visible(IDS.supplier))[0].total_cents, 10001);
  assert.equal((await visible(IDS.supplier2))[0].total_cents, 12000);
  assert.equal((await visible(IDS.admin)).length, 0);
  assert.equal((await visible(IDS.shop)).length, 0);
  assert.equal(
    (await call(`/auctions/${auction.id}/award`, IDS.admin, {})).status,
    409,
  );
});
test("closed auction rejects bids and awards once, with exact monetary allocations", async () => {
  time = new Date("2030-01-01T13:00:00Z");
  assert.equal(
    (
      await call(`/auctions/${auction.id}/bids`, IDS.supplier, {
        totalCents: 1,
      })
    ).status,
    409,
  );
  const r = await call(`/auctions/${auction.id}/award`, IDS.admin, {});
  assert.equal(r.status, 200);
  order = r.data;
  assert.equal(
    (await call(`/auctions/${auction.id}/award`, IDS.admin, {})).data.id,
    order.id,
  );
  const row = (await call("/orders", IDS.admin)).data[0];
  assert.equal(row.supplier_id, IDS.supplier);
  assert.equal(row.total_cents, 10001);
  assert.equal(
    row.allocations.reduce((s, x) => s + x.charge_cents, 0),
    10001,
  );
  assert.equal((await call("/orders", IDS.supplier2)).data.length, 0);
  const mine = (await call("/orders", IDS.shop)).data[0];
  assert.equal(mine.allocations.length, 1);
  assert.equal(mine.total_cents, undefined);
});
test("enforces dispatch ownership and separate shop receipts", async () => {
  assert.equal(
    (await call(`/allocations/${first.id}/receive`, IDS.shop, {})).status,
    409,
  );
  assert.equal(
    (await call(`/orders/${order.id}/dispatch`, IDS.supplier2, {})).status,
    403,
  );
  assert.equal(
    (await call(`/orders/${order.id}/dispatch`, IDS.supplier, {})).status,
    200,
  );
  assert.equal(
    (await call(`/allocations/${second.id}/receive`, IDS.shop, {})).status,
    403,
  );
  assert.equal(
    (await call(`/allocations/${first.id}/receive`, IDS.shop, {})).status,
    200,
  );
  assert.equal((await call("/orders", IDS.admin)).data[0].status, "dispatched");
  await call(`/allocations/${second.id}/receive`, IDS.shop2, {});
  assert.equal((await call("/orders", IDS.admin)).data[0].status, "completed");
  assert.equal(
    (await call(`/allocations/${first.id}/receive`, IDS.shop, {})).status,
    200,
  );
});
test("database transaction rolls back failed changes", async () => {
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.query("UPDATE supplyx.users SET name='Incorrect' WHERE id=$1", [
        IDS.shop,
      ]);
      throw Error("force rollback");
    }),
  );
  assert.equal((await call("/me")).data.name, "Mosh’s Mini Market");
});
test("rejects invalid session and hides demo authentication in Supabase mode", async () => {
  const app = createApp(db, {
      mode: "supabase",
      supabaseUrl: "https://example.supabase.co",
    }),
    s = app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  try {
    const r = await fetch(
      `http://127.0.0.1:${s.address().port}/api/demo-users`,
      { headers: { "x-demo-user": IDS.admin } },
    );
    assert.equal(r.status, 401);
  } finally {
    await new Promise((r) => s.close(r));
  }
});
test("concurrent batch creation allocates each request once", async () => {
  const r = (
    await call("/requests", IDS.shop, { productId: IDS.product, quantity: 2 })
  ).data;
  const input = { requestIds: [r.id], closesAt: "2030-01-01T14:00:00Z" };
  const results = await Promise.all([
    call("/auctions", IDS.admin, input),
    call("/auctions", IDS.admin, input),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [201, 409]);
  assert.equal(
    (
      await db.query("SELECT * FROM supplyx.allocations WHERE request_id=$1", [
        r.id,
      ])
    ).rows.length,
    1,
  );
});
test("no-bid auctions cannot create orders", async () => {
  const r = (
    await call("/requests", IDS.shop, { productId: IDS.product, quantity: 2 })
  ).data;
  const a = (
    await call("/auctions", IDS.admin, {
      requestIds: [r.id],
      closesAt: "2030-01-01T13:01:00Z",
    })
  ).data;
  time = new Date("2030-01-01T13:01:00Z");
  assert.equal(
    (await call(`/auctions/${a.id}/award`, IDS.admin, {})).status,
    409,
  );
  assert.equal(
    (await db.query("SELECT * FROM supplyx.orders WHERE auction_id=$1", [a.id]))
      .rows.length,
    0,
  );
});
test("supplier service area is checked on reads and writes", async () => {
  await db.query("UPDATE supplyx.users SET area='Soweto' WHERE id=$1", [
    IDS.supplier2,
  ]);
  try {
    assert.equal((await call("/auctions", IDS.supplier2)).data.length, 0);
    assert.equal(
      (
        await call(`/auctions/${auction.id}/bids`, IDS.supplier2, {
          totalCents: 2,
        })
      ).status,
      403,
    );
  } finally {
    await db.query("UPDATE supplyx.users SET area='Centurion' WHERE id=$1", [
      IDS.supplier2,
    ]);
  }
});
