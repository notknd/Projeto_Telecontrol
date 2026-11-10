import type { FastifyInstance } from 'fastify';
import type { CreateOrderInput, OrderDataSource, OrderRecord } from './order-data-source.js';

export class OrderRequestError extends Error {
  constructor(readonly statusCode: 400 | 404 | 409 | 422, readonly code: string, message: string) {
    super(message);
    this.name = 'OrderRequestError';
  }
}

function parseUuid(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function parseOrder(body: unknown): { code: string; items: Array<{ productId: string; quantity: number }> } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new OrderRequestError(400, 'INVALID_ORDER_REQUEST', 'A requisição de pedido é inválida.');
  }
  const input = body as Record<string, unknown>;
  if (typeof input.code !== 'string' || !input.code.trim() || input.code.trim().length > 50) {
    throw new OrderRequestError(400, 'INVALID_ORDER_REQUEST', 'O campo code é inválido.');
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new OrderRequestError(400, 'INVALID_ORDER_REQUEST', 'O pedido deve possuir ao menos um item.');
  }
  const productIds = new Set<string>();
  const items = input.items.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new OrderRequestError(400, 'INVALID_ORDER_REQUEST', 'Um item do pedido é inválido.');
    }
    const productId = parseUuid((item as Record<string, unknown>).productId);
    const quantity = (item as Record<string, unknown>).quantity;
    if (!productId || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      throw new OrderRequestError(400, 'INVALID_ORDER_REQUEST', 'Os itens do pedido devem informar produto e quantidade positiva.');
    }
    if (productIds.has(productId)) {
      throw new OrderRequestError(400, 'INVALID_ORDER_REQUEST', 'Um produto só pode aparecer uma vez no pedido.');
    }
    productIds.add(productId);
    return { productId, quantity };
  });
  return { code: input.code.trim().toUpperCase(), items };
}

function orderResponse(order: OrderRecord) {
  return {
    id: order.id, code: order.code, status: order.status,
    createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({ ...item })),
  };
}

export function registerOrderRoutes(server: FastifyInstance, dataSource: OrderDataSource): void {
  server.get('/api/v1/orders', async () => ({ orders: (await dataSource.listOrders()).map(orderResponse) }));

  server.get<{ Params: { orderId: string } }>('/api/v1/orders/:orderId', async (request) => {
    const orderId = parseUuid(request.params.orderId);
    const order = orderId ? await dataSource.findOrder(orderId) : null;
    if (!order) throw new OrderRequestError(404, 'ORDER_NOT_FOUND', 'O pedido solicitado não foi encontrado.');
    return { order: orderResponse(order) };
  });

  server.post<{ Body: unknown }>('/api/v1/orders', async (request, reply) => {
    const parsed = parseOrder(request.body);
    const [existingOrder, products] = await Promise.all([
      dataSource.findOrderByCode(parsed.code), dataSource.findProducts(parsed.items.map((item) => item.productId)),
    ]);
    if (existingOrder) throw new OrderRequestError(409, 'ORDER_CODE_ALREADY_EXISTS', 'Já existe um pedido com este código.');
    const productsById = new Map(products.map((product) => [product.id, product]));
    const missingProduct = parsed.items.find((item) => !productsById.has(item.productId));
    if (missingProduct) throw new OrderRequestError(404, 'PRODUCT_NOT_FOUND', 'Um produto informado não foi encontrado.');
    const unavailableProduct = parsed.items.find((item) => {
      const product = productsById.get(item.productId)!;
      return !product.isActive || product.stockQuantity < item.quantity;
    });
    if (unavailableProduct) throw new OrderRequestError(422, 'PRODUCT_NOT_ORDERABLE', 'Um produto está inativo ou sem estoque suficiente.');
    const input: CreateOrderInput = {
      code: parsed.code,
      items: parsed.items.map((item) => {
        const product = productsById.get(item.productId)!;
        return { ...item, productSkuSnapshot: product.sku, productNameSnapshot: product.name };
      }),
    };
    const order = await dataSource.createOrder(input);
    return reply.status(201).send({ order: orderResponse(order) });
  });
}
