import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../server.js';
import type { ProductDataSource, ProductRecord } from './product-data-source.js';

const nodeId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const createdAt = new Date('2026-11-08T12:00:00.000Z');

function product(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: productId, sku: 'SP-BOX-01', name: 'Caixa organizadora', category: 'Organização',
    weightKg: 1.5, stockQuantity: 12, warehouseNodeId: nodeId, isActive: true, createdAt, updatedAt: createdAt,
    ...overrides,
  };
}

function productsDataSource(overrides: Partial<ProductDataSource> = {}): ProductDataSource {
  return {
    async findWarehouseNode() { return { id: nodeId, isActive: true }; },
    async findProductBySku() { return null; },
    async findProduct(requestedId) { return requestedId === productId ? product() : null; },
    async listProducts() { return [product()]; },
    async createProduct(input) { return product(input); },
    ...overrides,
  };
}

test('POST /api/v1/products creates a normalized product at an active warehouse position', async () => {
  let created: unknown;
  const server = buildServer(undefined, undefined, productsDataSource({
    async createProduct(input) { created = input; return product(input); },
  }));
  const response = await server.inject({
    method: 'POST', url: '/api/v1/products',
    payload: { sku: ' sp-box-01 ', name: ' Caixa organizadora ', category: ' Organização ', weightKg: 1.5, stockQuantity: 12, warehouseNodeId: nodeId },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(created, {
    sku: 'SP-BOX-01', name: 'Caixa organizadora', category: 'Organização', weightKg: 1.5,
    stockQuantity: 12, warehouseNodeId: nodeId, isActive: true,
  });
  assert.equal(response.json().product.createdAt, createdAt.toISOString());
  await server.close();
});

test('POST /api/v1/products rejects a duplicate SKU and inactive positions', async () => {
  const duplicateServer = buildServer(undefined, undefined, productsDataSource({ async findProductBySku() { return product(); } }));
  const duplicate = await duplicateServer.inject({
    method: 'POST', url: '/api/v1/products',
    payload: { sku: 'SP-BOX-01', name: 'Caixa', weightKg: 1, stockQuantity: 0, warehouseNodeId: nodeId },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error.code, 'PRODUCT_SKU_ALREADY_EXISTS');
  await duplicateServer.close();

  const inactiveServer = buildServer(undefined, undefined, productsDataSource({ async findWarehouseNode() { return { id: nodeId, isActive: false }; } }));
  const inactive = await inactiveServer.inject({
    method: 'POST', url: '/api/v1/products',
    payload: { sku: 'SP-NEW-01', name: 'Produto', weightKg: 1, stockQuantity: 0, warehouseNodeId: nodeId },
  });
  assert.equal(inactive.statusCode, 422);
  assert.equal(inactive.json().error.code, 'WAREHOUSE_NODE_INACTIVE');
  await inactiveServer.close();
});

test('product routes validate input and expose list and detail queries', async () => {
  const server = buildServer(undefined, undefined, productsDataSource());
  const invalid = await server.inject({
    method: 'POST', url: '/api/v1/products',
    payload: { sku: 'SP-NEW-01', name: 'Produto', weightKg: 0, stockQuantity: -1, warehouseNodeId: nodeId },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, 'INVALID_PRODUCT_REQUEST');

  const list = await server.inject({ method: 'GET', url: '/api/v1/products' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().products[0].id, productId);

  const detail = await server.inject({ method: 'GET', url: `/api/v1/products/${productId}` });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().product.sku, 'SP-BOX-01');

  const missing = await server.inject({ method: 'GET', url: '/api/v1/products/33333333-3333-4333-8333-333333333333' });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, 'PRODUCT_NOT_FOUND');
  await server.close();
});
