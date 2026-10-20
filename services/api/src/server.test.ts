import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from './server.js';

test('GET /health returns the API health state', async () => {
  const server = buildServer();
  const response = await server.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok', service: 'api' });

  await server.close();
});
