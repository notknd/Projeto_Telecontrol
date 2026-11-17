import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { buildServer } from "./server.js";

// Run only against a disposable, migrated and seeded PostgreSQL database.
test(
  "PostgreSQL + engine: order, recalculation, stock, collection and history",
  { skip: !process.env.INTEGRATION_DATABASE_URL },
  async () => {
    const db = new PrismaClient({
      datasourceUrl: process.env.INTEGRATION_DATABASE_URL,
    });
    const app = buildServer({ db });
    const call = async (
      method: "GET" | "POST" | "PUT" | "PATCH",
      url: string,
      payload?: unknown,
      status = 200,
    ) => {
      const res = await app.inject({
        method,
        url: "/api/v1" + url,
        payload: payload as never,
      });
      assert.equal(res.statusCode, status, `${method} ${url}: ${res.body}`);
      return res.json();
    };
    const tag = randomUUID().slice(0, 8);
    try {
      const layout = await call("GET", "/warehouse");
      const node = layout.nodes.find(
        (n: { code: string }) => n.code === "STORAGE-A-01",
      );
      assert.equal(typeof node.x, "number");
      const beforeCounts = [
        await db.order.count(),
        await db.route.count(),
        await db.collection.count(),
      ];
      const entry = layout.nodes.find(
        (n: { type: string }) => n.type === "ENTRY",
      );
      const distance = await call("POST", "/warehouse/distance", {
        fromNodeId: entry.id,
        toNodeId: node.id,
      });
      assert.equal(distance.distanceMeters, 7);
      assert.equal(distance.pathNodeIds[0], entry.id);
      assert.equal(distance.pathNodeIds.at(-1), node.id);
      const same = await call("POST", "/warehouse/distance", {
        fromNodeId: node.id,
        toNodeId: node.id,
      });
      assert.equal(same.distanceMeters, 0);
      await call(
        "POST",
        "/warehouse/distance",
        { fromNodeId: entry.id, toNodeId: randomUUID() },
        422,
      );
      await call(
        "POST",
        "/warehouse/distance",
        { fromNodeId: "invalid", toNodeId: node.id },
        400,
      );
      assert.deepEqual(
        [
          await db.order.count(),
          await db.route.count(),
          await db.collection.count(),
        ],
        beforeCounts,
      );

      const draft = {
        sku: `TEST-${tag}`,
        name: "Produto de teste integrado",
        warehouseNodeId: node.id,
        weightKg: 1.25,
        stockQuantity: 20,
      };
      const p = await call("POST", "/products", draft, 201);
      await call("POST", "/products", draft, 409);
      await call(
        "POST",
        "/products",
        { ...draft, sku: `BAD-${tag}`, stockQuantity: -1 },
        400,
      );
      await call(
        "POST",
        "/products",
        {
          ...draft,
          sku: `BAD-${tag}`,
          warehouseNodeId: layout.nodes.find(
            (n: { type: string }) => n.type === "ENTRY",
          ).id,
        },
        422,
      );
      await call("POST", "/orders", { code: `EMPTY-${tag}`, items: [] }, 400);
      await call(
        "POST",
        "/orders",
        {
          code: `EXCESS-${tag}`,
          items: [{ productId: p.id, requestedQuantity: 21 }],
        },
        422,
      );
      const order = await call(
        "POST",
        "/orders",
        {
          code: `TEST-${tag}`,
          items: [
            { productId: p.id, requestedQuantity: 1 },
            { productId: p.id, requestedQuantity: 2 },
          ],
        },
        201,
      );
      assert.equal(order.items.length, 1);
      assert.equal(order.items[0].requestedQuantity, 3);
      await call("POST", `/orders/${order.id}/collections`, undefined, 409);
      const first = await call("POST", "/routes/calculate", {
        orderId: order.id,
      });
      assert.equal(first.route.totalDistanceMeters, 26);
      assert.equal(first.route.conventionalDistanceMeters, 26);
      assert.ok(first.route.conventionalPathNodeIds.length > 1);
      const persistedRoute = await db.route.findUniqueOrThrow({
        where: { id: first.route.id },
      });
      assert.deepEqual(
        persistedRoute.conventionalPathNodeIds,
        first.route.conventionalPathNodeIds,
      );
      const second = await call("POST", "/routes/calculate", {
        orderId: order.id,
      });
      assert.notEqual(first.route.id, second.route.id);
      let current = await call("GET", `/orders/${order.id}`);
      assert.equal(current.routes.length, 2);
      assert.equal(
        current.routes.filter(
          (r: { status: string }) => r.status === "SUPERSEDED",
        ).length,
        1,
      );
      await call("PUT", `/products/${p.id}`, {
        ...draft,
        name: "Produto atualizado",
      });
      current = await call("GET", `/orders/${order.id}`);
      assert.equal(current.status, "PENDING");
      assert.equal(current.items[0].productNameSnapshot, draft.name);
      await call("POST", `/orders/${order.id}/collections`, undefined, 409);
      await call("POST", "/routes/calculate", { orderId: order.id });
      const c = await call(
        "POST",
        `/orders/${order.id}/collections`,
        undefined,
        201,
      );
      await call("POST", `/orders/${order.id}/collections`, undefined, 409);
      await call("PUT", `/products/${p.id}`, draft, 409);
      await call("POST", `/collections/${c.id}/complete`, undefined, 409);
      const itemUrl = `/collections/${c.id}/items/${c.items[0].id}`;
      await call("PATCH", itemUrl, { collectedQuantity: 4 }, 422);
      await call("PATCH", itemUrl, { collectedQuantity: 1 });
      await call("PATCH", itemUrl, { collectedQuantity: 0 }, 422);
      const results = await Promise.all(
        [1, 2].map(() =>
          app.inject({
            method: "PATCH",
            url: "/api/v1" + itemUrl,
            payload: { collectedQuantity: 3 },
          }),
        ),
      );
      for (const result of results)
        assert.ok([200, 409].includes(result.statusCode), result.body);
      await call("PATCH", itemUrl, { collectedQuantity: 3 });
      assert.equal(
        (await db.product.findUniqueOrThrow({ where: { id: p.id } }))
          .stockQuantity,
        17,
      );
      await call("POST", `/collections/${c.id}/complete`);
      await call("POST", `/collections/${c.id}/complete`);
      current = await call("GET", `/orders/${order.id}`);
      assert.equal(current.status, "COMPLETED");
      assert.equal(current.routes[0].status, "COMPLETED");
      assert.equal(current.collections[0].status, "COMPLETED");
      await call("POST", "/routes/calculate", { orderId: order.id }, 409);
      await call("PATCH", itemUrl, { collectedQuantity: 3 }, 409);
      const cancelled = await call(
        "POST",
        "/orders",
        {
          code: `CANCEL-${tag}`,
          items: [{ productId: p.id, requestedQuantity: 2 }],
        },
        201,
      );
      await call("POST", "/routes/calculate", { orderId: cancelled.id });
      const cc = await call(
        "POST",
        `/orders/${cancelled.id}/collections`,
        undefined,
        201,
      );
      await call("PATCH", `/collections/${cc.id}/items/${cc.items[0].id}`, {
        collectedQuantity: 1,
      });
      await call("POST", `/orders/${cancelled.id}/cancel`);
      assert.equal(
        (await db.product.findUniqueOrThrow({ where: { id: p.id } }))
          .stockQuantity,
        16,
      );
      const cancelledResult = await call("GET", `/orders/${cancelled.id}`);
      assert.equal(cancelledResult.collections[0].status, "CANCELLED");
      assert.equal(cancelledResult.items[0].collectedQuantity, 1);
    } finally {
      await app.close();
      await db.$disconnect();
    }
  },
);
