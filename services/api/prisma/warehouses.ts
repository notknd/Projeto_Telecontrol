import { PrismaClient, WarehouseNodeType } from '@prisma/client';

const catalog = [
  ['SP-BOX-01', 'Caixa organizadora', 'Organização'],
  ['SP-LAMP-01', 'Luminária de mesa', 'Iluminação'],
  ['SP-MUG-01', 'Caneca térmica', 'Cozinha'],
  ['SP-CABLE-01', 'Cabo USB-C', 'Eletrônicos'],
  ['SP-MOUSE-01', 'Mouse sem fio', 'Eletrônicos'],
  ['SP-KEY-01', 'Teclado compacto', 'Eletrônicos'],
  ['SP-NOTE-01', 'Caderno de anotações', 'Papelaria'],
  ['SP-PEN-01', 'Kit de canetas', 'Papelaria'],
  ['SP-FILE-01', 'Pasta de documentos', 'Organização'],
  ['SP-BOTTLE-01', 'Garrafa de água', 'Utilidades'],
  ['SP-TOWEL-01', 'Toalha de mão', 'Utilidades'],
  ['SP-BASKET-01', 'Cesto organizador', 'Organização'],
];

export async function seedWarehouses(db: PrismaClient) {
  for (let building = 1; building <= 3; building++) {
    await db.$transaction(async tx => {
      const warehouseId = `10000000-0000-4000-8000-00000000000${building}`;
      const prefix = building === 1 ? '' : `G${building}-`;
      await tx.warehouse.upsert({ where: { id: warehouseId }, create: { id: warehouseId, code: `G${building}`, name: `Galpão ${building}` }, update: {} });
      const nodes: { code: string; type: WarehouseNodeType; x: number; y: number; label: string }[] = [
        { code: 'ENTRY-01', type: 'ENTRY', x: 0, y: 0, label: 'Entrada' },
        { code: 'AISLE-A-01', type: 'AISLE', x: 4, y: 0, label: 'Corredor A' },
        { code: 'CROSS-01', type: 'INTERSECTION', x: 4, y: 5, label: 'Cruzamento central' },
        { code: 'STORAGE-A-01', type: 'STORAGE', x: 7, y: 0, label: 'Posição A-01' },
        { code: 'STORAGE-B-01', type: 'STORAGE', x: 7, y: 5, label: 'Posição B-01' },
        { code: 'STORAGE-C-01', type: 'STORAGE', x: 11, y: 5, label: 'Posição C-01' },
        { code: 'EXIT-01', type: 'EXIT', x: 15, y: 5, label: 'Saída' },
      ];
      const edges: [string, string, number][] = [
        ['ENTRY-01', 'AISLE-A-01', 4], ['AISLE-A-01', 'STORAGE-A-01', 3],
        ['AISLE-A-01', 'CROSS-01', 5], ['CROSS-01', 'STORAGE-B-01', 3],
        ['STORAGE-B-01', 'STORAGE-C-01', 4], ['STORAGE-C-01', 'EXIT-01', 4],
      ];
      for (let row = 0; row < 3; row++) {
        const aisle = `AISLE-${row + 2}-01`;
        nodes.push({ code: aisle, type: 'AISLE', x: 4, y: 10 + row * 5, label: `Corredor ${row + 2}` });
        edges.push([row === 0 ? 'CROSS-01' : `AISLE-${row + 1}-01`, aisle, 5]);
        for (let col = 0; col < 3; col++) {
          const letter = String.fromCharCode(68 + row * 3 + col);
          const code = `STORAGE-${letter}-01`;
          nodes.push({ code, type: 'STORAGE', x: 7 + col * 4, y: 10 + row * 5, label: `Posição ${letter}-01` });
          edges.push([col === 0 ? aisle : `STORAGE-${String.fromCharCode(67 + row * 3 + col)}-01`, code, col === 0 ? 3 : 4]);
        }
      }
      const ids = new Map<string, string>();
      for (const node of nodes) {
        const saved = await tx.warehouseNode.upsert({ where: { code: prefix + node.code }, create: { ...node, code: prefix + node.code, warehouseId }, update: {} });
        ids.set(node.code, saved.id);
      }
      for (const [a, b, distanceMeters] of edges) for (const [from, to] of [[a, b], [b, a]]) {
        const fromNodeId = ids.get(from)!, toNodeId = ids.get(to)!;
        await tx.warehouseEdge.upsert({ where: { fromNodeId_toNodeId: { fromNodeId, toNodeId } }, create: { fromNodeId, toNodeId, distanceMeters }, update: {} });
      }
      const products = [];
      for (const [index, [sku, name, category]] of catalog.entries()) {
        products.push(await tx.product.upsert({ where: { sku: prefix + sku }, create: {
          sku: prefix + sku, name, category, weightKg: 0.5, stockQuantity: 40,
          warehouseNodeId: ids.get(`STORAGE-${String.fromCharCode(65 + index)}-01`)!,
        }, update: {} }));
      }
      const legacy = ['DEMO-SHORT', 'DEMO-MULTI-STOP', 'DEMO-CONVENTIONAL'];
      for (let index = 0; index < 12; index++) {
        const code = building === 1 ? legacy[index] ?? `PED-${String(index + 1).padStart(3, '0')}` : `${prefix}PED-${String(index + 1).padStart(3, '0')}`;
        const order = await tx.order.upsert({ where: { code }, create: { code, warehouseId }, update: {} });
        if (!['PENDING', 'ROUTED'].includes(order.status)) continue;
        const current = await tx.orderItem.findMany({ where: { orderId: order.id }, orderBy: { sequence: 'desc' } });
        let sequence = current.length ? current[0].sequence + 1 : 0;
        const picks = [...new Set([index, (index + 4) % 12, (index + 8) % 12])];
        let changed = false;
        for (const position of picks) {
          const product = products[position];
          if (current.some(item => item.productId === product.id)) continue;
          await tx.orderItem.create({ data: { orderId: order.id, productId: product.id, requestedQuantity: 1 + index % 2, sequence: sequence++, productSkuSnapshot: product.sku, productNameSnapshot: product.name } });
          changed = true;
        }
        if (changed) {
          await tx.route.updateMany({ where: { orderId: order.id, status: 'CALCULATED' }, data: { status: 'INVALIDATED' } });
          if (order.status === 'ROUTED') await tx.order.update({ where: { id: order.id }, data: { status: 'PENDING' } });
        }
      }
    }, { timeout: 30000 });
  }
}
