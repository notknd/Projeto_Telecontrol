import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../server.js';
import type { OrderDataSource, OrderRecord } from './order-data-source.js';

const productId = '11111111-1111-4111-8111-111111111111';
const secondProductId = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';
const createdAt = new Date('2026-11-10T12:00:00.000Z');

function order(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: orderId, code: 'ORDER-001', status: 'PENDING', createdAt, updatedAt: createdAt,
    items: [{ id: 'item-1', productId, requestedQuantity: 2, collectedQuantity: 0, productSkuSnapshot: 'SP-BOX-01', productNameSnapshot: 'Caixa organizadora' }],
    ...overrides,
  };
}

function orderDataSource(overrides: Partial<OrderDataSource> = {}): OrderDataSource {
  return {
    async findOrder(requestedId) { return requestedId === orderId ? order() : null; },
    async findOrderByCode() { return null; },
    async listOrders() { return [order()]; },
    async findProducts(ids) {
      return ids.map((id) => ({ id, sku: id === productId ? 'SP-BOX-01' : 'SP-LAMP-01', name: 'Produto de teste', isActive: true, stockQuantity: 10 }));
    },
    async createOrder(input) {
      return order({ code: input.code, items: input.items.map((item, index) => ({
        id: `item-${index + 1}`, productId: item.productId, requestedQuantity: item.quantity, collectedQuantity: 0,
        productSkuSnapshot: item.productSkuSnapshot, productNameSnapshot: item.productNameSnapshot,
      })) });
    },
    ...overrides,
  };
}

test('POST /api/v1/orders creates a pending order with product snapshots', async () => {
  let created: unknown;
  const server = buildServer(undefined, undefined, undefined, orderDataSource({
    async createOrder(input) { created = input; return order({ code: input.code }); },
  }));
  const response = await server.inject({
    method: 'POST', url: '/api/v1/orders',
    payload: { code: ' order-001 ', items: [{ productId, quantity: 2 }, { productId: secondProductId, quantity: 1 }] },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(created, {
    code: 'ORDER-001',
    items: [
      { productId, quantity: 2, productSkuSnapshot: 'SP-BOX-01', productNameSnapshot: 'Produto de teste' },
      { productId: secondProductId, quantity: 1, productSkuSnapshot: 'SP-LAMP-01', productNameSnapshot: 'Produto de teste' },
    ],
  });
  assert.equal(response.json().order.status, 'PENDING');
  await server.close();
});

test('POST /api/v1/orders rejects duplicate codes, duplicate products and unavailable inventory', async () => {
  const duplicateServer = buildServer(undefined, undefined, undefined, orderDataSource({ async findOrderByCode() { return order(); } }));
  const duplicate = await duplicateServer.inject({ method: 'POST', url: '/api/v1/orders', payload: { code: 'ORDER-001', items: [{ productId, quantity: 1 }] } });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error.code, 'ORDER_CODE_ALREADY_EXISTS');
  await duplicateServer.close();

  const invalidServer = buildServer(undefined, undefined, undefined, orderDataSource());
  const invalid = await invalidServer.inject({ method: 'POST', url: '/api/v1/orders', payload: { code: 'ORDER-002', items: [{ productId, quantity: 1 }, { productId, quantity: 1 }] } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, 'INVALID_ORDER_REQUEST');
  await invalidServer.close();

  const unavailableServer = buildServer(undefined, undefined, undefined, orderDataSource({
    async findProducts(ids) { return ids.map((id) => ({ id, sku: 'SP-BOX-01', name: 'Caixa', isActive: false, stockQuantity: 0 })); },
  }));
  const unavailable = await unavailableServer.inject({ method: 'POST', url: '/api/v1/orders', payload: { code: 'ORDER-003', items: [{ productId, quantity: 1 }] } });
  assert.equal(unavailable.statusCode, 422);
  assert.equal(unavailable.json().error.code, 'PRODUCT_NOT_ORDERABLE');
  await unavailableServer.close();
});

test('order routes list and expose persisted order items', async () => {
  const server = buildServer(undefined, undefined, undefined, orderDataSource());
  const list = await server.inject({ method: 'GET', url: '/api/v1/orders' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().orders[0].code, 'ORDER-001');
  const detail = await server.inject({ method: 'GET', url: `/api/v1/orders/${orderId}` });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().order.items[0].productSkuSnapshot, 'SP-BOX-01');
  const missing = await server.inject({ method: 'GET', url: '/api/v1/orders/44444444-4444-4444-8444-444444444444' });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, 'ORDER_NOT_FOUND');
  await server.close();
});
