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

function parseStartCollection(body: unknown): { orderId: string; routeId: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new RouteCalculationError(400, 'INVALID_COLLECTION_REQUEST', 'A requisição de coleta é inválida.');
  }
  const input = body as { orderId?: unknown; routeId?: unknown };
  return { orderId: parseUuid(input.orderId, 'orderId'), routeId: parseUuid(input.routeId, 'routeId') };
}

function collectionResponse(collection: Awaited<ReturnType<CollectionDataSource['find']>>) {
  if (!collection) return null;
  return {
    ...collection,
    startedAt: collection.startedAt.toISOString(),
    completedAt: collection.completedAt?.toISOString() ?? null,
    items: collection.items.map((item) => ({ ...item, collectedAt: item.collectedAt?.toISOString() ?? null })),
  };
}

export function registerCollectionRoutes(server: FastifyInstance, dataSource: CollectionDataSource): void {
  server.get('/api/v1/collections/history', async () => ({ collections: await dataSource.listCompleted() }));

  server.post<{ Body: unknown }>('/api/v1/collections', async (request, reply) => {
    const { orderId, routeId } = parseStartCollection(request.body);
    return reply.status(201).send({ collection: collectionResponse(await dataSource.start(orderId, routeId)) });
  });

  server.get<{ Params: { collectionId: string } }>('/api/v1/collections/:collectionId', async (request) => {
    const collection = await dataSource.find(parseUuid(request.params.collectionId, 'collectionId'));
    if (!collection) throw new RouteCalculationError(404, 'COLLECTION_NOT_FOUND', 'A coleta não foi encontrada.');
    return { collection: collectionResponse(collection) };
  });

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
