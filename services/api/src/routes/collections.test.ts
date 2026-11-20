import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../server.js';
import type { CollectionDataSource } from './collection-data-source.js';

const collectionId = '11111111-1111-4111-8111-111111111111';
const itemId = '22222222-2222-4222-8222-222222222222';

function dataSource(): CollectionDataSource {
  return {
    async updateItem(receivedCollectionId, receivedItemId, collectedQuantity) {
      assert.equal(receivedCollectionId, collectionId);
      assert.equal(receivedItemId, itemId);
      assert.equal(collectedQuantity, 2);
      return {
        collectionId,
        item: { id: itemId, orderItemId: '33333333-3333-4333-8333-333333333333', requestedQuantity: 2, collectedQuantity: 2, collectedAt: new Date('2026-11-15T12:00:00.000Z') },
        collectionStatus: 'COMPLETED',
        orderStatus: 'COMPLETED',
      };
    },
    async complete(receivedCollectionId) {
      assert.equal(receivedCollectionId, collectionId);
      return {
        collectionId,
        collectionStatus: 'COMPLETED',
        orderId: '33333333-3333-4333-8333-333333333333',
        orderStatus: 'COMPLETED',
        completedAt: new Date('2026-11-15T12:00:00.000Z'),
      };
    },
    async listCompleted() {
      return [{
        collectionId,
        order: { id: '33333333-3333-4333-8333-333333333333', code: 'PED-001' },
        routeId: '44444444-4444-4444-8444-444444444444',
        startedAt: new Date('2026-11-15T11:00:00.000Z'),
        completedAt: new Date('2026-11-15T12:00:00.000Z'),
        itemCount: 1,
        requestedQuantity: 2,
        collectedQuantity: 2,
      }];
    },
    async start(receivedOrderId, receivedRouteId) {
      assert.equal(receivedOrderId, '33333333-3333-4333-8333-333333333333');
      assert.equal(receivedRouteId, '44444444-4444-4444-8444-444444444444');
      return {
        id: collectionId, orderId: receivedOrderId, routeId: receivedRouteId, status: 'IN_PROGRESS',
        startedAt: new Date('2026-11-15T11:00:00.000Z'), completedAt: null,
        items: [{ id: itemId, orderItemId: '55555555-5555-4555-8555-555555555555', requestedQuantity: 2, collectedQuantity: 0, collectedAt: null }],
      };
    },
    async find(receivedCollectionId) {
      if (receivedCollectionId !== collectionId) return null;
      return {
        id: collectionId, orderId: '33333333-3333-4333-8333-333333333333', routeId: '44444444-4444-4444-8444-444444444444', status: 'IN_PROGRESS',
        startedAt: new Date('2026-11-15T11:00:00.000Z'), completedAt: null,
        items: [{ id: itemId, orderItemId: '55555555-5555-4555-8555-555555555555', requestedQuantity: 2, collectedQuantity: 0, collectedAt: null }],
      };
    },
  };
}

test('POST /api/v1/collections starts a collection and GET returns it', async () => {
  const server = buildServer(undefined, undefined, undefined, undefined, dataSource());
  const response = await server.inject({
    method: 'POST', url: '/api/v1/collections',
    payload: { orderId: '33333333-3333-4333-8333-333333333333', routeId: '44444444-4444-4444-8444-444444444444' },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().collection.status, 'IN_PROGRESS');

  const detail = await server.inject({ method: 'GET', url: `/api/v1/collections/${collectionId}` });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().collection.items.length, 1);
  await server.close();
});

test('PATCH /api/v1/collections/:id/items/:itemId records collected quantity', async () => {
  const server = buildServer(undefined, undefined, undefined, undefined, dataSource());
  const response = await server.inject({
    method: 'PATCH',
    url: `/api/v1/collections/${collectionId}/items/${itemId}`,
    payload: { collectedQuantity: 2 },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().collectionStatus, 'COMPLETED');
  assert.equal(response.json().orderStatus, 'COMPLETED');
  await server.close();
});

test('POST /api/v1/collections/:id/complete concludes a fully collected order', async () => {
  const server = buildServer(undefined, undefined, undefined, undefined, dataSource());
  const response = await server.inject({
    method: 'POST',
    url: `/api/v1/collections/${collectionId}/complete`,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().collectionStatus, 'COMPLETED');
  assert.equal(response.json().orderStatus, 'COMPLETED');
  await server.close();
});

test('GET /api/v1/collections/history returns completed collections', async () => {
  const server = buildServer(undefined, undefined, undefined, undefined, dataSource());
  const response = await server.inject({ method: 'GET', url: '/api/v1/collections/history' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().collections[0].order.code, 'PED-001');
  assert.equal(response.json().collections[0].collectedQuantity, 2);
  await server.close();
});

test('collection update rejects invalid identifiers and quantity payloads', async () => {
  const server = buildServer(undefined, undefined, undefined, undefined, dataSource());
  const invalidId = await server.inject({ method: 'PATCH', url: '/api/v1/collections/not-a-uuid/items/' + itemId, payload: { collectedQuantity: 1 } });
  assert.equal(invalidId.statusCode, 400);
  assert.equal(invalidId.json().error.code, 'INVALID_COLLECTION_REQUEST');

  const invalidQuantity = await server.inject({ method: 'PATCH', url: `/api/v1/collections/${collectionId}/items/${itemId}`, payload: { collectedQuantity: '2' } });
  assert.equal(invalidQuantity.statusCode, 400);
  assert.equal(invalidQuantity.json().error.code, 'INVALID_COLLECTION_REQUEST');
  await server.close();
});
