import type { FastifyInstance } from 'fastify';
import type { EngineRouteRequest, EngineRouteResponse } from '../engine/contracts.js';
import type { RouteDataSource, WarehouseForRoute } from './route-data-source.js';

export class RouteCalculationError extends Error {
  constructor(readonly statusCode: 400 | 404 | 422, readonly code: string, message: string) {
    super(message);
    this.name = 'RouteCalculationError';
  }
}

function parseOrderId(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body) ||
    typeof (body as { orderId?: unknown }).orderId !== 'string' ||
    !(body as { orderId: string }).orderId.trim()) {
    throw new RouteCalculationError(400, 'INVALID_ROUTE_REQUEST', 'A requisição de cálculo é inválida.');
  }
  const orderId = (body as { orderId: string }).orderId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    throw new RouteCalculationError(400, 'INVALID_ROUTE_REQUEST', 'A requisição de cálculo é inválida.');
  }
  return orderId;
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function warehouseRequest(warehouse: WarehouseForRoute, order: Awaited<ReturnType<RouteDataSource['findOrder']>>): EngineRouteRequest {
  if (!order || order.items.length === 0) {
    throw new RouteCalculationError(422, 'ORDER_NOT_ROUTABLE', 'O pedido não possui itens disponíveis para coleta.');
  }
  if (order.items.some((item) => item.requestedQuantity <= 0 || !item.product.isActive || !item.product.warehouseNode.isActive)) {
    throw new RouteCalculationError(422, 'ORDER_NOT_ROUTABLE', 'O pedido possui itens sem posição ativa no armazém.');
  }

  const entries = warehouse.nodes.filter((node) => node.type === 'ENTRY');
  const exits = warehouse.nodes.filter((node) => node.type === 'EXIT');
  if (entries.length !== 1 || exits.length !== 1) {
    throw new RouteCalculationError(422, 'WAREHOUSE_CONFIGURATION_INVALID', 'O armazém precisa ter uma entrada e uma saída ativas.');
  }

  const nodes = warehouse.nodes.map((node) => {
    const x = finiteNumber(node.x);
    const y = finiteNumber(node.y);
    if (x === null || y === null) {
      throw new RouteCalculationError(422, 'WAREHOUSE_CONFIGURATION_INVALID', 'O armazém possui coordenadas inválidas.');
    }
    return { id: node.id, x, y };
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (order.items.some((item) => !nodeIds.has(item.product.warehouseNodeId))) {
    throw new RouteCalculationError(422, 'ORDER_NOT_ROUTABLE', 'O pedido possui itens sem posição ativa no armazém.');
  }
  const edges = warehouse.edges.map((edge) => {
    const distance = finiteNumber(edge.distanceMeters);
    if (distance === null || distance <= 0 || !nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId) ||
      edge.fromNodeId === edge.toNodeId) {
      throw new RouteCalculationError(422, 'WAREHOUSE_CONFIGURATION_INVALID', 'O armazém possui distâncias inválidas.');
    }
    return { from: edge.fromNodeId, to: edge.toNodeId, distance };
  });

  const productsByNode = new Map<string, string[]>();
  for (const item of order.items) {
    const productIds = productsByNode.get(item.product.warehouseNodeId) ?? [];
    productIds.push(item.productId);
    productsByNode.set(item.product.warehouseNodeId, productIds);
  }

  return {
    warehouse: { nodes, edges },
    startNodeId: entries[0].id,
    endNodeId: exits[0].id,
    stops: Array.from(productsByNode, ([id, productIds]) => ({ id, productIds })),
    strategy: 'nearest_neighbor',
  };
}

export function registerCalculateRoute(server: FastifyInstance, routeDataSource: RouteDataSource): void {
  server.post<{ Body: unknown }>(
    '/api/v1/routes/calculate',
    async (request): Promise<{ orderId: string; route: EngineRouteResponse }> => {
      const orderId = parseOrderId(request.body);
      const order = await routeDataSource.findOrder(orderId);
      if (!order) {
        throw new RouteCalculationError(404, 'ORDER_NOT_FOUND', 'O pedido solicitado não foi encontrado.');
      }
      const engineRequest = warehouseRequest(await routeDataSource.findActiveWarehouse(), order);
      const route = await server.engineClient.calculateRoute(engineRequest);
      return { orderId, route };
    },
  );
}
