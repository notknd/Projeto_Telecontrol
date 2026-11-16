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
  };
}

test('PATCH /api/v1/collections/:id/items/:itemId records collected quantity', async () => {
  const server = buildServer(undefined, undefined, dataSource());
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

test('collection update rejects invalid identifiers and quantity payloads', async () => {
  const server = buildServer(undefined, undefined, dataSource());
  const invalidId = await server.inject({ method: 'PATCH', url: '/api/v1/collections/not-a-uuid/items/' + itemId, payload: { collectedQuantity: 1 } });
  assert.equal(invalidId.statusCode, 400);
  assert.equal(invalidId.json().error.code, 'INVALID_COLLECTION_REQUEST');

  const invalidQuantity = await server.inject({ method: 'PATCH', url: `/api/v1/collections/${collectionId}/items/${itemId}`, payload: { collectedQuantity: '2' } });
  assert.equal(invalidQuantity.statusCode, 400);
  assert.equal(invalidQuantity.json().error.code, 'INVALID_COLLECTION_REQUEST');
  await server.close();
});
