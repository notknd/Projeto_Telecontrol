import { PrismaClient } from '@prisma/client';

export interface RouteOrder {
  id: string;
  items: Array<{
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
}

export function createPrismaRouteDataSource(prisma: PrismaClient = new PrismaClient()): RouteDataSource {
  return {
    findOrder: (orderId) => prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
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
  };
}
