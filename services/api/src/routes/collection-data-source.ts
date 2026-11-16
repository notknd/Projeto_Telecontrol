import { PrismaClient } from '@prisma/client';
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

export interface CollectionDataSource {
  updateItem(collectionId: string, itemId: string, collectedQuantity: number): Promise<CollectionUpdateResult>;
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
          const completedAt = new Date();
          await transaction.collection.update({ where: { id: collectionId }, data: { status: 'COMPLETED', completedAt } });
          await transaction.route.update({ where: { id: collectionItem.collection.routeId }, data: { status: 'COMPLETED' } });
          const updatedOrder = await transaction.order.update({
            where: { id: collectionItem.orderItem.orderId },
            data: { status: 'COMPLETED', completedAt },
          });
          collectionStatus = 'COMPLETED';
          orderStatus = updatedOrder.status;
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
  };
}
