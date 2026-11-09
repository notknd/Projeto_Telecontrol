import type { FastifyInstance } from 'fastify';
import type { ProductDataSource, ProductRecord } from './product-data-source.js';

export class ProductRequestError extends Error {
  constructor(readonly statusCode: 400 | 404 | 409 | 422, readonly code: string, message: string) {
    super(message);
    this.name = 'ProductRequestError';
  }
}

type CreateProductInput = Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>;

function parseUuid(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new ProductRequestError(400, 'INVALID_PRODUCT_REQUEST', `O campo ${field} é inválido.`);
  }
  return value.trim();
}

function parseCreateProduct(body: unknown): CreateProductInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ProductRequestError(400, 'INVALID_PRODUCT_REQUEST', 'A requisição de produto é inválida.');
  }
  const input = body as Record<string, unknown>;
  const sku = requiredText(input.sku, 'sku', 50).toUpperCase();
  const name = requiredText(input.name, 'name', 120);
  const warehouseNodeId = parseUuid(input.warehouseNodeId);
  if (!warehouseNodeId) throw new ProductRequestError(400, 'INVALID_PRODUCT_REQUEST', 'O campo warehouseNodeId é inválido.');
  const weightKg = input.weightKg;
  if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg <= 0) {
    throw new ProductRequestError(400, 'INVALID_PRODUCT_REQUEST', 'O campo weightKg deve ser maior que zero.');
  }
  const stockQuantity = input.stockQuantity;
  if (typeof stockQuantity !== 'number' || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
    throw new ProductRequestError(400, 'INVALID_PRODUCT_REQUEST', 'O campo stockQuantity deve ser um inteiro não negativo.');
  }
  const category = input.category === undefined || input.category === null ? null : requiredText(input.category, 'category', 80);
  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') {
    throw new ProductRequestError(400, 'INVALID_PRODUCT_REQUEST', 'O campo isActive é inválido.');
  }
  return { sku, name, category, warehouseNodeId, weightKg, stockQuantity, isActive: input.isActive ?? true };
}

function productResponse(product: ProductRecord) {
  return { ...product, createdAt: product.createdAt.toISOString(), updatedAt: product.updatedAt.toISOString() };
}

export function registerProductRoutes(server: FastifyInstance, dataSource: ProductDataSource): void {
  server.get('/api/v1/products', async () => ({ products: (await dataSource.listProducts()).map(productResponse) }));

  server.get<{ Params: { productId: string } }>('/api/v1/products/:productId', async (request) => {
    const productId = parseUuid(request.params.productId);
    const product = productId ? await dataSource.findProduct(productId) : null;
    if (!product) throw new ProductRequestError(404, 'PRODUCT_NOT_FOUND', 'O produto solicitado não foi encontrado.');
    return { product: productResponse(product) };
  });

  server.post<{ Body: unknown }>('/api/v1/products', async (request, reply) => {
    const input = parseCreateProduct(request.body);
    const [node, existingProduct] = await Promise.all([
      dataSource.findWarehouseNode(input.warehouseNodeId), dataSource.findProductBySku(input.sku),
    ]);
    if (!node) throw new ProductRequestError(404, 'WAREHOUSE_NODE_NOT_FOUND', 'A posição informada não foi encontrada.');
    if (!node.isActive) throw new ProductRequestError(422, 'WAREHOUSE_NODE_INACTIVE', 'A posição informada está inativa.');
    if (existingProduct) throw new ProductRequestError(409, 'PRODUCT_SKU_ALREADY_EXISTS', 'Já existe um produto com este SKU.');
    const product = await dataSource.createProduct(input);
    return reply.status(201).send({ product: productResponse(product) });
  });
}
