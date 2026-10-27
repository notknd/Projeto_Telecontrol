import assert from 'node:assert/strict';
import test from 'node:test';
import { EngineClient, createEngineClient } from './client.js';
import type { EngineRouteRequest, EngineRouteResponse } from './contracts.js';
import { EngineClientError, toPublicApiError } from './errors.js';

const request: EngineRouteRequest = {
  warehouse: {
    nodes: [{ id: 'ENTRADA', x: 0, y: 0 }, { id: 'P12', x: 3, y: 2 }],
    edges: [{ from: 'ENTRADA', to: 'P12', distance: 5 }],
  },
  startNodeId: 'ENTRADA',
  stops: [{ id: 'P12', productIds: ['PROD-A'] }],
  endNodeId: 'ENTRADA',
  strategy: 'nearest_neighbor',
};

const success: EngineRouteResponse = {
  status: 'success',
  pathNodeIds: ['ENTRADA', 'P12', 'ENTRADA'],
  stops: [{ nodeId: 'P12', sequence: 1, productIds: ['PROD-A'] }],
  totalDistance: 10,
  distanceUnit: 'm',
  algorithm: { shortestPath: 'dijkstra', visitOrder: 'nearest_neighbor' },
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('uses environment URL and timeout configuration and returns a valid engine result', async () => {
  let calledUrl = '';
  let calledOptions: RequestInit | undefined;
  const client = createEngineClient(
    { ENGINE_URL: 'http://engine.test:8001', ENGINE_TIMEOUT_MS: '1250' },
    async (input, init) => {
      calledUrl = String(input);
      calledOptions = init;
      return jsonResponse(success);
    },
  );

  assert.deepEqual(await client.calculateRoute(request), success);
  assert.equal(calledUrl, 'http://engine.test:8001/internal/v1/routes/calculate');
  assert.equal(calledOptions?.method, 'POST');
  assert.equal(calledOptions?.headers && (calledOptions.headers as Record<string, string>).accept, 'application/json');
  assert.deepEqual(JSON.parse(String(calledOptions?.body)), request);
});

test('uses the default engine URL and timeout when environment variables are absent', async () => {
  let calledUrl = '';
  const client = createEngineClient({}, async (input) => {
    calledUrl = String(input);
    return jsonResponse(success);
  });

  await client.calculateRoute(request);
  assert.equal(calledUrl, 'http://engine:8000/internal/v1/routes/calculate');
});

test('rejects an invalid URL or timeout during configuration', () => {
  assert.throws(() => createEngineClient({ ENGINE_URL: 'ftp://engine.test' }), /ENGINE_URL/);
  assert.throws(() => createEngineClient({ ENGINE_URL: 'http://user:secret@engine.test' }), /ENGINE_URL/);
  assert.throws(() => createEngineClient({ ENGINE_TIMEOUT_MS: '0' }), /ENGINE_TIMEOUT_MS/);
  assert.throws(() => createEngineClient({ ENGINE_TIMEOUT_MS: 'not-a-number' }), /ENGINE_TIMEOUT_MS/);
});

test('maps a fetch timeout to a typed timeout error', async () => {
  const client = createEngineClient(
    { ENGINE_URL: 'http://engine.test', ENGINE_TIMEOUT_MS: '5' },
    (_input, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const keepEventLoopAlive = setTimeout(() => undefined, 50);
      signal?.addEventListener('abort', () => {
        clearTimeout(keepEventLoopAlive);
        reject(signal.reason);
      }, { once: true });
    }),
  );

  await assert.rejects(client.calculateRoute(request), (error: unknown) =>
    error instanceof EngineClientError && error.kind === 'timeout',
  );
});

test('maps network failures and server errors to unavailable', async () => {
  const networkFailure = new EngineClient('http://engine.test', 100, async () => {
    throw new TypeError('socket failure');
  });
  await assert.rejects(networkFailure.calculateRoute(request), (error: unknown) =>
    error instanceof EngineClientError && error.kind === 'unavailable',
  );

  const serverFailure = new EngineClient('http://engine.test', 100, async () => jsonResponse({}, 503));
  await assert.rejects(serverFailure.calculateRoute(request), (error: unknown) =>
    error instanceof EngineClientError && error.kind === 'unavailable',
  );
});

test('rejects malformed JSON and invalid engine payloads', async () => {
  const invalidJson = new EngineClient('http://engine.test', 100, async () => new Response('{', { status: 200 }));
  await assert.rejects(invalidJson.calculateRoute(request), (error: unknown) =>
    error instanceof EngineClientError && error.kind === 'invalid_response',
  );

  const invalidShape = new EngineClient('http://engine.test', 100, async () => jsonResponse({
    ...success,
    totalDistance: Number.NaN,
  }));
  await assert.rejects(invalidShape.calculateRoute(request), (error: unknown) =>
    error instanceof EngineClientError && error.kind === 'invalid_response',
  );

  const missingStop = new EngineClient('http://engine.test', 100, async () => jsonResponse({
    ...success,
    stops: [],
  }));
  await assert.rejects(missingStop.calculateRoute(request), (error: unknown) =>
    error instanceof EngineClientError && error.kind === 'invalid_response',
  );

  const wrongStart = new EngineClient('http://engine.test', 100, async () => jsonResponse({
    ...success,
    pathNodeIds: ['OTHER', 'P12', 'ENTRADA'],
  }));
  await assert.rejects(wrongStart.calculateRoute(request), (error: unknown) =>
    error instanceof EngineClientError && error.kind === 'invalid_response',
  );

  const rejectedRequest = new EngineClient('http://engine.test', 100, async () => jsonResponse({}, 422));
  await assert.rejects(rejectedRequest.calculateRoute(request), (error: unknown) =>
    error instanceof EngineClientError && error.kind === 'invalid_response',
  );
});

test('maps engine failures to safe public errors without exposing causes', () => {
  const timeout = toPublicApiError(new EngineClientError('timeout', { cause: new Error('token=secret') }));
  assert.equal(timeout.statusCode, 504);
  assert.deepEqual(timeout.body, {
    error: { code: 'ENGINE_TIMEOUT', message: 'O motor de rotas excedeu o tempo limite.' },
  });
  assert.equal(JSON.stringify(timeout.body).includes('secret'), false);

  const internal = toPublicApiError(new Error('database password=secret'));
  assert.equal(internal.statusCode, 500);
  assert.deepEqual(internal.body, {
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Ocorreu um erro interno.' },
  });
});
