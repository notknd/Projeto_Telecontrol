import Fastify from 'fastify';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngineClient, type EngineClient } from './engine/client.js';
import { registerApiErrorHandler } from './engine/error-handler.js';
import { registerCalculateRoute } from './routes/calculate-route.js';
import { createPrismaRouteDataSource, type RouteDataSource } from './routes/route-data-source.js';

export function buildServer(
  engineClient: EngineClient = createEngineClient(),
  routeDataSource: RouteDataSource = createPrismaRouteDataSource(),
) {
  const server = Fastify({ logger: true });
  server.decorate('engineClient', engineClient);
  registerApiErrorHandler(server);

  server.get('/health', async () => ({ status: 'ok', service: 'api' }));
  registerCalculateRoute(server, routeDataSource);

  return server;
}

async function start() {
  const server = buildServer();
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);

  await server.listen({ host, port });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
