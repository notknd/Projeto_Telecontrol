import type { FastifyInstance } from 'fastify';
import { toPublicApiError } from './errors.js';

export function registerApiErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler((error, _request, reply) => {
    const publicError = toPublicApiError(error);
    server.log.error({ statusCode: publicError.statusCode, code: publicError.body.error.code }, 'Request failed');
    return reply.status(publicError.statusCode).send(publicError.body);
  });
}
