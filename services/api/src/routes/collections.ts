import type { FastifyInstance } from 'fastify';
import { RouteCalculationError } from './calculate-route.js';
import type { CollectionDataSource } from './collection-data-source.js';

function parseUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new RouteCalculationError(400, 'INVALID_COLLECTION_REQUEST', `${field} inválido.`);
  }
  return value;
}

function parseCollectedQuantity(body: unknown): number {
  if (typeof body !== 'object' || body === null || Array.isArray(body) ||
    typeof (body as { collectedQuantity?: unknown }).collectedQuantity !== 'number' ||
    !Number.isInteger((body as { collectedQuantity: number }).collectedQuantity) ||
    (body as { collectedQuantity: number }).collectedQuantity < 0) {
    throw new RouteCalculationError(400, 'INVALID_COLLECTION_REQUEST', 'A quantidade coletada é obrigatória.');
  }
  return (body as { collectedQuantity: number }).collectedQuantity;
}

export function registerCollectionRoutes(server: FastifyInstance, dataSource: CollectionDataSource): void {
  server.get('/api/v1/collections/history', async () => ({ collections: await dataSource.listCompleted() }));

  server.patch<{ Params: { collectionId: string; itemId: string }; Body: unknown }>(
    '/api/v1/collections/:collectionId/items/:itemId',
    async (request) => {
      const collectionId = parseUuid(request.params.collectionId, 'collectionId');
      const itemId = parseUuid(request.params.itemId, 'itemId');
      const collectedQuantity = parseCollectedQuantity(request.body);
      return dataSource.updateItem(collectionId, itemId, collectedQuantity);
    },
  );

  server.post<{ Params: { collectionId: string } }>('/api/v1/collections/:collectionId/complete', async (request) => {
    const collectionId = parseUuid(request.params.collectionId, 'collectionId');
    return dataSource.complete(collectionId);
  });
}
