import { Prisma, PrismaClient } from '@prisma/client';
import { RouteCalculationError } from './calculate-route.js';

export interface CollectionUpdateResult {
  collectionId: string;
  item: {
    id: string;
    orderItemId: string;
    requestedQuantity: number;
    collectedQuantity: number;
    collectedAt: Date | null;
  };
  collectionStatus: 'IN_PROGRESS' | 'COMPLETED';
  orderStatus: 'PENDING' | 'ROUTED' | 'COLLECTING' | 'COMPLETED' | 'CANCELLED';
}

export interface CollectionCompletionResult {
  collectionId: string;
  collectionStatus: 'COMPLETED';
  orderId: string;
  orderStatus: 'COMPLETED';
  completedAt: Date;
}

export interface CollectionHistoryEntry {
  collectionId: string;
  order: { id: string; code: string };
  routeId: string;
  startedAt: Date;
  completedAt: Date;
  itemCount: number;
  requestedQuantity: number;
  collectedQuantity: number;
}

export interface CollectionDataSource {
  updateItem(collectionId: string, itemId: string, collectedQuantity: number): Promise<CollectionUpdateResult>;
  complete(collectionId: string): Promise<CollectionCompletionResult>;
  listCompleted(): Promise<CollectionHistoryEntry[]>;
}

async function completeCollection(transaction: Prisma.TransactionClient, collectionId: string): Promise<CollectionCompletionResult> {
  const collection = await transaction.collection.findUnique({
    where: { id: collectionId },
    include: {
      order: true,
      route: true,
      items: { select: { requestedQuantity: true, collectedQuantity: true } },
    },
  });

  if (!collection) {
    throw new RouteCalculationError(404, 'COLLECTION_NOT_FOUND', 'A coleta não foi encontrada.');
  }
  if (collection.status === 'CANCELLED') {
    throw new RouteCalculationError(422, 'COLLECTION_NOT_IN_PROGRESS', 'A coleta não está em andamento.');
  }
  if (collection.route.orderId !== collection.orderId) {
    throw new RouteCalculationError(422, 'COLLECTION_CONFIGURATION_INVALID', 'A coleta não corresponde à rota do pedido.');
  }
  if (collection.items.length === 0 || collection.items.some((item) => item.collectedQuantity !== item.requestedQuantity)) {
    throw new RouteCalculationError(422, 'COLLECTION_NOT_READY', 'Todos os itens devem ser coletados antes da conclusão.');
  }

  const completedAt = collection.completedAt ?? new Date();
  if (collection.status !== 'COMPLETED') {
    await transaction.collection.update({ where: { id: collectionId }, data: { status: 'COMPLETED', completedAt } });
  }
  if (collection.route.status !== 'COMPLETED') {
    await transaction.route.update({ where: { id: collection.routeId }, data: { status: 'COMPLETED' } });
  }
  if (collection.order.status !== 'COMPLETED') {
    await transaction.order.update({ where: { id: collection.orderId }, data: { status: 'COMPLETED', completedAt } });
  }

  return {
    collectionId: collection.id,
    collectionStatus: 'COMPLETED',
    orderId: collection.orderId,
    orderStatus: 'COMPLETED',
    completedAt,
  };
}

export function createPrismaCollectionDataSource(prisma: PrismaClient = new PrismaClient()): CollectionDataSource {
  return {
    async updateItem(collectionId, itemId, collectedQuantity) {
      return prisma.$transaction(async (transaction) => {
        const collectionItem = await transaction.collectionItem.findUnique({
          where: { id: itemId },
          include: {
            collection: { include: { route: true, order: true } },
            orderItem: { include: { product: true } },
          },
        });

        if (!collectionItem || collectionItem.collectionId !== collectionId) {
          throw new RouteCalculationError(404, 'COLLECTION_ITEM_NOT_FOUND', 'O item da coleta não foi encontrado.');
        }
        if (collectionItem.collection.status !== 'IN_PROGRESS') {
          throw new RouteCalculationError(422, 'COLLECTION_NOT_IN_PROGRESS', 'A coleta não está em andamento.');
        }
        if (collectionItem.collection.orderId !== collectionItem.orderItem.orderId ||
          collectionItem.collection.route.orderId !== collectionItem.orderItem.orderId) {
          throw new RouteCalculationError(422, 'COLLECTION_CONFIGURATION_INVALID', 'A coleta não corresponde ao pedido do item.');
        }
        if (!Number.isInteger(collectedQuantity) || collectedQuantity < collectionItem.collectedQuantity ||
          collectedQuantity > collectionItem.requestedQuantity) {
          throw new RouteCalculationError(422, 'INVALID_COLLECTION_QUANTITY', 'A quantidade coletada é inválida.');
        }

        const delta = collectedQuantity - collectionItem.collectedQuantity;
        if (delta > 0) {
          const stockUpdate = await transaction.product.updateMany({
            where: { id: collectionItem.orderItem.productId, stockQuantity: { gte: delta } },
            data: { stockQuantity: { decrement: delta } },
          });
          if (stockUpdate.count !== 1) {
            throw new RouteCalculationError(422, 'INSUFFICIENT_STOCK', 'O estoque disponível é insuficiente.');
          }
          await transaction.orderItem.update({
            where: { id: collectionItem.orderItemId },
            data: { collectedQuantity: { increment: delta } },
          });
        }

        const updatedItem = await transaction.collectionItem.update({
          where: { id: itemId },
          data: {
            collectedQuantity,
            collectedAt: collectedQuantity === collectionItem.requestedQuantity ? new Date() : collectionItem.collectedAt,
          },
        });
        const collectionItems = await transaction.collectionItem.findMany({
          where: { collectionId },
          select: { requestedQuantity: true, collectedQuantity: true },
        });
        const pendingItems = collectionItems.filter((item) => item.collectedQuantity < item.requestedQuantity).length;

        let collectionStatus: 'IN_PROGRESS' | 'COMPLETED' = 'IN_PROGRESS';
        let orderStatus = collectionItem.collection.order.status;
        if (pendingItems === 0) {
          const completion = await completeCollection(transaction, collectionId);
          collectionStatus = completion.collectionStatus;
          orderStatus = completion.orderStatus;
        }

        return {
          collectionId,
          item: {
            id: updatedItem.id,
            orderItemId: updatedItem.orderItemId,
            requestedQuantity: updatedItem.requestedQuantity,
            collectedQuantity: updatedItem.collectedQuantity,
            collectedAt: updatedItem.collectedAt,
          },
          collectionStatus,
          orderStatus,
        };
      });
    },
    async complete(collectionId) {
      return prisma.$transaction((transaction) => completeCollection(transaction, collectionId));
    },
    async listCompleted() {
      const collections = await prisma.collection.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        include: {
          order: { select: { id: true, code: true } },
          items: { select: { requestedQuantity: true, collectedQuantity: true } },
        },
      });

      return collections.map((collection) => ({
        collectionId: collection.id,
        order: collection.order,
        routeId: collection.routeId,
        startedAt: collection.startedAt,
        completedAt: collection.completedAt ?? collection.updatedAt,
        itemCount: collection.items.length,
        requestedQuantity: collection.items.reduce((total, item) => total + item.requestedQuantity, 0),
        collectedQuantity: collection.items.reduce((total, item) => total + item.collectedQuantity, 0),
      }));
    },
  };
}
