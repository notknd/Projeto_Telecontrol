export interface WarehouseOption { id: string; code: string; name: string; isActive: boolean }
export interface WarehouseNode {
  warehouseId?: string;
  id: string;
  code: string;
  type: string;
  x: number;
  y: number;
  label: string | null;
  isActive: boolean;
}
export interface Warehouse {
  nodes: WarehouseNode[];
  edges: {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    distanceMeters: number;
  }[];
}
export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  weightKg: number;
  stockQuantity: number;
  warehouseNodeId: string;
  isActive: boolean;
  warehouseNode: WarehouseNode;
}
export interface OrderItem {
  id: string;
  productId: string;
  productSkuSnapshot: string;
  productNameSnapshot: string;
  requestedQuantity: number;
  collectedQuantity: number;
  product: Product;
}
export interface Route {
  id: string;
  status: string;
  totalDistanceMeters: number;
  conventionalDistanceMeters: number | null;
  conventionalPathNodeIds: string[] | null;
  calculatedAt: string;
  algorithm: string;
  steps: { warehouseNodeId: string; sequence: number }[];
  stops: {
    warehouseNodeId: string;
    sequence: number;
    warehouseNode: WarehouseNode;
    items: { orderItemId: string }[];
  }[];
}
export interface Collection {
  id: string;
  routeId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  items: {
    id: string;
    orderItemId: string;
    requestedQuantity: number;
    collectedQuantity: number;
  }[];
}
export interface Order {
  warehouseId?: string;
  id: string;
  code: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
  routes: Route[];
  collections: Collection[];
}

export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "Não foi possível acessar o servidor. Confira a conexão e tente novamente.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error?.message ?? "O servidor não conseguiu concluir a operação.",
    );
  return data as T;
}
async function list<T>(path: string, key: string): Promise<T[]> {
  const result = await request<Record<string, T[]>>(path);
  return result[key] ?? [];
}
export const api = {
  warehouses: () => Promise.resolve<WarehouseOption[]>([]),
  warehouse: async (_warehouseId?: string) => ({ nodes: [], edges: [] } as Warehouse),
  products: async (warehouseId?: string) => (await list<Omit<Product, 'warehouseNode'> & { warehouseNode?: WarehouseNode }>("/products" + (warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : ''), 'products')).map((product) => ({
    ...product,
    warehouseNode: product.warehouseNode ?? { id: product.warehouseNodeId, code: product.warehouseNodeId, type: 'STORAGE', x: 0, y: 0, label: null, isActive: true },
  })),
  distance: async (_fromNodeId: string, _toNodeId: string) => { throw new Error("A consulta de distância ainda não está disponível na API."); },
  orders: async (warehouseId?: string) => (await list<Omit<Order, 'routes' | 'collections'> & { routes?: Route[]; collections?: Collection[] }>("/orders" + (warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : ''), 'orders')).map((order) => ({ ...order, routes: order.routes ?? [], collections: order.collections ?? [] })),
  createOrder: async (body: { code: string; items: Array<{ productId: string; requestedQuantity: number }> }) => {
    const response = await request<{ order: Order }>("/orders", "POST", {
      code: body.code,
      items: body.items.map((item) => ({ productId: item.productId, quantity: item.requestedQuantity })),
    });
    return response.order;
  },
  calculate: async (orderId: string) => request<{ orderId: string; route: Route }>("/routes/calculate", "POST", { orderId }),
  start: async (orderId: string, routeId: string) => {
    const response = await request<{ collection: Collection }>("/collections", "POST", { orderId, routeId });
    return response.collection;
  },
  collect: (id: string, itemId: string, collectedQuantity: number) =>
    request(`/collections/${id}/items/${itemId}`, "PATCH", {
      collectedQuantity,
    }),
  complete: (id: string) => request(`/collections/${id}/complete`, "POST"),
  history: () => list<unknown>("/collections/history", "collections"),
};
