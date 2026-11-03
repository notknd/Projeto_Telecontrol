-- CreateEnum
CREATE TYPE "WarehouseNodeType" AS ENUM ('ENTRY', 'EXIT', 'AISLE', 'INTERSECTION', 'STORAGE');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ROUTED', 'COLLECTING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "RouteStatus" AS ENUM ('CALCULATED', 'SUPERSEDED', 'IN_USE', 'COMPLETED', 'INVALIDATED');
CREATE TYPE "CollectionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WarehouseNode" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "type" "WarehouseNodeType" NOT NULL,
    "x" DECIMAL(12,3) NOT NULL,
    "y" DECIMAL(12,3) NOT NULL,
    "label" VARCHAR(120),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WarehouseNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseEdge" (
    "id" UUID NOT NULL,
    "fromNodeId" UUID NOT NULL,
    "toNodeId" UUID NOT NULL,
    "distanceMeters" DECIMAL(12,3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WarehouseEdge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(80),
    "weightKg" DECIMAL(10,3) NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "warehouseNodeId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "collectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "productSkuSnapshot" VARCHAR(50) NOT NULL,
    "productNameSnapshot" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Route" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'CALCULATED',
    "algorithm" VARCHAR(80) NOT NULL,
    "totalDistanceMeters" DECIMAL(12,3) NOT NULL,
    "distanceUnit" VARCHAR(10) NOT NULL DEFAULT 'm',
    "inputVersion" INTEGER NOT NULL DEFAULT 1,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RouteStep" (
    "id" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "warehouseNodeId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RouteStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RouteStop" (
    "id" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "warehouseNodeId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RouteStopItem" (
    "id" UUID NOT NULL,
    "routeStopId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RouteStopItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Collection" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "status" "CollectionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectionItem" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "collectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseNode_code_key" ON "WarehouseNode"("code");
CREATE UNIQUE INDEX "WarehouseNode_one_active_entry" ON "WarehouseNode"("type") WHERE "isActive" AND "type" = 'ENTRY';
CREATE UNIQUE INDEX "WarehouseNode_one_active_exit" ON "WarehouseNode"("type") WHERE "isActive" AND "type" = 'EXIT';
CREATE INDEX "WarehouseEdge_fromNodeId_idx" ON "WarehouseEdge"("fromNodeId");
CREATE INDEX "WarehouseEdge_toNodeId_idx" ON "WarehouseEdge"("toNodeId");
CREATE UNIQUE INDEX "WarehouseEdge_fromNodeId_toNodeId_key" ON "WarehouseEdge"("fromNodeId", "toNodeId");
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_warehouseNodeId_idx" ON "Product"("warehouseNodeId");
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE UNIQUE INDEX "OrderItem_orderId_productId_key" ON "OrderItem"("orderId", "productId");
CREATE INDEX "Route_orderId_status_calculatedAt_idx" ON "Route"("orderId", "status", "calculatedAt");
CREATE INDEX "RouteStep_warehouseNodeId_idx" ON "RouteStep"("warehouseNodeId");
CREATE UNIQUE INDEX "RouteStep_routeId_sequence_key" ON "RouteStep"("routeId", "sequence");
CREATE UNIQUE INDEX "RouteStop_routeId_sequence_key" ON "RouteStop"("routeId", "sequence");
CREATE UNIQUE INDEX "RouteStop_routeId_warehouseNodeId_key" ON "RouteStop"("routeId", "warehouseNodeId");
CREATE UNIQUE INDEX "RouteStopItem_orderItemId_key" ON "RouteStopItem"("orderItemId");
CREATE INDEX "RouteStopItem_routeStopId_idx" ON "RouteStopItem"("routeStopId");
CREATE UNIQUE INDEX "Collection_routeId_key" ON "Collection"("routeId");
CREATE INDEX "Collection_orderId_status_idx" ON "Collection"("orderId", "status");
CREATE INDEX "CollectionItem_orderItemId_idx" ON "CollectionItem"("orderItemId");
CREATE UNIQUE INDEX "CollectionItem_collectionId_orderItemId_key" ON "CollectionItem"("collectionId", "orderItemId");

-- AddForeignKey
ALTER TABLE "WarehouseEdge" ADD CONSTRAINT "WarehouseEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "WarehouseNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseEdge" ADD CONSTRAINT "WarehouseEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "WarehouseNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_warehouseNodeId_fkey" FOREIGN KEY ("warehouseNodeId") REFERENCES "WarehouseNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Route" ADD CONSTRAINT "Route_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteStep" ADD CONSTRAINT "RouteStep_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteStep" ADD CONSTRAINT "RouteStep_warehouseNodeId_fkey" FOREIGN KEY ("warehouseNodeId") REFERENCES "WarehouseNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_warehouseNodeId_fkey" FOREIGN KEY ("warehouseNodeId") REFERENCES "WarehouseNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteStopItem" ADD CONSTRAINT "RouteStopItem_routeStopId_fkey" FOREIGN KEY ("routeStopId") REFERENCES "RouteStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteStopItem" ADD CONSTRAINT "RouteStopItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express all cross-row and numeric invariants. These constraints
-- make invalid values fail before application code can persist them.
ALTER TABLE "WarehouseEdge" ADD CONSTRAINT "WarehouseEdge_no_self_loop" CHECK ("fromNodeId" <> "toNodeId");
ALTER TABLE "WarehouseEdge" ADD CONSTRAINT "WarehouseEdge_positive_distance" CHECK ("distanceMeters" > 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_non_negative_stock" CHECK ("stockQuantity" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_non_negative_weight" CHECK ("weightKg" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_valid_quantities" CHECK ("requestedQuantity" > 0 AND "collectedQuantity" >= 0 AND "collectedQuantity" <= "requestedQuantity");
ALTER TABLE "Route" ADD CONSTRAINT "Route_non_negative_distance" CHECK ("totalDistanceMeters" >= 0);
ALTER TABLE "Route" ADD CONSTRAINT "Route_positive_input_version" CHECK ("inputVersion" >= 1);
ALTER TABLE "Route" ADD CONSTRAINT "Route_distance_unit_meters" CHECK ("distanceUnit" = 'm');
ALTER TABLE "RouteStep" ADD CONSTRAINT "RouteStep_non_negative_sequence" CHECK ("sequence" >= 0);
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_positive_sequence" CHECK ("sequence" > 0);
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_valid_quantities" CHECK ("requestedQuantity" > 0 AND "collectedQuantity" >= 0 AND "collectedQuantity" <= "requestedQuantity");
