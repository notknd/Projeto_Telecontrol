import Fastify from 'fastify';
import { createEngineClient } from './engine/client.js';
import { registerApiErrorHandler } from './engine/error-handler.js';

export function buildServer() {
  const server = Fastify({ logger: true });
  server.decorate('engineClient', createEngineClient());
  registerApiErrorHandler(server);

  server.get('/health', async () => ({ status: 'ok', service: 'api' }));

  return server;
}

async function start() {
  const server = buildServer();
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);

  await server.listen({ host: '0.0.0.0', port });
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
