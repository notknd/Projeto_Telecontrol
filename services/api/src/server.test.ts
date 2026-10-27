import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from './server.js';
import { EngineClientError } from './engine/errors.js';

test('GET /health returns the API health state', async () => {
  const server = buildServer();
  const response = await server.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok', service: 'api' });

  await server.close();
});

test('maps engine failures to safe public errors', async () => {
  const server = buildServer();
  server.get('/test-engine-failure', async () => {
    throw new EngineClientError('timeout', { cause: new Error('internal connection detail') });
  });

  const response = await server.inject({ method: 'GET', url: '/test-engine-failure' });

  assert.equal(response.statusCode, 504);
  assert.deepEqual(response.json(), {
    error: { code: 'ENGINE_TIMEOUT', message: 'O motor de rotas excedeu o tempo limite.' },
  });
  assert.equal(response.body.includes('internal connection detail'), false);

  await server.close();
});

test('does not expose details of unexpected internal errors', async () => {
  const server = buildServer();
  server.get('/test-internal-failure', async () => {
    throw new Error('database password=secret');
  });

  const response = await server.inject({ method: 'GET', url: '/test-internal-failure' });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), {
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Ocorreu um erro interno.' },
  });
  assert.equal(response.body.includes('secret'), false);

  await server.close();
});
