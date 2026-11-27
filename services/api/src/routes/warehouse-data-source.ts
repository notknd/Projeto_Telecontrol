import { PrismaClient } from '@prisma/client';

export interface WarehouseLayout {
  nodes: Array<{
    id: string;
    code: string;
    type: string;
    x: number;
    y: number;
    label: string | null;
    isActive: boolean;
  }>;
  edges: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    distanceMeters: number;
  }>;
}

export interface WarehouseDataSource {
  findActiveWarehouse(): Promise<WarehouseLayout>;
}

export function createPrismaWarehouseDataSource(
  prisma: PrismaClient = new PrismaClient(),
): WarehouseDataSource {
  return {
    async findActiveWarehouse() {
      const nodes = await prisma.warehouseNode.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, type: true, x: true, y: true, label: true, isActive: true },
      });
      const nodeIds = new Set(nodes.map((node) => node.id));
      const edges = await prisma.warehouseEdge.findMany({
        where: { isActive: true },
        orderBy: [{ fromNodeId: 'asc' }, { toNodeId: 'asc' }],
        select: { id: true, fromNodeId: true, toNodeId: true, distanceMeters: true },
      });

      return {
        nodes: nodes.map((node) => ({ ...node, x: Number(node.x), y: Number(node.y) })),
        edges: edges
          .filter((edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId))
          .map((edge) => ({ ...edge, distanceMeters: Number(edge.distanceMeters) })),
      };
    },
  };
}
