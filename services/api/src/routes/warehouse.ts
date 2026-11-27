import type { FastifyInstance } from 'fastify';
import type { WarehouseDataSource } from './warehouse-data-source.js';

export function registerWarehouseRoutes(
  server: FastifyInstance,
  dataSource: WarehouseDataSource,
): void {
  server.get('/api/v1/warehouse', async () => ({
    warehouse: await dataSource.findActiveWarehouse(),
  }));
}
