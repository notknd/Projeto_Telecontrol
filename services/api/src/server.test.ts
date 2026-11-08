import assert from 'node:assert/strict';
import test from 'node:test';
import { EngineClient } from './engine/client.js';
import { buildServer } from './server.js';
import type { RouteDataSource } from './routes/route-data-source.js';

test('GET /health returns the API health state', async () => {
  const server = buildServer();
  const response = await server.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok', service: 'api' });

  await server.close();
});

function routeDataSource(orderExists = true): RouteDataSource {
  return {
    async findOrder(orderId) {
      if (!orderExists || orderId !== '11111111-1111-4111-8111-111111111111') return null;
      return {
        id: orderId,
        items: [
          { productId: 'product-a', requestedQuantity: 1, product: { isActive: true, warehouseNodeId: 'storage-a', warehouseNode: { isActive: true } } },
          { productId: 'product-b', requestedQuantity: 1, product: { isActive: true, warehouseNodeId: 'storage-b', warehouseNode: { isActive: true } } },
        ],
      };
    },
    async findActiveWarehouse() {
      return {
        nodes: [
          { id: 'entry', type: 'ENTRY', x: 0, y: 0 },
          { id: 'storage-a', type: 'STORAGE', x: 1, y: 0 },
          { id: 'storage-b', type: 'STORAGE', x: 2, y: 0 },
          { id: 'exit', type: 'EXIT', x: 3, y: 0 },
        ],
        edges: [
          { fromNodeId: 'entry', toNodeId: 'storage-a', distanceMeters: 1 },
          { fromNodeId: 'storage-a', toNodeId: 'storage-b', distanceMeters: 1 },
          { fromNodeId: 'storage-b', toNodeId: 'exit', distanceMeters: 1 },
        ],
      };
    },
  };
}

test('POST /api/v1/routes/calculate loads the order and warehouse before calling the engine', async () => {
  let requestToEngine: unknown;
  const engineClient = new EngineClient('http://engine.test', 100, async (_input, init) => {
    requestToEngine = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      status: 'success',
      pathNodeIds: ['entry', 'storage-a', 'storage-b', 'exit'],
      stops: [
        { nodeId: 'storage-a', sequence: 1, productIds: ['product-a'] },
        { nodeId: 'storage-b', sequence: 2, productIds: ['product-b'] },
      ],
      totalDistance: 3,
      distanceUnit: 'm',
      algorithm: { shortestPath: 'dijkstra', visitOrder: 'nearest_neighbor' },
    }), { headers: { 'content-type': 'application/json' } });
  });
  const server = buildServer(engineClient, routeDataSource());

  const response = await server.inject({
    method: 'POST',
    url: '/api/v1/routes/calculate',
    payload: { orderId: '11111111-1111-4111-8111-111111111111' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(requestToEngine, {
    warehouse: {
      nodes: [
        { id: 'entry', x: 0, y: 0 },
        { id: 'storage-a', x: 1, y: 0 },
        { id: 'storage-b', x: 2, y: 0 },
        { id: 'exit', x: 3, y: 0 },
      ],
      edges: [
        { from: 'entry', to: 'storage-a', distance: 1 },
        { from: 'storage-a', to: 'storage-b', distance: 1 },
        { from: 'storage-b', to: 'exit', distance: 1 },
      ],
    },
    startNodeId: 'entry',
    endNodeId: 'exit',
    stops: [
      { id: 'storage-a', productIds: ['product-a'] },
      { id: 'storage-b', productIds: ['product-b'] },
    ],
    strategy: 'nearest_neighbor',
  });
  assert.equal(response.json().route.totalDistance, 3);
  await server.close();
});

test('POST /api/v1/routes/calculate returns a safe error for an unknown order', async () => {
  const server = buildServer(new EngineClient('http://engine.test', 100), routeDataSource(false));
  const response = await server.inject({
    method: 'POST',
    url: '/api/v1/routes/calculate',
    payload: { orderId: '22222222-2222-4222-8222-222222222222' },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    error: { code: 'ORDER_NOT_FOUND', message: 'O pedido solicitado não foi encontrado.' },
  });
  await server.close();
});

test('POST /api/v1/routes/calculate rejects a malformed order identifier', async () => {
  const server = buildServer(new EngineClient('http://engine.test', 100), routeDataSource());
  const response = await server.inject({
    method: 'POST',
    url: '/api/v1/routes/calculate',
    payload: { orderId: 'not-a-uuid' },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    error: { code: 'INVALID_ROUTE_REQUEST', message: 'A requisição de cálculo é inválida.' },
  });
  await server.close();
});

test('POST /api/v1/routes/calculate rejects a body without an order identifier', async () => {
  const server = buildServer(new EngineClient('http://engine.test', 100), routeDataSource());
  const response = await server.inject({ method: 'POST', url: '/api/v1/routes/calculate', payload: {} });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    error: { code: 'INVALID_ROUTE_REQUEST', message: 'A requisição de cálculo é inválida.' },
  });
  await server.close();
});
