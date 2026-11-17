import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { buildServer } from './server.js';

test('warehouse isolation and expanded picking routes', { skip: !process.env.INTEGRATION_DATABASE_URL }, async () => {
  const db = new PrismaClient({ datasourceUrl: process.env.INTEGRATION_DATABASE_URL });
  const app = buildServer({ db });
  async function call(url: string, payload?: unknown, status = 200) {
    const response = await app.inject({ method: payload ? 'POST' : 'GET', url: '/api/v1' + url, payload: payload as never });
    assert.equal(response.statusCode, status, response.body);
    return response.json();
  }
  try {
    const buildings = await call('/warehouses');
    assert.equal(buildings.length, 3);
    for (const building of buildings) {
      const query = `?warehouseId=${building.id}`;
      const layout = await call('/warehouse' + query);
      const products = await call('/products' + query);
      const orders = await call('/orders' + query);
      const ids = new Set(layout.nodes.map((n: { id: string }) => n.id));
      assert.equal(layout.nodes.filter((n: { type: string }) => n.type === 'STORAGE').length, 12);
      assert(products.every((p: { warehouseNodeId: string }) => ids.has(p.warehouseNodeId)));
      assert(orders.every((o: { warehouseId: string }) => o.warehouseId === building.id));
      const order = orders.find((o: { code: string }) => o.code.endsWith('012'));
      await call('/routes/calculate', { orderId: order.id });
      const detail = await call('/orders/' + order.id);
      assert(detail.routes[0].steps.every((s: { warehouseNodeId: string }) => ids.has(s.warehouseNodeId)));
    }
    const foreign = await call(`/products?warehouseId=${buildings[1].id}`);
    const count = await db.order.count();
    await call('/orders', { code: 'CROSS-WAREHOUSE', warehouseId: buildings[0].id, items: [{ productId: foreign[0].id, requestedQuantity: 1 }] }, 422);
    assert.equal(await db.order.count(), count);
  } finally { await app.close(); await db.$disconnect(); }
});
