import Fastify from 'fastify';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildServer() {
  const server = Fastify({ logger: true });

  server.get('/health', async () => ({ status: 'ok', service: 'api' }));

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
