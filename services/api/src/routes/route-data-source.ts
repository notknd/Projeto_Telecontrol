import { PrismaClient } from '@prisma/client';
import type { EngineRouteResponse } from '../engine/contracts.js';

export interface RouteOrder {
  id: string;
  status: string;
  items: Array<{
    id: string;
    productId: string;
    requestedQuantity: number;
    product: { isActive: boolean; warehouseNodeId: string; warehouseNode: { isActive: boolean } };
  }>;
}

export interface WarehouseForRoute {
  nodes: Array<{ id: string; type: string; x: unknown; y: unknown }>;
  edges: Array<{ fromNodeId: string; toNodeId: string; distanceMeters: unknown }>;
}

export interface RouteDataSource {
  findOrder(orderId: string): Promise<RouteOrder | null>;
  findActiveWarehouse(): Promise<WarehouseForRoute>;
  persistRoute(order: RouteOrder, route: EngineRouteResponse): Promise<PersistedRoute>;
  findRoute(routeId: string): Promise<PersistedRoute | null>;
}

export interface PersistedRoute {
  id: string;
  orderId: string;
  status: string;
  algorithm: string;
  totalDistanceMeters: number;
  distanceUnit: string;
  pathNodeIds: string[];
  stops: Array<{ nodeId: string; sequence: number; productIds: string[] }>;
}

export function createPrismaRouteDataSource(prisma: PrismaClient = new PrismaClient()): RouteDataSource {
  return {
    findOrder: (orderId) => prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            requestedQuantity: true,
            product: {
              select: {
                isActive: true,
                warehouseNodeId: true,
                warehouseNode: { select: { isActive: true } },
              },
            },
          },
        },
      },
    }),
    async findActiveWarehouse() {
      const [nodes, edges] = await Promise.all([
        prisma.warehouseNode.findMany({
          where: { isActive: true },
          select: { id: true, type: true, x: true, y: true },
        }),
        prisma.warehouseEdge.findMany({
          where: { isActive: true },
          select: { fromNodeId: true, toNodeId: true, distanceMeters: true },
        }),
      ]);
      return { nodes, edges };
    },
    async persistRoute(order, route) {
      const itemsByProduct = new Map(order.items.map((item) => [item.productId, item]));
      return prisma.$transaction(async (transaction) => {
        const persistedOrder = await transaction.order.findUnique({ where: { id: order.id }, select: { status: true } });
        if (!persistedOrder || persistedOrder.status !== 'PENDING') {
          throw new Error('ORDER_NOT_AVAILABLE_FOR_ROUTE');
        }
        await transaction.route.updateMany({
          where: { orderId: order.id, status: 'CALCULATED' },
          data: { status: 'SUPERSEDED' },
        });
        const persistedRoute = await transaction.route.create({
          data: {
            orderId: order.id,
            algorithm: `${route.algorithm.shortestPath}+${route.algorithm.visitOrder}`,
            totalDistanceMeters: route.totalDistance,
            distanceUnit: route.distanceUnit,
            steps: { create: route.pathNodeIds.map((warehouseNodeId, index) => ({ warehouseNodeId, sequence: index + 1 })) },
            stops: {
              create: route.stops.map((stop) => ({
                warehouseNodeId: stop.nodeId,
                sequence: stop.sequence,
                items: {
                  create: stop.productIds.map((productId) => {
                    const item = itemsByProduct.get(productId);
                    if (!item) throw new Error('ROUTE_PRODUCT_MISMATCH');
                    return { orderItemId: item.id };
                  }),
                },
              })),
            },
          },
          include: { steps: { orderBy: { sequence: 'asc' } }, stops: { include: { items: { include: { orderItem: true } } }, orderBy: { sequence: 'asc' } } },
        });
        await transaction.order.update({ where: { id: order.id }, data: { status: 'ROUTED' } });
        return {
          id: persistedRoute.id, orderId: persistedRoute.orderId, status: persistedRoute.status,
          algorithm: persistedRoute.algorithm, totalDistanceMeters: Number(persistedRoute.totalDistanceMeters), distanceUnit: persistedRoute.distanceUnit,
          pathNodeIds: persistedRoute.steps.map((step) => step.warehouseNodeId),
          stops: persistedRoute.stops.map((stop) => ({ nodeId: stop.warehouseNodeId, sequence: stop.sequence, productIds: stop.items.map((item) => item.orderItem.productId) })),
        };
      });
    },
    async findRoute(routeId) {
      const route = await prisma.route.findUnique({
        where: { id: routeId },
        include: { steps: { orderBy: { sequence: 'asc' } }, stops: { include: { items: { include: { orderItem: true } } }, orderBy: { sequence: 'asc' } } },
      });
      return route ? {
        id: route.id, orderId: route.orderId, status: route.status, algorithm: route.algorithm,
        totalDistanceMeters: Number(route.totalDistanceMeters), distanceUnit: route.distanceUnit,
        pathNodeIds: route.steps.map((step) => step.warehouseNodeId),
        stops: route.stops.map((stop) => ({ nodeId: stop.warehouseNodeId, sequence: stop.sequence, productIds: stop.items.map((item) => item.orderItem.productId) })),
      } : null;
    },
  };
}
