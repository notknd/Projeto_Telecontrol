import { PrismaClient } from '@prisma/client';

export interface OrderItemRecord {
  id: string;
  productId: string;
  requestedQuantity: number;
  collectedQuantity: number;
  productSkuSnapshot: string;
  productNameSnapshot: string;
}

export interface OrderRecord {
  id: string;
  code: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemRecord[];
}

export interface OrderProduct {
  id: string;
  sku: string;
  name: string;
  isActive: boolean;
  stockQuantity: number;
}

export interface CreateOrderInput {
  code: string;
  items: Array<{ productId: string; quantity: number; productSkuSnapshot: string; productNameSnapshot: string }>;
}

export interface OrderDataSource {
  findOrder(orderId: string): Promise<OrderRecord | null>;
  findOrderByCode(code: string): Promise<OrderRecord | null>;
  listOrders(): Promise<OrderRecord[]>;
  findProducts(productIds: string[]): Promise<OrderProduct[]>;
  createOrder(input: CreateOrderInput): Promise<OrderRecord>;
}

const orderInclude = {
  items: {
    select: {
      id: true, productId: true, requestedQuantity: true, collectedQuantity: true,
      productSkuSnapshot: true, productNameSnapshot: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

export function createPrismaOrderDataSource(prisma: PrismaClient = new PrismaClient()): OrderDataSource {
  return {
    findOrder: (orderId) => prisma.order.findUnique({ where: { id: orderId }, include: orderInclude }),
    findOrderByCode: (code) => prisma.order.findUnique({ where: { code }, include: orderInclude }),
    listOrders: () => prisma.order.findMany({ include: orderInclude, orderBy: { createdAt: 'desc' } }),
    findProducts: (productIds) => prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sku: true, name: true, isActive: true, stockQuantity: true },
    }),
    createOrder: (input) => prisma.order.create({
      data: {
        code: input.code,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            requestedQuantity: item.quantity,
            productSkuSnapshot: item.productSkuSnapshot,
            productNameSnapshot: item.productNameSnapshot,
          })),
        },
      },
      include: orderInclude,
    }),
  };
}
