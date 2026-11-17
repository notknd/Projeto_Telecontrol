DROP INDEX "WarehouseNode_one_active_entry";
DROP INDEX "WarehouseNode_one_active_exit";
CREATE UNIQUE INDEX "WarehouseNode_one_active_entry" ON "WarehouseNode"("warehouseId") WHERE "isActive" AND "type" = 'ENTRY';
CREATE UNIQUE INDEX "WarehouseNode_one_active_exit" ON "WarehouseNode"("warehouseId") WHERE "isActive" AND "type" = 'EXIT';
