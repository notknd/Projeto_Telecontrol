import { PrismaClient, WarehouseNodeType } from '@prisma/client';

const prisma = new PrismaClient();

type NodeSeed = {
  code: string;
  type: WarehouseNodeType;
  x: string;
  y: string;
  label: string;
};

const nodes: NodeSeed[] = [
  { code: 'ENTRY-01', type: 'ENTRY', x: '0', y: '0', label: 'Entrada' },
  { code: 'AISLE-A-01', type: 'AISLE', x: '4', y: '0', label: 'Corredor A' },
  { code: 'CROSS-01', type: 'INTERSECTION', x: '4', y: '5', label: 'Cruzamento central' },
  { code: 'STORAGE-A-01', type: 'STORAGE', x: '7', y: '0', label: 'Posição A-01' },
  { code: 'STORAGE-B-01', type: 'STORAGE', x: '7', y: '5', label: 'Posição B-01' },
  { code: 'STORAGE-C-01', type: 'STORAGE', x: '11', y: '5', label: 'Posição C-01' },
  { code: 'EXIT-01', type: 'EXIT', x: '15', y: '5', label: 'Saída' },
];

const bidirectionalConnections = [
  ['ENTRY-01', 'AISLE-A-01', '4'],
  ['AISLE-A-01', 'STORAGE-A-01', '3'],
  ['AISLE-A-01', 'CROSS-01', '5'],
  ['CROSS-01', 'STORAGE-B-01', '3'],
  ['STORAGE-B-01', 'STORAGE-C-01', '4'],
  ['STORAGE-C-01', 'EXIT-01', '4'],
] as const;

const products = [
  { sku: 'SP-BOX-01', name: 'Caixa organizadora', category: 'Organização', weightKg: '1.500', stockQuantity: 24, nodeCode: 'STORAGE-A-01' },
  { sku: 'SP-LAMP-01', name: 'Luminária de mesa', category: 'Iluminação', weightKg: '0.850', stockQuantity: 18, nodeCode: 'STORAGE-B-01' },
  { sku: 'SP-MUG-01', name: 'Caneca térmica', category: 'Cozinha', weightKg: '0.420', stockQuantity: 30, nodeCode: 'STORAGE-C-01' },
] as const;

const orders = [
  { code: 'DEMO-SHORT', items: [{ sku: 'SP-BOX-01', quantity: 1 }] },
  { code: 'DEMO-MULTI-STOP', items: [{ sku: 'SP-BOX-01', quantity: 2 }, { sku: 'SP-LAMP-01', quantity: 1 }, { sku: 'SP-MUG-01', quantity: 3 }] },
  { code: 'DEMO-CONVENTIONAL', items: [{ sku: 'SP-MUG-01', quantity: 1 }, { sku: 'SP-BOX-01', quantity: 1 }, { sku: 'SP-LAMP-01', quantity: 1 }] },
] as const;

async function seed() {
  const nodeByCode = new Map<string, { id: string }>();

  for (const node of nodes) {
    const persistedNode = await prisma.warehouseNode.upsert({
      where: { code: node.code },
      create: node,
      update: { type: node.type, x: node.x, y: node.y, label: node.label, isActive: true },
    });
    nodeByCode.set(node.code, persistedNode);
  }

  for (const [fromCode, toCode, distanceMeters] of bidirectionalConnections) {
    const fromNodeId = nodeByCode.get(fromCode)?.id;
    const toNodeId = nodeByCode.get(toCode)?.id;
    if (!fromNodeId || !toNodeId) throw new Error(`Nó ausente na seed: ${fromCode} -> ${toCode}`);

    for (const [edgeFromNodeId, edgeToNodeId] of [[fromNodeId, toNodeId], [toNodeId, fromNodeId]]) {
      await prisma.warehouseEdge.upsert({
        where: { fromNodeId_toNodeId: { fromNodeId: edgeFromNodeId, toNodeId: edgeToNodeId } },
        create: { fromNodeId: edgeFromNodeId, toNodeId: edgeToNodeId, distanceMeters },
        update: { distanceMeters, isActive: true },
      });
    }
  }

  const productBySku = new Map<string, { id: string; sku: string; name: string }>();
  for (const product of products) {
    const warehouseNodeId = nodeByCode.get(product.nodeCode)?.id;
    if (!warehouseNodeId) throw new Error(`Posição ausente na seed: ${product.nodeCode}`);
    const { nodeCode: _, ...productData } = product;
    const persistedProduct = await prisma.product.upsert({
      where: { sku: product.sku },
      create: { ...productData, warehouseNodeId },
      update: { ...productData, warehouseNodeId, isActive: true },
    });
    productBySku.set(product.sku, persistedProduct);
  }

  for (const order of orders) {
    const persistedOrder = await prisma.order.upsert({
      where: { code: order.code },
      create: { code: order.code },
      update: { status: 'PENDING', completedAt: null, cancelledAt: null },
    });

    for (const item of order.items) {
      const product = productBySku.get(item.sku);
      if (!product) throw new Error(`Produto ausente na seed: ${item.sku}`);
      await prisma.orderItem.upsert({
        where: { orderId_productId: { orderId: persistedOrder.id, productId: product.id } },
        create: {
          orderId: persistedOrder.id,
          productId: product.id,
          requestedQuantity: item.quantity,
          productSkuSnapshot: product.sku,
          productNameSnapshot: product.name,
        },
        update: {
          requestedQuantity: item.quantity,
          collectedQuantity: 0,
          productSkuSnapshot: product.sku,
          productNameSnapshot: product.name,
        },
      });
    }
  }

  console.info('Seed concluída: 7 nós, 12 arestas, 3 produtos e 3 pedidos de demonstração.');
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
