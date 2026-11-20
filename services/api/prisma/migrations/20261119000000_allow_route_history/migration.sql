-- An order item may appear once in each historical route of its order.
DROP INDEX "RouteStopItem_orderItemId_key";

CREATE INDEX "RouteStopItem_orderItemId_idx" ON "RouteStopItem"("orderItemId");
