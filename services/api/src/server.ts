import Fastify from 'fastify';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngineClient, type EngineClient } from './engine/client.js';
import { registerApiErrorHandler } from './engine/error-handler.js';
import { registerCalculateRoute } from './routes/calculate-route.js';
import { createPrismaCollectionDataSource, type CollectionDataSource } from './routes/collection-data-source.js';
import { registerCollectionRoutes } from './routes/collections.js';
import { createPrismaRouteDataSource, type RouteDataSource } from './routes/route-data-source.js';
import { createPrismaProductDataSource, type ProductDataSource } from './routes/product-data-source.js';
import { registerProductRoutes } from './routes/products.js';
import { createPrismaOrderDataSource, type OrderDataSource } from './routes/order-data-source.js';
import { registerOrderRoutes } from './routes/orders.js';

export function buildServer(
  engineClient: EngineClient = createEngineClient(),
  routeDataSource: RouteDataSource = createPrismaRouteDataSource(),
<<<<<<< HEAD
  productDataSource: ProductDataSource = createPrismaProductDataSource(),
  orderDataSource: OrderDataSource = createPrismaOrderDataSource(),
=======
  collectionDataSource: CollectionDataSource = createPrismaCollectionDataSource(),
>>>>>>> 7acda9fe5d77a014aa3d936c20980a049a969b47
) {
  const server = Fastify({ logger: true });
  server.decorate('engineClient', engineClient);
  registerApiErrorHandler(server);

  server.get('/health', async () => ({ status: 'ok', service: 'api' }));
  registerCalculateRoute(server, routeDataSource);
<<<<<<< HEAD
  registerProductRoutes(server, productDataSource);
  registerOrderRoutes(server, orderDataSource);
=======
  registerCollectionRoutes(server, collectionDataSource);
>>>>>>> 7acda9fe5d77a014aa3d936c20980a049a969b47

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
