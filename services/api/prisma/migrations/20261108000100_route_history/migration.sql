-- Preserve historical route links while allowing a recalculation.
ALTER TABLE "OrderItem" ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "RouteStopItem_orderItemId_key";
CREATE UNIQUE INDEX "RouteStopItem_routeStopId_orderItemId_key" ON "RouteStopItem"("routeStopId", "orderItemId");
CREATE INDEX "RouteStopItem_orderItemId_idx" ON "RouteStopItem"("orderItemId");
ALTER TABLE "Route" ADD COLUMN "inputFingerprint" VARCHAR(64);
ALTER TABLE "Route" ADD COLUMN "conventionalDistanceMeters" DECIMAL(12,3);
CREATE UNIQUE INDEX "Route_one_current_per_order" ON "Route"("orderId") WHERE "status" IN ('CALCULATED', 'IN_USE');
CREATE UNIQUE INDEX "Collection_one_active_per_order" ON "Collection"("orderId") WHERE "status" = 'IN_PROGRESS';
