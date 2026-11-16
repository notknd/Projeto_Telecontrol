import { PrismaClient } from '@prisma/client';

export interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  weightKg: number;
  stockQuantity: number;
  warehouseNodeId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDataSource {
  findWarehouseNode(nodeId: string): Promise<{ id: string; isActive: boolean } | null>;
  findProductBySku(sku: string): Promise<ProductRecord | null>;
  findProduct(productId: string): Promise<ProductRecord | null>;
  listProducts(): Promise<ProductRecord[]>;
  createProduct(input: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductRecord>;
}

function toProductRecord(product: {
  id: string; sku: string; name: string; category: string | null; weightKg: { toString(): string };
  stockQuantity: number; warehouseNodeId: string; isActive: boolean; createdAt: Date; updatedAt: Date;
}): ProductRecord {
  return { ...product, weightKg: Number(product.weightKg) };
}

export function createPrismaProductDataSource(prisma: PrismaClient = new PrismaClient()): ProductDataSource {
  return {
    findWarehouseNode: (nodeId) => prisma.warehouseNode.findUnique({
      where: { id: nodeId }, select: { id: true, isActive: true },
    }),
    findProductBySku: async (sku) => {
      const product = await prisma.product.findUnique({ where: { sku } });
      return product ? toProductRecord(product) : null;
    },
    findProduct: async (productId) => {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      return product ? toProductRecord(product) : null;
    },
    listProducts: async () => (await prisma.product.findMany({ orderBy: { sku: 'asc' } })).map(toProductRecord),
    createProduct: async (input) => toProductRecord(await prisma.product.create({ data: input })),
  };
}
